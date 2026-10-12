import { readFileSync } from 'fs';

const js = readFileSync('a:/centrum/dist/assets/SupplyModuleV2-D6vL7TfK.js', 'utf-8');
const idx = js.indexOf('ВИДАТИ НА ПІДГОТОВКУ');
if (idx !== -1) {
  console.log('Snippet in bundle:');
  console.log(js.slice(idx - 300, idx + 200));
} else {
  console.log('Not found in this chunk');
}
