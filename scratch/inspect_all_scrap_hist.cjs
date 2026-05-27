const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('work_card_history')
    .select('*, nomenclatures(name)')
    .gt('scrap_qty', 0)
    .order('created_at', { ascending: false });
  
  if (error) console.error(error);
  else console.log('All scrap history:', data.map(d => ({
    id: d.id,
    card_id: d.card_id,
    nomenclature: d.nomenclatures ? d.nomenclatures.name : null,
    scrap_qty: d.scrap_qty,
    is_archived_scrap: d.is_archived_scrap,
    created_at: d.created_at
  })));
}

run();
