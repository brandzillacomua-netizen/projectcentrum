const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/ForemanWorkplace.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 440; i <= 470; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
