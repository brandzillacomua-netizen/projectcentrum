import fs from 'fs'
import { execSync } from 'child_process'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'

// Discard changes
execSync('git checkout -- a:/centrum/src/modules/KanbanModule.jsx')
console.log("Restored KanbanModule.jsx for fresh clean patch.")

let content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

// 1. Add confirmModal state
const targetStateIndex = lines.findIndex(line => line.includes("const [detailOpen, setDetailOpen] = useState(false)"))
lines.splice(targetStateIndex + 1, 0, "  const [confirmModal, setConfirmModal] = useState(null)")

// 2. Define ChecklistAssigneeSelector helper above ChecklistEditor
const selectorHelperCode = `// ─── ChecklistAssigneeSelector ───────────────────────────────────────────────
const ChecklistAssigneeSelector = ({ value, onSelect, systemUsers }) => {
  const [open, setOpen] = React.useState(false)
  const selectedUser = (systemUsers || []).find(u => u.login === value)
  
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button 
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '50%',
          width: '26px',
          height: '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          color: '#ff9000'
        }}
      >
        {selectedUser ? (
          <div 
            title={\`Відповідальний: \${selectedUser.last_name} \${selectedUser.first_name}\`}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#ff9000',
              color: '#000',
              fontSize: '0.6rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {getInitials(selectedUser)}
          </div>
        ) : (
          <User size={13} color="#555" title="Призначити відповідального" />
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute',
            bottom: '30px',
            right: 0,
            background: '#111',
            border: '1px solid #222',
            borderRadius: '10px',
            maxHeight: '180px',
            overflowY: 'auto',
            zIndex: 10001,
            width: '180px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <div 
              onClick={() => { onSelect(null); setOpen(false); }}
              style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#ff9000', cursor: 'pointer', borderBottom: '1px solid #222', fontWeight: 800 }}
            >
              Не призначено
            </div>
            {(systemUsers || []).map(u => (
              <div 
                key={u.login}
                onClick={() => { onSelect(u.login); setOpen(false); }}
                style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ff900015'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ff9000', color: '#000', fontSize: '0.55rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getInitials(u)}
                </div>
                <span>{u.last_name} {u.first_name[0]}.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
`

const checklistEditorDeclIndex = lines.findIndex(line => line.includes("const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline"))
lines.splice(checklistEditorDeclIndex, 0, selectorHelperCode)

// Recompile line index
const updatedLinesIndex = lines.findIndex(line => line.includes("const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline"))

// 3. Update ChecklistEditor signature to accept onUpdateAssignee and systemUsers
lines[updatedLinesIndex] = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline, onUpdateAssignee, systemUsers }) => {`
lines.splice(updatedLinesIndex + 1, 0, 
`  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')
  const [collapsedItems, setCollapsedItems] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const showEditControls = canEdit && isEditing`
)
// Delete old states
lines.splice(updatedLinesIndex + 6, 2)

// 4. Locate renderItem and replace the body to render the assignee badge and picker
const renderItemIndex = lines.findIndex(line => line.includes("const renderItem = (item, isChild = false) => {"))
const returnIndex = lines.findIndex((line, idx) => idx > renderItemIndex && line.includes("return ("))
const oldSpanEndIndex = lines.findIndex((line, idx) => idx > returnIndex && line.includes("</span>"))

// Let's replace the renderItem start block
const renderItemReplacement = `    const isCollapsed = !!collapsedItems[item.id]
    const toggleCollapse = (e) => {
      e.stopPropagation()
      setCollapsedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))
    }
    const isChecked = hasChildren ? children.every(c => c.done) : item.done
    const assigneeUser = (systemUsers || []).find(u => u.login === item.assignee)

    return (
      <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          className={\`checklist-item \${isChild ? 'child-item' : 'parent-item'} \${isChecked ? 'done' : ''}\`}
        >
          <div 
            onClick={(e) => {
              if (!hasChildren) {
                if (onToggle) onToggle(item.id)
              } else {
                toggleCollapse(e)
              }
            }}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
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

lines.splice(returnIndex, oldSpanEndIndex - returnIndex + 1, renderItemReplacement)

// Let's modify the picker and button section inside renderItem
const deadlinePickerIndex = lines.findIndex(line => line.includes("{/* Checklist item deadline picker */}"))
const closingParenthesisIndex = lines.findIndex((line, idx) => idx > deadlinePickerIndex && line.includes("            )}"))

// Let's replace the whole deadlinePicker and assignee picker inside renderItem
const newDatePickerBlock = `            {/* Checklist item deadline picker & assignee picker */}
            {showEditControls ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ChecklistAssigneeSelector 
                  value={item.assignee}
                  onSelect={(val) => onUpdateAssignee && onUpdateAssignee(item.id, val)}
                  systemUsers={systemUsers}
                />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {assigneeUser && (
                  <div 
                    title={\`Відповідальний: \${assigneeUser.last_name} \${assigneeUser.first_name}\`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#ff900018',
                      border: '1px solid rgba(255,144,0,0.3)',
                      color: '#ff9000',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'default'
                    }}
                  >
                    {getInitials(assigneeUser)}
                  </div>
                )}
                {item.deadline && (
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
                )}
              </div>
            )}`

lines.splice(deadlinePickerIndex, closingParenthesisIndex - deadlinePickerIndex + 1, newDatePickerBlock)

// Let's modify the add/remove controls inside renderItem
const editButtonsIndex = lines.findIndex(line => line.includes("{canEdit && !isChild && ("))
lines.splice(editButtonsIndex, 17, 
`            {showEditControls && !isChild && (
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
)

// Update inline subitem input rendering
const inlineSubitemIndex = lines.findIndex(line => line.includes("isAddingSub && ("))
lines.splice(inlineSubitemIndex, 1, `        {!isCollapsed && isAddingSub && (`)

// Update children list rendering
const childrenMapIndex = lines.findIndex(line => line.includes("children.map(child => renderItem(child, true))"))
lines.splice(childrenMapIndex, 1, `        {!isCollapsed && children.map(child => renderItem(child, true))}`)

// Update ChecklistEditor container to have Edit button and add-row control
const oldContainerIndex = lines.findIndex((line, index) => line.includes("return (") && lines[index + 1].includes('className="checklist-editor"'))

const newContainerRender = `  return (
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

// Replace ChecklistEditor container return block
// Find the exact line index for "return (" under ChecklistEditor
let editorReturnIdx = -1
for (let i = updatedLinesIndex; i < lines.length; i++) {
  if (lines[i].trim() === "return (" && lines[i+1].includes('className="checklist-editor"')) {
    editorReturnIdx = i
    break
  }
}
let editorEndIdx = -1
for (let i = editorReturnIdx; i < lines.length; i++) {
  if (lines[i].trim() === "}" && lines[i-1].trim() === ")") {
    editorEndIdx = i
    break
  }
}

console.log("editorReturnIdx:", editorReturnIdx, "editorEndIdx:", editorEndIdx)
lines.splice(editorReturnIdx, editorEndIdx - editorReturnIdx, newContainerRender)

// 5. Update ChecklistEditor call inside the detailModal view:
const detailCallIndex = lines.findIndex(line => line.includes("canEdit={isManager}"))
lines.splice(detailCallIndex, 1, 
`                      canEdit={isManager || selectedTask?.created_by === currentUser?.login}
                      systemUsers={systemUsers}
                      onUpdateAssignee={async (itemId, assigneeLogin) => {
                        const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).map(i =>
                          String(i.id) === String(itemId) ? { ...i, assignee: assigneeLogin || null } : i
                        )
                        await updateManagementTask(selectedTask.id, { checklist: updated })
                        setSelectedTask(prev => ({ ...prev, checklist: updated }))
                      }}`
)

// 6. Update ChecklistEditor call inside the createModal view:
const createCallIndex = lines.findIndex((line, index) => line.includes("canEdit={true}") && lines[index - 1].includes("removeCheckItemFromForm"))
lines.splice(createCallIndex, 1, 
`                  canEdit={true}
                  systemUsers={systemUsers}
                  onUpdateAssignee={(itemId, assigneeLogin) => {
                    setForm(f => ({
                      ...f,
                      checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignee: assigneeLogin || null } : i)
                    }))
                  }}`
)

// 7. Update ChecklistEditor call inside the editModal view:
const editCallIndex = lines.findIndex((line, index) => line.includes("canEdit={true}") && lines[index - 1].includes("removeCheckItemFromEdit"))
lines.splice(editCallIndex, 1, 
`                  canEdit={true}
                  systemUsers={systemUsers}
                  onUpdateAssignee={(itemId, assigneeLogin) => {
                    setEditForm(f => ({
                      ...f,
                      checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignee: assigneeLogin || null } : i)
                    }))
                  }}`
)

// 8. Patch handleToggleCheckItem to use custom confirm modal state
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

// 9. Insert CSS style definitions
const cssTargetIndex = lines.findIndex(line => line.includes("checklist-items { display: flex; flex-direction: column; gap: 6px; }"))
lines.splice(cssTargetIndex + 1, 0, 
`        .check-click-area { transition: opacity 0.15s ease; }
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

// 10. Insert responsive styles for mobile
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

// 11. Render Custom Confirm Modal (inserting inside the root JSX, before the styles block)
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

// Import ChevronDown/ChevronUp
const importIndex = lines.findIndex(line => line.includes("TrendingUp, Zap, Shield, Eye, EyeOff, Save, RotateCcw, Briefcase"))
lines.splice(importIndex + 1, 0, "  ChevronDown, ChevronUp,")

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8')
console.log("Checklist assignee selector rebuild success!")
