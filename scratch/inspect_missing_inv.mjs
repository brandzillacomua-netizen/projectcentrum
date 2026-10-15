import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const names = [
    'F415-ІП27-Хверх-4-74',
    'F415-ІП27-Хниз-4-74',
    'F415-ІП27-Хрестик-4-74',
    'KF-Пластинка-3-162'
  ];

  for (const n of names) {
    const { data } = await supabase
      .from('inventory')
      .select('id, name, nomenclature_id, type, warehouse, total_qty, reserved_qty, pocket_owner')
      .ilike('name', `%${n}%`);
    console.log(`=== ${n} ===`);
    console.log(data);
  }
}

main();
