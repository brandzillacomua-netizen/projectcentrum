import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // Check all requests for 8mm
  const { data: reqs8 } = await supabase.from('material_requests').select('*').ilike('details', '%8мм%').order('created_at', { ascending: false });
  console.log('=== ALL REQUESTS FOR 8mm ===');
  for (const r of reqs8 || []) {
    console.log(`Req ${r.id}: qty=${r.quantity}, status=${r.status}, task=${r.task_id}, created=${r.created_at}`);
  }

  // Check all requests for 3mm
  const { data: reqs3 } = await supabase.from('material_requests').select('*').ilike('details', '%Т300 (3мм)%').order('created_at', { ascending: false });
  console.log('\n=== ALL REQUESTS FOR T300 3mm ===');
  for (const r of reqs3 || []) {
    console.log(`Req ${r.id}: qty=${r.quantity}, status=${r.status}, task=${r.task_id}, created=${r.created_at}`);
  }

  // Check all requests for 7mm
  const { data: reqs7 } = await supabase.from('material_requests').select('*').ilike('details', '%7мм%').order('created_at', { ascending: false });
  console.log('\n=== ALL REQUESTS FOR 7mm ===');
  for (const r of reqs7 || []) {
    console.log(`Req ${r.id}: qty=${r.quantity}, status=${r.status}, task=${r.task_id}, created=${r.created_at}`);
  }
}

run().catch(console.error);
