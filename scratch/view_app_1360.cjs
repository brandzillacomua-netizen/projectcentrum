const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1360; i <= 1385; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
