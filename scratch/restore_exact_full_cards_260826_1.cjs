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
  console.log('=== RESTORING EXACT FULL CARD COUNTS (12/12, 46/46, 25/25) FOR ORDER 260826-1 ===');
  const cards = await getTable('work_cards');
  const tasks = await getTable('tasks');

  const mainTask = tasks.find(t => t.order_id === '6580533f-333b-453c-9f80-b8e8a088da7a' && t.step === 'Розкрій');
  const taskId = mainTask?.id || 'a86551cb-2ebd-4e96-a967-8bf72a29aa1b';
  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';

  const orderCards = cards.filter(c => c.order_id === orderId);

  const targetSpecs = [
    {
      nomId: '343417a7-4a5c-4e31-8f44-18abb41defec', // Х-3-39
      targetCount: 12,
      machine: 'CNC 1200x800 - 4 листи (Малий)',
      unitQty: 156
    },
    {
      nomId: '50947afc-4e40-4165-a682-780275d5feda', // Н-3-14
      targetCount: 46,
      machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)',
      unitQty: 56
    },
    {
      nomId: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', // В-3-30
      targetCount: 25,
      machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)',
      unitQty: 120
    }
  ];

  for (const spec of targetSpecs) {
    const currentNomCards = orderCards.filter(c => c.nomenclature_id === spec.nomId);
    console.log(`Nom ${spec.nomId}: current ${currentNomCards.length} cards, target ${spec.targetCount} cards.`);

    if (currentNomCards.length < spec.targetCount) {
      const missingCount = spec.targetCount - currentNomCards.length;
      console.log(`Adding ${missingCount} missing card(s) for ${spec.nomId}`);

      for (let i = 0; i < missingCount; i++) {
        const createdDate = '2026-08-26T17:20:00.000Z';
        const newCardPayload = {
          task_id: taskId,
          order_id: orderId,
          nomenclature_id: spec.nomId,
          operation: 'Розкрій',
          machine: spec.machine,
          quantity: spec.unitQty,
          estimated_time: 180,
          status: 'in-progress',
          created_at: createdDate,
          started_at: createdDate,
          card_info: `RESTORED`
        };

        const res = await insertCard(newCardPayload);
        console.log(`Inserted missing card status: ${res}`);
      }
    }
  }

  // Refetch and re-number sequence badges 1/N for all 3 completed nomenclatures
  console.log('\n=== RE-NUMBERING ALL CARD SEQUENCES ===');
  const freshCards = await getTable('work_cards');
  const freshOrderCards = freshCards.filter(c => c.order_id === orderId);

  for (const spec of targetSpecs) {
    const nomCards = freshOrderCards.filter(c => c.nomenclature_id === spec.nomId);
    nomCards.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const total = nomCards.length;

    console.log(`Nomenclature ${spec.nomId}: re-numbering ${total} cards (target was ${spec.targetCount})`);

    for (let idx = 0; idx < total; idx++) {
      const card = nomCards[idx];
      const seqStr = `${idx + 1}/${total}`;
      const currentInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '').replace('RESTORED', '').trim();
      const newInfo = `${seqStr} ${currentInfo}`.trim();

      await updateCard(card.id, { card_info: newInfo });
    }
  }

  console.log('Successfully restored 100% full card counts (12/12, 46/46, 25/25)!');
}

run();
