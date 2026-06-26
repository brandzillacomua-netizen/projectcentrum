const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const names = ['В-3-30', 'Н-3-14', 'Х-3-39', 'П-7-46'];
  
  console.log("=== Checking Nomenclatures in DB ===");
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  
  names.forEach(name => {
    const matches = noms.filter(n => n.name.includes(name));
    console.log(`\nMatches for "${name}":`);
    matches.forEach(m => {
      console.log(`- ID: ${m.id}, Name: ${m.name}, Type: ${m.type}`);
    });
  });

  console.log("\n=== Checking BOM for parent 'Рама F10' (26a77a50-d932-4a02-a65d-b4cd608ec6ac) ===");
  const { data: boms } = await supabase.from('bom_items').select('*').eq('parent_id', '26a77a50-d932-4a02-a65d-b4cd608ec6ac');
  boms.forEach(b => {
    const child = noms.find(n => n.id === b.child_id);
    console.log(`- Child ID in BOM: ${b.child_id}, Name: ${child ? child.name : 'Unknown'}`);
  });

  console.log("\n=== Checking unique nomenclature_ids in work_cards for task c7055204-cbad-4f74-bae6-4a8a79c14b7e ===");
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', 'c7055204-cbad-4f74-bae6-4a8a79c14b7e');
  const cardNomIds = [...new Set(cards.map(c => c.nomenclature_id))];
  cardNomIds.forEach(id => {
    const nom = noms.find(n => n.id === id);
    console.log(`- Card Nomenclature ID: ${id}, Name: ${nom ? nom.name : 'Unknown'}`);
  });
}

run();
