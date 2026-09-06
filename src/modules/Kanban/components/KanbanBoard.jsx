import React from 'react'
import { COLUMNS } from '../utils/kanbanHelpers'
import { KanbanColumn } from './KanbanColumn'
import { KanbanSidebar } from './KanbanSidebar'

export const KanbanBoard = ({
  activeMobileColumn,
  filteredTasks,
  filteredCompletedTasks,
  completedCount,
  filterMode,
  selectedDeptFilter,
  searchQuery,
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
  updateManagementTask,
  isSidebarOpen,
  setIsSidebarOpen,
  setSelectedDeptFilter,
  managementTasks,
  companyStructure
}) => {
  const hasActiveFilters = filterMode !== 'all' || selectedDeptFilter !== 'all' || searchQuery

  return (
    <div className={`kb-body-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <main className="kb-board">
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            activeMobileColumn={activeMobileColumn}
            filteredTasks={filteredTasks}
            filteredCompletedTasks={filteredCompletedTasks}
            completedCount={completedCount}
            hasActiveFilters={hasActiveFilters}
            hasMoreCompleted={hasMoreCompleted}
            isFetchingCompleted={isFetchingCompleted}
            loadMoreCompleted={loadMoreCompleted}
            setCreateOpen={setCreateOpen}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
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
      </main>

      <KanbanSidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentUser={currentUser}
        departments={departments}
        selectedDeptFilter={selectedDeptFilter}
        setSelectedDeptFilter={setSelectedDeptFilter}
        managementTasks={managementTasks}
        systemUsers={systemUsers}
        companyStructure={companyStructure}
        isDirector={isDirector}
        isTaskRelevantToUser={isTaskRelevantToUser}
        handleOpenTask={handleOpenTask}
      />
    </div>
  )
}
