/**
 * Utilities for calculating and formatting planned cutting times
 * based on load options (1, 2, 4, 8, 12, 16 sheets).
 */

export const getCuttingEstimatedSeconds = (nomenclature, sheetsCount, quantity = 0) => {
  const sheets = Math.max(1, Number(sheetsCount) || 1)
  const loadTimings = nomenclature?.rule_params?.loadTimings

  if (loadTimings && typeof loadTimings === 'object') {
    // 1. Direct match (e.g., '1', '2', '4', '8', '12', '16')
    const direct = loadTimings[String(sheets)] ?? loadTimings[Number(sheets)]
    if (direct !== undefined && direct !== null && direct !== '') {
      const num = Number(direct)
      if (!isNaN(num) && num > 0) {
        return Math.round(num * 60)
      }
    }

    // 2. Proportional from 1 sheet if available
    const oneSheet = loadTimings['1'] ?? loadTimings[1]
    if (oneSheet !== undefined && oneSheet !== null && oneSheet !== '') {
      const num1 = Number(oneSheet)
      if (!isNaN(num1) && num1 > 0) {
        return Math.round(num1 * sheets * 60)
      }
    }

    // 3. Proportional from closest defined sheet timing
    const valid = Object.entries(loadTimings)
      .map(([k, v]) => ({ sheets: Number(k), minutes: Number(v) }))
      .filter(entry => entry.sheets > 0 && !isNaN(entry.minutes) && entry.minutes > 0)

    if (valid.length > 0) {
      valid.sort((a, b) => Math.abs(a.sheets - sheets) - Math.abs(b.sheets - sheets))
      const closest = valid[0]
      const ratePerSheet = closest.minutes / closest.sheets
      return Math.round(sheets * ratePerSheet * 60)
    }
  }

  // 4. Fallback to time_per_unit if specified
  const unitTime = Number(nomenclature?.time_per_unit)
  if (!isNaN(unitTime) && unitTime > 0 && quantity > 0) {
    return Math.round(unitTime * quantity * 60)
  }

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

export const getCardCuttingPlanSeconds = (card, nomenclature, isCuttingStage = false) => {
  if (!card) return 0

  const op = String(card.operation || '').toLowerCase()
  const isSgp = op === 'склад сгп' || op.includes('сгп') || String(card.card_info || '').includes('[ЗІ СКЛАДУ СГП]')
  if (isSgp) return 0

  const isCutting = isCuttingStage || isCuttingOperation(card.operation)

  if (!isCutting) {
    return Math.round(Number(card.estimated_time || card.estimated_seconds) || 0)
  }

  const sheets = getCardSheetsCount(card, nomenclature)
  const estSec = getCuttingEstimatedSeconds(nomenclature, sheets, Number(card.quantity) || 0)

  if (estSec > 0) {
    return estSec
  }

  return Math.round(Number(card.estimated_time || card.estimated_seconds) || 0)
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
