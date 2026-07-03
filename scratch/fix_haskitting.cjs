const fs = require('fs');
const path = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the main table variable
const target = "const hasKittingReqs = (materialRequests || []).some(r => String(r.task_id) === String(task.id))";
const replacement = "const hasKittingReqs = sheetReqs.length > 0";
content = content.replaceAll(target, replacement);

// Replace inside the modal: getKittingSheets return value
const targetModalReturn = "return { issuedSheets: issued, pendingSheets: pending }";
const replacementModalReturn = "return { issuedSheets: issued, pendingSheets: pending, hasKittingReqs: sheetReqs.length > 0 }";
content = content.replace(targetModalReturn, replacementModalReturn);

// Replace inside the modal: the const hasKittingReqs line
const targetModalLine1 = "const { issuedSheets, pendingSheets } = getKittingSheets(genModal.task, genModal.part.nom)";
const replacementModalLine1 = "const { issuedSheets, pendingSheets, hasKittingReqs } = getKittingSheets(genModal.task, genModal.part.nom)";
content = content.replace(targetModalLine1, replacementModalLine1);

const targetModalLine2 = "const hasKittingReqs = (materialRequests || []).some(r => String(r.task_id) === String(genModal.task.id))";
const replacementModalLine2 = "";
content = content.replace(targetModalLine2, replacementModalLine2);

fs.writeFileSync(path, content, 'utf8');
console.log('Replacements done!');
