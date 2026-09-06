import React from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { COLORS, DEFAULT_COLUMNS, userName } from '../../hooks/useTaskProjectsData.js'
import TaskProjectsSearchPicker from './TaskProjectsSearchPicker.jsx'

export const Modal = ({ title, onClose, children }) => {
  return (
    <div className="tp-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="tp-modal">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

export const TaskProjectsModal = ({
  projectForm,
  setProjectForm,
  saveProject,
  saving,
  editingProject,
  systemUsers,
  companyStructure,
  onClose,
  onDelete
}) => {
  const toggle = (field, value) => setProjectForm(prev => ({
    ...prev,
    [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value]
  }))

  const cols = projectForm.columns || DEFAULT_COLUMNS

  return (
    <Modal title={editingProject ? 'Налаштування проєкту' : 'Новий проєкт'} onClose={onClose}>
      <form onSubmit={saveProject} className="tp-form">
        <label>Назва<input required autoFocus value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} /></label>
        <label>Опис<textarea rows="3" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} /></label>
        <div>
          <span className="tp-label">Колір проєкту</span>
          <div className="tp-colors">
            {COLORS.map(c => (
              <button
                type="button"
                key={c}
                className={projectForm.color === c ? 'active' : ''}
                style={{ background: c }}
                onClick={() => setProjectForm({ ...projectForm, color: c })}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="tp-label">СТОВПЦІ КАНБАН-ДОШКИ ({cols.length})</span>
            <button
              type="button"
              onClick={() => {
                const newColId = 'col_' + Date.now().toString(36)
                const nextColor = COLORS[cols.length % COLORS.length]
                setProjectForm(prev => ({
                  ...prev,
                  columns: [...(prev.columns || DEFAULT_COLUMNS), { id: newColId, title: 'НОВИЙ СТОВПЕЦЬ', color: nextColor }]
                }))
              }}
              style={{ background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={13} /> Додати стовпець
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {cols.map((col, index) => (
              <div key={col.id || index} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg, #111)', padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--glass-border, #222)' }}>
                <input
                  type="color"
                  value={col.color || '#3b82f6'}
                  onChange={e => {
                    const val = e.target.value
                    setProjectForm(prev => ({
                      ...prev,
                      columns: (prev.columns || DEFAULT_COLUMNS).map((c, i) => i === index ? { ...c, color: val } : c)
                    }))
                  }}
                  style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  title="Змінити колір стовпця"
                />
                <input
                  type="text"
                  value={col.title}
                  placeholder="Назва стовпця..."
                  onChange={e => {
                    const val = e.target.value
                    setProjectForm(prev => ({
                      ...prev,
                      columns: (prev.columns || DEFAULT_COLUMNS).map((c, i) => i === index ? { ...c, title: val } : c)
                    }))
                  }}
                  style={{ flex: 1, background: 'transparent', border: '1px solid #252525', padding: '5px 8px', borderRadius: '7px', fontSize: '0.78rem', color: '#fff', outline: 'none' }}
                />
                {index > 0 && (
                  <button
                    type="button"
                    title="Вліво"
                    onClick={() => {
                      setProjectForm(prev => {
                        const list = [...(prev.columns || DEFAULT_COLUMNS)]
                        const temp = list[index - 1]
                        list[index - 1] = list[index]
                        list[index] = temp
                        return { ...prev, columns: list }
                      })
                    }}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px 4px', fontSize: '0.9rem', fontWeight: 900 }}
                  >
                    ←
                  </button>
                )}
                {index < cols.length - 1 && (
                  <button
                    type="button"
                    title="Вправо"
                    onClick={() => {
                      setProjectForm(prev => {
                        const list = [...(prev.columns || DEFAULT_COLUMNS)]
                        const temp = list[index + 1]
                        list[index + 1] = list[index]
                        list[index] = temp
                        return { ...prev, columns: list }
                      })
                    }}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px 4px', fontSize: '0.9rem', fontWeight: 900 }}
                  >
                    →
                  </button>
                )}
                {cols.length > 1 && (
                  <button
                    type="button"
                    title="Видалити стовпець"
                    onClick={() => {
                      setProjectForm(prev => ({
                        ...prev,
                        columns: (prev.columns || DEFAULT_COLUMNS).filter((_, i) => i !== index)
                      }))
                    }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <TaskProjectsSearchPicker label="Додати відділи" placeholder="Почніть вводити назву відділу…" options={companyStructure.map(d => ({ value: String(d.id), label: d.name || d.label }))} selected={projectForm.department_ids} onToggle={value => toggle('department_ids', value)} />
        <TaskProjectsSearchPicker label="Додати окремих людей" placeholder="Введіть ім’я або прізвище…" options={systemUsers.map(u => ({ value: u.login, label: userName(u), meta: u.department || '' }))} selected={projectForm.member_logins} onToggle={value => toggle('member_logins', value)} />
        <div className="tp-modal-actions">
          {editingProject && onDelete && (
            <button type="button" className="tp-danger" onClick={onDelete}>
              <Trash2 size={15} /> Видалити
            </button>
          )}
          <button className="tp-primary" disabled={saving}>
            {saving ? 'Збереження…' : 'Зберегти проєкт'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default TaskProjectsModal
