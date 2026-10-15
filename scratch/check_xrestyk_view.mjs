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
    .ilike('name', '%F415-ІП27-Хрестик-4-74%');

  console.log('--- ALL ROWS FOR Хрестик ---');
  console.log(inv);

  const total = inv.reduce((s, i) => s + (Number(i.total_qty) || 0), 0);
  const reserved = inv.reduce((s, i) => s + (Number(i.reserved_qty) || 0), 0);
  console.log(`TOTAL SGP GROUPED: Наявність=${total}, Резерв=${reserved}, Вільно=${total - reserved}`);
}

main();
