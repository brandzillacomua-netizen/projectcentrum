const fs = require('fs');
let code = fs.readFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', 'utf8');
const lines = code.split('\n');

console.log('Total lines before:', lines.length);
console.log('Line 506:', JSON.stringify(lines[505]));
console.log('Line 507:', JSON.stringify(lines[506]));
console.log('Line 522:', JSON.stringify(lines[521]));
console.log('Line 523:', JSON.stringify(lines[522]));
console.log('---');
console.log('Line 544:', JSON.stringify(lines[543]));
console.log('Line 545:', JSON.stringify(lines[544]));
console.log('Line 548:', JSON.stringify(lines[547]));
console.log('Line 549:', JSON.stringify(lines[548]));

// Remove lines 507-522 (0-indexed: 506-521) - orphaned ') : (' block
// Remove lines 545-548 (0-indexed: 544-547) - duplicate remove button
// We do it in reverse order so indices don't shift
const toRemove = [];
for (let i = 543; i <= 547; i++) toRemove.push(i); // lines 544-548
for (let i = 505; i <= 521; i++) toRemove.push(i); // lines 506-522

const toRemoveSet = new Set(toRemove);
const newLines = lines.filter((_, i) => !toRemoveSet.has(i));

console.log('\nTotal lines after:', newLines.length);
console.log('New line 505:', JSON.stringify(newLines[504]));
console.log('New line 506:', JSON.stringify(newLines[505]));
console.log('New line 507:', JSON.stringify(newLines[506]));

fs.writeFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', newLines.join('\n'), 'utf8');
console.log('\nDone! File size:', newLines.join('\n').length);
