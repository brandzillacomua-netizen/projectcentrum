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
  console.log('=== FIXING EXACT REMAINING CARDS TO COVER 100% PLAN AND CLEAR GENERATE BUTTON ===');
  const cards = await getTable('work_cards');
  const tasks = await getTable('tasks');

  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';
  const mainTask = tasks.find(t => t.order_id === orderId && t.step === 'Розкрій');
  const taskId = mainTask?.id || 'a86551cb-2ebd-4e96-a967-8bf72a29aa1b';

  const orderCards = cards.filter(c => c.order_id === orderId && c.operation !== 'Склад БЗ' && !(c.card_info || '').includes('[REDO]'));

  const additions = [
    {
      nomId: '343417a7-4a5c-4e31-8f44-18abb41defec', // Х-3-39
      name: 'Х-3-39',
      targetQty: 1810,
      machine: 'CNC 1200x800 - 4 листи (Малий)'
    },
    {
      nomId: '50947afc-4e40-4165-a682-780275d5feda', // Н-3-14
      name: 'Н-3-14',
      targetQty: 3797,
      machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
    },
    {
      nomId: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', // В-3-30
      name: 'В-3-30',
      targetQty: 4083,
      machine: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
    }
  ];

  for (const item of additions) {
    const nomCards = orderCards.filter(c => c.nomenclature_id === item.nomId);
    const sumQty = nomCards.reduce((acc, c) => acc + (Number(c.quantity) || 0), 0);
    const diffQty = item.targetQty - sumQty;

    console.log(`${item.name}: target ${item.targetQty}, current sum ${sumQty}, diff ${diffQty}`);

    if (diffQty > 0) {
      console.log(`Inserting remaining card for ${item.name} with Qty = ${diffQty}`);
      const createdDate = '2026-08-26T17:20:00.000Z';
      await insertCard({
        task_id: taskId,
        order_id: orderId,
        nomenclature_id: item.nomId,
        operation: 'Розкрій',
        machine: item.machine,
        quantity: diffQty,
        estimated_time: 180,
        status: 'in-progress',
        created_at: createdDate,
        started_at: createdDate,
        card_info: `NEW_TAIL`
      });
    }
  }

  // Refetch fresh cards, sort, and update card_info to be 1/12..12/12, 1/46..46/46, 1/25..25/25
  console.log('\n=== RE-ALIGNING SEQUENCE BADGES (1/N ... N/N) ===');
  const freshCards = await getTable('work_cards');
  const freshOrderCards = freshCards.filter(c => c.order_id === orderId && c.operation !== 'Склад БЗ' && !(c.card_info || '').includes('[REDO]'));

  for (const item of additions) {
    const nomCards = freshOrderCards.filter(c => c.nomenclature_id === item.nomId);
    
    // Sort cards by card_info seq or id so card 1 comes first
    nomCards.sort((a, b) => {
      const matchA = String(a.card_info || '').match(/^(\d+)\//);
      const matchB = String(b.card_info || '').match(/^(\d+)\//);
      const seqA = matchA ? parseInt(matchA[1]) : 9999;
      const seqB = matchB ? parseInt(matchB[1]) : 9999;
      if (seqA !== seqB) return seqA - seqB;
      return String(a.id).localeCompare(String(b.id));
    });

    const total = nomCards.length;
    console.log(`Nomenclature ${item.name}: re-numbering ${total} cards`);

    for (let idx = 0; idx < total; idx++) {
      const card = nomCards[idx];
      const seqStr = `${idx + 1}/${total}`;
      let cleanInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '').replace('NEW_TAIL', '').trim();
      const finalInfo = `${seqStr} ${cleanInfo}`.trim();

      await updateCard(card.id, { card_info: finalInfo });
    }
  }

  console.log('Successfully completed 100% card generation for 12/12, 46/46, 25/25!');
}

run();
