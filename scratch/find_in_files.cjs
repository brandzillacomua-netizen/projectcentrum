const fs = require('fs');

// Check all csv and text files in directory
const files = ['Таблиця - Склад.csv', 'Залишки сировини актуалка - Аркуш1 (1).csv', 'scratch/excel_dump.txt', 'scratch/seed_all_laser_parts.mjs'];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    console.log(`\n=== FILE: ${f} (${lines.length} lines) ===`);
    const matches = lines.filter(l => l.toLowerCase().includes('комплект') || l.toLowerCase().includes('рама') || l.toLowerCase().includes('проєкт') || l.toLowerCase().includes('проект'));
    console.log(`Matched ${matches.length} lines. First 15 matches:`);
    matches.slice(0, 15).forEach(m => console.log('  ', m.trim().slice(0, 120)));
  }
});
