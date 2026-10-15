import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const orderNum = '261001-5';

  // 1. cc2564e5-c3d6-4f13-a37b-500d15674576: F415-ІП27-Хниз-4-74 (3500 шт) -> id: e13372a9-21c1-437c-80c2-658cf27eefcb (finished, sgp, 3770 шт)
  const res1 = await supabase.from('material_requests').update({
    inventory_id: 'e13372a9-21c1-437c-80c2-658cf27eefcb',
    details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (261001-5) [PACKAGING_SOURCE:SGP]: F415-ІП27-Хниз-4-74 (Лист 4мм) — 3500 шт. [ВИДАНО СГП]'
  }).eq('id', 'cc2564e5-c3d6-4f13-a37b-500d15674576');
  console.log('Update Хниз:', res1.error || 'OK');

  // 2. a0cc228d-e18e-4233-b33b-af53a845e83d: KF-Пластинка-3-162 (14000 шт) -> id: 57a15e2f-18bf-4e76-afb8-33946b75bccd (finished, sgp, 14003 шт)
  const res2 = await supabase.from('material_requests').update({
    inventory_id: '57a15e2f-18bf-4e76-afb8-33946b75bccd',
    details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (261001-5) [PACKAGING_SOURCE:SGP]: KF-Пластинка-3-162 (Лист Т300 (3мм)) — 14000 шт. [ВИДАНО СГП]'
  }).eq('id', 'a0cc228d-e18e-4233-b33b-af53a845e83d');
  console.log('Update Пластинка:', res2.error || 'OK');

  // 3. 54947b43-566d-4c16-ae89-af61d86035b5: F415-ІП27-Хверх-4-74 (3500 шт) -> id: 81eeb3fa-e102-4a8f-a43d-654046988878 (semi, operational, 5908 шт)
  const res3 = await supabase.from('material_requests').update({
    inventory_id: '81eeb3fa-e102-4a8f-a43d-654046988878',
    details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (261001-5) [PACKAGING_SOURCE:SGP]: F415-ІП27-Хверх-4-74 (Лист 4мм) — 3500 шт. [ВИДАНО СГП]'
  }).eq('id', '54947b43-566d-4c16-ae89-af61d86035b5');
  console.log('Update Хверх:', res3.error || 'OK');

  // 4. c8db9f33-b324-4c67-be2f-3bc804ca1b36: F415-ІП27-Хрестик-4-74 (7000 шт) -> id: 6c968d97-fc42-48f9-b58a-e5f4c913e5ff (semi, operational, 7492 шт)
  const res4 = await supabase.from('material_requests').update({
    inventory_id: '6c968d97-fc42-48f9-b58a-e5f4c913e5ff',
    details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (261001-5) [PACKAGING_SOURCE:SGP]: F415-ІП27-Хрестик-4-74 (Лист 4мм) — 7000 шт. [ВИДАНО СГП]'
  }).eq('id', 'c8db9f33-b324-4c67-be2f-3bc804ca1b36');
  console.log('Update Хрестик:', res4.error || 'OK');

  // Check new reserves on inventory table!
  const targetInventoryIds = [
    'e13372a9-21c1-437c-80c2-658cf27eefcb',
    '57a15e2f-18bf-4e76-afb8-33946b75bccd',
    '81eeb3fa-e102-4a8f-a43d-654046988878',
    '6c968d97-fc42-48f9-b58a-e5f4c913e5ff'
  ];

  const { data: updatedInv } = await supabase
    .from('inventory')
    .select('id, name, total_qty, reserved_qty, warehouse, type')
    .in('id', targetInventoryIds);

  console.log('--- UPDATED INVENTORY ROWS ---');
  console.log(updatedInv);
}

main();
