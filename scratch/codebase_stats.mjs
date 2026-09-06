import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.gemini',
  '.vscode',
  'brain',
  '.system_generated'
]);

const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.sql', '.json']);

function countLinesInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    return lines;
  } catch (e) {
    return 0;
  }
}

function scanDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXTENSIONS.has(ext)) {
        const lines = countLinesInFile(fullPath);
        results.push({
          fullPath,
          relPath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
          ext,
          lines,
          size: fs.statSync(fullPath).size
        });
      }
    }
  }
  return results;
}

const allFiles = scanDir(rootDir);

// 1. By Extension
const extStats = {};
let totalLines = 0;
for (const f of allFiles) {
  totalLines += f.lines;
  if (!extStats[f.ext]) extStats[f.ext] = { count: 0, lines: 0 };
  extStats[f.ext].count++;
  extStats[f.ext].lines += f.lines;
}

// 2. Src breakdown by top-level folders
const folderStats = {};
for (const f of allFiles) {
  const parts = f.relPath.split('/');
  const topFolder = parts[0] === 'src' && parts.length > 1 ? `src/${parts[1]}` : parts[0];
  if (!folderStats[topFolder]) folderStats[topFolder] = { count: 0, lines: 0 };
  folderStats[topFolder].count++;
  folderStats[topFolder].lines += f.lines;
}

// 3. Module breakdown (src/modules)
const moduleStats = {};
for (const f of allFiles) {
  if (f.relPath.startsWith('src/modules/')) {
    const sub = f.relPath.replace('src/modules/', '');
    const parts = sub.split('/');
    let modName = parts[0];
    // if it's a file directly under src/modules, e.g. Shop1Terminal.jsx
    if (parts.length === 1) {
      modName = parts[0];
    }
    if (!moduleStats[modName]) moduleStats[modName] = { count: 0, lines: 0, files: [] };
    moduleStats[modName].count++;
    moduleStats[modName].lines += f.lines;
    moduleStats[modName].files.push({ path: f.relPath, lines: f.lines });
  }
}

// 4. Top 20 Largest files
const topLargest = [...allFiles].sort((a, b) => b.lines - a.lines).slice(0, 25);

console.log(JSON.stringify({
  totalFiles: allFiles.length,
  totalLines,
  extStats,
  folderStats,
  moduleStats,
  topLargest: topLargest.map(f => ({ path: f.relPath, lines: f.lines, sizeKb: (f.size / 1024).toFixed(1) }))
}, null, 2));
