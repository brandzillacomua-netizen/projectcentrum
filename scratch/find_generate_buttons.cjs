const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/ForemanWorkplace.jsx', 'utf8');

const lines = content.split('\n');

console.log('Matches:');
lines.forEach((line, idx) => {
  if (line.includes('ГЕНЕРУВАТИ') || line.includes('генерувати') || line.includes('заброньовано') || line.includes('Заброньовано')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
