const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testDedup() {
  const { data: history, error } = await supabase
    .from('work_card_history')
    .select('*')
    .gt('scrap_qty', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total raw history rows with scrap_qty > 0: ${history.length}`);

  // Deduplicate logic:
  const deduplicatedHistory = [];
  const seenMap = new Map();

  for (const h of history) {
    if (h.is_vkya_return) {
      deduplicatedHistory.push(h);
      continue;
    }
    const key = `${h.card_id}_${h.stage_name}_${h.scrap_qty}`;
    const existing = seenMap.get(key);
    if (existing) {
      const timeDiffMs = Math.abs(new Date(h.created_at).getTime() - new Date(existing.created_at).getTime());
      if (timeDiffMs < 5 * 60 * 1000) { // 5 minutes window
        continue;
      }
    }
    seenMap.set(key, h);
    deduplicatedHistory.push(h);
  }

  console.log(`Deduplicated history rows: ${deduplicatedHistory.length}`);
  
  // Print cards that had duplicates:
  const cardCounts = {};
  history.forEach(h => {
    if (!h.card_id) return;
    cardCounts[h.card_id] = (cardCounts[h.card_id] || 0) + 1;
  });

  console.log('\nCards with duplicates in work_card_history:');
  Object.entries(cardCounts).filter(([, count]) => count > 1).forEach(([cardId, count]) => {
    console.log(`Card ID: ${cardId} -> ${count} entries`);
  });
}

testDedup();
