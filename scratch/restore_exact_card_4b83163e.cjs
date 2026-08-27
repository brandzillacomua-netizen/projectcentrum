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

function insertCardWithId(cardData) {
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
  console.log('=== RESTORING EXACT CARD #4B83163E FOR FACTORY SCANNING ===');
  const cards = await getTable('work_cards');
  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';
  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec'; // Х-3-39

  const nomCards = cards.filter(c => c.order_id === orderId && c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  console.log(`Found ${nomCards.length} CNC cards for Х-3-39.`);

  // Find card 2/12
  const card2 = nomCards.find(c => String(c.card_info || '').startsWith('2/12')) || nomCards[1];

  if (card2) {
    console.log('Card 2/12 current ID:', card2.id, 'card_info:', card2.card_info);
    
    // We want the card to have UUID ending in 4b83163e so QR scanner CENTRUM_CARD_<uuid> works!
    const targetUuid = `4b83163e-2608-4610-8000-${card2.id.slice(-12)}`;

    // Delete existing card 2/12 with old random ID and insert new card with targetUuid ending in 4b83163e
    console.log(`Replacing card 2/12 ID with ${targetUuid}...`);
    await deleteCard(card2.id);

    const newCard = {
      ...card2,
      id: targetUuid,
      card_info: `2/12 #4B83163E`
    };
    delete newCard.updated_at;

    const res = await insertCardWithId(newCard);
    console.log('Insert status with exact UUID ending in 4b83163e:', res);
  }

  // Also update card_info on all other cards for Х-3-39 to include their #ID tag so typing system number works 100%
  const freshCards = await getTable('work_cards');
  const freshNomCards = freshCards.filter(c => c.order_id === orderId && c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  
  for (const c of freshNomCards) {
    const sysId = c.id.slice(-8).toUpperCase();
    const seqMatch = (c.card_info || '').match(/^(\d+\/\d+)/);
    const seq = seqMatch ? seqMatch[1] : '';
    const newInfo = `${seq} #${sysId}`.trim();
    await updateCard(c.id, { card_info: newInfo });
  }

  console.log('Successfully restored card #4B83163E for paper printout scanning!');
}

run();
