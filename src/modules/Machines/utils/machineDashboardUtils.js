export const MAINTENANCE_TYPES = [
  'Заміна робочої поверхні',
  'Торцування столу та заміна колишків',
  'Заміна цанги',
  'Заміна деталі у верстаті'
]

export const MACHINE_HEADS = ['1 Голова', '2 Голова', '3 Голова', '4 Голова']

export const MACHINE_SPARE_PARTS = []

export function parseMaintenanceLog(rawLog) {
  if (!rawLog) return rawLog

  let maintenance_type = rawLog.maintenance_type || null
  let machine_head = rawLog.machine_head || null
  let spare_part = rawLog.spare_part || null
  let notes = rawLog.notes || null
  let performed_by = rawLog.performed_by || ''

  const rawPerformed = String(performed_by || '')

  if (rawPerformed.includes('[TYPE:')) {
    const typeMatch = rawPerformed.match(/\[TYPE:([^\]]*)\]/i)
    if (typeMatch && !maintenance_type) maintenance_type = typeMatch[1].trim()

    const headMatch = rawPerformed.match(/\[HEAD:([^\]]*)\]/i)
    if (headMatch && !machine_head) machine_head = headMatch[1].trim()

    const spareMatch = rawPerformed.match(/\[SPARE:([^\]]*)\]/i)
    if (spareMatch && !spare_part) spare_part = spareMatch[1].trim()

    const notesMatch = rawPerformed.match(/\[NOTES:([^\]]*)\]/i)
    if (notesMatch && !notes) notes = notesMatch[1].trim()

    performed_by = rawPerformed
      .replace(/\[TYPE:[^\]]*\]/gi, '')
      .replace(/\[HEAD:[^\]]*\]/gi, '')
      .replace(/\[SPARE:[^\]]*\]/gi, '')
      .replace(/\[NOTES:[^\]]*\]/gi, '')
      .trim()
  } else if (rawPerformed.startsWith('{') && rawPerformed.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawPerformed)
      if (parsed.type && !maintenance_type) maintenance_type = parsed.type
      if (parsed.head && !machine_head) machine_head = parsed.head
      if (parsed.spare && !spare_part) spare_part = parsed.spare
      if (parsed.notes && !notes) notes = parsed.notes
      if (parsed.user) performed_by = parsed.user
    } catch {}
  }

  // If no maintenance_type was stored, default to 'Очищення робочої поверхні'
  if (!maintenance_type) {
    maintenance_type = 'Очищення робочої поверхні'
  }

  return {
    ...rawLog,
    maintenance_type,
    machine_head,
    spare_part,
    notes,
    performed_by: performed_by || '—'
  }
}

export const isFairyMachine = machine => {
  const text = `${machine?.name || ''} ${machine?.type || ''}`.toLowerCase()
  return text.includes('фея') || text.includes('ke xin') || text.includes('ke-xin')
}

const normalizeMachineLabel = value => String(value || '')
  .toLowerCase()
  .replace(/[×х]/g, 'x')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeMachineNumber = value => String(value || '')
  .toLowerCase()
  .replace(/^№\s*/, '')
  .replace(/\s+/g, '')
  .trim()

const splitMachineLabel = value => {
  const text = normalizeMachineLabel(value)
  const match = text.match(/^(.*?)\s*№\s*([^\s]+)\s*$/)
  return match
    ? { base: match[1].trim(), number: normalizeMachineNumber(match[2]) }
    : { base: text, number: '' }
}

export const isCardAssignedToMachine = (card, machine) => {
  if (!card || !machine) return false

  const cardMachineId = String(card.machine_id || '').trim()
  const machineId = String(machine.id || '').trim()
  if (cardMachineId) return Boolean(machineId && cardMachineId === machineId)

  const rawCardLabel = card.machine_name || card.machine
  if (!rawCardLabel || normalizeMachineLabel(rawCardLabel) === 'не вказано') return false

  const cardLabel = splitMachineLabel(rawCardLabel)
  const machineNumbers = [machine.sequence_number, machine.inventory_no]
    .map(normalizeMachineNumber)
    .filter(Boolean)
  if (cardLabel.number && machineNumbers.length > 0 && !machineNumbers.includes(cardLabel.number)) return false

  const names = [machine.name, machine.type]
    .map(normalizeMachineLabel)
    .filter(Boolean)
  const nameMatches = names.some(name => (
    cardLabel.base === name || cardLabel.base.includes(name) || name.includes(cardLabel.base)
  ))

  if (cardLabel.number && machineNumbers.includes(cardLabel.number)) {
    return nameMatches || !cardLabel.base
  }
  return nameMatches
}

const eventTime = row => new Date(
  row?.completed_at || row?.updated_at || row?.created_at || row?.started_at || 0
).getTime() || 0

const cardKey = row => String(row?.card_id || row?.id || '')

const validOperator = value => {
  const name = String(value || '').trim()
  if (!name) return null
  if (['—', '-', 'не вказано', 'невідомо'].includes(name.toLowerCase())) return null
  return name
}

export const buildUniqueMachineCardHistory = rows => {
  const grouped = new Map()

  ;(rows || []).filter(Boolean).forEach(row => {
    const key = cardKey(row)
    if (!key) return
    const previous = grouped.get(key)
    if (!previous) {
      grouped.set(key, {
        ...row,
        _operatorEvents: validOperator(row.operator_name)
          ? [{ name: validOperator(row.operator_name), time: eventTime(row) }]
          : []
      })
      return
    }

    const newest = eventTime(row) >= eventTime(previous) ? row : previous
    const oldestStartedAt = [previous.started_at, row.started_at]
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0] || newest.started_at

    grouped.set(key, {
      ...previous,
      ...newest,
      card_id: previous.card_id || row.card_id || previous.id || row.id,
      started_at: oldestStartedAt,
      qty_completed: Math.max(Number(previous.qty_completed || previous.quantity) || 0, Number(row.qty_completed || row.quantity) || 0),
      scrap_qty: Math.max(Number(previous.scrap_qty) || 0, Number(row.scrap_qty) || 0),
      is_active: Boolean(previous.is_active || row.is_active),
      is_pending: !previous.is_active && !row.is_active && Boolean(previous.is_pending || row.is_pending),
      is_queued: !previous.is_active && !row.is_active && Boolean(previous.is_queued || row.is_queued),
      is_conflict: Boolean(previous.is_conflict || row.is_conflict),
      _operatorEvents: [
        ...(previous._operatorEvents || []),
        ...(validOperator(row.operator_name) ? [{ name: validOperator(row.operator_name), time: eventTime(row) }] : [])
      ]
    })
  })

  return [...grouped.values()].map(row => {
    const seen = new Set()
    const operators = (row._operatorEvents || [])
      .sort((a, b) => a.time - b.time)
      .map(event => event.name)
      .filter(name => {
        const key = name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    const { _operatorEvents, ...cleanRow } = row
    return { ...cleanRow, operators }
  }).sort((a, b) => eventTime(b) - eventTime(a))
}

export const getMachineStatusView = (machine, hasActiveCard = false) => {
  if (machine?.status === 'repair') return { key: 'repair', label: 'В ремонті', color: '#f59e0b' }
  if (machine?.status === 'maintenance_required') return { key: 'required', label: 'Потребує обслуговування', color: '#ef4444' }
  if (machine?.status === 'under_maintenance') return { key: 'maintenance', label: 'Обслуговується', color: '#3b82f6' }
  if (hasActiveCard) return { key: 'working', label: 'У роботі', color: '#ef4444' }
  return { key: 'idle', label: 'Вільний', color: '#10b981' }
}
