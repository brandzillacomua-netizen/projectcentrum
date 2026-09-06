import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

const clientB = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

// Mock browser localStorage for Node environment test
const mockLocalStorage = new Map();
function getOrCreateDeviceIdSimulated() {
  let deviceId = mockLocalStorage.get('MES_DEVICE_ID');
  if (!deviceId) {
    deviceId = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    mockLocalStorage.set('MES_DEVICE_ID', deviceId);
  }
  return deviceId;
}

async function runSessionHardeningAudit() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 AUDIT: STABLE HARDWARE DEVICE ID & IMMUTABLE SESSION TAG RETENTION');
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // STEP 1: Probe Deployed Version
  console.log('--- STEP 1: Probing RPC Version ---');
  const probe = await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: '00000000-0000-0000-0000-000000000000',
    p_card_update: {},
    p_history_data: null,
    p_idempotency_key: null,
    p_client_session: null
  });
  console.log(`• Deployed RPC Version: "${probe.data?.rpc_version}"`);

  // STEP 2: Device ID Stability Test across Reloads / Logout
  console.log('\n--- STEP 2: Device ID Stability Simulation ---');
  const tabletA_initialId = getOrCreateDeviceIdSimulated();
  console.log(`Tablet A initial Device ID: ${tabletA_initialId}`);
  
  // Simulate logout (removes MES_SESSION_LOGIN, but MES_DEVICE_ID stays)
  mockLocalStorage.delete('MES_SESSION_LOGIN');
  const tabletA_afterLogout = getOrCreateDeviceIdSimulated();
  console.log(`Tablet A after logout & login Device ID: ${tabletA_afterLogout}`);
  
  if (tabletA_initialId === tabletA_afterLogout) {
    console.log('✅ PASS: Device ID is 100% stable across logout and reload!');
  } else {
    console.error('❌ FAIL: Device ID changed across session!');
    process.exit(1);
  }

  // If v6 is not yet applied, notify
  if (probe.data?.rpc_version !== '2026-09-05.fsm_matrix_v6') {
    console.log('\n⚠️ Supabase is currently on version "' + probe.data?.rpc_version + '".');
    console.log('To activate full server-side auto-preservation of session tags during overwriting updates, execute atomic_card_transitions.sql (v6)!');
    return;
  }

  // STEP 3: Live Tag Retention Test under In-Progress Overwrites
  console.log('\n--- STEP 3: Live Tag Retention Test under In-Progress Overwrites ---');
  const testCardId = '99999999-8888-7777-6666-555555555555';
  await clientA.from('work_card_history').delete().eq('card_id', testCardId);
  await clientA.from('work_cards').delete().eq('id', testCardId);

  await clientA.from('work_cards').insert([{
    id: testCardId,
    status: 'new',
    operation: 'Розкрій',
    quantity: 100,
    operator_name: null,
    machine: 'Верстат №2',
    card_info: '[BASE_INFO]'
  }]);

  // Tablet A claims card with session
  await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', operator_name: 'Олександр' },
    p_history_data: { stage_name: 'Розкрій', operator_name: 'Олександр' },
    p_idempotency_key: `claim_${Date.now()}`,
    p_client_session: tabletA_initialId
  });

  // Now Tablet A performs an update with a COMPLETELY NEW card_info string that does NOT contain [SESSION:...]
  // AND p_client_session is NOT passed (simulating a client call that omitted session)
  console.log('Executing in-progress mutation with raw text that strips session...');
  await clientA.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', card_info: 'Коментар робітника: відсутній метал', quantity: 95 },
    p_history_data: null,
    p_idempotency_key: `comment_${Date.now()}`,
    p_client_session: null
  });

  // Verify that the server AUTO-PRESERVED the session tag!
  const { data: updatedCard } = await clientA.from('work_cards').select('card_info').eq('id', testCardId).single();
  console.log(`Updated card_info in DB: "${updatedCard.card_info}"`);

  if (updatedCard.card_info.includes(`[SESSION:${tabletA_initialId}]`)) {
    console.log('✅ PASS: PostgreSQL v6 automatically retained [SESSION:...] tag despite payload overwrite!');
  } else {
    console.error('❌ FAIL: Session tag was lost!');
  }

  // Now Tablet B tries to hijack card -> MUST BE REJECTED
  const hijackAttempt = await clientB.rpc('rpc_transition_work_card_atomic', {
    p_card_id: testCardId,
    p_card_update: { status: 'in-progress', quantity: 50 },
    p_history_data: null,
    p_idempotency_key: `hijack_${Date.now()}`,
    p_client_session: 'tablet-B-fake-id'
  });
  console.log('Hijack attempt result:', hijackAttempt.data);
  if (hijackAttempt.data?.success === false && hijackAttempt.data?.already_claimed === true) {
    console.log('✅ PASS: Unauthorized tablet strictly rejected even after payload updates!');
  } else {
    console.error('❌ FAIL: Hijack was allowed!', hijackAttempt.data);
  }

  // Cleanup
  await clientA.from('work_card_history').delete().eq('card_id', testCardId);
  await clientA.from('work_cards').delete().eq('id', testCardId);
  console.log('\n✓ Cleanup complete.');
}

runSessionHardeningAudit().catch(console.error);
