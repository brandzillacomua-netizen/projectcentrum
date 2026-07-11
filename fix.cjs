const fs = require('fs');
let code = fs.readFileSync('src/modules/KanbanModule.jsx', 'utf8');

// Export helpers
code = code.replace('const genId =', 'export const genId =');
code = code.replace('const ColorPicker =', 'export const ColorPicker =');
code = code.replace('const MultiAssigneeSelector =', 'export const MultiAssigneeSelector =');
code = code.replace('const DeadlinePicker =', 'export const DeadlinePicker =');

// Extract styles
const styleRegex = /<style dangerouslySetInnerHTML=\{\{\s*__html:\s*([\s\S]*?)\s*\}\}\s*\/>/;
const match = code.match(styleRegex);
let stylesExtracted = '';
if (match) {
  stylesExtracted = match[0];
  code = code.replace(match[0], '<KanbanStyles />');
}

// Build KanbanStyles and KanbanTaskModal
const addedComponents = `

export const KanbanStyles = () => (
  ${stylesExtracted}
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
`;

code = code.replace('export default KanbanModule', addedComponents + '\n\nexport default KanbanModule');

fs.writeFileSync('src/modules/KanbanModule.jsx', code);
