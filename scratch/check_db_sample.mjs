import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const tables = ['tasks', 'orders', 'work_cards', 'inventory', 'system_users', 'work_card_history'];
  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(3);
    console.log(`Table ${t}: data.length = ${data?.length || 0}, count = ${count}, error =`, error?.message || 'none');
  }
}

test();
