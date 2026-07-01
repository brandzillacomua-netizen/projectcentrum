import fs from 'fs'

const filePath = 'a:/centrum/src/modules/KanbanModule.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Let's replace the media query in KanbanModule.jsx
const targetMediaQuery = `          .detail-body { grid-template-columns: 1fr; }
          .detail-side { border-right: none; border-bottom: 1px solid #111; }
          .detail-modal { max-height: 95vh; }
          .kb-filters { overflow-x: auto; }`

const replacementMediaQuery = `          .detail-body { display: block !important; overflow-y: auto !important; height: auto !important; max-height: calc(95vh - 60px); }
          .detail-side { border-right: none; border-bottom: 1px solid #111; overflow: visible !important; height: auto !important; }
          .detail-main { overflow: visible !important; height: auto !important; }
          .detail-modal { max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
          .kb-filters { overflow-x: auto; }
          
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
          }
`

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTarget = targetMediaQuery.replace(/\r?\n/g, '\n')
const normReplacement = replacementMediaQuery.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTarget)) {
  patchedContent = patchedContent.replace(normTarget, normReplacement)
  console.log("Successfully patched KanbanModule.jsx layout and checklist for mobile devices.")
} else {
  console.error("Could not find media query target block in KanbanModule.jsx!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Kanban module styles patch complete.")
