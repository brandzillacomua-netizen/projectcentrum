const normalize = value => String(value || '').trim().toLocaleLowerCase('uk')

const matchesShift = (user, requestedShift) => {
  const target = normalize(requestedShift)
  if (!target || target === 'без зміни') return true

  const userShift = normalize(user?.shift)
  return userShift === target || userShift === 'без зміни'
}

/**
 * Reception workers are managed under Shop 1 in the staff module, while older
 * records can still use the dedicated Reception department. Support both data
 * models without exposing unrelated warehouse employees.
 */
export const filterReceptionOperators = (users, shift, requestedDepartment = 'Цех №1') => {
  const targetDepartment = normalize(requestedDepartment)

  return (Array.isArray(users) ? users : []).filter(user => {
    if (!matchesShift(user, shift)) return false

    const department = normalize(user?.department)
    const position = normalize(user?.position)
    const isReceptionDepartment = department.includes('прийом')
    const isShop1Department = department.includes('цех №1') || department.includes('цех 1')
    const isRequestedDepartment = Boolean(targetDepartment) && department === targetDepartment
    const isReceptionRole = position.includes('прийм') || position.includes('прийом')

    return isReceptionDepartment || (
      (isShop1Department || isRequestedDepartment) && isReceptionRole
    )
  })
}
