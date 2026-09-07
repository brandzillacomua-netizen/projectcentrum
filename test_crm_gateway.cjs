const { createClient } = require('@supabase/supabase-js');

const gatewayUrl = 'https://centrum-gateway.brandzilla-com-ua.workers.dev';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(gatewayUrl, supabaseAnonKey);

async function testGateway() {
  const { data: stages, error: sErr } = await supabase.from('crm_pipeline_stages').select('*');
  console.log('Gateway stages:', { count: stages?.length, error: sErr });

  const { data: leads, error: lErr } = await supabase.from('crm_leads').select('*');
  console.log('Gateway leads:', { count: leads?.length, error: lErr });

  const { data: insert, error: iErr } = await supabase.from('crm_leads').insert([{
    title: 'Gateway test lead',
    client_name: 'Gateway Client',
    stage_id: 'lead'
  }]).select();
  console.log('Gateway insert:', { insert, error: iErr });

  if (insert && insert[0]) {
    await supabase.from('crm_leads').delete().eq('id', insert[0].id);
    console.log('Gateway delete success');
  }
}

testGateway();
