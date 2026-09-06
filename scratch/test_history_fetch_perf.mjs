import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  // 1. Get 500 card IDs from active cards
  const { data: cards } = await supabase.from('work_cards').select('id').limit(500);
  const cardIds = cards.map(c => c.id);
  console.log(`Loaded ${cardIds.length} sample card IDs`);

  // --- Benchmark A: Sequential with chunkSize 25 (current production) ---
  const startA = performance.now();
  let countA = 0;
  const chunkSizeA = 25;
  for (let i = 0; i < cardIds.length; i += chunkSizeA) {
    const chunk = cardIds.slice(i, i + chunkSizeA);
    const { data } = await supabase
      .from('work_card_history')
      .select('id,card_id,nomenclature_id,scrap_qty,stage_name,operator_name,qty_at_start,qty_completed,created_at,completed_at')
      .in('card_id', chunk);
    countA += (data?.length || 0);
  }
  const durationA = Math.round(performance.now() - startA);
  console.log(`A) Sequential (chunk=25): ${durationA} ms, found ${countA} rows`);

  // --- Benchmark B: Parallel Promise.all with chunkSize 60 ---
  const startB = performance.now();
  const chunkSizeB = 60;
  const chunksB = [];
  for (let i = 0; i < cardIds.length; i += chunkSizeB) {
    chunksB.push(cardIds.slice(i, i + chunkSizeB));
  }

  const resultsB = await Promise.all(
    chunksB.map(chunk =>
      supabase
        .from('work_card_history')
        .select('id,card_id,nomenclature_id,scrap_qty,stage_name,operator_name,qty_at_start,qty_completed,created_at,completed_at')
        .in('card_id', chunk)
        .then(res => res.data || [])
    )
  );
  const countB = resultsB.flat().length;
  const durationB = Math.round(performance.now() - startB);
  console.log(`B) Parallel Promise.all (chunk=60): ${durationB} ms, found ${countB} rows`);

  console.log(`🚀 SPEEDUP: ${(durationA / durationB).toFixed(1)}x FASTER!`);
}

run();
