import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// The broken CSS starts at `@media print {` and ends before `      \`}} />`
const startStr = '@media print {'
const startIndex = content.indexOf(startStr)
const endStr = '`}} />'
const endIndex = content.indexOf(endStr, startIndex)

if (startIndex !== -1 && endIndex !== -1) {
    const screenCss = `          .print-table th { padding: 12px 15px; }
          .print-table td { padding: 18px 15px; }
`
    const cleanPrintCss = `@media print {
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          body * {
            visibility: hidden;
          }
          .worksheet-modal-overlay, .worksheet-modal-overlay * {
            visibility: hidden;
          }
          .print-only-target, .print-only-target * {
            visibility: visible !important;
          }
          .print-only-target {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            background: white !important;
            display: block !important;
            color: black !important;
          }
          .worksheet-panel {
            display: none !important;
          }
          /* Reset table layout strictly for this new table */
          .print-only-target table {
             width: 100% !important;
             max-width: 100% !important;
             border-collapse: collapse !important;
             table-layout: fixed !important;
          }
          .print-only-target th, .print-only-target td {
             word-wrap: break-word !important;
             overflow-wrap: break-word !important;
             word-break: break-all !important;
             white-space: normal !important;
             vertical-align: middle !important;
          }
        }
      `
      
    content = content.substring(0, startIndex) + screenCss + cleanPrintCss + content.substring(endIndex)
} else {
    console.error('Could not find CSS boundaries')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('DONE')
