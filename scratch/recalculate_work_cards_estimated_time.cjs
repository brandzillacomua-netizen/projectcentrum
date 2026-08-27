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

function updateCard(id, patchData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(patchData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${id}`;
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
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== RECALCULATING ESTIMATED TIMES FOR WORK CARDS ===');
  const cards = await getTable('work_cards');
  const nomenclatures = await getTable('nomenclatures');
  const tasks = await getTable('tasks');

  const activeOrderIds = new Set([
    '6580533f-333b-453c-9f80-b8e8a088da7a', // 260826-1
    '50a32d8b-27ca-4037-956c-9bafc8e83e4a'  // 260827-1
  ]);

  const targetCards = cards.filter(c => activeOrderIds.has(c.order_id));
  console.log(`Found ${targetCards.length} work cards for active orders #260826-1 and #260827-1.`);

  let updatedCount = 0;

  for (const card of targetCards) {
    const nom = nomenclatures.find(n => n.id === card.nomenclature_id);
    const task = tasks.find(t => t.id === card.task_id);

    let estimatedTime = 0;

    if (nom && Number(nom.time_per_unit) > 0) {
      estimatedTime = Math.round(Number(nom.time_per_unit) * Number(card.quantity) * 60);
    } else if (task && Number(task.estimated_time) > 0) {
      // Proportional split from task total estimated time
      const taskCards = targetCards.filter(c => c.task_id === task.id);
      const totalQty = taskCards.reduce((acc, c) => acc + Number(c.quantity), 0);
      if (totalQty > 0) {
        estimatedTime = Math.round((Number(task.estimated_time) * Number(card.quantity)) / totalQty);
      }
    }

    if (estimatedTime === 0) {
      // Fallback default: ~1.5 min per sheet/unit or standard 120-180 sec per card
      estimatedTime = Math.max(60, Number(card.quantity) * 2);
    }

    const status = await updateCard(card.id, { estimated_time: estimatedTime });
    if (status === 200 || status === 204) updatedCount++;
  }

  console.log(`Successfully updated estimated_time for ${updatedCount} work cards!`);
}

run();
