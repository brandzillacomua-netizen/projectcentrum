const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/ForemanWorkplace.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update setGenModal in standard mode (split & non-split)
const oldGenModalInit = `                                                 if (isSplitMode) {
                                                   setGenModal({ 
                                                     task, part, 
                                                     total: totalTargetLoads, 
                                                     requirement: plan, 
                                                     created: productionCards.length, 
                                                     rowId, 
                                                     machineName: rowMachineName || splits[0]?.machine, 
                                                     sheets,
                                                     splits: splits 
                                                   })
                                                 } else {
                                                   if (!rowMachineName) return;
                                                   setGenModal({ task, part, total: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets })
                                                 }`;

const newGenModalInit = `                                                 const remaining = Math.max(1, totalTargetLoads - productionCards.length);
                                                 if (isSplitMode) {
                                                   setGenModal({ 
                                                     task, part, 
                                                     total: remaining, 
                                                     targetTotal: totalTargetLoads,
                                                     requirement: plan, 
                                                     created: productionCards.length, 
                                                     rowId, 
                                                     machineName: rowMachineName || splits[0]?.machine, 
                                                     sheets,
                                                     splits: splits 
                                                   })
                                                 } else {
                                                   if (!rowMachineName) return;
                                                   setGenModal({ 
                                                     task, part, 
                                                     total: remaining, 
                                                     targetTotal: totalTargetLoads, 
                                                     requirement: plan, 
                                                     created: productionCards.length, 
                                                     rowId, 
                                                     machineName: rowMachineName, 
                                                     sheets 
                                                   })
                                                 }`;

// Normalize line endings to find the match
const oldGenModalInitLF = oldGenModalInit.replace(/\r\n/g, '\n');
const normalizedContent = content.replace(/\r\n/g, '\n');

if (normalizedContent.includes(oldGenModalInitLF)) {
  content = normalizedContent.replace(oldGenModalInitLF, newGenModalInit.replace(/\r\n/g, '\n'));
  console.log("Successfully replaced standard setGenModal initialization");
} else {
  console.error("Could not find standard setGenModal initialization");
}

// 2. Update repair setGenModal in ForemanWorkplace
// Let's check line 1757
const oldRepairModal = `                                       setGenModal({
                                         task,
                                         part: { nom },
                                         total: cardsNeeded,
                                         requirement: shortage,
                                         created: 0,
                                         machineName,
                                         sheets: sheetsNeeded,
                                         isRepair: true
                                       })`;

const newRepairModal = `                                       setGenModal({
                                         task,
                                         part: { nom },
                                         total: cardsNeeded,
                                         targetTotal: cardsNeeded,
                                         requirement: shortage,
                                         created: 0,
                                         machineName,
                                         sheets: sheetsNeeded,
                                         isRepair: true
                                       })`;

const oldRepairModalLF = oldRepairModal.replace(/\r\n/g, '\n');
if (content.includes(oldRepairModalLF)) {
  content = content.replace(oldRepairModalLF, newRepairModal.replace(/\r\n/g, '\n'));
  console.log("Successfully replaced repair setGenModal initialization");
} else {
  console.error("Could not find repair setGenModal initialization");
}

// 3. Update machine change total/targetTotal
const oldMachineChange = `                          setGenModal(prev => ({
                            ...prev,
                            machineName: newMachineName,
                            total: newCardsNeeded
                          }))`;

const newMachineChange = `                          setGenModal(prev => ({
                            ...prev,
                            machineName: newMachineName,
                            total: Math.max(1, newCardsNeeded - (prev.created || 0)),
                            targetTotal: newCardsNeeded
                          }))`;

const oldMachineChangeLF = oldMachineChange.replace(/\r\n/g, '\n');
if (content.includes(oldMachineChangeLF)) {
  content = content.replace(oldMachineChangeLF, newMachineChange.replace(/\r\n/g, '\n'));
  console.log("Successfully replaced machine change setGenModal");
} else {
  console.error("Could not find machine change setGenModal");
}

// 4. Update status display text to use targetTotal || total
const oldStatusText = `                      <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {genModal.created} з {genModal.total}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: \`\${(genModal.created / genModal.total) * 100}%\`, height: '100%', background: '#3b82f6', transition: '0.3s' }}`;

const newStatusText = `                      <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {genModal.created} з {genModal.targetTotal || genModal.total}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: \`\${(genModal.created / (genModal.targetTotal || genModal.total)) * 100}%\`, height: '100%', background: '#3b82f6', transition: '0.3s' }}`;

const oldStatusTextLF = oldStatusText.replace(/\r\n/g, '\n');
if (content.includes(oldStatusTextLF)) {
  content = content.replace(oldStatusTextLF, newStatusText.replace(/\r\n/g, '\n'));
  console.log("Successfully replaced progress status text");
} else {
  console.error("Could not find progress status text");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Write complete!");
