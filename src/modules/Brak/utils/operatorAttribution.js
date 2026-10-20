const SHOP1_STAGE_MARKERS = ['розкрій', 'галтов', 'прийом', 'сортуван']

const BLOCKED_OPERATOR_NAMES = new Set([
  'команда',
  'команда галтовки',
  'сортування',
  'не вказано',
  'невідомий',
  'система',
  'термінал',
  '—',
  '-'
])

const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
const normalized = value => clean(value).toLocaleLowerCase('uk-UA')

export function isShop1ResponsibilityStage(stageName) {
  const stage = normalized(stageName)
  if (!stage || stage.startsWith('буфер')) return false
  return SHOP1_STAGE_MARKERS.some(marker => stage.includes(marker))
}

export function isAssignableProductionOperator(operatorName) {
  const name = normalized(operatorName)
  if (!name || BLOCKED_OPERATOR_NAMES.has(name)) return false
  if (name.startsWith('вкя') || name.startsWith('втк')) return false
  if (name.includes('контроль вкя') || name.includes('контролер якості')) return false
  if (name.includes('інспектор') || name.includes('термінал відновлення')) return false
  if (name.includes('склад') || name.includes('бронь')) return false
  if (name.includes('система') || name.includes('system')) return false
  if (name.includes('адміністратор') || name.includes('майстер цеху')) return false
  return true
}

function findCanonicalUser(operatorName, systemUsers = []) {
  const name = normalized(operatorName)
  if (!name) return null

  return systemUsers.find(user => {
    const login = normalized(user.login)
    const firstName = normalized(user.first_name)
    const lastName = normalized(user.last_name)
    return name === login || name === `${lastName} ${firstName}`.trim() || name === `${firstName} ${lastName}`.trim()
  }) || null
}

function isProductionUser(user) {
  if (!user) return true
  const department = normalized(user.department)
  const position = normalized(user.position)
  return !(
    department.includes('вкя') ||
    department.includes('втк') ||
    department.includes('якост') ||
    department.includes('склад') ||
    department.includes('адміністрац') ||
    department.includes('керівниц') ||
    position.includes('контрол') ||
    position.includes('інспектор') ||
    position.includes('комірник') ||
    position.includes('майстер') ||
    position.includes('адміністратор')
  )
}

export function buildShop1OperatorCandidates(historyRows = [], systemUsers = []) {
  const candidates = new Map()

  for (const row of historyRows || []) {
    if (!isShop1ResponsibilityStage(row.stage_name)) continue

    const rawName = clean(row.operator_name)
    if (!isAssignableProductionOperator(rawName)) continue

    const user = findCanonicalUser(rawName, systemUsers)
    if (!isProductionUser(user)) continue

    const name = user
      ? [clean(user.last_name), clean(user.first_name)].filter(Boolean).join(' ') || clean(user.login)
      : rawName
    const key = user?.id ? `user:${user.id}` : `name:${normalized(name)}`
    const stage = clean(row.stage_name)
    const shift = clean(row.shift_name)
    const occurredAt = row.completed_at || row.created_at || null

    if (!candidates.has(key)) {
      candidates.set(key, { name, stages: [], shifts: [], firstSeenAt: occurredAt, lastSeenAt: occurredAt })
    }

    const candidate = candidates.get(key)
    if (stage && !candidate.stages.includes(stage)) candidate.stages.push(stage)
    if (shift && !candidate.shifts.includes(shift)) candidate.shifts.push(shift)
    if (occurredAt) {
      if (!candidate.firstSeenAt || new Date(occurredAt) < new Date(candidate.firstSeenAt)) candidate.firstSeenAt = occurredAt
      if (!candidate.lastSeenAt || new Date(occurredAt) > new Date(candidate.lastSeenAt)) candidate.lastSeenAt = occurredAt
    }
  }

  return [...candidates.values()].sort((a, b) => new Date(a.firstSeenAt || 0) - new Date(b.firstSeenAt || 0))
}

