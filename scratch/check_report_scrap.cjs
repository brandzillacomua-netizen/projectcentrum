const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e';
  
  // 1. Fetch all cards for this task
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId);
  console.log(`Cards count in DB for task: ${cards.length}`);
  
  // 2. Fetch ALL history records for these cards, using chunks of 100 card_ids to bypass Supabase limits if any
  const cardIds = cards.map(c => c.id);
  let allHistory = [];
  
  for (let i = 0; i < cardIds.length; i += 100) {
    const chunk = cardIds.slice(i, i + 100);
    const { data: histChunk } = await supabase
      .from('work_card_history')
      .select('*')
      .in('card_id', chunk)
      .limit(10000);
    if (histChunk) {
      allHistory = allHistory.concat(histChunk);
    }
  }
  
  console.log(`Total history records fetched: ${allHistory.length}`);
  
  // Calculate total scrap
  const totalScrap = allHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0);
  console.log(`Sum of scrap: ${totalScrap}`);
  
  // Group by nomenclature
  const scrapByNomenclature = {};
  allHistory.forEach(h => {
    if (Number(h.scrap_qty) > 0) {
      scrapByNomenclature[h.nomenclature_id] = (scrapByNomenclature[h.nomenclature_id] || 0) + Number(h.scrap_qty);
    }
  });
  
  console.log('Scrap by nomenclature ID in history:', scrapByNomenclature);

  // Let's print out all history items where scrap > 0 to inspect stage_name and dates
  const historyWithScrap = allHistory.filter(h => Number(h.scrap_qty) > 0);
  console.log('History rows with scrap > 0 (all):', historyWithScrap.map(h => ({
    id: h.id,
    card_id: h.card_id,
    stage_name: h.stage_name,
    scrap_qty: h.scrap_qty,
    operator_name: h.operator_name,
    completed_at: h.completed_at
  })));
}

run();
