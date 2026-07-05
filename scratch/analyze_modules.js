import fs from 'fs';
import path from 'path';

const dir = 'a:/centrum/src/modules';

function countLines(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return fileContent.split('\n').length;
}

function scanDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  const results = [];

  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file !== 'Settings' && file !== 'Shop1' && file !== 'Master' && file !== 'Foreman') {
        results.push(...scanDir(fullPath));
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const lines = countLines(fullPath);
      results.push({ file: path.relative(dir, fullPath), lines });
    }
  }
  return results;
}

const allModules = scanDir(dir);
allModules.sort((a, b) => b.lines - a.lines);

console.log(JSON.stringify(allModules, null, 2));
