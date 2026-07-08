const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 1380; i > 0; i--) {
  const line = lines[i - 1];
  if (line.includes('const ') && line.includes('=') && line.includes('(')) {
    console.log(`Declaration at line ${i}: ${line.trim()}`);
    break;
  }
}
