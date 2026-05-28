import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. CSS print widths
const regexCss = /\/\*\s*COLUMN SIZING \(TOTAL: 190mm\)\s*\*\/[\s\S]*?\.print-table th:nth-child\(8\)[^\n]*/i;
const replacementCss = `/* COLUMN SIZING (TOTAL: 190mm) */
          .print-table th:nth-child(1), .print-table td:nth-child(1) { width: 90mm !important; text-align: left !important; }
          .print-table th:nth-child(2), .print-table td:nth-child(2) { display: none !important; }
          .print-table th:nth-child(3), .print-table td:nth-child(3) { display: none !important; }
          .print-table th:nth-child(4), .print-table td:nth-child(4) { display: none !important; }
          .print-table th:nth-child(5), .print-table td:nth-child(5) { width: 15mm !important; text-align: center !important; }
          .print-table th:nth-child(6), .print-table td:nth-child(6) { width: 45mm !important; text-align: left !important; }
          .print-table th:nth-child(7), .print-table td:nth-child(7) { width: 12mm !important; text-align: center !important; }
          .print-table th:nth-child(8), .print-table td:nth-child(8) { width: 14mm !important; text-align: center !important; }
          .print-table th:nth-child(9), .print-table td:nth-child(9) { width: 14mm !important; text-align: center !important; }`;

// 2. Responsive container
const targetContainer = `<div className="table-responsive-container" style={{ marginBottom: '35px' }}>`;
const replacementContainer = `<div className="table-responsive-container" style={{ marginBottom: '35px', overflowX: 'auto' }}>`;

// 3. Footer alignment
const targetFooter = `                        <tr>
                          <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.2rem', border: '1px solid #000' }} className="print-txt">
                            {totalNeed.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="print-txt">
                            {totalPlan.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="print-accent-g">
                            {totalSheets.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                        </tr>`;

const replacementFooter = `                        <tr>
                          <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.2rem', border: '1px solid #000' }} className="print-txt">
                            {totalNeed.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="print-txt">
                            {totalPlan.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="print-accent-g">
                            {totalSheets.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                        </tr>`;

// Normalize newlines
content = content.replace(/\r\n/g, '\n');
const normTargetFooter = targetFooter.replace(/\r\n/g, '\n');
const normReplacementFooter = replacementFooter.replace(/\r\n/g, '\n');

let success = true;

if (regexCss.test(content)) {
  content = content.replace(regexCss, replacementCss);
  console.log('1. CSS widths matched and replaced.');
} else {
  console.error('1. CSS widths FAILED to match.');
  success = false;
}

if (content.includes(targetContainer)) {
  content = content.replace(targetContainer, replacementContainer);
  console.log('2. Container matched and replaced.');
} else {
  console.error('2. Container FAILED to match.');
  success = false;
}

if (content.includes(normTargetFooter)) {
  content = content.replace(normTargetFooter, normReplacementFooter);
  console.log('3. Footer matched and replaced.');
} else {
  console.error('3. Footer FAILED to match.');
  success = false;
}

if (success) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('ALL UPDATES WRITTEN SUCCESSFULLY!');
} else {
  console.error('FAILED TO APPLY ALL UPDATES.');
}
