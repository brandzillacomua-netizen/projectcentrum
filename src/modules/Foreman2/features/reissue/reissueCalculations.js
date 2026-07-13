import { asNumber } from '../../utils/normalize.js'

export const findMachineForReissue = (machineName, machines = []) => {
  const raw = String(machineName || '').trim()
  const base = raw.split(' №')[0].trim()
  const direct = machines.find(machine => machine.name === raw || machine.name === base || machine.type === raw || machine.type === base)
  if (direct) return direct

  const text = raw.toLowerCase()
  if (text.includes('1200') || text.includes('12x8') || text.includes('мал')) return { name: raw || 'CNC 1200x800', sheet_capacity: 4, min_capacity: 1, max_capacity: 4 }
  if (text.includes('3050') || text.includes('16x16')) return { name: raw || 'CNC 3050', sheet_capacity: 12, min_capacity: 3, max_capacity: 12 }
  if (text.includes('3060') || text.includes('30x16')) return { name: raw || 'CNC 3060', sheet_capacity: 36, min_capacity: 3, max_capacity: 36 }
  if (text.includes('6000') || text.includes('60x20')) return { name: raw || 'CNC 6000', sheet_capacity: 96, min_capacity: 4, max_capacity: 96 }
  if (text.includes('ke xin')) return { name: raw || 'CNC KE XIN', sheet_capacity: 16, min_capacity: 4, max_capacity: 16 }

  return machines[0] || { name: raw || 'Не вказано', sheet_capacity: 1, min_capacity: 1, max_capacity: 1 }
}

export const buildReissuePlan = ({ task, part, machines, requestedCards = null, capacityOverride = null }) => {
  const shortage = asNumber(part?.shortage)
  const unitsPerSheet = Math.max(1, asNumber(part?.unitsPerSheet, 1))
  const sheets = Math.ceil(shortage / unitsPerSheet)
  if (shortage <= 0 || sheets <= 0) {
    return { valid: false, reason: 'Немає нестачі для довипуску.' }
  }

  const machine = findMachineForReissue(part.machine || task?.machine_name, machines)
  const capacity = Math.max(1, asNumber(capacityOverride || machine.sheet_capacity || machine.max_capacity, 1))
  const totalCards = Math.ceil(sheets / capacity)
  const count = Math.max(1, Math.min(asNumber(requestedCards || totalCards, totalCards), totalCards))

  const cards = []
  let remainingSheets = sheets
  let remainingRequired = shortage

  for (let i = 1; i <= count; i += 1) {
    const sheetsInCard = Math.min(remainingSheets, capacity)
    if (sheetsInCard <= 0) break

    const qty = Math.ceil(sheetsInCard * unitsPerSheet)
    const req = Math.min(qty, remainingRequired)
    const bufferQty = Math.max(0, qty - req)
    const seq = i

    cards.push({
      operation: 'Розкрій',
      machine: machine.name || part.machine || task?.machine_name || 'Не вказано',
      estimatedTime: (asNumber(part?.nom?.time_per_unit) || 0) * req * 60,
      cardInfo: `[REDO] ${seq}/${totalCards} [NEED:${shortage}] [REQ:${req}] [BZ:${bufferQty}]`,
      quantity: qty,
      bufferQty,
      status: 'waiting-materials',
      is_rework: true,
      sheets: sheetsInCard
    })

    remainingSheets -= sheetsInCard
    remainingRequired -= req
  }

  if (cards.length === 0 || cards.some(card => asNumber(card.quantity) <= 0)) {
    return { valid: false, reason: 'Розрахунок дав нульову картку. Довипуск зупинено.' }
  }

  return {
    valid: true,
    task,
    part,
    shortage,
    unitsPerSheet,
    sheets,
    machine,
    capacity,
    totalCards,
    cards,
    totalQty: cards.reduce((sum, card) => sum + asNumber(card.quantity), 0)
  }
}
