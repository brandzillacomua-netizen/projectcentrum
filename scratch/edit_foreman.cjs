const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/ForemanWorkplace.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Regex replacement for non-split standard mode:
const regexNonSplit = /setGenModal\(\{\s*task,\s*part,\s*total:\s*totalTargetLoads,\s*requirement:\s*plan,\s*created:\s*productionCards\.length,\s*rowId,\s*machineName:\s*rowMachineName,\s*sheets\s*\}\)/g;
if (regexNonSplit.test(content)) {
  content = content.replace(regexNonSplit, `setGenModal({ task, part, total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets })`);
  console.log("Successfully replaced non-split setGenModal");
} else {
  console.error("Could not find non-split setGenModal");
}

// 2. Regex replacement for split mode:
// Let's find:
// if (isSplitMode) {
//   setGenModal({ 
//     task, part, 
//     total: totalTargetLoads, 
//     ...
// We can target:
// total: totalTargetLoads,\s*requirement: plan,\s*created: productionCards\.length,\s*rowId,\s*machineName: rowMachineName \|\| splits\[0\]\?\.machine,\s*sheets,\s*splits: splits
const regexSplit = /total:\s*totalTargetLoads,\s*requirement:\s*plan,\s*created:\s*productionCards\.length,\s*rowId,\s*machineName:\s*rowMachineName\s*\|\|\s*splits\[0\]\?\.machine,\s*sheets,\s*splits:\s*splits/g;
if (regexSplit.test(content)) {
  content = content.replace(regexSplit, `total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName || splits[0]?.machine, sheets, splits: splits`);
  console.log("Successfully replaced split setGenModal");
} else {
  console.error("Could not find split setGenModal");
}

// 3. Regex replacement for repair modal (line 1757)
const regexRepair = /setGenModal\(\{\s*task,\s*part:\s*\{\s*nom\s*\},\s*total:\s*cardsNeeded,\s*requirement:\s*shortage,\s*created:\s*0,\s*machineName,\s*sheets:\s*sheetsNeeded,\s*isRepair:\s*true\s*\}\)/g;
if (regexRepair.test(content)) {
  content = content.replace(regexRepair, `setGenModal({ task, part: { nom }, total: cardsNeeded, targetTotal: cardsNeeded, requirement: shortage, created: 0, machineName, sheets: sheetsNeeded, isRepair: true })`);
  console.log("Successfully replaced repair setGenModal");
} else {
  console.error("Could not find repair setGenModal");
}

// 4. Regex replacement for machine change total/targetTotal (line 2041)
const regexMachineChange = /setGenModal\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*machineName:\s*newMachineName,\s*total:\s*newCardsNeeded\s*\}\)\)/g;
if (regexMachineChange.test(content)) {
  content = content.replace(regexMachineChange, `setGenModal(prev => ({ ...prev, machineName: newMachineName, total: Math.max(1, newCardsNeeded - (prev.created || 0)), targetTotal: newCardsNeeded }))`);
  console.log("Successfully replaced machine change setGenModal");
} else {
  console.error("Could not find machine change setGenModal");
}

// 5. Regex replacement for progress display (line 2073)
const regexProgressText = /Згенеровано\s*\{\s*genModal\.created\s*\}\s*з\s*\{\s*genModal\.total\s*\}/g;
if (regexProgressText.test(content)) {
  content = content.replace(regexProgressText, `Згенеровано {genModal.created} з {genModal.targetTotal || genModal.total}`);
  console.log("Successfully replaced progress status text");
} else {
  console.error("Could not find progress status text");
}

// 6. Regex replacement for progress bar width (line 2077)
const regexProgressBar = /width:\s*`\s*\$\{\s*\(\s*genModal\.created\s*\/\s*genModal\.total\s*\)\s*\*\s*100\s*\}\s*%\s*`/g;
if (regexProgressBar.test(content)) {
  content = content.replace(regexProgressBar, "width: `${(genModal.created / (genModal.targetTotal || genModal.total)) * 100}%``".replace("}%``","}%`"));
  console.log("Successfully replaced progress bar width");
} else {
  console.error("Could not find progress bar width");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Write complete!");
