import React from 'react'
import { Edit3, Plus, Trash2, X } from 'lucide-react'
import { COLORS, DEFAULT_COLUMNS } from '../hooks/useTaskProjectsData.js'
import TaskProjectsTaskCard from './TaskProjectsTaskCard.jsx'

export const TaskProjectsBoard = ({
  activeProject,
  projectTasks,
  projectColumns,
  isOwnerOrManager,
  updateManagementTask,
  updateTaskProject,
  systemUsers,
  currentUser,
  openTaskForm,
  deleteManagementTask,
  isAddingCol,
  setIsAddingCol,
  newColTitle,
  setNewColTitle,
  newColColor,
  setNewColColor,
  handleAddColumnSubmit
}) => {
  const gridColsCount = isOwnerOrManager ? projectColumns.length + 1 : projectColumns.length

  return (
    <main className="tp-board" style={{ gridTemplateColumns: `repeat(${gridColsCount}, minmax(270px, 1fr))` }}>
      {projectColumns.map((column, colIndex) => {
        const tasks = projectTasks.filter(t => t.status === column.id)
        return (
          <section
            className="tp-column"
            key={column.id}
            onDragOver={e => e.preventDefault()}
            onDrop={e => updateManagementTask(e.dataTransfer.getData('taskId'), { status: column.id })}
          >
            <div className="tp-column-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span style={{ color: column.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{column.title}</span>
                <b>{tasks.length}</b>
              </div>
              {isOwnerOrManager && (
                <div className="tp-col-controls" onMouseDown={e => e.stopPropagation()}>
                  <input
                    type="color"
                    value={column.color || '#3b82f6'}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={async e => {
                      const newColor = e.target.value
                      const updated = projectColumns.map((c, i) => i === colIndex ? { ...c, color: newColor } : c)
                      await updateTaskProject(activeProject.id, { columns: updated })
                    }}
                    title="Змінити колір"
                    className="tp-col-color-picker"
                  />
                  <button
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={async e => {
                      e.stopPropagation()
                      e.preventDefault()
                      const newTitle = prompt('Нова назва колонки:', column.title)
                      if (newTitle && newTitle.trim() && newTitle.trim() !== column.title) {
                        const updated = projectColumns.map((c, i) => i === colIndex ? { ...c, title: newTitle.trim().toUpperCase() } : c)
                        await updateTaskProject(activeProject.id, { columns: updated })
                      }
                    }}
                    title="Перейменувати колонку"
                  >
                    <Edit3 size={12} />
                  </button>
                  {colIndex > 0 && (
                    <button
                      type="button"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={async e => {
                        e.stopPropagation()
                        e.preventDefault()
                        const updated = [...projectColumns]
                        const temp = updated[colIndex - 1]
                        updated[colIndex - 1] = updated[colIndex]
                        updated[colIndex] = temp
                        await updateTaskProject(activeProject.id, { columns: updated })
                      }}
                      title="Вліво"
                    >
                      ←
                    </button>
                  )}
                  {colIndex < projectColumns.length - 1 && (
                    <button
                      type="button"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={async e => {
                        e.stopPropagation()
                        e.preventDefault()
                        const updated = [...projectColumns]
                        const temp = updated[colIndex + 1]
                        updated[colIndex + 1] = updated[colIndex]
                        updated[colIndex] = temp
                        await updateTaskProject(activeProject.id, { columns: updated })
                      }}
                      title="Вправо"
                    >
                      →
                    </button>
                  )}
                  {projectColumns.length > 1 && (
                    <button
                      type="button"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={async e => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (!confirm(`Видалити колонку «${column.title}»?`)) return
                        const updated = projectColumns.filter((_, i) => i !== colIndex)
                        await updateTaskProject(activeProject.id, { columns: updated })
                      }}
                      title="Видалити"
                      className="tp-col-del"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="tp-cards">
              {tasks.map(task => (
                <TaskProjectsTaskCard
                  key={task.id}
                  task={task}
                  column={column}
                  isOwnerOrManager={isOwnerOrManager}
                  currentUser={currentUser}
                  systemUsers={systemUsers}
                  openTaskForm={openTaskForm}
                  deleteManagementTask={deleteManagementTask}
                />
              ))}
              {!tasks.length && <div className="tp-empty-column">Перетягніть задачу сюди</div>}
            </div>
          </section>
        )
      })}

      {isOwnerOrManager && (
        isAddingCol ? (
          <div className="tp-new-column-card">
            <span style={{ fontSize: '0.72rem', color: '#ff9000', fontWeight: 900 }}>НОВА КОЛОНКА</span>
            <input
              autoFocus
              placeholder="Назва колонки..."
              value={newColTitle}
              onChange={e => setNewColTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddColumnSubmit()
                if (e.key === 'Escape') setIsAddingCol(false)
              }}
            />
            <div className="tp-new-col-colors">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={newColColor === c ? 'active' : ''}
                  style={{ background: c }}
                  onClick={() => setNewColColor(c)}
                />
              ))}
            </div>
            <div className="tp-new-col-actions">
              <button className="tp-primary-sm" onClick={handleAddColumnSubmit}>Додати</button>
              <button className="tp-secondary-sm" onClick={() => setIsAddingCol(false)}><X size={14} /></button>
            </div>
          </div>
        ) : (
          <button className="tp-add-column-card" onClick={() => setIsAddingCol(true)}>
            <Plus size={22} />
            <span>Додати колонку</span>
          </button>
        )
      )}
    </main>
  )
}

export default TaskProjectsBoard
