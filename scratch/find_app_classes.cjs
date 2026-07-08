const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');
const classNames = new Set();
for (let i = 1400; i <= 1800; i++) {
  const match = lines[i - 1].match(/className="([^"]+)"/g);
  if (match) {
    match.forEach(m => classNames.add(m));
  }
}
console.log(Array.from(classNames));
