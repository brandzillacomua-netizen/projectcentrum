import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Fetch all open requests (status in issued, pending)
  const { data: openReqs } = await supabase.from('material_requests')
    .select('id, nomenclature_id, inventory_id, details, quantity, status')
    .in('status', ['issued', 'pending'])
    .ilike('details', '%фреза%');

  let res2mm = 0, res3mm = 0, res6mm = 0;
  for (const r of (openReqs || [])) {
    const q = Number(r.quantity) || 0;
    const det = (r.details || '').toLowerCase();
    const nomId = String(r.nomenclature_id || '');
    if (nomId === '2e2f45ea-e2d8-480b-9b08-f6d6519149fb' || nomId === '9f3442ec-4453-4578-b463-edbb5077ad4a' || det.includes('ф2') || det.includes('2х3,175')) {
      res2mm += q;
    } else if (nomId === '1ba4c09f-2fcf-4fc8-957d-80fca75d371a' || nomId === 'e1fd1d66-218a-453c-9465-a86374de1e42' || det.includes('ф3') || det.includes('3х3,175')) {
      res3mm += q;
    } else if (nomId === '792717a5-bd47-46a5-97f0-0e5f6ff81e58' || nomId === 'e5b209f9-4a1e-4c39-a88d-45b0fbced448' || nomId === '1398a735-a6c4-411e-9dce-a5421efd29da' || det.includes('ф6') || det.includes('фасоч')) {
      res6mm += q;
    }
  }

  console.log('Authoritative Active Reserves:');
  console.log('2mm cutter reserve:', res2mm);
  console.log('3mm cutter reserve:', res3mm);
  console.log('6mm cutter reserve:', res6mm);

  // Set the correct inventory.reserved_qty
  await supabase.from('inventory').update({ reserved_qty: res2mm }).eq('id', '0f8982c4-7640-4d93-9681-1403a4527a4a');
  await supabase.from('inventory').update({ reserved_qty: res3mm }).eq('id', 'c448f726-f57a-400a-b62a-1c3b10a154d1');
  await supabase.from('inventory').update({ reserved_qty: res6mm }).eq('id', '32d045cb-8004-4698-9fa3-00ccaa6217da');

  // Set all other operational cutters reserved_qty to 0
  const mainIds = new Set([
    '0f8982c4-7640-4d93-9681-1403a4527a4a',
    'c448f726-f57a-400a-b62a-1c3b10a154d1',
    '32d045cb-8004-4698-9fa3-00ccaa6217da'
  ]);

  const { data: allOpCutters } = await supabase.from('inventory')
    .select('id, name, reserved_qty')
    .or('warehouse.eq.operational,warehouse.is.null')
    .ilike('name', '%фреза%');

  for (const oc of (allOpCutters || [])) {
    if (!mainIds.has(oc.id) && oc.reserved_qty > 0) {
      console.log('Zeroing false reserve on:', oc.name, 'was:', oc.reserved_qty);
      await supabase.from('inventory').update({ reserved_qty: 0 }).eq('id', oc.id);
    }
  }

  console.log('Done reconciling operational cutter reserves!');
}

run();
