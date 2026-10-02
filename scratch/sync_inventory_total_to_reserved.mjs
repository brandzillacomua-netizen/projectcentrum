import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  // 1. Fetch active material requests
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('inventory_id, nomenclature_id, quantity, status')
    .in('status', ['approved', 'reserved', 'issued']);

  const reservedByInvId = new Map();
  const reservedByNomId = new Map();

  (reqs || []).forEach(r => {
    const qty = Number(r.quantity || 0);
    if (r.inventory_id) {
      reservedByInvId.set(r.inventory_id, (reservedByInvId.get(r.inventory_id) || 0) + qty);
    }
    if (r.nomenclature_id) {
      reservedByNomId.set(r.nomenclature_id, (reservedByNomId.get(r.nomenclature_id) || 0) + qty);
    }
  });

  // 2. Fetch active BZ reservations
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('nomenclature_id, allocated_qty')
    .eq('status', 'allocated')
    .gt('allocated_qty', 0);

  (bzRes || []).forEach(r => {
    const qty = Number(r.allocated_qty || 0);
    reservedByNomId.set(r.nomenclature_id, (reservedByNomId.get(r.nomenclature_id) || 0) + qty);
  });

  // 3. Fetch all inventory items
  const { data: inventory } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, total_qty, reserved_qty, type');

  let updatedCount = 0;

  for (const item of (inventory || [])) {
    const activeReqReserve = reservedByInvId.get(item.id) || reservedByNomId.get(item.nomenclature_id) || 0;
    const dbReserved = Number(item.reserved_qty || 0);
    const targetReserved = Math.max(activeReqReserve, dbReserved);

    if (targetReserved > 0) {
      const currentTotal = Number(item.total_qty || 0);
      const targetTotal = Math.max(currentTotal, targetReserved);

      const updatePayload = {};
      if (currentTotal !== targetTotal) updatePayload.total_qty = targetTotal;

      if (Object.keys(updatePayload).length > 0) {
        updatePayload.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from('inventory')
          .update(updatePayload)
          .eq('id', item.id);

        if (error) {
          console.error(`Error updating item ${item.name}:`, error.message);
        } else {
          updatedCount++;
          console.log(`Updated ${item.name} (${item.type}): total_qty -> ${targetTotal} (reserved: ${targetReserved})`);
        }
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} inventory items so total_qty >= active reserved quantity.`);
}

main().catch(console.error);
