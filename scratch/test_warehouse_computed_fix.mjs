import { getMaterialType } from '../src/modules/Warehouse/hooks/useWarehouseComputed.js';

console.log('Testing getMaterialType function...');

const sheetReq = {
  id: 'fd66cf4b-d731-439a-825f-8ec588b30f72',
  order_id: '62330578-eb54-401c-8258-c2efd660780e',
  task_id: 'aeee6441-e6e4-4112-b570-5bb173107910',
  quantity: 735,
  status: 'pending',
  category: 'sheet',
  target_warehouse: 'operational',
  details: 'СКЛАД ОПЕРАТИВНИЙ: Лист Т700 (3мм) — 735 л.'
};

const resultType = getMaterialType(sheetReq, [], []);
console.log('Sheet request material type:', resultType);
if (resultType === 'raw') {
  console.log('SUCCESS: Sheet request is correctly classified as "raw" (Видача на наряди)!');
} else {
  console.error('FAIL: Sheet request type is', resultType);
}
