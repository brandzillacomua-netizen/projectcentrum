const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  // Fetch all Фея machines to check existing numbers
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('type', 'CNC KE XIN - 4 - 16 листів (ФЕЯ)')
    .order('sequence_number');
    
  if (error) { console.error('Error:', error); return; }
  
  // Find which numbers exist
  const existingNums = new Set();
  data.forEach(m => {
    const match = (m.sequence_number || '').match(/Ф(\d+)/i);
    if (match) existingNums.add(parseInt(match[1]));
  });
  
  console.log('Наявні ФЕЯ верстати:', [...existingNums].sort((a,b)=>a-b).map(n=>'Ф'+n).join(', '));
  
  // Find missing
  const missing = [];
  for (let i = 1; i <= 27; i++) {
    if (!existingNums.has(i)) missing.push(i);
  }
  console.log('Відсутні:', missing.map(n=>'Ф'+n).join(', '));
  
  if (missing.length === 0) {
    console.log('Всі верстати Ф1-Ф27 вже є!');
    return;
  }
  
  // Use one of the existing machines as template (take Ф20 as the last complete one)
  const template = data.find(m => m.sequence_number === 'Ф20') || data[data.length - 1];
  console.log('\nШаблон для нових верстатів:', template.name, template.sequence_number);
  console.log('Структура шаблону:', JSON.stringify(template, null, 2));
  
  // Create missing machines
  const toInsert = missing.map(num => ({
    name: 'CNC KE XIN - ФЕЯ',
    type: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)',
    sequence_number: `Ф${num}`,
    sheet_capacity: template.sheet_capacity || 4,
    status: template.status || 'idle',
    floor: template.floor || 'Локація не вказана',
  }));
  
  console.log(`\nДодаємо ${toInsert.length} верстатів: ${toInsert.map(m=>m.sequence_number).join(', ')}`);
  
  const { data: inserted, error: insertError } = await supabase
    .from('machines')
    .insert(toInsert)
    .select('id, name, sequence_number');
    
  if (insertError) {
    console.error('Insert error:', insertError);
    return;
  }
  
  console.log(`\n✅ Успішно додано ${inserted.length} верстатів ФЕЯ:`);
  inserted.forEach(m => console.log(`  ${m.sequence_number} → ID: ${m.id}`));
}

run();
