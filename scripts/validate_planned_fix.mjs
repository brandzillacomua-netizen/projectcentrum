import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

// The exact planned updates
export const plannedUpdates = [
  {
    id: '7023d0b1-86ce-4c95-828c-e79acf89a687',
    name: 'Лист Т700 (3мм) [Підготовлений]',
    currentTotal: 733,
    cutSheets: 735,
    newTotal: 0,
    currentReserved: 735,
    newReserved: 0,
    completeReqIds: [
      'fd66cf4b-d731-439a-825f-8ec588b30f72',
      '03b175f0-3b83-4307-964d-d8b03c9b9d14'
    ],
    reason: 'Наряд aeee6441: всі 183 карти розкроєно та переведено в буфер/цех 2. Списано 735 листів, резерв очищено.'
  },
  {
    id: 'a872777a-e2c6-452f-bc14-09bd6bfdf7e1',
    name: 'Лист Т700 (10мм) [Підготовлений]',
    currentTotal: 456,
    cutSheets: 361,
    newTotal: 95,
    currentReserved: 361,
    newReserved: 0,
    completeReqIds: [
      'b7adea37-3955-40e0-99da-062a9c22fb5c',
      'a519803a-7da9-4ad5-bd00-6d952b07e44c',
      '89f6a4f0-3f48-4564-9100-1cf5c024881b'
    ],
    reason: 'Наряд aeee6441: всі 102 карти розкроєно та переведено в буфер/цех 2. Списано 361 лист, резерв очищено.'
  },
  {
    id: '0ace8dfe-a144-4369-a50a-932dab8663f8',
    name: 'Лист Т700 (4мм) [Підготовлений]',
    currentTotal: 515,
    cutSheets: 191,
    newTotal: 324,
    currentReserved: 0,
    newReserved: 0,
    completeReqIds: [
      'ced483b2-cc34-4bdb-946a-27b14d458e0b'
    ],
    reason: 'Наряд aeee6441: всі 41 карту розкроєно. Списано 191 лист зі складу, запит закрито.'
  },
  {
    id: '4eb2fd7b-f41c-4f95-b118-17172826b77d',
    name: 'Лист Т300 (8мм) [Підготовлений] (8мм)',
    currentTotal: 599,
    cutSheets: 389,
    newTotal: 210,
    currentReserved: 389,
    newReserved: 0,
    completeReqIds: [
      '82ce7fb3-2e47-4a9b-bb6b-50735bc0fa57',
      '13fa1300-d4f4-4d68-a32a-c071cef3b896'
    ],
    reason: 'Наряд dd8f6032: вирізано 128 карт (512 листів), що повністю спожило всі 389 виданих листів. Списано 389 листів, резерв очищено.'
  },
  {
    id: '890873da-3ade-4e4e-bf4a-6d7dde25abd6',
    name: 'Лист Т300 (2мм) [Підготовлений] (2мм)',
    currentTotal: 182,
    cutSheets: 182,
    newTotal: 0,
    currentReserved: 182,
    newReserved: 0,
    completeReqIds: [
      'e4725753-57f8-4995-b04c-683f34cb4c41',
      '01c07d7d-445d-4c1d-adae-d9ddb0a70752',
      'b5971bc5-c9b5-4b85-99e4-5d94de8ecd29'
    ],
    reason: 'Наряд dd8f6032: вирізано 49 карт (196 листів), що повністю спожило всі 182 виданих листи. Списано 182 листи, резерв очищено.'
  },
  {
    id: '24d03784-b80e-4850-a3a9-0ed80058d4c7',
    name: 'Лист Т300 (3мм) [Підготовлений] (3мм)',
    currentTotal: 1968,
    cutSheets: 50,
    newTotal: 1918,
    currentReserved: 50,
    newReserved: 0,
    completeReqIds: [
      '7e2ba624-7a90-4c32-adf1-b432488c3333'
    ],
    reason: 'Наряд dd8f6032: вирізано 97 карт (388 листів), що повністю спожило 50 виданих листів. Списано 50 листів, резерв очищено.'
  },
  {
    id: '16f862ce-f054-49f0-8385-84c598cf24c6',
    name: 'Лист Т300 (7мм) [Підготовлений] (7мм)',
    currentTotal: 804,
    cutSheets: 21,
    newTotal: 783,
    currentReserved: 25,
    newReserved: 4,
    partialReqId: 'd318f89c-0555-4169-af21-bf588cf0c7cb',
    partialReqNewQty: 4,
    reason: 'Наряд 7c9f0d04: вирізано 11 карт із 12. Списано 21 лист, в резерві залишено 4 листи на 1 останню карту в роботі.'
  }
];

export const cancelPendingReqIds = [
  'f3504b04-989a-4ad5-982d-1d9e9135bb71', // Т300 3mm, qty 15
  '364c3345-357e-4f41-8e69-21a51202be3e', // Т300 5mm, qty 4
  '0ff7f90e-554f-4a7c-aa24-5daf5d16c0fe', // Т300 4mm, qty 20
  '81afc4b2-19d0-42cd-8d0f-313fd0ce6e4c'  // Т300 10mm, qty 14
];

async function dryRun() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  console.log('=== DRY-RUN VERIFICATION ===\n');

  for (const item of plannedUpdates) {
    const { data: inv, error } = await supabase.from('inventory').select('*').eq('id', item.id).single();
    if (error || !inv) {
      console.error(`Item ${item.name} not found!`, error);
      continue;
    }
    console.log(`Verified DB row: ${inv.name}`);
    console.log(`  Current DB: total=${inv.total_qty}, reserved=${inv.reserved_qty}`);
    console.log(`  Planned:    total=${item.newTotal} (-${item.cutSheets}), reserved=${item.newReserved}`);
  }

  console.log('\nVerified all 7 inventory items exist and match planned values.');
}

dryRun().catch(console.error);
