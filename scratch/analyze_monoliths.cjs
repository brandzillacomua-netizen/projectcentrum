const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getFiles('src');
const stats = allFiles.map(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n').length;
  const rel = path.relative('src', f).replace(/\\/g, '/');
  return { rel, lines, size: content.length };
});

stats.sort((a,b) => b.lines - a.lines);

console.log('=== MONOLITHS (>= 1500 lines) ===');
stats.filter(s => s.lines >= 1500).forEach(s => console.log(`${s.lines.toString().padStart(6)} lines | ${s.rel}`));

console.log('\n=== HEAVY MODULES (1000 - 1499 lines) ===');
stats.filter(s => s.lines >= 1000 && s.lines < 1500).forEach(s => console.log(`${s.lines.toString().padStart(6)} lines | ${s.rel}`));

console.log('\n=== MEDIUM MODULES (500 - 999 lines) ===');
stats.filter(s => s.lines >= 500 && s.lines < 1000).forEach(s => console.log(`${s.lines.toString().padStart(6)} lines | ${s.rel}`));

console.log('\n=== DECOMPOSED / MODULAR FOLDERS ===');
const folderCounts = {};
stats.forEach(s => {
  const parts = s.rel.split('/');
  if (parts.length > 1) {
    const folder = parts.slice(0, -1).join('/');
    folderCounts[folder] = (folderCounts[folder] || 0) + 1;
  }
});
Object.entries(folderCounts).sort((a,b) => b[1] - a[1]).forEach(([folder, count]) => {
  console.log(`${folder.padEnd(35)} : ${count} modular files`);
});

const totalLines = stats.reduce((acc, s) => acc + s.lines, 0);
const monolithLines = stats.filter(s => s.lines >= 1000).reduce((acc, s) => acc + s.lines, 0);
const modularLines = totalLines - monolithLines;

console.log('\n=== SUMMARY METRICS ===');
console.log('Total JS/JSX Files:', stats.length);
console.log('Total Lines of Code:', totalLines);
console.log('Monolith Files (>=1000 lines):', stats.filter(s => s.lines >= 1000).length);
console.log('Lines in Monoliths (>=1000 lines):', monolithLines, `(${((monolithLines/totalLines)*100).toFixed(1)}%)`);
console.log('Modular Files (<1000 lines):', stats.filter(s => s.lines < 1000).length);
console.log('Lines in Modular Files:', modularLines, `(${((modularLines/totalLines)*100).toFixed(1)}%)`);
