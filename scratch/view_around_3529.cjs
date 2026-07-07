const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 3520; i <= 3550; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
