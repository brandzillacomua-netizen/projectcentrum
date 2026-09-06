import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useMES } from '../../../MESContext'
import {
  genId,
  getUserDeptId,
  getTaskDepartment,
  isOverdueTask,
  getAssignees,
  getChecklistAssignees,
  toggleChecklistItem
} from '../utils/kanbanHelpers'

export function useKanbanState() {
  const {
    managementTasks,
    systemUsers,
    addManagementTask,
    updateManagementTask,
    deleteManagementTask,
    currentUser,
    setManagementTasks,
    companyStructure,
    fetchCompletedManagementTasks,
    fetchCompletedManagementTasksCount
  } = useMES()

  const DEPARTMENTS = useMemo(() => {
    const list = [{ id: 'all', label: 'Усі відділи' }]
    const seenIds = new Set(['all'])

    if (Array.isArray(companyStructure)) {
      companyStructure.forEach(item => {
        const idStr = String(item.id)
        if (seenIds.has(idStr)) return
        seenIds.add(idStr)
        list.push({
          id: idStr,
          label: item.name || item.label || ''
        })
      })
    }

    const staticDepts = [
      { id: 'manager', label: 'Менеджмент' },
      { id: 'shop1', label: 'Цех №1' },
      { id: 'shop2', label: 'Цех №2' },
      { id: 'packaging', label: 'Пакування' },
      { id: 'warehouse', label: 'Склад' },
      { id: 'supply', label: 'Постачання' },
      { id: 'logistics', label: 'Логістика' },
      { id: 'qa', label: 'ВКЯ' },
    ]

    staticDepts.forEach(sd => {
      const nameNorm = sd.label.toLowerCase()
      const exists = list.some(item => (item.label || '').toLowerCase() === nameNorm || item.id === sd.id)
      if (!exists) {
        list.push(sd)
      }
    })

    return list
  }, [companyStructure])

  // ── Role detection ──────────────────────────────────────────────────────
  const isDirector = useMemo(() => {
    const pos = (currentUser?.position || '').toLowerCase()
    const rights = currentUser?.access_rights || {}
    return !!(rights.director || pos.includes('директор') || pos.includes('адмін') || pos.includes('керівник підприємства'))
  }, [currentUser])

  const isManager = useMemo(() => {
    const pos = (currentUser?.position || '').toLowerCase()
    const rights = currentUser?.access_rights || {}
    return isDirector || !!(rights.master || rights.foreman || rights.manager ||
      ['начальник', 'нач', 'майстер', 'менедж', 'керівник'].some(word => pos.includes(word)))
  }, [currentUser, isDirector])

  const isTaskRelevantToUser = useCallback((task, user) => {
    if (!user || !task) return false
    const login = user.login
    if (task.created_by === login) return true
    if (getAssignees(task).includes(login)) return true
    if (Array.isArray(task.checklist) && task.checklist.some(item => getChecklistAssignees(item).includes(login))) return true
    if (task.is_collective) {
      const userDept = getUserDeptId(user.department, companyStructure)
      if (task.department === 'all' || (userDept && task.department === userDept)) return true
    }
    return false
  }, [companyStructure])

  const canManageTask = useCallback((task) => {
    if (!task || !currentUser) return false
    const login = currentUser.login
    if (task.created_by === login) return true
    if (getAssignees(task).includes(login)) return true
    if (isDirector) return true
    return isManager
  }, [currentUser, isDirector, isManager])

  // ── Filters & Search ────────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState('all')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all')
  const [statsFilter, setStatsFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMobileColumn, setActiveMobileColumn] = useState('todo')
  const [showSearch, setShowSearch] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // ── Completed Tasks On-Demand State ─────────────────────────────────────
  const [completedCount, setCompletedCount] = useState(0)
  const [completedTasks, setCompletedTasks] = useState([])
  const [completedPage, setCompletedPage] = useState(0)
  const [hasMoreCompleted, setHasMoreCompleted] = useState(true)
  const [isFetchingCompleted, setIsFetchingCompleted] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    setCompletedPage(0)
    if (typeof fetchCompletedManagementTasksCount === 'function') {
      fetchCompletedManagementTasksCount(currentUser, isDirector).then(cnt => setCompletedCount(cnt))
    }
    if (typeof fetchCompletedManagementTasks === 'function') {
      setIsFetchingCompleted(true)
      fetchCompletedManagementTasks(0, 20, currentUser, isDirector).then(res => {
        setCompletedTasks(res.data || [])
        if (res.count !== undefined) setCompletedCount(res.count)
        setHasMoreCompleted((res.data || []).length === 20)
        setIsFetchingCompleted(false)
      })
    }
  }, [currentUser?.login, isDirector])

  const loadMoreCompleted = async () => {
    if (isFetchingCompleted || !hasMoreCompleted || typeof fetchCompletedManagementTasks !== 'function') return
    const nextPage = completedPage + 1
    setIsFetchingCompleted(true)
    const res = await fetchCompletedManagementTasks(nextPage, 20, currentUser, isDirector)
    setCompletedTasks(prev => [...prev, ...(res.data || [])])
    setCompletedPage(nextPage)
    setHasMoreCompleted((res.data || []).length === 20)
    setIsFetchingCompleted(false)
  }

  // ── Modals ──────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [detailTab, setDetailTab] = useState('desc')

  // ── Create form ─────────────────────────────────────────────────────────
  const blankForm = { title: '', description: '', priority: 'medium', color: '', assigned_to: '', assignees: [], is_collective: false, department: 'all', deadline: '', checklist: [] }
  const [form, setForm] = useState(blankForm)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Edit form ───────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState(null)
  const [editCheckItem, setEditCheckItem] = useState('')
  const [editAssigneeSearch, setEditAssigneeSearch] = useState('')

  // ── Default filter by role ──────────────────────────────────────────────
  useEffect(() => {
    setFilterMode('all')
  }, [isDirector])

  // ── Filtered completed tasks ──────────────────────────────────────────────
  const filteredCompletedTasks = useMemo(() => {
    let list = (completedTasks || []).filter(t => !t.project_id)
    if (!isDirector) {
      list = list.filter(t => isTaskRelevantToUser(t, currentUser))
    }
    if (filterMode === 'my') {
      list = list.filter(t => getAssignees(t).includes(currentUser?.login))
    } else if (filterMode === 'assigned_by_me') {
      list = list.filter(t => t.created_by === currentUser?.login)
    } else if (filterMode === 'department') {
      const deptId = getUserDeptId(currentUser?.department, companyStructure)
      list = list.filter(t => t.is_collective && (t.department === deptId || t.department === 'all'))
    } else if (filterMode === 'unassigned') {
      list = list.filter(t => getAssignees(t).length === 0 && !t.is_collective)
    }

    if (selectedDeptFilter !== 'all') {
      list = list.filter(t => getTaskDepartment(t, systemUsers, companyStructure) === selectedDeptFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    }
    return list
  }, [completedTasks, isDirector, currentUser, filterMode, selectedDeptFilter, searchQuery, isTaskRelevantToUser, systemUsers, companyStructure])

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let list = (managementTasks || []).filter(t => !t.project_id)
    if (!isDirector) {
      list = list.filter(t => isTaskRelevantToUser(t, currentUser))
    }
    const hasActiveFilters = filterMode !== 'all' || selectedDeptFilter !== 'all' || searchQuery
    return {
      total: list.length,
      inProgress: list.filter(t => t.status === 'in_progress').length,
      done: hasActiveFilters ? filteredCompletedTasks.length : completedCount,
      overdue: list.filter(t => isOverdueTask(t)).length,
    }
  }, [managementTasks, isDirector, currentUser, isTaskRelevantToUser, completedCount, filteredCompletedTasks.length, filterMode, selectedDeptFilter, searchQuery])

  // ── Filtered tasks ──────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let list = (managementTasks || []).filter(t => !t.project_id)
    if (!isDirector) {
      list = list.filter(t => isTaskRelevantToUser(t, currentUser))
    }
    if (filterMode === 'my') {
      list = list.filter(t => getAssignees(t).includes(currentUser?.login))
    } else if (filterMode === 'assigned_by_me') {
      list = list.filter(t => t.created_by === currentUser?.login)
    } else if (filterMode === 'department') {
      const deptId = getUserDeptId(currentUser?.department, companyStructure)
      list = list.filter(t => t.is_collective && (t.department === deptId || t.department === 'all'))
    } else if (filterMode === 'unassigned') {
      list = list.filter(t => getAssignees(t).length === 0 && !t.is_collective)
    }

    if (selectedDeptFilter !== 'all') {
      list = list.filter(t => getTaskDepartment(t, systemUsers, companyStructure) === selectedDeptFilter)
    }
    if (statsFilter === 'in_progress') list = list.filter(t => t.status === 'in_progress')
    else if (statsFilter === 'overdue') list = list.filter(t => isOverdueTask(t))
    else if (statsFilter === 'done') list = list.filter(t => t.status === 'done')
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    }
    return list
  }, [managementTasks, isManager, filterMode, statsFilter, searchQuery, currentUser, selectedDeptFilter, systemUsers, companyStructure])

  // ─── Comments helpers ───────────────────────────────────────────────────
  const parseComments = (desc) => {
    if (!desc) return { description: '', comments: [] }
    const lines = desc.split('\n')
    const comments = []
    const descLines = []
    const re = /^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/
    lines.forEach(line => {
      const m = line.trim().match(re)
      if (m) comments.push({ time: m[1], author: m[2], text: m[3] })
      else descLines.push(line)
    })
    return { description: descLines.join('\n').trim(), comments }
  }

  const parsedSelectedTask = useMemo(() => {
    if (!selectedTask) return { description: '', comments: [] }
    return parseComments(selectedTask.description)
  }, [selectedTask?.description])

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || !selectedTask) return
    const timeStr = new Date().toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    const authorName = currentUser?.last_name || currentUser?.first_name || currentUser?.login || 'Користувач'
    const line = `\n[${timeStr}] ${authorName}: ${commentText}`
    const updated = (selectedTask.description || '') + line
    await updateManagementTask(selectedTask.id, { description: updated })
    setSelectedTask(prev => ({ ...prev, description: updated }))
    setCommentText('')
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', String(taskId))
    e.currentTarget.classList.add('dragging')
  }
  const handleDragEnd = (e) => e.currentTarget.classList.remove('dragging')
  const handleDragOver = (e) => e.preventDefault()
  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    if (!isManager) return
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) await updateManagementTask(taskId, { status: newStatus })
  }

  // ─── Open task detail ───────────────────────────────────────────────────
  const handleOpenTask = (task) => {
    setSelectedTask(task)
    setDetailTab('desc')
    setDetailOpen(true)
  }

  // ─── Sync selectedTask when managementTasks changes ────────────────────
  useEffect(() => {
    if (selectedTask) {
      const fresh = managementTasks?.find(t => t.id === selectedTask.id)
      if (fresh) setSelectedTask(fresh)
    }
  }, [managementTasks])

  // ─── Create Task ────────────────────────────────────────────────────────
  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || isSubmitting) return
    setIsSubmitting(true)

    const tempId = '__temp_' + genId()
    const tempTask = {
      ...form,
      color: form.color || '',
      assignees: form.assignees || [],
      assigned_to: (form.assignees || [])[0] || form.assigned_to || '',
      id: tempId,
      status: 'todo',
      created_by: currentUser?.login || 'system',
      created_at: new Date().toISOString(),
      _isPending: true,
    }
    setManagementTasks(prev => [tempTask, ...prev])
    setCreateOpen(false)
    setForm(blankForm)
    setNewCheckItem('')
    setAssigneeSearch('')
    setIsSubmitting(false)

    try {
      const payload = {
        ...form,
        color: form.color || '',
        assignees: form.assignees || [],
        assigned_to: (form.assignees || [])[0] || form.assigned_to || '',
        status: 'todo'
      }
      const { data: saved, error } = await addManagementTask(payload)
      if (error) {
        setManagementTasks(prev => prev.filter(t => t.id !== tempId))
      } else if (saved) {
        setManagementTasks(prev => prev.map(t => t.id === tempId ? saved : t))
      }
    } catch {
      setManagementTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  // ─── Edit Task ──────────────────────────────────────────────────────────
  const handleOpenEdit = (task, e) => {
    e?.stopPropagation()
    const { description } = parseComments(task.description)
    setEditForm({
      id: task.id,
      title: task.title || '',
      description,
      priority: task.priority || 'medium',
      color: task.color || '',
      assigned_to: task.assigned_to || '',
      assignees: getAssignees(task),
      is_collective: task.is_collective || false,
      department: task.department || 'all',
      deadline: task.deadline ? task.deadline.slice(0, 16) : '',
      checklist: Array.isArray(task.checklist) ? [...task.checklist] : [],
    })
    setEditAssigneeSearch('')
    setEditCheckItem('')
    setEditOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm?.title?.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const { id, ...payload } = editForm
      payload.assigned_to = (editForm.assignees || [])[0] || editForm.assigned_to || ''
      payload.assignees = editForm.assignees || []
      payload.color = editForm.color || ''
      const orig = managementTasks?.find(t => t.id === id)
      const { comments } = parseComments(orig?.description)
      const commentsStr = comments.map(c => `\n[${c.time}] ${c.author}: ${c.text}`).join('')
      payload.description = payload.description + commentsStr
      await updateManagementTask(id, payload)
      setEditOpen(false)
      setEditForm(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Toggle checklist item ──────────────────────────────────────────────
  const handleToggleCheckItem = async (task, itemId) => {
    const checklist = Array.isArray(task.checklist) ? task.checklist : []
    const item = checklist.find(i => String(i.id) === String(itemId))
    if (!item) return
    const msg = item.done ? "Зняти відмітку про виконання для цього пункту?" : "Позначити цей пункт як виконаний?"
    setConfirmModal({
      message: msg,
      onConfirm: async () => {
        const updated = toggleChecklistItem(checklist, itemId)
        await updateManagementTask(task.id, { checklist: updated })
        if (selectedTask?.id === task.id) setSelectedTask(prev => ({ ...prev, checklist: updated }))
      }
    })
  }

  // ─── Status actions ─────────────────────────────────────────────────────
  const canAdvance = (task) => {
    if (task.status === 'done') return false
    return canManageTask(task)
  }

  const handleStatusChange = async (newStatus) => {
    if (!selectedTask) return
    await updateManagementTask(selectedTask.id, { status: newStatus })
    setSelectedTask(prev => ({ ...prev, status: newStatus }))
  }

  // ─── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (taskId, e) => {
    e?.stopPropagation()
    if (!confirm('Видалити задачу?')) return
    await deleteManagementTask(taskId)
    if (selectedTask?.id === taskId) setDetailOpen(false)
  }

  return {
    managementTasks,
    systemUsers,
    currentUser,
    companyStructure,
    DEPARTMENTS,
    isDirector,
    isManager,
    isTaskRelevantToUser,
    canManageTask,
    filterMode,
    setFilterMode,
    selectedDeptFilter,
    setSelectedDeptFilter,
    statsFilter,
    setStatsFilter,
    searchQuery,
    setSearchQuery,
    activeMobileColumn,
    setActiveMobileColumn,
    showSearch,
    setShowSearch,
    isSidebarOpen,
    setIsSidebarOpen,
    completedCount,
    completedTasks,
    hasMoreCompleted,
    isFetchingCompleted,
    loadMoreCompleted,
    createOpen,
    setCreateOpen,
    detailOpen,
    setDetailOpen,
    confirmModal,
    setConfirmModal,
    editOpen,
    setEditOpen,
    selectedTask,
    setSelectedTask,
    detailTab,
    setDetailTab,
    form,
    setForm,
    newCheckItem,
    setNewCheckItem,
    assigneeSearch,
    setAssigneeSearch,
    commentText,
    setCommentText,
    isSubmitting,
    editForm,
    setEditForm,
    editCheckItem,
    setEditCheckItem,
    editAssigneeSearch,
    setEditAssigneeSearch,
    filteredCompletedTasks,
    stats,
    filteredTasks,
    parsedSelectedTask,
    handleAddComment,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleOpenTask,
    handleCreateTask,
    handleOpenEdit,
    handleSaveEdit,
    handleToggleCheckItem,
    canAdvance,
    handleStatusChange,
    handleDelete,
    updateManagementTask
  }
}
