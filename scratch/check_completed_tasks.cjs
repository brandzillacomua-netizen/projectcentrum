const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function querySql(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/rpc/pg_proc`;
    // Let's call /rest/v1/rpc/ or query definition
    const req = https.get(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?select=id,order_id,step,status,completed_at,plan_snapshot&status=eq.completed`, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  const completedTasks = await querySql();
  console.log('Total completed tasks in tasks table:', completedTasks.length);
  const byOrder = {};
  completedTasks.forEach(t => {
    if (!t.order_id) return;
    if (!byOrder[t.order_id]) byOrder[t.order_id] = [];
    byOrder[t.order_id].push(t);
  });

  console.log('Distinct orders with completed tasks:', Object.keys(byOrder).length);
  Object.entries(byOrder).forEach(([orderId, tList]) => {
    const isPackaged = tList.every(t => t.plan_snapshot?._metadata?.is_packaged === true);
    console.log(`Order ${orderId}: ${tList.length} completed tasks | is_packaged: ${isPackaged}`);
  });
}

run();
