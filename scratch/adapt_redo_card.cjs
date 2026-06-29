const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const cardId = 'bfc9d283-c39b-4f2e-a04f-b9adcdf95b19';
  const sheetRequestId = '8817104a-cf6d-4238-87a2-2e801705838d';
  const cutter1Id = 'e86a67d3-ad16-4642-8e00-ba13f590bc6e';
  const cutter2Id = '33883624-ebee-4ef0-b277-6372a3e3c5f9';

  console.log('Початок адаптації картки довипуску та запиту матеріалів...');

  // 1. Оновлюємо картку work_cards
  const { data: updatedCard, error: cErr } = await supabase
    .from('work_cards')
    .update({
      quantity: 92,
      card_info: '[REDO] 110/2 [NEED:40000] [REQ:92] [BZ:0]'
    })
    .eq('id', cardId)
    .select();

  if (cErr) {
    console.error('Помилка оновлення картки:', cErr);
    return;
  }
  console.log('Успішно оновлено картку:', updatedCard[0]);

  // 2. Оновлюємо запит на листи в material_requests
  const { data: updatedSheetReq, error: sErr } = await supabase
    .from('material_requests')
    .update({
      quantity: 2,
      details: 'ДОЗАПИТ (БРАК/НЕСТАЧА) для 22062026-03: Лист Т300 (7мм) [Підготовлений] — 2 л.'
    })
    .eq('id', sheetRequestId)
    .select();

  if (sErr) {
    console.error('Помилка оновлення запиту на листи:', sErr);
    return;
  }
  console.log('Успішно оновлено запит на листи:', updatedSheetReq[0]);

  // 3. Оновлюємо фрезу 1
  const { data: updatedCutter1 } = await supabase
    .from('material_requests')
    .update({ quantity: 4 })
    .eq('id', cutter1Id)
    .select();
  console.log('Оновлено фрезу 1 (2х3,175): нове кол-во =', updatedCutter1[0]?.quantity);

  // 4. Оновлюємо фрезу 2
  const { data: updatedCutter2 } = await supabase
    .from('material_requests')
    .update({ quantity: 2 })
    .eq('id', cutter2Id)
    .select();
  console.log('Оновлено фрезу 2 (3х3,175): нове кол-во =', updatedCutter2[0]?.quantity);

  console.log('Адаптацію виконано успішно!');
}

run();
