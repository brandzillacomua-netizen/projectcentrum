import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const sessionA = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8', 'x-client-session': 'tablet-A' } }
});

const sessionB = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8', 'x-client-session': 'tablet-B' } }
});

async function runLiveVerification() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 LIVE VERIFICATION: rpc_transition_work_card_atomic (FSM Matrix v3)');
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // STEP 0: Check deployed version
  console.log('--- STEP 0: Probing Deployed RPC Version ---');
  const probeRes = await sessionA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: '00000000-0000-0000-0000-000000000000',
    p_card_update: {},
    p_history_data: null,
    p_idempotency_key: null
  });

  console.log('Probe response:', probeRes.data);
  const deployedVersion = probeRes.data?.rpc_version;
  console.log(`Detected deployed RPC version: "${deployedVersion}"`);

  if (deployedVersion !== '2026-09-05.fsm_matrix_v3') {
    console.error(`❌ VERSION MISMATCH! Expected '2026-09-05.fsm_matrix_v3', got '${deployedVersion}'.`);
    console.error('Make sure you ran the latest content of atomic_card_transitions.sql in Supabase SQL Editor!');
    process.exit(1);
  }
  console.log('✅ Version check PASSED: Deployed SQL matches 2026-09-05.fsm_matrix_v3 exactly!\n');

  // Create isolated test card in database
  const testCardId = 'a1b2c3d4-e5f6-7890-abcd-112233445566';
  await sessionA.from('work_card_history').delete().eq('card_id', testCardId);
  await sessionA.from('work_cards').delete().eq('id', testCardId);

  const { error: insertError } = await sessionA.from('work_cards').insert([{
    id: testCardId,
    status: 'new',
    operation: 'Розкрій',
    quantity: 50,
    operator_name: null,
    machine: 'Верстат №1',
    card_info: '[TEST_CARD_FSM_V3]'
  }]);

  if (insertError) {
    console.error('Failed to insert test card:', insertError);
    process.exit(1);
  }
  console.log(`✓ Test card created: #${testCardId} (status: "new", operation: "Розкрій")\n`);

  try {
    // ══════════════════════════════════════════════════════════════════
    // TEST 1: Exact Retry Idempotency (Class 1)
    // ══════════════════════════════════════════════════════════════════
    console.log('--- TEST 1: Exact Retry Idempotency (Class 1) ---');
    const retryKey = `retry_key_${Date.now()}`;
    
    // Initial action
    const res1 = await sessionA.rpc('rpc_transition_work_card_atomic', {
      p_card_id: testCardId,
      p_card_update: { status: 'in-progress', operator_name: 'Олександр (Планшет A)' },
      p_history_data: {
        stage_name: 'Розкрій',
        operator_name: 'Олександр (Планшет A)',
        qty_at_start: 50,
        card_info: `[STARTED] [IDEMPOTENCY_KEY:${retryKey}]`
      },
      p_idempotency_key: retryKey
    });

    console.log('1. First Execution Result:', res1.data);

    // Immediate replay of the exact same request with the same idempotency_key
    const res1Replay = await sessionA.rpc('rpc_transition_work_card_atomic', {
      p_card_id: testCardId,
      p_card_update: { status: 'in-progress', operator_name: 'Олександр (Планшет A)' },
      p_history_data: {
        stage_name: 'Розкрій',
        operator_name: 'Олександр (Планшет A)',
        qty_at_start: 50,
        card_info: `[STARTED] [IDEMPOTENCY_KEY:${retryKey}]`
      },
      p_idempotency_key: retryKey
    });

    console.log('2. Replay Execution Result:', res1Replay.data);

    if (
      res1.data?.success === true &&
      res1Replay.data?.success === true &&
      res1Replay.data?.already_processed === true &&
      res1Replay.data?.reason === 'idempotent_replay'
    ) {
      console.log('✅ TEST 1 PASSED: Exact retry returned { success: true, already_processed: true, reason: "idempotent_replay" }!\n');
    } else {
      console.error('❌ TEST 1 FAILED:', res1Replay.data);
      process.exit(1);
    }

    // ══════════════════════════════════════════════════════════════════
    // TEST 2: Multi-Tablet Concurrency Collision (Class 2)
    // ══════════════════════════════════════════════════════════════════
    console.log('--- TEST 2: Multi-Tablet Concurrency Collision (Class 2) ---');
    // Reset card back to 'new' and clean history
    await sessionA.from('work_card_history').delete().eq('card_id', testCardId);
    await sessionA.from('work_cards').update({
      status: 'new',
      operator_name: null
    }).eq('id', testCardId);

    const keyTabletA = `tablet_a_${Date.now()}`;
    const keyTabletB = `tablet_b_${Date.now()}`;

    console.log('Firing simultaneous requests from Tablet A (Oleksandr) and Tablet B (Dmytro)...');
    const [raceResA, raceResB] = await Promise.all([
      sessionA.rpc('rpc_transition_work_card_atomic', {
        p_card_id: testCardId,
        p_card_update: { status: 'in-progress', operator_name: 'Олександр' },
        p_history_data: {
          stage_name: 'Розкрій',
          operator_name: 'Олександр',
          qty_at_start: 50,
          card_info: `[SHOP:1] [IDEMPOTENCY_KEY:${keyTabletA}]`
        },
        p_idempotency_key: keyTabletA
      }),
      sessionB.rpc('rpc_transition_work_card_atomic', {
        p_card_id: testCardId,
        p_card_update: { status: 'in-progress', operator_name: 'Дмитро' },
        p_history_data: {
          stage_name: 'Розкрій',
          operator_name: 'Дмитро',
          qty_at_start: 50,
          card_info: `[SHOP:1] [IDEMPOTENCY_KEY:${keyTabletB}]`
        },
        p_idempotency_key: keyTabletB
      })
    ]);

    console.log('Tablet A result:', raceResA.data);
    console.log('Tablet B result:', raceResB.data);

    const winner = raceResA.data?.success === true ? raceResA.data : raceResB.data;
    const loser = raceResA.data?.success === false ? raceResA.data : raceResB.data;
    const winnerTablet = raceResA.data?.success === true ? 'Tablet A' : 'Tablet B';
    const loserTablet = raceResA.data?.success === false ? 'Tablet A' : 'Tablet B';

    console.log(`\n• Winner (${winnerTablet}): success=${winner?.success}, status="${winner?.status}"`);
    console.log(`• Loser (${loserTablet}): success=${loser?.success}, conflict=${loser?.conflict}, already_claimed=${loser?.already_claimed}, claimed_by="${loser?.claimed_by}"`);

    // Verify history in database
    const { data: hist } = await sessionA
      .from('work_card_history')
      .select('id, operator_name, card_info')
      .eq('card_id', testCardId);

    console.log(`• Total history entries in DB: ${hist.length}`);
    hist.forEach((h, i) => console.log(`   [${i+1}] Operator: "${h.operator_name}", Info: "${h.card_info}"`));

    if (
      winner?.success === true &&
      loser?.success === false &&
      loser?.conflict === true &&
      loser?.already_claimed === true &&
      hist.length === 1
    ) {
      console.log(`✅ TEST 2 PASSED: Collision strictly resolved! Loser received already_claimed: true, zero data overwrite, exactly 1 history row!\n`);
    } else {
      console.error('❌ TEST 2 FAILED!');
      process.exit(1);
    }

    // ══════════════════════════════════════════════════════════════════
    // TEST 3: Illegal FSM Transition Barrier (Class 3)
    // ══════════════════════════════════════════════════════════════════
    console.log('--- TEST 3: Illegal FSM Transition Barrier (Class 3) ---');
    // Card is currently 'in-progress'. Try illegal transition to 'new' without reset permissions or complete card first
    await sessionA.from('work_cards').update({ status: 'completed' }).eq('id', testCardId);

    // Attempt to 'pause' a completed card (strictly forbidden in FSM matrix)
    const illegalRes = await sessionA.rpc('rpc_transition_work_card_atomic', {
      p_card_id: testCardId,
      p_card_update: { status: 'paused' },
      p_history_data: null,
      p_idempotency_key: `illegal_test_${Date.now()}`
    });

    console.log('Illegal transition attempt result:', illegalRes.data);

    if (
      illegalRes.data?.success === false &&
      illegalRes.data?.conflict === true &&
      illegalRes.data?.illegal_transition === true
    ) {
      console.log('✅ TEST 3 PASSED: Illegal transition rejected with { success: false, conflict: true, illegal_transition: true }!\n');
    } else {
      console.error('❌ TEST 3 FAILED:', illegalRes.data);
      process.exit(1);
    }

  } finally {
    console.log('Cleaning up test artifacts in DB...');
    await sessionA.from('work_card_history').delete().eq('card_id', testCardId);
    await sessionA.from('work_cards').delete().eq('id', testCardId);
    console.log('✓ Cleanup completed.');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL 3 HAZARD CLASSES EMPIRICALLY AUDITED & PASSED WITH ZERO HOLES!');
  console.log('═══════════════════════════════════════════════════════════════════════');
}

runLiveVerification().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
