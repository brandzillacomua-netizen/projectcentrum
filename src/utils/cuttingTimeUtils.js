/**
 * Utilities for calculating and formatting planned cutting times
 * based on CNC operation timings (per machine type and sheet count)
 * with backward-compatible fallback to load options (1, 2, 3, 4, 8, 12, 16 sheets).
 */

export const resolveMachineTypeFromCard = (card, machines = []) => {
  if (!card) return null

  if (card.machine_type) return String(card.machine_type).trim()

  const machineId = card.machine_id
  if (machineId && Array.isArray(machines) && machines.length > 0) {
    const found = machines.find(m => String(m.id) === String(machineId))
    if (found?.type) return String(found.type).trim()
  }

  const rawMachine = String(card.machine || card.machine_name || '').toLowerCase()
  if (!rawMachine) return null

  if (Array.isArray(machines) && machines.length > 0) {
    const found = machines.find(m => {
      const mName = String(m.name || '').toLowerCase()
      const mSeq = String(m.sequence_number || '').toLowerCase()
      return (mSeq && rawMachine.includes(mSeq)) || (mName && rawMachine.includes(mName))
    })
    if (found?.type) return String(found.type).trim()
  }

  if (rawMachine.includes('фея') || rawMachine.includes('ke xin') || rawMachine.includes('kexin') || rawMachine.includes('№ф')) {
    return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
  }

  if (rawMachine.includes('12*8') || rawMachine.includes('1200') || rawMachine.includes('малий') || rawMachine.includes('№1.')) {
    return 'CNC 1200x800 - 4 листи (Малий)'
  }

  return null
}

export const getCuttingEstimatedSeconds = (nomenclature, sheetsCount, quantity = 0, machineType = null) => {
  const sheets = Math.max(1, Number(sheetsCount) || 1)
  const operationTimings = nomenclature?.rule_params?.operation_timings

  // 1. New Logic: Sum of planned operation timings for this machine type
  if (operationTimings && typeof operationTimings === 'object') {
    let targetMachineOps = null

    if (machineType) {
      const normType = String(machineType).toLowerCase().trim()
      const key = Object.keys(operationTimings).find(k => {
        const normKey = String(k).toLowerCase().trim()
        return normKey === normType || normKey.includes(normType) || normType.includes(normKey)
      })
      if (key) {
        targetMachineOps = operationTimings[key]
      }
    }

    // If machineType not matched or not provided, fallback to first available machine setup
    if (!targetMachineOps) {
      const firstKey = Object.keys(operationTimings)[0]
      if (firstKey) {
        targetMachineOps = operationTimings[firstKey]
      }
    }

    if (targetMachineOps && typeof targetMachineOps === 'object') {
      let sumMinutes = 0
      let hasValidOps = false

      Object.values(targetMachineOps).forEach(opTimings => {
        if (!opTimings || typeof opTimings !== 'object') return

        // 1a. Direct match for sheetsCount
        const direct = opTimings[String(sheets)] ?? opTimings[Number(sheets)]
        if (direct !== undefined && direct !== null && direct !== '') {
          const num = Number(direct)
          if (!isNaN(num) && num > 0) {
            sumMinutes += num
            hasValidOps = true
            return
          }
        }

        // 1b. Proportional from 1 sheet if available
        const oneSheet = opTimings['1'] ?? opTimings[1]
        if (oneSheet !== undefined && oneSheet !== null && oneSheet !== '') {
          const num1 = Number(oneSheet)
          if (!isNaN(num1) && num1 > 0) {
            sumMinutes += num1 * sheets
            hasValidOps = true
            return
          }
        }

        // 1c. Proportional from closest defined sheet timing
        const valid = Object.entries(opTimings)
          .map(([k, v]) => ({ sheets: Number(k), minutes: Number(v) }))
          .filter(entry => entry.sheets > 0 && !isNaN(entry.minutes) && entry.minutes > 0)

        if (valid.length > 0) {
          valid.sort((a, b) => Math.abs(a.sheets - sheets) - Math.abs(b.sheets - sheets))
          const closest = valid[0]
          const ratePerSheet = closest.minutes / closest.sheets
          sumMinutes += sheets * ratePerSheet
          hasValidOps = true
        }
      })

      if (hasValidOps && sumMinutes > 0) {
        return Math.round(sumMinutes * 60)
      }
    }
  }

  // Тільки новий метод: всі старі методи (loadTimings, time_per_unit) повністю відключено.
  // Якщо операції за новим методом ще не заповнено — плановий час дорівнює 0.
  return 0
}

export const getCardSheetsCount = (card, nomenclature) => {
  if (!card) return 1

  if (Number(card.sheetsPerLoading) > 0) {
    return Math.max(1, Math.round(Number(card.sheetsPerLoading)))
  }

  const info = String(card.card_info || '')
  const sheetsMatch = info.match(/\[SHEETS:(\d+)\]/i)
  if (sheetsMatch && Number(sheetsMatch[1]) > 0) {
    return Number(sheetsMatch[1])
  }

  const unitsPerSheet = Math.max(1, Number(nomenclature?.units_per_sheet) || 1)
  const reqMatch = info.match(/\[REQ:(\d+)\]/i)
  const bzMatch = info.match(/\[BZ:(\d+)\]/i)
  if (reqMatch || bzMatch) {
    const loadedQty = (Number(reqMatch?.[1]) || 0) + (Number(bzMatch?.[1]) || 0)
    if (loadedQty > 0) {
      return Math.max(1, Math.ceil(loadedQty / unitsPerSheet))
    }
  }

  const qty = Number(card.quantity) || 0
  if (qty > 0) {
    return Math.max(1, Math.ceil(qty / unitsPerSheet))
  }

  return 1
}

export const isCuttingOperation = (operation = '') => {
  const op = String(operation || '').toLowerCase()
  return !op || op === 'розкрій' || op.includes('розкрій')
}

export const isCuttingCard = (card) => {
  if (!card) return false
  const op = String(card.operation || '').toLowerCase()
  if (op === 'склад сгп' || op.includes('сгп')) return false
  const info = String(card.card_info || '')
  if (info.includes('[ЗІ СКЛАДУ СГП]') || info.includes('[SHOP:2]')) return false
  return true
}

export const getCardCuttingPlanSeconds = (card, nomenclature, isCuttingStage = false, machines = []) => {
  if (!card) return 0

  const op = String(card.operation || '').toLowerCase()
  const isSgp = op === 'склад сгп' || op.includes('сгп') || String(card.card_info || '').includes('[ЗІ СКЛАДУ СГП]')
  if (isSgp) return 0

  const isCutting = isCuttingStage || isCuttingOperation(card.operation)

  if (!isCutting) {
    return Math.round(Number(card.estimated_time || card.estimated_seconds) || 0)
  }

  const sheets = getCardSheetsCount(card, nomenclature)
  const machineType = resolveMachineTypeFromCard(card, machines)
  // Тільки новий поопераційний метод: жодних фолбеків на старий estimated_time
  return getCuttingEstimatedSeconds(nomenclature, sheets, Number(card.quantity) || 0, machineType)
}

export const formatCuttingTime = (seconds) => {
  const sec = Math.round(Number(seconds) || 0)
  if (sec <= 0) return '0хв'

  const totalMin = Math.round(sec / 60)
  if (totalMin < 60) {
    return `${totalMin}хв`
  }

  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) {
    return `${h}год`
  }

  return `${h}год ${m}хв`
}

export const formatMinutesToHours = (minutes) => {
  const mins = Math.round(Number(minutes) || 0)
  if (mins <= 0) return '0хв'
  if (mins < 60) return `${mins}хв`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (m === 0) return `${h}год`
  return `${h}год ${m}хв`
}

/**
 * Parses [LAST_OP:...] string from card_info or history info
 * Example: "[LAST_OP:Сторона: side1 • Операція: уп2 ф2 лінії • Листи: 2]"
 */
export const parseLastOpTag = (cardInfo = '') => {
  if (!cardInfo || typeof cardInfo !== 'string') return null
  const match = cardInfo.match(/\[LAST_OP:([^\]]+)\]/i)
  if (!match || !match[1]) return null

  const raw = match[1].trim()
  let side = ''
  let operation = ''
  let sheet = ''

  // Format: "Сторона: side1 • Операція: уп2 ф2 лінії • Листи: 2"
  const parts = raw.split('•').map(p => p.trim())
  parts.forEach(part => {
    if (part.toLowerCase().startsWith('сторона:')) {
      side = part.replace(/^сторона:\s*/i, '').trim()
    } else if (part.toLowerCase().startsWith('операція:')) {
      operation = part.replace(/^операція:\s*/i, '').trim()
    } else if (part.toLowerCase().startsWith('листи:')) {
      sheet = part.replace(/^листи:\s*/i, '').trim()
    } else if (!operation && !part.includes(':')) {
      operation = part.trim()
    }
  })

  // Clean operation string if it contains cutter or pipe
  if (operation.includes('|')) {
    operation = operation.split('|')[0].trim()
  }

  let parsedSheet = null
  if (sheet) {
    const num = parseFloat(sheet.replace(/[^\d.]/g, ''))
    if (!isNaN(num) && num > 0) {
      parsedSheet = num
    }
  }

  return {
    raw,
    side,
    operation,
    sheet: parsedSheet
  }
}

/**
 * Builds an ordered array of operations for a machine configuration
 * Order: side1_ops -> side2_ops -> side2_cut_ops
 */
export const buildOrderedOperationsList = (machineOp) => {
  if (!machineOp) return []

  const list = []
  const filterCutter = (ops, side) => {
    if (!Array.isArray(ops)) return
    ops.forEach(op => {
      if (typeof op === 'string' && op.trim() && !op.startsWith('__CUTTER__')) {
        const cleanName = op.includes('|') ? op.split('|')[0].trim() : op.trim()
        list.push({
          name: cleanName,
          side,
          index: list.length
        })
      }
    })
  }

  filterCutter(machineOp.side1_ops, 'side1')
  filterCutter(machineOp.side2_ops, 'side2')
  filterCutter(machineOp.side2_cut_ops, 'side2_cut')

  return list
}

/**
 * Slices an ordered operations list between startOpName and endOpName.
 * @param {Array} orderedOps - Array from buildOrderedOperationsList
 * @param {string|null} startOpName - Exclusive start op (operation that previous operator finished). If null, starts from 0.
 * @param {string|null} endOpName - Inclusive end op (operation where this operator stopped). If null, finishes all.
 * @returns {Array} Sub-array of operations performed in this segment
 */
export const sliceOperationsBetween = (orderedOps = [], startOpName = null, endOpName = null) => {
  if (!Array.isArray(orderedOps) || orderedOps.length === 0) return []

  const normalize = (name) => String(name || '').trim().toLowerCase()

  let startIndex = 0
  if (startOpName) {
    const normStart = normalize(startOpName)
    const foundStart = orderedOps.findIndex(op => normalize(op.name) === normStart || normStart.includes(normalize(op.name)) || normalize(op.name).includes(normStart))
    if (foundStart >= 0) {
      startIndex = foundStart + 1
    }
  }

  let endIndex = orderedOps.length - 1
  if (endOpName) {
    const normEnd = normalize(endOpName)
    const foundEnd = orderedOps.findIndex(op => normalize(op.name) === normEnd || normEnd.includes(normalize(op.name)) || normalize(op.name).includes(normEnd))
    if (foundEnd >= 0) {
      endIndex = foundEnd
    }
  }

  if (startIndex > endIndex) {
    return []
  }

  return orderedOps.slice(startIndex, endIndex + 1)
}

/**
 * Calculates planned minutes for a slice of operations for a given sheet count
 */
export const calculateSlicePlannedMinutes = (slice = [], timingsForMachine = {}, sheetsCount = 1) => {
  if (!Array.isArray(slice) || slice.length === 0 || !timingsForMachine || typeof timingsForMachine !== 'object') {
    return 0
  }

  const sheets = Math.max(1, Number(sheetsCount) || 1)
  let totalMinutes = 0

  slice.forEach(op => {
    // 1. Direct or fuzzy lookup in timingsForMachine
    const opKey = Object.keys(timingsForMachine).find(k => {
      const kNorm = k.trim().toLowerCase()
      const opNorm = op.name.trim().toLowerCase()
      return kNorm === opNorm || kNorm.includes(opNorm) || opNorm.includes(kNorm)
    })

    if (!opKey) return
    const opTimings = timingsForMachine[opKey]
    if (!opTimings || typeof opTimings !== 'object') return

    // 1a. Direct sheet match
    const direct = opTimings[String(sheets)] ?? opTimings[sheets]
    if (direct !== undefined && direct !== null && direct !== '') {
      const num = Number(direct)
      if (!isNaN(num) && num > 0) {
        totalMinutes += num
        return
      }
    }

    // 1b. Proportional from 1 sheet
    const oneSheet = opTimings['1'] ?? opTimings[1]
    if (oneSheet !== undefined && oneSheet !== null && oneSheet !== '') {
      const num1 = Number(oneSheet)
      if (!isNaN(num1) && num1 > 0) {
        totalMinutes += num1 * sheets
        return
      }
    }

    // 1c. Proportional from closest
    const valid = Object.entries(opTimings)
      .map(([k, v]) => ({ sheets: Number(k), minutes: Number(v) }))
      .filter(entry => entry.sheets > 0 && !isNaN(entry.minutes) && entry.minutes > 0)

    if (valid.length > 0) {
      valid.sort((a, b) => Math.abs(a.sheets - sheets) - Math.abs(b.sheets - sheets))
      const closest = valid[0]
      const ratePerSheet = closest.minutes / closest.sheets
      totalMinutes += sheets * ratePerSheet
    }
  })

  return Math.round(totalMinutes * 10) / 10
}

/**
 * Evaluates performance KPI based on Plan vs Fact
 */
export const calculateEfficiency = (planMinutes = 0, factMinutes = 0) => {
  const plan = Math.max(0, Number(planMinutes) || 0)
  const fact = Math.max(0, Number(factMinutes) || 0)

  if (fact <= 0 && plan <= 0) {
    return {
      efficiencyPercent: 100,
      deltaMinutes: 0,
      deltaHours: 0,
      status: 'normal'
    }
  }

  if (fact <= 0 && plan > 0) {
    return {
      efficiencyPercent: 100,
      deltaMinutes: plan,
      deltaHours: Math.round((plan / 60) * 10) / 10,
      status: 'good'
    }
  }

  const efficiencyPercent = Math.round((plan / fact) * 1000) / 10
  const deltaMinutes = Math.round((plan - fact) * 10) / 10
  const deltaHours = Math.round(((plan - fact) / 60) * 10) / 10

  let status = 'normal'
  if (efficiencyPercent >= 110) status = 'excellent'
  else if (efficiencyPercent >= 95) status = 'good'
  else if (efficiencyPercent >= 80) status = 'normal'
  else status = 'slow'

  return {
    efficiencyPercent,
    deltaMinutes,
    deltaHours,
    status
  }
}

/**
 * Calculates planned seconds for tumbling from nomenclature rule_params
 */
export const getTumblingEstimatedSeconds = (nomenclature, sheetsCount) => {
  const sheets = Math.max(1, Number(sheetsCount) || 1)
  const tumblingTimings = nomenclature?.rule_params?.tumbling_operation_timings
  if (!tumblingTimings || typeof tumblingTimings !== 'object') return 0

  let totalMinutes = 0
  Object.values(tumblingTimings).forEach(opObj => {
    if (opObj && typeof opObj === 'object') {
      const val = opObj[sheets] ?? opObj[String(sheets)]
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (!isNaN(num) && num > 0) totalMinutes += num
      }
    }
  })

  return totalMinutes * 60
}

/**
 * Calculates planned seconds for reception from nomenclature rule_params
 */
export const getReceptionEstimatedSeconds = (nomenclature, sheetsCount) => {
  const sheets = Math.max(1, Number(sheetsCount) || 1)
  const receptionTimings = nomenclature?.rule_params?.reception_operation_timings
  if (!receptionTimings || typeof receptionTimings !== 'object') return 0

  let totalMinutes = 0
  Object.values(receptionTimings).forEach(opObj => {
    if (opObj && typeof opObj === 'object') {
      const val = opObj[sheets] ?? opObj[String(sheets)]
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (!isNaN(num) && num > 0) totalMinutes += num
      }
    }
  })

  return totalMinutes * 60
}

/**
 * Calculates planned seconds for sorting from nomenclature rule_params
 */
export const getSortingEstimatedSeconds = (nomenclature, sheetsCount) => {
  const sheets = Math.max(1, Number(sheetsCount) || 1)
  const sortingTimings = nomenclature?.rule_params?.sorting_operation_timings
  if (!sortingTimings || typeof sortingTimings !== 'object') return 0

  let totalMinutes = 0
  Object.values(sortingTimings).forEach(opObj => {
    if (opObj && typeof opObj === 'object') {
      const val = opObj[sheets] ?? opObj[String(sheets)]
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (!isNaN(num) && num > 0) totalMinutes += num
      }
    }
  })

  return totalMinutes * 60
}

/**
 * Total planned seconds for entire Shop 1: Cutting + Tumbling + Reception + Sorting
 */
export const getShop1EstimatedSeconds = (nomenclature, sheetsCount, quantity = 0, machineType = null) => {
  const cuttingSec = getCuttingEstimatedSeconds(nomenclature, sheetsCount, quantity, machineType)
  const tumblingSec = getTumblingEstimatedSeconds(nomenclature, sheetsCount)
  const receptionSec = getReceptionEstimatedSeconds(nomenclature, sheetsCount)
  const sortingSec = getSortingEstimatedSeconds(nomenclature, sheetsCount)
  return cuttingSec + tumblingSec + receptionSec + sortingSec
}


