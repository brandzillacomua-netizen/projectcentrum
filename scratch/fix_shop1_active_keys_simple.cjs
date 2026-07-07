const fs = require('fs');
const filePath = 'a:/centrum/src/modules/Shop1Terminal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the declaration
content = content.replace(
  'const activeCards = workCards.filter(c => {',
  'const activeCardsRaw = workCards.filter(c => {'
);

// Replace the end of filtering/sorting
content = content.replace(
  'return true\n                }).sort((a, b) => getCardStartDate(b).getTime() - getCardStartDate(a).getTime())',
  'return true\n                }).sort((a, b) => getCardStartDate(b).getTime() - getCardStartDate(a).getTime());\n                const activeCards = Array.from(new Map(activeCardsRaw.map(c => [String(c.id), c])).values())'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
