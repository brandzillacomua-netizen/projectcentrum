const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 3750; i <= 3790; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
