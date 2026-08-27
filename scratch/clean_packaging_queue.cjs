const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function patchTask(taskId, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${taskId}`;
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
      }
    }, res => { resolve(res.statusCode); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function patchOrder(orderId, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/orders?id=eq.${orderId}`;
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
      }
    }, res => { resolve(res.statusCode); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

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

  // Active orders in shop 1 and shop 2 that must remain:
  const activeOrderNums = new Set(['260827-1', '260826-1', '260825-1', '260825-2', '260820-3']);

  console.log('=== CLEANING PACKAGING QUEUE ===');
  let tasksUpdated = 0;
  let ordersUpdated = 0;

  for (const order of orders) {
    if (!activeOrderNums.has(order.order_num)) {
      // Mark old order as shipped if completed
      if (order.status === 'completed') {
        await patchOrder(order.id, { status: 'shipped' });
        ordersUpdated++;
      }

      // Mark tasks for old orders as packaged
      const oTasks = tasks.filter(t => t.order_id === order.id);
      for (const t of oTasks) {
        if (!t.plan_snapshot?._metadata?.is_packaged) {
          const newSnapshot = {
            ...(t.plan_snapshot || {}),
            _metadata: {
              ...(t.plan_snapshot?._metadata || {}),
              is_packaged: true,
              packaged_at: t.completed_at || new Date().toISOString(),
              packaged_by: 'Система (Очищення)'
            }
          };
          await patchTask(t.id, { plan_snapshot: newSnapshot });
          tasksUpdated++;
        }
      }
    }
  }

  console.log(`Updated ${ordersUpdated} old orders to 'shipped' status.`);
  console.log(`Updated ${tasksUpdated} old tasks with is_packaged = true.`);
}

run();
