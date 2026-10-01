const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function forceCloseOldNaryads() {
  console.log('=== STARTING FORCE-CLOSE OF ALL NARYADS / TASKS CREATED BEFORE 2026-10-01 ===');

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    process.exit(1);
  }
  console.log('Authenticated successfully as:', auth.user.email);

  const cutoff = '2026-10-01T00:00:00+00:00';
  const now = new Date().toISOString();

  let totalClosedCards = 0;
  while (true) {
    const { data: activeCards, error: cardSelectErr } = await supabase
      .from('work_cards')
      .select('id')
      .lt('created_at', cutoff)
      .not('status', 'in', '("completed","scrapped")')
      .limit(1000);

    if (cardSelectErr) {
      console.error('Error selecting old cards:', cardSelectErr);
      break;
    }
    if (!activeCards || activeCards.length === 0) break;

    const cardIds = activeCards.map(c => c.id);
    for (let i = 0; i < cardIds.length; i += 50) {
      const batch = cardIds.slice(i, i + 50);
      const { error: cardUpdErr } = await supabase
        .from('work_cards')
        .update({
          status: 'completed',
          completed_at: now
        })
        .in('id', batch);
      if (cardUpdErr) console.error('Error updating card batch:', cardUpdErr);
    }
    totalClosedCards += cardIds.length;
    console.log(`Processed batch of ${cardIds.length} old work cards (Total: ${totalClosedCards})...`);
  }
  console.log(`Successfully completed ALL ${totalClosedCards} old work cards.`);

  // 2. Force close all active tasks created before cutoff
  console.log('\n2. Force closing active tasks created before 2026-10-01...');
  const { data: activeTasks, error: taskSelectErr } = await supabase
    .from('tasks')
    .select('id')
    .lt('created_at', cutoff)
    .not('status', 'in', '("completed","cancelled")');

  if (taskSelectErr) console.error('Error selecting old tasks:', taskSelectErr);
  else console.log(`Found ${activeTasks?.length || 0} active tasks to mark completed.`);

  if (activeTasks && activeTasks.length > 0) {
    const taskIds = activeTasks.map(t => t.id);
    for (let i = 0; i < taskIds.length; i += 50) {
      const batch = taskIds.slice(i, i + 50);
      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: now,
          engineer_conf: true,
          warehouse_conf: 'true',
          director_conf: true
        })
        .in('id', batch);
      if (taskUpdErr) console.error('Error updating task batch:', taskUpdErr);
    }
    console.log(`Successfully completed ${taskIds.length} old tasks.`);
  }

  // 3. Force close all active orders created before cutoff
  console.log('\n3. Force closing active orders created before 2026-10-01...');
  const { data: activeOrders, error: ordSelectErr } = await supabase
    .from('orders')
    .select('id')
    .lt('created_at', cutoff)
    .not('status', 'in', '("completed","shipped","cancelled")');

  if (ordSelectErr) console.error('Error selecting old orders:', ordSelectErr);
  else console.log(`Found ${activeOrders?.length || 0} active orders to mark completed.`);

  if (activeOrders && activeOrders.length > 0) {
    const orderIds = activeOrders.map(o => o.id);
    for (let i = 0; i < orderIds.length; i += 50) {
      const batch = orderIds.slice(i, i + 50);
      const { error: ordUpdErr } = await supabase
        .from('orders')
        .update({
          status: 'completed'
        })
        .in('id', batch);
      if (ordUpdErr) console.error('Error updating order batch:', ordUpdErr);
    }
    console.log(`Successfully completed ${orderIds.length} old orders.`);
  }

  // 4. Force complete all active material_requests created before cutoff
  console.log('\n4. Force completing active material_requests created before 2026-10-01...');
  const { data: activeReqs, error: reqSelectErr } = await supabase
    .from('material_requests')
    .select('id')
    .lt('created_at', cutoff)
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  if (reqSelectErr) console.error('Error selecting old material requests:', reqSelectErr);
  else console.log(`Found ${activeReqs?.length || 0} active material requests to mark completed.`);

  if (activeReqs && activeReqs.length > 0) {
    const reqIds = activeReqs.map(r => r.id);
    for (let i = 0; i < reqIds.length; i += 50) {
      const batch = reqIds.slice(i, i + 50);
      const { error: reqUpdErr } = await supabase
        .from('material_requests')
        .update({
          status: 'completed'
        })
        .in('id', batch);
      if (reqUpdErr) console.error('Error updating material_requests batch:', reqUpdErr);
    }
    console.log(`Successfully completed ${reqIds.length} old material requests.`);
  }

  // 5. Release active bz_inventory_reservations created before cutoff
  console.log('\n5. Releasing active bz_inventory_reservations created before 2026-10-01...');
  const { data: activeBz, error: bzSelectErr } = await supabase
    .from('bz_inventory_reservations')
    .select('operation_id')
    .lt('created_at', cutoff)
    .eq('status', 'allocated');

  if (bzSelectErr) console.error('Error selecting old BZ reservations:', bzSelectErr);
  else console.log(`Found ${activeBz?.length || 0} active BZ reservation operations to release.`);

  if (activeBz && activeBz.length > 0) {
    const uniqueOpIds = [...new Set(activeBz.map(b => b.operation_id))];
    for (const opId of uniqueOpIds) {
      const { error: rpcErr } = await supabase.rpc('release_bz_reservation', {
        p_operation_id: opId,
        p_reason: 'Примусове закриття старих нарядів до 01.10.2026'
      });
      if (rpcErr) console.error(`Error releasing operation ${opId}:`, rpcErr.message);
      else console.log(`Released BZ reservation operation ${opId}`);
    }
  }

  console.log('\n=== FORCE-CLOSE COMPLETED SUCCESSFULLY ===');
}

forceCloseOldNaryads().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
