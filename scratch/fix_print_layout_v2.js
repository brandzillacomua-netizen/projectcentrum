import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Remove "БЕЗ КОДУ"
// Replace `{nom?.nomenclature_code || 'БЕЗ КОДУ'}` with `{nom?.nomenclature_code || ''}`
content = content.replace(/\{nom\?\.nomenclature_code\s*\|\|\s*'БЕЗ КОДУ'\}/g, "{nom?.nomenclature_code ? nom.nomenclature_code : ''}");
// Replace `{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}` with `{part.nom?.nomenclature_code || ''}`
content = content.replace(/\{part\.nom\?\.nomenclature_code\s*\|\|\s*'БЕЗ КОДУ'\}/g, "{part.nom?.nomenclature_code ? part.nom.nomenclature_code : ''}");

// 2. Fix the CSS styles
const regexFonts = /\.print-thr th \{[\s\S]*?\}\s*\.print-tr td, \.print-tr td div, \.print-tr td span \{[\s\S]*?\}\s*\.print-tf td, \.print-tf td div, \.print-tf td span \{[\s\S]*?\}/i;
const replacementFonts = `.print-thr th {
             padding: 4px 3px !important;
             font-size: 8pt !important;
             border: 1px solid #000 !important;
             background: #eee !important;
             text-transform: uppercase !important;
          }
          .print-tr td {
            padding: 3px 4px !important;
            border: 1px solid #000 !important;
            vertical-align: middle !important;
          }
          .print-tr td, .print-tr td div, .print-tr td span {
            font-size: 8.5pt !important;
            word-break: break-all !important;
            white-space: normal !important;
            line-height: 1.2 !important;
          }
          .print-tf td {
            padding: 6px 5px !important;
            border: 2px solid #000 !important;
            background: #eee !important;
          }
          .print-tf td, .print-tf td div, .print-tf td span {
            font-weight: bold !important;
            font-size: 9pt !important;
          }`;

if (regexFonts.test(content)) {
  content = content.replace(regexFonts, replacementFonts);
  console.log('Fonts styles matched and replaced.');
} else {
  console.error('Fonts styles FAILED to match.');
}

// 3. Let's modify the column sizing slightly to make Name a bit smaller if needed, and give more room to Material.
// Name: 42%, Plan: 8%, Material: 26%, QTY/SH: 8%, Sheets: 8%, BZ: 8%
const regexSizing = /\/\*\s*COLUMN SIZING \(TOTAL: 100\%\)\s*\*\/[\s\S]*?\.print-table th:nth-child\(9\)[^\n]*/i;
const replacementSizing = `/* COLUMN SIZING (TOTAL: 100%) */
          .print-table th:nth-child(1), .print-table td:nth-child(1) { width: 44% !important; text-align: left !important; }
          .print-table th:nth-child(2), .print-table td:nth-child(2) { display: none !important; }
          .print-table th:nth-child(3), .print-table td:nth-child(3) { display: none !important; }
          .print-table th:nth-child(4), .print-table td:nth-child(4) { display: none !important; }
          .print-table th:nth-child(5), .print-table td:nth-child(5) { width: 8% !important; text-align: center !important; }
          .print-table th:nth-child(6), .print-table td:nth-child(6) { width: 24% !important; text-align: left !important; }
          .print-table th:nth-child(7), .print-table td:nth-child(7) { width: 8% !important; text-align: center !important; }
          .print-table th:nth-child(8), .print-table td:nth-child(8) { width: 8% !important; text-align: center !important; }
          .print-table th:nth-child(9), .print-table td:nth-child(9) { width: 8% !important; text-align: center !important; }`;

if (regexSizing.test(content)) {
  content = content.replace(regexSizing, replacementSizing);
  console.log('Column sizing matched and replaced.');
} else {
  console.error('Column sizing FAILED to match.');
}

// 4. Change table width to 98% just to be safe with borders
const regexTableWidth = /width:\s*100%\s*!important\s*;/i;
if (regexTableWidth.test(content)) {
  content = content.replace(regexTableWidth, 'width: 98% !important;');
  console.log('Table width matched and replaced.');
}

// 5. Hide the empty div if nomenclature code is missing or we removed "БЕЗ КОДУ"
// Currently it is: <div ...>{nom?.nomenclature_code ? nom.nomenclature_code : ''}</div>
// If it evaluates to empty string, it will be an empty div, which is fine, but it has margin-top.
// Let's replace the div rendering to conditional.
const regexDiv1 = /<div style=\{\{ fontSize: '0\.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' \}\} className="print-subtxt">\{nom\?\.nomenclature_code \? nom\.nomenclature_code : ''\}<\/div>/g;
content = content.replace(regexDiv1, "{nom?.nomenclature_code && <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className=\"print-subtxt\">{nom.nomenclature_code}</div>}");

const regexDiv2 = /<div style=\{\{ fontSize: '0\.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' \}\} className="print-subtxt">\{part\.nom\?\.nomenclature_code \? part\.nom\.nomenclature_code : ''\}<\/div>/g;
content = content.replace(regexDiv2, "{part.nom?.nomenclature_code && <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className=\"print-subtxt\">{part.nom.nomenclature_code}</div>}");


fs.writeFileSync(filePath, content, 'utf8')
console.log('DONE')
