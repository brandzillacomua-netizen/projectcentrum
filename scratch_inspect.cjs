const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const findBestParentProduct = (partName, parentProducts) => {
  if (!partName || !parentProducts || parentProducts.length === 0) return null;

  const normalize = (s) => {
    if (!s) return '';
    const homoglyphs = {
      'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у'
    };
    return s.toLowerCase()
      .split('')
      .map(c => homoglyphs[c] || c)
      .join('');
  };

  const normPart = normalize(partName);

  const getProjectNum = (str) => {
    const match = str.match(/іп\s*[-_]?\s*(\d+)/);
    if (match) return match[1];
    const matchProj = str.match(/проект\s*[-_]?\s*(\d+)/);
    if (matchProj) return matchProj[1];
    return null;
  };

  const partProjNum = getProjectNum(normPart);

  let bestMatch = null;
  let maxScore = -1;

  for (const parent of parentProducts) {
    const normParent = normalize(parent.name);
    const parentProjNum = getProjectNum(normParent);

    let score = 0;

    // Rule 1: Project numbers match
    if (partProjNum && parentProjNum && partProjNum === parentProjNum) {
      score += 100;
    }

    // Rule 2: Substring matching for distinctive codes
    const keyCodes = ['f610', 'f613', 'f5', 'litavr', 'kharak', '210', '218', '21', '35', '72', '24'];
    for (const code of keyCodes) {
      if (normPart.includes(code) && normParent.includes(code)) {
        score += 50;
      }
    }

    // Rule 3: Common numbers matching
    const partNumbers = normPart.match(/\d+/g) || [];
    const parentNumbers = normParent.match(/\d+/g) || [];
    
    const filteredPartNumbers = partNumbers.filter(n => n.length > 1 || n === '5' || n === '7' || n === '8');
    const filteredParentNumbers = parentNumbers.filter(n => n.length > 1 || n === '5' || n === '7' || n === '8');
    
    let commonNumCount = 0;
    filteredPartNumbers.forEach(num => {
      if (filteredParentNumbers.includes(num)) {
        commonNumCount++;
      }
    });
    
    score += commonNumCount * 10;

    if (score > maxScore && score > 0) {
      maxScore = score;
      bestMatch = parent;
    }
  }

  return bestMatch;
};

async function run() {
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const { data: bom } = await supabase.from('bom_items').select('*');
  
  const products = noms.filter(n => n.type === 'product');
  const parts = noms.filter(n => n.type === 'part');
  const unlinkedParts = parts.filter(p => !bom.some(b => b.child_id === p.id));
  
  console.log('\n--- TESTING MATCHING ON UNLINKED PARTS ---');
  unlinkedParts.forEach(p => {
    const parent = findBestParentProduct(p.name, products);
    console.log(`Part: "${p.name}" -> Matched Parent: "${parent ? parent.name : 'NONE'}"`);
  });
}

run();
