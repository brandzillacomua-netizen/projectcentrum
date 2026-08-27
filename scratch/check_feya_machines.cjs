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
  console.log('=== CHECKING WORK CARDS FOR KE XIN / ФЕЯ MACHINES ===');
  let allCards = [];
  for (let from = 0; from < 20000; from += 1000) {
    const chunk = await fetchCardsRange(from, from + 999);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allCards.push(...chunk);
    if (chunk.length < 1000) break;
  }

  console.log('Total work_cards in DB:', allCards.length);

  const activeOrderIds = new Set([
    '50a32d8b-27ca-4037-956c-9bafc8e83e4a', // 260827-1
    '6580533f-333b-453c-9f80-b8e8a088da7a', // 260826-1
    'f5b030ed-ef8a-4608-bdbc-a634145b1ee7', // 260825-1
    '69ea8006-58c6-416a-a1c9-6cd4cb65f49c', // 260825-2
    '9a290bc6-2ddb-441c-b442-6a0848737ee9'  // 260820-3
  ]);

  const feyaCards = allCards.filter(c => {
    const mName = (c.machine || c.machine_id || '').toLowerCase();
    const isFeyaMachine = mName.includes('фея') || mName.includes('ke xin') || mName.includes('kexin');
    return isFeyaMachine && c.status !== 'completed';
  });

  console.log(`\nActive/Stuck cards on ФЕЯ machines: ${feyaCards.length}`);
  feyaCards.forEach(c => {
    const isOrphan = c.order_id && !activeOrderIds.has(c.order_id);
    console.log(`   Card ID: ${c.id} | Machine: ${c.machine} | Status: ${c.status} | Qty: ${c.quantity} | OrderId: ${c.order_id} | Orphan: ${isOrphan}`);
  });

  // Also check ALL non-completed cards for orphan orders across all machines
  const orphanCards = allCards.filter(c => c.status !== 'completed' && c.order_id && !activeOrderIds.has(c.order_id));
  console.log(`\nTotal remaining active/stuck cards for old/deleted orders across ALL machines: ${orphanCards.length}`);
  orphanCards.forEach(c => {
    console.log(`   Card ID: ${c.id} | Machine: ${c.machine} | Status: ${c.status} | Qty: ${c.quantity} | OrderId: ${c.order_id}`);
  });

  let deletedCount = 0;
  for (const card of orphanCards) {
    const status = await deleteCard(card.id);
    if (status === 200 || status === 204) deletedCount++;
  }

  console.log(`\nSuccessfully deleted ${deletedCount} remaining orphan work cards across all machines.`);
}

run();
