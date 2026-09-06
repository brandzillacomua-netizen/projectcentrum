import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMES } from '../../../MESContext.jsx'

export const getSavedProjectColumns = (projectId) => {
  if (!projectId) return null
  try {
    const raw = localStorage.getItem('centrum_project_columns')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed[projectId] && Array.isArray(parsed[projectId]) && parsed[projectId].length > 0) {
        return parsed[projectId]
      }
    }
  } catch (e) {}
  return null
}

export const DEFAULT_COLUMNS = [
  { id: 'todo', title: 'В ЧЕРЗІ', color: '#8b5cf6' },
  { id: 'in_progress', title: 'В РОБОТІ', color: '#3b82f6' },
  { id: 'review', title: 'ПЕРЕВІРКА', color: '#f59e0b' },
  { id: 'done', title: 'ВИКОНАНО', color: '#10b981' },
]

export const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#a855f7']

export const emptyProject = { name: '', description: '', color: COLORS[0], member_logins: [], department_ids: [], columns: DEFAULT_COLUMNS }
export const emptyTask = { title: '', description: '', priority: 'medium', color: '', assignees: [], deadline: '', checklist: [] }

export const taskId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
export const userName = u => [u?.last_name, u?.first_name].filter(Boolean).join(' ') || u?.login || 'Користувач'
export const asArray = value => Array.isArray(value) ? value : []

export const isDirectorUser = user => {
  const pos = (user?.position || '').toLowerCase()
  const rights = user?.access_rights || user?.rights || {}
  return !!(rights.director || ['адмін', 'директор', 'керівник підприємства'].some(word => pos.includes(word)))
}

export const isManagerUser = user => {
  const pos = (user?.position || '').toLowerCase()
  const rights = user?.access_rights || user?.rights || {}
  return !!(rights.director || rights.master || rights.foreman || rights.manager ||
    ['адмін', 'директор', 'начальник', 'майстер', 'керівник', 'менедж'].some(word => pos.includes(word)))
}

export const useTaskProjectsData = () => {
  const {
    taskProjects = [], managementTasks = [], systemUsers = [], companyStructure = [], currentUser,
    addTaskProject, updateTaskProject, deleteTaskProject,
    addManagementTask, updateManagementTask, deleteManagementTask,
  } = useMES()

  const isDirector = isDirectorUser(currentUser)
  const canCreateProject = isDirector || isManagerUser(currentUser)
  const [searchParams, setSearchParams] = useSearchParams()
  const urlProjectId = searchParams.get('project')
  const savedProjectId = localStorage.getItem('centrum_active_project_id')

  const [activeId, setActiveIdState] = useState(() => urlProjectId || savedProjectId || null)

  useEffect(() => {
    if (urlProjectId && urlProjectId !== activeId) {
      setActiveIdState(urlProjectId)
      localStorage.setItem('centrum_active_project_id', urlProjectId)
    }
  }, [urlProjectId])

  const setActiveId = (id) => {
    setActiveIdState(id)
    if (id) {
      localStorage.setItem('centrum_active_project_id', id)
      setSearchParams({ project: id }, { replace: true })
    } else {
      localStorage.removeItem('centrum_active_project_id')
      setSearchParams({}, { replace: true })
    }
  }

  const [projectModal, setProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [projectForm, setProjectForm] = useState(emptyProject)
  const [taskModal, setTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTask)
  const [editingTask, setEditingTask] = useState(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [selectingProject, setSelectingProject] = useState(false)
  const [targetProjectId, setTargetProjectId] = useState(null)

  const [isAddingCol, setIsAddingCol] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [newColColor, setNewColColor] = useState(COLORS[0])

  const userDepartmentIds = useMemo(() => {
    const dept = (currentUser?.department || '').toLowerCase().trim()
    if (!dept) return []
    return companyStructure.filter(d => {
      const name = (d.name || d.label || '').toLowerCase().trim()
      return name && (name === dept || name.includes(dept) || dept.includes(name))
    }).map(d => String(d.id))
  }, [currentUser, companyStructure])

  const visibleProjects = useMemo(() => taskProjects.filter(project => {
    if (project.status === 'archived') return false
    if (isDirector || project.created_by === currentUser?.login) return true
    if (asArray(project.member_logins).includes(currentUser?.login)) return true
    return asArray(project.department_ids).some(id => userDepartmentIds.includes(String(id)))
  }), [taskProjects, isDirector, currentUser, userDepartmentIds])

  const activeProject = visibleProjects.find(p => p.id === activeId)
  const projectTasks = useMemo(() => managementTasks.filter(t => String(t.project_id || '') === String(activeId || '')), [managementTasks, activeId])
  const filteredProjects = visibleProjects.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()))

  const openProjectForm = project => {
    setEditingProject(project || null)
    setProjectForm(project ? {
      name: project.name || '', description: project.description || '', color: project.color || COLORS[0],
      member_logins: asArray(project.member_logins), department_ids: asArray(project.department_ids).map(String),
      columns: Array.isArray(project.columns) && project.columns.length > 0 ? project.columns : DEFAULT_COLUMNS,
    } : emptyProject)
    setProjectModal(true)
  }

  const saveProject = async e => {
    e.preventDefault()
    if (!projectForm.name.trim() || saving) return
    setSaving(true)
    const payload = { ...projectForm, name: projectForm.name.trim(), description: projectForm.description.trim() }
    const result = editingProject ? await updateTaskProject(editingProject.id, payload) : await addTaskProject(payload)
    setSaving(false)
    if (result?.error) return alert(`Не вдалося зберегти проєкт: ${result.error.message}`)
    setProjectModal(false)
  }

  const openTaskFormForProject = projectId => {
    setTargetProjectId(projectId)
    openTaskForm()
  }

  const closeTaskModal = () => {
    setTaskModal(false)
    setTargetProjectId(null)
  }

  const openTaskForm = task => {
    setEditingTask(task || null)
    setTaskForm(task ? {
      title: task.title || '', description: task.description || '', priority: task.priority || 'medium',
      color: task.color || '', assignees: asArray(task.assignees).length ? task.assignees : (task.assigned_to ? [task.assigned_to] : []),
      deadline: task.deadline ? String(task.deadline).slice(0, 10) : '', checklist: asArray(task.checklist),
    } : emptyTask)
    setTaskModal(true)
  }

  const saveTask = async e => {
    e.preventDefault()
    if (!taskForm.title.trim() || saving) return
    setSaving(true)
    const payload = {
      ...taskForm, title: taskForm.title.trim(), description: taskForm.description.trim(),
      deadline: taskForm.deadline || null, project_id: activeProject?.id || targetProjectId,
      assignees: taskForm.assignees, assigned_to: taskForm.assignees[0] || null, is_collective: false,
    }
    const result = editingTask
      ? await updateManagementTask(editingTask.id, payload)
      : await addManagementTask({ status: 'todo', department: 'all', ...payload })
    setSaving(false)
    if (result?.error) return alert(`Не вдалося зберегти задачу: ${result.error.message}`)
    closeTaskModal()
  }

  const removeProject = async project => {
    if (!confirm(`Видалити проєкт «${project.name}» разом з усіма його задачами?`)) return
    const { error } = await deleteTaskProject(project.id)
    if (error) alert(`Не вдалося видалити проєкт: ${error.message}`)
    else setActiveId(null)
  }

  const projectMembers = project => {
    const direct = asArray(project.member_logins).length
    const depts = asArray(project.department_ids).length
    return `${direct} люд. · ${depts} відд.`
  }

  const targetProject = activeProject || visibleProjects.find(p => p.id === targetProjectId)
  const allowedLogins = new Set(asArray(targetProject?.member_logins))
  const allowedDeptNames = new Set(companyStructure.filter(d => asArray(targetProject?.department_ids).map(String).includes(String(d.id))).map(d => d.name))
  const assignableUsers = targetProject ? systemUsers.filter(u => allowedLogins.has(u.login) || allowedDeptNames.has(u.department)) : systemUsers

  const handleAddColumnSubmit = async () => {
    if (!newColTitle.trim() || !activeProject) return
    const projectColumns = Array.isArray(activeProject?.columns) && activeProject.columns.length > 0 ? activeProject.columns : DEFAULT_COLUMNS
    const newCol = {
      id: 'col_' + Date.now().toString(36),
      title: newColTitle.trim().toUpperCase(),
      color: newColColor
    }
    const updatedCols = [...projectColumns, newCol]
    await updateTaskProject(activeProject.id, { columns: updatedCols })
    setNewColTitle('')
    setIsAddingCol(false)
  }

  return {
    currentUser,
    systemUsers,
    companyStructure,
    taskProjects,
    managementTasks,
    addTaskProject,
    updateTaskProject,
    deleteTaskProject,
    addManagementTask,
    updateManagementTask,
    deleteManagementTask,
    isDirector,
    canCreateProject,
    activeId,
    setActiveId,
    activeProject,
    projectTasks,
    visibleProjects,
    filteredProjects,
    projectModal,
    setProjectModal,
    editingProject,
    projectForm,
    setProjectForm,
    taskModal,
    setTaskModal,
    taskForm,
    setTaskForm,
    editingTask,
    query,
    setQuery,
    saving,
    addMenuOpen,
    setAddMenuOpen,
    selectingProject,
    setSelectingProject,
    targetProjectId,
    targetProject,
    assignableUsers,
    isAddingCol,
    setIsAddingCol,
    newColTitle,
    setNewColTitle,
    newColColor,
    setNewColColor,
    openProjectForm,
    saveProject,
    openTaskFormForProject,
    closeTaskModal,
    openTaskForm,
    saveTask,
    removeProject,
    projectMembers,
    handleAddColumnSubmit
  }
}

export default useTaskProjectsData
