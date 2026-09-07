const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, quantity, status, operation, card_info, created_at')
    .in('status', ['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer']);

  const { data: noms } = await supabase.from('nomenclatures').select('id, name');
  const nomMap = new Map((noms || []).map(n => [n.id, n.name]));

  console.log('ALL ACTIVE SHOP 2 CARDS IN DB:');
  for (const c of cards || []) {
    const isShop2 = c.card_info?.includes('[SHOP:2]') || c.card_info?.includes('[ЦЕХ №2]') || ['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Паквання', 'Пакування'].includes(c.operation);
    if (isShop2) {
      console.log(`[${nomMap.get(c.nomenclature_id)}] ID: ${c.id} | Qty: ${c.quantity} | Op: ${c.operation} | Status: ${c.status} | Created: ${c.created_at} | Info: ${c.card_info?.slice(0, 50)}`);
    }
  }
}

run();
