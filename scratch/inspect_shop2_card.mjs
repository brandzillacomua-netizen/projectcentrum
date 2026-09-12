import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function inspectAllCards() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  // Fetch nomenclatures for Лист Т300 (6мм)
  const { data: noms } = await prodClient
    .from('nomenclatures_v2')
    .select('*')
    .ilike('name', '%Лист Т300 (6мм)%');

  console.log('Nomenclatures matching Лист Т300 (6мм):', noms);

  const nomIds = (noms || []).map(n => n.id);

  // Fetch work_cards for those nomIds or with operation Пресування
  const { data: cards } = await prodClient
    .from('work_cards')
    .select('*, tasks(*), orders(*)')
    .order('created_at', { ascending: false })
    .limit(100);

  console.log(`Fetched ${cards?.length || 0} recent work cards.`);
  const matching = cards?.filter(c => 
    nomIds.includes(c.nomenclature_id) || 
    c.operation?.includes('Пресування') || 
    c.card_info?.includes('Пресування') ||
    c.id.slice(-8).toLowerCase() === '58f300d0'
  );

  console.log('Matching cards:', JSON.stringify(matching, null, 2));

  // Let's also check tasks
  const { data: tasks } = await prodClient
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const matchingTasks = tasks?.filter(t => 
    t.step?.includes('Пресування') ||
    JSON.stringify(t.plan_snapshot || {}).includes('Лист Т300 (6мм)')
  );
  console.log('Matching tasks:', JSON.stringify(matchingTasks, null, 2));
}

inspectAllCards().catch(console.error);
