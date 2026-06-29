const fs = require('fs');

const file = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('isTaskReady') || line.includes('ready_to_close') || line.includes('готовий до закриття')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
