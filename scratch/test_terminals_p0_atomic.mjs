import { createClient } from '@supabase/supabase-js';
import scannerDebounceGuard from '../src/services/scannerDebounceGuard.js';

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
  console.log('🧪 VERIFYING P0 TERMINALS: SCANNER GUARD & FSM TRANSITIONS');
  console.log('================================================================\n');

  // --- 1. Scanner Debounce Guard Verification ---
  console.log('--- 1. Testing Scanner Debounce Guard (Pressing & Painting) ---');
  const card1 = 'CENTRUM_CARD_PRESS_001';
  const scan1 = scannerDebounceGuard.shouldProcessScan(card1);
  assert(scan1 === true, 'First scan of card1 is accepted');

  const scan2 = scannerDebounceGuard.shouldProcessScan(card1);
  assert(scan2 === false, 'Immediate double scan of card1 is debounced and rejected');

  const card2 = 'CENTRUM_CARD_PAINT_002';
  const scan3 = scannerDebounceGuard.shouldProcessScan(card2);
  assert(scan3 === true, 'Scan of distinct card2 is accepted immediately');

  // --- 2. Live Database Verification: Pressing Flow ---
  console.log('\n--- 2. Testing Pressing Flow via rpc_transition_work_card_atomic ---');
  const now = new Date().toISOString();

  // Create temporary test card for Pressing
  const { data: pressCard, error: pressCreateErr } = await client
    .from('work_cards')
    .insert([{
      status: 'at-shop2-buffer',
      operation: 'Сортування',
      quantity: 50,
      card_info: '[ЦЕХ №2] Тестова деталь Пресування P0'
    }])
    .select()
    .single();

  assert(!pressCreateErr && pressCard?.id, `Created test card for Pressing (${pressCard?.id})`);

  if (pressCard?.id) {
    // 2.1 Start Pressing: at-shop2-buffer -> in-progress ('Пресування')
    const startRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: pressCard.id,
      p_card_update: {
        status: 'in-progress',
        operation: 'Пресування',
        started_at: now,
        operator_name: 'Іван Пресувальник',
        shift_name: 'Зміна 1'
      },
      p_history_data: {
        card_id: pressCard.id,
        stage_name: 'Буфер Пресування (після Сортування)',
        operator_name: 'Іван Пресувальник',
        qty_at_start: 50,
        qty_completed: 50,
        scrap_qty: 0,
        started_at: now,
        completed_at: now,
        shift_name: 'Зміна 1'
      },
      p_idempotency_key: `start_press_${pressCard.id}`,
      p_client_session: 'dev_tablet_pressing'
    });

    assert(startRes.data?.success === true, `Pressing start succeeded atomically (status: ${startRes.data?.status}, op: ${startRes.data?.operation})`);

    // 2.2 Complete Pressing: in-progress -> at-buffer ('Пресування')
    const compRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: pressCard.id,
      p_card_update: {
        status: 'at-buffer',
        operation: 'Пресування',
        quantity: 48,
        completed_at: now
      },
      p_history_data: {
        card_id: pressCard.id,
        stage_name: 'Пресування',
        operator_name: 'Іван Пресувальник',
        qty_at_start: 50,
        qty_completed: 48,
        scrap_qty: 2,
        started_at: now,
        completed_at: now,
        is_archived_scrap: true
      },
      p_idempotency_key: `comp_press_${pressCard.id}`,
      p_client_session: 'dev_tablet_pressing'
    });

    assert(compRes.data?.success === true, `Pressing complete succeeded atomically (status: ${compRes.data?.status}, op: ${compRes.data?.operation})`);

    // Cleanup test card
    await client.from('work_card_history').delete().eq('card_id', pressCard.id);
    await client.from('work_cards').delete().eq('id', pressCard.id);
  }

  // --- 3. Live Database Verification: Painting Flow ---
  console.log('\n--- 3. Testing Painting Flow via rpc_transition_work_card_atomic ---');
  const { data: paintCard, error: paintCreateErr } = await client
    .from('work_cards')
    .insert([{
      status: 'at-buffer',
      operation: 'Пресування',
      quantity: 48,
      card_info: '[ЦЕХ №2] Тестова деталь Фарбування P0'
    }])
    .select()
    .single();

  assert(!paintCreateErr && paintCard?.id, `Created test card for Painting (${paintCard?.id})`);

  if (paintCard?.id) {
    // 3.1 Start Painting: at-buffer -> in-progress ('Фарбування')
    const startRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: paintCard.id,
      p_card_update: {
        status: 'in-progress',
        operation: 'Фарбування',
        started_at: now,
        operator_name: 'Сергій Маляр',
        shift_name: 'Зміна 1'
      },
      p_history_data: {
        card_id: paintCard.id,
        stage_name: 'Буфер Фарбування (після Пресування)',
        operator_name: 'Сергій Маляр',
        qty_at_start: 48,
        qty_completed: 48,
        scrap_qty: 0,
        started_at: now,
        completed_at: now
      },
      p_idempotency_key: `start_paint_${paintCard.id}`,
      p_client_session: 'dev_tablet_paint'
    });

    assert(startRes.data?.success === true, `Painting start succeeded atomically (status: ${startRes.data?.status}, op: ${startRes.data?.operation})`);

    // 3.2 Complete Painting: in-progress -> at-buffer ('Фарбування')
    const compRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: paintCard.id,
      p_card_update: {
        status: 'at-buffer',
        operation: 'Фарбування',
        quantity: 48,
        completed_at: now
      },
      p_history_data: {
        card_id: paintCard.id,
        stage_name: 'Фарбування',
        operator_name: 'Сергій Маляр',
        qty_at_start: 48,
        qty_completed: 48,
        scrap_qty: 0,
        started_at: now,
        completed_at: now
      },
      p_idempotency_key: `comp_paint_${paintCard.id}`,
      p_client_session: 'dev_tablet_paint'
    });

    assert(compRes.data?.success === true, `Painting complete succeeded atomically (status: ${compRes.data?.status}, op: ${compRes.data?.operation})`);

    // Cleanup test card
    await client.from('work_card_history').delete().eq('card_id', paintCard.id);
    await client.from('work_cards').delete().eq('id', paintCard.id);
  }

  // --- 4. Live Database Verification: Reception Flow ---
  console.log('\n--- 4. Testing Reception Flow via rpc_transition_work_card_atomic ---');
  const { data: recCard, error: recCreateErr } = await client
    .from('work_cards')
    .insert([{
      status: 'at-buffer',
      operation: 'Галтовка',
      quantity: 100,
      card_info: '[SHOP:1] Тестова деталь Прийомка P0'
    }])
    .select()
    .single();

  assert(!recCreateErr && recCard?.id, `Created test card for Reception (${recCard?.id})`);

  if (recCard?.id) {
    // 4.1 Start Reception: at-buffer -> in-progress ('Прийомка')
    const startRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: recCard.id,
      p_card_update: {
        status: 'in-progress',
        operation: 'Прийомка',
        started_at: now,
        operator_name: 'Олена Приймальник',
        shift_name: 'Зміна 1'
      },
      p_history_data: {
        card_id: recCard.id,
        stage_name: 'Буфер Галтовки',
        operator_name: 'Олена Приймальник',
        qty_at_start: 100,
        qty_completed: 100,
        scrap_qty: 0,
        started_at: now,
        completed_at: now
      },
      p_idempotency_key: `start_rec_${recCard.id}`,
      p_client_session: 'dev_tablet_reception'
    });

    assert(startRes.data?.success === true, `Reception start succeeded atomically (status: ${startRes.data?.status}, op: ${startRes.data?.operation})`);

    // 4.2 Complete Reception: in-progress -> at-buffer ('Сортування')
    const compRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: recCard.id,
      p_card_update: {
        status: 'at-buffer',
        operation: 'Сортування',
        quantity: 99,
        completed_at: now
      },
      p_history_data: {
        card_id: recCard.id,
        stage_name: 'Прийомка',
        operator_name: 'Олена Приймальник',
        qty_at_start: 100,
        qty_completed: 99,
        scrap_qty: 1,
        started_at: now,
        completed_at: now
      },
      p_idempotency_key: `comp_rec_${recCard.id}`,
      p_client_session: 'dev_tablet_reception'
    });

    assert(compRes.data?.success === true, `Reception complete succeeded atomically (status: ${compRes.data?.status}, op: ${compRes.data?.operation})`);

    // Cleanup test card
    await client.from('work_card_history').delete().eq('card_id', recCard.id);
    await client.from('work_cards').delete().eq('id', recCard.id);
  }

  // --- 5. Live Database Verification: Shop 2 Start Operation ---
  console.log('\n--- 5. Testing Shop 2 Start Operation via rpc_transition_work_card_atomic ---');
  const { data: s2Card, error: s2CreateErr } = await client
    .from('work_cards')
    .insert([{
      status: 'at-shop2-buffer',
      operation: 'Сортування',
      quantity: 30,
      card_info: '[ЦЕХ №2] Тестова деталь Цех 2 P0'
    }])
    .select()
    .single();

  assert(!s2CreateErr && s2Card?.id, `Created test card for Shop 2 (${s2Card?.id})`);

  if (s2Card?.id) {
    const startRes = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: s2Card.id,
      p_card_update: {
        status: 'in-progress',
        operation: 'Пресування',
        started_at: now,
        operator_name: 'Віктор Майстер Ц2',
        shift_name: 'Зміна 2'
      },
      p_history_data: {
        card_id: s2Card.id,
        stage_name: 'Пресування',
        operator_name: 'Віктор Майстер Ц2',
        qty_at_start: 30,
        qty_completed: 30,
        scrap_qty: 0,
        started_at: now,
        completed_at: now,
        shift_name: 'Зміна 2'
      },
      p_idempotency_key: `start_s2_${s2Card.id}`,
      p_client_session: 'dev_tablet_s2'
    });

    assert(startRes.data?.success === true, `Shop 2 start succeeded atomically (status: ${startRes.data?.status}, op: ${startRes.data?.operation})`);

    // Cleanup test card
    await client.from('work_card_history').delete().eq('card_id', s2Card.id);
    await client.from('work_cards').delete().eq('id', s2Card.id);
  }

  console.log(`\n================================================================`);
  console.log(`📊 P0 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
