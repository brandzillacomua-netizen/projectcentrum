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

const normalize = (s) => (s || '').toLowerCase().trim()
  .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
  .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
  .replace(/[хx]/g, 'x')
  .replace(/[іi]/g, 'i')
  .replace(/[уy]/g, 'y')
  .replace(/[кk]/g, 'k')
  .replace(/[мm]/g, 'm')
  .replace(/[нn]/g, 'n')
  .replace(/[вv]/g, 'v')
  .replace(/[и]/g, 'y')
  .replace(/[зz]/g, 'z')
  .replace(/\s/g, '');

const parseMaterialName = (details) => {
  if (!details) return ''
  if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
    const match = details.match(/:\s*(.+)\s*—/)
    return match ? match[1].trim() : details
  }
  return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
}

async function main() {
  const { data: inventory } = await supabase.from('inventory').select('*');
  const details = 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (СГП) (30062026-01): Гвинт М3x35 — 12000 шт.';
  const nomenclature_id = '077e12b5-ca83-4ce2-b7dd-f8fbc7d2b3fc';
  
  const parsedName = parseMaterialName(details);
  console.log("Parsed Name:", parsedName);
  const normParsed = normalize(parsedName);
  console.log("Normalized Parsed Name:", normParsed);

  const matchingInv = (inventory || []).filter(i => {
    if (i.warehouse !== 'operational' && i.warehouse) return false
    if (nomenclature_id && String(i.nomenclature_id) === String(nomenclature_id)) return true
    if (parsedName) {
      const normName = normalize(i.name)
      if (normName === normParsed) return true
      if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
      const normNameNoParens = normalize(i.name.replace(/\s*\([^)]*\)$/, ''))
      if (normNameNoParens === normParsed) return true
    }
    return false
  });

  console.log("Matching items in operational:", matchingInv);
}

main();
