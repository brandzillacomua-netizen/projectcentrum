import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const distAssets = 'a:/centrum/dist/assets';
const files = readdirSync(distAssets).filter(f => f.endsWith('.css'));

for (const f of files) {
  const content = readFileSync(join(distAssets, f), 'utf-8');
  // Search for anything matching button
  const matches = content.match(/[^{}]*button[^{}]*\{[^{}]*\}/gi) || [];
  console.log(`File ${f}: ${matches.length} button rules`);
  for (const m of matches) {
    if (m.includes('10b981') || m.includes('background') && (m.includes('fff') || m.includes('card-bg') || m.includes('white') || m.includes('supply'))) {
      console.log(`  MATCH: ${m.slice(0, 150)}`);
    }
  }
}
