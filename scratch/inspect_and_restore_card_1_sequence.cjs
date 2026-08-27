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

function insertCard(cardData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(cardData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
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
  console.log('=== RESTORING MISSING 1/N CARDS AND ALIGNING SEQUENCES 1..N ===');
  const cards = await getTable('work_cards');
  const tasks = await getTable('tasks');

  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';
  const mainTask = tasks.find(t => t.order_id === orderId && t.step === 'Розкрій');
  const taskId = mainTask?.id || 'a86551cb-2ebd-4e96-a967-8bf72a29aa1b';

  const orderCards = cards.filter(c => c.order_id === orderId);

  const targets = [
    {
      nomId: '343417a7-4a5c-4e31-8f44-18abb41defec', // Х-3-39
      name: 'Х-3-39',
      total: 12,
      machine: 'CNC 1200x800 - 4 листи (Малий)',
      unitQty: 156
    },
    {
      nomId: '50947afc-4e40-4165-a682-780275d5feda', // Н-3-14
      name: 'Н-3-14',
      total: 46,
      machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)',
      unitQty: 56
    },
    {
      nomId: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', // В-3-30
      name: 'В-3-30',
      total: 25,
      machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)',
      unitQty: 120
    }
  ];

  for (const t of targets) {
    const nomCards = orderCards.filter(c => c.nomenclature_id === t.nomId);
    console.log(`\nChecking ${t.name}: found ${nomCards.length} cards (expected ${t.total})`);

    // Check existing sequence numbers
    const existingSeqs = new Set();
    nomCards.forEach(c => {
      const match = String(c.card_info || '').match(/^(\d+)\//);
      if (match) existingSeqs.add(parseInt(match[1]));
    });

    console.log(`${t.name} existing sequence numbers:`, Array.from(existingSeqs).sort((a, b) => a - b));

    // If 1 is missing, add card 1/N
    if (!existingSeqs.has(1)) {
      console.log(`Card 1/${t.total} is missing for ${t.name}! Creating card 1/${t.total}...`);
      const createdDate = '2026-08-26T17:20:00.000Z';
      await insertCard({
        task_id: taskId,
        order_id: orderId,
        nomenclature_id: t.nomId,
        operation: 'Розкрій',
        machine: t.machine,
        quantity: t.unitQty,
        estimated_time: 180,
        status: 'in-progress',
        created_at: createdDate,
        started_at: createdDate,
        card_info: `1/${t.total}`
      });
    }
  }

  // Refetch, sort, and update card_info to strictly be 1/N, 2/N, ..., N/N
  console.log('\n=== RE-ALIGNING ALL CARD SEQUENCES STRICTLY FROM 1 TO N ===');
  const freshCards = await getTable('work_cards');
  const freshOrderCards = freshCards.filter(c => c.order_id === orderId);

  for (const t of targets) {
    const nomCards = freshOrderCards.filter(c => c.nomenclature_id === t.nomId);
    
    // Sort cards by existing seq or id so card 1 comes first
    nomCards.sort((a, b) => {
      const matchA = String(a.card_info || '').match(/^(\d+)\//);
      const matchB = String(b.card_info || '').match(/^(\d+)\//);
      const seqA = matchA ? parseInt(matchA[1]) : 9999;
      const seqB = matchB ? parseInt(matchB[1]) : 9999;
      if (seqA !== seqB) return seqA - seqB;
      return String(a.id).localeCompare(String(b.id));
    });

    console.log(`Re-aligning ${nomCards.length} cards for ${t.name}:`);

    for (let idx = 0; idx < nomCards.length; idx++) {
      const card = nomCards[idx];
      const seqStr = `${idx + 1}/${nomCards.length}`;
      let cleanInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '').trim();
      const finalInfo = `${seqStr} ${cleanInfo}`.trim();

      await updateCard(card.id, { card_info: finalInfo });
    }
  }

  console.log('Successfully restored missing 1/N cards and aligned sequence numbers 1..N!');
}

run();
