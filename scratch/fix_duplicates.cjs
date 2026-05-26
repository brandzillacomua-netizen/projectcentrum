const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'modules', 'ForemanWorkplace.jsx');
let c = fs.readFileSync(file, 'utf8');

const target = `                                    onClick={() => {
                                      const unitsPerSheet = Number(nom?.units_per_sheet) || 1
                                      const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                                      const machineName = activeCards[0]?.machine || '—'
                                      const unitsPerSheet = Number(nom?.units_per_sheet) || 1;
                                      const sheetsNeeded = Math.ceil(shortage / unitsPerSheet);
                                      const machineName = activeCards[0]?.machine || (machines && machines[0]?.name) || '—';`;

const replacement = `                                    onClick={() => {
                                      const unitsPerSheet = Number(nom?.units_per_sheet) || 1;
                                      const sheetsNeeded = Math.ceil(shortage / unitsPerSheet);
                                      const machineName = activeCards[0]?.machine || (machines && machines[0]?.name) || '—';`;

// Normalize endings for matching
const normC = c.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
const normReplacement = replacement.replace(/\r\n/g, '\n');

if (normC.includes(normTarget)) {
  fs.writeFileSync(file, normC.replace(normTarget, normReplacement), 'utf8');
  console.log('Successfully removed duplicate declarations!');
} else {
  console.log('Error: Could not find duplicate declarations to replace!');
}
