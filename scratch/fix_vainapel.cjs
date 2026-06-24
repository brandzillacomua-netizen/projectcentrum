const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function run() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id,operator_name,started_at,status,operation,shift_name')
    .eq('status', 'in-progress');

  console.log('In-progress cards:');
  cards.forEach(c => {
    console.log(`  ${c.id.slice(-8)} | ${c.operator_name} | started_at: ${c.started_at}`);
  });

  // Find cards for Вайнапель Данило or cards starting in the future (e.g. on June 25th)
  const targetCards = cards.filter(c => 
    (c.operator_name && c.operator_name.includes('Вайнапель')) ||
    (c.started_at && c.started_at.startsWith('2026-06-25'))
  );

  if (targetCards.length > 0) {
    for (const card of targetCards) {
      // 19:05 Kyiv time on June 24th = 16:05:00 UTC
      const correctTime = '2026-06-24T16:05:00.000Z';
      console.log(`\nFixing card ${card.id.slice(-8)} (${card.operator_name}): setting started_at -> ${correctTime}`);
      const { error } = await supabase
        .from('work_cards')
        .update({ started_at: correctTime })
        .eq('id', card.id);
      if (error) console.error('Error:', error);
      else console.log('✓ Successfully corrected!');
    }
  } else {
    console.log('\nNo matching future cards or cards for Вайнапель found.');
  }
}

run().catch(console.error);
