if (typeof window === 'undefined') {
  global.window = {
    Date: global.Date,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    dispatchEvent: () => {},
    location: { href: 'http://localhost' }
  };
}

import { createClient } from '@supabase/supabase-js';
import { processOfflineMutation } from '../src/services/offlineProcessor.js';
import { incrementInventoryStock } from '../src/services/inventoryStockService.js';
import { sentryLogger } from '../src/services/sentryLogger.js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

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
  console.log('🧪 VERIFYING STAGE P1: DATA RELIABILITY & INVENTORY ATOMICITY');
  console.log('================================================================\n');

  // --- 1. Sentry Noise Filter Verification ---
  console.log('--- 1. Testing Chrome DevTools Live Metrics Noise Filter ---');
  sentryLogger.clearErrorBuffer();
  
  const devToolsFakeError = new TypeError("Cannot read properties of undefined (reading 'startTime')");
  devToolsFakeError.stack = "TypeError: Cannot read properties of undefined (reading 'startTime')\n    at et.reportAllChanges (<anonymous>:2:19429)";
  
  const capturedResult = sentryLogger.captureException(devToolsFakeError);
  assert(capturedResult === null, 'DevTools Live Metrics startTime error is intercepted and ignored');
  assert(sentryLogger.getRecentErrors().length === 0, 'Recent error buffer remains clean (0 pollution)');

  const realAppError = new Error('Test real MES application error');
  const realCapture = sentryLogger.captureException(realAppError);
  assert(realCapture !== null && realCapture.id !== undefined, 'Real MES errors continue to be captured normally');
  assert(sentryLogger.getRecentErrors().length === 1, 'Real error is safely buffered in ring buffer');
  sentryLogger.clearErrorBuffer();

  // --- 2. Inventory Stock Increment Verification ---
  console.log('\n--- 2. Testing Centralized Inventory Stock Service ---');
  // Find a valid nomenclature ID from database
  const { data: testNom, error: nomError } = await client.from('nomenclatures').select('id, name, unit').limit(1).single();
  assert(!nomError && testNom?.id, `Fetched active nomenclature for inventory test (${testNom?.name || 'N/A'})`);

  if (testNom?.id) {
    // Check initial stock
    const { data: initInv } = await client.from('inventory')
      .select('id, total_qty')
      .eq('nomenclature_id', testNom.id)
      .eq('type', 'scrap_ready')
      .maybeSingle();

    const startQty = Number(initInv?.total_qty || 0);

    // Perform atomic increment of 2 units
    const incRes = await incrementInventoryStock({
      nomenclatureId: testNom.id,
      qty: 2,
      type: 'scrap_ready',
      itemName: testNom.name,
      unit: testNom.unit || 'шт'
    });

    assert(incRes.success === true, `incrementInventoryStock completed successfully (viaRpc: ${incRes.viaRpc})`);

    // Verify DB reflection
    const { data: updatedInv } = await client.from('inventory')
      .select('id, total_qty')
      .eq('nomenclature_id', testNom.id)
      .eq('type', 'scrap_ready')
      .maybeSingle();

    const endQty = Number(updatedInv?.total_qty || 0);
    assert(endQty === startQty + 2, `Inventory total_qty correctly incremented from ${startQty} to ${endQty} (+2)`);

    // Revert the 2 units so test is non-destructive
    if (updatedInv?.id) {
      await client.from('inventory').update({ total_qty: startQty }).eq('id', updatedInv.id);
      console.log('  ℹ️ Restored test inventory quantity back to original baseline');
    }
  }

  // --- 3. Offline Processor Replay & Reconciliation ---
  console.log('\n--- 3. Testing Offline Processor Reconciliation ---');
  // Find a testable work card
  const { data: activeCard, error: cardError } = await client.from('work_cards')
    .select('id, status, operation, operator_name, quantity')
    .limit(1)
    .single();

  assert(!cardError && activeCard?.id, `Fetched live work card for offline processor test: ${activeCard?.id?.slice(0, 8)}`);

  if (activeCard?.id) {
    // Test 3a: Conflicting offline mutation replay (e.g. attempting to start in-progress without operator)
    const conflictItem = {
      actionType: 'START_WORK_CARD',
      key: `offline_test_conflict_${Date.now()}`,
      payload: {
        cardId: activeCard.id,
        updateData: {
          status: 'in-progress',
          operator_name: '' // Missing operator violates FSM v8 Operator Guard!
        }
      }
    };

    const conflictRes = await processOfflineMutation(conflictItem);
    assert(
      conflictRes.success === true && (conflictRes.conflict === true || conflictRes.warning !== undefined),
      'Offline replay with invalid transition safely detects conflict without crashing or jamming queue'
    );

    // Test 3b: Valid idempotent replay
    const validKey = `offline_test_idempotent_${Date.now()}`;
    const testItem = {
      actionType: 'START_WORK_CARD',
      key: validKey,
      payload: {
        cardId: activeCard.id,
        updateData: {
          status: activeCard.status, // preserve current status
          operator_name: activeCard.operator_name || 'Тест Офлайн'
        }
      }
    };

    const replayRes = await processOfflineMutation(testItem);
    assert(replayRes.success === true, 'Offline processor processes valid card replay smoothly');
  }

  console.log('\n================================================================');
  console.log(`📊 STAGE P1 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
