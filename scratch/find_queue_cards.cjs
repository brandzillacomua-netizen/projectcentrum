const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('queueCards') || line.includes('const queueCards')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
