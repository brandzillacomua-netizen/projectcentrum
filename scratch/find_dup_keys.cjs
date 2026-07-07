const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8');

// Find all matches of map or key
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('key=') || line.includes('key={')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
