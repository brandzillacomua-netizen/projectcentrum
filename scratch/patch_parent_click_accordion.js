import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Locate check-click-area onClick target in KanbanModule.jsx
const targetClickArea = `          <div 
            onClick={() => {
              if (!hasChildren && onToggle) {
                onToggle(item.id)
              }
            }}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: hasChildren ? 'default' : 'pointer', flex: 1, minWidth: 0 }}
          >`

const replacementClickArea = `          <div 
            onClick={(e) => {
              if (!hasChildren) {
                if (onToggle) onToggle(item.id)
              } else {
                toggleCollapse(e)
              }
            }}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >`

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTarget = targetClickArea.replace(/\r?\n/g, '\n')
const normReplacement = replacementClickArea.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTarget)) {
  patchedContent = patchedContent.replace(normTarget, normReplacement)
  console.log("Successfully patched parent click area to trigger accordion collapse/expand.")
} else {
  console.error("Could not find check-click-area target block!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Parent click accordion migration complete.")
