import { readFileSync } from 'fs';

const tab = readFileSync('a:/centrum/src/modules/Supply/components/SupplyRequestsTab.jsx', 'utf-8');
const lines = tab.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('background:')) {
    console.log(`${i+1}: ${lines[i].trim()}`);
  }
}
