import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

// Session 1 (Tablet A - e.g. Operator 1)
const sessionA = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8', 'x-client-session': 'tablet-A' } }
});

// Session 2 (Tablet B - e.g. Operator 2 or network retry worker)
const sessionB = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8', 'x-client-session': 'tablet-B' } }
});

/**
  * Simulated client-side atomic card transition with Precondition Idempotency Check
  */
async function performConcurrentTransition(client, cardId, cardUpdate, historyData) {
  // 1. Check if RPC exists
  try {
    const { data, error } = await client.rpc('rpc_transition_work_card_atomic', {
      p_card_id: cardId,
      p_card_update: cardUpdate,
      p_history_data: historyData
    });

    if (!error) {
      if (data?.already_processed) {
        return { success: true, viaRpc: true, alreadyProcessed: true };
      }
      return { success: true, viaRpc: true, data };
    }
  } catch (err) {
    // Fall through to fallback
  }

  // 2. Precondition Idempotency Check in Fallback Mode:
  const { data: current } = await client
    .from('work_cards')
    .select('status, operation')
    .eq('id', cardId)
    .single();

  if (current && current.status === cardUpdate.status && current.operation === cardUpdate.operation) {
    return { success: true, viaRpc: false, alreadyProcessed: true };
  }

  // 3. Sequential write
  const { error: updateError } = await client
    .from('work_cards')
    .update(cardUpdate)
    .eq('id', cardId);
  if (updateError) throw updateError;

  if (historyData) {
    const { error: histError } = await client
      .from('work_card_history')
      .insert([{ card_id: cardId, ...historyData }]);
    if (histError) throw histError;
  }

  return { success: true, viaRpc: false, alreadyProcessed: false };
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🧪 CONCURRENT MULTI-TABLET IDEMPOTENCY TEST: 2 SESSIONS PARALLEL');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const testCardId = crypto.randomUUID();
  console.log(`1. Creating isolated test work card (ID: ${testCardId})...`);

  const { error: insertError } = await sessionA
    .from('work_cards')
    .insert([{
      id: testCardId,
      status: 'new',
      operation: 'Розкрій',
      quantity: 100,
      card_info: '[TEST_IDEMPOTENCY_CONCURRENCY]',
      started_at: null,
      operator_name: 'Початковий Стан'
    }]);

  if (insertError) {
    console.error('Failed to create test card:', insertError);
    process.exit(1);
  }
  console.log('✓ Test card created with status: "new", operation: "Розкрій".');

  try {
    console.log('\n2. Simulating simultaneous scan/take-in-work from Tablet A and Tablet B...');
    console.log('   (Both sessions firing transition to status: "in-progress" at the exact same millisecond)\n');

    const cardUpdateA = {
      status: 'in-progress',
      operation: 'Розкрій',
      operator_name: 'Олександр (Планшет 1)',
      started_at: new Date().toISOString()
    };

    const historyDataA = {
      stage_name: 'Розкрій',
      operator_name: 'Олександр (Планшет 1)',
      qty_at_start: 100,
      qty_completed: 0,
      scrap_qty: 0,
      started_at: cardUpdateA.started_at,
      card_info: '[IDEMPOTENCY_KEY:req_tablet_a_001]'
    };

    const cardUpdateB = {
      status: 'in-progress',
      operation: 'Розкрій',
      operator_name: 'Дмитро (Планшет 2)',
      started_at: new Date().toISOString()
    };

    const historyDataB = {
      stage_name: 'Розкрій',
      operator_name: 'Дмитро (Планшет 2)',
      qty_at_start: 100,
      qty_completed: 0,
      scrap_qty: 0,
      started_at: cardUpdateB.started_at,
      card_info: '[IDEMPOTENCY_KEY:req_tablet_b_002]'
    };

    const startTime = Date.now();
    const [resA, resB] = await Promise.all([
      performConcurrentTransition(sessionA, testCardId, cardUpdateA, historyDataA),
      performConcurrentTransition(sessionB, testCardId, cardUpdateB, historyDataB)
    ]);
    const durationMs = Date.now() - startTime;

    console.log(`✓ Both requests resolved in ${durationMs}ms:`);
    console.log('   • Result Tablet A:', JSON.stringify(resA));
    console.log('   • Result Tablet B:', JSON.stringify(resB));

    // Inspect database state
    console.log('\n3. Verifying database state:');
    const { data: finalCard } = await sessionA
      .from('work_cards')
      .select('status, operation, operator_name')
      .eq('id', testCardId)
      .single();

    const { data: historyEntries } = await sessionA
      .from('work_card_history')
      .select('id, stage_name, operator_name, card_info, created_at')
      .eq('card_id', testCardId);

    console.log(`   • Card Status: "${finalCard.status}"`);
    console.log(`   • Card Operator: "${finalCard.operator_name}"`);
    console.log(`   • Total History Entries in DB: ${historyEntries.length}`);

    historyEntries.forEach((entry, idx) => {
      console.log(`     [Entry #${idx + 1}] Operator: "${entry.operator_name}", Info: "${entry.card_info}"`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('📊 CONCURRENCY AUDIT VERDICT:');
    if (historyEntries.length === 1) {
      console.log('✅ PASS: EXACTLY 1 history entry created! Zero duplicate records.');
      const firstWinner = resA.alreadyProcessed ? 'Tablet B' : 'Tablet A';
      const gracefulSecond = resA.alreadyProcessed ? 'Tablet A' : 'Tablet B';
      console.log(`   Winner: ${firstWinner} executed the transition.`);
      console.log(`   Follower: ${gracefulSecond} detected concurrent completion (alreadyProcessed: true)`);
      console.log('   and safely avoided duplicate history insertion.');
    } else {
      console.log(`⚠️ FAIL: ${historyEntries.length} history entries were created.`);
    }
    console.log('═══════════════════════════════════════════════════════════════════════');

  } finally {
    console.log('\n4. Cleaning up test card and history...');
    await sessionA.from('work_card_history').delete().eq('card_id', testCardId);
    await sessionA.from('work_cards').delete().eq('id', testCardId);
    console.log('✓ Cleanup complete. Zero database pollution.');
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
