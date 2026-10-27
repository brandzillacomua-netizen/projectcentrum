const PRODUCTION_STAGE_MARKERS = [
  'розкрій',
  'галтов',
  'прийом',
  'сортуван',
  'прес',
  'пресуван',
  'фарб',
  'маляр',
  'підготов',
  'доопрацюв'
]

const BLOCKED_OPERATOR_NAMES = new Set([
  'команда',
  'команда галтовки',
  'сортування',
  'не вказано',
  'невідомий',
  'система',
  'термінал',
  'телевізор',
  'дашборд',
  'екран',
  '—',
  '-'
])

const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
const normalized = value => clean(value).toLocaleLowerCase('uk-UA')

export const NON_HUMAN_RESPONSIBILITY_OPTIONS = [
  {
    value: 'Помилка програми / ЧПК',
    label: '⚙️ Помилка програми / ЧПК (керуюча програма / CAM)',
    shortLabel: 'Помилка програми / ЧПК',
    description: 'Збій або помилка керуючої програми, траєкторії різу, CAM/CAD моделі'
  },
  {
    value: 'Несправність верстата / обладнання',
    label: '🛠️ Несправність верстата / обладнання (механіка / електроніка)',
    shortLabel: 'Несправність верстата',
    description: 'Механічний люфт, биття шпинделя, перегрів, відмова інструменту або датчиків'
  },
  {
    value: 'Брак матеріалу / сировини',
    label: '📦 Брак матеріалу / сировини (постачальник / кривизна листа)',
    shortLabel: 'Брак сировини',
    description: 'Кривизна металу, дефекти прокату, приховані тріщини, вина постачальника'
  },
  {
    value: 'Форс-мажор / непередбачувані обставини',
    label: '⚡ Форс-мажор / непередбачувані обставини (живлення / аварія)',
    shortLabel: 'Форс-мажор',
    description: 'Аварійне вимкнення електроенергії, збій мережі, непередбачувана зупинка'
  },
  {
    value: 'Технічні причини / без вини персоналу',
    label: '📋 Технічні причини / інше (без вини працівників)',
    shortLabel: 'Без вини персоналу',
    description: 'Тестовий запуск, налагодження або інші непередбачувані технічні фактори'
  }
]

export function isNonHumanResponsibility(name) {
  if (!name) return false
  const cleanName = clean(name).toLocaleLowerCase('uk-UA')
  if (NON_HUMAN_RESPONSIBILITY_OPTIONS.some(opt => clean(opt.value).toLocaleLowerCase('uk-UA') === cleanName)) {
    return true
  }
  return (
    cleanName.includes('помилка програм') ||
    cleanName.includes('несправність верстат') ||
    cleanName.includes('збій верстат') ||
    cleanName.includes('збій станк') ||
    cleanName.includes('брак матеріал') ||
    cleanName.includes('брак сировин') ||
    cleanName.includes('кривизна лист') ||
    cleanName.includes('форс-мажор') ||
    cleanName.includes('без вини') ||
    cleanName.includes('технічн')
  )
}

export function isShop1ResponsibilityStage(stageName) {
  const stage = normalized(stageName)
  if (!stage || stage.includes('буфер')) return false
  return PRODUCTION_STAGE_MARKERS.some(marker => stage.includes(marker))
}

export function isAssignableProductionOperator(operatorName) {
  const name = normalized(operatorName)
  if (!name || BLOCKED_OPERATOR_NAMES.has(name) || isNonHumanResponsibility(name)) return false
  if (name.startsWith('вкя') || name.startsWith('втк')) return false
  if (name.includes('контроль вкя') || name.includes('контролер якості')) return false
  if (name.includes('інспектор') || name.includes('термінал відновлення')) return false
  if (name.includes('склад') || name.includes('бронь')) return false
  if (name.includes('система') || name.includes('system')) return false
  if (name.includes('адміністратор') || name.includes('майстер цеху')) return false
  if (name.includes('телевізор') || name.includes('дашборд')) return false
  return true
}

export function formatProductionUserName(user) {
  if (!user) return ''
  const login = normalized(user.login)
  const shift = clean(user.shift)
  const lastName = clean(user.last_name)
  const firstName = clean(user.first_name)

  // Standardize Galtovka accounts
  if (login === 'galt.zm1' || (normalized(lastName).includes('галтов') && shift === 'Зміна 1')) {
    return 'Галтовка Зміна 1'
  }
  if (login === 'galt.zm2' || (normalized(lastName).includes('галтов') && shift === 'Зміна 2')) {
    return 'Галтовка Зміна 2'
  }
  if (login === 'galt.zm3' || (normalized(lastName).includes('галтов') && shift === 'Зміна 3')) {
    return 'Галтовка Зміна 3'
  }
  if (login === 'galt.zm4' || (normalized(lastName).includes('галтов') && shift === 'Зміна 4')) {
    return 'Галтовка Зміна 4'
  }

  // Standardize Press accounts
  if (login.startsWith('press') || normalized(lastName).includes('пресувал')) {
    if (shift && shift !== 'Без зміни') return `Пресувальник ${shift}`
  }

  // Standardize Paint accounts
  if (login.startsWith('paint') || normalized(lastName).includes('фарбувал')) {
    if (shift && shift !== 'Без зміни') return `Фарбувальник ${shift}`
  }

  const parts = [lastName, firstName].filter(Boolean)
  return parts.join(' ') || clean(user.login)
}

function findCanonicalUser(operatorName, systemUsers = []) {
  const name = normalized(operatorName)
  if (!name) return null

  return systemUsers.find(user => {
    const login = normalized(user.login)
    const firstName = normalized(user.first_name)
    const lastName = normalized(user.last_name)
    const formatted = normalized(formatProductionUserName(user))
    return (
      name === login ||
      name === `${lastName} ${firstName}`.trim() ||
      name === `${firstName} ${lastName}`.trim() ||
      name === formatted
    )
  }) || null
}

function isProductionUser(user) {
  if (!user) return false
  const department = normalized(user.department)
  const position = normalized(user.position)
  const login = normalized(user.login)
  const firstName = normalized(user.first_name)
  const lastName = normalized(user.last_name)

  if (login.includes('tv') || login.includes('дашборд') || login.includes('admin')) return false
  if (firstName.includes('телевізор') || lastName.includes('телевізор')) return false
  if (firstName.includes('зовнішній') || lastName.includes('користувач')) return false

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
    position.includes('адміністратор') ||
    position.includes('керівник') ||
    position.includes('начальник')
  )
}

function findGaltovshchikForShift(shiftName, systemUsers = []) {
  const normShift = normalized(shiftName)
  if (normShift) {
    const match = systemUsers.find(u => {
      if (!isProductionUser(u)) return false
      const pos = normalized(u.position)
      const dep = normalized(u.department)
      const log = normalized(u.login)
      const last = normalized(u.last_name)
      const isGalt = pos.includes('галт') || dep.includes('галт') || log.includes('galt') || last.includes('галт')
      if (!isGalt) return false
      return normalized(u.shift) === normShift || log.includes(normShift.replace('зміна', 'zm').replace(/\s+/g, ''))
    })
    if (match) return match
  }
  return systemUsers.find(u => {
    if (!isProductionUser(u)) return false
    const pos = normalized(u.position)
    const log = normalized(u.login)
    return (pos.includes('галт') || log.includes('galt')) && !log.includes('tv')
  }) || null
}

function findPressForShift(shiftName, systemUsers = []) {
  const normShift = normalized(shiftName)
  if (normShift) {
    const match = systemUsers.find(u => {
      if (!isProductionUser(u)) return false
      const pos = normalized(u.position)
      const log = normalized(u.login)
      const last = normalized(u.last_name)
      const isPress = pos.includes('прес') || log.includes('press') || last.includes('прес')
      if (!isPress) return false
      return normalized(u.shift) === normShift || log.includes(normShift.replace('зміна', 'zm').replace(/\s+/g, ''))
    })
    if (match) return match
  }
  return null
}

function findPaintForShift(shiftName, systemUsers = []) {
  const normShift = normalized(shiftName)
  if (normShift) {
    const match = systemUsers.find(u => {
      if (!isProductionUser(u)) return false
      const pos = normalized(u.position)
      const log = normalized(u.login)
      const last = normalized(u.last_name)
      const isPaint = pos.includes('маляр') || pos.includes('фарб') || log.includes('paint') || last.includes('фарб')
      if (!isPaint) return false
      return normalized(u.shift) === normShift || log.includes(normShift.replace('зміна', 'zm').replace(/\s+/g, ''))
    })
    if (match) return match
  }
  return null
}

/**
 * Returns ONLY the production workers who actively took part in processing
 * THIS specific work card across any of its stages (cutting, tumbling, sorting, pressing, painting, etc.).
 */
export function buildShop1OperatorCandidates(historyRows = [], systemUsers = []) {
  const historyCandidates = new Map()

  for (const row of historyRows || []) {
    if (!isShop1ResponsibilityStage(row.stage_name)) continue

    const stage = clean(row.stage_name)
    const normStage = normalized(stage)
    const shift = clean(row.shift_name)
    const occurredAt = row.completed_at || row.created_at || null
    const rawName = clean(row.operator_name)

    let candidateName = ''
    let candidateUser = null

    if (isAssignableProductionOperator(rawName)) {
      candidateUser = findCanonicalUser(rawName, systemUsers)
      if (candidateUser && !isProductionUser(candidateUser)) continue
      candidateName = candidateUser ? formatProductionUserName(candidateUser) : rawName
    } else if (normStage.includes('галт')) {
      candidateUser = findGaltovshchikForShift(shift, systemUsers)
      if (candidateUser) {
        candidateName = formatProductionUserName(candidateUser)
      }
    } else if (normStage.includes('прес')) {
      candidateUser = findPressForShift(shift, systemUsers)
      if (candidateUser) {
        candidateName = formatProductionUserName(candidateUser)
      }
    } else if (normStage.includes('фарб') || normStage.includes('маляр')) {
      candidateUser = findPaintForShift(shift, systemUsers)
      if (candidateUser) {
        candidateName = formatProductionUserName(candidateUser)
      }
    }

    if (!candidateName) continue

    const key = candidateUser?.id ? `user:${candidateUser.id}` : `name:${normalized(candidateName)}`

    if (!historyCandidates.has(key)) {
      historyCandidates.set(key, {
        name: candidateName,
        stages: [],
        shifts: [],
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt
      })
    }

    const candidate = historyCandidates.get(key)
    if (stage && !candidate.stages.includes(stage)) candidate.stages.push(stage)
    if (shift && !candidate.shifts.includes(shift)) candidate.shifts.push(shift)
    if (occurredAt) {
      if (!candidate.firstSeenAt || new Date(occurredAt) < new Date(candidate.firstSeenAt)) candidate.firstSeenAt = occurredAt
      if (!candidate.lastSeenAt || new Date(occurredAt) > new Date(candidate.lastSeenAt)) candidate.lastSeenAt = occurredAt
    }
  }

  return [...historyCandidates.values()].sort(
    (a, b) => new Date(a.firstSeenAt || 0) - new Date(b.firstSeenAt || 0)
  )
}
