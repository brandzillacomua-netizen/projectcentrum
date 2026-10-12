import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');

// Find all rules in light.css that match a button in supply-module-v2
// or have [style*="..."]
const rules = css.match(/([^{}]+)\{([^{}]+)\}/g) || [];

console.log('Total CSS rules:', rules.length);

for (const rule of rules) {
  const parts = rule.split('{');
  const selector = parts[0].trim();
  const body = parts[1].trim();
  
  if (
    selector.includes('supply') && selector.includes('button') ||
    selector.includes('button') && (body.includes('background: #fff') || body.includes('background-color: #fff') || body.includes('var(--card-bg)'))
  ) {
    console.log(`MATCH: ${selector} ---> ${body.replace(/\s+/g, ' ')}`);
  }
}
