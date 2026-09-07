const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAnon() {
  const { data: stages, error: sErr } = await supabase.from('crm_pipeline_stages').select('*');
  console.log('Anon stages:', { count: stages?.length, error: sErr });

  const { data: leads, error: lErr } = await supabase.from('crm_leads').select('*');
  console.log('Anon leads:', { count: leads?.length, error: lErr });

  const { data: insert, error: iErr } = await supabase.from('crm_leads').insert([{
    title: 'Anon test lead',
    client_name: 'Anon Client',
    stage_id: 'lead'
  }]).select();
  console.log('Anon insert:', { insert, error: iErr });
}

testAnon();
