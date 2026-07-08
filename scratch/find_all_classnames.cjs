const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');
const classes = new Set();
lines.forEach(line => {
  const matches = line.match(/className=(?:{`([^`]+)`}|"([^"]+)"|'([^']+)')/g);
  if (matches) {
    matches.forEach(m => classes.add(m));
  }
});
console.log(Array.from(classes));
