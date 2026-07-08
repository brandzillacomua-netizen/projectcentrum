const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/contexts/useProduction.js', 'utf8');
const lines = content.split('\n');
for (let i = 895; i <= 925; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
