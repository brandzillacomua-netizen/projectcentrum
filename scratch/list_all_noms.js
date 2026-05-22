import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function dumpString(s) {
  return s.split('').map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')
}

async function run() {
  const { data: noms, error } = await supabase.from('nomenclatures').select('*')
  if (error) {
    console.error('Error fetching nomenclatures:', error)
    return
  }

  console.log(`Total nomenclatures in DB: ${noms.length}`)
  
  // Group by normalized name (translating homoglyphs and ignoring casing / symbols)
  const normalize = (s) => {
    if (!s) return '';
    const homoglyphs = {
      'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у',
      'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у'
    };
    return s.toLowerCase().replace(/[`'"()\-]/g, '').split('').map(c => homoglyphs[c] || c).join('').trim();
  };

  const groups = {};
  noms.forEach(n => {
    const norm = normalize(n.name);
    if (!groups[norm]) groups[norm] = [];
    groups[norm].push(n);
  });

  console.log('\n--- Checking for potential homoglyphs/duplicates ---')
  for (const [norm, list] of Object.entries(groups)) {
    if (list.length > 1) {
      console.log(`\nNormalized key: "${norm}" (Matches count: ${list.length})`)
      list.forEach(n => {
        console.log(`  - ID: ${n.id}`)
        console.log(`    Name: "${n.name}"`)
        console.log(`    Type: ${n.type}`)
        console.log(`    Chars: ${dumpString(n.name)}`)
      });
    }
  }

  console.log('\n--- All Product Nomenclatures ---')
  noms.filter(n => n.type === 'product').forEach(n => {
    console.log(`- ID: ${n.id}, Name: "${n.name}", Chars: ${dumpString(n.name)}`)
  })
}

run()
