const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/PackagingModule.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('ДЕТАЛІ / ГОТОВІ ВИРОБИ') || line.includes('boxNumber') || line.includes('BOMRequiredList')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
