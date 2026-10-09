import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI')
const run = async () => {
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email: 'alexinj@centrum.local', password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z' });
  if (loginErr) { console.error('Login error:', loginErr); return; }

  const { data, error } = await supabase.from('work_cards').select('id, operation, status').in('status', ['new', 'waiting-machines', 'at-buffer']);
  if (error) { console.error(error); return; }
  const toUpdate = data.filter(c => c.operation && c.operation.toLowerCase().includes('пак'));
  console.log('Found to update:', toUpdate.length);
  for (const c of toUpdate) {
    const { error: updErr } = await supabase.from('work_cards').update({ operation: 'Склад СГП', status: 'completed' }).eq('id', c.id);
    if (updErr) console.error(updErr);
  }
  console.log('Done updating cards.');
};
run();
