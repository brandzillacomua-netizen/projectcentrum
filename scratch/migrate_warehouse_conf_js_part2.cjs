const fs = require('fs');

// Helper
const patch = (filePath, replacements) => {
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ FILE NOT FOUND: ${filePath}`);
    return 0;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = 0;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed++;
      console.log(`  ✅ "${from.substring(0,60).trim()}" → "${to.substring(0,60).trim()}"`);
    } else {
      console.log(`  ... Already patched or not found: "${from.substring(0,60).trim()}"`);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return changed;
};

// =====================================================================
// requestBuilder.js
// =====================================================================
console.log('\n📄 requestBuilder.js');
patch('a:/centrum/src/api/requestBuilder.js', [
  ['warehouse_conf: true',  "warehouse_conf: 'true'"],
  ['warehouse_conf: false', "warehouse_conf: 'false'"],
]);

// =====================================================================
// Shop1Terminal.jsx
// =====================================================================
console.log('\n📄 Shop1Terminal.jsx');
patch('a:/centrum/src/modules/Shop1Terminal.jsx', [
  ['warehouse_conf: true,', "warehouse_conf: 'true',"],
]);

// =====================================================================
// SortingTerminal.jsx
// =====================================================================
console.log('\n📄 SortingTerminal.jsx');
patch('a:/centrum/src/modules/SortingTerminal.jsx', [
  ['warehouse_conf: true,', "warehouse_conf: 'true',"],
]);

// =====================================================================
// SimulatorModule.jsx
// =====================================================================
console.log('\n📄 SimulatorModule.jsx');
patch('a:/centrum/src/modules/SimulatorModule.jsx', [
  ['warehouse_conf: false,', "warehouse_conf: 'false',"],
  ['warehouse_conf: true,',  "warehouse_conf: 'true',"],
]);

// =====================================================================
// DirectorModule.jsx — порівняння === true → === 'true'
// =====================================================================
console.log('\n📄 DirectorModule.jsx');
patch('a:/centrum/src/modules/DirectorModule.jsx', [
  ["t.warehouse_conf === true", "t.warehouse_conf === 'true'"],
  ["task.warehouse_conf === true", "task.warehouse_conf === 'true'"],
]);

// =====================================================================
// MasterModule.jsx
// =====================================================================
console.log('\n📄 MasterModule.jsx');
patch('a:/centrum/src/modules/MasterModule.jsx', [
  ["task.warehouse_conf === true", "task.warehouse_conf === 'true'"],
]);

// =====================================================================
// MasterModule_v3.jsx — badge rendering
// =====================================================================
console.log('\n📄 MasterModule_v3.jsx');
patch('a:/centrum/src/modules/MasterModule_v3.jsx', [
  ["task.warehouse_conf === true", "task.warehouse_conf === 'true'"],
]);

// =====================================================================
// PreparationTerminal.jsx
// =====================================================================
console.log('\n📄 PreparationTerminal.jsx');
patch('a:/centrum/src/modules/PreparationTerminal.jsx', [
  ["t.warehouse_conf === true",  "t.warehouse_conf === 'true'"],
  ["warehouse_conf: scrapQty > 0 ? false : parentTask.warehouse_conf",
   "warehouse_conf: scrapQty > 0 ? 'false' : parentTask.warehouse_conf"],
]);

// =====================================================================
// ReportsModule.jsx
// =====================================================================
console.log('\n📄 ReportsModule.jsx');
patch('a:/centrum/src/modules/ReportsModule.jsx', [
  ["t.warehouse_conf === true", "t.warehouse_conf === 'true'"],
]);

// =====================================================================
// ForemanWorkplace.jsx
// =====================================================================
console.log('\n📄 ForemanWorkplace.jsx');
patch('a:/centrum/src/modules/ForemanWorkplace.jsx', [
  [
    "const shouldAutoReserve = task.warehouse_conf && task.engineer_conf && task.director_conf",
    "const shouldAutoReserve = (task.warehouse_conf === 'true' || task.warehouse_conf === 'partial') && task.engineer_conf && task.director_conf"
  ],
  ["t.warehouse_conf === true", "t.warehouse_conf === 'true'"],
]);

// =====================================================================
// ForemanDashboardModule.jsx
// =====================================================================
console.log('\n📄 ForemanDashboardModule.jsx');
patch('a:/centrum/src/modules/ForemanDashboardModule.jsx', [
  [
    "return t.warehouse_conf && t.engineer_conf && t.director_conf && isLaser",
    "return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser"
  ],
]);

// =====================================================================
// MasterWorkplace.jsx
// =====================================================================
console.log('\n📄 MasterWorkplace.jsx');
patch('a:/centrum/src/modules/MasterWorkplace.jsx', [
  [
    "t.warehouse_conf && t.engineer_conf",
    "(t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf"
  ],
]);

// =====================================================================
// WarehouseModuleV2.jsx — truthy checks тепер 'false' теж truthy!
// =====================================================================
console.log('\n📄 WarehouseModuleV2.jsx');
patch('a:/centrum/src/modules/WarehouseModuleV2.jsx', [
  [
    "if (!task || task.warehouse_conf) return false",
    "if (!task || task.warehouse_conf === 'true') return false"
  ],
]);

console.log('\n✅ All patches applied!');
