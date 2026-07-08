const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/index.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('sidebar') || line.includes('link') || line.includes('portal')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
