import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add confirmModal state variable
content = content.replace(
  `const [detailOpen, setDetailOpen] = useState(false)`,
  `const [detailOpen, setDetailOpen] = useState(false)\n  const [confirmModal, setConfirmModal] = useState(null)`
)

// 2. Replace handleToggleCheckItem to use custom confirm modal state
const targetToggleHandler = `  const handleToggleCheckItem = async (task, itemId) => {
    const checklist = Array.isArray(task.checklist) ? task.checklist : []
    const item = checklist.find(i => String(i.id) === String(itemId))
    if (item) {
      const msg = item.done ? "Зняти відмітку про виконання для цього пункту?" : "Позначити цей пункт як виконаний?"
      if (!window.confirm(msg)) return
    }
    const updated = toggleChecklistItem(checklist, itemId)
    await updateManagementTask(task.id, { checklist: updated })
    if (selectedTask?.id === task.id) setSelectedTask(prev => ({ ...prev, checklist: updated }))
  }`

const replacementToggleHandler = `  const handleToggleCheckItem = async (task, itemId) => {
    const checklist = Array.isArray(task.checklist) ? task.checklist : []
    const item = checklist.find(i => String(i.id) === String(itemId))
    if (!item) return
    const msg = item.done ? "Зняти відмітку про виконання для цього пункту?" : "Позначити цей пункт як виконаний?"
    setConfirmModal({
      message: msg,
      onConfirm: async () => {
        const updated = toggleChecklistItem(checklist, itemId)
        await updateManagementTask(task.id, { checklist: updated })
        if (selectedTask?.id === task.id) setSelectedTask(prev => ({ ...prev, checklist: updated }))
      }
    })
  }`

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTargetToggle = targetToggleHandler.replace(/\r?\n/g, '\n')
const normReplacementToggle = replacementToggleHandler.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTargetToggle)) {
  patchedContent = patchedContent.replace(normTargetToggle, normReplacementToggle)
  console.log("Patched handleToggleCheckItem.")
} else {
  console.error("Could not find handleToggleCheckItem target!")
}

// 3. Render confirm modal inside KanbanModule (before the last styles block or before the final closing tag)
// Let's insert it before the closing </div> of the main return statement.
// The main return statement in KanbanModule starts with `return (` and ends with `</div>` before `/* ─── STYLES ─── */` or `// ─── STYLES ───`.
// Let's locate the end of return statement or just render it inside the return block.
// Let's see: the edit modal block is:
//       {editOpen && editForm && isManager && (
//          ...
//       )}
// Let's find `{editOpen && editForm && isManager && (` closing, and insert the confirm modal right after it.
const targetEditModalEnd = `      {editOpen && editForm && isManager && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal-box create-modal" onClick={e => e.stopPropagation()}>`

// Let's write a python or node line-matching routine to insert the confirm modal block before the styles tag
const styleTagLineIndex = patchedContent.indexOf('{/* ─── STYLES ─── */}') === -1 ? patchedContent.indexOf('// ─── STYLES ───') : patchedContent.indexOf('{/* ─── STYLES ─── */}')
const styleKeyIndex = patchedContent.indexOf('/* ─── STYLES ───') === -1 ? patchedContent.indexOf('// ─── STYLES ───') : patchedContent.indexOf('/* ─── STYLES ───')

console.log("styleKeyIndex:", styleKeyIndex)

const confirmModalHtml = `
      {/* ─── CONFIRMATION MODAL ─── */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 10050 }} onClick={() => setConfirmModal(null)}>
          <div className="modal-box" style={{ maxWidth: '400px', padding: '30px', textAlign: 'center', background: '#111', border: '1px solid #222', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 900, letterSpacing: '0.5px' }}>Підтвердження дії</h3>
            <p style={{ margin: '0 0 25px 0', fontSize: '0.85rem', color: '#aaa', lineHeight: '1.4' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button"
                onClick={() => setConfirmModal(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Скасувати
              </button>
              <button 
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(null)
                }}
                style={{ background: '#ff9000', border: 'none', color: '#000', padding: '10px 24px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
              >
                Підтвердити
              </button>
            </div>
          </div>
        </div>
      )}
`

if (styleKeyIndex !== -1) {
  // Let's insert the modal right before the styles tag block
  patchedContent = patchedContent.substring(0, styleKeyIndex) + confirmModalHtml + '\n' + patchedContent.substring(styleKeyIndex)
  console.log("Successfully inserted custom confirmation modal into JSX layout.")
} else {
  console.error("Could not find style section index to insert modal!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Kanban Custom Confirm Modal patch complete.")
