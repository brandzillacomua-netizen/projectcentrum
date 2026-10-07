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



export const KanbanStyles = () => (
  
)

export const KanbanTaskModal = ({ initialAssignee, onClose, onCreated }) => {
  const { currentUser, systemUsers, addManagementTask } = useMES()
  const blankForm = { title: '', description: '', priority: 'medium', color: '', assigned_to: initialAssignee || '', assignees: initialAssignee ? [initialAssignee] : [], is_collective: false, department: 'all', deadline: '', checklist: [] }
  const [form, setForm] = React.useState(blankForm)
  const [newCheckItem, setNewCheckItem] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        color: form.color || '',
        assignees: form.assignees || [],
        assigned_to: (form.assignees || [])[0] || form.assigned_to || '',
        status: 'todo'
      }
      const { data, error } = await addManagementTask(payload)
      if (!error && onCreated) onCreated(data)
      onClose()
    } catch {
      setIsSubmitting(false)
    }
  }

  const addCheckItemToForm = () => {
    if (!newCheckItem.trim()) return
    setForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text: newCheckItem.trim(), done: false }] }))
    setNewCheckItem('')
  }
  
  const removeCheckItemFromForm = (id) => {
    setForm(f => ({ ...f, checklist: f.checklist.filter(i => String(i.id) !== String(id) && String(i.parent_id) !== String(id)) }))
  }

  return (
    <>
      <KanbanStyles />
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box create-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h2><Plus size={18} /> Нова задача</h2>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
          <form className="modal-form" onSubmit={handleCreateTask}>
            <div className="form-group">
              <label>Назва задачі *</label>
              <input type="text" required placeholder="Коротко опишіть задачу..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Детальний опис</label>
              <textarea rows={3} placeholder="Що саме потрібно зробити..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label>Пріоритет</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Низький</option>
                  <option value="medium">Середній</option>
                  <option value="high">Високий</option>
                  <option value="urgent">НАГАЛЬНО!</option>
                </select>
              </div>
              <DeadlinePicker value={form.deadline} onChange={dl => setForm(f => ({ ...f, deadline: dl }))} />
            </div>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
            <div className="collective-toggle">
              <label className="toggle-wrap">
                <input type="checkbox" checked={form.is_collective} onChange={e => setForm(f => ({ ...f, is_collective: e.target.checked, assigned_to: e.target.checked ? '' : f.assigned_to }))} />
                <span className="toggle-slider"></span>
                <span>Колективна задача (для відділу)</span>
              </label>
            </div>
            {!form.is_collective ? (
              <MultiAssigneeSelector values={form.assignees || []} onAdd={login => setForm(f => ({ ...f, assignees: [...(f.assignees || []), login] }))} onRemove={login => setForm(f => ({ ...f, assignees: (f.assignees || []).filter(l => l !== login) }))} systemUsers={systemUsers} />
            ) : (
              <div className="form-group">
                <label>Відділ</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label><CheckSquare size={13} /> Чеклист (пункти)</label>
              <ChecklistEditor items={form.checklist || []} newItem={newCheckItem} setNewItem={setNewCheckItem} onAdd={addCheckItemToForm} onAddSubItem={(parentId, text) => { setForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text, done: false, parent_id: parentId }] })) }} onRemove={removeCheckItemFromForm} canEdit={true} systemUsers={systemUsers} onUpdateAssignee={(itemId, assignees) => { setForm(f => ({ ...f, checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i) })) }} onUpdateDeadline={(itemId, dateStr) => { setForm(f => ({ ...f, checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i) })) }} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={isSubmitting}>Скасувати</button>
              <button type="submit" className="btn-primary-orange" disabled={isSubmitting}> {isSubmitting ? <><span className="btn-spinner" />СТВОРЕННЯ...</> : 'СТВОРИТИ ЗАДАЧУ'} </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}


export default KanbanModule
