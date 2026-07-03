const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/ForemanWorkplace.jsx', 'utf8').split('\n');
const line = content[2408]; // 2409 (0-indexed 2408)
console.log("Line 2409:", JSON.stringify(line));
console.log("Length:", line.length);
for (let i = 0; i < 100; i++) {
  console.log(`char ${i}: code ${line.charCodeAt(i)} (${JSON.stringify(line[i])})`);
}
