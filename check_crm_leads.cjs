const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCrmLeads() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data: stages, error: sErr } = await supabase.from('crm_pipeline_stages').select('*');
  console.log('Stages:', { count: stages?.length, error: sErr });

  const { data: leads, error: lErr } = await supabase.from('crm_leads').select('*');
  console.log('Leads:', { count: leads?.length, error: lErr });

  // Try inserting a test lead
  const { data: insertData, error: iErr } = await supabase.from('crm_leads').insert([{
    title: 'Test Lead',
    client_name: 'Test Client',
    stage_id: 'lead'
  }]).select();

  console.log('Insert test lead:', { data: insertData, error: iErr });

  if (insertData && insertData[0]) {
    await supabase.from('crm_leads').delete().eq('id', insertData[0].id);
    console.log('Deleted test lead successfully');
  }
}

checkCrmLeads();
