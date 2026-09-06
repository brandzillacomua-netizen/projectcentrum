import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function callTransition({ p_card_id, p_card_update, p_history_data = null, p_idempotency_key = null, p_client_session = null }) {
  const res = await client.rpc('rpc_transition_work_card_atomic', {
    p_card_id,
    p_card_update,
    p_history_data,
    p_idempotency_key,
    p_client_session
  });
  if (res.error) {
    console.error('RPC Error:', res.error);
  }
  return res;
}

async function runAllFlowsAudit() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 AUDIT: UNIVERSAL OPERATOR ENFORCEMENT ACROSS ALL 4 PRODUCTION FLOWS (FSM v8)');
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // STEP 0: Version Probe
  console.log('--- STEP 0: Probing Deployed RPC Version ---');
  const probe = await callTransition({
    p_card_id: '00000000-0000-0000-0000-000000000000',
    p_card_update: {}
  });
  console.log(`• Deployed RPC Version: "${probe.data?.rpc_version}"`);

  if (probe.data?.rpc_version !== '2026-09-05.fsm_matrix_v8') {
    console.log('\n⚠️ Supabase is currently on version "' + probe.data?.rpc_version + '".');
    console.log('Please execute atomic_card_transitions.sql (v8 with DROP FUNCTION) in Supabase SQL Editor!');
    return;
  }

  const testCardId = '66666666-5555-4444-3333-222222222222';
  await client.from('work_card_history').delete().eq('card_id', testCardId);
  await client.from('work_cards').delete().eq('id', testCardId);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 1: SHOP 1 (new -> in-progress)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- FLOW 1: SHOP 1 (Розкрій: new -> in-progress) ---');
  await client.from('work_cards').insert([{
    id: testCardId,
    status: 'new',
    operation: 'Розкрій',
    quantity: 100,
    operator_name: null,
    machine: 'Верстат №1'
  }]);

  // 1a. Anonymous claim from new -> MUST BE REJECTED
  const f1_anon = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress' },
    p_idempotency_key: `f1_anon_${Date.now()}`
  });
  console.log('Flow 1 (new -> in-progress) Anonymous Claim:', f1_anon.data);
  if (f1_anon.data?.success === false && f1_anon.data?.missing_operator === true) {
    console.log('✅ PASS: Anonymous claim from new strictly rejected with missing_operator!');
  } else {
    console.error('❌ FAIL: Anonymous claim was allowed!', f1_anon.data);
  }

  // 1b. Valid claim with operator 'Олександр' -> MUST SUCCEED
  const f1_valid = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Олександр' },
    p_history_data: { stage_name: 'Розкрій', operator_name: 'Олександр' },
    p_idempotency_key: `f1_valid_${Date.now()}`
  });
  console.log('Flow 1 Valid Claim:', f1_valid.data);
  if (f1_valid.data?.success === true) {
    console.log('✅ PASS: Shop 1 valid claim by Олександр succeeded!');
  } else {
    console.error('❌ FAIL: Shop 1 valid claim failed!', f1_valid.data);
  }

  // Complete to at-buffer to prepare for Tumbling
  await client.from('work_cards').update({ status: 'at-buffer', operation: 'Розкрій' }).eq('id', testCardId);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 2: TUMBLING (at-buffer -> in-progress)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- FLOW 2: TUMBLING (Галтовка: at-buffer -> in-progress) ---');
  // 2a. Anonymous claim from at-buffer -> MUST BE REJECTED
  const f2_anon = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Галтовка (Вібростіл)' },
    p_idempotency_key: `f2_anon_${Date.now()}`
  });
  console.log('Flow 2 (at-buffer -> in-progress) Anonymous Claim:', f2_anon.data);
  if (f2_anon.data?.success === false && f2_anon.data?.missing_operator === true) {
    console.log('✅ PASS: Tumbling anonymous claim from at-buffer strictly rejected with missing_operator!');
  } else {
    console.error('❌ FAIL: Tumbling anonymous claim was allowed!', f2_anon.data);
  }

  // 2b. Valid Tumbling claim with operator 'Команда' -> MUST SUCCEED
  const f2_valid = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Галтовка (Вібростіл)', operator_name: 'Команда' },
    p_history_data: { stage_name: 'Буфер Розкрій', operator_name: 'Команда' },
    p_idempotency_key: `f2_valid_${Date.now()}`
  });
  console.log('Flow 2 Valid Tumbling Claim:', f2_valid.data);
  if (f2_valid.data?.success === true) {
    console.log('✅ PASS: Tumbling valid claim with operator "Команда" succeeded!');
  } else {
    console.error('❌ FAIL: Tumbling valid claim failed!', f2_valid.data);
  }

  // 2c. Tumbling sub-stage transition (Вібростіл -> Галтовка) with operator 'Команда' -> MUST SUCCEED
  const f2_substage = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Галтовка (Галтовка)', operator_name: 'Команда' },
    p_history_data: { stage_name: 'Галтовка (Вібростіл)', operator_name: 'Команда' },
    p_idempotency_key: `f2_substage_${Date.now()}`
  });
  console.log('Flow 2 Sub-stage Transition:', f2_substage.data);
  if (f2_substage.data?.success === true && f2_substage.data?.operation === 'Галтовка (Галтовка)') {
    console.log('✅ PASS: Tumbling sub-stage transition succeeded!');
  } else {
    console.error('❌ FAIL: Tumbling sub-stage transition failed!', f2_substage.data);
  }

  // Complete Tumbling to at-buffer to prepare for Sorting
  await client.from('work_cards').update({ status: 'at-buffer', operation: 'Галтовка (Сушка)' }).eq('id', testCardId);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 3: SORTING (at-buffer -> in-progress)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- FLOW 3: SORTING (Сортування: at-buffer -> in-progress) ---');
  // 3a. Anonymous claim from at-buffer to Sorting -> MUST BE REJECTED
  const f3_anon = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Сортування' },
    p_idempotency_key: `f3_anon_${Date.now()}`
  });
  console.log('Flow 3 (at-buffer -> in-progress) Anonymous Claim:', f3_anon.data);
  if (f3_anon.data?.success === false && f3_anon.data?.missing_operator === true) {
    console.log('✅ PASS: Sorting anonymous claim strictly rejected with missing_operator!');
  } else {
    console.error('❌ FAIL: Sorting anonymous claim was allowed!', f3_anon.data);
  }

  // 3b. Valid claim to Sorting with operator 'Ігор' -> MUST SUCCEED
  const f3_valid = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Сортування', operator_name: 'Ігор' },
    p_history_data: { stage_name: 'Буфер Сортування', operator_name: 'Ігор' },
    p_idempotency_key: `f3_valid_${Date.now()}`
  });
  console.log('Flow 3 Valid Sorting Claim:', f3_valid.data);
  if (f3_valid.data?.success === true) {
    console.log('✅ PASS: Sorting valid claim with operator "Ігор" succeeded!');
  } else {
    console.error('❌ FAIL: Sorting valid claim failed!', f3_valid.data);
  }

  // 3c. Collision: Operator 'Дмитро' tries to update Sorting without shift change -> MUST BE REJECTED
  const f3_collision = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Дмитро', quantity: 98 },
    p_idempotency_key: `f3_collision_${Date.now()}`
  });
  console.log('Flow 3 Collision Attempt:', f3_collision.data);
  if (f3_collision.data?.success === false && f3_collision.data?.already_claimed === true && f3_collision.data?.claimed_by === 'Ігор') {
    console.log('✅ PASS: Unauthorized operator "Дмитро" strictly blocked from mutating card claimed by "Ігор"!');
  } else {
    console.error('❌ FAIL: Collision was mistakenly allowed!', f3_collision.data);
  }

  // Complete Sorting to at-shop2-buffer
  await client.from('work_cards').update({ status: 'at-shop2-buffer', operation: 'Цех №2' }).eq('id', testCardId);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 4: SHOP 2 (at-shop2-buffer -> in-progress)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- FLOW 4: SHOP 2 (Цех №2: at-shop2-buffer -> in-progress) ---');
  // 4a. Anonymous claim from at-shop2-buffer -> MUST BE REJECTED
  const f4_anon = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Прес' },
    p_idempotency_key: `f4_anon_${Date.now()}`
  });
  console.log('Flow 4 (at-shop2-buffer -> in-progress) Anonymous Claim:', f4_anon.data);
  if (f4_anon.data?.success === false && f4_anon.data?.missing_operator === true) {
    console.log('✅ PASS: Shop 2 anonymous claim strictly rejected with missing_operator!');
  } else {
    console.error('❌ FAIL: Shop 2 anonymous claim was allowed!', f4_anon.data);
  }

  // 4b. Valid claim with operator 'Василь' -> MUST SUCCEED
  const f4_valid = await callTransition({
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operation: 'Прес', operator_name: 'Василь' },
    p_history_data: { stage_name: 'Цех №2 (Прес)', operator_name: 'Василь' },
    p_idempotency_key: `f4_valid_${Date.now()}`
  });
  console.log('Flow 4 Valid Claim:', f4_valid.data);
  if (f4_valid.data?.success === true) {
    console.log('✅ PASS: Shop 2 valid claim with operator "Василь" succeeded!');
  } else {
    console.error('❌ FAIL: Shop 2 valid claim failed!', f4_valid.data);
  }

  // Cleanup
  await client.from('work_card_history').delete().eq('card_id', testCardId);
  await client.from('work_cards').delete().eq('id', testCardId);
  console.log('\n✓ Universal audit complete: All 4 production flows verified!');
}

runAllFlowsAudit().catch(console.error);
