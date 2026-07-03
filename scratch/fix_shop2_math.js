const fs = require('fs');
const path = require('path');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `const displayNeed = plannedNeed\r\n                           const displayBz = Math.max(arrival ? (Number(arrival.bz) || 0) : 0, totalArrived > plannedNeed ? totalArrived - plannedNeed : 0)\r\n                           const displayTotal = displayNeed + displayBz`;
const targetLF = `const displayNeed = plannedNeed\n                           const displayBz = Math.max(arrival ? (Number(arrival.bz) || 0) : 0, totalArrived > plannedNeed ? totalArrived - plannedNeed : 0)\n                           const displayTotal = displayNeed + displayBz`;

const replacement = `const displayNeed = plannedNeed\n                           const displayTotal = actualArrived\n                           const displayBz = Math.max(0, actualArrived - displayNeed)`;

if (content.includes('displayBz = Math.max(arrival')) {
  // Replace dynamically via regex to ignore CRLF vs LF differences
  content = content.replace(
    /const\s+displayNeed\s*=\s*plannedNeed\s*[\r\n]+\s*const\s+displayBz\s*=\s*Math\.max\(arrival\s*\?\s*\(Number\(arrival\.bz\)\s*\|\|\s*0\)\s*:\s*0,\s*totalArrived\s*>\s*plannedNeed\s*\?\s*totalArrived\s*-\s*plannedNeed\s*:\s*0\)\s*[\r\n]+\s*const\s+displayTotal\s*=\s*displayNeed\s*\+\s*displayBz/,
    replacement
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ File Shop2Module.jsx updated successfully!');
} else {
  console.log('❌ Pattern not found directly, showing surrounding content:');
  const idx = content.indexOf('const displayNeed = plannedNeed');
  if (idx !== -1) {
    console.log(content.substring(idx, idx + 300));
  } else {
    console.log('"const displayNeed = plannedNeed" not found!');
  }
}
