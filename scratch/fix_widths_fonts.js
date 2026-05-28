import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Let's replace the print table width and columns SIZING using regex
const regexSizing = /\/\*\s*COLUMN SIZING \(TOTAL: 190mm\)\s*\*\/[\s\S]*?\.print-table th:nth-child\(9\)[^\n]*/i;
const replacementSizing = `/* COLUMN SIZING (TOTAL: 100%) */
          .print-table th:nth-child(1), .print-table td:nth-child(1) { width: 45% !important; text-align: left !important; }
          .print-table th:nth-child(2), .print-table td:nth-child(2) { display: none !important; }
          .print-table th:nth-child(3), .print-table td:nth-child(3) { display: none !important; }
          .print-table th:nth-child(4), .print-table td:nth-child(4) { display: none !important; }
          .print-table th:nth-child(5), .print-table td:nth-child(5) { width: 8% !important; text-align: center !important; }
          .print-table th:nth-child(6), .print-table td:nth-child(6) { width: 23% !important; text-align: left !important; }
          .print-table th:nth-child(7), .print-table td:nth-child(7) { width: 8% !important; text-align: center !important; }
          .print-table th:nth-child(8), .print-table td:nth-child(8) { width: 8% !important; text-align: center !important; }
          .print-table th:nth-child(9), .print-table td:nth-child(9) { width: 8% !important; text-align: center !important; }`;

// Let's also adjust the font-size overrides in @media print
const regexFonts = /\.print-thr th \{[\s\S]*?\}\s*\.print-tr td \{[\s\S]*?\}\s*\.print-tf td \{[\s\S]*?\}/i;
const replacementFonts = `.print-thr th {
             padding: 4px 3px !important;
             font-size: 9pt !important;
             border: 1px solid #000 !important;
             background: #eee !important;
             text-transform: uppercase !important;
          }
          .print-tr td, .print-tr td div, .print-tr td span {
            padding: 3px 4px !important;
            border: 1px solid #000 !important;
            font-size: 9pt !important;
            vertical-align: middle !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            word-break: break-word !important;
          }
          .print-tf td, .print-tf td div, .print-tf td span {
            font-weight: bold !important;
            font-size: 9pt !important;
            padding: 6px 5px !important;
            border: 2px solid #000 !important;
            background: #eee !important;
          }`;

// Also change print-table default width to 100% instead of 190mm
const regexTableWidth = /width:\s*190mm\s*!important\s*;/i;

content = content.replace(/\r\n/g, '\n');

let success = true;

if (regexSizing.test(content)) {
  content = content.replace(regexSizing, replacementSizing);
  console.log('1. Column Sizing matched and replaced.');
} else {
  console.error('1. Column Sizing FAILED to match.');
  success = false;
}

if (regexFonts.test(content)) {
  content = content.replace(regexFonts, replacementFonts);
  console.log('2. Fonts styles matched and replaced.');
} else {
  console.error('2. Fonts styles FAILED to match.');
  success = false;
}

if (regexTableWidth.test(content)) {
  content = content.replace(regexTableWidth, 'width: 100% !important;');
  console.log('3. Table width matched and replaced.');
} else {
  console.error('3. Table width FAILED to match.');
  success = false;
}

if (success) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('ALL UPDATES WRITTEN SUCCESSFULLY!');
} else {
  console.error('FAILED TO APPLY ALL UPDATES.');
}
