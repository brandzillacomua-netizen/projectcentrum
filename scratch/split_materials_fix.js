global.window = {
  myConfirmedWrites: new Set()
};

const run = async () => {
  const { supabase } = await import('../src/supabase.js');
  
  const taskId = 'e6cd98cd-3b18-4ed2-8d92-8ba02bd69e6a';
  const orderId = 'c34e7c85-17ee-42f7-86e4-7c370069d225';

  // 1. Delete all current requests for this task
  console.log('Deleting current material requests for task...');
  const { error: delErr } = await supabase
    .from('material_requests')
    .delete()
    .eq('task_id', taskId);
  
  if (delErr) {
    console.error('Delete error:', delErr);
    return;
  }

  // 2. Re-insert the original general requests (card_id = null)
  console.log('Inserting original general requests...');
  const originalRequests = [
    {
      order_id: orderId,
      task_id: taskId,
      nomenclature_id: '0ab28738-6385-471f-b5aa-7881dfa3cb1c', // Cutter 3
      inventory_id: 'c448f726-f57a-400a-b62a-1c3b10a154d1',
      quantity: 1173,
      status: 'issued',
      details: 'СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ): Фреза кукурудза 3х3,175х12х38 — 1173 шт.'
    },
    {
      order_id: orderId,
      task_id: taskId,
      nomenclature_id: 'c48e7cef-0500-48bb-87b9-232f63f54116', // Cutter 2
      inventory_id: '0f8982c4-7640-4d93-9681-1403a4527a4a',
      quantity: 1955,
      status: 'issued',
      details: 'СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ): Фреза кукурудза 2х3,175х10,5х38 — 1955 шт.'
    },
    {
      order_id: orderId,
      task_id: taskId,
      nomenclature_id: '9a048d33-d916-4b5c-8539-00006ab3e23d', // 7mm Sheet
      inventory_id: '16f862ce-f054-49f0-8385-84c598cf24c6',
      quantity: 391,
      status: 'issued',
      details: 'СКЛАД ОПЕРАТИВНИЙ: Лист Т300 (7мм) [Підготовлений] — 391 л. (Разом: 17176 шт | Для: Київ К-ІП10-11-П-7-44: 17176шт)'
    },
    {
      order_id: orderId,
      task_id: taskId,
      nomenclature_id: '5794bab6-1bca-4785-86f8-b525e2b0be76', // 3mm Sheet
      inventory_id: '24d03784-b80e-4850-a3a9-0ed80058d4c7',
      quantity: 392,
      status: 'issued',
      details: 'СКЛАД ОПЕРАТИВНИЙ: Лист Т300 (3мм) [Підготовлений] — 392 л. (Разом: 9000 шт | Для: Київ К-ІП9/10/31/36/37-9-10-11-В-3-30: 3000шт, Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14: 3000шт, Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39: 3000шт)'
    }
  ];

  const { data: insertedReqs, error: insErr } = await supabase
    .from('material_requests')
    .insert(originalRequests)
    .select();

  if (insErr) {
    console.error('Insert error:', insErr);
    return;
  }
  console.log('Inserted general requests:', insertedReqs.length);

  // 3. Now let's run the split logic for the 2 active new cards
  const { data: cards, error: cardsErr } = await supabase
    .from('work_cards')
    .select('*')
    .eq('task_id', taskId)
    .in('status', ['new', 'waiting-materials']);

  if (cardsErr) {
    console.error('Cards fetch error:', cardsErr);
    return;
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  const snapshot = task?.plan_snapshot || {};
  
  // Calculate total planned sheets for the whole task
  let totalTaskSheets = 0;
  Object.entries(snapshot).forEach(([key, val]) => {
    if (val && typeof val === 'object' && val.sheets) {
      totalTaskSheets += Number(val.sheets) || 0;
    }
  });
  if (totalTaskSheets <= 0) totalTaskSheets = 1;

  console.log('Total task sheets:', totalTaskSheets);

  // Helper to normalize string
  const normalize = (s) => (s || '').toLowerCase().trim().replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e').replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c').replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[уy]/g, 'y').replace(/[кk]/g, 'k').replace(/[мm]/g, 'm').replace(/[нn]/g, 'n').replace(/[вv]/g, 'v').replace(/[и]/g, 'y').replace(/[зz]/g, 'z').replace(/\s/g, '');

  for (const card of cards) {
    console.log(`\nSplitting for Card: ${card.card_info}, Nomenclature ID: ${card.nomenclature_id}`);
    
    // Fetch remaining general requests
    const { data: generalRequests } = await supabase
      .from('material_requests')
      .select('*')
      .eq('task_id', taskId)
      .is('card_id', null);
    
    if (!generalRequests || generalRequests.length === 0) {
      console.log('No general requests left to split.');
      continue;
    }

    const partSnapshot = snapshot[card.nomenclature_id] || {};
    const unitsPerSheet = Number(partSnapshot.units_per_sheet) || 1;
    const materialName = partSnapshot.material;

    console.log(`Part material name: ${materialName}, units per sheet: ${unitsPerSheet}`);

    const newRequests = [];
    const updates = [];
    const deletes = [];

    for (const req of generalRequests) {
      const normDetails = normalize(req.details || '');
      const normMat = materialName ? normalize(materialName) : '';

      let isSheetForThisCard = false;
      let isSheetForOtherParts = false;
      let isGeneralConsumable = false;

      if (normMat && normDetails.includes(normMat)) {
        isSheetForThisCard = true;
      } else if (normDetails.includes('лyct')) { // FIXED: 'лyct' matches 'Лист' after normalize()
        isSheetForOtherParts = true;
      } else {
        isGeneralConsumable = true;
      }

      if (isSheetForOtherParts) {
        continue; // Skip sheets for other parts
      }

      const cardSheets = Math.ceil((Number(card.quantity) || 0) / unitsPerSheet);
      let cardQty = 0;

      if (isSheetForThisCard) {
        cardQty = cardSheets;
      } else if (isGeneralConsumable) {
        let originalCutterQty = Number(req.quantity);
        const consumablesList = snapshot.consumables || [];
        const foundCons = consumablesList.find(c => {
          const nameLower = (c.name || '').toLowerCase();
          return normDetails.includes(normalize(nameLower));
        });
        if (foundCons) {
          originalCutterQty = Number(foundCons.total) || Number(req.quantity);
        }
        cardQty = Math.round(originalCutterQty * (cardSheets / totalTaskSheets));
      }

      if (cardQty > 0) {
        console.log(`- Request "${req.details.substring(0, 40)}..." -> Card Qty: ${cardQty}`);
        
        const cardLabel = (card.card_info || '').split(' ')[0] || '№1';
        const updatedDetails = req.details 
          ? req.details.replace('СКЛАД ОПЕРАТИВНИЙ:', `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}):`)
                       .replace('ВИТРАТНІ МАТЕРІАЛИ ДЛЯ', `ВИТРАТНІ МАТЕРІАЛИ (Картка ${cardLabel}) ДЛЯ`)
                       .replace('СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ):', `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ):`)
          : `Матеріали для картки ${cardLabel}`;

        newRequests.push({
          order_id: req.order_id,
          task_id: req.task_id,
          nomenclature_id: req.nomenclature_id,
          quantity: cardQty,
          status: req.status,
          inventory_id: req.inventory_id,
          details: updatedDetails,
          card_id: card.id
        });

        const nextReqQty = Math.max(0, (Number(req.quantity) || 0) - cardQty);
        if (nextReqQty <= 0) {
          deletes.push(req.id);
        } else {
          updates.push({ id: req.id, quantity: nextReqQty });
        }
      }
    }

    if (newRequests.length > 0) {
      await supabase.from('material_requests').insert(newRequests);
    }
    for (const upd of updates) {
      await supabase.from('material_requests').update({ quantity: upd.quantity }).eq('id', upd.id);
    }
    if (deletes.length > 0) {
      await supabase.from('material_requests').delete().in('id', deletes);
    }
  }

  console.log('Split verification done.');
};

run();
