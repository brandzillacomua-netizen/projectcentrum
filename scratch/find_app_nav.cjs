const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('header') || line.includes('navigation') || line.includes('Centrum') || line.includes('navbar')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
