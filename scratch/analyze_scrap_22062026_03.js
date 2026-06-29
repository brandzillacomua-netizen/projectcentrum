const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Пошук замовлення/наряду 22062026-03...');
  
  // 1. Знайдемо замовлення
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, order_num, customer')
    .eq('order_num', '22062026-03');

  if (oErr) {
    console.error('Помилка пошуку замовлення:', oErr);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('Замовлення з номером 22062026-03 не знайдено.');
    return;
  }

  const order = orders[0];
  console.log(`Знайдено замовлення: ID=${order.id}, Номер=${order.order_num}, Замовник=${order.customer}`);

  // 2. Знайдемо наряди (tasks) для цього замовлення
  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('id, step, status, created_at')
    .eq('order_id', order.id);

  if (tErr) {
    console.error('Помилка пошуку нарядів:', tErr);
    return;
  }

  console.log(`Знайдено нарядів: ${tasks.length}`);
  for (const t of tasks) {
    console.log(`- Наряд ID=${t.id}, Етап=${t.step}, Статус=${t.status}, Створено=${t.created_at}`);
  }

  const taskIds = tasks.map(t => t.id);

  // 3. Знайдемо всі картки для цих нарядів
  const { data: cards, error: cErr } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, quantity, operation, status')
    .in('task_id', taskIds);

  if (cErr) {
    console.error('Помилка пошуку карток:', cErr);
    return;
  }

  console.log(`Всього карток знайдено: ${cards.length}`);

  const cardIds = cards.map(c => c.id);
  if (cardIds.length === 0) {
    console.log('Немає карток для аналізу.');
    return;
  }

  // 4. Знайдемо історію цих карток
  const { data: history, error: hErr } = await supabase
    .from('work_card_history')
    .select('id, card_id, stage_name, scrap_qty, operator_name, completed_at, nomenclature_id')
    .in('card_id', cardIds);

  if (hErr) {
    console.error('Помилка пошуку історії:', hErr);
    return;
  }

  console.log(`Записів історії знайдено: ${history.length}`);

  // Отримаємо всі номенклатури
  const { data: noms, error: nErr } = await supabase
    .from('nomenclatures')
    .select('id, name, nomenclature_code');

  if (nErr) {
    console.error('Помилка завантаження номенклатур:', nErr);
    return;
  }

  const nomMap = {};
  noms.forEach(n => {
    nomMap[n.id] = n;
  });

  // 5. Проаналізуємо брак
  const scrapByNomenclature = {};

  history.forEach(h => {
    const scrapQty = Number(h.scrap_qty) || 0;
    if (scrapQty > 0) {
      // Визначимо номенклатуру деталі. Спробуємо взяти з картки, якщо немає в історії
      let nomId = h.nomenclature_id;
      if (!nomId) {
        const card = cards.find(c => c.id === h.card_id);
        if (card) {
          nomId = card.nomenclature_id;
        }
      }

      if (nomId) {
        if (!scrapByNomenclature[nomId]) {
          scrapByNomenclature[nomId] = {
            totalScrap: 0,
            stages: {},
            operators: {}
          };
        }
        scrapByNomenclature[nomId].totalScrap += scrapQty;
        
        // По етапах
        const stage = h.stage_name || 'Не вказано';
        scrapByNomenclature[nomId].stages[stage] = (scrapByNomenclature[nomId].stages[stage] || 0) + scrapQty;

        // По операторах
        const op = h.operator_name || 'Не вказано';
        scrapByNomenclature[nomId].operators[op] = (scrapByNomenclature[nomId].operators[op] || 0) + scrapQty;
      }
    }
  });

  console.log('\n===== АНАЛІЗ БРАКУ ПО НАРАДУ 22062026-03 =====');
  const entries = Object.entries(scrapByNomenclature);
  if (entries.length === 0) {
    console.log('Брак за даним нарядом відсутній!');
    return;
  }

  entries.forEach(([nomId, stats]) => {
    const nom = nomMap[nomId] || { name: 'Невідома деталь', nomenclature_code: '—' };
    console.log(`\nДеталь: ${nom.name}`);
    console.log(`Код: ${nom.nomenclature_code}`);
    console.log(`Загальна кількість браку: ${stats.totalScrap} шт.`);
    console.log('Брак за етапами:');
    Object.entries(stats.stages).forEach(([stage, qty]) => {
      console.log(`  - ${stage}: ${qty} шт.`);
    });
    console.log('Брак за операторами:');
    Object.entries(stats.operators).forEach(([op, qty]) => {
      console.log(`  - ${op}: ${qty} шт.`);
    });
  });
}

run();
