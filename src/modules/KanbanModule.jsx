import React, { useState, useMemo, useEffect } from 'react'
import {
  KanbanSquare,
  ArrowLeft,
  Plus,
  Clock,
  User,
  Users,
  Search,
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
  const [filterMode, setFilterMode] = useState('all') // 'all', 'my', 'assigned_by_me', 'department', 'unassigned'
  const [statsFilter, setStatsFilter] = useState('all') // 'all', 'in_progress', 'overdue', 'done'
  const [activeMobileColumn, setActiveMobileColumn] = useState('todo')
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

  const getUserDepartmentId = (deptName) => {
    if (!deptName) return '';
    const d = deptName.toLowerCase();
    if (d.includes('цех №1') || d.includes('цех 1')) return 'shop1';
    if (d.includes('цех №2') || d.includes('цех 2')) return 'shop2';
    if (d.includes('склад')) return 'warehouse';
    if (d.includes('менедж') || d.includes('керівн') || d.includes('адмін')) return 'manager';
    if (d.includes('логіст')) return 'logistics';
    return '';
  }

  // Automatically configure default filters based on user role when loaded
  useEffect(() => {
    if (currentUser) {
      const pos = currentUser?.position?.toLowerCase() || ''
      const manager = pos.includes('адмін') || pos.includes('директор') || pos.includes('цеху') || pos.includes('керівник')
      setFilterMode(manager ? 'all' : 'my')
    }
  }, [currentUser])

  // Aggregate Stats based on user rights
  const stats = useMemo(() => {
    let baseList = managementTasks || []
    if (!isManager) {
      baseList = baseList.filter(t => 
        t.assigned_to === currentUser?.login || 
        t.created_by === currentUser?.login || 
        t.is_collective === true || 
        t.is_collective === 'true' ||
        t.is_collective === 1
      )
    }

    const total = baseList.length
    const inProgress = baseList.filter(t => t.status === 'in_progress').length
    const done = baseList.filter(t => t.status === 'done').length
    const overdue = baseList.filter(t => {
      const isOverdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done';
      return isOverdue;
    }).length

    return { total, inProgress, done, overdue }
  }, [managementTasks, isManager, currentUser])

  // Filter tasks based on view mode, stats filter, and search text
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

    // Role-based filters
    if (filterMode === 'my') {
      list = list.filter(t => t.assigned_to === currentUser?.login)
    } else if (filterMode === 'assigned_by_me') {
      list = list.filter(t => t.created_by === currentUser?.login && t.assigned_to !== currentUser?.login)
    } else if (filterMode === 'department') {
      const deptId = getUserDepartmentId(currentUser?.department)
      list = list.filter(t => t.is_collective && (t.department === deptId || t.department === 'all'))
    } else if (filterMode === 'unassigned') {
      list = list.filter(t => !t.assigned_to && !t.is_collective)
    }

    // Stats quick filters
    if (statsFilter === 'in_progress') {
      list = list.filter(t => t.status === 'in_progress')
    } else if (statsFilter === 'overdue') {
      list = list.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done')
    } else if (statsFilter === 'done') {
      list = list.filter(t => t.status === 'done')
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      )
    }

    return list
  }, [managementTasks, filterMode, statsFilter, searchQuery, currentUser, isManager])

  // Drag and Drop handlers
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

  // Parse comments from task description
  const parseTaskDescriptionAndComments = (descText) => {
    if (!descText) return { description: '', comments: [] };
    
    const lines = descText.split('\n');
    const comments = [];
    const descLines = [];
    const commentRegex = /^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/;
    
    lines.forEach(line => {
      const match = line.trim().match(commentRegex);
      if (match) {
        comments.push({
          time: match[1],
          author: match[2],
          text: match[3]
        });
      } else {
        descLines.push(line);
      }
    });
    
    return {
      description: descLines.join('\n').trim(),
      comments
    };
  }

  const parsedTask = useMemo(() => {
    if (!selectedTask) return { description: '', comments: [] };
    return parseTaskDescriptionAndComments(selectedTask.description);
  }, [selectedTask?.description])

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || !selectedTask) return

    const timeStr = new Date().toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    const authorName = currentUser?.first_name || currentUser?.login || 'Користувач'
    const newCommentLine = `\n[${timeStr}] ${authorName}: ${commentText}`
    
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

  // Direct action button components for cards
  const renderCardActions = (task) => {
    if (task.status === 'done') return null;

    const isAssignee = task.assigned_to === currentUser?.login;
    const isCollectiveForMyDept = task.is_collective && (getUserDepartmentId(currentUser?.department) === task.department || task.department === 'all');
    const canAdvance = isAssignee || isCollectiveForMyDept || isManager;

    if (!canAdvance) return null;

    return (
      <div className="card-quick-actions" onClick={e => e.stopPropagation()}>
        {task.status === 'todo' && (
          <button 
            className="action-btn start-btn"
            onClick={async () => {
              await updateManagementTask(task.id, { 
                status: 'in_progress', 
                assigned_to: task.assigned_to || currentUser?.login 
              });
            }}
          >
            ▶ Почати роботу
          </button>
        )}
        {task.status === 'in_progress' && (
          <button 
            className="action-btn review-btn"
            onClick={async () => {
              await updateManagementTask(task.id, { status: 'review' });
            }}
          >
            ⚙ На перевірку
          </button>
        )}
        {task.status === 'review' && isManager && (
          <div className="manager-actions">
            <button 
              className="action-btn approve-btn"
              onClick={async () => {
                await updateManagementTask(task.id, { status: 'done' });
              }}
            >
              ✓ Прийняти
            </button>
            <button 
              className="action-btn reject-btn"
              onClick={async () => {
                await updateManagementTask(task.id, { status: 'in_progress' });
              }}
            >
              ✕ Відхилити
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="kanban-console">
      {/* Navigation Header */}
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
            {isManager ? (
              <>
                <button
                  className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('all'); setStatsFilter('all'); }}
                >УСІ</button>
                <button
                  className={`filter-btn ${filterMode === 'my' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('my'); setStatsFilter('all'); }}
                >МОЇ</button>
                <button
                  className={`filter-btn ${filterMode === 'assigned_by_me' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('assigned_by_me'); setStatsFilter('all'); }}
                  title="Задачі, створені мною"
                >ДОРУЧЕНО</button>
                <button
                  className={`filter-btn ${filterMode === 'unassigned' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('unassigned'); setStatsFilter('all'); }}
                  title="Задачі без виконавця"
                >БЕЗ ВИКОН.</button>
              </>
            ) : (
              <>
                <button
                  className={`filter-btn ${filterMode === 'my' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('my'); setStatsFilter('all'); }}
                >МОЇ ЗАДАЧІ</button>
                <button
                  className={`filter-btn ${filterMode === 'department' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('department'); setStatsFilter('all'); }}
                >ВІДДІЛ</button>
                <button
                  className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                  onClick={() => { setFilterMode('all'); setStatsFilter('all'); }}
                >УСІ ДОСТУПНІ</button>
              </>
            )}
          </div>

          {isManager && (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              НОВА ЗАДАЧА
            </button>
          )}
        </div>
      </nav>

      {/* Interactive Stats Dashboard Widget */}
      <div className="stats-dashboard">
        <div 
          className={`stat-card glass-panel total-stats ${statsFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatsFilter('all')} 
        >
          <div className="stat-icon-wrap"><KanbanSquare size={18} /></div>
          <div className="stat-info">
            <span className="stat-label">УСЬОГО ЗАДАЧ</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>

        <div 
          className={`stat-card glass-panel progress-stats ${statsFilter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setStatsFilter(statsFilter === 'in_progress' ? 'all' : 'in_progress')}
        >
          <div className="stat-icon-wrap" style={{ color: '#3b82f6' }}><Clock size={18} /></div>
          <div className="stat-info">
            <span className="stat-label">В РОБОТІ</span>
            <span className="stat-value" style={{ color: '#3b82f6' }}>{stats.inProgress}</span>
          </div>
        </div>

        <div 
          className={`stat-card glass-panel overdue-stats ${statsFilter === 'overdue' ? 'active' : ''}`}
          onClick={() => setStatsFilter(statsFilter === 'overdue' ? 'all' : 'overdue')}
        >
          <div className="stat-icon-wrap" style={{ color: '#ef4444' }}><AlertCircle size={18} /></div>
          <div className="stat-info">
            <span className="stat-label">ПРОТЕРМІНОВАНО</span>
            <span className="stat-value pulse-red-text" style={{ color: '#ef4444' }}>{stats.overdue}</span>
          </div>
        </div>

        <div 
          className={`stat-card glass-panel done-stats ${statsFilter === 'done' ? 'active' : ''}`}
          onClick={() => setStatsFilter(statsFilter === 'done' ? 'all' : 'done')}
        >
          <div className="stat-icon-wrap" style={{ color: '#10b981' }}><CheckCircle2 size={18} /></div>
          <div className="stat-info">
            <span className="stat-label">ВИКОНАНО</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{stats.done}</span>
          </div>
        </div>
      </div>

      {/* Mobile Column Tabs bar */}
      <div className="mobile-column-tabs mobile-only">
        {COLUMNS.map(col => {
          const count = filteredTasks.filter(t => t.status === col.id).length
          return (
            <button
              key={col.id}
              className={`mobile-tab-btn ${activeMobileColumn === col.id ? 'active' : ''}`}
              onClick={() => setActiveMobileColumn(col.id)}
              style={{ borderBottomColor: activeMobileColumn === col.id ? col.color : 'transparent' }}
            >
              <span className="tab-title">{col.title}</span>
              <span className="tab-count" style={{ background: `${col.color}20`, color: col.color }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Kanban Columns Grid */}
      <main className="kanban-board">
        {COLUMNS.map(column => {
          const columnTasks = filteredTasks.filter(t => t.status === column.id)

          return (
            <div
              key={column.id}
              className={`kanban-column glass-panel ${activeMobileColumn === column.id ? 'mobile-active' : ''}`}
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
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
                  const { description: cardDesc } = parseTaskDescriptionAndComments(task.description)

                  return (
                    <div
                      key={task.id}
                      className={`task-card ${isOverdue ? 'overdue' : ''}`}
                      style={{ borderLeft: `4px solid ${getPriorityColor(task.priority)}` }}
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
                      {cardDesc && <p className="task-desc">{cardDesc}</p>}

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

                      {/* Direct click-to-move buttons */}
                      {renderCardActions(task)}

                      {/* Move helper for desktop hover */}
                      {column.id !== 'done' && (
                        <button
                          className="quick-move-btn hide-mobile"
                          onClick={(e) => { e.stopPropagation(); handleQuickStatusMove(task.id, task.status); }}
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
                    Черга порожня
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
                <span className="priority-dot" style={{ background: getPriorityColor(selectedTask.priority), color: getPriorityColor(selectedTask.priority) }}></span>
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
                      {parsedTask.description || <span className="text-dim">Опис відсутній</span>}
                    </div>
                  </section>

                  <section className="detail-section comments-section">
                    <label><MessageSquare size={14} /> ВІДГУКИ ТА КОМЕНТАРІ ({parsedTask.comments.length})</label>
                    
                    <div className="comments-list">
                      {parsedTask.comments.map((comment, i) => (
                        <div key={i} className="comment-bubble-wrap">
                          <div className="comment-bubble-meta">
                            <span className="comment-author">{comment.author}</span>
                            <span className="comment-time">{comment.time}</span>
                          </div>
                          <div className="comment-bubble">
                            {comment.text}
                          </div>
                        </div>
                      ))}
                      {parsedTask.comments.length === 0 && (
                        <div className="empty-comments-state">
                          Немає коментарів. Залиште перший відгук нижче!
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleAddComment} className="comment-input-group">
                      <input 
                        type="text" 
                        placeholder="Напишіть коментар..." 
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                      />
                      <button type="submit" className="btn-send-comment">НАДІСЛАТИ</button>
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
        
        .stats-dashboard {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;
          padding: 15px 40px; background: #080808; border-bottom: 1px solid #151515; flex-shrink: 0;
        }
        .stat-card {
          display: flex; align-items: center; gap: 15px; padding: 12px 20px;
          background: rgba(18, 18, 18, 0.6); border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 16px; cursor: pointer; transition: all 0.2s;
        }
        .stat-card:hover {
          background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.08);
          transform: translateY(-1px);
        }
        .stat-card.active {
          background: rgba(255, 144, 0, 0.05); border-color: #ff9000;
          box-shadow: 0 0 10px rgba(255, 144, 0, 0.1);
        }
        .stat-icon-wrap {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 255, 255, 0.02);
          color: #ff9000;
        }
        .stat-info { display: flex; flex-direction: column; }
        .stat-label { font-size: 0.65rem; font-weight: 800; color: #555; letter-spacing: 0.5px; }
        .stat-value { font-size: 1.15rem; font-weight: 900; color: #fff; }
        
        .mobile-column-tabs { display: none; }

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
        .task-card.overdue { border-color: rgba(239, 68, 68, 0.4) !important; background: rgba(239, 68, 68, 0.01); }
        
        .task-labels { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .priority-label { font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 8px; letter-spacing: 0.5px; }
        .collective-label { display: flex; align-items: center; gap: 4px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 8px; }
        
        .task-title { margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 600; line-height: 1.4; }
        .task-desc { margin: 0; font-size: 0.8rem; color: #888; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .task-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #1d1d1d; }
        .task-meta { display: flex; gap: 15px; }
        .deadline { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 800; }
        
        .user-avatar { width: 28px; height: 28px; border-radius: 14px; background: #ff9000; color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; border: 2px solid #111; }
        .user-avatar.unassigned { background: #222; color: #666; border-style: dashed; }
        
        .card-quick-actions {
          display: flex; gap: 8px; margin-top: 15px; padding-top: 12px; border-top: 1px dashed #222;
        }
        .action-btn {
          flex: 1; padding: 8px 10px; border-radius: 8px; border: none;
          font-size: 0.7rem; font-weight: 900; cursor: pointer; transition: all 0.2s;
          text-align: center; text-transform: uppercase;
        }
        .start-btn { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .start-btn:hover { background: #3b82f6; color: #fff; }
        .review-btn { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .review-btn:hover { background: #f59e0b; color: #000; }
        .manager-actions { display: flex; gap: 8px; width: 100%; }
        .approve-btn { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .approve-btn:hover { background: #10b981; color: #fff; }
        .reject-btn { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .reject-btn:hover { background: #ef4444; color: #fff; }

        .quick-move-btn { position: absolute; right: -30px; top: 30%; transform: translateY(-50%); background: #ff9000; color: #000; border: none; width: 24px; height: 24px; border-radius: 12px; font-weight: 900; cursor: pointer; transition: 0.2s; opacity: 0; }
        .task-card:hover .quick-move-btn { right: 10px; opacity: 1; }
        
        .btn-delete-task { position: absolute; top: 10px; right: 10px; background: rgba(239,68,68,0.1); color: #ef4444; border: none; width: 24px; height: 24px; border-radius: 6px; display: flex; justify-content: center; align-items: center; cursor: pointer; opacity: 0; transition: 0.2s; }
        .task-card:hover .btn-delete-task { opacity: 1; }
        .btn-delete-task:hover { background: #ef4444; color: #fff; }
 
        .empty-column-state { padding: 30px 10px; text-align: center; border: 2px dashed #1a1a1a; border-radius: 12px; color: #333; font-weight: 800; font-size: 0.8rem; text-transform: uppercase; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .modal-content { width: 500px; max-width: 95vw; background: #0a0a0a; border: 1px solid #222; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.8); animation: scaleUp 0.3s; }
        .modal-header { padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1a1a1a; }
        .modal-header h2 { margin: 0; font-size: 1.2rem; font-weight: 900; }
        .btn-close { background: transparent; border: none; color: #555; cursor: pointer; transition: 0.2s; }
        .btn-close:hover { color: #fff; }
        
        .modal-body { padding: 30px; max-height: 80vh; overflow-y: auto; }
        .form-layout { display: flex; flex-direction: column; gap: 20px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        
        .form-group label { font-size: 0.75rem; font-weight: 950; color: #555; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .form-group input, .form-group textarea, .form-group select { background: #111; border: 1px solid #222; color: #fff; padding: 12px 15px; border-radius: 12px; font-family: inherit; font-size: 0.9rem; transition: 0.2s; width: 100%; box-sizing: border-box; }
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
        .detail-main { display: flex; flex-direction: column; gap: 25px; min-width: 0; }
        .detail-section label { font-size: 0.7rem; font-weight: 900; color: #555; text-transform: uppercase; margin-bottom: 10px; display: block; }
        .description-box { background: #080808; padding: 20px; border-radius: 16px; border: 1px solid #1a1a1a; line-height: 1.6; color: #ccc; min-height: 80px; white-space: pre-wrap; font-size: 0.9rem; }
        
        .comments-section { border-top: 1px solid #1a1a1a; padding-top: 25px; }
        
        .comments-list { display: flex; flex-direction: column; gap: 12px; max-height: 250px; overflow-y: auto; margin-bottom: 15px; padding-right: 5px; }
        .comment-bubble-wrap { display: flex; flex-direction: column; gap: 4px; }
        .comment-bubble-meta { display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; padding: 0 4px; }
        .comment-author { color: #ff9000; }
        .comment-time { color: #444; }
        .comment-bubble { background: #111; border: 1px solid #1a1a1a; padding: 10px 14px; border-radius: 12px; font-size: 0.8rem; line-height: 1.4; color: #eee; word-break: break-word; }
        .empty-comments-state { text-align: center; padding: 20px; color: #333; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; }

        .comment-input-group { display: flex; gap: 10px; background: #050505; padding: 8px; border-radius: 12px; border: 1px solid #222; }
        .comment-input-group input { flex: 1; background: transparent; border: none; color: #fff; outline: none; padding-left: 10px; font-size: 0.85rem; }
        .btn-send-comment { background: #ff9000; color: #000; border: none; padding: 8px 15px; border-radius: 8px; font-weight: 900; font-size: 0.7rem; cursor: pointer; }
        
        .detail-side { display: flex; flex-direction: column; gap: 20px; background: #0a0a0a; padding: 20px; border-radius: 20px; border: 1px solid #1a1a1a; height: fit-content; }
        .side-group label { font-size: 0.65rem; font-weight: 950; color: #333; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .side-value { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: #888; }
        .status-select { background: #111; border: 1px solid #222; color: #fff; width: 100%; padding: 8px; border-radius: 8px; font-weight: 800; cursor: pointer; }

        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .hide-mobile { display: block; }

        /* Media Queries for responsive adaptation */
        @media (max-width: 1024px) {
          .stats-dashboard {
            grid-template-columns: repeat(2, 1fr);
            padding: 15px 20px;
          }
          .glass-nav {
            padding: 15px 20px;
            flex-direction: column;
            height: auto;
            gap: 15px;
          }
          .nav-left { width: 100%; justify-content: space-between; }
          .nav-right {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .search-bar { width: 100%; }
          .search-bar input { width: 100%; }
          .filter-group { width: 100%; justify-content: space-between; }
          .filter-btn { flex: 1; text-align: center; }
          .btn-primary { width: 100%; justify-content: center; }
          
          .kanban-board { padding: 15px 20px; }
          .detail-layout { grid-template-columns: 1fr; gap: 20px; }
          .detail-side { width: 100%; box-sizing: border-box; }
        }

        @media (max-width: 768px) {
          .stats-dashboard {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            padding: 10px 15px;
          }
          .stat-card {
            padding: 8px 12px;
            gap: 8px;
          }
          .stat-icon-wrap {
            width: 28px;
            height: 28px;
          }
          .stat-value {
            font-size: 1rem;
          }
          
          .mobile-column-tabs {
            display: flex;
            background: #0c0c0c;
            border-bottom: 1px solid #1a1a1a;
            overflow-x: auto;
            padding: 5px 10px;
            gap: 10px;
            flex-shrink: 0;
          }
          .mobile-tab-btn {
            flex: 1;
            min-width: 90px;
            background: transparent;
            border: none;
            border-bottom: 3px solid transparent;
            padding: 10px 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            color: #555;
            transition: all 0.2s;
          }
          .mobile-tab-btn.active {
            color: #fff;
          }
          .tab-title {
            font-size: 0.65rem;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .tab-count {
            font-size: 0.65rem;
            font-weight: 900;
            padding: 2px 6px;
            border-radius: 6px;
          }
          
          .kanban-board {
            display: flex !important;
            flex-direction: column !important;
            padding: 15px !important;
            overflow-y: auto !important;
          }
          .kanban-column {
            display: none !important;
            width: 100% !important;
            flex: 1 !important;
            height: auto !important;
            max-height: none !important;
          }
          .kanban-column.mobile-active {
            display: flex !important;
          }
          
          .hide-mobile { display: none !important; }
        }
      `}} />
    </div>
  )
}

export default KanbanModule
