import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function main() {
  const { data: t1 } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', '014cab92-2b14-4544-ad53-7ccd030fe2f2')
    .single();

  const { data: t2 } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', 'b47603d7-4dcf-4839-9a81-f8bee48deb78')
    .single();

  console.log('--- SHOP 1 TASK (014cab92) SNAPSHOT FOR b77e0883-0af2-40a4-a834-a1e47b6570da:');
  console.log(t1.plan_snapshot['b77e0883-0af2-40a4-a834-a1e47b6570da']);

  console.log('--- SHOP 2 TASK (b47603d7) SNAPSHOT FOR b77e0883-0af2-40a4-a834-a1e47b6570da:');
  console.log(t2.plan_snapshot['b77e0883-0af2-40a4-a834-a1e47b6570da']);
}

main();
