const fs = require('fs');
const path = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update the click handler for setGenModal
const targetClickHandler = `                                                 } else {
                                                   if (!rowMachineName) return;
                                                   const mObj = findMachine(rowMachineName);
                                                   setGenModal({ task, part, total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets, capacity: machineCapacity })
                                                 }`;

const replacementClickHandler = `                                                 } else {
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

content = content.replace(targetClickHandler, replacementClickHandler);

// 2. Constrain the modal inputs inside ForemanWorkplace.jsx
// We need to find the JSX for the single-machine card generation inputs
// Let's replace the capacity input onChange and onBlur, and total input onChange.
const targetCapacityOnChange = `                    onChange={(e) => {
                      const newCap = parseInt(e.target.value);
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      const safeCap = isNaN(newCap) ? 1 : Math.min(maxC, Math.max(minC, newCap));
                      const newTargetTotal = Math.ceil(genModal.sheets / safeCap);
                      setGenModal(prev => ({
                        ...prev,
                        capacity: isNaN(newCap) ? '' : newCap,
                        total: Math.max(1, newTargetTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}`;

const replacementCapacityOnChange = `                    onChange={(e) => {
                      const newCap = parseInt(e.target.value);
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      const safeCap = isNaN(newCap) ? 1 : Math.min(maxC, Math.max(minC, newCap));
                      const newTargetTotal = Math.ceil(genModal.sheets / safeCap);
                      
                      const { issuedSheets, hasKittingReqs } = getKittingSheets(genModal.task, genModal.part.nom);
                      const maxAllowed = hasKittingReqs ? Math.floor(issuedSheets / safeCap) : newTargetTotal;
                      const finalTotal = Math.min(newTargetTotal, maxAllowed);
                      
                      setGenModal(prev => ({
                        ...prev,
                        capacity: isNaN(newCap) ? '' : newCap,
                        total: Math.max(1, finalTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}`;

content = content.replace(targetCapacityOnChange, replacementCapacityOnChange);

const targetCapacityOnBlur = `                    onBlur={(e) => {
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = minC;
                      else v = Math.min(maxC, Math.max(minC, v));
                      const newTargetTotal = Math.ceil(genModal.sheets / v);
                      setGenModal(prev => ({
                        ...prev,
                        capacity: v,
                        total: Math.max(1, newTargetTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}`;

const replacementCapacityOnBlur = `                    onBlur={(e) => {
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = minC;
                      else v = Math.min(maxC, Math.max(minC, v));
                      const newTargetTotal = Math.ceil(genModal.sheets / v);
                      
                      const { issuedSheets, hasKittingReqs } = getKittingSheets(genModal.task, genModal.part.nom);
                      const maxAllowed = hasKittingReqs ? Math.floor(issuedSheets / v) : newTargetTotal;
                      const finalTotal = Math.min(newTargetTotal, maxAllowed);
                      
                      setGenModal(prev => ({
                        ...prev,
                        capacity: v,
                        total: Math.max(1, finalTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}`;

content = content.replace(targetCapacityOnBlur, replacementCapacityOnBlur);

const targetTotalOnChange = `                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      setGenModal(prev => ({ ...prev, total: val }))
                    }}`;

const replacementTotalOnChange = `                    onChange={(e) => {
                      const { issuedSheets, hasKittingReqs } = getKittingSheets(genModal.task, genModal.part.nom);
                      const limitCap = genModal.capacity || 1;
                      const maxAllowed = hasKittingReqs ? Math.floor(issuedSheets / limitCap) : (genModal.targetTotal || genModal.total);
                      const val = Math.min(maxAllowed, Math.max(1, parseInt(e.target.value) || 1))
                      setGenModal(prev => ({ ...prev, total: val }))
                    }}`;

content = content.replace(targetTotalOnChange, replacementTotalOnChange);

fs.writeFileSync(path, content, 'utf8');
console.log('ForemanWorkplace.jsx updated for loading constraints');
