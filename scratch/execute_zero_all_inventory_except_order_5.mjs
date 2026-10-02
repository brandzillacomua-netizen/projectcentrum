import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const targetOrderId = '62330578-eb54-401c-8258-c2efd660780e';

  // 1. Fetch active allocated BZ reservations for 261001-5
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('nomenclature_id, allocated_qty')
    .eq('order_id', targetOrderId)
    .eq('status', 'allocated')
    .gt('allocated_qty', 0);

  const activeAllocations = new Map();
  (bzRes || []).forEach(r => {
    activeAllocations.set(r.nomenclature_id, Number(r.allocated_qty || 0));
  });

  console.log('Active BZ allocations for order 261001-5:', Array.from(activeAllocations.entries()));

  // 2. Fetch all inventory records
  const { data: allInv, error: invErr } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty');

  if (invErr) {
    console.error('Error fetching inventory:', invErr);
    process.exit(1);
  }

  console.log(`Total inventory records in DB: ${allInv.length}`);

  let updatedCount = 0;
  let preservedCount = 0;

  for (let i = 0; i < allInv.length; i += 50) {
    const batch = allInv.slice(i, i + 50);
    for (const item of batch) {
      const isReservedWipBz = item.type === 'wip_bz' && activeAllocations.has(item.nomenclature_id);
      const targetTotal = isReservedWipBz ? activeAllocations.get(item.nomenclature_id) : 0;

      if (Number(item.total_qty) !== targetTotal || Number(item.reserved_qty) !== 0) {
        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            total_qty: targetTotal,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (updErr) {
          console.error(`Error updating item ${item.id} (${item.name}):`, updErr.message);
        } else {
          updatedCount++;
        }
      } else if (isReservedWipBz) {
        preservedCount++;
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} inventory records to 0 (or reserved quantity).`);
  console.log(`Preserved ${preservedCount} active BZ reservation balances for order 261001-5.`);

  // Verify non-zero balances remaining
  const { data: remainingNonZero } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty')
    .gt('total_qty', 0);

  console.log('\n--- REMAINING NON-ZERO INVENTORY RECORDS ---');
  console.log(JSON.stringify(remainingNonZero, null, 2));
}

main().catch(console.error);
