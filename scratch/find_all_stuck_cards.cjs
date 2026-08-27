const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function fetchCardsRange(from, to) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Range': `${from}-${to}`
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

function deleteCard(id) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${id}`;
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
  console.log('=== FETCHING ALL WORK CARDS VIA PAGINATION ===');
  let allCards = [];
  for (let from = 0; from < 20000; from += 1000) {
    const chunk = await fetchCardsRange(from, from + 999);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allCards.push(...chunk);
    if (chunk.length < 1000) break;
  }

  console.log('Total work_cards in DB:', allCards.length);

  const screenshotCodes = [
    'c7907648', '73bfb17a', '0e44771c', '8c318007', '1f2d9d62', '4374696b', '620972af', 'ae4fa179'
  ];

  const targetNomIds = new Set([
    '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', // В-3-30
    '50947afc-4e40-4165-a682-780275d5feda', // Н-3-14
    '343417a7-4a5c-4e31-8f44-18abb41defec', // Х-3-39
    'bb61a273-8824-42ca-a0b4-7c5ec331390c'  // П-7-46
  ]);

  const activeOrderIds = new Set([
    '50a32d8b-27ca-4037-956c-9bafc8e83e4a', // 260827-1
    '6580533f-333b-453c-9f80-b8e8a088da7a', // 260826-1
    'f5b030ed-ef8a-4608-bdbc-a634145b1ee7', // 260825-1
    '69ea8006-58c6-416a-a1c9-6cd4cb65f49c', // 260825-2
    '9a290bc6-2ddb-441c-b442-6a0848737ee9'  // 260820-3
  ]);

  const stuckCards = allCards.filter(c => {
    const cId = String(c.id || '').toLowerCase();
    const matchesCode = screenshotCodes.some(code => cId.startsWith(code) || cId.includes(code));
    const isTargetNom = targetNomIds.has(c.nomenclature_id);
    const isOrphanOrder = c.order_id && !activeOrderIds.has(c.order_id);
    const isNonCompleted = c.status !== 'completed';

    return matchesCode || (isTargetNom && isOrphanOrder && isNonCompleted) || (isTargetNom && isNonCompleted);
  });

  console.log(`\nFound ${stuckCards.length} stuck cards for F10 frame parts / machines:`);
  stuckCards.forEach(c => {
    console.log(`   ID: ${c.id} | NomID: ${c.nomenclature_id} | Status: ${c.status} | Machine: ${c.machine} | Operator: ${c.operator_name} | Qty: ${c.quantity} | OrderId: ${c.order_id}`);
  });

  let deletedCount = 0;
  for (const card of stuckCards) {
    const status = await deleteCard(card.id);
    if (status === 200 || status === 204) deletedCount++;
  }

  console.log(`\nSuccessfully deleted ${deletedCount} stuck work cards from Supabase.`);
}

run();
