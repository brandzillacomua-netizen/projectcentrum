/**
 * VKYA Stamp Helpers & User Assignments
 * Centralized mapping of Quality Control (ВКЯ) inspectors to their official stamps.
 */

export const VKYA_STAMP_ASSIGNMENTS = [
  {
    stamp: 'ВКЯ 1',
    num: 1,
    name: 'Хлібишин М.',
    shortName: 'Хлібишин М.',
    logins: ['hlibyshyn.m', 'm.khlibyshyn'],
    surnames: ['хлібишин', 'khlibyshyn', 'hlibyshyn']
  },
  {
    stamp: 'ВКЯ 2',
    num: 2,
    name: 'Оріхівський О.',
    shortName: 'Оріхівський О.',
    logins: ['orihivskiy.o', 'orikhivskyi.o', 'orihivskyi.o'],
    surnames: ['оріхівськ', 'orihivsk', 'orikhivsk']
  },
  {
    stamp: 'ВКЯ 3',
    num: 3,
    name: 'Балабас М.',
    shortName: 'Балабас М.',
    logins: ['balabas.m'],
    surnames: ['балабас', 'balabas']
  },
  {
    stamp: 'ВКЯ 4',
    num: 4,
    name: 'Цар М.',
    shortName: 'Цар М.',
    logins: ['tsar.m'],
    surnames: ['цар', 'tsar']
  },
  {
    stamp: 'ВКЯ 5',
    num: 5,
    name: 'Карпінець Тарас',
    shortName: 'Карпінець Т.',
    logins: ['taras.vkya', 'karpinets.t', 'karpinets.taras'],
    surnames: ['карпінець', 'karpinets', 'karpinec']
  },
  {
    stamp: 'ВКЯ 6',
    num: 6,
    name: '',
    shortName: '',
    logins: [],
    surnames: []
  },
  {
    stamp: 'ВКЯ 7',
    num: 7,
    name: '',
    shortName: '',
    logins: [],
    surnames: []
  },
  {
    stamp: 'ВКЯ 8',
    num: 8,
    name: '',
    shortName: '',
    logins: [],
    surnames: []
  }
]

export const STAMP_OPTIONS = VKYA_STAMP_ASSIGNMENTS.map(a => a.stamp)

/**
 * Resolves the assigned stamp (e.g. 'ВКЯ 1') for a given user profile, login, or name.
 */
export function resolveUserQcStamp(user, systemUsers = [], explicitName = '') {
  if (!user && !explicitName) return null

  // 1. Explicit profile property in access_rights or user row
  if (user?.access_rights?.qc_stamp) return user.access_rights.qc_stamp
  if (user?.qc_stamp) return user.qc_stamp
  if (user?.stamp) return user.stamp

  // Matched system user
  const sysUser = (systemUsers || []).find(u =>
    (user?.id && String(u.id) === String(user.id)) ||
    (user?.login && String(u.login).toLowerCase() === String(user.login).toLowerCase())
  )
  if (sysUser?.access_rights?.qc_stamp) return sysUser.access_rights.qc_stamp
  if (sysUser?.qc_stamp) return sysUser.qc_stamp

  // 2. Check logins
  const userLogin = String(user?.login || sysUser?.login || '').toLowerCase().trim()
  if (userLogin) {
    const matchByLogin = VKYA_STAMP_ASSIGNMENTS.find(a =>
      a.logins.some(l => l.toLowerCase() === userLogin)
    )
    if (matchByLogin) return matchByLogin.stamp
  }

  // 3. Check names / surnames
  const searchStrings = [
    explicitName,
    user?.last_name,
    user?.first_name,
    user?.name,
    sysUser?.last_name,
    sysUser?.first_name,
    sysUser?.name
  ].filter(Boolean).map(s => String(s).toLowerCase().trim())

  for (const s of searchStrings) {
    if (!s) continue
    const matched = VKYA_STAMP_ASSIGNMENTS.find(a =>
      a.surnames.some(sur => s.includes(sur))
    )
    if (matched) return matched.stamp
  }

  return null
}

/**
 * Resolves default inspector name for an assigned stamp.
 */
export function getInspectorNameForStamp(stamp) {
  if (!stamp) return ''
  const clean = String(stamp).trim()
  const assignment = VKYA_STAMP_ASSIGNMENTS.find(a => a.stamp === clean)
  return assignment?.name || ''
}

