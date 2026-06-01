const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/ForemanWorkplace.jsx', 'utf8');

const lines = content.split('\n');

console.log('Matches:');
lines.forEach((line, idx) => {
  if (line.includes('ПОТРЕБА') || line.includes('СКЛАД БЗ') || line.includes('шт/л') || line.includes('ЛИСТІВ')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
