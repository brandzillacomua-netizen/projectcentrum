const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/TumblingDashboard.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 275; i <= 305; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
