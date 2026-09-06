import React from 'react'
import { Plus, KanbanSquare } from 'lucide-react'
import { KanbanCard } from './KanbanCard'

export const KanbanColumn = ({
  column,
  activeMobileColumn,
  filteredTasks,
  filteredCompletedTasks,
  completedCount,
  hasActiveFilters,
  hasMoreCompleted,
  isFetchingCompleted,
  loadMoreCompleted,
  setCreateOpen,
  handleDragOver,
  handleDrop,
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
  const columnTasks = column.id === 'done' ? filteredCompletedTasks : filteredTasks.filter(t => t.status === column.id)
  const columnCount = column.id === 'done'
    ? (hasActiveFilters ? filteredCompletedTasks.length : completedCount)
    : columnTasks.length

  return (
    <div key={column.id} className={`kb-col ${activeMobileColumn === column.id ? 'mob-active' : ''}`}
      onDragOver={handleDragOver} onDrop={e => handleDrop(e, column.id)}>
      <div className="col-head" style={{ borderTopColor: column.color }}>
        <div className="col-head-left">
          <h3 style={{ color: column.color }}>{column.title}</h3>
          <span className="col-cnt" style={{ background: `${column.color}15`, color: column.color }}>{columnCount}</span>
        </div>
        {column.id === 'todo' && (
          <button className="col-add-btn" onClick={() => setCreateOpen(true)} title="Нова задача">
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="col-body">
        {columnTasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            systemUsers={systemUsers}
            departments={departments}
            canManageTask={canManageTask}
            canAdvance={canAdvance}
            isDirector={isDirector}
            isTaskRelevantToUser={isTaskRelevantToUser}
            currentUser={currentUser}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleOpenTask={handleOpenTask}
            handleOpenEdit={handleOpenEdit}
            handleDelete={handleDelete}
            updateManagementTask={updateManagementTask}
          />
        ))}
        {columnTasks.length === 0 && (
          <div className="col-empty">
            <KanbanSquare size={24} color="#1a1a1a" />
            <span>Порожньо</span>
          </div>
        )}
        {column.id === 'done' && hasMoreCompleted && (
          <button
            className="btn-ghost"
            style={{ width: '100%', marginTop: '10px', fontSize: '0.75rem', padding: '8px 12px' }}
            disabled={isFetchingCompleted}
            onClick={loadMoreCompleted}
          >
            {isFetchingCompleted ? 'Завантаження...' : 'Завантажити ще 20 виконаних'}
          </button>
        )}
      </div>
    </div>
  )
}
