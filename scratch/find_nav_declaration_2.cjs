const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 1380; i > 1200; i--) {
  const line = lines[i - 1];
  if (line.startsWith('const ') || line.startsWith('function ')) {
    console.log(`Line ${i}: ${line.trim()}`);
  }
}
