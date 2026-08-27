const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function getTable(table) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${table}?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  const orders = await getTable('orders');
  const tasks = await getTable('tasks');

  console.log('--- TOTAL ORDERS:', orders.length);
  console.log('--- TOTAL TASKS:', tasks.length);

  const relevantTasks = tasks.filter(t => t.status === 'completed' || t.plan_snapshot?._metadata?.is_packaged === true);
  console.log('--- RELEVANT TASKS (completed or is_packaged):', relevantTasks.length);

  const batchGroups = {};
  relevantTasks.forEach(task => {
    const order = orders.find(o => o.id === task.order_id);
    if (!order) return;
    if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return;
    const bIdx = task.batch_index || '';
    const key = bIdx ? `${task.order_id}_${bIdx}` : `${task.order_id}_whole`;
    if (!batchGroups[key]) {
      batchGroups[key] = {
        key,
        orderId: task.order_id,
        orderNum: order.order_num,
        orderStatus: order.status,
        customer: order.customer,
        batchIndex: bIdx,
        isPackaged: task.plan_snapshot?._metadata?.is_packaged === true,
        tasks: []
      };
    }
    batchGroups[key].tasks.push(task);
  });

  console.log('=== BATCH GROUPS GENERATED:', Object.keys(batchGroups).length);
  Object.values(batchGroups).forEach(bg => {
    console.log(`Key: ${bg.key} | Order: ${bg.orderNum} (${bg.orderStatus}) | Packaged: ${bg.isPackaged} | Tasks count: ${bg.tasks.length}`);
    bg.tasks.forEach(t => console.log(`   Task ${t.id} | Step: ${t.step} | Status: ${t.status} | Packaged: ${t.plan_snapshot?._metadata?.is_packaged}`));
  });
}

run();
