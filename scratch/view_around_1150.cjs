const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/PackagingModule.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1120; i <= 1210; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
