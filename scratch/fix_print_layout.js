import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Let's find using a regex
const regex = /\/\*\s*COLUMN SIZING \(TOTAL: 190mm\)\s*\*\/[\s\S]*?\.print-table th:nth-child\(8\)[^\n]*/i;

const replacementCss = `/* COLUMN SIZING (TOTAL: 190mm) */
          .print-table th:nth-child(1), .print-table td:nth-child(1) { width: 90mm !important; text-align: left !important; }
          .print-table th:nth-child(2), .print-table td:nth-child(2) { display: none !important; }
          .print-table th:nth-child(3), .print-table td:nth-child(3) { display: none !important; }
          .print-table th:nth-child(4), .print-table td:nth-child(4) { display: none !important; }
          .print-table th:nth-child(5), .print-table td:nth-child(5) { width: 15mm !important; text-align: center !important; }
          .print-table th:nth-child(6), .print-table td:nth-child(6) { width: 45mm !important; text-align: left !important; }
          .print-table th:nth-child(7), .print-table td:nth-child(7) { width: 12mm !important; text-align: center !important; }
          .print-table th:nth-child(8), .print-table td:nth-child(8) { width: 14mm !important; text-align: center !important; }
          .print-table th:nth-child(9), .print-table td:nth-child(9) { width: 14mm !important; text-align: center !important; }`

if (regex.test(content)) {
  const updatedContent = content.replace(regex, replacementCss)
  fs.writeFileSync(filePath, updatedContent, 'utf8')
  console.log('SUCCESS: Column CSS styling updated successfully via regex!')
} else {
  console.error('ERROR: Could not match regex in file!')
}
