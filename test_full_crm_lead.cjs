const { createClient } = require('@supabase/supabase-js');

const gatewayUrl = 'https://centrum-gateway.brandzilla-com-ua.workers.dev';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(gatewayUrl, supabaseAnonKey);

async function testFullLeadInsert() {
  const payload = {
    title: 'Тестова заявка на 100 рам',
    client_name: 'ТОВ Авіатехніка',
    contact_phone: '+380501234567',
    contact_email: 'test@example.com',
    product_interest: 'Рама F10',
    quantity: 100,
    estimated_amount: 50000,
    stage_id: 'lead',
    notes: 'Терміново потрібна поставка',
    manager_name: 'Олександр Менеджер'
  };

  const { data, error } = await supabase.from('crm_leads').insert([payload]).select();
  console.log('Full insert result:', { data, error });

  if (data && data[0]) {
    const { data: updated, error: uErr } = await supabase
      .from('crm_leads')
      .update({ stage_id: 'tech_spec', updated_at: new Date().toISOString() })
      .eq('id', data[0].id)
      .select();
    console.log('Update result:', { updated, uErr });

    const { error: dErr } = await supabase.from('crm_leads').delete().eq('id', data[0].id);
    console.log('Delete result:', { dErr });
  }
}

testFullLeadInsert();
