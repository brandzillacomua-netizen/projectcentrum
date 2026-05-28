import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add "no-print" to th
content = content.replace(
  /<th style=\{\{ padding: '12px 15px', width: '18%', textAlign: 'center', borderBottom: '1\.5px solid #222' \}\}>ВЕРСТАТ<\/th>/g,
  '<th className="no-print" style={{ padding: \'12px 15px\', width: \'18%\', textAlign: \'center\', borderBottom: \'1.5px solid #222\' }}>ВЕРСТАТ</th>'
)
content = content.replace(
  /<th style=\{\{ padding: '12px 15px', textAlign: 'center', width: '8%' \}\}>ПОТРЕБА<\/th>/g,
  '<th className="no-print" style={{ padding: \'12px 15px\', textAlign: \'center\', width: \'8%\' }}>ПОТРЕБА</th>'
)
content = content.replace(
  /<th style=\{\{ padding: '12px 15px', textAlign: 'center', width: '8%' \}\}>СКЛАД БЗ<\/th>/g,
  '<th className="no-print" style={{ padding: \'12px 15px\', textAlign: \'center\', width: \'8%\' }}>СКЛАД БЗ</th>'
)

// 2. Add "no-print" to td (we need to be careful with regex here, easier to find the exact lines)
// IsPrepOrder block:
content = content.replace(
  /<td style=\{\{ padding: '18px 15px', textAlign: 'center', fontSize: '0\.85rem', color: '#aaa', fontWeight: 800 \}\}>\s*PREP-TERM\s*<\/td>/g,
  '<td className="no-print" style={{ padding: \'18px 15px\', textAlign: \'center\', fontSize: \'0.85rem\', color: \'#aaa\', fontWeight: 800 }}>\n                              PREP-TERM\n                            </td>'
)
content = content.replace(
  /<td style=\{\{ padding: '18px 15px', textAlign: 'center', fontSize: '1\.1rem', color: '#fff', fontWeight: 900 \}\}>\s*\{thisNaryadQty\.toString\(\)\}\s*<\/td>/g,
  '<td className="no-print" style={{ padding: \'18px 15px\', textAlign: \'center\', fontSize: \'1.1rem\', color: \'#fff\', fontWeight: 900 }}>\n                              {thisNaryadQty.toString()}\n                            </td>'
)
content = content.replace(
  /<td style=\{\{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0\.85rem' \}\}>\s*—\s*<\/td>/g,
  '<td className="no-print" style={{ padding: \'18px 15px\', textAlign: \'center\', color: \'#555\', fontSize: \'0.85rem\' }}>\n                              —\n                            </td>'
)

// Normal block:
const normalTd2 = `                            <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                              {totalToProduce > 0 ? (
                                <>
                                  <div className="no-print">
                                    <select`
const replNormalTd2 = normalTd2.replace('<td style={{ padding:', '<td className="no-print" style={{ padding:')
content = content.replace(normalTd2, replNormalTd2)

const normalTd3 = `                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }}>
                              {totalNeeded}
                            </td>`
const replNormalTd3 = normalTd3.replace('<td style={{ padding:', '<td className="no-print" style={{ padding:')
content = content.replace(normalTd3, replNormalTd3)

const normalTd4 = `                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>
                              {inStock}
                            </td>`
const replNormalTd4 = normalTd4.replace('<td style={{ padding:', '<td className="no-print" style={{ padding:')
content = content.replace(normalTd4, replNormalTd4)

// Footer block:
// Empty td for VERSTAT, POTREBA, SKLAD BZ
content = content.replace(
  /<td><\/td>\s*<td style=\{\{ padding: '18px 15px', textAlign: 'center', fontSize: '1\.2rem', color: '#fff', fontWeight: 900 \}\}>\s*\{totals\.need\}\s*<\/td>\s*<td><\/td>/g,
  '<td className="no-print"></td>\n                        <td className="no-print" style={{ padding: \'18px 15px\', textAlign: \'center\', fontSize: \'1.2rem\', color: \'#fff\', fontWeight: 900 }}>\n                          {totals.need}\n                        </td>\n                        <td className="no-print"></td>'
)

// 3. Update the CSS Block
const cssRegex = /\/\*\s*FIXED WIDTH CONTAINER FOR A4\s*\*\/[\s\S]*?\/\*\s*COLUMN SIZING \(TOTAL: 100\%\)\s*\*\/[\s\S]*?\.print-table th:nth-child\(9\)[^\n]*/i
const newCss = `/* FIXED WIDTH CONTAINER FOR A4 */
          .print-target { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important;
            width: 210mm !important;
            box-sizing: border-box !important;
            background: #fff !important; 
            display: block !important;
            padding: 5mm !important;
            margin: 0 !important;
            z-index: 99999 !important;
            overflow: visible !important;
          }
          
          .worksheet-panel {
            background: #fff !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            height: auto !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .worksheet-header-area { 
            border-bottom: 2px solid #000 !important; 
            padding: 0 0 10px 0 !important;
            margin-bottom: 15px !important;
            width: 100% !important;
          }

          .doc-ti { 
            font-size: 2.2rem !important; 
            margin-bottom: 10px !important;
          }
          
          .print-info-box { 
            border: 2px solid #000 !important; 
            padding: 10px 15px !important;
            margin-bottom: 15px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          .print-prod-info {
            font-size: 1.4rem !important;
            text-decoration: underline !important;
          }
          
          .worksheet-scrollable, .table-responsive-container { 
            padding: 0 !important; 
            margin: 0 !important;
            overflow: visible !important; 
            width: 100% !important;
            display: block !important;
          }

          /* STRICT TABLE LAYOUT */
          .print-table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            box-sizing: border-box !important;
            border: 2px solid #000 !important;
            table-layout: fixed !important;
          }

          /* COLUMN SIZING (TOTAL: 100%) for ONLY VISIBLE columns in print */
          .print-table th:nth-child(1), .print-table td:nth-child(1) { width: 50% !important; text-align: left !important; }
          .print-table th:nth-child(5), .print-table td:nth-child(5) { width: 10% !important; text-align: center !important; }
          .print-table th:nth-child(6), .print-table td:nth-child(6) { width: 18% !important; text-align: left !important; }
          .print-table th:nth-child(7), .print-table td:nth-child(7) { width: 7% !important; text-align: center !important; }
          .print-table th:nth-child(8), .print-table td:nth-child(8) { width: 7% !important; text-align: center !important; }
          .print-table th:nth-child(9), .print-table td:nth-child(9) { width: 8% !important; text-align: center !important; }`

if (cssRegex.test(content)) {
  content = content.replace(cssRegex, newCss)
  console.log('CSS block replaced successfully.')
} else {
  console.log('FAILED to match CSS block.')
}

// 4. Force text wrap by adding hyphens auto for print text
const fontCssRegex = /\.print-tr td, \.print-tr td div, \.print-tr td span \{[\s\S]*?\}/i
const newFontCss = `.print-tr td, .print-tr td div, .print-tr td span {
            font-size: 8pt !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-all !important;
            white-space: normal !important;
            line-height: 1.2 !important;
          }`
if (fontCssRegex.test(content)) {
  content = content.replace(fontCssRegex, newFontCss)
  console.log('Font CSS replaced successfully.')
} else {
  console.log('FAILED to match Font CSS block.')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('DONE')
