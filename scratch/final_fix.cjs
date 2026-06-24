const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

const BAD = [
  '2026-06-22T19:14:55', '2026-06-22T19:15:30',
  '2026-06-22T19:31:51',
  '2026-06-22T19:44:20', '2026-06-22T19:44:55', '2026-06-22T19:45:30',
  '2026-06-22T20:01:51',
];
const isBad = (ts) => ts && BAD.some(p => ts.startsWith(p));
const isFuture = (ts) => ts && new Date(ts) > new Date();

async function run() {
  const now = new Date();
  console.log('UTC:', now.toISOString(), '| Київ:', now.toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' }));

  // === 1. Перевірити всі активні картки після виправлення ===
  const { data: cards } = await supabase.from('work_cards').select('*');
  const badCards = cards.filter(c =>
    isBad(c.started_at) || isBad(c.completed_at) || isFuture(c.started_at) || isFuture(c.completed_at)
  );
  console.log(`\nЗалишилося зіпсованих карток: ${badCards.length}`);
  badCards.forEach(c => console.log(` - ${c.id.slice(-8)} [${c.status}] ${c.operation} ${c.operator_name} | started=${c.started_at} | completed=${c.completed_at}`));

  // === 2. Перевірити work_card_history на залишки June-22 timestamps ===
  const { data: hist } = await supabase.from('work_card_history').select('*');
  const badHist = hist.filter(h => isBad(h.started_at) || isBad(h.completed_at) || isFuture(h.started_at) || isFuture(h.completed_at));
  console.log(`\nЗіпсованих записів в history: ${badHist.length}`);

  // Виправити зіпсовані history записи
  for (const h of badHist) {
    const updates = {};
    if (isBad(h.started_at) || isFuture(h.started_at)) {
      // started_at → created_at if sane, else null
      updates.started_at = (!isBad(h.created_at) && !isFuture(h.created_at)) ? h.created_at : null;
    }
    if (isBad(h.completed_at) || isFuture(h.completed_at)) {
      // completed_at → created_at if valid, else now
      updates.completed_at = (!isBad(h.created_at) && !isFuture(h.created_at)) ? h.created_at : now.toISOString();
    }
    // Ensure started < completed
    if (updates.started_at && updates.completed_at && new Date(updates.started_at) >= new Date(updates.completed_at)) {
      updates.started_at = new Date(new Date(updates.completed_at).getTime() - 30 * 60 * 1000).toISOString();
    }
    console.log(` Оновлення history ${h.id.slice(-8)}: ${JSON.stringify(updates)}`);
    await supabase.from('work_card_history').update(updates).eq('id', h.id);
  }

  // === 3. Виправити fb869aba та решту in-progress карток з bad started_at ===
  for (const c of badCards) {
    if (c.status === 'in-progress' && (isBad(c.started_at) || isFuture(c.started_at))) {
      // Для in-progress: started_at = зараз (операція активна прямо зараз)
      const newStarted = now.toISOString();
      console.log(`\nВиправлення in-progress ${c.id.slice(-8)} ${c.operator_name}: started_at = ${newStarted}`);
      await supabase.from('work_cards').update({ started_at: newStarted, completed_at: null }).eq('id', c.id);
    }
  }

  // === 4. Фінальна перевірка ===
  console.log('\n=== ФІНАЛЬНА ПЕРЕВІРКА ===');
  const { data: finalCards } = await supabase.from('work_cards').select('id,status,operation,operator_name,started_at,completed_at');
  const activeCards = finalCards.filter(c => c.status === 'in-progress' || c.status === 'at-buffer');
  let stillBad = 0;
  activeCards.forEach(c => {
    const bad = isBad(c.started_at) || isBad(c.completed_at) || isFuture(c.started_at) || isFuture(c.completed_at);
    if (bad) {
      stillBad++;
      console.log(` ПРОБЛЕМА: ${c.id.slice(-8)} ${c.operator_name} started=${c.started_at} completed=${c.completed_at}`);
    }
  });
  if (stillBad === 0) {
    console.log('✓ Всі активні картки мають коректні timestamps!');
  }
  console.log(`Перевірено ${activeCards.length} активних карток.`);
}

run().catch(console.error);
