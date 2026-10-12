import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Material requests for 2mm in task dd8f6032
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .eq('task_id', 'dd8f6032-bc26-4eda-ad99-413e26515978')
    .ilike('details', '%2мм%');
  console.log('2mm requests for dd8f6032:', reqs);

  // 2. All cards in task dd8f6032 that use 2mm
  // In previous script: Part ІП-77-Marun-V2-В-2-14 has 70 cards
  const { data: noms } = await supabase.from('nomenclatures').select('id, name').ilike('name', '%В-2-14%');
  console.log('Nom for В-2-14:', noms);

  if (noms && noms.length > 0) {
    const { data: cards } = await supabase
      .from('work_cards')
      .select('id, card_info, quantity, status')
      .eq('task_id', 'dd8f6032-bc26-4eda-ad99-413e26515978')
      .eq('nomenclature_id', noms[0].id);

    console.log('Cards for В-2-14 count:', cards.length);
    const cut = cards.filter(c => ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status));
    const pending = cards.filter(c => !['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status));
    console.log(`Cut cards: ${cut.length}, Pending cards: ${pending.length}`);
    console.log('Sample cut card info:', cut[0]?.card_info);
    console.log('Sample pending card info:', pending[0]?.card_info);
  }
}

run().catch(console.error);
