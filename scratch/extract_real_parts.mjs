import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('a:/centrum').filter(f => f.endsWith('.csv'));
console.log('CSV files in workspace:', files);

const realPartsMap = new Map();

files.forEach(file => {
  if (file.toLowerCase().includes('склад') || file.toLowerCase().includes('залишки') || file.toLowerCase().includes('фрези')) return;
  const content = fs.readFileSync(path.join('a:/centrum', file), 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  lines.forEach(line => {
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 2 && cols[0] && !isNaN(parseInt(cols[0]))) {
      const partName = cols[1];
      const char = cols[2] || '';
      const desc = cols[3] || '';
      if (partName && !partName.toLowerCase().includes('гвинт') && !partName.toLowerCase().includes('гайка') && !partName.toLowerCase().includes('стійка')) {
        const fullName = char && !char.toLowerCase().includes(partName.toLowerCase()) ? `${partName} ${char}` : (char || partName);
        const thickMatch = desc.match(/(\d+(?:\.\d+)?)\s*мм/i);
        const thickness = thickMatch ? thickMatch[1] : '';
        const itemObj = {
          name: fullName.trim(),
          thickness,
          description: desc,
          source: file
        };
        realPartsMap.set(fullName.trim().toLowerCase(), itemObj);
      }
    }
  });
});

console.log('Extracted real structural parts count:', realPartsMap.size);
console.log('--- ALL EXTRACTED REAL PARTS ---');
Array.from(realPartsMap.values()).forEach((p, idx) => {
  console.log(`${idx+1}. ${p.name} (Товщина: ${p.thickness || 'Н/Д'}, Джерело: ${p.source})`);
});
