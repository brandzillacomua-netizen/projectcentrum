import assert from 'node:assert/strict';
import { resolveFlags } from '../src/domain/shop1Inventory/flags.mjs';
import { assertGenerationApproved } from '../src/domain/shop1Inventory/approvalGateway.mjs';
import { calculateShadow } from '../src/domain/shop1Inventory/shadow.mjs';

const fixture = () => ({
  card: { id: 'card-1', taskId: 'task-1', stage: 'cutting', sheetQty: 3, inventoryFinalized: false },
  sheets: { inventoryId: 'sheet-a', reservationId: 'reserve-a', taskId: 'task-1', physical: 100, reserved: 15, remaining: 15 },
  cutters: [{ inventoryId: 'cutter-a', reservationId: 'reserve-b', taskId: 'task-1', cardId: 'card-1', physical: 10, reserved: 5, remaining: 5, allocated: 2, actual: 1 }],
});
const run = (snapshot) => calculateShadow(snapshot, { shop1_inventory_shadow: true });
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
check('default is disabled and does not inspect snapshots', () => assert.equal(calculateShadow(null), null));
check('every live flag fails closed', () => {
  for (const key of Object.keys(resolveFlags()).filter(k => k.endsWith('_v2'))) assert.throws(() => resolveFlags({ [key]: true }));
  assert.throws(() => resolveFlags({ shop1_inventory_shadow: 'true' }));
  assert.throws(() => resolveFlags({ unknown: true }));
});
check('all 8 approval combinations; partial is rejected', () => {
  for (let mask = 0; mask < 8; mask++) {
    const task = { warehouse_conf: mask & 1 ? 'true' : 'false', engineer_conf: !!(mask & 2), director_conf: !!(mask & 4) };
    if (mask === 7) assert.doesNotThrow(() => assertGenerationApproved(task));
    else assert.throws(() => assertGenerationApproved(task));
  }
  assert.throws(() => assertGenerationApproved({ warehouse_conf: 'partial', engineer_conf: true, director_conf: true }));
});
check('15 sheets minus card 3 leaves 12; free stock stays 85', () => {
  const [sheet, cutter] = run(fixture()).lines;
  assert.equal(sheet.reservationRemainingAfter, 12); assert.equal(sheet.physicalAfter, 97);
  assert.equal(sheet.reservedAfter, 12); assert.equal(sheet.freeAfter, 85);
  assert.equal(cutter.consumed, 1); assert.equal(cutter.unusedReleased, 1);
  assert.equal(cutter.reservedAfter, 3); assert.equal(cutter.physicalAfter, 9);
});
check('later card consumes remaining task reservation', () => {
  const s = fixture(); const previous = run(s).lines[0];
  s.card.id = 'card-2'; s.card.sheetQty = 4; s.cutters = [];
  Object.assign(s.sheets, { physical: previous.physicalAfter, reserved: previous.reservedAfter, remaining: previous.reservationRemainingAfter });
  assert.equal(run(s).lines[0].reservationRemainingAfter, 8);
});
check('other task reserve is preserved', () => {
  const s = fixture(); s.sheets.reserved = 25;
  assert.equal(run(s).lines[0].reservedAfter, 22);
});
check('post-cutting and finalized cards are rejected', () => {
  for (const stage of ['cutting-buffer', 'tumbling', 'sorting', 'completed']) {
    const s = fixture(); s.card.stage = stage; assert.throws(() => run(s));
  }
  const s = fixture(); s.card.inventoryFinalized = true; assert.throws(() => run(s));
});
check('invalid quantities, insufficient reserve, mismatched ownership fail', () => {
  for (const value of [-1, NaN, Infinity, 1.5, '3', 0]) {
    const s = fixture(); s.card.sheetQty = value; assert.throws(() => run(s));
  }
  const s = fixture(); s.sheets.remaining = 2; assert.throws(() => run(s));
  s.sheets.remaining = 15; s.sheets.taskId = 'other'; assert.throws(() => run(s));
  const c = fixture(); c.cutters[0].cardId = 'other'; assert.throws(() => run(c));
  c.cutters[0].cardId = c.card.id; c.cutters[0].actual = 3; assert.throws(() => run(c));
});
check('zero actual releases only this card allocation', () => {
  const s = fixture(); s.cutters[0].actual = 0;
  const c = run(s).lines[1]; assert.equal(c.physicalAfter, 10); assert.equal(c.reservedAfter, 3);
});
check('calculation is deterministic and leaves input untouched', () => {
  const s = fixture(); const before = structuredClone(s);
  assert.deepEqual(run(s), run(s)); assert.deepEqual(s, before);
});
console.log(`${checks} checks passed; no database connection used.`);
