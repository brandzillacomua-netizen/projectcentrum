const fs = require('fs');
const content = fs.readFileSync('src/contexts/useProduction.js', 'utf8');

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

returnedSymbols.forEach(sourceSym => {
  let count = 0;
  let idx = 0;
  while ((idx = content.indexOf(sourceSym, idx)) !== -1) {
    count++;
    idx += sourceSym.length;
  }
  console.log(`${sourceSym}: ${count} occurrences`);
});
