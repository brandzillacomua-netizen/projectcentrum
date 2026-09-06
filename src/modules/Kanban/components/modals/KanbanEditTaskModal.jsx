import React from 'react'
import { Edit3, X, Save, CheckSquare } from 'lucide-react'
import { DeadlinePicker } from '../KanbanDeadlinePicker'
import { ColorPicker } from '../KanbanColorPicker'
import { MultiAssigneeSelector } from '../KanbanAssigneeSelector'
import { ChecklistEditor } from '../KanbanChecklistEditor'
import { genId, toggleChecklistItem, COLUMNS } from '../../utils/kanbanHelpers'

export const KanbanEditTaskModal = ({
  editOpen,
  setEditOpen,
  editForm,
  setEditForm,
  editCheckItem,
  setEditCheckItem,
  isManager,
  isSubmitting,
  handleSaveEdit,
  systemUsers,
  departments
}) => {
  if (!editOpen || !editForm || !isManager) return null

  const addCheckItemToEdit = () => {
    if (!editCheckItem.trim()) return
    setEditForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text: editCheckItem.trim(), done: false }] }))
    setEditCheckItem('')
  }

  const removeCheckItemFromEdit = (id) => {
    setEditForm(f => ({ ...f, checklist: f.checklist.filter(i => String(i.id) !== String(id) && String(i.parent_id) !== String(id)) }))
  }

  return (
    <div className="modal-overlay" onClick={() => setEditOpen(false)}>
      <div className="modal-box create-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2><Edit3 size={16} /> Редагувати задачу</h2>
          <button className="icon-btn" onClick={() => setEditOpen(false)}><X size={18} /></button>
        </div>
        <form className="modal-form" onSubmit={handleSaveEdit}>
          <div className="form-group">
            <label>Назва задачі *</label>
            <input type="text" required value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Опис</label>
            <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Пріоритет</label>
              <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Низький</option>
                <option value="medium">Середній</option>
                <option value="high">Високий</option>
                <option value="urgent">НАГАЛЬНО!</option>
              </select>
            </div>
            <DeadlinePicker
              value={editForm.deadline}
              onChange={dl => setEditForm(f => ({ ...f, deadline: dl }))}
            />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Статус</label>
              <select value={editForm.status || 'todo'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          <ColorPicker value={editForm.color || ''} onChange={c => setEditForm(f => ({ ...f, color: c }))} />

          <div className="collective-toggle">
            <label className="toggle-wrap">
              <input type="checkbox" checked={editForm.is_collective} onChange={e => setEditForm(f => ({ ...f, is_collective: e.target.checked, assigned_to: e.target.checked ? '' : f.assigned_to }))} />
              <span className="toggle-slider"></span>
              <span>Колективна задача</span>
            </label>
          </div>

          {!editForm.is_collective ? (
            <MultiAssigneeSelector
              values={editForm.assignees || []}
              onAdd={login => setEditForm(f => ({ ...f, assignees: [...(f.assignees || []), login] }))}
              onRemove={login => setEditForm(f => ({ ...f, assignees: (f.assignees || []).filter(l => l !== login) }))}
              systemUsers={systemUsers}
            />
          ) : (
            <div className="form-group">
              <label>Відділ</label>
              <select value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          )}

          {/* Checklist editor */}
          <div className="form-group">
            <label><CheckSquare size={13} /> Чеклист</label>
            <ChecklistEditor
              items={editForm.checklist || []}
              newItem={editCheckItem}
              setNewItem={setEditCheckItem}
              onAdd={addCheckItemToEdit}
              onToggle={(itemId) => {
                setEditForm(f => ({ ...f, checklist: toggleChecklistItem(f.checklist, itemId) }))
              }}
              onAddSubItem={(parentId, text) => {
                setEditForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text, done: false, parent_id: parentId }] }))
              }}
              onRemove={removeCheckItemFromEdit}
              canEdit={true}
              systemUsers={systemUsers}
              onUpdateAssignee={(itemId, assignees) => {
                setEditForm(f => ({
                  ...f,
                  checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i)
                }))
              }}
              onUpdateDeadline={(itemId, dateStr) => {
                setEditForm(f => ({
                  ...f,
                  checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i)
                }))
              }}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)} disabled={isSubmitting}>Скасувати</button>
            <button type="submit" className="btn-primary-orange" disabled={isSubmitting}>
              {isSubmitting ? (
                <><span className="btn-spinner" />ЗБЕРЕЖЕННЯ...</>
              ) : <><Save size={14} /> ЗБЕРЕГТИ</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
