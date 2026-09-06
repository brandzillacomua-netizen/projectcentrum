import React from 'react'

export const KanbanCardActions = ({ task, canAdvance, canManageTask, updateManagementTask, currentUser }) => {
  if (!canAdvance(task)) return null
  const canApprove = canManageTask(task)
  return (
    <div className="card-actions" onClick={e => e.stopPropagation()}>
      {task.status === 'todo' && (
        <button className="ca-btn ca-start" onClick={async () => {
          await updateManagementTask(task.id, { status: 'in_progress', assigned_to: task.assigned_to || currentUser?.login })
        }}>▶ Почати</button>
      )}
      {task.status === 'in_progress' && (
        <button className="ca-btn ca-review" onClick={async () => {
          await updateManagementTask(task.id, { status: 'review' })
        }}>⚙ На перевірку</button>
      )}
      {task.status === 'review' && (
        <div className="ca-row">
          {canApprove ? (
            <>
              <button className="ca-btn ca-approve" onClick={async () => updateManagementTask(task.id, { status: 'done' })}>✓ Прийняти</button>
              <button className="ca-btn ca-reject" onClick={async () => updateManagementTask(task.id, { status: 'in_progress' })}>✕ Відхилити</button>
            </>
          ) : (
            <button className="ca-btn ca-reject" style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }} onClick={async () => updateManagementTask(task.id, { status: 'in_progress' })}>↩ Скасувати перевірку</button>
          )}
        </div>
      )}
    </div>
  )
}
