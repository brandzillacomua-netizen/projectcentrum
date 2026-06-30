const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
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
  .replace(/\s/g, '')

const resolveMachineType = (machineName) => {
  if (!machineName) return null
  const normMac = machineName.toLowerCase()
  if (normMac.includes('3050(16)x1600') || normMac.includes('3050(16)х1600') || normMac.includes('3050(16)') || normMac.includes('16x16') || normMac.includes('16х16') || normMac.includes('3050x1600') || normMac.includes('3050х1600') || normMac.includes('3050')) {
    return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
  } else if (normMac.includes('дракон') || normMac.includes('60x20') || normMac.includes('6000x2000') || normMac.includes('6000х2000')) {
    return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
  } else if (normMac.includes('малий') || normMac.includes('12x8') || normMac.includes('1200x800') || normMac.includes('12х8') || normMac.includes('1200х800')) {
    return 'CNC 1200x800 - 4 листи (Малий)'
  } else if (normMac.includes('три головий') || normMac.includes('триголовий') || normMac.includes('3060') || normMac.includes('30x16') || normMac.includes('30х16')) {
    return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
  } else if (normMac.includes('фея') || normMac.includes('ke xin')) {
    return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
  }
  return machineName
}

async function run() {
  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .in('id', [
      'bfc9d283-c39b-4f2e-a04f-b9adcdf95b19', 
      '8c5d0644-8efe-4bb5-b324-9374e1630be4', 
      '93e936d6-9455-4bf7-8357-24e7f1940bd4'
    ]);
    
  const { data: machineOperations } = await supabase.from('machine_operations').select('*');
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*');

  cards.forEach(card => {
    console.log(`\nEvaluating card ${card.id}:`);
    const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id));
    console.log(`- Nomenclature name: "${nom?.name}"`);
    const cardMac = card.machine || card.machine_name;
    console.log(`- cardMac: "${cardMac}"`);
    const opType = resolveMachineType(cardMac);
    console.log(`- opType resolved: "${opType}"`);
    
    const ops = (machineOperations || []).find(o => 
      String(o.nomenclature_id) === String(card.nomenclature_id) && 
      (normalize(o.machine_type) === normalize(opType) || String(o.machine_id) === String(cardMac))
    );
    
    console.log(`- ops found: ${!!ops}`);
    if (ops) {
      console.log(`- machine_type: "${ops.machine_type}"`);
      console.log(`- normalize(o.machine_type): "${normalize(ops.machine_type)}"`);
      console.log(`- normalize(opType): "${normalize(opType)}"`);
      
      const cuttersRates = {};
      if (Array.isArray(ops.side2_cut_ops)) {
        ops.side2_cut_ops.forEach(op => {
          if (op.startsWith('__CUTTER__Reference:')) return;
          if (op.startsWith('__CUTTER__:')) {
            const parts = op.split(':');
            const cNomId = parts[1];
            const cQty = parseFloat(parts[2]) || 0;
            if (cNomId && cQty > 0) {
              cuttersRates[cNomId] = cQty;
            }
          }
        });
      }
      console.log(`- cuttersRates:`, cuttersRates);
    }
  });
}

run().catch(console.error);
