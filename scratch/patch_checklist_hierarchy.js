import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Update checklist-item class name in renderItem
const targetItemDiv = `        <div 
          className={\`checklist-item \${isChecked ? 'done' : ''}\`}
          style={isChild ? { marginLeft: '24px', borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: '12px', background: 'rgba(255,255,255,0.01)' } : {}}
        >`

const replacementItemDiv = `        <div 
          className={\`checklist-item \${isChild ? 'child-item' : 'parent-item'} \${isChecked ? 'done' : ''}\`}
        >`

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTarget = targetItemDiv.replace(/\r?\n/g, '\n')
const normReplacement = replacementItemDiv.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTarget)) {
  patchedContent = patchedContent.replace(normTarget, normReplacement)
  console.log("Updated checklist-item class name binding.")
} else {
  console.error("Could not find the checklist-item div target block!")
}

// 2. Add style definitions for parent-item and child-item in CSS section
const cssTarget = `        .checklist-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #090909; border: 1px solid #141414; border-radius: 9px; transition: all 0.2s; }`

const cssReplacement = `        .checklist-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #090909; border: 1px solid #141414; border-radius: 9px; transition: all 0.2s; }
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
        }`

const normCssTarget = cssTarget.replace(/\r?\n/g, '\n')
const normCssReplacement = cssReplacement.replace(/\r?\n/g, '\n')

if (patchedContent.includes(normCssTarget)) {
  patchedContent = patchedContent.replace(normCssTarget, normCssReplacement)
  console.log("Successfully injected parent/child checklist styling rules.")
} else {
  console.error("Could not find checklist-item css target!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Migration complete.")
