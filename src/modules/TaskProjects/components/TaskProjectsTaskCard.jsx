import React from 'react'
import { Calendar, CheckSquare, Edit3, Trash2, Users } from 'lucide-react'
import { asArray, userName } from '../hooks/useTaskProjectsData.js'

export const TaskProjectsTaskCard = ({
  task,
  column,
  isOwnerOrManager,
  currentUser,
  systemUsers,
  openTaskForm,
  deleteManagementTask
}) => {
  const assignee = systemUsers.find(u => u.login === task.assigned_to)
  const checklist = asArray(task.checklist)
  const checklistDone = checklist.filter(i => i.done).length
  const canDelete = isOwnerOrManager || task.created_by === currentUser?.login

  return (
    <article
      className="tp-task"
      draggable={isOwnerOrManager || task.created_by === currentUser?.login}
      onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
      onClick={() => openTaskForm(task)}
      style={{ borderLeftColor: task.color || column.color, cursor: 'pointer' }}
    >
      <div className={`tp-priority p-${task.priority || 'medium'}`}>
        {task.priority === 'urgent' ? 'ТЕРМІНОВО' : task.priority === 'high' ? 'ВИСОКИЙ' : task.priority === 'low' ? 'НИЗЬКИЙ' : 'СЕРЕДНІЙ'}
      </div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      {!!checklist.length && (
        <div className="tp-check-progress">
          <i><b style={{ width: `${Math.round(checklistDone / checklist.length * 100)}%` }} /></i>
          <span><CheckSquare size={12} /> {checklistDone}/{checklist.length}</span>
        </div>
      )}
      <footer>
        <span>
          <Users size={13} />{' '}
          {asArray(task.assignees).length > 1
            ? `${userName(assignee)} +${task.assignees.length - 1}`
            : assignee
            ? userName(assignee)
            : 'Не призначено'}
        </span>
        {task.deadline && (
          <span><Calendar size={13} /> {new Date(task.deadline).toLocaleDateString('uk-UA')}</span>
        )}
      </footer>
      <div className="tp-task-actions">
        <button onClick={e => { e.stopPropagation(); openTaskForm(task) }} title="Редагувати">
          <Edit3 size={13} />
        </button>
        {canDelete && (
          <button onClick={e => { e.stopPropagation(); confirm('Видалити задачу?') && deleteManagementTask(task.id) }} title="Видалити">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  )
}

export default TaskProjectsTaskCard
