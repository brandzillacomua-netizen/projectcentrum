const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const nomId = '7e8d056d-06b2-42a7-88e1-12186b914948'; // F610-ІП24-Н-3-14
  
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('*')
    .eq('nomenclature_id', nomId);
  
  if (error) console.error(error);
  else console.log('Work Cards for nomenclature:', cards);
}

run();
