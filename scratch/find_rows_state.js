import fs from 'fs';

const content = fs.readFileSync('src/modules/EngineerModule.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('useState(') && (line.includes('rows') || line.includes('parentId'))) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
