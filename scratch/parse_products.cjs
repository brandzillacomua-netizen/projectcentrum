const fs = require('fs');

const csv = fs.readFileSync('Таблиця - Склад.csv', 'utf8');
const lines = csv.split('\n');

const products = [];
lines.forEach(l => {
  if (l.startsWith('FG-')) {
    const cols = l.split(',');
    if (cols[1]) {
      let name = cols[1].replace(/"/g, '').trim();
      if (name) products.push(name);
    }
  }
});

const unique = Array.from(new Set(products));
console.log('Unique FG products in CSV (' + unique.length + ' items):');
unique.forEach((p, i) => console.log((i + 1) + '. ' + p));
