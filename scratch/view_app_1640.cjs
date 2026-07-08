const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1640; i <= 1660; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
