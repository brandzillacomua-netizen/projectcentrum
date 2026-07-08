const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/Shop2Terminal.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('isDrawerOpen') || line.includes('drawer-header')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
