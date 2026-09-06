import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8', 'x-client-session': 'tablet-A' } }
});

const clientB = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8', 'x-client-session': 'tablet-B' } }
});

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 AUDIT: VERIFIABLE IDENTITY (FSM v5) & LOUD FALLBACK DETECTION');
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // STEP 1: Probe versions
  console.log('--- STEP 1: Probing Deployed RPC Versions ---');
  const probeFsm = await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: '00000000-0000-0000-0000-000000000000',
    p_card_update: {},
    p_history_data: null,
    p_idempotency_key: null,
    p_client_session: null
  });
  console.log(`• rpc_transition_work_card_atomic version: "${probeFsm.data?.rpc_version}"`);

  if (probeFsm.data?.rpc_version !== '2026-09-05.fsm_matrix_v5') {
    console.warn(`⚠️ rpc_transition_work_card_atomic is currently "${probeFsm.data?.rpc_version}". Please run atomic_card_transitions.sql to upgrade to v5!`);
    return;
  }

  const testCardId = '88888888-7777-6666-5555-444444444444';
  await clientA.from('work_card_history').delete().eq('card_id', testCardId);
  await clientA.from('work_cards').delete().eq('id', testCardId);

  const { error: insertError } = await clientA.from('work_cards').insert([{
    id: testCardId,
    status: 'new',
    operation: 'Розкрій',
    quantity: 50,
    operator_name: null,
    machine: 'Верстат №1',
    card_info: '[TEST_CARD_FSM_V5]'
  }]);

  if (insertError) {
    console.error('Failed to insert test card:', insertError);
    process.exit(1);
  }
  console.log(`✓ Test card created: #${testCardId} (status: "new", operation: "Розкрій")`);

  // 1. Tablet A takes card into work with session 'tablet-A' and operator 'Олександр'
  console.log('\n--- STEP 2: Tablet A Claims Card with Session "tablet-A" ---');
  const claimRes = await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Олександр' },
    p_history_data: { stage_name: 'Розкрій', operator_name: 'Олександр' },
    p_idempotency_key: `claim_${Date.now()}`,
    p_client_session: 'tablet-A'
  });
  console.log('Claim result:', claimRes.data);

  // 2. Tablet A sends update WITHOUT operator_name, but WITH session 'tablet-A' -> MUST SUCCEED
  console.log('\n--- TEST 1: Tablet A updates WITHOUT operator_name, but WITH session "tablet-A" ---');
  const resSameSession = await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', quantity: 42 },
    p_history_data: null,
    p_idempotency_key: `update_a_${Date.now()}`,
    p_client_session: 'tablet-A'
  });
  console.log('Result Tablet A update:', resSameSession.data);
  if (resSameSession.data?.success === true) {
    console.log('✅ TEST 1 PASSED: Verified session "tablet-A" authorized in-progress mutation!');
  } else {
    console.error('❌ TEST 1 FAILED:', resSameSession.data);
  }

  // 3. Tablet B sends update WITHOUT operator_name and WITH session 'tablet-B' -> MUST BE REJECTED!
  console.log('\n--- TEST 2: Tablet B (unauthorized) sends update WITHOUT operator_name and session "tablet-B" ---');
  const resWrongSession = await clientB.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', quantity: 1 },
    p_history_data: null,
    p_idempotency_key: `update_b_${Date.now()}`,
    p_client_session: 'tablet-B'
  });
  console.log('Result Tablet B unauthorized update:', resWrongSession.data);
  if (resWrongSession.data?.success === false && resWrongSession.data?.already_claimed === true && resWrongSession.data?.claimed_by === 'Олександр') {
    console.log('✅ TEST 2 PASSED: Unauthorized foreign session "tablet-B" strictly rejected as already_claimed!');
  } else {
    console.error('❌ TEST 2 FAILED: Unauthorized session was mistakenly allowed!', resWrongSession.data);
  }

  // 4. Anonymous request WITHOUT operator_name and WITHOUT session -> MUST BE REJECTED!
  console.log('\n--- TEST 3: Anonymous request WITHOUT operator_name and WITHOUT session ---');
  const resAnonymous = await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', quantity: 2 },
    p_history_data: null,
    p_idempotency_key: `update_anon_${Date.now()}`,
    p_client_session: null
  });
  console.log('Result Anonymous update:', resAnonymous.data);
  if (resAnonymous.data?.success === false && resAnonymous.data?.already_claimed === true) {
    console.log('✅ TEST 3 PASSED: Anonymous status assertion without session proof strictly rejected!');
  } else {
    console.error('❌ TEST 3 FAILED: Anonymous update was mistakenly allowed!', resAnonymous.data);
  }

  // Cleanup
  await clientA.from('work_card_history').delete().eq('card_id', testCardId);
  await clientA.from('work_cards').delete().eq('id', testCardId);
  console.log('\n✓ Cleanup complete.');
}

runAudit().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
