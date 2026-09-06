const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const raw = cp.execSync('git show HEAD:src/contexts/useProduction.js', { maxBuffer: 15 * 1024 * 1024 }).toString();
const lines = raw.split('\n');

const outDir = path.join(__dirname, '..', 'src', 'contexts', 'production');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// ── 1. productionOrders.js ──
// Lines 142 to 1000 (0-indexed: 141 to 1000)
// Lines 1665 to 1724 (0-indexed: 1664 to 1724)
const ordersSlice1 = lines.slice(141, 1000).join('\n');
const ordersSlice2 = lines.slice(1664, 1724).join('\n');

const ordersContent = `import { supabase } from '../../supabase.js'
import { isMachineMatch } from '../../utils/cutterCalculator.js'
import {
  getRequestQty,
  normalizeName,
  stripMaterialTags,
  findExplicitRawMaterialNom as findExplicitRawNom
} from './productionShared.js'

export function createProductionOrdersActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
  const findExplicitRawMaterialNom = (materialLabel) => findExplicitRawNom(materialLabel, nomenclatures)

${ordersSlice1}

${ordersSlice2}

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
fs.writeFileSync(path.join(outDir, 'productionOrders.js'), ordersContent, 'utf8');
console.log('Successfully generated productionOrders.js');

// ── 2. productionCards.js ──
// Lines 1001 to 1571 (0-indexed: 1000 to 1571)
// Lines 1725 to 2230 (0-indexed: 1724 to 2230)
let cardsSlice1 = lines.slice(1000, 1571).join('\n');
// Fix regex useless escape character inside [^)]
cardsSlice1 = cardsSlice1.replace(/\[\^\\\)\]/g, '[^)]');
const cardsSlice2 = lines.slice(1724, 2230).join('\n');

const cardsContent = `import { supabase } from '../../supabase.js'
import { sendPushToUsers } from '../../services/pushService.js'
import {
  CHAIN_SHOP1,
  CHAIN_GENERAL,
  getRequestQty,
  normalizeName,
  stripMaterialTags,
  isRawMaterialNom,
  findExplicitRawMaterialNom as findExplicitRawNom
} from './productionShared.js'

export function createProductionCardsActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}, externalActions = {}) {
  const createDovyпускMaterialRequests = externalActions.createDovyпускMaterialRequests ||
    (async () => { console.warn('[useProduction] createDovyпускMaterialRequests called before bound') })

  const findExplicitRawMaterialNom = (materialLabel) => findExplicitRawNom(materialLabel, nomenclatures)

${cardsSlice1}

${cardsSlice2}

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
fs.writeFileSync(path.join(outDir, 'productionCards.js'), cardsContent, 'utf8');
console.log('Successfully generated productionCards.js');

// ── 3. productionHandovers.js ──
// Lines 61 to 110 (0-indexed: 60 to 110)
// Lines 1572 to 1578 (0-indexed: 1571 to 1578)
// Lines 2231 to 2785 (0-indexed: 2230 to 2785)
const handoversSlice1 = lines.slice(60, 110).join('\n');
const handoversSlice2 = lines.slice(1571, 1578).join('\n');
const handoversSlice3 = lines.slice(2230, 2785).join('\n');

const handoversContent = `import { supabase } from '../../supabase.js'

export function createProductionHandoversActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
${handoversSlice1}

${handoversSlice2}

${handoversSlice3}

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
fs.writeFileSync(path.join(outDir, 'productionHandovers.js'), handoversContent, 'utf8');
console.log('Successfully generated productionHandovers.js');

// ── 4. productionAuxiliary.js ──
// Lines 111 to 141 (0-indexed: 110 to 141)
// Lines 1579 to 1664 (0-indexed: 1578 to 1664)
// Lines 2786 to 2873 (0-indexed: 2785 to 2873)
const auxSlice1 = lines.slice(110, 141).join('\n');
let auxSlice2 = lines.slice(1578, 1664).join('\n');
// Add ignore comments to empty catch blocks
auxSlice2 = auxSlice2.replace(/catch\s*\((e|_e)\)\s*\{\s*\}/g, 'catch { /* ignore storage error */ }');
const auxSlice3 = lines.slice(2785, 2873).join('\n');

const auxContent = `import { supabase } from '../../supabase.js'

export function createProductionAuxiliaryActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
${auxSlice1}

${auxSlice2}

${auxSlice3}

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
fs.writeFileSync(path.join(outDir, 'productionAuxiliary.js'), auxContent, 'utf8');
console.log('Successfully generated productionAuxiliary.js');
