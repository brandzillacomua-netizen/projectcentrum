import React from 'react'
import { Plus } from 'lucide-react'
import { useKanbanState } from './Kanban/hooks/useKanbanState'
import { KanbanNav } from './Kanban/components/KanbanNav'
import { KanbanStats } from './Kanban/components/KanbanStats'
import { KanbanMobileTabs } from './Kanban/components/KanbanMobileTabs'
import { KanbanBoard } from './Kanban/components/KanbanBoard'
import { KanbanStyles } from './Kanban/components/KanbanStyles'
import { KanbanCreateTaskModal } from './Kanban/components/modals/KanbanCreateTaskModal'
import { KanbanEditTaskModal } from './Kanban/components/modals/KanbanEditTaskModal'
import { KanbanTaskDetailModal } from './Kanban/components/modals/KanbanTaskDetailModal'
import { KanbanConfirmModal } from './Kanban/components/modals/KanbanConfirmModal'

// Re-exports for backwards compatibility (e.g. ChatModule)
export { KanbanTaskModal } from './Kanban/components/modals/KanbanTaskModal'
export { KanbanStyles } from './Kanban/components/KanbanStyles'
export { ColorPicker } from './Kanban/components/KanbanColorPicker'
export { MultiAssigneeSelector } from './Kanban/components/KanbanAssigneeSelector'
export { DeadlinePicker } from './Kanban/components/KanbanDeadlinePicker'
export { ChecklistEditor } from './Kanban/components/KanbanChecklistEditor'
export { genId } from './Kanban/utils/kanbanHelpers'

const KanbanModule = () => {
  const k = useKanbanState()

  return (
    <div className="kb-root">
      {/* ── TOP NAV ─────────────────────────────────────────────────────── */}
      <KanbanNav
        isDirector={k.isDirector}
        filterMode={k.filterMode}
        setFilterMode={k.setFilterMode}
        setStatsFilter={k.setStatsFilter}
        showSearch={k.showSearch}
        setShowSearch={k.setShowSearch}
        searchQuery={k.searchQuery}
        setSearchQuery={k.setSearchQuery}
      />

      {/* ── STATS TILES ───────────────────────────────────────────────── */}
      <KanbanStats
        stats={k.stats}
        statsFilter={k.statsFilter}
        setStatsFilter={k.setStatsFilter}
      />

      {/* ── MOBILE TABS ─────────────────────────────────────────────────── */}
      <KanbanMobileTabs
        activeMobileColumn={k.activeMobileColumn}
        setActiveMobileColumn={k.setActiveMobileColumn}
        filteredTasks={k.filteredTasks}
        filteredCompletedTasks={k.filteredCompletedTasks}
        completedCount={k.completedCount}
        filterMode={k.filterMode}
        selectedDeptFilter={k.selectedDeptFilter}
        searchQuery={k.searchQuery}
      />

      {/* ── MAIN BOARD & SIDEBAR ────────────────────────────────────────── */}
      <KanbanBoard
        activeMobileColumn={k.activeMobileColumn}
        filteredTasks={k.filteredTasks}
        filteredCompletedTasks={k.filteredCompletedTasks}
        completedCount={k.completedCount}
        filterMode={k.filterMode}
        selectedDeptFilter={k.selectedDeptFilter}
        searchQuery={k.searchQuery}
        hasMoreCompleted={k.hasMoreCompleted}
        isFetchingCompleted={k.isFetchingCompleted}
        loadMoreCompleted={k.loadMoreCompleted}
        setCreateOpen={k.setCreateOpen}
        handleDragOver={k.handleDragOver}
        handleDrop={k.handleDrop}
        systemUsers={k.systemUsers}
        departments={k.DEPARTMENTS}
        canManageTask={k.canManageTask}
        canAdvance={k.canAdvance}
        isDirector={k.isDirector}
        isTaskRelevantToUser={k.isTaskRelevantToUser}
        currentUser={k.currentUser}
        handleDragStart={k.handleDragStart}
        handleDragEnd={k.handleDragEnd}
        handleOpenTask={k.handleOpenTask}
        handleOpenEdit={k.handleOpenEdit}
        handleDelete={k.handleDelete}
        updateManagementTask={k.updateManagementTask}
        isSidebarOpen={k.isSidebarOpen}
        setIsSidebarOpen={k.setIsSidebarOpen}
        setSelectedDeptFilter={k.setSelectedDeptFilter}
        managementTasks={k.managementTasks}
        companyStructure={k.companyStructure}
      />

      {/* ── FLOATING ADD ACTION BUTTON ──────────────────────────────────── */}
      <button className="kb-floating-add-btn" onClick={() => k.setCreateOpen(true)} title="Створити нову задачу">
        <Plus size={24} />
      </button>

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      <KanbanTaskDetailModal
        detailOpen={k.detailOpen}
        setDetailOpen={k.setDetailOpen}
        selectedTask={k.selectedTask}
        setSelectedTask={k.setSelectedTask}
        detailTab={k.detailTab}
        setDetailTab={k.setDetailTab}
        canManageTask={k.canManageTask}
        canAdvance={k.canAdvance}
        handleOpenEdit={k.handleOpenEdit}
        handleDelete={k.handleDelete}
        handleStatusChange={k.handleStatusChange}
        parsedSelectedTask={k.parsedSelectedTask}
        handleToggleCheckItem={k.handleToggleCheckItem}
        newCheckItem={k.newCheckItem}
        setNewCheckItem={k.setNewCheckItem}
        updateManagementTask={k.updateManagementTask}
        isManager={k.isManager}
        currentUser={k.currentUser}
        systemUsers={k.systemUsers}
        commentText={k.commentText}
        setCommentText={k.setCommentText}
        handleAddComment={k.handleAddComment}
      />

      <KanbanCreateTaskModal
        createOpen={k.createOpen}
        setCreateOpen={k.setCreateOpen}
        form={k.form}
        setForm={k.setForm}
        newCheckItem={k.newCheckItem}
        setNewCheckItem={k.setNewCheckItem}
        isSubmitting={k.isSubmitting}
        handleCreateTask={k.handleCreateTask}
        systemUsers={k.systemUsers}
        departments={k.DEPARTMENTS}
      />

      <KanbanEditTaskModal
        editOpen={k.editOpen}
        setEditOpen={k.setEditOpen}
        editForm={k.editForm}
        setEditForm={k.setEditForm}
        editCheckItem={k.editCheckItem}
        setEditCheckItem={k.setEditCheckItem}
        isManager={k.isManager}
        isSubmitting={k.isSubmitting}
        handleSaveEdit={k.handleSaveEdit}
        systemUsers={k.systemUsers}
        departments={k.DEPARTMENTS}
      />

      <KanbanConfirmModal
        confirmModal={k.confirmModal}
        setConfirmModal={k.setConfirmModal}
      />

      {/* ── STYLES ──────────────────────────────────────────────────────── */}
      <KanbanStyles />
    </div>
  )
}

export default KanbanModule
