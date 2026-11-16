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
  let notes = rawLog.notes || rawLog.comment || rawLog.description || rawLog.details || rawLog.reason || null
  let performed_by = rawLog.performed_by || ''

  const rawPerformed = String(performed_by || '')

  if (rawPerformed.includes('[TYPE:')) {
    const typeMatch = rawPerformed.match(/\[TYPE:([^\]]*)\]/i)
    if (typeMatch && !maintenance_type) maintenance_type = typeMatch[1].trim()

    const headMatch = rawPerformed.match(/\[HEAD:([^\]]*)\]/i)
    if (headMatch && !machine_head) machine_head = headMatch[1].trim()

    const spareMatch = rawPerformed.match(/\[SPARE:([^\]]*)\]/i)
    if (spareMatch && !spare_part) spare_part = spareMatch[1].trim()

    const notesMatch = rawPerformed.match(/\[(?:NOTES|COMMENT|DESC):([^\]]*)\]/i)
    if (notesMatch && !notes) notes = notesMatch[1].trim()

    performed_by = rawPerformed
      .replace(/\[TYPE:[^\]]*\]/gi, '')
      .replace(/\[HEAD:[^\]]*\]/gi, '')
      .replace(/\[SPARE:[^\]]*\]/gi, '')
      .replace(/\[(?:NOTES|COMMENT|DESC):[^\]]*\]/gi, '')
      .trim()
  } else if (rawPerformed.startsWith('{') && rawPerformed.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawPerformed)
      if (parsed.type && !maintenance_type) maintenance_type = parsed.type
      if (parsed.head && !machine_head) machine_head = parsed.head
      if (parsed.spare && !spare_part) spare_part = parsed.spare
      if ((parsed.notes || parsed.comment || parsed.description) && !notes) {
        notes = parsed.notes || parsed.comment || parsed.description
      }
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

export const isCuttingBufferStage = stageName => {
  const s = String(stageName || '').trim().toLowerCase()
  return s.includes('буфер') && s.includes('розкр')
}

export const isCuttingOperatorName = value => {
  const name = String(value || '').trim()
  if (!name) return false
  const clean = name.toLowerCase()
  if (
    ['—', '-', 'null', 'undefined', 'не вказано', 'невідомо', 'команда', 'буфер', 'система', 'робот'].includes(clean)
    || clean.startsWith('команда')
    || clean.startsWith('буфер')
    || clean.startsWith('цех')
  ) {
    return false
  }
  return true
}

const validOperator = value => {
  const name = String(value || '').trim()
  return isCuttingOperatorName(name) ? name : null
}

const rowDurationMs = row => {
  if (!row?.started_at || !row?.completed_at) return 0
  const start = new Date(row.started_at).getTime()
  const end = new Date(row.completed_at).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return end - start
}

export const buildUniqueMachineCardHistory = rows => {
  const grouped = new Map()

  ;(rows || []).filter(Boolean).forEach(row => {
    const key = cardKey(row)
    if (!key) return
    const previous = grouped.get(key)
    const segMs = rowDurationMs(row)
    const isBuffer = isCuttingBufferStage(row.stage_name)
    const opName = isBuffer ? null : validOperator(row.operator_name)

    if (!previous) {
      grouped.set(key, {
        ...row,
        duration_ms: isBuffer ? 0 : segMs,
        buffer_duration_ms: isBuffer ? segMs : 0,
        _hasCuttingRow: !isBuffer,
        _operatorEvents: opName
          ? [{ name: opName, time: eventTime(row) }]
          : []
      })
      return
    }

    const rowWinsMetadata = (!isBuffer && !previous._hasCuttingRow)
      || (isBuffer === !previous._hasCuttingRow && eventTime(row) >= eventTime(previous))
    const newest = rowWinsMetadata ? row : previous
    const cuttingStartCandidates = [
      previous._hasCuttingRow ? previous.started_at : null,
      !isBuffer ? row.started_at : null
    ].filter(Boolean).sort((a, b) => new Date(a) - new Date(b))
    const oldestStartedAt = cuttingStartCandidates[0] || newest.started_at

    grouped.set(key, {
      ...previous,
      ...newest,
      card_id: previous.card_id || row.card_id || previous.id || row.id,
      started_at: oldestStartedAt,
      duration_ms: (previous.duration_ms || 0) + (isBuffer ? 0 : segMs),
      buffer_duration_ms: (previous.buffer_duration_ms || 0) + (isBuffer ? segMs : 0),
      _hasCuttingRow: Boolean(previous._hasCuttingRow || !isBuffer),
      qty_completed: Math.max(Number(previous.qty_completed || previous.quantity) || 0, Number(row.qty_completed || row.quantity) || 0),
      scrap_qty: Math.max(Number(previous.scrap_qty) || 0, Number(row.scrap_qty) || 0),
      is_active: Boolean(previous.is_active || row.is_active),
      is_pending: !previous.is_active && !row.is_active && Boolean(previous.is_pending || row.is_pending),
      is_queued: !previous.is_active && !row.is_active && Boolean(previous.is_queued || row.is_queued),
      is_conflict: Boolean(previous.is_conflict || row.is_conflict),
      _operatorEvents: [
        ...(previous._operatorEvents || []),
        ...(opName ? [{ name: opName, time: eventTime(row) }] : [])
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
    const { _operatorEvents, _hasCuttingRow, ...cleanRow } = row
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
