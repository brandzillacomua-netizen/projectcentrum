import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function inspectCuttersInProd() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: noms } = await prodClient.from('nomenclatures').select('*');
  const { data: inv } = await prodClient.from('inventory').select('*');

  // Find all cutters that have dia 2
  const targetDia = '2';

  const extractCutterDiameter = (nameStr) => {
    if (!nameStr) return null;
    const s = String(nameStr).toLowerCase();
    const fMatch = s.match(/ф\s*(\d+(?:[.,]\d+)?)/);
    if (fMatch) return fMatch[1].replace(',', '.');
    const mmMatch = s.match(/(\d+(?:[.,]\d+)?)\s*мм/);
    if (mmMatch) return mmMatch[1].replace(',', '.');
    const dimMatch = s.match(/(\d+(?:[.,]\d+)?)\s*[хx]/);
    if (dimMatch) return dimMatch[1].replace(',', '.');
    return null;
  };

  const cutterNoms = (noms || []).filter(n => {
    if (n.type === 'cutter_type') return false;
    const nLower = (n.name || '').toLowerCase();
    if (nLower.startsWith('тип ф') || nLower.startsWith('тип f')) return false;
    return nLower.includes('фрез') || n.type === 'consumable';
  });

  const getStock = (nomId) => {
    const item = (inv || []).find(i => (i.warehouse === 'operational' || !i.warehouse) && String(i.nomenclature_id) === String(nomId));
    return item ? Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0)) : 0;
  };

  console.log('--- Matching Cutters for Фреза ф2 in PROD ---');
  cutterNoms.forEach(n => {
    const dia = extractCutterDiameter(n.name);
    if (dia === targetDia) {
      const stock = getStock(n.id);
      const allInvForN = inv.filter(i => String(i.nomenclature_id) === String(n.id));
      console.log(`[NOM] ${n.name} (id: ${n.id}) => stock calculated: ${stock}`);
      allInvForN.forEach(i => {
        console.log(`     inv row: id=${i.id}, warehouse=${i.warehouse}, total=${i.total_qty}, res=${i.reserved_qty}`);
      });
      if (allInvForN.length === 0) {
        console.log(`     NO INVENTORY ROWS FOR NOM_ID ${n.id}!`);
      }
    }
  });
}

inspectCuttersInProd().catch(console.error);
