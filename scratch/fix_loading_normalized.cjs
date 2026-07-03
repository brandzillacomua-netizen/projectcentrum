const fs = require('fs');
const path = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings to LF
const normalized = content.replace(/\r\n/g, '\n');

// 1. Target click handler
const targetClick = `                                                 } else {
                                                   if (!rowMachineName) return;
                                                   const mObj = findMachine(rowMachineName);
                                                   setGenModal({ task, part, total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets, capacity: machineCapacity })
                                                 }`;

const replacementClick = `                                                 } else {
                                                   if (!rowMachineName) return;
                                                   const mObj = findMachine(rowMachineName);
                                                   
                                                   const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material;
                                                   const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase();
                                                   const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id));
                                                   const extractThickness = (str) => {
                                                     const match = str.match(/(\\d+(?:\\.\\d+)?)\\s*мм/)
                                                     return match ? match[1] + 'мм' : null
                                                   }
                                                   const baseThickness = extractThickness(baseMat)
                                                   const sheetReqs = taskReqs.filter(r => {
                                                     const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                     const rName = (rNom?.name || r.details || '').toLowerCase()
                                                     const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                     if (!isSheet) return false
                                                     const reqThickness = extractThickness(rName)
                                                     if (baseThickness && reqThickness) {
                                                       return baseThickness === reqThickness
                                                     }
                                                     const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                     return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                   })
                                                   const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                     .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                   const hasKittingReqs = sheetReqs.length > 0
                                                   
                                                   const maxAllowed = hasKittingReqs ? Math.floor(issued / machineCapacity) : totalTargetLoads
                                                   const initialTotal = Math.min(Math.max(1, totalTargetLoads - productionCards.length), maxAllowed)

                                                   setGenModal({ task, part, total: initialTotal, targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets, capacity: machineCapacity })
                                                 }`;

if (!normalized.includes(targetClick)) {
  console.log("CRITICAL ERROR: Click handler not found in normalized content!");
}

const res = normalized.replace(targetClick, replacementClick);

// Save back
fs.writeFileSync(path, res, 'utf8');
console.log("Successfully normalized and replaced click handler!");
