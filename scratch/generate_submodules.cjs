const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('src/contexts/useProduction.js', 'utf8');
const lines = content.split('\n');

const outDir = path.join('src', 'contexts', 'production');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Module 1: productionOrders.js
// Lines 14-34 (getRequestQty, normalizeName)
// Lines 45-70 (stripMaterialTags, isRawMaterialNom, findExplicitRawMaterialNom)
// Lines 152-1010 (updateOrder, deleteOrder, superDeleteOrder, addOrder, createDovyпускMaterialRequests)
// Lines 1802-1861 (getOrderProductionProgress)

const helpers1 = lines.slice(13, 34).join('\n');
const helpers2 = lines.slice(44, 70).join('\n');
const ordersBody1 = lines.slice(151, 1010).join('\n');
const ordersBody2 = lines.slice(1801, 1861).join('\n');

const ordersModule = `import { supabase } from '../../supabase.js'
import { sendPushToUsers } from '../../services/pushService.js'

${helpers1}

export function createProductionOrdersActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
${helpers2}

${ordersBody1}

${ordersBody2}

  return {
    addOrder,
    updateOrder,
    deleteOrder,
    superDeleteOrder,
    getOrderProductionProgress,
    createDovyпускMaterialRequests
  }
}
`;

fs.writeFileSync(path.join(outDir, 'productionOrders.js'), ordersModule, 'utf8');
console.log('Created productionOrders.js');

// 2. Module 2: productionCards.js
// Lines 1011-1708 (createWorkCard, createWorkCardsBatch, startWorkCard, completeWorkCard, confirmBuffer)
// Lines 1862-2367 (createNaryad)

const cardsBody1 = lines.slice(1010, 1708).join('\n');
const cardsBody2 = lines.slice(1861, 2367).join('\n');

const cardsModule = `import { supabase } from '../../supabase.js'
import {
  generateIdempotencyKey,
  hasBeenProcessed,
  isPending,
  setPending,
  clearPending,
  getCachedResult,
  markAsProcessed
} from '../../services/idempotencyService.js'
import { enqueueOfflineMutation } from '../../services/offlineQueueService.js'

export function createProductionCardsActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
${cardsBody1}

${cardsBody2}

  return {
    createWorkCard,
    createWorkCardsBatch,
    startWorkCard,
    completeWorkCard,
    confirmBuffer,
    createNaryad
  }
}
`;

fs.writeFileSync(path.join(outDir, 'productionCards.js'), cardsModule, 'utf8');
console.log('Created productionCards.js');

// 3. Module 3: productionHandovers.js
// Lines 71-120 (approveWarehouse, approveEngineer, approveDirector)
// Lines 1709-1715 (completeTaskByMaster)
// Lines 2368-2922 (handoverTaskToShop2, cancelHandoverToShop2, completeTaskShop2, directHandoverToSGP, handoverToSGP, reserveBZForTask, completePackaging)

const handoversBody1 = lines.slice(70, 120).join('\n');
const handoversBody2 = lines.slice(1708, 1715).join('\n');
const handoversBody3 = lines.slice(2367, 2922).join('\n');

const handoversModule = `import { supabase } from '../../supabase.js'
import { isMachineMatch } from '../../utils/cutterCalculator.js'

export function createProductionHandoversActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
${handoversBody1}

${handoversBody2}

${handoversBody3}

  return {
    approveWarehouse,
    approveEngineer,
    approveDirector,
    completeTaskByMaster,
    handoverTaskToShop2,
    cancelHandoverToShop2,
    completeTaskShop2,
    directHandoverToSGP,
    handoverToSGP,
    reserveBZForTask,
    completePackaging
  }
}
`;

fs.writeFileSync(path.join(outDir, 'productionHandovers.js'), handoversModule, 'utf8');
console.log('Created productionHandovers.js');

// 4. Module 4: productionAuxiliary.js
// Lines 121-151 (upsertNomenclature, deleteNomenclature, saveBOM, removeBOM, syncBOM)
// Lines 1716-1801 (addManagementTask, updateManagementTask, deleteManagementTask, addMachine, updateMachine, deleteMachine)
// Lines 2923-3011 (disposeScrapItem, createReworkNaryad)

const auxBody1 = lines.slice(120, 151).join('\n');
const auxBody2 = lines.slice(1715, 1801).join('\n');
const auxBody3 = lines.slice(2922, 3011).join('\n');

const auxModule = `import { supabase } from '../../supabase.js'

export function createProductionAuxiliaryActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
${auxBody1}

${auxBody2}

${auxBody3}

  return {
    upsertNomenclature,
    deleteNomenclature,
    saveBOM,
    removeBOM,
    syncBOM,
    addManagementTask,
    updateManagementTask,
    deleteManagementTask,
    addMachine,
    updateMachine,
    deleteMachine,
    disposeScrapItem,
    createReworkNaryad
  }
}
`;

fs.writeFileSync(path.join(outDir, 'productionAuxiliary.js'), auxModule, 'utf8');
console.log('Created productionAuxiliary.js');
