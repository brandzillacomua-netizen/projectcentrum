const fs = require('fs');
const path = require('path');

const file = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('isRepair') || line.includes('genModal') || line.includes('довипущено') || line.includes('Нестача') || line.includes('нестача') || line.includes('ДОВИПУЩЕНО')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
