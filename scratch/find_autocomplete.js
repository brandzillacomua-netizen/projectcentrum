import fs from 'fs';

const content = fs.readFileSync('src/modules/EngineerModule.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('Rows(') || line.includes('handleAddRow') || line.includes('rows.map') || line.includes('Додати позицію')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
