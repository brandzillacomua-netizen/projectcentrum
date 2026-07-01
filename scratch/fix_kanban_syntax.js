import fs from 'fs'
import { execSync } from 'child_process'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'

// Discard changes to KanbanModule.jsx to start fresh
execSync('git checkout -- a:/centrum/src/modules/KanbanModule.jsx')
console.log("Restored original KanbanModule.jsx from git.")

const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

// 1. Add confirmModal state variable
const targetStateIndex = lines.findIndex(line => line.includes("const [detailOpen, setDetailOpen] = useState(false)"))
lines.splice(targetStateIndex + 1, 0, "  const [confirmModal, setConfirmModal] = useState(null)")

// 2. Patch ChecklistEditor item click area
const checkToggleIndex = lines.findIndex(line => line.includes('className="check-toggle"'))
// The block is:
//           <button type="button" className="check-toggle" onClick={() => onToggle && onToggle(item.id)}>
//             {isChecked ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} color="#555" />}
//           </button>
//           <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
//             {item.text}
//           </span>
lines.splice(checkToggleIndex - 1, 7, `          <div 
            onClick={() => onToggle && onToggle(item.id)}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <button type="button" className="check-toggle" style={{ pointerEvents: 'none' }}>
              {isChecked ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="#555" />}
            </button>
            <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
              {item.text}
            </span>
          </div>`)

// 3. Patch handleToggleCheckItem to use custom confirm modal state
const toggleHandlerIndex = lines.findIndex(line => line.includes('const handleToggleCheckItem = async (task, itemId) => {'))
lines.splice(toggleHandlerIndex, 6, `  const handleToggleCheckItem = async (task, itemId) => {
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
  }`)

// 4. Insert CSS style definitions
const cssTargetIndex = lines.findIndex(line => line.includes("checklist-items { display: flex; flex-direction: column; gap: 6px; }"))
lines.splice(cssTargetIndex + 1, 0, `        .check-click-area { transition: opacity 0.15s ease; }
        .check-click-area:hover { opacity: 0.85; }
        .check-click-area:active { opacity: 0.7; }`)

// 5. Insert responsive styles for mobile
const mediaQueryIndex = lines.findIndex(line => line.includes("detail-body { grid-template-columns: 1fr; }"))
lines.splice(mediaQueryIndex, 3, `          .detail-body { display: block !important; overflow-y: auto !important; height: auto !important; max-height: calc(95vh - 60px); }
          .detail-side { border-right: none; border-bottom: 1px solid #111; overflow: visible !important; height: auto !important; }
          .detail-main { overflow: visible !important; height: auto !important; }
          .detail-modal { max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
          
          /* Checklist Mobile Improvements */
          .checklist-item {
            flex-wrap: wrap !important;
            gap: 6px 10px !important;
            align-items: flex-start !important;
          }
          .checklist-item .check-text {
            flex: 1;
            min-width: 180px;
          }
          .checklist-item > div {
            width: 100% !important;
            margin-left: 0 !important;
            padding-left: 26px !important;
            justify-content: flex-start !important;
            gap: 12px !important;
            flex-wrap: wrap;
          }
          .checklist-item > div input[type="date"] {
            width: 110px !important;
          }
          .checklist-item > div input[type="time"] {
            width: 70px !important;
          }`)

// 6. Render Custom Confirm Modal (inserting inside the root JSX, before the styles block)
const stylesCommentIndex = lines.findIndex(line => line.includes('─── STYLES ───'))
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
lines.splice(stylesCommentIndex, 0, confirmModalHtml)

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8')
console.log("Kanban module syntax clean patch applied successfully!")
