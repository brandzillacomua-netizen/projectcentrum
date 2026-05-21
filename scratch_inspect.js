const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: noms, error: nomErr } = await supabase.from('nomenclatures').select('*');
  if (nomErr) {
    console.error('Noms Error:', nomErr);
    return;
  }
  
  const { data: bom, error: bomErr } = await supabase.from('bom_items').select('*');
  if (bomErr) {
    console.error('BOM Error:', bomErr);
    return;
  }
  
  console.log(`Loaded ${noms.length} nomenclatures and ${bom.length} BOM items.`);
  
  // Let's filter products and see their BOM counts
  const products = noms.filter(n => n.type === 'product');
  console.log('\nProducts in DB:');
  products.forEach(p => {
    const children = bom.filter(b => b.parent_id === p.id);
    console.log(`- [${p.id}] ${p.name} (type: ${p.type}) -> ${children.length} BOM children`);
  });

  // Let's list some components that are in "Other" according to the user
  console.log('\nSample BOM items to inspect:');
  const details = ['F610-ІП24-Н-3-14', 'ІП-72-F5-Х-5-63', 'F613-ІП47-П-10-22'];
  details.forEach(dName => {
    const match = noms.find(n => n.name === dName || n.name.includes(dName));
    if (match) {
      const bomLink = bom.find(b => b.child_id === match.id);
      if (bomLink) {
        const parent = noms.find(n => n.id === bomLink.parent_id);
        console.log(`Detail "${dName}" (id: ${match.id}, type: ${match.type}) belongs to parent: [${parent?.id}] ${parent?.name}`);
      } else {
        console.log(`Detail "${dName}" (id: ${match.id}, type: ${match.type}) HAS NO BOM LINK!`);
      }
    } else {
      console.log(`Detail "${dName}" not found in nomenclatures.`);
    }
  });
}

run();
