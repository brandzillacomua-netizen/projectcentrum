import fs from 'fs';

const content = fs.readFileSync('src/modules/EngineerModule.jsx', 'utf8');
const lines = content.split('\n');

const queries = ['КРОК 1', 'Зберегти специфікацію', 'опис', 'description', 'search'];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const q of queries) {
    if (line.toLowerCase().includes(q.toLowerCase())) {
      console.log(`Line ${i + 1} (${q}): ${line.trim()}`);
    }
  }
}
