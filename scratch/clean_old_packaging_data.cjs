const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function patchTaskSnapshot(taskId, snapshot) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ plan_snapshot: snapshot });
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${taskId}`;
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(payload);
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

  // Archive older completed tasks prior to 2026-08-20 by setting is_packaged = true
  const cutoffDate = new Date('2026-08-18T00:00:00Z');
  let archivedCount = 0;

  for (const task of tasks) {
    if (task.status === 'completed' && task.completed_at) {
      const compDate = new Date(task.completed_at);
      if (compDate < cutoffDate && !task.plan_snapshot?._metadata?.is_packaged) {
        const newSnapshot = {
          ...(task.plan_snapshot || {}),
          _metadata: {
            ...(task.plan_snapshot?._metadata || {}),
            is_packaged: true,
            packaged_at: task.completed_at,
            packaged_by: 'Система (Авто-архів)'
          }
        };
        const status = await patchTaskSnapshot(task.id, newSnapshot);
        if (status === 204 || status === 200) archivedCount++;
      }
    }
  }

  console.log(`Archived ${archivedCount} old completed tasks prior to Aug 18.`);
}

run();
