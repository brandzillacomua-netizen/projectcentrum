const fs = require('fs');

const file = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (index >= 30 && index <= 55) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
