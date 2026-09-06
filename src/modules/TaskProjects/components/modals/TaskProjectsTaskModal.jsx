import React, { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { ChecklistEditor } from '../../../KanbanModule.jsx'
import { COLORS, taskId, userName } from '../../hooks/useTaskProjectsData.js'
import { Modal } from './TaskProjectsModal.jsx'
import TaskProjectsSearchPicker from './TaskProjectsSearchPicker.jsx'

export const TaskProjectsTaskModal = ({ form, setForm, users, editing, saving, onSubmit, onClose, project }) => {
  const [newItem, setNewItem] = useState('')
  const userOptions = users.map(u => ({ value: u.login, label: userName(u), meta: u.department || '' }))

  const addItem = (text, parentId = null) => {
    if (!text.trim()) return
    setForm(prev => ({ ...prev, checklist: [...prev.checklist, { id: taskId(), text: text.trim(), done: false, parent_id: parentId }] }))
  }

  const removeItem = id => setForm(prev => ({ ...prev, checklist: prev.checklist.filter(item => String(item.id) !== String(id) && String(item.parent_id) !== String(id)) }))
  const updateChecklistItem = (id, updates) => setForm(prev => ({ ...prev, checklist: prev.checklist.map(item => String(item.id) === String(id) ? { ...item, ...updates } : item) }))
  const toggleItem = id => {
    const item = form.checklist.find(entry => String(entry.id) === String(id))
    if (item) updateChecklistItem(id, { done: !item.done })
  }

  const titleText = editing
    ? (project ? `Редагувати задачу | ${project.name}` : 'Редагувати задачу')
    : (project ? `Нова задача | ${project.name}` : 'Нова задача')

  return (
    <Modal title={titleText} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="tp-form tp-task-form">
        <label>НАЗВА ЗАДАЧІ *<input required autoFocus placeholder="Коротко опишіть задачу…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>ДЕТАЛЬНИЙ ОПИС<textarea rows="3" placeholder="Що саме потрібно зробити…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <div className="tp-form-row">
          <label>ПРІОРИТЕТ<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="low">Низький</option><option value="medium">Середній</option><option value="high">Високий</option><option value="urgent">Нагально!</option></select></label>
          <label>ДЕДЛАЙН<input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label>
        </div>
        <div>
          <span className="tp-label">КОЛІР ПЛАШКИ</span>
          <div className="tp-colors">
            <button type="button" className={!form.color ? 'active auto-color' : 'auto-color'} onClick={() => setForm({ ...form, color: '' })}>Авто</button>
            {COLORS.map(c => <button type="button" key={c} className={form.color === c ? 'active' : ''} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />)}
          </div>
        </div>
        <TaskProjectsSearchPicker label="ВИКОНАВЦІ З КОМАНДИ ПРОЄКТУ" placeholder="Пошук за прізвищем…" options={userOptions} selected={form.assignees} onToggle={value => setForm(prev => ({ ...prev, assignees: prev.assignees.includes(value) ? prev.assignees.filter(v => v !== value) : [...prev.assignees, value] }))} />
        <div className="tp-check-builder">
          <span className="tp-label"><CheckSquare size={13} /> ЧЕКЛІСТ (ПУНКТИ)</span>
          <ChecklistEditor items={form.checklist} newItem={newItem} setNewItem={setNewItem} onAdd={() => { addItem(newItem); setNewItem('') }} onToggle={toggleItem} onAddSubItem={(parentId, text) => addItem(text, parentId)} onRemove={removeItem} canEdit={true} systemUsers={users} onUpdateAssignee={(itemId, assignees) => updateChecklistItem(itemId, { assignees, assignee: assignees[0] || null })} onUpdateDeadline={(itemId, deadline) => updateChecklistItem(itemId, { deadline: deadline || null })} />
        </div>
        <div className="tp-modal-actions">
          <button type="button" className="tp-secondary" onClick={onClose}>Скасувати</button>
          <button className="tp-primary" disabled={saving}>{saving ? 'Збереження…' : editing ? 'ЗБЕРЕГТИ' : 'СТВОРИТИ ЗАДАЧУ'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default TaskProjectsTaskModal
