import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

// Physical Tablet 1 shared by Oleksandr and Dmytro (same hardware device ID)
const SHARED_TABLET_DEVICE_ID = 'dev_tablet_shared_hardware_01';

const tabletClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function runSharedTabletShiftChangeAudit() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 AUDIT: SHARED TABLET SHIFT CHANGE & MANDATORY OPERATOR IDENTITY (FSM v7)');
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log(`📱 Hardware Device: "${SHARED_TABLET_DEVICE_ID}" (Shared across shifts)`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // STEP 1: Version Probe
  console.log('--- STEP 1: Probing Deployed RPC Version ---');
  const probe = await tabletClient.rpc('rpc_transition_work_card_atomic', {
    p_card_id: '00000000-0000-0000-0000-000000000000',
    p_card_update: {},
    p_history_data: null,
    p_idempotency_key: null,
    p_client_session: SHARED_TABLET_DEVICE_ID
  });
  console.log(`• Deployed RPC Version: "${probe.data?.rpc_version}"`);

  if (!['2026-09-05.fsm_matrix_v7', '2026-09-05.fsm_matrix_v8'].includes(probe.data?.rpc_version)) {
    console.log('\n⚠️ Supabase is currently on version "' + probe.data?.rpc_version + '".');
    console.log('Please execute atomic_card_transitions.sql (v8) in Supabase SQL Editor to activate strict operator checks!');
    return;
  }

  const testCardId = '77777777-6666-5555-4444-333333333333';
  await tabletClient.from('work_card_history').delete().eq('card_id', testCardId);
  await tabletClient.from('work_cards').delete().eq('id', testCardId);

  // Setup fresh card in DB
  await tabletClient.from('work_cards').insert([{
    id: testCardId,
    status: 'new',
    operation: 'Розкрій',
    quantity: 50,
    operator_name: null,
    machine: 'Верстат №1',
    card_info: '[BASE_NARYAD_TEST]'
  }]);

  // SCENARIO STEP 1: Oleksandr claims card on Tablet 1
  console.log('\n--- SCENARIO 1: Oleksandr claims card on Tablet 1 ---');
  const claimRes = await tabletClient.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Олександр' },
    p_history_data: { stage_name: 'Розкрій', operator_name: 'Олександр' },
    p_idempotency_key: `claim_oleksandr_${Date.now()}`,
    p_client_session: SHARED_TABLET_DEVICE_ID
  });
  console.log('Claim result:', claimRes.data);
  if (claimRes.data?.success === true && claimRes.data?.status === 'in-progress') {
    console.log('✓ Card claimed by Олександр on Tablet 1');
  } else {
    console.error('❌ Failed to claim card:', claimRes.data);
    process.exit(1);
  }

  // SCENARIO STEP 2: Formal Shift Change to Dmytro on the SAME Tablet 1
  console.log('\n--- SCENARIO 2: Formal Shift Change to Dmytro on the SAME Tablet 1 ---');
  const shiftChangeRes = await tabletClient.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { 
      operator_name: 'Дмитро', 
      shift_name: 'Зміна 2',
      card_info: '[REPLACED_BY:Дмитро (Зміна 2)]' 
    },
    p_history_data: { 
      stage_name: 'Розкрій (перезмінка)', 
      operator_name: 'Дмитро',
      shift_name: 'Зміна 2'
    },
    p_idempotency_key: `shift_change_${Date.now()}`,
    p_client_session: SHARED_TABLET_DEVICE_ID
  });
  console.log('Shift Change result:', shiftChangeRes.data);
  if (shiftChangeRes.data?.success === true) {
    console.log('✓ Formal shift change successful: Card transferred to Дмитро');
  } else {
    console.error('❌ Shift change failed:', shiftChangeRes.data);
    process.exit(1);
  }

  // SCENARIO STEP 3: Dmytro on the SAME Tablet 1 sends mutation WITHOUT operator_name -> MUST BE STRICTLY REJECTED!
  console.log('\n--- SCENARIO 3: Dmytro on SAME Tablet 1 sends mutation WITHOUT operator_name ---');
  const anonUpdateRes = await tabletClient.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', quantity: 48 }, // No operator_name!
    p_history_data: null,
    p_idempotency_key: `anon_update_${Date.now()}`,
    p_client_session: SHARED_TABLET_DEVICE_ID // Same physical tablet!
  });
  console.log('Anonymous update result:', anonUpdateRes.data);

  if (anonUpdateRes.data?.success === false && anonUpdateRes.data?.missing_operator === true) {
    console.log('✅ TEST PASSED: Anonymous mutation strictly rejected as missing_operator despite identical Tablet Device ID!');
  } else {
    console.error('❌ TEST FAILED: Loophole detected! Server allowed mutation without operator name:', anonUpdateRes.data);
  }

  // SCENARIO STEP 4: Dmytro sends mutation WITH his confirmed operator_name -> MUST SUCCEED
  console.log('\n--- SCENARIO 4: Dmytro sends mutation WITH confirmed operator_name "Дмитро" ---');
  const validUpdateRes = await tabletClient.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Дмитро', quantity: 48 },
    p_history_data: null,
    p_idempotency_key: `dmytro_update_${Date.now()}`,
    p_client_session: SHARED_TABLET_DEVICE_ID
  });
  console.log('Valid update result:', validUpdateRes.data);

  if (validUpdateRes.data?.success === true) {
    console.log('✅ TEST PASSED: Confirmed owner "Дмитро" successfully updated the card!');
  } else {
    console.error('❌ TEST FAILED: Dmytro was rejected!', validUpdateRes.data);
  }

  // SCENARIO STEP 5: Oleksandr (previous operator) tries to mutate the card without formal shift change -> MUST BE REJECTED!
  console.log('\n--- SCENARIO 5: Oleksandr (previous operator) tries to mutate without shift change ---');
  const oleksandrHijackRes = await tabletClient.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Олександр', quantity: 45 },
    p_history_data: null,
    p_idempotency_key: `oleksandr_hijack_${Date.now()}`,
    p_client_session: SHARED_TABLET_DEVICE_ID
  });
  console.log('Previous operator update result:', oleksandrHijackRes.data);

  if (oleksandrHijackRes.data?.success === false && oleksandrHijackRes.data?.already_claimed === true && oleksandrHijackRes.data?.claimed_by === 'Дмитро') {
    console.log('✅ TEST PASSED: Previous operator "Олександр" strictly rejected as card is owned by "Дмитро"!');
  } else {
    console.error('❌ TEST FAILED: Previous operator was allowed to overwrite!', oleksandrHijackRes.data);
  }

  // Cleanup
  await tabletClient.from('work_card_history').delete().eq('card_id', testCardId);
  await tabletClient.from('work_cards').delete().eq('id', testCardId);
  console.log('\n✓ Cleanup complete.');
}

runSharedTabletShiftChangeAudit().catch(console.error);
