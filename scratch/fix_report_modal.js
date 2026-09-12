const fs = require('fs');
const babel = require('@babel/parser');

const filePath = 'a:/centrum/src/modules/Foreman/components/ForemanReportModal.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Locate <style>...</style>
const styleStart = code.indexOf('<style>');
const styleEnd = code.indexOf('</style>') + 8;
const styleContent = code.substring(styleStart, styleEnd);

// 2. Remove <style>...</style> and top-level fragment <>
code = code.replace('return (\n    <>\n' + styleContent + '\n', 'return (\n');

// 3. Insert styleContent immediately after <div ... className="report-modal-backdrop">
const backdropClassStr = 'className="report-modal-backdrop">';
const backdropIdx = code.indexOf(backdropClassStr);
if (backdropIdx !== -1) {
  const insertPos = backdropIdx + backdropClassStr.length;
  code = code.substring(0, insertPos) + '\n      ' + styleContent + code.substring(insertPos);
}

// 4. Remove </>\n  ) at the end
code = code.replace('    </>\n  )', '  )');

try {
  babel.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('PARSED SUCCESSFULLY WITH BABEL!');
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('FILE UPDATED!');
} catch (err) {
  console.error('Babel parser error:', err.message, err.loc);
}
