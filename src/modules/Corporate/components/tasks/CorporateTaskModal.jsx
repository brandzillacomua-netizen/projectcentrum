import React, { useState } from 'react'
import { X, Plus, Trash2, Calendar, User, CheckSquare } from 'lucide-react'
import { TASK_PRIORITIES } from '../../utils/corporateHelpers'

export function CorporateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  users = [],
  currentUser,
  initialData = null
}) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [assigneeId, setAssigneeId] = useState(initialData?.assignee_id || currentUser?.id || '')
  const [priority, setPriority] = useState(initialData?.priority || 'medium')
  const [deadline, setDeadline] = useState(initialData?.deadline ? initialData.deadline.slice(0, 16) : '')
  const [checklist, setChecklist] = useState(initialData?.checklist || [])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return
    setChecklist(prev => [...prev, { text: newChecklistText.trim(), completed: false }])
    setNewChecklistText('')
  }

  const handleRemoveChecklistItem = (idx) => {
    setChecklist(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !assigneeId) return

    try {
      setSubmitting(true)
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        assignee_id: assigneeId,
        creator_id: currentUser?.id,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        checklist,
        post_id: initialData?.post_id || null
      })
      onClose()
    } catch (err) {
      alert('Помилка збереження завдання: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="corp-modal-overlay" onClick={onClose}>
      <div className="corp-modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--ch-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--ch-accent-subtle)', color: 'var(--ch-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--ch-text-primary)' }}>
                {initialData?.post_id ? 'Створити завдання з обговорення' : 'Нове корпоративне завдання'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--ch-text-dim)', marginTop: '2px' }}>
                Постановка задачі та контроль виконання
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="corp-footer-action-btn"
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Назва завдання *
            </label>
            <input
              type="text"
              required
              className="corp-composer-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Наприклад: Провести ревізію залишків та інструментів..."
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Опис / Деталі
            </label>
            <textarea
              className="corp-composer-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Додаткові інструкції або вимоги..."
              rows={3}
            />
          </div>

          {/* Assignee & Priority Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Assignee */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Відповідальний *
              </label>
              <select
                required
                className="corp-select"
                style={{ width: '100%', padding: '9px 12px' }}
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
              >
                <option value="">Оберіть співробітника</option>
                {users.map(u => {
                  const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login
                  return (
                    <option key={u.id} value={u.id}>
                      {fullName} {u.position ? `(${u.position})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Пріоритет
              </label>
              <select
                className="corp-select"
                style={{ width: '100%', padding: '9px 12px' }}
                value={priority}
                onChange={e => setPriority(e.target.value)}
              >
                {Object.values(TASK_PRIORITIES).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Крайній термін (дедлайн)
            </label>
            <input
              type="datetime-local"
              className="corp-composer-title-input"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>

          {/* Checklist Builder */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Чек-лист підзавдань ({checklist.length})
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--ch-surface-inset)',
                    border: '1px solid var(--ch-border)',
                    borderRadius: '10px',
                    fontSize: '0.82rem'
                  }}
                >
                  <span style={{ color: 'var(--ch-text-primary)' }}>{idx + 1}. {item.text}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="corp-composer-title-input"
                style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                value={newChecklistText}
                onChange={e => setNewChecklistText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddChecklistItem()
                  }
                }}
                placeholder="Додати крок до чек-листа..."
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="corp-btn-subtle"
                style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}
              >
                + Додати
              </button>
            </div>
          </div>

          {/* Footer Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--ch-border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="corp-btn-subtle"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !assigneeId}
              className="corp-btn-primary"
            >
              {submitting ? 'Збереження...' : 'Створити завдання'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
