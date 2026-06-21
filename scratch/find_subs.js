import fs from 'fs';

const content = fs.readFileSync('src/contexts/useData.js', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('postgres_changes') || line.includes('channel') || line.includes('subscribe')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
