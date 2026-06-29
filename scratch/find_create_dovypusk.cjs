const fs = require('fs');

const file = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('createDovyпускMaterialRequests') || line.includes('createDovypuskMaterialRequests')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
