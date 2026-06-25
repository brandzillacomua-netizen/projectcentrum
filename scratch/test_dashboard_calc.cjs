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
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*');
  const { data: bomItems } = await supabase.from('bom_items').select('*');
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: workCards } = await supabase.from('work_cards').select('*');
  const { data: inventory } = await supabase.from('inventory').select('*');

  const selectedTaskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e'; // Cutting task

  const task = tasks.find(t => t.id === selectedTaskId);
  console.log('Selected Task:', task.id, 'Order ID:', task.order_id);

  // taskParentMap
  const taskParentMap = {};
  tasks.forEach(t => {
    const order = orders.find(o => String(o.id) === String(t.order_id));
    if (order) {
       let parentId = order.nomenclature_id;
       if (!parentId && order.order_items && order.order_items.length > 0) {
         parentId = order.order_items[0].nomenclature_id;
       }
       if (parentId) {
         taskParentMap[t.id] = String(parentId);
       }
    }
  });

  // filteredWorkCards (using new logic)
  const selectedTaskObj = tasks.find(t => t.id === selectedTaskId);
  const orderId = selectedTaskObj.order_id;
  const orderTaskIds = tasks.filter(t => t.order_id === orderId).map(t => t.id);
  const filteredWorkCards = workCards.filter(c => orderTaskIds.includes(c.task_id));
  console.log(`\nFiltered Work Cards (order tasks): ${filteredWorkCards.length}`);

  const parentId = '26a77a50-d932-4a02-a65d-b4cd608ec6ac'; // Рама F10
  const childBoms = bomItems.filter(b => String(b.parent_id) === String(parentId));

  console.log(`\nChild parts calculations for parent: ${parentId}`);
  childBoms.forEach(b => {
    const nom = nomenclatures.find(n => String(n.id) === String(b.child_id));
    if (!nom || nom.type !== 'part') return;

    const isOther = false;
    const qtyPerProduct = Number(b.quantity_per_parent) || 1;

    const getQty = (operation, statuses) => {
       return (filteredWorkCards || []).filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false;
          if (!isOther && c.task_id && taskParentMap[c.task_id]) {
             if (taskParentMap[c.task_id] !== String(parentId)) return false;
          }
          const matchOp = Array.isArray(operation) ? operation.includes(c.operation) : c.operation === operation;
          const matchStat = Array.isArray(statuses) ? statuses.includes(c.status) : c.status === statuses;
          return matchOp && matchStat;
       }).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    };

    const getQtySort = () => {
       return (filteredWorkCards || []).filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false;
          if (!isOther && c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== String(parentId)) return false;
          return c.status === 'at-shop2-buffer';
       }).reduce((sum, c) => sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0);
    };

    const qCutWait = getQty(['Розкрій'], 'new');
    const qCut = getQty(['Розкрій'], 'in-progress');
    const qCutBuf = getQty(['Розкрій'], 'at-buffer');
    const qGalt = getQty('Галтовка', 'in-progress');
    const qGaltBuf = getQty('Галтовка', 'at-buffer');
    const qPriyCards = getQty('Прийомка', ['new', 'in-progress', 'at-buffer']);
    const qSortAct = getQty('Сортування', ['in-progress', 'at-buffer']);
    const qSortCards = getQtySort();
    const qMalWait = getQty(['Фарбування', 'Малярка'], 'new');
    const qMal = getQty(['Фарбування', 'Малярка'], 'in-progress');
    const qMalBuf = getQty(['Фарбування', 'Малярка'], 'at-buffer');
    const qPres = getQty('Пресування', ['new', 'in-progress']);
    const qPresBuf = getQty('Пресування', 'at-buffer');
    const qDoop = getQty('Доопрацювання', ['new', 'in-progress']);
    const qDoopBuf = getQty('Доопрацювання', 'at-buffer');

    const qSgp = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP')).reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0);
    const qBz = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && i.type === 'bz').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0);

    const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qSgp + qBz;

    console.log(`- ${nom.name}:`);
    console.log(`  qCutWait=${qCutWait}, qCut=${qCut}, qCutBuf=${qCutBuf}, qGalt=${qGalt}, qGaltBuf=${qGaltBuf}`);
    console.log(`  qPriyCards=${qPriyCards}, qSortAct=${qSortAct}, qSortCards=${qSortCards}`);
    console.log(`  qMalWait=${qMalWait}, qMal=${qMal}, qMalBuf=${qMalBuf}`);
    console.log(`  qPres=${qPres}, qPresBuf=${qPresBuf}, qDoop=${qDoop}, qDoopBuf=${qDoopBuf}`);
    console.log(`  qSgp=${qSgp}, qBz=${qBz}`);
    console.log(`  SUM=${sum}`);
  });
}

run();
