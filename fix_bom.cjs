const fs = require('fs');

const FILES = [
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\BomTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\CncTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\IdentificationTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\InventoryTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\ParamsTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\index.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\BomTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\CncTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\IdentificationTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\InventoryTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\ParamsTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\index.jsx',
];

FILES.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  // Remove BOM and any garbage prefix characters before "import"
  content = content.replace(/^[\uFEFF\u00EF\u00BB\u00BF\u00FF\u00FE\u00A0\s\S]*?(import|\/\/|\/\*)/, '$1');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleaned BOM from:', filePath.split('\\').pop());
});
console.log('Done!');
