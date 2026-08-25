import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, Calendar, CheckCircle2, CheckSquare, ChevronLeft, Edit3, FolderKanban, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { useMES } from '../MESContext'
import { ChecklistEditor } from './KanbanModule'

const COLUMNS = [
  { id: 'todo', title: 'В ЧЕРЗІ', color: '#8b5cf6' },
  { id: 'in_progress', title: 'В РОБОТІ', color: '#3b82f6' },
  { id: 'review', title: 'ПЕРЕВІРКА', color: '#f59e0b' },
  { id: 'done', title: 'ВИКОНАНО', color: '#10b981' },
]
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
const emptyProject = { name: '', description: '', color: COLORS[0], member_logins: [], department_ids: [] }
const emptyTask = { title: '', description: '', priority: 'medium', color: '', assignees: [], deadline: '', checklist: [] }
const taskId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const userName = u => [u?.last_name, u?.first_name].filter(Boolean).join(' ') || u?.login || 'Користувач'
const asArray = value => Array.isArray(value) ? value : []

const isDirectorUser = user => {
  const pos = (user?.position || '').toLowerCase()
  const rights = user?.access_rights || user?.rights || {}
  return !!(rights.director || ['адмін', 'директор', 'керівник підприємства'].some(word => pos.includes(word)))
}

const isManagerUser = user => {
  const pos = (user?.position || '').toLowerCase()
  const rights = user?.access_rights || user?.rights || {}
  return !!(rights.director || rights.master || rights.foreman || rights.manager ||
    ['адмін', 'директор', 'начальник', 'майстер', 'керівник', 'менедж'].some(word => pos.includes(word)))
}

export default function TaskProjectsModule() {
  const {
    taskProjects = [], managementTasks = [], systemUsers = [], companyStructure = [], currentUser,
    addTaskProject, updateTaskProject, deleteTaskProject,
    addManagementTask, updateManagementTask, deleteManagementTask,
  } = useMES()
  const isDirector = isDirectorUser(currentUser)
  const canCreateProject = isDirector || isManagerUser(currentUser)
  const [activeId, setActiveId] = useState(null)
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

  if (activeProject) {
    const isOwnerOrManager = isDirector || activeProject.created_by === currentUser?.login
    const completed = projectTasks.filter(t => t.status === 'done').length
    const pct = projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0
    return <div className="tp-root">
      <header className="tp-header">
        <div className="tp-heading">
          <button className="tp-icon-btn" onClick={() => setActiveId(null)}><ChevronLeft size={20} /></button>
          <span className="tp-project-dot" style={{ background: activeProject.color }} />
          <div><h1>{activeProject.name}</h1><p>{activeProject.description || 'Проєктна канбан-дошка'}</p></div>
        </div>
        <div className="tp-header-actions">
          <div className="tp-progress"><span>{pct}%</span><i><b style={{ width: `${pct}%`, background: activeProject.color }} /></i></div>
          {isOwnerOrManager && <button className="tp-secondary" onClick={() => openProjectForm(activeProject)}><Edit3 size={15} /> Налаштувати</button>}
        </div>
      </header>
      <main className="tp-board">
        {COLUMNS.map(column => {
          const tasks = projectTasks.filter(t => t.status === column.id)
          return <section className="tp-column" key={column.id} onDragOver={e => e.preventDefault()} onDrop={e => updateManagementTask(e.dataTransfer.getData('taskId'), { status: column.id })}>
            <div className="tp-column-head"><span style={{ color: column.color }}>{column.title}</span><b>{tasks.length}</b></div>
            <div className="tp-cards">
              {tasks.map(task => {
                const assignee = systemUsers.find(u => u.login === task.assigned_to)
                const checklist = asArray(task.checklist)
                const checklistDone = checklist.filter(i => i.done).length
                const canDelete = isOwnerOrManager || task.created_by === currentUser?.login
                return <article className="tp-task" key={task.id} draggable={isOwnerOrManager || task.created_by === currentUser?.login} onDragStart={e => e.dataTransfer.setData('taskId', task.id)} onClick={() => openTaskForm(task)} style={{ borderLeftColor: task.color || column.color, cursor: 'pointer' }}>
                  <div className={`tp-priority p-${task.priority || 'medium'}`}>{task.priority === 'urgent' ? 'ТЕРМІНОВО' : task.priority === 'high' ? 'ВИСОКИЙ' : task.priority === 'low' ? 'НИЗЬКИЙ' : 'СЕРЕДНІЙ'}</div>
                  <h3>{task.title}</h3>{task.description && <p>{task.description}</p>}
                  {!!checklist.length && <div className="tp-check-progress"><i><b style={{ width: `${Math.round(checklistDone / checklist.length * 100)}%` }} /></i><span><CheckSquare size={12} /> {checklistDone}/{checklist.length}</span></div>}
                  <footer>
                    <span><Users size={13} /> {asArray(task.assignees).length > 1 ? `${userName(assignee)} +${task.assignees.length - 1}` : assignee ? userName(assignee) : 'Не призначено'}</span>
                    {task.deadline && <span><Calendar size={13} /> {new Date(task.deadline).toLocaleDateString('uk-UA')}</span>}
                  </footer>
                  <div className="tp-task-actions">
                    <button onClick={e => { e.stopPropagation(); openTaskForm(task) }} title="Редагувати"><Edit3 size={13} /></button>
                    {canDelete && <button onClick={e => { e.stopPropagation(); confirm('Видалити задачу?') && deleteManagementTask(task.id) }} title="Видалити"><Trash2 size={13} /></button>}
                  </div>
                </article>
              })}
              {!tasks.length && <div className="tp-empty-column">Перетягніть задачу сюди</div>}
            </div>
          </section>
        })}
      </main>
      {!taskModal && !projectModal && <button className="tp-floating-add" onClick={() => openTaskForm()} title="Створити задачу"><Plus size={25} /></button>}
      {taskModal && <ProjectTaskModal form={taskForm} setForm={setTaskForm} users={assignableUsers} editing={editingTask} saving={saving} onSubmit={saveTask} onClose={closeTaskModal} project={activeProject} />}
      {projectModal && <ProjectModal {...{ projectForm, setProjectForm, saveProject, saving, editingProject, systemUsers, companyStructure }} onClose={() => setProjectModal(false)} onDelete={() => removeProject(activeProject)} />}
      <Styles />
    </div>
  }

  return <div className="tp-root">
    <header className="tp-header">
      <div className="tp-heading" style={{ display: 'flex', alignItems: 'center', flex: 1, width: '100%' }}>
        <Link className="tp-icon-btn" to="/tasks" style={{ width: 'auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <ArrowLeft size={18} />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'none', letterSpacing: 'normal' }}>до задач</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <div className="tp-logo"><BriefcaseBusiness size={20} /></div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1rem', letterSpacing: '1.5px', textAlign: 'left' }}>ПРОЄКТИ</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '.72rem', textAlign: 'left', lineHeight: '1.2', whiteSpace: 'normal' }}>
              Окремі команди<br />та канбан-дошки
            </p>
          </div>
        </div>
      </div>
    </header>
    <div className="tp-toolbar"><div className="tp-search"><Search size={16} /><input placeholder="Пошук проєктів…" value={query} onChange={e => setQuery(e.target.value)} /></div><span>{filteredProjects.length} проєктів</span></div>
    <main className="tp-grid">
      {filteredProjects.map(project => {
        const tasks = managementTasks.filter(t => String(t.project_id || '') === String(project.id))
        const done = tasks.filter(t => t.status === 'done').length
        const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0
        return <article className="tp-project" key={project.id} onClick={() => setActiveId(project.id)} style={{ '--pc': project.color }}>
          <div className="tp-project-icon"><FolderKanban size={24} /></div><h2>{project.name}</h2><p>{project.description || 'Без опису'}</p>
          <div className="tp-project-meta"><span><Users size={14} /> {projectMembers(project)}</span><span><CheckCircle2 size={14} /> {done}/{tasks.length}</span></div>
          <div className="tp-project-progress"><i style={{ width: `${pct}%` }} /></div>
        </article>
      })}
      {!filteredProjects.length && <div className="tp-empty"><FolderKanban size={44} /><h2>Проєктів поки немає</h2><p>{canCreateProject ? 'Створіть перший проєкт і сформуйте його команду.' : 'Вас ще не додано до жодного активного проєкту.'}</p></div>}
    </main>
    {projectModal && <ProjectModal {...{ projectForm, setProjectForm, saveProject, saving, editingProject, systemUsers, companyStructure }} onClose={() => setProjectModal(false)} />}
    {taskModal && <ProjectTaskModal form={taskForm} setForm={setTaskForm} users={assignableUsers} editing={editingTask} saving={saving} onSubmit={saveTask} onClose={closeTaskModal} project={targetProject} />}
    {!taskModal && !projectModal && (
      <button className="tp-floating-add" onClick={() => setAddMenuOpen(!addMenuOpen)} title="Створити...">
        <Plus size={24} style={{ transform: addMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
    )}
    {addMenuOpen && (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => { setAddMenuOpen(false); setSelectingProject(false); }} />
        <div className="tp-add-popup">
          {!selectingProject ? (
            <>
              {canCreateProject && (
                <button className="tp-menu-item" onClick={() => { openProjectForm(); setAddMenuOpen(false); }}>
                  <Plus size={16} color="#ff9000" />
                  <span>Створити проєкт</span>
                </button>
              )}
              <button className="tp-menu-item" onClick={() => { setSelectingProject(true); }}>
                <CheckSquare size={16} color="#3b82f6" />
                <span>Створити задачу по проєкту</span>
              </button>
            </>
          ) : (
            <>
              <div className="tp-popup-header">
                <span>Оберіть проєкт для задачі:</span>
                <button className="tp-popup-close" onClick={() => setSelectingProject(false)}><X size={14} /></button>
              </div>
              <div className="tp-popup-list">
                {visibleProjects.map(p => (
                  <button key={p.id} className="tp-menu-item" onClick={() => { openTaskFormForProject(p.id); setAddMenuOpen(false); setSelectingProject(false); }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span className="tp-popup-project-name">{p.name}</span>
                  </button>
                ))}
                {visibleProjects.length === 0 && (
                  <div className="tp-popup-empty">Немає активних проєктів</div>
                )}
              </div>
            </>
          )}
        </div>
      </>
    )}
    <Styles />
  </div>
}

function ProjectTaskModal({ form, setForm, users, editing, saving, onSubmit, onClose, project }) {
  const [newItem, setNewItem] = useState('')
  const userOptions = users.map(u => ({ value: u.login, label: userName(u), meta: u.department || '' }))
  const addItem = (text, parentId = null) => {
    if (!text.trim()) return
    setForm(prev => ({ ...prev, checklist: [...prev.checklist, { id: taskId(), text: text.trim(), done: false, parent_id: parentId }] }))
  }
  const removeItem = id => setForm(prev => ({ ...prev, checklist: prev.checklist.filter(item => String(item.id) !== String(id) && String(item.parent_id) !== String(id)) }))
  const updateChecklistItem = (id, updates) => setForm(prev => ({ ...prev, checklist: prev.checklist.map(item => String(item.id) === String(id) ? { ...item, ...updates } : item) }))
  const toggleItem = id => {
    const item = form.checklist.find(entry => String(entry.id) === String(id))
    if (item) updateChecklistItem(id, { done: !item.done })
  }
  const titleText = editing 
    ? (project ? `Редагувати задачу | ${project.name}` : 'Редагувати задачу')
    : (project ? `Нова задача | ${project.name}` : 'Нова задача')
  return <Modal title={titleText} onClose={onClose} wide>
    <form onSubmit={onSubmit} className="tp-form tp-task-form">
      <label>НАЗВА ЗАДАЧІ *<input required autoFocus placeholder="Коротко опишіть задачу…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label>ДЕТАЛЬНИЙ ОПИС<textarea rows="3" placeholder="Що саме потрібно зробити…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <div className="tp-form-row"><label>ПРІОРИТЕТ<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="low">Низький</option><option value="medium">Середній</option><option value="high">Високий</option><option value="urgent">Нагально!</option></select></label><label>ДЕДЛАЙН<input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label></div>
      <div><span className="tp-label">КОЛІР ПЛАШКИ</span><div className="tp-colors"><button type="button" className={!form.color ? 'active auto-color' : 'auto-color'} onClick={() => setForm({ ...form, color: '' })}>Авто</button>{COLORS.map(c => <button type="button" key={c} className={form.color === c ? 'active' : ''} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />)}</div></div>
      <SearchPicker label="ВИКОНАВЦІ З КОМАНДИ ПРОЄКТУ" placeholder="Пошук за прізвищем…" options={userOptions} selected={form.assignees} onToggle={value => setForm(prev => ({ ...prev, assignees: prev.assignees.includes(value) ? prev.assignees.filter(v => v !== value) : [...prev.assignees, value] }))} />
      <div className="tp-check-builder"><span className="tp-label"><CheckSquare size={13} /> ЧЕКЛІСТ (ПУНКТИ)</span><ChecklistEditor items={form.checklist} newItem={newItem} setNewItem={setNewItem} onAdd={() => { addItem(newItem); setNewItem('') }} onToggle={toggleItem} onAddSubItem={(parentId, text) => addItem(text, parentId)} onRemove={removeItem} canEdit={true} systemUsers={users} onUpdateAssignee={(itemId, assignees) => updateChecklistItem(itemId, { assignees, assignee: assignees[0] || null })} onUpdateDeadline={(itemId, deadline) => updateChecklistItem(itemId, { deadline: deadline || null })} /></div>
      <div className="tp-modal-actions"><button type="button" className="tp-secondary" onClick={onClose}>Скасувати</button><button className="tp-primary" disabled={saving}>{saving ? 'Збереження…' : editing ? 'ЗБЕРЕГТИ' : 'СТВОРИТИ ЗАДАЧУ'}</button></div>
    </form>
  </Modal>
}

function Modal({ title, onClose, children }) {
  return <div className="tp-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="tp-modal"><header><h2>{title}</h2><button onClick={onClose}><X size={18} /></button></header>{children}</div></div>
}

function ProjectModal({ projectForm, setProjectForm, saveProject, saving, editingProject, systemUsers, companyStructure, onClose, onDelete }) {
  const toggle = (field, value) => setProjectForm(prev => ({ ...prev, [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value] }))
  return <Modal title={editingProject ? 'Налаштування проєкту' : 'Новий проєкт'} onClose={onClose}><form onSubmit={saveProject} className="tp-form">
    <label>Назва<input required autoFocus value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} /></label>
    <label>Опис<textarea rows="3" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} /></label>
    <div><span className="tp-label">Колір</span><div className="tp-colors">{COLORS.map(c => <button type="button" key={c} className={projectForm.color === c ? 'active' : ''} style={{ background: c }} onClick={() => setProjectForm({ ...projectForm, color: c })} />)}</div></div>
    <SearchPicker label="Додати відділи" placeholder="Почніть вводити назву відділу…" options={companyStructure.map(d => ({ value: String(d.id), label: d.name || d.label }))} selected={projectForm.department_ids} onToggle={value => toggle('department_ids', value)} />
    <SearchPicker label="Додати окремих людей" placeholder="Введіть ім’я або прізвище…" options={systemUsers.map(u => ({ value: u.login, label: userName(u), meta: u.department || '' }))} selected={projectForm.member_logins} onToggle={value => toggle('member_logins', value)} />
    <div className="tp-modal-actions">{editingProject && onDelete && <button type="button" className="tp-danger" onClick={onDelete}><Trash2 size={15} /> Видалити</button>}<button className="tp-primary" disabled={saving}>{saving ? 'Збереження…' : 'Зберегти проєкт'}</button></div>
  </form></Modal>
}

function SearchPicker({ label, placeholder, options, selected, onToggle }) {
  const [search, setSearch] = useState('')
  const normalized = search.trim().toLocaleLowerCase('uk-UA')
  const chosen = options.filter(option => selected.includes(option.value))
  const results = normalized ? options.filter(option => !selected.includes(option.value) && `${option.label} ${option.meta || ''}`.toLocaleLowerCase('uk-UA').includes(normalized)).slice(0, 8) : []
  return <div className="tp-picker">
    <span className="tp-label">{label}</span>
    {!!chosen.length && <div className="tp-chips">{chosen.map(option => <button type="button" key={option.value} onClick={() => onToggle(option.value)} title="Прибрати"><span>{option.label}</span><X size={12} /></button>)}</div>}
    <div className="tp-picker-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} /></div>
    {normalized && <div className="tp-picker-results">{results.map(option => <button type="button" key={option.value} onClick={() => { onToggle(option.value); setSearch('') }}><span>{option.label}</span>{option.meta && <small>{option.meta}</small>}<Plus size={14} /></button>)}{!results.length && <div>Нічого не знайдено</div>}</div>}
  </div>
}

function Styles() { return <style>{`
  .tp-root{min-height:100vh;background:var(--bg, #050505);color:var(--text, #eee);font-family:Inter,system-ui,sans-serif}
  .tp-header{height:78px;padding:0 34px;border-bottom:1px solid var(--glass-border, #171717);display:flex;align-items:center;justify-content:space-between;background:var(--card-bg, #080808);gap:20px}
  .tp-heading,.tp-header-actions{display:flex;align-items:center;gap:14px}
  .tp-heading h1{font-size:1rem;letter-spacing:1.5px;margin:0 0 4px;color:var(--text, #eee)}
  .tp-heading p{margin:0;color:var(--text-muted, #666);font-size:.72rem}
  .tp-icon-btn,.tp-logo{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--glass-border, #222);background:var(--card-bg, #101010);color:var(--text-muted, #aaa);text-decoration:none}
  .tp-logo{color:#ff9000;background:rgba(255,144,0,0.07);border-color:rgba(255,144,0,0.2)}
  .tp-primary,.tp-secondary,.tp-danger{border:0;border-radius:10px;padding:10px 15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}
  .tp-primary{background:linear-gradient(135deg, #ff9000, #ffab2e);color:#090909;border:1px solid #ffc05a !important;box-shadow:0 5px 18px rgba(255,144,0,0.2);transition:transform .2s,box-shadow .2s,filter .2s}
  .tp-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,144,0,0.38);filter:brightness(1.07)}
  .tp-secondary{background:var(--card-bg, #151515);color:var(--text-muted, #ccc);border:1px solid var(--glass-border, #292929)}
  .tp-danger{background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.2)}
  .tp-toolbar{padding:22px 34px;display:flex;justify-content:space-between;align-items:center;color:var(--text-muted, #555);font-size:.75rem}
  .tp-search{width:min(360px,70vw);display:flex;align-items:center;gap:9px;background:var(--card-bg, #0d0d0d);border:1px solid var(--glass-border, #202020);border-radius:11px;padding:9px 12px;color:var(--text-muted, #555)}
  .tp-search input{flex:1;background:none;border:0;outline:0;color:var(--text, #eee)}
  .tp-grid{padding:0 34px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px}
  .tp-project{--pc:#8b5cf6;min-height:210px;background:var(--card-bg, #0b0b0b);border:1px solid var(--glass-border, #1c1c1c);border-top:2px solid var(--pc);border-radius:16px;padding:20px;cursor:pointer;transition:.2s}
  .tp-project:hover{transform:translateY(-3px);border-color:var(--pc);box-shadow:0 16px 40px rgba(0,0,0,0.4)}
  .tp-project-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--pc);background:color-mix(in srgb,var(--pc) 12%,transparent)}
  .tp-project h2{font-size:1rem;margin:17px 0 8px;color:var(--text, #eee)}
  .tp-project>p{font-size:.76rem;color:var(--text-muted, #666);line-height:1.5;height:34px;overflow:hidden}
  .tp-project-meta{display:flex;justify-content:space-between;color:var(--text-muted, #777);font-size:.68rem;margin-top:17px}
  .tp-project-meta span{display:flex;gap:6px;align-items:center}
  .tp-project-progress{height:4px;background:var(--glass-border, #191919);border-radius:3px;margin-top:12px;overflow:hidden}
  .tp-project-progress i{display:block;height:100%;background:var(--pc)}
  .tp-empty{grid-column:1/-1;text-align:center;color:var(--text-muted, #444);padding:80px 20px}
  .tp-empty h2{color:var(--text-muted, #888)}
  .tp-project-dot{width:13px;height:38px;border-radius:6px}
  .tp-progress{display:flex;align-items:center;gap:9px;color:var(--text-muted, #888);font-size:.72rem}
  .tp-progress i{width:90px;height:5px;background:var(--glass-border, #202020);border-radius:5px;overflow:hidden}
  .tp-progress b{display:block;height:100%}
  .tp-board{display:grid;grid-template-columns:repeat(4,minmax(270px,1fr));gap:14px;padding:20px 26px;overflow-x:auto}
  .tp-column{background:var(--card-bg, #090909);border:1px solid var(--glass-border, #171717);border-radius:15px;min-height:calc(100vh - 120px)}
  .tp-column-head{padding:16px;display:flex;justify-content:space-between;font-size:.72rem;font-weight:900;letter-spacing:1px;border-bottom:1px solid var(--glass-border, #171717)}
  .tp-column-head b{color:var(--text-muted, #555)}
  .tp-cards{padding:11px;display:flex;flex-direction:column;gap:10px}
  .tp-task{position:relative;background:var(--card-bg, #111);border:1px solid var(--glass-border, #222);border-radius:13px;padding:15px;cursor:pointer;transition:transform 0.15s,border-color 0.15s,box-shadow 0.15s}
  .tp-task:hover{border-color:rgba(255,255,255,0.15);transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.3)}
  .tp-task h3{font-size:.88rem;margin:10px 0 7px;color:var(--text, #fff);font-weight:700;word-break:break-word}
  .tp-task>p{font-size:.72rem;color:var(--text-muted, #aaa);line-height:1.45;margin:0 0 13px}
  .tp-task footer{display:flex;flex-wrap:wrap;gap:9px;color:var(--text-muted, #777);font-size:.65rem}
  .tp-task footer span{display:flex;align-items:center;gap:5px}
  .tp-priority{font-size:.55rem;font-weight:900;letter-spacing:.8px}
  .p-low{color:#10b981}.p-medium{color:#60a5fa}.p-high{color:#f59e0b}.p-urgent{color:#ef4444}
  .tp-task-actions{position:absolute;right:8px;top:8px;display:none}
  .tp-task:hover .tp-task-actions{display:flex}
  .tp-task-actions button,.tp-modal header button{background:var(--card-bg, #191919);color:var(--text-muted, #888);border:1px solid var(--glass-border, transparent);border-radius:7px;padding:6px;cursor:pointer}
  .tp-task-actions button:hover{color:#ff9000;background:rgba(255,144,0,0.1)}
  .tp-empty-column{text-align:center;border:1px dashed var(--glass-border, #1d1d1d);border-radius:11px;color:var(--text-muted, #333);font-size:.68rem;padding:25px 8px}
  .tp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100100;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}
  .tp-modal{width:min(620px,96vw);max-height:90vh;overflow:auto;background:var(--card-bg, #0c0c0c);border:1px solid var(--glass-border, #292929);border-radius:17px;box-shadow:var(--shadow, 0 30px 90px rgba(0,0,0,0.8))}
  .tp-modal>header{display:flex;align-items:center;justify-content:space-between;padding:18px 21px;border-bottom:1px solid var(--glass-border, #1c1c1c)}
  .tp-modal header h2{font-size:.95rem;margin:0;color:var(--text, #eee)}
  .tp-form{padding:20px;display:flex;flex-direction:column;gap:16px}
  .tp-form label,.tp-label{display:flex;flex-direction:column;gap:7px;color:var(--text-muted, #888);font-size:.7rem;font-weight:700}
  .tp-form input,.tp-form textarea,.tp-form select{background:var(--bg, #111);border:1px solid var(--glass-border, #292929);border-radius:9px;padding:10px;color:var(--text, #eee);outline:none;font:inherit}
  .tp-form input:focus,.tp-form textarea:focus,.tp-form select:focus{border-color:rgba(255,144,0,0.5);box-shadow:0 0 0 2px rgba(255,144,0,0.1)}
  .tp-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tp-colors{display:flex;gap:9px;margin-top:8px}
  .tp-colors button{width:27px;height:27px;border-radius:50%;border:3px solid transparent;cursor:pointer}
  .tp-colors button.active{border-color:var(--text, #fff)}
  .tp-options{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}
  .tp-options label{display:flex;flex-direction:row;align-items:center;background:var(--bg, #111);padding:8px;border-radius:8px}
  .tp-options small{color:var(--text-muted, #444);margin-left:auto}
  .tp-users{max-height:170px;overflow:auto}
  .tp-modal-actions{display:flex;justify-content:flex-end;gap:10px}
  .tp-submit{align-self:flex-end}
  .tp-project-dot+div{max-width:460px}
  .tp-picker{position:relative}
  .tp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
  .tp-chips button{display:flex;align-items:center;gap:6px;background:rgba(255,144,0,0.08);color:#ffad32;border:1px solid rgba(255,144,0,0.22);border-radius:18px;padding:6px 9px;font-size:.68rem;cursor:pointer}
  .tp-picker-search{display:flex;align-items:center;gap:8px;background:var(--bg, #111);border:1px solid var(--glass-border, #292929);border-radius:9px;padding:0 10px;color:var(--text-muted, #555);margin-top:8px}
  .tp-picker-search:focus-within{border-color:rgba(255,144,0,0.4)}
  .tp-picker-search input{flex:1;border:0!important;background:transparent!important;padding-left:0!important;color:var(--text, #eee)}
  .tp-picker-results{margin-top:6px;background:var(--card-bg, #111);border:1px solid var(--glass-border, #292929);border-radius:10px;max-height:210px;overflow:auto;padding:5px}
  .tp-picker-results button{width:100%;display:flex;align-items:center;gap:8px;text-align:left;background:transparent;border:0;color:var(--text, #ddd);padding:9px;border-radius:7px;cursor:pointer}
  .tp-picker-results button:hover{background:var(--bg, #1b1b1b);color:#ffad32}
  .tp-picker-results button span{flex:1}
  .tp-picker-results small{color:var(--text-muted, #555)}
  .tp-picker-results>div{padding:14px;text-align:center;color:var(--text-muted, #555);font-size:.72rem}
  .tp-floating-add{position:fixed;right:32px;bottom:32px;z-index:99999;width:56px;height:56px;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #ff9000 0%, #ff5500 100%);color:#000;cursor:pointer;box-shadow:0 8px 24px rgba(255,144,0,0.4),inset 0 2px 4px rgba(255,255,255,0.2);transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);animation:float-btn-bounce-tp 3s ease-in-out infinite}
  .tp-floating-add:hover{transform:scale(1.1) translateY(-3px);box-shadow:0 12px 30px rgba(255,144,0,0.6);background:linear-gradient(135deg, #ffaa33 0%, #ff6622 100%)}
  .tp-floating-add:active{transform:scale(0.95)}
  @keyframes float-btn-bounce-tp{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  .tp-menu-item{transition:background 0.2s,color 0.2s}
  .tp-task{border-left:3px solid}
  .tp-check-progress{display:flex;align-items:center;gap:8px;margin:11px 0}
  .tp-check-progress>i{height:3px;background:var(--glass-border, #252525);border-radius:3px;overflow:hidden;flex:1}
  .tp-check-progress b{display:block;height:100%;background:#10b981}
  .tp-check-progress span{display:flex;align-items:center;gap:4px;color:#10b981;font-size:.62rem}
  .tp-task-form{padding-bottom:24px}
  .tp-colors .auto-color{width:auto;height:27px;border-radius:7px;background:var(--card-bg, #151515);color:var(--text-muted, #aaa);padding:0 10px;font-size:.65rem}
  .tp-check-builder>.tp-label{flex-direction:row;align-items:center;margin-bottom:8px}
  .checklist-editor{display:flex;flex-direction:column;gap:12px}
  .checklist-progress-row{display:flex;align-items:center;gap:10px}
  .cl-track{flex:1;height:5px;background:var(--glass-border, #111);border-radius:3px;overflow:hidden}
  .cl-fill{height:100%;border-radius:3px}
  .cl-pct{font-size:.75rem;font-weight:900;color:var(--text-muted, #888);min-width:32px;text-align:right}
  .checklist-items{display:flex;flex-direction:column;gap:6px}
  .checklist-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg, #090909);border:1px solid var(--glass-border, #141414);border-radius:9px}
  .checklist-item.parent-item{background:var(--card-bg)!important;border:1px solid var(--glass-border)!important;border-left:3px solid #ff9000!important;border-radius:12px!important;padding:12px 16px!important;margin-top:10px!important}
  .checklist-item.child-item{background:transparent!important;border:none!important;border-left:2px solid rgba(255,144,0,0.25)!important;border-radius:0!important;padding:6px 12px 6px 16px!important;margin-left:28px!important;margin-top:2px!important}
  .checklist-item.done .check-text{text-decoration:line-through;color:var(--text-muted, #444)}
  .check-toggle{background:none;border:none;padding:0;display:flex}
  .check-text{flex:1;font-size:.85rem;color:var(--text, #ccc);line-height:1.4}
  .check-remove{background:none;border:none;color:var(--text-muted, #555);cursor:pointer;padding:2px;display:flex}
  .checklist-empty{text-align:center;padding:20px;color:var(--text-muted, #333);font-size:.8rem}
  .add-check-row{display:flex;gap:8px}
  .add-check-row input{flex:1;background:var(--card-bg, #0d0d0d);border:1px solid var(--glass-border, #1a1a1a);color:var(--text, #fff);padding:9px 14px;border-radius:9px;outline:none}
  .add-check-btn{width:36px;height:36px;border-radius:9px;background:rgba(255,144,0,0.1);border:1px solid rgba(255,144,0,0.2);color:#ff9000;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .tp-add-popup{position:fixed;right:32px;bottom:100px;z-index:99999;background:var(--card-bg, #0c0c0c);border:1px solid var(--glass-border, #222);border-radius:16px;padding:12px;box-shadow:var(--shadow, 0 10px 40px rgba(0,0,0,0.8));width:260px;display:flex;flex-direction:column;gap:8px}
  .tp-menu-item{background:none;border:none;color:var(--text, #eee);text-align:left;padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;font-weight:600;font-size:0.82rem;width:100%;transition:background 0.2s,color 0.2s}
  .tp-menu-item:hover{background:rgba(255,144,0,0.08) !important;color:#ff9000 !important}
  .tp-popup-header{padding:4px 8px 8px;font-size:0.72rem;color:#ff9000;font-weight:800;border-bottom:1px solid var(--glass-border, #1a1a1a);display:flex;justify-content:space-between;align-items:center}
  .tp-popup-close{background:none;border:none;color:var(--text-muted, #555);cursor:pointer;padding:0;display:flex}
  .tp-popup-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-top:6px}
  .tp-popup-list .tp-menu-item{padding:8px 10px;font-size:0.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tp-popup-project-name{overflow:hidden;text-overflow:ellipsis;flex:1}
  .tp-popup-empty{padding:10px;font-size:0.72rem;color:var(--text-muted, #555);text-align:center}
  @media(max-width:800px){.tp-header{height:auto;padding:14px 16px;align-items:flex-start;flex-direction:column}.tp-header-actions{width:100%;flex-wrap:wrap}.tp-toolbar,.tp-grid{padding-left:16px;padding-right:16px}.tp-board{grid-template-columns:repeat(4,82vw);padding:14px}.tp-column{min-height:70vh}.tp-form-row,.tp-options{grid-template-columns:1fr}.tp-progress{display:none}.tp-heading p{max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
`}</style> }
