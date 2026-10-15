import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const targetOrderId = '62330578-eb54-401c-8258-c2efd660780e';
  const reqIds = [
    '54947b43-566d-4c16-ae89-af61d86035b5', // F415-ІП27-Хверх-4-74
    'cc2564e5-c3d6-4f13-a37b-500d15674576', // F415-ІП27-Хниз-4-74
    'c8db9f33-b324-4c67-be2f-3bc804ca1b36', // F415-ІП27-Хрестик-4-74
    'a0cc228d-e18e-4233-b33b-af53a845e83d', // KF-Пластинка-3-162
    '769dda34-a576-4bee-bd72-79f76764b815', // F415-421-ІП27-В-3-26 (auto)
    'c6c800d6-8ed5-42bd-a3a2-1efdfd1b31e0', // F415-421-ІП27-Н-3-26 (auto)
    'd12a0eb0-5aa0-49db-bd7d-7c51424fbf72', // F415-ІП27-К-3-9 (auto)
    '3a8f0275-734b-4313-acd2-2f2a6eb403aa'  // F415-ІП27-П-10-38 (auto)
  ];

  const { data: rows } = await supabase
    .from('material_requests')
    .select('*, nomenclatures_v2(name)')
    .in('id', reqIds);

  console.log('--- AUTO REQUESTS ---');
  for (const r of rows) {
    console.log({
      id: r.id,
      name: r.nomenclatures_v2?.name,
      quantity: r.quantity,
      status: r.status,
      inventory_id: r.inventory_id,
      details: r.details
    });
  }
}

main();
