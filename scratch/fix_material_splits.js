import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/modules/MasterModule_v3.jsx');
let content = fs.readFileSync(filePath, 'utf8');

function normalize(str) {
  return str.replace(/\r\n/g, '\n');
}

let nContent = normalize(content);

// 1. Instance 1 (around line 890 - 8 spaces indent)
const target1 = normalize(`        const sheets_t300 = snapshot
          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
          : (materialSplits[part.nom.id]?.t300 !== undefined ? materialSplits[part.nom.id].t300 : sheets)
        const sheets_t700 = snapshot
          ? (Number(snapshot.sheets_t700) || 0)
          : (materialSplits[part.nom.id]?.t700 || 0)`);

const replacement1 = `        const isDefaultT700 = (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('т700') || (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('t700')
        const defaultT300 = isDefaultT700 ? 0 : sheets
        const defaultT700 = isDefaultT700 ? sheets : 0

        const sheets_t300 = snapshot
          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : (isDefaultT700 ? 0 : Number(snapshot.sheets)))
          : (materialSplits[part.nom.id]?.t300 !== undefined ? materialSplits[part.nom.id].t300 : defaultT300)
        const sheets_t700 = snapshot
          ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : (isDefaultT700 ? Number(snapshot.sheets) : 0))
          : (materialSplits[part.nom.id]?.t700 !== undefined ? materialSplits[part.nom.id].t700 : defaultT700)`;

// 2. Instance 2 (around line 975 - 10 spaces indent)
const target2 = normalize(`          const sheets_t300 = snapshot
            ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
            : (materialSplits[part.nom.id]?.t300 !== undefined ? materialSplits[part.nom.id].t300 : Math.ceil(totalToProduce / unitsPerSheet))
          const sheets_t700 = snapshot
            ? (Number(snapshot.sheets_t700) || 0)
            : (materialSplits[part.nom.id]?.t700 || 0)`);

const replacement2 = `          const totalSheets = Math.ceil(totalToProduce / unitsPerSheet)
          const isDefaultT700 = (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('т700') || (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('t700')
          const defaultT300 = isDefaultT700 ? 0 : totalSheets
          const defaultT700 = isDefaultT700 ? totalSheets : 0

          const sheets_t300 = snapshot
            ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : (isDefaultT700 ? 0 : Number(snapshot.sheets)))
            : (materialSplits[part.nom.id]?.t300 !== undefined ? materialSplits[part.nom.id].t300 : defaultT300)
          const sheets_t700 = snapshot
            ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : (isDefaultT700 ? Number(snapshot.sheets) : 0))
            : (materialSplits[part.nom.id]?.t700 !== undefined ? materialSplits[part.nom.id].t700 : defaultT700)`;

// 3. Instance 3/5 (around line 1797 and line 2500 - 24 spaces indent)
const target3 = normalize(`                        const sheets_t300 = snapshot
                          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
                          : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : (totalToProduce > 0 ? sheets : 0))
                        const sheets_t700 = snapshot
                          ? (Number(snapshot.sheets_t700) || 0)
                          : (materialSplits[part.nom?.id]?.t700 || 0)`);

const replacement3 = `                        const isDefaultT700 = (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('т700') || (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('t700')
                        const defaultT300 = isDefaultT700 ? 0 : (totalToProduce > 0 ? sheets : 0)
                        const defaultT700 = isDefaultT700 ? (totalToProduce > 0 ? sheets : 0) : 0

                        const sheets_t300 = snapshot
                          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : (isDefaultT700 ? 0 : Number(snapshot.sheets)))
                          : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : defaultT300)
                        const sheets_t700 = snapshot
                          ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : (isDefaultT700 ? Number(snapshot.sheets) : 0))
                          : (materialSplits[part.nom?.id]?.t700 !== undefined ? materialSplits[part.nom?.id].t700 : defaultT700)`;

// 4. Instance 4/6 (around line 2386 and line 2577 - 28 spaces indent)
const target4 = normalize(`                            const sheets_t300 = snapshot
                              ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
                              : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : (plan > 0 ? sheets : 0));
                            const sheets_t700 = snapshot
                              ? (Number(snapshot.sheets_t700) || 0)
                              : (materialSplits[part.nom?.id]?.t700 || 0);`);

const replacement4 = `                            const isDefaultT700 = (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('т700') || (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('t700')
                            const defaultT300 = isDefaultT700 ? 0 : (plan > 0 ? sheets : 0)
                            const defaultT700 = isDefaultT700 ? (plan > 0 ? sheets : 0) : 0

                            const sheets_t300 = snapshot
                              ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : (isDefaultT700 ? 0 : Number(snapshot.sheets)))
                              : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : defaultT300);
                            const sheets_t700 = snapshot
                              ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : (isDefaultT700 ? Number(snapshot.sheets) : 0))
                              : (materialSplits[part.nom?.id]?.t700 !== undefined ? materialSplits[part.nom?.id].t700 : defaultT700);`;


// Helper to replace all occurrences in the string
function replaceAllOccurrences(src, target, replacement) {
  let res = src;
  let count = 0;
  while (res.includes(target)) {
    res = res.replace(target, replacement);
    count++;
  }
  return { result: res, count };
}

let rep1 = replaceAllOccurrences(nContent, target1, replacement1);
nContent = rep1.result;
console.log(`Replaced Target 1: ${rep1.count} times`);

let rep2 = replaceAllOccurrences(nContent, target2, replacement2);
nContent = rep2.result;
console.log(`Replaced Target 2: ${rep2.count} times`);

let rep3 = replaceAllOccurrences(nContent, target3, replacement3);
nContent = rep3.result;
console.log(`Replaced Target 3/5: ${rep3.count} times`);

let rep4 = replaceAllOccurrences(nContent, target4, replacement4);
nContent = rep4.result;
console.log(`Replaced Target 4/6: ${rep4.count} times`);

fs.writeFileSync(filePath, nContent, 'utf8');
console.log("Completed MasterModule_v3.jsx updates!");
