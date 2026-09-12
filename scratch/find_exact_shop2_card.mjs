import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function findCard() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: cards, error } = await prodClient
    .from('work_cards')
    .select('*, nomenclatures_v2(name, code)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cards:', error);
    return;
  }

  console.log("=== SEARCHING CARDS FOR 58F300D0 / Лист Т300 / Qty 1 / Created Today ===");
  
  cards.forEach(c => {
    const nomName = c.nomenclatures_v2?.name || '';
    const info = c.card_info || '';
    const id = c.id || '';
    if (
      id.toLowerCase().includes('58f300d0') ||
      info.toLowerCase().includes('58f300d0') ||
      nomName.includes('Т300 (6мм)') ||
      nomName.includes('Т300') ||
      c.created_at?.startsWith('2026-09-11')
    ) {
      console.log(`[${c.id}] Status: ${c.status} | Nom: ${nomName} | Qty: ${c.quantity} | Op: ${c.operation} | Info: ${info} | Created: ${c.created_at}`);
    }
  });
}

findCard().catch(console.error);
