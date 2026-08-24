import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('a:/centrum').filter(f => f.endsWith('.csv'));
console.log('Found CSV files:', files);

const partsList = [];

files.forEach(file => {
  if (file.toLowerCase().includes('склад') || file.toLowerCase().includes('залишки') || file.toLowerCase().includes('фрези')) return;
  
  const content = fs.readFileSync(path.join('a:/centrum', file), 'utf8');
  const cleanedText = content.replace(/"([^"]*)"/g, (m, p1) => `"${p1.replace(/\r?\n/g, ' ')}"`);
  const lines = cleanedText.split(/\r?\n/).filter(line => line.trim() !== '');

  lines.forEach((line, idx) => {
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 2) {
      const col0 = cols[0];
      const isHeader = !col0 || isNaN(parseInt(col0));
      if (!isHeader) {
        const name = cols[1];
        const char = cols[2] || '';
        const desc = cols[3] || '';
        
        const lowerName = (name + ' ' + char).toLowerCase();
        if (!lowerName.includes('гвинт') && !lowerName.includes('гайка') && !lowerName.includes('стійка') && !lowerName.includes('штифт') && !lowerName.includes('шайба')) {
          const fullName = char && !char.toLowerCase().includes(name.toLowerCase()) ? `${name} ${char}` : (char || name);
          partsList.push({
            file,
            index: col0,
            name: fullName.trim(),
            description: desc,
            rawName: name,
            rawChar: char
          });
        }
      }
    }
  });
});

console.log('Total structural parts found across all CSV files:', partsList.length);
console.log('--- LIST OF ALL PARTS ---');
partsList.forEach((p, idx) => {
  console.log(`${idx+1}. [${p.file}] ${p.name} | ${p.description}`);
});
