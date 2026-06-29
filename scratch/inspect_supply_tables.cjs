const fs = require('fs');
const path = require('path');

const file = 'a:/centrum/src/modules/SupplyModuleV2.jsx';
const content = fs.readFileSync(file, 'utf8');

const regex = /\.from\(['"]([^'"]+)['"]\)/g;
let match;
const tables = new Set();
while ((match = regex.exec(content)) !== null) {
  tables.add(match[1]);
}

console.log('Таблиці, що використовуються в SupplyModuleV2.jsx:', Array.from(tables));
