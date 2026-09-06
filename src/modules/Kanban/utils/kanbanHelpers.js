export const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const getLastName = (user) => {
  if (!user) return 'Не призначено'
  return user.last_name || user.first_name || user.login || '?'
}

export const getInitials = (user) => {
  if (!user) return '?'
  const last = (user.last_name || '')[0] || ''
  const first = (user.first_name || '')[0] || ''
  return (last + first).toUpperCase() || (user.login || '?')[0].toUpperCase()
}

export const COLUMNS = [
  { id: 'todo', title: 'В ЧЕРЗІ', color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  { id: 'in_progress', title: 'В РОБОТІ', color: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
  { id: 'review', title: 'ПЕРЕВІРКА', color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  { id: 'done', title: 'ВИКОНАНО', color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
]

export const PRIORITY_CFG = {
  low: { label: 'НИЗЬКИЙ', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  medium: { label: 'СЕРЕДНІЙ', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  high: { label: 'ВИСОКИЙ', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  urgent: { label: 'НАГАЛЬНО', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export const CARD_COLORS = [
  { id: '', label: 'Авто (від пріоритету)' },
  { id: '#ef4444', label: 'Червоний' },
  { id: '#f97316', label: 'Помаранчевий' },
  { id: '#eab308', label: 'Жовтий' },
  { id: '#22c55e', label: 'Зелений' },
  { id: '#06b6d4', label: 'Блакитний' },
  { id: '#3b82f6', label: 'Синій' },
  { id: '#8b5cf6', label: 'Фіолетовий' },
  { id: '#ec4899', label: 'Рожевий' },
  { id: '#6b7280', label: 'Сірий' },
]

export const getUserDeptId = (deptName, companyStructure) => {
  if (!deptName) return ''
  const d = deptName.toLowerCase().trim()

  if (Array.isArray(companyStructure)) {
    const match = companyStructure.find(item => {
      const name = (item.name || item.label || '').toLowerCase().trim()
      return name === d || d.includes(name) || name.includes(d)
    })
    if (match) return String(match.id)
  }

  if (d.includes('цех №1') || d.includes('цех 1')) return 'shop1'
  if (d.includes('цех №2') || d.includes('цех 2')) return 'shop2'
  if (d.includes('пакув')) return 'packaging'
  if (d.includes('склад')) return 'warehouse'
  if (d.includes('постач') || d.includes('закуп')) return 'supply'
  if (d.includes('логіст')) return 'logistics'
  if (d.includes('вкя') || d.includes('контрол')) return 'qa'
  if (d.includes('менедж') || d.includes('керівн') || d.includes('адмін')) return 'manager'
  return ''
}

export const getTaskDepartment = (task, systemUsers, companyStructure) => {
  if (task.is_collective) {
    return task.department || 'all'
  }
  const assignee = (systemUsers || []).find(u => u.login === task.assigned_to)
  if (assignee) {
    return getUserDeptId(assignee.department, companyStructure) || 'all'
  }
  return 'all'
}

export const isOverdueTask = (task) =>
  task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'

export const getAssignees = (task) => {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) return task.assignees
  if (task?.assigned_to) return [task.assigned_to]
  return []
}

export const getChecklistAssignees = (item) => {
  if (Array.isArray(item?.assignees) && item.assignees.length > 0) return item.assignees
  if (item?.assignee) return [item.assignee]
  return []
}

export const checklistProgress = (checklist = []) => {
  if (!checklist.length) return null
  const parentIds = new Set()
  checklist.forEach(item => {
    if (item.parent_id) parentIds.add(String(item.parent_id))
  })
  const leaves = checklist.filter(item => !parentIds.has(String(item.id)))
  if (!leaves.length) {
    const done = checklist.filter(i => i.done).length
    return { done, total: checklist.length, pct: Math.round((done / checklist.length) * 100) }
  }
  const done = leaves.filter(i => i.done).length
  return { done, total: leaves.length, pct: Math.round((done / leaves.length) * 100) }
}

export const toggleChecklistItem = (checklist, itemId) => {
  const item = checklist.find(i => String(i.id) === String(itemId))
  if (!item) return checklist
  const nextDone = !item.done

  const isParent = (id) => checklist.some(i => String(i.parent_id) === String(id))

  const setAllChildren = (list, pId, val) => {
    let nextList = list.map(i => String(i.parent_id) === String(pId) ? { ...i, done: val } : i)
    list.forEach(i => {
      if (String(i.parent_id) === String(pId)) {
        nextList = setAllChildren(nextList, i.id, val)
      }
    })
    return nextList
  }

  let list = checklist.map(i => String(i.id) === String(itemId) ? { ...i, done: nextDone } : i)
  if (isParent(itemId)) {
    list = setAllChildren(list, itemId, nextDone)
  }

  let changed = true
  let iterations = 0
  while (changed && iterations < 10) {
    changed = false
    list = list.map(i => {
      const hasChildren = list.some(child => String(child.parent_id) === String(i.id))
      if (hasChildren) {
        const children = list.filter(child => String(child.parent_id) === String(i.id))
        const allDone = children.every(child => child.done)
        if (i.done !== allDone) {
          changed = true
          return { ...i, done: allDone }
        }
      }
      return i
    })
    iterations++
  }
  return list
}
