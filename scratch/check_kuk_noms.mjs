import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } } }
);

async function checkAllCutterNoms() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const { data: noms } = await prodClient.from('nomenclatures').select('*');
  const { data: inv } = await prodClient.from('inventory').select('*');

  // Find all nomenclatures containing "кукурудза"
  const kuk = noms.filter(n => n.name && n.name.toLowerCase().includes('кукурудза'));
  console.log(`Found ${kuk.length} nomenclatures with "кукурудза":`);
  kuk.forEach(n => {
    const matchingInv = inv.filter(i => String(i.nomenclature_id) === String(n.id));
    const opInv = matchingInv.filter(i => i.warehouse === 'operational' || !i.warehouse);
    const totalOp = opInv.reduce((s, i) => s + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0);
    console.log(`- NOM: "${n.name}" (id: ${n.id}, type: ${n.type}) => opInv rows: ${opInv.length}, totalOp: ${totalOp}`);
    matchingInv.forEach(i => console.log(`    inv: id=${i.id}, wh=${i.warehouse}, total=${i.total_qty}, name="${i.name}"`));
  });
}

checkAllCutterNoms().catch(console.error);
