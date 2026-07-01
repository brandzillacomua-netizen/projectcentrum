import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Normalize line endings
let patchedContent = content.replace(/\r?\n/g, '\n')

// 1. Update the state and controls in ChecklistEditor
const oldChecklistEditorDecl = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')
  const [collapsedItems, setCollapsedItems] = useState({})`

const newChecklistEditorDecl = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')
  const [collapsedItems, setCollapsedItems] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const showEditControls = canEdit && isEditing`

if (patchedContent.includes(oldChecklistEditorDecl)) {
  patchedContent = patchedContent.replace(oldChecklistEditorDecl, newChecklistEditorDecl)
  console.log("Replaced ChecklistEditor declaration.")
} else {
  console.error("Failed to replace ChecklistEditor declaration!")
}

// 2. Update renderItem inside ChecklistEditor to compute isChecked for parent and disable manual toggle
const oldRenderItemStart = `    const isCollapsed = !!collapsedItems[item.id]
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
            onClick={() => onToggle && onToggle(item.id)}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <button type="button" className="check-toggle" style={{ pointerEvents: 'none' }}>
              {isChecked ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="#555" />}
            </button>`

const newRenderItemStart = `    const isCollapsed = !!collapsedItems[item.id]
    const toggleCollapse = (e) => {
      e.stopPropagation()
      setCollapsedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))
    }
    const isChecked = hasChildren ? children.every(c => c.done) : item.done

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
            </button>`

if (patchedContent.includes(oldRenderItemStart)) {
  patchedContent = patchedContent.replace(oldRenderItemStart, newRenderItemStart)
  console.log("Replaced renderItem toggle logic.")
} else {
  console.error("Failed to replace renderItem toggle logic!")
}

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

if (patchedContent.includes(oldDatePickerBlock)) {
  patchedContent = patchedContent.replace(oldDatePickerBlock, newDatePickerBlock)
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

if (patchedContent.includes(oldEditButtons)) {
  patchedContent = patchedContent.replace(oldEditButtons, newEditButtons)
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

if (patchedContent.includes(oldChecklistContainerRender)) {
  patchedContent = patchedContent.replace(oldChecklistContainerRender, newChecklistContainerRender)
  console.log("Replaced checklist container render.")
} else {
  console.error("Failed to replace checklist container render!")
}

// 6. Update canEdit mapping parameter in detail modal ChecklistEditor call
const oldDetailChecklistEditorCall = `                      canEdit={isManager}
                      onUpdateDeadline={async (itemId, dateStr) => {`

const newDetailChecklistEditorCall = `                      canEdit={isManager || selectedTask?.created_by === currentUser?.login}
                      onUpdateDeadline={async (itemId, dateStr) => {`

if (patchedContent.includes(oldDetailChecklistEditorCall)) {
  patchedContent = patchedContent.replace(oldDetailChecklistEditorCall, newDetailChecklistEditorCall)
  console.log("Replaced detail checklist editor call.")
} else {
  console.error("Failed to replace detail checklist editor call!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Corrected patch execution completed successfully.")
