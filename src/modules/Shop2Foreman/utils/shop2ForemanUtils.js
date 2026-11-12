export const getTodayCalendarKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const isShop2Department = (department) => {
  const dept = String(department || '').toLowerCase().trim()
  if (!dept) return false
  return dept.includes('цех 2') || dept.includes('цех №2') || dept.includes('цех2')
}

export const isShop2User = (user) => {
  if (!user) return false
  return isShop2Department(user.department)
}

export const isUserOnShiftDate = (user, dateKey = getTodayCalendarKey()) => {
  if (!user || !dateKey) return false
  return user.shift_calendar?.[dateKey] === 'Р'
}

export const getShop2RoleCategory = (user) => {
  const pos = String(user?.position || '').toLowerCase()
  if (pos.includes('прес')) return 'pressing'
  if (pos.includes('фарб') || pos.includes('маляр')) return 'painting'
  if (pos.includes('доопрац') || pos.includes('реставр') || pos.includes('слюсар') || pos.includes('лицювальн') || pos.includes('полірувальн')) return 'rework'
  if (['начальник', 'майстер', 'мастер', 'керівник'].some(kw => pos.includes(kw))) return 'masters'
  return 'other'
}

export const SHOP2_ROLE_GROUPS = [
  { key: 'painting', label: 'Фарбувальники', color: '#8b5cf6' },
  { key: 'pressing', label: 'Пресувальники', color: '#3b82f6' },
  { key: 'rework', label: 'Доопрацювання', color: '#10b981' },
  { key: 'masters', label: 'Майстри / Начальник', color: '#eab308' },
  { key: 'other', label: 'Інші', color: '#64748b' }
]

export const buildShop2TodayShiftSummary = (shop2Users = [], dateKey = getTodayCalendarKey(), formatUserName = null) => {
  const toName = (u) => {
    if (typeof formatUserName === 'function') return formatUserName(u)
    return [u?.last_name, u?.first_name].filter(Boolean).join(' ').trim() || u?.login || 'Працівник'
  }

  const onShiftUsers = (shop2Users || []).filter(u => isUserOnShiftDate(u, dateKey))
  const byRole = {
    painting: [],
    pressing: [],
    rework: [],
    masters: [],
    other: []
  }

  onShiftUsers.forEach(u => {
    const role = getShop2RoleCategory(u)
    byRole[role].push({
      id: u.id,
      name: toName(u),
      position: u.position || '',
      shift: u.shift || 'Без зміни'
    })
  })

  return {
    dateKey,
    totalCount: onShiftUsers.length,
    onShiftUsers,
    byRole
  }
}

