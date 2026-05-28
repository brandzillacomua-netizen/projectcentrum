import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Remove inline padding from headers
content = content.replace(/padding:\s*'12px 15px',?\s*/g, '')

// 2. Remove inline padding from cells
content = content.replace(/padding:\s*'18px 15px',?\s*/g, '')

// 3. Remove huge font sizes from cells that might break print
// Let's replace inline font sizes with classes or just remove them and rely on CSS.
// But wait, the dark UI needs those font sizes!
// I will add a rule in @media print that forces all font-sizes inside the table to be small!
// Oh, I already have: .print-tr td, .print-tr td div, .print-tr td span { font-size: 8pt !important; }
// I will add * to be safe: .print-table * { font-size: 9pt !important; line-height: 1.1 !important; }

const printCssRegex = /@media print \{/
const injectPrintCss = `@media print {
          .print-table * {
            font-size: 9pt !important;
            line-height: 1.1 !important;
          }
          .print-table td, .print-table th {
            padding: 2px 4px !important;
          }
`
content = content.replace(printCssRegex, injectPrintCss)

// 4. For the UI, since I removed the inline padding, I need to add it back via CSS for screen ONLY!
// Let's find the closing tag of the <style dangerouslySetInnerHTML={{ __html: ` block and inject screen styles BEFORE @media print.
const screenCss = `
          .print-table th { padding: 12px 15px; }
          .print-table td { padding: 18px 15px; }
`
content = content.replace(/@media print \{/, screenCss + '\n        @media print {')

fs.writeFileSync(filePath, content, 'utf8')
console.log('DONE')
