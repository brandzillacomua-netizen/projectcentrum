import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');
const rules = css.match(/([^{}]+)\{([^{}]+)\}/g) || [];

for (const rule of rules) {
  const [sel, body] = rule.split('{');
  // Check if sel matches a button element inside .light-theme
  // E.g. ".light-theme button" or "body.light-theme button" or button with attribute
  const s = sel.trim();
  if (s === '.light-theme button' || s === 'body.light-theme button' || s.endsWith(' button')) {
    console.log(`GLOBAL BUTTON SELECTOR: ${s} -> ${body.trim()}`);
  }
}
