import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');
const lines = css.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('button') && (line.includes('background') || line.includes('color'))) {
    console.log(`${i+1}: ${line}`);
  }
}
