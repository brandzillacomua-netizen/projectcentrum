import fs from 'fs';

const content = fs.readFileSync('src/modules/EngineerModule.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('loading') || line.includes('Spinner') || line.includes('Loader') || line.includes('Fetch')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
