const fs = require('fs');
const path = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = "const baseMat = (part.nom?.material_type || '').toLowerCase()";
const replacement1 = "const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()";
content = content.replaceAll(target1, replacement1);

const target2 = "const baseMat = partNom?.material_type || ''";
const replacement2 = "const snapMat = (taskObj.plan_snapshot || {})[String(partNom?.id)]?.material; const baseMat = snapMat || partNom?.material_type || ''";
content = content.replace(target2, replacement2);

fs.writeFileSync(path, content, 'utf8');
console.log('baseMat replaced successfully');
