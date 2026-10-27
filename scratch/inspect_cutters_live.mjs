import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data: reqs } = await supabase
    .from('material_requests')
    .select('id, task_id, nomenclature_id, inventory_id, details, quantity, status')
    .ilike('details', '%фреза%')
    .in('status', ['issued', 'pending'])
    .limit(20);

  console.log('Sample open cutter requests:', reqs?.length);
  console.log(JSON.stringify(reqs, null, 2));

  // Also check how many open cutter requests exist in total
  const { count } = await supabase
    .from('material_requests')
    .select('id', { count: 'exact', head: true })
    .ilike('details', '%фреза%')
    .in('status', ['issued', 'pending']);

  console.log('Total open cutter requests count:', count);
}

main();
