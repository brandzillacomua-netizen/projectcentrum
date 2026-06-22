import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/modules/ForemanWorkplace.jsx');
let content = fs.readFileSync(filePath, 'utf8');

function normalize(str) {
  return str.replace(/\r\n/g, '\n');
}

let nContent = normalize(content);

// Define getDisplayMaterial helper at the beginning of the file before ForemanWorkplace definition
const targetTop = `const ForemanWorkplace = () => {`;
const replacementTop = `const getDisplayMaterial = (partNom, snapshot) => {
  const baseMat = partNom?.material_type || '—'
  if (!snapshot) return baseMat
  const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
  const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0
  
  const isDefaultT700 = (baseMat || '').toLowerCase().includes('т700') || (baseMat || '').toLowerCase().includes('t700')
  
  // If we have custom sheets in snapshot
  if (snapshot.sheets_t300 !== undefined || snapshot.sheets_t700 !== undefined) {
    if (s700 > 0 && s300 === 0) {
      return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
    }
    if (s300 > 0 && s700 > 0) {
      return baseMat.replace(/т300/gi, 'Т300+Т700').replace(/t300/gi, 'Т300+Т700')
    }
    if (s300 > 0 && s700 === 0) {
      return baseMat.replace(/т700/gi, 'Т300').replace(/t700/gi, 'Т300')
    }
  } else if (isDefaultT700) {
    return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
  }
  
  return baseMat
}

const ForemanWorkplace = () => {`;

// 2. Modify part list table row material column
const targetRow = `<td style={{ padding: '15px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem' }}>{part.nom?.material_type || '—'}</td>`;
const replacementRow = `<td style={{ padding: '15px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem' }}>{getDisplayMaterial(part.nom, snapshot)}</td>`;

// 3. Modify print card layout material display
const targetPrint = `<div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{nomenclature?.material_type || '—'}</div>`;
const replacementPrint = `<div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{getDisplayMaterial(nomenclature, snapshotPart)}</div>`;

// 4. Modify planned sheets splits defaults
const targetStats = normalize(`                // Get planned splits from snapshot
                const snapEntry = snapshot?.[p.nomId]
                let plannedT300 = snapEntry ? Number(snapEntry.sheets_t300) : p.sheets
                let plannedT700 = snapEntry ? Number(snapEntry.sheets_t700) : 0
                if (isNaN(plannedT300)) plannedT300 = p.sheets
                if (isNaN(plannedT700)) plannedT700 = 0`);

const replacementStats = `                // Get planned splits from snapshot
                const snapEntry = snapshot?.[p.nomId]
                const isDefaultT700 = (p.material || '').toLowerCase().includes('т700') || (p.material || '').toLowerCase().includes('t700')
                const defaultT300 = isDefaultT700 ? 0 : p.sheets
                const defaultT700 = isDefaultT700 ? p.sheets : 0
                let plannedT300 = snapEntry ? (snapEntry.sheets_t300 !== undefined ? Number(snapEntry.sheets_t300) : (isDefaultT700 ? 0 : Number(p.sheets))) : defaultT300
                let plannedT700 = snapEntry ? (snapEntry.sheets_t700 !== undefined ? Number(snapEntry.sheets_t700) : (isDefaultT700 ? Number(p.sheets) : 0)) : defaultT700
                if (isNaN(plannedT300)) plannedT300 = defaultT300
                if (isNaN(plannedT700)) plannedT700 = defaultT700`;

function replaceAllOccurrences(src, target, replacement) {
  let res = src;
  let count = 0;
  while (res.includes(target)) {
    res = res.replace(target, replacement);
    count++;
  }
  return { result: res, count };
}

if (!nContent.includes(targetTop)) console.log("Target top not found!");
if (!nContent.includes(targetRow)) console.log("Target row not found!");
if (!nContent.includes(targetPrint)) console.log("Target print not found!");
if (!nContent.includes(targetStats)) console.log("Target stats not found!");

let newContent = nContent;
newContent = newContent.replace(targetTop, replacementTop);
newContent = newContent.replace(targetRow, replacementRow);
newContent = newContent.replace(targetPrint, replacementPrint);
newContent = newContent.replace(targetStats, replacementStats);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully updated ForemanWorkplace.jsx");
