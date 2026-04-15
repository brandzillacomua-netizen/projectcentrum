import React, { useState, useMemo } from 'react'
import {
  KanbanSquare,
  ArrowLeft,
  Plus,
  MoreVertical,
  Clock,
  User,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const KanbanModule = () => {
  const { managementTasks, systemUsers, addManagementTask, updateManagementTask, deleteManagementTask, currentUser } = useMES()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [filterMode, setFilterMode] = useState('all') // 'all', 'my', 'department'
  const [searchQuery, setSearchQuery] = useState('')
  const [commentText, setCommentText] = useState('')

  // Create Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    is_collective: false,
    department: 'all',
    deadline: ''
  })

  // Columns definition mapping to DB status 'todo', 'in_progress', 'review', 'done'
  const COLUMNS = [
    { id: 'todo', title: 'В ЧЕРЗІ', color: '#8b5cf6' },
    { id: 'in_progress', title: 'В РОБОТІ', color: '#3b82f6' },
    { id: 'review', title: 'ПЕРЕВІРКА', color: '#f59e0b' },
    { id: 'done', title: 'ВИКОНАНО', color: '#10b981' }
  ]

  const DEPARTMENTS = [
    { id: 'all', label: 'Усі відділи' },
    { id: 'manager', label: 'Менеджмент' },
    { id: 'shop1', label: 'Цех №1' },
    { id: 'shop2', label: 'Цех №2' },
    { id: 'warehouse', label: 'Склад' },
    { id: 'logistics', label: 'Логістика' }
  ]

  const isManager = useMemo(() => {
    const pos = currentUser?.position?.toLowerCase() || ''
    return pos.includes('адмін') || pos.includes('директор') || pos.includes('цеху') || pos.includes('керівник')
  }, [currentUser])

  // Filter tasks based on mode and search
  const filteredTasks = useMemo(() => {
    let list = managementTasks || []

    // Base privacy filter: Non-managers only see own or collective tasks
    if (!isManager) {
      list = list.filter(t => 
        t.assigned_to === currentUser?.login || 
        t.created_by === currentUser?.login || 
        t.is_collective === true || 
        t.is_collective === 'true' ||
        t.is_collective === 1
      )
    }

    if (filterMode === 'my') {
      list = list.filter(t => t.assigned_to === currentUser?.login || t.created_by === currentUser?.login)
    } else if (filterMode === 'department') {
      // If user has a department implied by role or position, filter here
      // For now, it filters collective tasks that match department logic
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      )
    }

    return list
  }, [managementTasks, filterMode, searchQuery, currentUser, isManager])

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId)
    e.currentTarget.classList.add('dragging')
  }

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging')
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) {
      await updateManagementTask(taskId, { status: newStatus })
    }
  }

  const handleQuickStatusMove = async (taskId, currentStatus) => {
    const idx = COLUMNS.findIndex(c => c.id === currentStatus)
    if (idx < COLUMNS.length - 1) {
      await updateManagementTask(taskId, { status: COLUMNS[idx + 1].id })
    }
  }

  const handleOpenTask = (task) => {
    setSelectedTask(task)
    setIsDetailOpen(true)
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || !selectedTask) return

    const timeStr = new Date().toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    const authorName = currentUser?.first_name || currentUser?.login || 'Користувач'
    const newCommentLine = `\n[${timeStr}] ${authorName}: ${commentText}`
    
    // We append to description since 'comments' column is likely missing
    const updatedDesc = (selectedTask.description || '') + newCommentLine
    
    await updateManagementTask(selectedTask.id, { description: updatedDesc })
    setSelectedTask({ ...selectedTask, description: updatedDesc })
    setCommentText('')
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!newTask.title.trim()) return alert('Введіть назву задачі')

    await addManagementTask({
      ...newTask,
      status: 'todo'
    })

    setIsModalOpen(false)
    setNewTask({
      title: '', description: '', priority: 'medium', assigned_to: '',
      is_collective: false, department: 'all', deadline: ''
    })
  }

  const getPriorityColor = (p) => {
    switch (p) {
      case 'low': return '#34d399';
      case 'medium': return '#60a5fa';
      case 'high': return '#fbbf24';
      case 'urgent': return '#ef4444';
      default: return '#666';
    }
  }

  const getPriorityLabel = (p) => {
    switch (p) {
      case 'low': return 'НИЗЬКИЙ';
      case 'medium': return 'СЕРЕДНІЙ';
      case 'high': return 'ВИСОКИЙ';
      case 'urgent': return 'НАГАЛЬНО';
      default: return 'СЕРЕДНІЙ';
    }
  }

  return (
    <div className="kanban-console">
      <nav className="glass-nav">
        <div className="nav-left">
          <Link to="/" className="btn-back">
            <ArrowLeft size={18} /> <span>НАЗАД</span>
          </Link>
          <div className="brand-group">
            <KanbanSquare className="text-orange" size={24} />
            <h1>ЗАДАЧІ <span className="text-dim">ВНУТРІШНІ ДОМОВЛЕНОСТІ</span></h1>
          </div>
        </div>

        <div className="nav-right">
          <div className="search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder="Пошук задач..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <button
              className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >УСІ</button>
            <button
              className={`filter-btn ${filterMode === 'my' ? 'active' : ''}`}
              onClick={() => setFilterMode('my')}
            >МОЇ</button>
          </div>

          {isManager && (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              НОВА ЗАДАЧА
            </button>
          )}
        </div>
      </nav>

      <main className="kanban-board">
        {COLUMNS.map(column => {
          const columnTasks = filteredTasks.filter(t => t.status === column.id)

          return (
            <div
              key={column.id}
              className="kanban-column glass-panel"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="column-header" style={{ borderTopColor: column.color }}>
                <h3>{column.title}</h3>
                <span className="task-count">{columnTasks.length}</span>
              </div>

              <div className="column-body">
                {columnTasks.map(task => {
                  const assignee = systemUsers.find(u => u.login === task.assigned_to)
                  const creator = systemUsers.find(u => u.login === task.created_by)
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'

                  return (
                    <div
                      key={task.id}
                      className={`task-card ${isOverdue ? 'overdue' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenTask(task)}
                    >
                      <div className="task-labels">
                        <span className="priority-label" style={{ backgroundColor: `${getPriorityColor(task.priority)}20`, color: getPriorityColor(task.priority) }}>
                          {getPriorityLabel(task.priority)}
                        </span>
                        {task.is_collective && (
                          <span className="collective-label">
                            <Users size={12} /> {DEPARTMENTS.find(d => d.id === task.department)?.label || 'Колективна'}
                          </span>
                        )}
                      </div>

                      <h4 className="task-title">{task.title}</h4>
                      {task.description && <p className="task-desc">{task.description}</p>}

                      <div className="task-footer">
                        <div className="task-meta">
                          {task.deadline && (
                            <span className="deadline" style={{ color: isOverdue ? '#ef4444' : '#888' }}>
                              <Clock size={12} />
                              {new Date(task.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>

                        <div className="task-users">
                          {!task.is_collective && assignee && (
                            <div className="user-avatar" title={`Виконавець: ${assignee.first_name} ${assignee.last_name}`}>
                              {assignee.first_name?.[0]}{assignee.last_name?.[0]}
                            </div>
                          )}
                          {!task.is_collective && !assignee && (
                            <div className="user-avatar unassigned" title="Не призначено">?</div>
                          )}
                        </div>
                      </div>

                      {column.id !== 'done' && (
                        <button
                          className="quick-move-btn"
                          onClick={() => handleQuickStatusMove(task.id, task.status)}
                          title="Перемістити далі"
                        >
                          →
                        </button>
                      )}

                      {/* Delete button wrapper - visible on hover */}
                      {isManager && (
                        <button
                          className="btn-delete-task"
                          onClick={(e) => { e.stopPropagation(); if (confirm('Видалити задачу?')) deleteManagementTask(task.id) }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )
                })}

                {columnTasks.length === 0 && (
                  <div className="empty-column-state">
                    Перетягніть сюди
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </main>

      {/* CREATE TASK MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Створити задачу</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateTask} className="modal-body form-layout">
              <div className="form-group">
                <label>Назва задачі *</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Короткий опис проблеми чи завдання"
                />
              </div>

              <div className="form-group">
                <label>Детальний Опис</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Що саме потрібно зробити..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Пріоритет</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                    <option value="low">Низький</option>
                    <option value="medium">Середній</option>
                    <option value="high">Високий</option>
                    <option value="urgent">НАГАЛЬНО!</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Дедлайн</label>
                  <input
                    type="date"
                    value={newTask.deadline}
                    onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                  />
                </div>
              </div>

              <div className="type-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={newTask.is_collective}
                    onChange={e => {
                      setNewTask({ ...newTask, is_collective: e.target.checked, assigned_to: e.target.checked ? '' : newTask.assigned_to })
                    }}
                  />
                  Колективна задача (для відділу)
                </label>
              </div>

              {!newTask.is_collective ? (
                <div className="form-group slide-up">
                  <label>Призначити виконавця *</label>
                  <div className="assignee-selector-v2">
                    <div className="assignee-search-input">
                      <Search size={14} />
                      <input 
                        type="text" 
                        placeholder="Введіть прізвище..." 
                        value={assigneeSearch}
                        onChange={e => setAssigneeSearch(e.target.value)}
                      />
                      {newTask.assigned_to && (
                        <div className="assigned-pill">
                          {systemUsers.find(u => u.login === newTask.assigned_to)?.first_name} <X size={12} onClick={() => setNewTask({...newTask, assigned_to: ''})} />
                        </div>
                      )}
                    </div>
                    
                    {assigneeSearch.length > 0 && (
                      <div className="search-results-popover">
                        {systemUsers
                          .filter(u => {
                            const q = assigneeSearch.toLowerCase()
                            return (u.first_name || '').toLowerCase().includes(q) || 
                                   (u.last_name || '').toLowerCase().includes(q) ||
                                   u.login.toLowerCase().includes(q)
                          })
                          .slice(0, 5)
                          .map(u => (
                            <div 
                              key={u.login} 
                              className="search-result-item"
                              onClick={() => {
                                setNewTask({ ...newTask, assigned_to: u.login })
                                setAssigneeSearch('')
                              }}
                            >
                              <div className="res-avatar">{u.first_name?.[0]}{u.last_name?.[0]}</div>
                              <div className="res-info">
                                <span className="res-name">{u.first_name} {u.last_name}</span>
                                <span className="res-pos">{u.position}</span>
                              </div>
                            </div>
                          ))}
                        {systemUsers.filter(u => {
                           const q = assigneeSearch.toLowerCase()
                           return (u.first_name || '').toLowerCase().includes(q) || 
                                  (u.last_name || '').toLowerCase().includes(q) ||
                                  u.login.toLowerCase().includes(q)
                        }).length === 0 && <div className="no-res">Нікого не знайдено</div>}
                      </div>
                    )}

                    {!newTask.assigned_to && !assigneeSearch && (
                      <div className="assign-hint">Почніть писати ім'я для вибору...</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="form-group slide-down">
                  <label>Відділ (Колективна)</label>
                  <select value={newTask.department} onChange={e => setNewTask({ ...newTask, department: e.target.value })}>
                    {DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>СКАСУВАТИ</button>
                <button type="submit" className="btn-primary">СТВОРИТИ ЗАДАЧУ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL TASK MODAL */}
      {isDetailOpen && selectedTask && (
        <div className="modal-overlay" onClick={() => setIsDetailOpen(false)}>
          <div className="modal-content glass-panel task-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group">
                <span className="priority-dot" style={{ background: getPriorityColor(selectedTask.priority) }}></span>
                <h2>{selectedTask.title}</h2>
              </div>
              <button className="btn-close" onClick={() => setIsDetailOpen(false)}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="detail-layout">
                <div className="detail-main">
                  <section className="detail-section">
                    <label>Опис задачі</label>
                    <div className="description-box">
                      {selectedTask.description || <span className="text-dim">Опис відсутній</span>}
                    </div>
                  </section>

                  <section className="detail-section comments-section">
                    <label><MessageSquare size={14} /> ВІДГУКИ ТА КОМЕНТАРІ (У ОПИСІ)</label>
                    <div className="comments-history-info">
                      * Коментарі зберігаються у нижній частині опису задачі
                    </div>
                    <form onSubmit={handleAddComment} className="comment-input-group">
                      <input 
                        type="text" 
                        placeholder="Додати відгук до опису..." 
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                      />
                      <button type="submit" className="btn-send-comment">ДОДАТИ</button>
                    </form>
                  </section>
                </div>

                <aside className="detail-side">
                  <div className="side-group">
                    <label>Статус</label>
                    <select 
                      value={selectedTask.status} 
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        await updateManagementTask(selectedTask.id, { status: newStatus });
                        setSelectedTask({ ...selectedTask, status: newStatus });
                      }}
                      className="status-select"
                    >
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>

                  <div className="side-group">
                    <label>Виконавець</label>
                    <div className="side-value">
                      <User size={14} />
                      {systemUsers.find(u => u.login === selectedTask.assigned_to)?.first_name || 'Не призначено'}
                    </div>
                  </div>

                  <div className="side-group">
                    <label>Дедлайн</label>
                    <div className="side-value">
                      <Clock size={14} />
                      {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'Не вказано'}
                    </div>
                  </div>

                  <div className="side-group">
                    <label>Творець</label>
                    <div className="side-value">
                      {systemUsers.find(u => u.login === selectedTask.created_by)?.first_name || 'Система'}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .kanban-console {
          background: #050505; height: 100vh; color: #fff;
          display: flex; flex-direction: column; overflow: hidden;
        }
        
        .glass-nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 40px; height: 70px; background: #0a0a0a;
          border-bottom: 1px solid #1a1a1a; flex-shrink: 0;
        }
        
        .nav-left { display: flex; align-items: center; gap: 30px; }
        .btn-back { display: flex; align-items: center; gap: 8px; color: #666; text-decoration: none; font-weight: 800; font-size: 0.8rem; transition: 0.2s; }
        .btn-back:hover { color: #fff; }
        .text-orange { color: #ff9000; }
        .text-dim { color: #333; }
        
        .brand-group { display: flex; align-items: center; gap: 12px; }
        .brand-group h1 { margin: 0; font-size: 1.2rem; font-weight: 900; letter-spacing: 1px; }
        
        .nav-right { display: flex; gap: 20px; align-items: center; }
        
        .search-bar {
          display: flex; align-items: center; gap: 10px; background: #111;
          padding: 8px 15px; border-radius: 12px; border: 1px solid #222;
        }
        .search-bar input { background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.85rem; width: 180px; }
        
        .filter-group { display: flex; background: #111; border-radius: 12px; padding: 4px; border: 1px solid #222; }
        .filter-btn { background: transparent; border: none; color: #666; padding: 6px 16px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.2s; }
        .filter-btn.active { background: #222; color: #fff; }
        
        .btn-primary { display: flex; align-items: center; gap: 8px; background: #ff9000; color: #000; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 900; font-size: 0.8rem; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover { background: #ffaa33; transform: translateY(-1px); }
        .btn-secondary { background: #111; color: #aaa; border: 1px solid #333; padding: 10px 20px; border-radius: 12px; font-weight: 900; cursor: pointer; }
        
        .kanban-board {
          display: flex; gap: 20px; padding: 30px 40px; overflow-x: auto; flex: 1;
        }
        
        .kanban-column {
          flex: 0 0 320px; display: flex; flex-direction: column; background: #0a0a0a;
          border: 1px solid #1a1a1a; border-radius: 20px; overflow: hidden;
        }
        
        .column-header {
          padding: 20px; display: flex; justify-content: space-between; align-items: center;
          border-top: 4px solid; border-bottom: 1px solid #1a1a1a; background: #0f0f0f;
        }
        .column-header h3 { margin: 0; font-size: 1rem; font-weight: 900; letter-spacing: 1px; }
        .task-count { background: #222; color: #888; font-size: 0.8rem; font-weight: 900; padding: 4px 10px; border-radius: 10px; }
        
        .column-body { padding: 15px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        
        .task-card {
          background: #111; border: 1px solid #222; border-radius: 16px; padding: 18px;
          cursor: grab; position: relative; transition: all 0.2s; overflow: hidden;
        }
        .task-card:active { cursor: grabbing; }
        .task-card:hover { border-color: #444; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
        .task-card.dragging { opacity: 0.5; border: 1px dashed #ff9000; }
        .task-card.overdue { border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.02); }
        
        .task-labels { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .priority-label { font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 8px; letter-spacing: 0.5px; }
        .collective-label { display: flex; align-items: center; gap: 4px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 8px; }
        
        .task-title { margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 600; line-height: 1.4; }
        .task-desc { margin: 0; font-size: 0.8rem; color: #888; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .task-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #222; }
        .task-meta { display: flex; gap: 15px; }
        .deadline { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 800; }
        
        .user-avatar { width: 28px; height: 28px; border-radius: 14px; background: #ff9000; color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; border: 2px solid #111; }
        .user-avatar.unassigned { background: #222; color: #666; border-style: dashed; }
        
        .quick-move-btn { position: absolute; right: -30px; top: 50%; transform: translateY(-50%); background: #ff9000; color: #000; border: none; width: 24px; height: 24px; border-radius: 12px; font-weight: 900; cursor: pointer; transition: 0.2s; opacity: 0; }
        .task-card:hover .quick-move-btn { right: 10px; opacity: 1; }
        
        .btn-delete-task { position: absolute; top: 10px; right: 10px; background: rgba(239,68,68,0.1); color: #ef4444; border: none; width: 24px; height: 24px; border-radius: 6px; display: flex; justify-content: center; align-items: center; cursor: pointer; opacity: 0; transition: 0.2s; }
        .task-card:hover .btn-delete-task { opacity: 1; }
        .btn-delete-task:hover { background: #ef4444; color: #fff; }

        .empty-column-state { padding: 30px 10px; text-align: center; border: 2px dashed #1a1a1a; border-radius: 12px; color: #333; font-weight: 800; font-size: 0.8rem; text-transform: uppercase; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .modal-content { width: 500px; background: #0a0a0a; border: 1px solid #222; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.8); animation: scaleUp 0.3s; }
        .modal-header { padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1a1a1a; }
        .modal-header h2 { margin: 0; font-size: 1.2rem; font-weight: 900; }
        .btn-close { background: transparent; border: none; color: #555; cursor: pointer; transition: 0.2s; }
        .btn-close:hover { color: #fff; }
        
        .modal-body { padding: 30px; }
        .form-layout { display: flex; flex-direction: column; gap: 20px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        
        .form-group label { font-size: 0.75rem; font-weight: 950; color: #555; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .form-group input, .form-group textarea, .form-group select { background: #111; border: 1px solid #222; color: #fff; padding: 12px 15px; border-radius: 12px; font-family: inherit; font-size: 0.9rem; transition: 0.2s; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #ff9000; outline: none; background: #151515; }
        
        .assignee-search-input { display: flex; align-items: center; gap: 10px; background: #050505; border: 1px solid #222; border-radius: 12px; padding: 0 15px; margin-bottom: 5px; margin-top: 5px; position: relative; }
        .assignee-search-input input { background: transparent !important; border: none !important; padding: 12px 0 !important; font-size: 0.85rem !important; flex: 1; color: #fff; }
        .assignee-search-input svg { color: #444; }
        
        .assigned-pill { background: #ff9000; color: #000; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 900; display: flex; align-items: center; gap: 6px; }
        .assigned-pill svg { cursor: pointer; color: #000 !important; }

        .assignee-selector-v2 { position: relative; }
        .search-results-popover { position: absolute; top: 100%; left: 0; right: 0; background: #0f0f0f; border: 1px solid #222; border-radius: 12px; z-index: 10; margin-top: 5px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; }
        .search-result-item { padding: 12px 15px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
        .search-result-item:hover { background: #1a1a1a; }
        .search-result-item:last-child { border-bottom: none; }
        .res-avatar { width: 32px; height: 32px; border-radius: 50%; background: #222; color: #ff9000; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; }
        .res-info { display: flex; flex-direction: column; }
        .res-name { font-size: 0.85rem; font-weight: 700; color: #fff; }
        .res-pos { font-size: 0.65rem; color: #555; text-transform: uppercase; }
        .no-res { padding: 15px; text-align: center; color: #444; font-size: 0.8rem; font-style: italic; }
        .assign-hint { font-size: 0.7rem; color: #333; margin-top: 5px; padding-left: 5px; }
        
        .type-toggle { background: rgba(255,144,0,0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,144,0,0.2); }
        .toggle-label { display: flex; align-items: center; gap: 10px; font-weight: 800; cursor: pointer; color: #ff9000; }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: 15px; margin-top: 10px; padding-top: 20px; border-top: 1px solid #1a1a1a; }

        .task-detail-modal { width: 850px; max-width: 95vw; max-height: 90vh; }
        .header-title-group { display: flex; align-items: center; gap: 12px; }
        .priority-dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
        
        .detail-layout { display: grid; grid-template-columns: 1fr 240px; gap: 30px; }
        .detail-main { display: flex; flex-direction: column; gap: 25px; }
        .detail-section label { font-size: 0.7rem; font-weight: 900; color: #555; text-transform: uppercase; margin-bottom: 10px; display: block; }
        .description-box { background: #080808; padding: 20px; border-radius: 16px; border: 1px solid #1a1a1a; line-height: 1.6; color: #ccc; min-height: 80px; }
        
        .comments-section { border-top: 1px solid #1a1a1a; padding-top: 25px; }
        .comments-history-info { font-size: 0.7rem; color: #444; margin-bottom: 15px; font-style: italic; }
        
        .comment-input-group { display: flex; gap: 10px; background: #050505; padding: 8px; border-radius: 12px; border: 1px solid #222; }
        .comment-input-group input { flex: 1; background: transparent; border: none; color: #fff; outline: none; padding-left: 10px; font-size: 0.85rem; }
        .btn-send-comment { background: #ff9000; color: #000; border: none; padding: 8px 15px; border-radius: 8px; font-weight: 900; font-size: 0.7rem; cursor: pointer; }
        
        .detail-side { display: flex; flex-direction: column; gap: 20px; background: #0a0a0a; padding: 20px; border-radius: 20px; border: 1px solid #1a1a1a; }
        .side-group label { font-size: 0.65rem; font-weight: 950; color: #333; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .side-value { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: #888; }
        .status-select { background: #111; border: 1px solid #222; color: #fff; width: 100%; padding: 8px; border-radius: 8px; font-weight: 800; cursor: pointer; }

        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}} />
    </div>
  )
}

export default KanbanModule
