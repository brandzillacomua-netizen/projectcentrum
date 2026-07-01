import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add ChevronDown, ChevronUp to the imports if they are not there
if (!content.includes('ChevronDown') && content.includes('lucide-react')) {
  // Let's find the lucide-react import line and append ChevronDown, ChevronUp
  content = content.replace(
    `import { ShieldCheck, LogIn, User, Lock, Loader2 } from 'lucide-react'`,
    `import { ShieldCheck, LogIn, User, Lock, Loader2, ChevronDown, ChevronUp } from 'lucide-react'`
  )
  content = content.replace(
    `import { Plus, X, Calendar, CheckSquare, Square, Users, AlertCircle, CheckSquare as CheckSquareIcon, KanbanSquare, Briefcase, TrendingUp, Edit3, Trash2, MessageSquare, Eye, Save } from 'lucide-react'`,
    `import { Plus, X, Calendar, CheckSquare, Square, Users, AlertCircle, CheckSquare as CheckSquareIcon, KanbanSquare, Briefcase, TrendingUp, Edit3, Trash2, MessageSquare, Eye, Save, ChevronDown, ChevronUp } from 'lucide-react'`
  )
  console.log("Imported ChevronDown and ChevronUp from lucide-react.")
}

// 2. Add collapsedItems state to ChecklistEditor and implement collapse toggle & children conditional rendering
const oldChecklistEditorDecl = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')`

const newChecklistEditorDecl = `const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')
  const [collapsedItems, setCollapsedItems] = useState({})`

// Normalize and replace
const normalizedContent = content.replace(/\r?\n/g, '\n')
let patchedContent = normalizedContent

if (patchedContent.includes(oldChecklistEditorDecl)) {
  patchedContent = patchedContent.replace(oldChecklistEditorDecl, newChecklistEditorDecl)
  console.log("Added collapsedItems state variable to ChecklistEditor.")
} else {
  console.error("Could not find ChecklistEditor declaration to insert state!")
}

// 3. Let's find renderItem implementation in ChecklistEditor
// Let's check renderItem JSX output and inject:
// - Chevron button
// - Subtasks count badge
// - Collapsible children block

const oldRenderItemReturn = `    return (
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
            </button>
            <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
              {item.text}
            </span>
          </div>`

const newRenderItemReturn = `    const isCollapsed = !!collapsedItems[item.id]
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

if (patchedContent.includes(oldRenderItemReturn)) {
  patchedContent = patchedContent.replace(oldRenderItemReturn, newRenderItemReturn)
  console.log("Patched renderItem return markup with collapse button and subtasks count badge.")
} else {
  console.error("Could not find oldRenderItemReturn block to replace!")
}

// 4. Update children rendering and inline subitem input to render conditionally based on !isCollapsed
const oldChildrenRendering = `        {/* Inline subitem input */}
        {isAddingSub && (`

const newChildrenRendering = `        {/* Inline subitem input */}
        {!isCollapsed && isAddingSub && (`

if (patchedContent.includes(oldChildrenRendering)) {
  patchedContent = patchedContent.replace(oldChildrenRendering, newChildrenRendering)
  console.log("Updated subitem input visibility check.")
} else {
  console.error("Could not find subitem input block!")
}

// Update the roots mapping render call for children
const oldRootsChildrenMap = `        {children.map(child => renderItem(child, true))}`
const newRootsChildrenMap = `        {!isCollapsed && children.map(child => renderItem(child, true))}`

if (patchedContent.includes(oldRootsChildrenMap)) {
  patchedContent = patchedContent.replace(oldRootsChildrenMap, newRootsChildrenMap)
  console.log("Updated children checklist render visibility check.")
} else {
  console.error("Could not find roots children map block!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Accordion patch complete.")
