const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('machines').select('*').ilike('name', '%КЕ XIN%').order('name');
  if (error) { console.error('Error:', error); return; }
  
  console.log(`Знайдено ${data.length} верстатів КЕ XIN:`);
  
  // Extract Ф numbers
  const existingNums = new Set();
  data.forEach(m => {
    const match = m.name.match(/Ф(\d+)/i);
    if (match) {
      existingNums.add(parseInt(match[1]));
    }
    console.log(`  ID: ${m.id} | Назва: ${m.name} | № в черзі: ${m.sequence_number}`);
  });

  console.log('\nНаявні номери:', [...existingNums].sort((a,b) => a-b).join(', '));
  
  const missing = [];
  for (let i = 1; i <= 27; i++) {
    if (!existingNums.has(i)) missing.push(i);
  }
  console.log('Відсутні номери:', missing.join(', '));
  
  // Show a sample machine to see its structure
  if (data.length > 0) {
    console.log('\nСтруктура одного верстата (для дублювання):');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

run();
