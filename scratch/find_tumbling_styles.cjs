const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/TumblingTerminal.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('<style') || line.includes('dangerouslySetInnerHTML')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
