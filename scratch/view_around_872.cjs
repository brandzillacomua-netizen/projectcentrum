const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/PackagingModule.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 870; i <= 950; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
