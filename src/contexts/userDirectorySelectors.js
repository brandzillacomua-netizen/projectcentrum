import { filterReceptionOperators } from '../utils/operatorFiltering'

const OPERATOR_POSITION_MARKERS = [
  'оператор',
  'галтовщик',
  'пресов',
  'пресув',
  'маляр',
  'слюсар',
  'чистил',
  'працівник',
  'вкя',
  'якост',
  'підготов'
]

const includesPositionMarker = (user, markers = OPERATOR_POSITION_MARKERS) => {
  const position = String(user?.position || '').toLowerCase()
  return Boolean(position) && markers.some(marker => position.includes(marker))
}

const matchesShift = (user, shift) => (
  !shift || shift === 'Без зміни' || user.shift === shift || user.shift === 'Без зміни'
)

const sortUsersByName = users => [...users].sort((left, right) => (
  String(left?.last_name || '').localeCompare(String(right?.last_name || ''), 'uk') ||
  String(left?.first_name || '').localeCompare(String(right?.first_name || ''), 'uk')
))

const mergeUniqueUsers = (primary, additional) => {
  const merged = [...primary]
  additional.forEach(user => {
    if (!merged.some(existing => existing.id === user.id)) merged.push(user)
  })
  return merged
}

export const formatUserName = user => {
  const lastName = String(user?.last_name || '').trim()
  const firstName = String(user?.first_name || '').trim()
  return ([lastName, firstName].filter(Boolean).join(' ') || String(user?.login || '')).trim()
}

export const selectOperatorNames = systemUsers => (
  (systemUsers || [])
    .filter(user => includesPositionMarker(user))
    .map(formatUserName)
    .filter(Boolean)
)

export const selectFilteredOperatorNames = (systemUsers, department, shift, stage = null) => {
  const users = systemUsers || []
  let list = department ? users.filter(user => user.department === department) : [...users]

  if (shift && shift !== 'Без зміни') {
    list = list.filter(user => matchesShift(user, shift))
  }

  if (stage) {
    const stageLower = stage.toLowerCase()

    if (stageLower === 'розкрій') {
      list = list.filter(user => includesPositionMarker(user, ['оператор']))
    } else if (stageLower.includes('галтовка')) {
      list = list.filter(user => includesPositionMarker(user, ['галтовщик']))
    } else if (stageLower === 'прийомка') {
      list = filterReceptionOperators(users, shift, department)
    } else if (stageLower === 'сортування') {
      const departmentUsers = users.filter(user => matchesShift(user, shift) && user.department === 'Сортування')
      list = mergeUniqueUsers(
        list.filter(user => includesPositionMarker(user, ['сортув', 'сортувал', 'працівник'])),
        departmentUsers
      )
    } else if (stageLower === 'доопрацювання') {
      const departmentUsers = users.filter(user => (
        matchesShift(user, shift) &&
        (user.department === 'Доопрацювання' || user.department === 'Відділ Доопрацювання')
      ))
      list = mergeUniqueUsers(
        list.filter(user => includesPositionMarker(user, ['слюсар', 'майстер', 'доопрац'])),
        departmentUsers
      )
    } else if (stageLower === 'фарбування') {
      list = list.filter(user => includesPositionMarker(user, ['маляр']))
    } else if (stageLower === 'пресування') {
      list = list.filter(user => includesPositionMarker(user, ['прес', 'пресув']))
    } else if (stageLower === 'підготовка') {
      list = list.filter(user => Boolean(user?.position) && (
        includesPositionMarker(user, ['працівник вп', 'підготов']) ||
        user.department === 'Відділ Підготовки'
      ))
    } else {
      list = list.filter(user => includesPositionMarker(user))
    }
  } else {
    list = list.filter(user => includesPositionMarker(user))
  }

  return sortUsersByName(list).map(formatUserName).filter(Boolean)
}

const isManager = user => includesPositionMarker(user, ['майстер', 'нач', 'директор', 'адмін'])

export const selectManagerNames = systemUsers => (
  (systemUsers || []).filter(isManager).map(formatUserName).filter(Boolean)
)

export const selectFilteredManagerNames = (systemUsers, department) => {
  const users = department
    ? (systemUsers || []).filter(user => (
        !user.department || user.department === department || user.department === 'Керівництво'
      ))
    : (systemUsers || [])

  return users.filter(isManager).map(formatUserName).filter(Boolean)
}
