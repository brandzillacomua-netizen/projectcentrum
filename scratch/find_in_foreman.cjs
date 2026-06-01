const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/ForemanWorkplace.jsx', 'utf8');

// Find all matches for "випуск" (regardless of Cyrillic/Latin i)
const regex = /до[вv][иyіi]пуск/i;
const lines = content.split('\n');

console.log('Matches:');
lines.forEach((line, idx) => {
  if (regex.test(line) || line.includes('нестача') || line.includes('shortage')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
