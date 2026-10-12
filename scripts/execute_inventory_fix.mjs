import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

// The exact operational updates based on our comprehensive audit
const updatesConfig = [
  {
    id: '7023d0b1-86ce-4c95-828c-e79acf89a687',
    name: 'Лист Т700 (3мм) [Підготовлений]',
    cutSheets: 735,
    targetReserved: 0,
    completeReqIds: [
      'fd66cf4b-d731-439a-825f-8ec588b30f72',
      '03b175f0-3b83-4307-964d-d8b03c9b9d14'
    ],
    reason: 'Наряд aeee6441: всі 183 карти розкроєно та переведено в буфер. Списано 735 листів, резерв закрито.'
  },
  {
    id: 'a872777a-e2c6-452f-bc14-09bd6bfdf7e1',
    name: 'Лист Т700 (10мм) [Підготовлений]',
    cutSheets: 361,
    targetReserved: 0,
    completeReqIds: [
      'b7adea37-3955-40e0-99da-062a9c22fb5c',
      'a519803a-7da9-4ad5-bd00-6d952b07e44c',
      '89f6a4f0-3f48-4564-9100-1cf5c024881b'
    ],
    reason: 'Наряд aeee6441: всі 102 карти розкроєно та переведено в буфер. Списано 361 лист, резерв закрито.'
  },
  {
    id: '0ace8dfe-a144-4369-a50a-932dab8663f8',
    name: 'Лист Т700 (4мм) [Підготовлений]',
    cutSheets: 191,
    targetReserved: 0,
    completeReqIds: [
      'ced483b2-cc34-4bdb-946a-27b14d458e0b'
    ],
    reason: 'Наряд aeee6441: всі 41 карту розкроєно. Списано 191 лист зі складу, запит закрито.'
  },
  {
    id: '4eb2fd7b-f41c-4f95-b118-17172826b77d',
    name: 'Лист Т300 (8мм) [Підготовлений] (8мм)',
    cutSheets: 389,
    targetReserved: 0,
    completeReqIds: [
      '82ce7fb3-2e47-4a9b-bb6b-50735bc0fa57',
      '13fa1300-d4f4-4d68-a32a-c071cef3b896'
    ],
    reason: 'Наряд dd8f6032: вирізано 128 карт (512 листів). Повністю спожито 389 виданих листів. Списано 389 листів, резерв закрито.'
  },
  {
    id: '890873da-3ade-4e4e-bf4a-6d7dde25abd6',
    name: 'Лист Т300 (2мм) [Підготовлений] (2мм)',
    cutSheets: 182,
    targetReserved: 0,
    completeReqIds: [
      'e4725753-57f8-4995-b04c-683f34cb4c41',
      '01c07d7d-445d-4c1d-adae-d9ddb0a70752',
      'b5971bc5-c9b5-4b85-99e4-5d94de8ecd29'
    ],
    reason: 'Наряд dd8f6032: вирізано 49 карт (196 листів). Повністю спожито 182 виданих листи. Списано 182 листи, резерв закрито.'
  },
  {
    id: '24d03784-b80e-4850-a3a9-0ed80058d4c7',
    name: 'Лист Т300 (3мм) [Підготовлений] (3мм)',
    deductRemainingReserved: true, // deduct whatever reserve is left from the historical 50
    targetReserved: 0,
    completeReqIds: [
      '7e2ba624-7a90-4c32-adf1-b432488c3333'
    ],
    reason: 'Наряд dd8f6032: вирізано 97 карт (388 листів). Спожито залишок видачі 50 листів.'
  },
  {
    id: '16f862ce-f054-49f0-8385-84c598cf24c6',
    name: 'Лист Т300 (7мм) [Підготовлений] (7мм)',
    cutSheets: 21,
    targetReserved: 4,
    partialReqId: 'd318f89c-0555-4169-af21-bf588cf0c7cb',
    partialReqNewQty: 4,
    reason: 'Наряд 7c9f0d04: вирізано 11 карт із 12. Списано 21 лист, в резерві залишено 4 листи на 1 останню карту в роботі.'
  }
];

const cancelPendingReqIds = [
  'f3504b04-989a-4ad5-982d-1d9e9135bb71', // Т300 3mm, qty 15
  '364c3345-357e-4f41-8e69-21a51202be3e', // Т300 5mm, qty 4
  '0ff7f90e-554f-4a7c-aa24-5daf5d16c0fe', // Т300 4mm, qty 20
  '81afc4b2-19d0-42cd-8d0f-313fd0ce6e4c'  // Т300 10mm, qty 14
];

async function execute() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });
  console.log('=== EXECUTING DATABASE UPDATE ===\n');

  const executionLog = [];

  for (const cfg of updatesConfig) {
    // 1. Fetch current live row
    const { data: inv, error: fErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', cfg.id)
      .single();

    if (fErr || !inv) {
      console.error(`Failed to fetch inventory item ${cfg.name}:`, fErr);
      continue;
    }

    const currentTotal = Number(inv.total_qty) || 0;
    const currentReserved = Number(inv.reserved_qty) || 0;

    let deductCut = cfg.cutSheets;
    if (cfg.deductRemainingReserved) {
      deductCut = currentReserved;
    }

    const newTotal = Math.max(0, currentTotal - deductCut);
    const newReserved = cfg.targetReserved;

    // 2. Update inventory row
    const { data: updatedInv, error: uErr } = await supabase
      .from('inventory')
      .update({
        total_qty: newTotal,
        reserved_qty: newReserved,
        updated_at: new Date().toISOString()
      })
      .eq('id', cfg.id)
      .select()
      .single();

    if (uErr) {
      console.error(`Error updating inventory ${cfg.name}:`, uErr);
      continue;
    }

    // 3. Complete completed material requests
    if (cfg.completeReqIds && cfg.completeReqIds.length > 0) {
      const { error: rErr } = await supabase
        .from('material_requests')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .in('id', cfg.completeReqIds);

      if (rErr) console.error(`Error updating material requests for ${cfg.name}:`, rErr);
    }

    // 4. Update partial material request if applicable
    if (cfg.partialReqId) {
      const { error: prErr } = await supabase
        .from('material_requests')
        .update({
          quantity: cfg.partialReqNewQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', cfg.partialReqId);

      if (prErr) console.error(`Error updating partial material request:`, prErr);
    }

    executionLog.push({
      "Позиція": cfg.name,
      "Було Total": currentTotal,
      "Списано вирізаних": deductCut,
      "Стало Total": newTotal,
      "Було Резерв": currentReserved,
      "Стало Резерв": newReserved,
      "Знято резерву": currentReserved - newReserved,
      "Обґрунтування": cfg.reason
    });
  }

  // 5. Cancel orphan pending requests for SGP order
  if (cancelPendingReqIds.length > 0) {
    const { error: cErr } = await supabase
      .from('material_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .in('id', cancelPendingReqIds);

    if (cErr) console.error('Error cancelling orphan requests:', cErr);
    else console.log(`Cancelled ${cancelPendingReqIds.length} orphan pending requests for order completed from SGP.`);
  }

  console.log('\n=== EXECUTION RESULT SUMMARY ===');
  console.table(executionLog.map(r => ({
    "Позиція": r["Позиція"],
    "Було Total": r["Було Total"],
    "Списано": r["Списано вирізаних"],
    "Стало Total": r["Стало Total"],
    "Було Резерв": r["Було Резерв"],
    "Стало Резерв": r["Стало Резерв"],
    "Знято резерву": r["Знято резерву"]
  })));

  console.log('\nFull log details:');
  console.log(JSON.stringify(executionLog, null, 2));
}

execute().catch(console.error);
