const fs = require('fs');

const file = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('ГОТОВО ДО ЗАКРИТТЯ') || line.includes('ready_to_close') || line.includes('status ===') || line.includes('statusBadge')) {
    if (line.includes('status') || line.includes('close') || line.includes('ЗАКРИТТЯ')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
