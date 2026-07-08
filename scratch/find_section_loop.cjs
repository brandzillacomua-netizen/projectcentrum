const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/PackagingModule.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('title') && line.includes('icon')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
  if (line.includes('Object.entries') || line.includes('sections') || line.includes('.items')) {
    if (idx > 860 && idx < 1000) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
