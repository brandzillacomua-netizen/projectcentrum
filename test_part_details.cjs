const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  // Get nomenclatures, bomItems, tasks, cards
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*');
  const { data: bomItems } = await supabase.from('bom_items').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: allTasksCards } = await supabase.from('work_cards').select('*');

  // Let's find the task with order 22062026-03
  const task = tasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => k.includes('-')) && t.naryad_num === '22062026-03');
  // Wait, let's find by order_id or order_num
  const { data: orders } = await supabase.from('orders').select('*').eq('order_num', '22062026-03');
  const order = orders[0];
  const cuttingTask = tasks.find(t => t.order_id === order.id && t.step === 'Розкрій');

  console.log('Selected task:', cuttingTask.id, cuttingTask.step);

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const snapshot = cuttingTask.plan_snapshot || {};
  
  // Get all task IDs for the same order
  const orderTasks = tasks.filter(t => t.order_id === cuttingTask.order_id);
  const orderTaskIds = orderTasks.map(t => t.id);
  const allTaskCards = allTasksCards.filter(c => c.task_id && orderTaskIds.includes(c.task_id));

  Object.keys(snapshot).filter(k => uuidRegex.test(k)).forEach(nomIdStr => {
    const snap = snapshot[nomIdStr];
    const nom = nomenclatures.find(n => String(n.id) === nomIdStr);
    const nomCards = allTaskCards.filter(c => String(c.nomenclature_id) === nomIdStr);

    const getQFromCards = (ops, statuses) => {
      const opArr = Array.isArray(ops) ? ops : [ops];
      const stArr = Array.isArray(statuses) ? statuses : [statuses];
      return nomCards.filter(c => opArr.includes(c.operation) && stArr.includes(c.status))
        .reduce((s, c) => s + (Number(c.quantity) || 0), 0);
    };

    const qSort = nomCards.filter(c => c.status === 'at-shop2-buffer')
      .reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0);

    const groupProduced = nomCards.filter(c => {
      const op = (c.operation || '').toLowerCase();
      const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o));
      return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer');
    }).reduce((s, c) => s + (Number(c.quantity) || 0), 0);

    const totalShop2Qty = nomCards.filter(c => {
      const op = (c.operation || '').toLowerCase();
      return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o));
    }).reduce((s, c) => s + (Number(c.quantity) || 0), 0);

    const initialStock = Number(snap.stock) || 0;
    const qBz = Math.max(0, groupProduced - qSort - totalShop2Qty);

    const completedShop2Qty = nomCards.filter(c => {
      const op = (c.operation || '').toLowerCase();
      const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o));
      return isShop2 && c.status === 'completed';
    }).reduce((s, c) => s + (Number(c.quantity) || 0), 0);

    const qSgp = completedShop2Qty + initialStock;

    console.log(`\nPart: ${nom.name}`);
    console.log(`  initialStock (snap.stock): ${initialStock}`);
    console.log(`  completedShop2Qty        : ${completedShop2Qty}`);
    console.log(`  groupProduced            : ${groupProduced}`);
    console.log(`  qSort                    : ${qSort}`);
    console.log(`  totalShop2Qty            : ${totalShop2Qty}`);
    console.log(`  CALCULATED qSgp          : ${qSgp}`);
    console.log(`  CALCULATED qBz           : ${qBz}`);
  });
}

run();
