import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data: inv } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, total_qty, reserved_qty, warehouse, type')
    .ilike('name', '%F415-421-ІП27-В-3-26%');

  console.log('--- INVENTORY FOR F415-421-ІП27-В-3-26 ---');
  console.log(inv);

  const { data: reqs } = await supabase
    .from('material_requests')
    .select('id, order_id, quantity, status, inventory_id, details, created_at')
    .in('inventory_id', inv.map(i => i.id));

  console.log('--- REQS POINTING TO THIS INVENTORY ---');
  console.log(reqs);
}

main();
