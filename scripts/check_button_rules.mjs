import { readFileSync } from 'fs';

const css = readFileSync('a:/centrum/src/light.css', 'utf-8');
const rules = css.match(/([^{}]+)\{([^{}]+)\}/g) || [];

for (const rule of rules) {
  const [sel, body] = rule.split('{');
  // Check if sel is a general button selector
  if (
    sel.includes('button') &&
    !sel.includes('header') &&
    !sel.includes('nav') &&
    !sel.includes('picker') &&
    !sel.includes('modal') &&
    !sel.includes('toggle') &&
    !sel.includes('drawer') &&
    !sel.includes('hamburger') &&
    !sel.includes('icon')
  ) {
    console.log(`BUTTON RULE: ${sel.trim()} \n  BODY: ${body.trim()}\n`);
  }
}
