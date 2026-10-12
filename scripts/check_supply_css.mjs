import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');
const lines = css.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('supply-module-v2') || lines[i].includes('requests-col')) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
