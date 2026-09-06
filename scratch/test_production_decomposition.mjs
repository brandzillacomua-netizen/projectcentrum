import { createProductionActions } from '../src/contexts/useProduction.js';
import { createProductionOrdersActions } from '../src/contexts/production/productionOrders.js';
import { createProductionCardsActions } from '../src/contexts/production/productionCards.js';
import { createProductionHandoversActions } from '../src/contexts/production/productionHandovers.js';
import { createProductionAuxiliaryActions } from '../src/contexts/production/productionAuxiliary.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 VERIFYING USEPRODUCTION DECOMPOSITION (API & PARITY)');
  console.log('================================================================\n');

  // Mock dependency bag representing MESContext
  const mockDeps = {
    orders: [{ id: 'ord-1', order_num: 'ORD-001', status: 'in-progress' }],
    tasks: [{ id: 'task-1', order_id: 'ord-1', step: 'Розкрій', status: 'waiting' }],
    inventory: [{ id: 'inv-1', name: 'Деталь', total_qty: 10 }],
    nomenclatures: [{ id: 'nom-1', name: 'Деталь', type: 'material' }],
    bomItems: [],
    workCards: [{ id: 'card-1', order_id: 'ord-1', status: 'new', operation: 'Розкрій', quantity: 10 }],
    machineOperations: [],
    machines: [],
    systemUsers: [],
    currentUser: { id: 'usr-1', login: 'admin', role: 'admin' },
    setTasks: () => {},
    setWorkCards: () => {},
    setWorkCardHistory: () => {},
    setManagementTasks: () => {},
    setMachines: () => {},
    normalize: (s) => s,
    refreshTable: () => Promise.resolve(),
    fetchData: () => Promise.resolve(),
    deductIssuedMaterialsForTask: () => Promise.resolve(),
    maintenanceCheckEnabled: false
  };

  // --- 1. Test Sub-Action Creators Instantiation ---
  console.log('--- 1. Testing Submodule Action Creators ---');
  const ordersActions = createProductionOrdersActions(mockDeps);
  assert(typeof ordersActions.addOrder === 'function', 'productionOrders.addOrder is a function');
  assert(typeof ordersActions.updateOrder === 'function', 'productionOrders.updateOrder is a function');
  assert(typeof ordersActions.deleteOrder === 'function', 'productionOrders.deleteOrder is a function');
  assert(typeof ordersActions.superDeleteOrder === 'function', 'productionOrders.superDeleteOrder is a function');
  assert(typeof ordersActions.getOrderProductionProgress === 'function', 'productionOrders.getOrderProductionProgress is a function');
  assert(typeof ordersActions.createDovyпускMaterialRequests === 'function', 'productionOrders.createDovyпускMaterialRequests is a function');

  const cardsActions = createProductionCardsActions(mockDeps);
  assert(typeof cardsActions.createWorkCard === 'function', 'productionCards.createWorkCard is a function');
  assert(typeof cardsActions.createWorkCardsBatch === 'function', 'productionCards.createWorkCardsBatch is a function');
  assert(typeof cardsActions.startWorkCard === 'function', 'productionCards.startWorkCard is a function');
  assert(typeof cardsActions.completeWorkCard === 'function', 'productionCards.completeWorkCard is a function');
  assert(typeof cardsActions.confirmBuffer === 'function', 'productionCards.confirmBuffer is a function');
  assert(typeof cardsActions.createNaryad === 'function', 'productionCards.createNaryad is a function');

  const handoversActions = createProductionHandoversActions(mockDeps);
  assert(typeof handoversActions.approveWarehouse === 'function', 'productionHandovers.approveWarehouse is a function');
  assert(typeof handoversActions.approveEngineer === 'function', 'productionHandovers.approveEngineer is a function');
  assert(typeof handoversActions.approveDirector === 'function', 'productionHandovers.approveDirector is a function');
  assert(typeof handoversActions.handoverTaskToShop2 === 'function', 'productionHandovers.handoverTaskToShop2 is a function');
  assert(typeof handoversActions.cancelHandoverToShop2 === 'function', 'productionHandovers.cancelHandoverToShop2 is a function');
  assert(typeof handoversActions.completeTaskShop2 === 'function', 'productionHandovers.completeTaskShop2 is a function');
  assert(typeof handoversActions.directHandoverToSGP === 'function', 'productionHandovers.directHandoverToSGP is a function');
  assert(typeof handoversActions.handoverToSGP === 'function', 'productionHandovers.handoverToSGP is a function');
  assert(typeof handoversActions.reserveBZForTask === 'function', 'productionHandovers.reserveBZForTask is a function');
  assert(typeof handoversActions.completePackaging === 'function', 'productionHandovers.completePackaging is a function');
  assert(typeof handoversActions.completeTaskByMaster === 'function', 'productionHandovers.completeTaskByMaster is a function');

  const auxiliaryActions = createProductionAuxiliaryActions(mockDeps);
  assert(typeof auxiliaryActions.upsertNomenclature === 'function', 'productionAuxiliary.upsertNomenclature is a function');
  assert(typeof auxiliaryActions.deleteNomenclature === 'function', 'productionAuxiliary.deleteNomenclature is a function');
  assert(typeof auxiliaryActions.saveBOM === 'function', 'productionAuxiliary.saveBOM is a function');
  assert(typeof auxiliaryActions.removeBOM === 'function', 'productionAuxiliary.removeBOM is a function');
  assert(typeof auxiliaryActions.syncBOM === 'function', 'productionAuxiliary.syncBOM is a function');
  assert(typeof auxiliaryActions.addManagementTask === 'function', 'productionAuxiliary.addManagementTask is a function');
  assert(typeof auxiliaryActions.updateManagementTask === 'function', 'productionAuxiliary.updateManagementTask is a function');
  assert(typeof auxiliaryActions.deleteManagementTask === 'function', 'productionAuxiliary.deleteManagementTask is a function');
  assert(typeof auxiliaryActions.addMachine === 'function', 'productionAuxiliary.addMachine is a function');
  assert(typeof auxiliaryActions.updateMachine === 'function', 'productionAuxiliary.updateMachine is a function');
  assert(typeof auxiliaryActions.deleteMachine === 'function', 'productionAuxiliary.deleteMachine is a function');
  assert(typeof auxiliaryActions.disposeScrapItem === 'function', 'productionAuxiliary.disposeScrapItem is a function');
  assert(typeof auxiliaryActions.createReworkNaryad === 'function', 'productionAuxiliary.createReworkNaryad is a function');

  // --- 2. Test Facade createProductionActions Full Parity ---
  console.log('\n--- 2. Testing Orchestrator Facade (useProduction.js) Full Parity ---');
  const facadeActions = createProductionActions(mockDeps);

  const requiredFacadeSymbols = [
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

  requiredFacadeSymbols.forEach((sym) => {
    assert(typeof facadeActions[sym] === 'function', `Facade exposes ${sym} as a function`);
  });

  // --- 3. Functional Call Test ---
  console.log('\n--- 3. Testing Pure Logic / Progress Calculation ---');
  const progress = facadeActions.getOrderProductionProgress('ord-1');
  assert(progress !== undefined && typeof progress === 'object', 'getOrderProductionProgress executes without error and returns object');
  console.log('    Order progress result:', progress);

  console.log('\n================================================================');
  console.log(`📊 DECOMPOSITION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
