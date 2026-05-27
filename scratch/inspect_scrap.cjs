const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // 1. Find nomenclature
  const { data: nomData } = await supabase.from('nomenclatures').select('*').ilike('name', '%F610-ІП24-Н-3-14%');
  console.log('Nomenclatures:', nomData);
  if (!nomData || nomData.length === 0) return;
  const nomId = nomData[0].id;

  // 2. Fetch inventory
  const { data: invData } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId);
  console.log('Inventory:', invData);

  // 3. Fetch recent work_card_history
  const { data: historyData } = await supabase.from('work_card_history').select('*').eq('nomenclature_id', nomId).order('created_at', { ascending: false }).limit(10);
  console.log('Work Card History:', historyData);
}

run();
