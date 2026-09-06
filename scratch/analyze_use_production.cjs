const fs = require('fs');
const content = fs.readFileSync('src/contexts/useProduction.js', 'utf8');
const lines = content.split('\n');

const returnedSymbols = [
  'createNaryad', 'handoverTaskToShop2', 'cancelHandoverToShop2', 'completeTaskShop2',
  'directHandoverToSGP', 'handoverToSGP', 'reserveBZForTask', 'completePackaging',
  'disposeScrapItem', 'createReworkNaryad', 'approveWarehouse', 'approveEngineer',
  'approveDirector', 'upsertNomenclature', 'deleteNomenclature', 'saveBOM', 'removeBOM',
  'syncBOM', 'addOrder', 'updateOrder', 'deleteOrder', 'superDeleteOrder',
  'createWorkCard', 'createWorkCardsBatch', 'startWorkCard', 'completeWorkCard',
  'confirmBuffer', 'completeTaskByMaster', 'addManagementTask', 'updateManagementTask',
  'deleteManagementTask', 'addMachine', 'updateMachine', 'deleteMachine',
  'getOrderProductionProgress', 'createDovyпускMaterialRequests'
];

returnedSymbols.forEach(name => {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`const ${name} =`) || lines[i].includes(`function ${name}`)) {
      console.log(`- ${name}: Line ${i + 1}`);
      break;
    }
  }
});
