const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/TumblingTerminal.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('style={{') || line.includes('<style') || line.includes('background:') || line.includes('color:')) {
    if (idx > 200 && idx < 300) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
