import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: inv, error } = await supabase.from('inventory').select('*');
  if (error) {
    console.error('Error fetching inventory:', error);
    return;
  }
  
  console.log(`Total inventory records: ${inv.length}`);
  const sheets = inv.filter(i => i.name.toLowerCase().includes('лист'));
  console.log(`Sheet records (${sheets.length}):`);
  sheets.forEach(i => {
    console.log(`- ID: ${i.id} | Name: "${i.name}" | Type: ${i.type} | WH: ${i.warehouse} | NomID: ${i.nomenclature_id} | Qty: ${i.total_qty} | Res: ${i.reserved_qty}`);
  });
}

run();

