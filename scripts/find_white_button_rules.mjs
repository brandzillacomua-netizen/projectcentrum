import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');
const rules = css.match(/([^{}]+)\{([^{}]+)\}/g) || [];

for (const rule of rules) {
  const [sel, body] = rule.split('{');
  if (body.includes('#ffffff') || body.includes('white') || body.includes('#fff') || body.includes('var(--card-bg)')) {
    if (sel.includes('button') || sel.includes('btn') || sel.includes('requests')) {
      console.log(`RULE: ${sel.trim()} \n  BODY: ${body.trim()}\n`);
    }
  }
}
