import fs from 'fs';

const content = fs.readFileSync('a:/centrum/src/modules/ForemanWorkplace.jsx', 'utf8');
const lines = content.split('\n');

console.log("Lines containing 'isDrawerOpen' or 'Черга' or 'burger-btn':");
lines.forEach((line, index) => {
  if (line.includes('isDrawerOpen') || line.includes('Черга') || line.includes('burger-btn') || line.includes('Архів') || line.includes('relevantTasks')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
