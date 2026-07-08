const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/TumblingTerminal.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1190; i <= 1230; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
