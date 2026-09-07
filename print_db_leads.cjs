const { createClient } = require('@supabase/supabase-js');

const gatewayUrl = 'https://centrum-gateway.brandzilla-com-ua.workers.dev';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(gatewayUrl, supabaseAnonKey);

async function printLeads() {
  const { data: leads, error } = await supabase.from('crm_leads').select('*');
  console.log('Current DB leads:', JSON.stringify(leads, null, 2));
}

printLeads();
