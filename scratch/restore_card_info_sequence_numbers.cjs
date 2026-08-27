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
  console.log('=== RESTORING SEQUENCE NUMBER BADGES (1/N, 2/N) FOR WORK CARDS ===');
  const cards = await getTable('work_cards');

  const activeOrderIds = new Set([
    '6580533f-333b-453c-9f80-b8e8a088da7a', // 260826-1
    '50a32d8b-27ca-4037-956c-9bafc8e83e4a'  // 260827-1
  ]);

  const targetCards = cards.filter(c => activeOrderIds.has(c.order_id));
  console.log(`Found ${targetCards.length} work cards to update.`);

  // Group by (task_id + nomenclature_id)
  const groups = {};
  targetCards.forEach(c => {
    const groupKey = `${c.task_id}_${c.nomenclature_id}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(c);
  });

  let updatedCount = 0;

  for (const [groupKey, groupCards] of Object.entries(groups)) {
    // Sort cards deterministically by created_at or id
    groupCards.sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const total = groupCards.length;
    for (let idx = 0; idx < total; idx++) {
      const card = groupCards[idx];
      const seqStr = `${idx + 1}/${total}`;

      let currentInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '');
      const newCardInfo = `${seqStr} ${currentInfo}`.trim();

      const status = await updateCard(card.id, { card_info: newCardInfo });
      if (status === 200 || status === 204) updatedCount++;
    }
  }

  console.log(`Successfully restored orange sequence badges (1/${groups}) for ${updatedCount} work cards!`);
}

run();
