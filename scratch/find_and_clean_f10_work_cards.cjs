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

function deleteWorkCard(cardId) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${cardId}`;
    const req = https.request(url, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const cards = await getTable('work_cards');
  console.log('Total work cards in DB:', cards.length);

  const targetNames = [
    'Київ К-ІП9-10-П-7-46',
    'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30',
    'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14',
    'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39'
  ];

  const matchingCards = cards.filter(c => {
    const detailName = c.detail_name || c.nomenclature_name || c.name || '';
    return targetNames.some(tn => detailName.includes(tn));
  });

  console.log(`\nFound ${matchingCards.length} work cards for F10 frame parts:`);
  matchingCards.forEach(c => {
    console.log(`   Card ID: ${c.id} | Machine: ${c.machine_name || c.machine_id} | Detail: ${c.detail_name} | Qty: ${c.planned_qty || c.quantity} | Status: ${c.status} | Operator: ${c.operator_name}`);
  });

  let deletedCount = 0;
  for (const card of matchingCards) {
    const status = await deleteWorkCard(card.id);
    if (status === 200 || status === 204) deletedCount++;
  }

  console.log(`\nSuccessfully deleted ${deletedCount} stuck work cards from machines.`);
}

run();
