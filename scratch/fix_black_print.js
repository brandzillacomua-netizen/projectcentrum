import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Let's replace the broken @media print css with a bulletproof one.

const startStr = '@media print {'
const startIndex = content.indexOf(startStr)
const endStr = '`}} />'
const endIndex = content.indexOf(endStr, startIndex)

if (startIndex !== -1 && endIndex !== -1) {
    const cleanPrintCss = `@media print {
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          html, body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Hide EVERYTHING in the body except the overlay */
          body > * {
            display: none !important;
          }
          
          /* But we need the root app to render the modal */
          #root {
            display: block !important;
          }
          
          /* Hide all immediate children of root, but not the modal portal if it's there */
          /* Actually, the modal is rendered inside the normal React tree here */
          .worksheet-panel {
            display: none !important;
          }

          .worksheet-modal-overlay {
             position: absolute !important;
             background: #fff !important;
             display: block !important;
             inset: 0 !important;
             padding: 0 !important;
             margin: 0 !important;
             align-items: flex-start !important;
             justify-content: flex-start !important;
          }

          .print-only-target {
            position: relative !important;
            width: 100% !important;
            max-width: 210mm !important;
            background: #fff !important;
            display: block !important;
            color: #000 !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
          }

          .print-only-target * {
            color: #000 !important;
          }

          .print-only-target table {
             width: 100% !important;
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
          
          /* Force all other overlays/notifications to hide */
          .Toastify { display: none !important; }
        }
      `
      
    content = content.substring(0, startIndex) + cleanPrintCss + content.substring(endIndex)
} else {
    console.error('Could not find CSS boundaries')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('DONE')
