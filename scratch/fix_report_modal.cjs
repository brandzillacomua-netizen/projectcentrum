const fs = require('fs');
const babel = require('@babel/parser');

const filePath = 'a:/centrum/src/modules/Foreman/components/ForemanReportModal.jsx';
const code = fs.readFileSync(filePath, 'utf8');
const lines = code.split('\n');

console.log('Total file lines:', lines.length);

try {
  babel.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('RESTORED FILE PARSES 100% CLEANLY!');
} catch (err) {
  console.log('Restored file parse error:', err.message, 'at loc:', err.loc);
}
