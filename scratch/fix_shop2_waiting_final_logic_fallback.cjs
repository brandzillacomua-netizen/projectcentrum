const fs = require('fs');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const tableSearchStr = "const displayNeed = plannedNeed";
const idxTable = content.indexOf(tableSearchStr);

if (idxTable !== -1) {
  const endTableStr = "displayBz = displayTotal - plannedNeed";
  const idxTableEnd = content.indexOf(endTableStr, idxTable);
  
  if (idxTableEnd !== -1) {
    const tableReplacement = `const displayNeed = plannedNeed
                           const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                           const snapEntry = snap[String(item.nom?.id)] || {}
                           const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
                           
                           let displayTotal = plannedNeed + plannedBz
                           let displayBz = plannedBz
                           
                           if (actualArrived < plannedNeed) {
                             const shortage = plannedNeed - actualArrived
                             const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                             const reissueQty = sheetsNeeded * unitsPerSheet
                             displayTotal = actualArrived + reissueQty
                             displayBz = displayTotal - plannedNeed`;
                             
    content = content.substring(0, idxTable) + tableReplacement + content.substring(idxTableEnd + endTableStr.length);
    console.log('✅ Table plannedBz fixed successfully!');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('🏁 Done.');
