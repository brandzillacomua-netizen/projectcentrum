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

  // 2. Fetch all inventory records with total_qty > 0 or reserved_qty > 0
  const { data: nonZeroInv, error: invErr } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty')
    .or('total_qty.gt.0,reserved_qty.gt.0');

  if (invErr) {
    console.error('Error fetching inventory:', invErr);
    process.exit(1);
  }

  console.log(`Non-zero inventory records in DB: ${nonZeroInv.length}`);

  const idsToZero = [];
  let preservedCount = 0;

  for (const item of nonZeroInv) {
    const isReservedWipBz = item.type === 'wip_bz' && activeAllocations.has(item.nomenclature_id);
    if (isReservedWipBz) {
      const targetQty = activeAllocations.get(item.nomenclature_id);
      if (Number(item.total_qty) !== targetQty || Number(item.reserved_qty) !== 0) {
        await supabase
          .from('inventory')
          .update({ total_qty: targetQty, reserved_qty: 0, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      }
      preservedCount++;
    } else {
      idsToZero.push(item.id);
    }
  }

  console.log(`Found ${idsToZero.length} non-zero records to zero out.`);

  // Batch update 100 at a time
  for (let i = 0; i < idsToZero.length; i += 100) {
    const batch = idsToZero.slice(i, i + 100);
    const { error: batchErr } = await supabase
      .from('inventory')
      .update({ total_qty: 0, reserved_qty: 0, updated_at: new Date().toISOString() })
      .in('id', batch);

    if (batchErr) {
      console.error(`Batch update error at index ${i}:`, batchErr.message);
    } else {
      console.log(`Zeroed batch of ${batch.length} items (${i + batch.length}/${idsToZero.length})...`);
    }
  }

  console.log(`\nDONE: Successfully zeroed all non-reserved inventory rows.`);
  console.log(`Preserved ${preservedCount} active BZ reservation balances for order 261001-5.`);

  // Final check
  const { data: finalNonZero } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty')
    .gt('total_qty', 0);

  console.log('\n--- FINAL REMAINING NON-ZERO INVENTORY RECORDS ---');
  console.log(JSON.stringify(finalNonZero, null, 2));
}

main().catch(console.error);
