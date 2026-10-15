import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const ids = [
    '54947b43-566d-4c16-ae89-af61d86035b5', // F415-ІП27-Хверх-4-74
    'cc2564e5-c3d6-4f13-a37b-500d15674576', // F415-ІП27-Хниз-4-74
    'c8db9f33-b324-4c67-be2f-3bc804ca1b36', // F415-ІП27-Хрестик-4-74
    'a0cc228d-e18e-4233-b33b-af53a845e83d'  // KF-Пластинка-3-162
  ];

  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('id', ids);

  console.log(JSON.stringify(reqs, null, 2));
}

main();
