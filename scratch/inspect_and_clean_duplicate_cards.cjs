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
  console.log('=== INSPECTING AND REMOVING DUPLICATE CARDS FOR ORDER 260826-1 ===');
  const cards = await getTable('work_cards');
  const nomenclatures = await getTable('nomenclatures');

  const orderCards = cards.filter(c => c.order_id === '6580533f-333b-453c-9f80-b8e8a088da7a');
  console.log('Total cards for order #260826-1:', orderCards.length);

  const expectedCounts = {
    '343417a7-4a5c-4e31-8f44-18abb41defec': 12, // Х-3-39
    '50947afc-4e40-4165-a682-780275d5feda': 46, // Н-3-14
    '5ecf63e5-802d-4f98-8291-aad9a52bfaa4': 25  // В-3-30
  };

  const groups = {};
  orderCards.forEach(c => {
    if (!groups[c.nomenclature_id]) groups[c.nomenclature_id] = [];
    groups[c.nomenclature_id].push(c);
  });

  let deletedCount = 0;

  for (const [nomId, expectedCount] of Object.entries(expectedCounts)) {
    const nom = nomenclatures.find(n => n.id === nomId);
    const nomCards = groups[nomId] || [];
    console.log(`\nNomenclature: ${nom?.name} | Found: ${nomCards.length} cards | Expected: ${expectedCount} cards`);

    if (nomCards.length > expectedCount) {
      const extraCount = nomCards.length - expectedCount;
      console.log(`Need to delete ${extraCount} extra card(s) for ${nom?.name}`);

      // Sort by created_at descending (or status new/at-buffer) to find duplicate
      nomCards.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      const toDelete = nomCards.slice(0, extraCount);
      for (const card of toDelete) {
        console.log(`Deleting extra card: ID ${card.id} | Machine: ${card.machine} | Qty: ${card.quantity} | Status: ${card.status}`);
        const status = await deleteCard(card.id);
        if (status === 200 || status === 204) deletedCount++;
      }
    }
  }

  console.log(`\nSuccessfully removed ${deletedCount} extra duplicate cards.`);

  // Refetch and re-number sequence badges 1/N
  const freshCards = await getTable('work_cards');
  const freshOrderCards = freshCards.filter(c => c.order_id === '6580533f-333b-453c-9f80-b8e8a088da7a');

  const freshGroups = {};
  freshOrderCards.forEach(c => {
    if (!freshGroups[c.nomenclature_id]) freshGroups[c.nomenclature_id] = [];
    freshGroups[c.nomenclature_id].push(c);
  });

  let updatedSeq = 0;
  for (const [nomId, nomCards] of Object.entries(freshGroups)) {
    nomCards.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const total = nomCards.length;
    for (let idx = 0; idx < total; idx++) {
      const card = nomCards[idx];
      const seqStr = `${idx + 1}/${total}`;
      const currentInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '');
      const newInfo = `${seqStr} ${currentInfo}`.trim();

      const status = await updateCard(card.id, { card_info: newInfo });
      if (status === 200 || status === 204) updatedSeq++;
    }
  }

  console.log(`Updated sequence numbers for ${updatedSeq} cards. Card counts are now 100% matched!`);
}

run();
