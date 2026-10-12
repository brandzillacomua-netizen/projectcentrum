import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');
const lines = css.split('\n');

console.log('Total lines in light.css:', lines.length);

lines.forEach((line, idx) => {
  if (line.includes('button') || line.includes('btn') || line.includes('#10b981') || line.includes('0a0a0a') || line.includes('supply')) {
    if (line.includes('button') || line.includes('#10b981') || line.includes('supply')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
