const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function inspectDuplicates() {
  console.log('Fetching work_card_history for scrap_qty > 0...');
  
  const { data: history, error } = await supabase
    .from('work_card_history')
    .select('id, card_id, nomenclature_id, stage_name, operator_name, scrap_qty, qty_at_start, qty_completed, created_at, card_info, qc_scrap_comment')
    .gt('scrap_qty', 0)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching history:', error);
    return;
  }

  console.log(`Found ${history.length} history rows with scrap_qty > 0:`);
  history.forEach(h => {
    console.log(`ID: ${h.id} | CardID: ${h.card_id} | ScrapQty: ${h.scrap_qty} | Stage: ${h.stage_name} | CreatedAt: ${h.created_at} | Comment: ${h.qc_scrap_comment}`);
  });
}

inspectDuplicates();
