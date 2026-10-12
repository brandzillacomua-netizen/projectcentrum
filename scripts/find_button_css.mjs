import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function findCssFiles(dir) {
  let files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(findCssFiles(full));
    } else if (item.name.endsWith('.css')) {
      files.push(full);
    }
  }
  return files;
}

const cssFiles = findCssFiles('a:/centrum/src');
for (const file of cssFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('button') && (l.includes('white') || l.includes('#fff') || l.includes('transparent') || l.includes('var(--card-bg)'))) {
      console.log(`${file}:${i+1} -> ${l.trim()}`);
    }
  });
}
