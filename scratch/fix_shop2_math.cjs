const fs = require('fs');
const path = require('path');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacement = `const displayNeed = plannedNeed
                           const displayTotal = actualArrived
                           const displayBz = Math.max(0, actualArrived - displayNeed)`;

const regex = /const\s+displayNeed\s*=\s*plannedNeed[\r\n\s]+const\s+displayBz\s*=\s*Math\.max\(arrival\s*\?\s*\(Number\(arrival\.bz\)\s*\|\|\s*0\)\s*:\s*0,\s*totalArrived\s*>\s*plannedNeed\s*\?\s*totalArrived\s*-\s*plannedNeed\s*:\s*0\)[\r\n\s]+const\s+displayTotal\s*=\s*displayNeed\s*\+\s*displayBz/;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ File Shop2Module.jsx updated successfully!');
} else {
  console.log('❌ Pattern not found directly, showing surrounding content:');
  const idx = content.indexOf('const displayNeed = plannedNeed');
  if (idx !== -1) {
    console.log(content.substring(idx - 100, idx + 400));
  } else {
    console.log('"const displayNeed = plannedNeed" not found!');
  }
}
