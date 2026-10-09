const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI');
async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });
  if (error) { console.error('Auth error', error); return; }
  
  // Fetch from vkya_restoration_cards
  const res = await supabase.from('vkya_restoration_cards').select('*').in('quantity', [700, 670, 1370]);
  console.log('Restoration items:', JSON.stringify(res.data, null, 2));

  // Fetch quarantine
  const res2 = await supabase.from('vkya_classification_queue_projection').select('*').in('quantity', [700, 670, 1370]);
  console.log('Quarantine items:', JSON.stringify(res2.data, null, 2));
}
run();
