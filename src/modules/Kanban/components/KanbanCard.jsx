import React from 'react'
import { Users, AlertCircle, Calendar, CheckSquare, Edit3, Trash2 } from 'lucide-react'
import { PriorityBadge } from './KanbanPriorityBadge'
import { ChecklistBar } from './KanbanChecklistBar'
import { UserAvatar } from './KanbanUserAvatar'
import { KanbanCardActions } from './KanbanCardActions'
import {
  getAssignees,
  isOverdueTask,
  checklistProgress,
  PRIORITY_CFG
} from '../utils/kanbanHelpers'

export const KanbanCard = ({
  task,
  systemUsers,
  departments,
  canManageTask,
  canAdvance,
  isDirector,
  isTaskRelevantToUser,
  currentUser,
  handleDragStart,
  handleDragEnd,
  handleOpenTask,
  handleOpenEdit,
  handleDelete,
  updateManagementTask
}) => {
  const taskAssignees = getAssignees(task).map(login => (systemUsers || []).find(u => u.login === login)).filter(Boolean)
  const overdue = isOverdueTask(task)
  const checklist = Array.isArray(task.checklist) ? task.checklist : []
  const clp = checklistProgress(checklist)
  const pcfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium
  const accentColor = task.color || pcfg.color

  return (
    <div key={task.id} className={`kb-card ${overdue ? 'overdue' : ''}`}
      style={{ '--pb': accentColor }}
      draggable={canManageTask(task)}
      onDragStart={e => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      onClick={() => handleOpenTask(task)}>

      {/* Priority bar */}
      <div className="card-pbar" style={{ background: accentColor }} />

      <div className="card-top">
        <PriorityBadge priority={task.priority} />
        {task.is_collective && (
          <span className="collective-badge">
            <Users size={10} /> {departments.find(d => d.id === task.department)?.label || 'Колектив'}
          </span>
        )}
        {overdue && <span className="overdue-badge pulse"><AlertCircle size={10} /> Прострочено</span>}
      </div>

      <h4 className="card-title">{task.title}</h4>

      {/* Checklist mini bar */}
      {clp && <ChecklistBar checklist={checklist} />}

      <div className="card-footer">
        <div className="card-meta">
          {task.deadline && (
            <span className="card-deadline" style={{ color: overdue ? '#ef4444' : '#555' }}>
              <Calendar size={11} />
              {(() => {
                const d = new Date(task.deadline)
                const options = { day: 'numeric', month: 'short' }
                if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                  options.hour = '2-digit'
                  options.minute = '2-digit'
                }
                return d.toLocaleString('uk-UA', options)
              })()}
            </span>
          )}
          {clp && (
            <span className="card-cl-count" style={{ color: clp.done === clp.total ? '#10b981' : '#555' }}>
              <CheckSquare size={11} /> {clp.done}/{clp.total}
            </span>
          )}
        </div>
        <div className="card-users">
          {!task.is_collective && taskAssignees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {taskAssignees.slice(0, 3).map((u, i) => (
                <div key={u.login} style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 3 - i, position: 'relative' }}>
                  <UserAvatar user={u} size={26} />
                </div>
              ))}
              {taskAssignees.length > 3 && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#888', marginLeft: '-8px', fontWeight: 800 }}>
                  +{taskAssignees.length - 3}
                </div>
              )}
            </div>
          )}
          {!task.is_collective && taskAssignees.length === 0 && (
            <div className="ua-unassigned" title="Не призначено">?</div>
          )}
        </div>
      </div>

      <KanbanCardActions
        task={task}
        canAdvance={canAdvance}
        canManageTask={canManageTask}
        updateManagementTask={updateManagementTask}
        currentUser={currentUser}
      />

      {/* Manager controls */}
      {(isDirector ? true : isTaskRelevantToUser(task, currentUser)) && (
        <div className="card-mgr-btns" onClick={e => e.stopPropagation()}>
          <button className="mgr-btn edit-btn" onClick={e => handleOpenEdit(task, e)} title="Редагувати"><Edit3 size={12} /></button>
          <button className="mgr-btn del-btn" onClick={e => handleDelete(task.id, e)} title="Видалити"><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  )
}
