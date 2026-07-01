import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Patch ChecklistEditor JSX rendering of toggle checkbox and text
const targetCheckRender = `          <button type="button" className="check-toggle" onClick={() => onToggle && onToggle(item.id)}>
            {isChecked ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} color="#555" />}
          </button>
          <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
            {item.text}
          </span>`

const replacementCheckRender = `          <div 
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
          </div>`

// 2. Patch handleToggleCheckItem to prompt confirmation dialog
const targetToggleHandler = `  const handleToggleCheckItem = async (task, itemId) => {
    const checklist = Array.isArray(task.checklist) ? task.checklist : []
    const updated = toggleChecklistItem(checklist, itemId)
    await updateManagementTask(task.id, { checklist: updated })
    if (selectedTask?.id === task.id) setSelectedTask(prev => ({ ...prev, checklist: updated }))
  }`

const replacementToggleHandler = `  const handleToggleCheckItem = async (task, itemId) => {
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

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTargetCheck = targetCheckRender.replace(/\r?\n/g, '\n')
const normReplacementCheck = replacementCheckRender.replace(/\r?\n/g, '\n')
const normTargetToggle = targetToggleHandler.replace(/\r?\n/g, '\n')
const normReplacementToggle = replacementToggleHandler.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTargetCheck)) {
  patchedContent = patchedContent.replace(normTargetCheck, normReplacementCheck)
  console.log("Patched ChecklistEditor item click area.")
} else {
  console.error("Could not find ChecklistEditor item render target!")
}

if (patchedContent.includes(normTargetToggle)) {
  patchedContent = patchedContent.replace(normTargetToggle, normReplacementToggle)
  console.log("Patched handleToggleCheckItem with confirmation prompt.")
} else {
  console.error("Could not find handleToggleCheckItem function target!")
}

// 3. Add CSS hover effect for .check-click-area
const cssTarget = `.checklist-items { display: flex; flex-direction: column; gap: 6px; }`
const cssReplacement = `.checklist-items { display: flex; flex-direction: column; gap: 6px; }
        .check-click-area { transition: opacity 0.15s ease; }
        .check-click-area:hover { opacity: 0.85; }
        .check-click-area:active { opacity: 0.7; }`

const normCssTarget = cssTarget.replace(/\r?\n/g, '\n')
const normCssReplacement = cssReplacement.replace(/\r?\n/g, '\n')

if (patchedContent.includes(normCssTarget)) {
  patchedContent = patchedContent.replace(normCssTarget, normCssReplacement)
  console.log("Added CSS hover styles for check-click-area.")
} else {
  console.error("Could not find CSS target!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Kanban checklist patch complete.")
