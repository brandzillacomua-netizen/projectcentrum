import { filterReceptionOperators } from '../utils/operatorFiltering'

const OPERATOR_POSITION_MARKERS = [
  'оператор',
  'галтовщик',
  'пресов',
  'пресув',
  'маляр',
  'фарб',
  'слюсар',
  'чистил',
  'працівник',
  'вкя',
  'якост',
  'підготов',
  'сортув',
  'сортувал',
  'лицювальн',
  'лицюв',
  'лицьовальн',
  'лицьов',
  'лиц',
  'полірувальн',
  'полірув',
  'полір',
  'реставр',
  'поріз',
  'порізчик',
  'різчик',
  'гум'
]

const includesPositionMarker = (user, markers = OPERATOR_POSITION_MARKERS) => {
  const position = String(user?.position || '').toLowerCase()
  return Boolean(position) && markers.some(marker => position.includes(marker))
}

const matchesShift = (user, shift) => (
  !shift || shift === 'all' || shift === 'Без зміни' || user.shift === shift || user.shift === 'Без зміни'
)

const PAIR_PRIORITY_SURNAMES = [
  'капустинська',
  'рибчук',
  'варварина',
  'тилинька',
  'романчук',
  'куцах',
  'цирка',
  'курка',
  'ненчук',
  'дрізд',
  'папроцький',
  'бадзь',
  'гаврилюк',
  'дністрянська'
]

const getPairPriorityIndex = user => {
  const lastName = String(user?.last_name || '').toLowerCase().trim()
  if (!lastName) return Number.MAX_SAFE_INTEGER
  const idx = PAIR_PRIORITY_SURNAMES.indexOf(lastName)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

const sortUsersByName = users => [...users].sort((left, right) => {
  const prioDiff = getPairPriorityIndex(left) - getPairPriorityIndex(right)
  if (prioDiff !== 0) return prioDiff
  return (
    String(left?.last_name || '').localeCompare(String(right?.last_name || ''), 'uk') ||
    String(left?.first_name || '').localeCompare(String(right?.first_name || ''), 'uk')
  )
})

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

const isActiveUser = user => Boolean(user) && !user.is_dismissed

export const selectOperatorNames = systemUsers => (
  (systemUsers || [])
    .filter(user => isActiveUser(user) && includesPositionMarker(user))
    .map(formatUserName)
    .filter(Boolean)
)

const matchesDepartment = (userDept, targetDept) => {
  if (!targetDept || targetDept === 'all') return true
  const u = String(userDept || '').toLowerCase().trim()
  const t = String(targetDept || '').toLowerCase().trim()
  if (!t) return true
  if ((t.includes('цех 2') || t.includes('цех №2') || t.includes('цех2')) && (u.includes('цех 2') || u.includes('цех №2') || u.includes('цех2'))) {
    return true
  }
  if ((t.includes('цех 1') || t.includes('цех №1') || t.includes('цех1')) && (u.includes('цех 1') || u.includes('цех №1') || u.includes('цех1'))) {
    return true
  }
  if (t === 'сортування' && (u === 'сортування' || u.includes('цех 1') || u.includes('цех №1') || u.includes('цех1'))) {
    return true
  }
  if (t === 'доопрацювання' && (u === 'доопрацювання' || u.includes('цех 2') || u.includes('цех №2') || u.includes('цех2'))) {
    return true
  }
  return userDept === targetDept
}

export const selectFilteredOperatorNames = (systemUsers, department, shift, stage = null, options = {}) => {
  const users = (systemUsers || []).filter(isActiveUser)
  let list = department ? users.filter(user => matchesDepartment(user.department, department)) : [...users]

  if (shift && shift !== 'all' && shift !== 'Без зміни') {
    list = list.filter(user => matchesShift(user, shift))
  }

  if (stage) {
    const stageLower = stage.toLowerCase().trim()

    if (stageLower.includes('розкрій')) {
      list = list.filter(user => includesPositionMarker(user, ['оператор']))
    } else if (stageLower.includes('галтовка') || stageLower.includes('галтов')) {
      list = list.filter(user => includesPositionMarker(user, ['галтовщик']))
    } else if (stageLower.includes('прийомка')) {
      list = filterReceptionOperators(users, shift, department)
    } else if (stageLower.includes('сортуван')) {
      const sortingUsers = users.filter(user => 
        matchesShift(user, shift) && (
          includesPositionMarker(user, [
            'сортув', 'сортувал',
            'лицьов', 'лицьовальн', 'лицюв', 'лицювальн', 'лиц',
            'полір', 'полірув', 'полірувальн'
          ]) ||
          (user.department === 'Сортування' && includesPositionMarker(user, ['сортув', 'сортувал', 'працівник']))
        )
      )
      list = sortingUsers
    } else if (stageLower.includes('доопрац') || stageLower.includes('rework') || stageLower.includes('лицюв') || stageLower.includes('лицьов') || stageLower.includes('полірув') || stageLower.includes('полір') || stageLower.includes('лиц')) {
      const reworkUsers = users.filter(user =>
        matchesShift(user, shift) && (
          includesPositionMarker(user, ['лицьов', 'лицьовальн', 'лицюв', 'лицювальн', 'лиц', 'полір', 'полірув', 'полірувальн', 'доопрац', 'реставр', 'слюсар']) ||
          ((user.department === 'Доопрацювання' || user.department === 'Відділ Доопрацювання' || matchesDepartment(user.department, 'Цех №2') || matchesDepartment(user.department, department)) &&
            includesPositionMarker(user, ['лицьов', 'лицьовальн', 'лицюв', 'лицювальн', 'лиц', 'полір', 'полірув', 'полірувальн', 'доопрац', 'реставр', 'слюсар']))
        )
      )
      list = reworkUsers
    } else if (stageLower.includes('фарбуван') || stageLower.includes('маляр')) {
      list = list.filter(user => includesPositionMarker(user, ['маляр', 'фарб']))
    } else if (stageLower.includes('пресуван') || stageLower.includes('прес')) {
      list = list.filter(user => includesPositionMarker(user, ['прес', 'пресув']))
    } else if (stageLower.includes('поріз') || stageLower.includes('гум') || stageLower.includes('гума')) {
      list = users.filter(user => {
        if (!matchesShift(user, shift)) return false
        const pos = String(user?.position || '').toLowerCase()
        return pos.includes('порізка гуми') || (pos.includes('поріз') && pos.includes('гум')) || (pos.includes('різ') && pos.includes('гум'))
      })
    } else if (stageLower.includes('підготов')) {
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

  if (options?.onlyOnShiftDate) {
    list = list.filter(user => user?.shift_calendar?.[options.onlyOnShiftDate] === 'Р')
  }

  return sortUsersByName(list).map(formatUserName).filter(Boolean)
}

const isManager = user => includesPositionMarker(user, ['майстер', 'нач', 'директор', 'адмін'])

export const selectManagerNames = systemUsers => (
  (systemUsers || []).filter(user => isActiveUser(user) && isManager(user)).map(formatUserName).filter(Boolean)
)

export const selectFilteredManagerNames = (systemUsers, department) => {
  const activeUsers = (systemUsers || []).filter(isActiveUser)
  const users = department
    ? activeUsers.filter(user => (
        !user.department || user.department === department || user.department === 'Керівництво'
      ))
    : activeUsers

  return users.filter(isManager).map(formatUserName).filter(Boolean)
}
