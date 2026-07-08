const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('SYSTEM') || line.includes('КУЛИЦЯ') || line.includes('ДОСТУПНІ') || line.includes('Роман')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
