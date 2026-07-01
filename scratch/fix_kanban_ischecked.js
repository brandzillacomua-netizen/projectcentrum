import fs from 'fs'
import { execSync } from 'child_process'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'

// Discard changes
execSync('git checkout -- a:/centrum/src/modules/KanbanModule.jsx')
console.log("Restored original KanbanModule.jsx from git.")

const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

// 1. Add confirmModal state
const targetStateIndex = lines.findIndex(line => line.includes("const [detailOpen, setDetailOpen] = useState(false)"))
lines.splice(targetStateIndex + 1, 0, "  const [confirmModal, setConfirmModal] = useState(null)")

// 2. Add collapsedItems, isEditing states to ChecklistEditor
const oldChecklistEditorDecl = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')`

const newChecklistEditorDecl = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')
  const [collapsedItems, setCollapsedItems] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const showEditControls = canEdit && isEditing`

// Let's replace ChecklistEditor declaration
let fileText = lines.join('\n')
fileText = fileText.replace(oldChecklistEditorDecl, newChecklistEditorDecl)

// Let's replace renderItem in ChecklistEditor:
// We want to replace the whole block of renderItem from:
//   const renderItem = (item, isChild = false) => {
//     const children = getChildren(item.id)
//     const hasChildren = children.length > 0
//     const isChecked = item.done
//     const isAddingSub = activeAddId === item.id
//
//     return (
//       <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
//         <div 
//           className={`checklist-item ${isChecked ? 'done' : ''}`}
//           style={isChild ? { marginLeft: '24px', borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: '12px', background: 'rgba(255,255,255,0.01)' } : {}}
//         >
//           <button type="button" className="check-toggle" onClick={() => onToggle && onToggle(item.id)}>
//             {isChecked ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} color="#555" />}
//           </button>
//           <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
//             {item.text}
//           </span>

const targetRenderBlock = `  const renderItem = (item, isChild = false) => {
    const children = getChildren(item.id)
    const hasChildren = children.length > 0
    const isChecked = item.done
    const isAddingSub = activeAddId === item.id

    return (
      <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          className={\`checklist-item \${isChecked ? 'done' : ''}\`}
          style={isChild ? { marginLeft: '24px', borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: '12px', background: 'rgba(255,255,255,0.01)' } : {}}
        >
          <button type="button" className="check-toggle" onClick={() => onToggle && onToggle(item.id)}>
            {isChecked ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} color="#555" />}
          </button>
          <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
            {item.text}
          </span>`

const replacementRenderBlock = `  const renderItem = (item, isChild = false) => {
    const children = getChildren(item.id)
    const hasChildren = children.length > 0
    const isChecked = hasChildren ? children.every(c => c.done) : item.done
    const isAddingSub = activeAddId === item.id
    const isCollapsed = !!collapsedItems[item.id]
    const toggleCollapse = (e) => {
      e.stopPropagation()
      setCollapsedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))
    }

    return (
      <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          className={\`checklist-item \${isChild ? 'child-item' : 'parent-item'} \${isChecked ? 'done' : ''}\`}
        >
          <div 
            onClick={() => {
              if (!hasChildren && onToggle) {
                onToggle(item.id)
              }
            }}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: hasChildren ? 'default' : 'pointer', flex: 1, minWidth: 0 }}
          >
            <button type="button" className="check-toggle" style={{ pointerEvents: 'none' }}>
              {isChecked ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="#555" />}
            </button>
            <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
              {item.text}
            </span>
            {hasChildren && !isChild && (
              <span className="subtasks-badge" style={{ fontSize: '0.62rem', color: '#ff9000', marginLeft: '8px', background: 'rgba(255,144,0,0.08)', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(255,144,0,0.15)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                містить {children.length} підзадач
              </span>
            )}
          </div>
          {hasChildren && !isChild && (
            <button 
              type="button" 
              onClick={toggleCollapse} 
              style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.1)', color: '#ff9000', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 800 }}
            >
              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              <span>{isCollapsed ? 'Розгорнути' : 'Згорнути'}</span>
            </button>
          )}`

if (fileText.includes(targetRenderBlock)) {
  fileText = fileText.replace(targetRenderBlock, replacementRenderBlock)
  console.log("Successfully replaced renderItem implementation block.")
} else {
  console.error("Could not find targetRenderBlock in KanbanModule.jsx!")
}

// Let's re-run the other patches as well
// 3. Update date/time picker rendering in renderItem to be read-only if not showEditControls
const oldDatePickerBlock = `            {/* Checklist item deadline picker */}
            {canEdit ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  value={item.deadline ? item.deadline.slice(0, 10) : ''}
                  onChange={(e) => {
                    const date = e.target.value
                    const time = item.deadline && item.deadline.length > 10 ? item.deadline.slice(11, 16) : ''
                    onUpdateDeadline && onUpdateDeadline(item.id, date ? (time ? \`\${date}T\${time}\` : date) : '')
                  }}
                  onClick={e => { try { e.target.showPicker() } catch(err){} }}
                  style={{
                    background: item.deadline ? 'rgba(255,144,0,0.06)' : 'rgba(255,255,255,0.02)',
                    border: item.deadline ? '1px solid rgba(255,144,0,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    color: item.deadline ? '#ff9000' : '#444',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    padding: '3px 5px',
                    width: '95px',
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                {item.deadline && (
                  <input
                    type="time"
                    value={item.deadline.length > 10 ? item.deadline.slice(11, 16) : ''}
                    onChange={(e) => {
                      const time = e.target.value
                      const date = item.deadline.slice(0, 10)
                      onUpdateDeadline && onUpdateDeadline(item.id, date ? (time ? \`\${date}T\${time}\` : date) : '')
                    }}
                    onClick={e => { try { e.target.showPicker() } catch(err){} }}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#bbb',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      padding: '3px 4px',
                      width: '60px',
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                )}
              </div>
            ) : (
              item.deadline && (
                <span style={{ fontSize: '0.68rem', color: '#ff9000', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,144,0,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,144,0,0.1)' }}>
                  <Calendar size={11} />
                  {(() => {
                    const d = new Date(item.deadline)
                    const options = { day: 'numeric', month: 'short' }
                    if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                      options.hour = '2-digit'
                      options.minute = '2-digit'
                    }
                    return d.toLocaleString('uk-UA', options)
                  })()}
                </span>
              )
            )}`

const newDatePickerBlock = `            {/* Checklist item deadline picker */}
            {showEditControls ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  value={item.deadline ? item.deadline.slice(0, 10) : ''}
                  onChange={(e) => {
                    const date = e.target.value
                    const time = item.deadline && item.deadline.length > 10 ? item.deadline.slice(11, 16) : ''
                    onUpdateDeadline && onUpdateDeadline(item.id, date ? (time ? \`\${date}T\${time}\` : date) : '')
                  }}
                  onClick={e => { try { e.target.showPicker() } catch(err){} }}
                  style={{
                    background: item.deadline ? 'rgba(255,144,0,0.06)' : 'rgba(255,255,255,0.02)',
                    border: item.deadline ? '1px solid rgba(255,144,0,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    color: item.deadline ? '#ff9000' : '#444',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    padding: '3px 5px',
                    width: '95px',
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                {item.deadline && (
                  <input
                    type="time"
                    value={item.deadline.length > 10 ? item.deadline.slice(11, 16) : ''}
                    onChange={(e) => {
                      const time = e.target.value
                      const date = item.deadline.slice(0, 10)
                      onUpdateDeadline && onUpdateDeadline(item.id, date ? (time ? \`\${date}T\${time}\` : date) : '')
                    }}
                    onClick={e => { try { e.target.showPicker() } catch(err){} }}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#bbb',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      padding: '3px 4px',
                      width: '60px',
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                )}
              </div>
            ) : (
              item.deadline && (
                <span style={{ fontSize: '0.68rem', color: '#ff9000', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,144,0,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,144,0,0.1)' }}>
                  <Calendar size={11} />
                  {(() => {
                    const d = new Date(item.deadline)
                    const options = { day: 'numeric', month: 'short' }
                    if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                      options.hour = '2-digit'
                      options.minute = '2-digit'
                    }
                    return d.toLocaleString('uk-UA', options)
                  })()}
                </span>
              )
            )}`

if (fileText.includes(oldDatePickerBlock)) {
  fileText = fileText.replace(oldDatePickerBlock, newDatePickerBlock)
  console.log("Replaced date picker block.")
} else {
  console.error("Failed to replace date picker block!")
}

// 4. Update parent items edit controls visibility (add subitem, remove item buttons)
const oldEditButtons = `            {canEdit && !isChild && (
              <button 
                type="button" 
                title="Додати підпункт" 
                onClick={() => {
                  setActiveAddId(item.id)
                  setSubText('')
                }}
                style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
              >
                <Plus size={14} />
                <span style={{ fontSize: '0.68rem', marginLeft: '2px' }}>підпункт</span>
              </button>
            )}
            {canEdit && (
              <button type="button" className="check-remove" onClick={() => onRemove(item.id)}>
                <X size={11}/>
              </button>
            )}`

const newEditButtons = `            {showEditControls && !isChild && (
              <button 
                type="button" 
                title="Додати підпункт" 
                onClick={() => {
                  setActiveAddId(item.id)
                  setSubText('')
                }}
                style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
              >
                <Plus size={14} />
                <span style={{ fontSize: '0.68rem', marginLeft: '2px' }}>підпункт</span>
              </button>
            )}
            {showEditControls && (
              <button type="button" className="check-remove" onClick={() => onRemove(item.id)}>
                <X size={11}/>
              </button>
            )}`

if (fileText.includes(oldEditButtons)) {
  fileText = fileText.replace(oldEditButtons, newEditButtons)
  console.log("Replaced item edit buttons.")
} else {
  console.error("Failed to replace item edit buttons!")
}

// 5. Update ChecklistEditor container render to include the "Edit checklist structure" button and control newItem visibility
const oldChecklistContainerRender = `  return (
    <div className="checklist-editor">
      {items.length > 0 && (
        <div className="checklist-progress-row">
          <div className="cl-track"><div className="cl-fill" style={{ width: \`\${checklistProgress(items)?.pct || 0}%\`, background: checklistProgress(items)?.pct === 100 ? '#10b981' : '#3b82f6' }} /></div>
          <span className="cl-pct">{checklistProgress(items)?.pct || 0}%</span>
        </div>
      )}
      <div className="checklist-items">
        {roots.map(root => renderItem(root, false))}
        {items.length === 0 && <div className="checklist-empty">Немає пунктів. {canEdit ? 'Додайте нижче.' : ''}</div>}
      </div>
      {canEdit && (
        <div className="add-check-row">
          <input
            type="text"
            placeholder="Новий пункт чеклисту..."
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          />
          <button type="button" className="add-check-btn" onClick={onAdd}><Plus size={14}/></button>
        </div>
      )}
    </div>
  )`

const newChecklistContainerRender = `  return (
    <div className="checklist-editor">
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            style={{
              background: isEditing ? '#ff9000' : 'rgba(255,255,255,0.05)',
              border: isEditing ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: isEditing ? '#000' : '#ff9000',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {isEditing ? '✓ Готово' : '⚙ Редагувати структуру'}
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="checklist-progress-row">
          <div className="cl-track"><div className="cl-fill" style={{ width: \`\${checklistProgress(items)?.pct || 0}%\`, background: checklistProgress(items)?.pct === 100 ? '#10b981' : '#3b82f6' }} /></div>
          <span className="cl-pct">{checklistProgress(items)?.pct || 0}%</span>
        </div>
      )}
      <div className="checklist-items">
        {roots.map(root => renderItem(root, false))}
        {items.length === 0 && <div className="checklist-empty">Немає пунктів. {showEditControls ? 'Додайте нижче.' : ''}</div>}
      </div>
      {showEditControls && (
        <div className="add-check-row">
          <input
            type="text"
            placeholder="Новий пункт чеклисту..."
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          />
          <button type="button" className="add-check-btn" onClick={onAdd}><Plus size={14}/></button>
        </div>
      )}
    </div>
  )`

if (fileText.includes(oldChecklistContainerRender)) {
  fileText = fileText.replace(oldChecklistContainerRender, newChecklistContainerRender)
  console.log("Replaced checklist container render.")
} else {
  console.error("Failed to replace checklist container render!")
}

// 6. Update canEdit mapping parameter in detail modal ChecklistEditor call
const oldDetailChecklistEditorCall = `                      canEdit={isManager}
                      onUpdateDeadline={async (itemId, dateStr) => {`

const newDetailChecklistEditorCall = `                      canEdit={isManager || selectedTask?.created_by === currentUser?.login}
                      onUpdateDeadline={async (itemId, dateStr) => {`

if (fileText.includes(oldDetailChecklistEditorCall)) {
  fileText = fileText.replace(oldDetailChecklistEditorCall, newDetailChecklistEditorCall)
  console.log("Replaced detail checklist editor call.")
} else {
  console.error("Failed to replace detail checklist editor call!")
}

// 7. Patch handleToggleCheckItem to use custom confirm modal state
const toggleHandlerIndex = fileText.indexOf('const handleToggleCheckItem = async (task, itemId) => {')
const fileLines = fileText.split('\n')
const toggleHandlerLineIdx = fileLines.findIndex(line => line.includes('const handleToggleCheckItem = async (task, itemId) => {'))

fileLines.splice(toggleHandlerLineIdx, 6, `  const handleToggleCheckItem = async (task, itemId) => {
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

// 8. Insert CSS style definitions
const cssTargetIndex = fileLines.findIndex(line => line.includes("checklist-items { display: flex; flex-direction: column; gap: 6px; }"))
fileLines.splice(cssTargetIndex + 1, 0, `        .check-click-area { transition: opacity 0.15s ease; }
        .check-click-area:hover { opacity: 0.85; }
        .check-click-area:active { opacity: 0.7; }
        .checklist-item.parent-item {
          background: #0d0d10 !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          border-left: 3px solid #ff9000 !important;
          border-radius: 12px !important;
          padding: 12px 16px !important;
          margin-top: 10px !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .checklist-item.child-item {
          background: transparent !important;
          border: none !important;
          border-left: 2px solid rgba(255, 144, 0, 0.25) !important;
          border-radius: 0 !important;
          padding: 6px 12px 6px 16px !important;
          margin-left: 28px !important;
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }
        .checklist-item.child-item:hover {
          background: rgba(255, 255, 255, 0.02) !important;
          border-left-color: #ff9000 !important;
        }
        .checklist-item.child-item .check-text {
          font-size: 0.8rem !important;
          color: #aaa;
        }
        .checklist-item.child-item.done .check-text {
          color: #555 !important;
        }`)

// 9. Insert responsive styles for mobile
const mediaQueryIndex = fileLines.findIndex(line => line.includes("detail-body { grid-template-columns: 1fr; }"))
fileLines.splice(mediaQueryIndex, 3, `          .detail-body { display: block !important; overflow-y: auto !important; height: auto !important; max-height: calc(95vh - 60px); }
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

// 10. Render Custom Confirm Modal (inserting inside the root JSX, before the styles block)
const stylesCommentIndex = fileLines.findIndex(line => line.includes('─── STYLES ───'))
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
fileLines.splice(stylesCommentIndex, 0, confirmModalHtml)

// Import ChevronDown/ChevronUp
const importIndex = fileLines.findIndex(line => line.includes("TrendingUp, Zap, Shield, Eye, EyeOff, Save, RotateCcw, Briefcase"))
fileLines.splice(importIndex + 1, 0, "  ChevronDown, ChevronUp,")

fs.writeFileSync(filePath, fileLines.join('\r\n'), 'utf8')
console.log("Successfully rebuilt everything cleanly without duplicate declarations!")
