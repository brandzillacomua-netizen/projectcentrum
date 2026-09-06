const fs = require('fs');
const content = fs.readFileSync('src/contexts/useProduction.js', 'utf8');
const lines = content.split('\n');

function findLine(str, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].includes(str)) return i + 1;
  }
  return -1;
}

console.log('approveWarehouse:', findLine('const approveWarehouse'));
console.log('approveEngineer:', findLine('const approveEngineer'));
console.log('approveDirector:', findLine('const approveDirector'));
console.log('upsertNomenclature:', findLine('const upsertNomenclature'));
console.log('updateOrder:', findLine('const updateOrder'));
console.log('deleteOrder:', findLine('const deleteOrder'));
console.log('superDeleteOrder:', findLine('const superDeleteOrder'));
console.log('addOrder:', findLine('const addOrder'));
console.log('createDovyпускMaterialRequests:', findLine('const createDovyпускMaterialRequests'));
console.log('createWorkCard:', findLine('const createWorkCard'));
console.log('createWorkCardsBatch:', findLine('const createWorkCardsBatch'));
console.log('startWorkCard:', findLine('const startWorkCard'));
console.log('completeWorkCard:', findLine('const completeWorkCard'));
console.log('confirmBuffer:', findLine('const confirmBuffer'));
console.log('completeTaskByMaster:', findLine('const completeTaskByMaster'));
console.log('addManagementTask:', findLine('const addManagementTask'));
console.log('getOrderProductionProgress:', findLine('const getOrderProductionProgress'));
console.log('createNaryad:', findLine('const createNaryad'));
console.log('handoverTaskToShop2:', findLine('const handoverTaskToShop2'));
console.log('cancelHandoverToShop2:', findLine('const cancelHandoverToShop2'));
console.log('completeTaskShop2:', findLine('const completeTaskShop2'));
console.log('directHandoverToSGP:', findLine('const directHandoverToSGP'));
console.log('handoverToSGP:', findLine('const handoverToSGP'));
console.log('reserveBZForTask:', findLine('const reserveBZForTask'));
console.log('completePackaging:', findLine('const completePackaging'));
console.log('disposeScrapItem:', findLine('const disposeScrapItem'));
console.log('createReworkNaryad:', findLine('const createReworkNaryad'));
