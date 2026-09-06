import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.gemini', '.vscode', 'brain', '.system_generated']);
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.sql', '.json']);

function scan(dir) {
  let list = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) list = list.concat(scan(p));
    else if (ent.isFile() && EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
      const content = fs.readFileSync(p, 'utf-8');
      list.push({ rel: path.relative(rootDir, p).replace(/\\/g, '/'), lines: content.split('\n').length, ext: path.extname(ent.name) });
    }
  }
  return list;
}

const files = scan(rootDir);
const total = files.reduce((s, f) => s + f.lines, 0);

// Only in src/
const srcFiles = files.filter(f => f.rel.startsWith('src/'));
const srcTotal = srcFiles.reduce((s, f) => s + f.lines, 0);

// Group by modules in src/modules/
const moduleMap = {};
for (const f of srcFiles) {
  if (f.rel.startsWith('src/modules/')) {
    const sub = f.rel.replace('src/modules/', '');
    const mod = sub.split('/')[0];
    if (!moduleMap[mod]) moduleMap[mod] = { files: 0, lines: 0 };
    moduleMap[mod].files++;
    moduleMap[mod].lines += f.lines;
  }
}

// Group by top-level in src/
const srcSubMap = {};
for (const f of srcFiles) {
  const parts = f.rel.split('/');
  const sub = parts[1] || 'root';
  if (!srcSubMap[sub]) srcSubMap[sub] = { files: 0, lines: 0 };
  srcSubMap[sub].files++;
  srcSubMap[sub].lines += f.lines;
}

// By extension in src
const srcExtMap = {};
for (const f of srcFiles) {
  if (!srcExtMap[f.ext]) srcExtMap[f.ext] = { files: 0, lines: 0 };
  srcExtMap[f.ext].files++;
  srcExtMap[f.ext].lines += f.lines;
}

console.log('--- REPO TOTALS ---');
console.log('Total files:', files.length);
console.log('Total lines (all repo):', total);
console.log('\n--- SRC/ TOTALS ---');
console.log('Total src/ files:', srcFiles.length);
console.log('Total src/ lines:', srcTotal);
console.log('By Extension in src:', srcExtMap);
console.log('\n--- SRC SUBDIRECTORIES ---');
console.table(srcSubMap);
console.log('\n--- SRC/MODULES BREAKDOWN ---');
console.table(moduleMap);
