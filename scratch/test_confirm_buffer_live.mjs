import { supabase } from '../src/supabase.js';
import { createProductionCardsActions } from '../src/contexts/production/productionCards.js';

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

async function runLiveTest() {
  console.log('\n================================================================');
  console.log('🧪 LIVE END-TO-END DATABASE TEST: CONFIRM_BUFFER BLOCKS');
  console.log('================================================================\n');

  const testId = `cb_test_${Date.now()}`;
  let testMachineId = null;
  let testCardId = null;
  let testCutterInvId = null;
  let initialCutterQty = 0;

  try {
    // ── 0. Fetch a live Task and Order for DB foreign key triggers ──
    const { data: liveTask } = await supabase
      .from('tasks')
      .select('id, order_id, plan_snapshot')
      .not('order_id', 'is', null)
      .limit(1)
      .single();

    if (!liveTask) throw new Error('No live task with order_id found');

    // ── 1. Create a dedicated test machine with count = 4 (threshold is 5) ──
    console.log('--- 1. Setting up live Test Machine in Supabase ---');
    const { data: machData, error: machErr } = await supabase
      .from('machines')
      .insert([{
        name: `TEST-CNC-${testId}`,
        completed_cards_count_since_maintenance: 4,
        status: 'working'
      }])
      .select()
      .single();

    if (machErr || !machData) throw new Error('Failed to insert test machine: ' + machErr?.message);
    testMachineId = machData.id;
    console.log(`  Created machine: ${machData.name} (id: ${testMachineId}, initial count: 4)`);

    // ── 2. Pick/Setup Cutter in Inventory ──
    console.log('--- 2. Setting up live Cutter in Inventory ---');
    // Find an actual cutter nomenclature
    const { data: nomCutter } = await supabase
      .from('nomenclatures')
      .select('*')
      .ilike('name', '%Фреза%')
      .eq('type', 'consumable')
      .limit(1)
      .single();

    if (!nomCutter) throw new Error('No cutter consumable found in nomenclatures');

    // Find or create inventory entry for this cutter
    let { data: invCutter } = await supabase
      .from('inventory')
      .select('*')
      .eq('nomenclature_id', nomCutter.id)
      .limit(1)
      .maybeSingle();

    if (!invCutter) {
      const { data: newInv } = await supabase
        .from('inventory')
        .insert([{
          nomenclature_id: nomCutter.id,
          name: nomCutter.name,
          total_qty: 50,
          reserved_qty: 0,
          type: 'consumable',
          warehouse: 'operational'
        }])
        .select()
        .single();
      invCutter = newInv;
    }

    testCutterInvId = invCutter.id;
    initialCutterQty = Number(invCutter.total_qty) || 0;
    console.log(`  Cutter: ${nomCutter.name} (invId: ${testCutterInvId}, initial total_qty: ${initialCutterQty})`);

    // ── 3. Pick a Part Nomenclature & Insert a Test Work Card ──
    console.log('--- 3. Setting up live Work Card for Cutting (Розкрій) ---');
    const { data: nomPart } = await supabase
      .from('nomenclatures')
      .select('*')
      .eq('type', 'part')
      .limit(1)
      .single();

    const { data: cardData, error: cardErr } = await supabase
      .from('work_cards')
      .insert([{
        task_id: liveTask.id,
        order_id: liveTask.order_id,
        nomenclature_id: nomPart?.id || nomCutter.id,
        status: 'waiting-buffer',
        operation: 'Розкрій',
        quantity: 10,
        machine_id: testMachineId,
        machine: machData.name,
        card_info: `[SHOP:1] [MACHINE_ID:${testMachineId}] [REQ:10]`
      }])
      .select()
      .single();

    if (cardErr || !cardData) throw new Error('Failed to insert test work card: ' + cardErr?.message);
    testCardId = cardData.id;
    console.log(`  Created card: ${testCardId} (task_id: ${liveTask.id}, operation: Розкрій, quantity: 10)`);

    // ── 4. Instantiate productionCards with live DB state ──
    console.log('--- 4. Executing confirmBuffer via decomposed productionCards.js ---');
    const mockDeps = {
      orders: [{ id: liveTask.order_id, order_items: [] }],
      tasks: [{ id: liveTask.id, order_id: liveTask.order_id, plan_snapshot: { consumables: [{ name: nomCutter.name, total: 1 }] } }],
      inventory: [invCutter],
      nomenclatures: [nomCutter, nomPart].filter(Boolean),
      bomItems: [],
      workCards: [cardData],
      machineOperations: [],
      machines: [machData],
      systemUsers: [],
      currentUser: { id: 'test-user', login: 'tester' },
      setTasks: () => {},
      setWorkCards: () => {},
      setWorkCardHistory: () => {},
      setManagementTasks: () => {},
      setMachines: () => {},
      normalize: (s) => s,
      refreshTable: () => Promise.resolve(),
      fetchData: () => Promise.resolve(),
      deductIssuedMaterialsForTask: () => Promise.resolve(),
      maintenanceCheckEnabled: true // Enable machine maintenance tracking
    };

    const cardsActions = createProductionCardsActions(mockDeps);

    // Call confirmBuffer with:
    // - 0 scrap
    // - 1 cutter used
    // - cuttersBreakdown specifying 1 unit of this cutter
    await cardsActions.confirmBuffer(
      testCardId,
      0, // scrapData
      1, // cuttersUsed
      { [nomCutter.name]: 1 } // cuttersBreakdown
    );

    console.log('  confirmBuffer completed execution successfully.\n');

    // ── 5. LIVE SUPABASE VERIFICATION: Check Machine Maintenance Block ──
    console.log('--- 5. Verifying Machine Maintenance Threshold in Supabase DB ---');
    const { data: updatedMachine } = await supabase
      .from('machines')
      .select('id, name, completed_cards_count_since_maintenance, status, maintenance_pending_since')
      .eq('id', testMachineId)
      .single();

    assert(
      updatedMachine?.completed_cards_count_since_maintenance === 5,
      `Block 1: Machine completed_cards_count_since_maintenance incremented 4 -> 5 (actual: ${updatedMachine?.completed_cards_count_since_maintenance})`
    );
    assert(
      updatedMachine?.status === 'maintenance_required',
      `Block 1: Machine status set to "maintenance_required" upon hitting 5 cards (actual: ${updatedMachine?.status})`
    );

    const { data: maintLogs } = await supabase
      .from('machine_maintenance_logs')
      .select('*')
      .eq('machine_id', testMachineId);

    assert(
      maintLogs && maintLogs.length > 0 && maintLogs[0].status === 'pending',
      `Block 1: Machine maintenance log record created in "machine_maintenance_logs" with status "pending"`
    );

    // ── 6. LIVE SUPABASE VERIFICATION: Check Cutters Inventory Deduction Block ──
    console.log('\n--- 6. Verifying Cutter Inventory Deduction in Supabase DB ---');
    const { data: updatedInvCutter } = await supabase
      .from('inventory')
      .select('id, total_qty')
      .eq('id', testCutterInvId)
      .single();

    const expectedCutterQty = initialCutterQty - 1;
    assert(
      Number(updatedInvCutter?.total_qty) === expectedCutterQty,
      `Block 2: Cutter inventory total_qty decremented by 1: from ${initialCutterQty} to ${expectedCutterQty} (actual: ${updatedInvCutter?.total_qty})`
    );

    // ── 7. LIVE SUPABASE VERIFICATION: Check Work Card & History Transition ──
    console.log('\n--- 7. Verifying Work Card & History Transition in Supabase DB ---');
    const { data: updatedCard } = await supabase
      .from('work_cards')
      .select('id, status, operation, cutters_used')
      .eq('id', testCardId)
      .single();

    assert(
      updatedCard?.status === 'new' && updatedCard?.operation === 'Галтовка (Вібростіл)',
      `Block 3: Card advanced to next Shop 1 stage: status="new", operation="Галтовка (Вібростіл)" (actual: status="${updatedCard?.status}", op="${updatedCard?.operation}")`
    );
    assert(
      Number(updatedCard?.cutters_used) === 1,
      `Block 3: Card cutters_used recorded as 1 (actual: ${updatedCard?.cutters_used})`
    );

    const { data: historyRows } = await supabase
      .from('work_card_history')
      .select('id, card_id, stage_name, qty_completed, cutters_used')
      .eq('card_id', testCardId);

    assert(
      historyRows && historyRows.length > 0 && historyRows[0].cutters_used === 1,
      `Block 3: Work card history logged stage "Розкрій" with cutters_used = 1`
    );

  } catch (err) {
    console.error('❌ Test execution error:', err);
    failed++;
  } finally {
    // ── Clean Up Test Data from DB ──
    console.log('\n--- Cleaning up temporary live test fixtures from DB ---');
    if (testCardId) {
      await supabase.from('work_card_history').delete().eq('card_id', testCardId);
      await supabase.from('work_cards').delete().eq('id', testCardId);
    }
    if (testMachineId) {
      await supabase.from('machine_maintenance_logs').delete().eq('machine_id', testMachineId);
      await supabase.from('machines').delete().eq('id', testMachineId);
    }
    if (testCutterInvId) {
      await supabase.from('inventory').update({ total_qty: initialCutterQty }).eq('id', testCutterInvId);
    }
    console.log('  Clean up completed.');
  }

  console.log('\n================================================================');
  console.log(`📊 LIVE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runLiveTest();
