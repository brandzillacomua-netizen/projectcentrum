import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFlow() {
  const { data: noms } = await supabase.from('nomenclatures').select('id, name').ilike('name', '%F415-ІП27-П-10-38%');
  const nomId = noms[0].id;
  
  const { data: flows } = await supabase.from('work_card_flow_totals').select('*').eq('nomenclature_id', nomId);
  console.log('Flows for this part:');
  console.log(flows);
}
checkFlow();
