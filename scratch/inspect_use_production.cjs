const fs = require('fs');

const file = 'a:/centrum/src/contexts/useProduction.js';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('createDovyпускMaterialRequests') || line.includes('purchase_requests')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
