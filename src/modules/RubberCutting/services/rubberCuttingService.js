/**
 * Enterprise Data & Inventory Service for Rubber Cutting (Цех №2)
 */
import { RAW_SHEETS } from '../utils/rubberConstants';
import { VERIFIED_RUBBER_PARTS } from '../../Nomenclature/utils/rubberCatalogData';

const LOCAL_BATCHES_KEY = 'centrum_rubber_cutting_batches_v1';

export async function fetchRawRubberStock(supabase) {
  if (!supabase) return { 'V2-90030': 0, 'V2-90031': 0 };

  try {
    const rawCodes = ['V2-90030', 'V2-90031'];
    // 1. Get raw material IDs
    const { data: noms } = await supabase
      .from('nomenclatures_v2')
      .select('id, code, name')
      .in('code', rawCodes);

    const nomMap = {};
    const nomIds = [];
    (noms || []).forEach(n => {
      nomMap[n.id] = n.code;
      nomIds.push(n.id);
    });

    // 2. Query inventory for raw sheets (warehouse SV / supply / type raw)
    let stock = { 'V2-90030': 0, 'V2-90031': 0 };
    if (nomIds.length > 0) {
      const { data: inv } = await supabase
        .from('inventory')
        .select('id, nomenclature_id, total_qty, reserved_qty, warehouse, type')
        .in('nomenclature_id', nomIds);

      (inv || []).forEach(row => {
        const code = nomMap[row.nomenclature_id];
        if (code) {
          const qty = Number(row.total_qty) || 0;
          stock[code] = (stock[code] || 0) + qty;
        }
      });
    }

    return stock;
  } catch (err) {
    console.warn('[rubberCuttingService] Error fetching raw stock:', err);
    return { 'V2-90030': 500, 'V2-90031': 2025 };
  }
}

export async function fetchRubberPartsCatalog(supabase) {
  try {
    if (supabase) {
      const { data: dbParts, error } = await supabase
        .from('nomenclatures_v2')
        .select('*')
        .or('rule_type.eq.rubber_part,group_id.eq.grp_rubber_parts')
        .order('name');

      if (!error && dbParts && dbParts.length > 0) {
        return dbParts.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          unit: p.unit || 'шт',
          part_size: p.rule_params?.part_size || p.name.replace('Гума листова', '').trim(),
          sheet_size: p.rule_params?.sheet_size || (p.name.endsWith('4') ? '500*500*4' : '500*500*2'),
          thickness: p.rule_params?.thickness || (p.name.endsWith('4') ? 4 : 2),
          sheet_yield: Number(p.rule_params?.sheet_yield || p.rule_params?.units_per_sheet) || 1,
          sheet_cutting_time_sec: Number(p.rule_params?.sheet_cutting_time_sec) || 0,
          item_cutting_time_sec: Number(p.rule_params?.item_cutting_time_sec) || 0,
          raw_material_code: p.rule_params?.raw_material_code || (p.name.endsWith('4') ? 'V2-90031' : 'V2-90030'),
          raw_material_id: p.default_material_id || p.rule_params?.raw_material_id || null
        }));
      }
    }
  } catch (err) {
    console.warn('[rubberCuttingService] Failed to load parts from DB, using verified definitions:', err);
  }

  // Fallback to static 20 verified parts
  return VERIFIED_RUBBER_PARTS.map((p, idx) => ({
    id: `local-rubber-${idx + 1}`,
    code: `V2-${90826 + idx}`,
    name: p.name,
    unit: 'шт',
    part_size: p.part_size,
    sheet_size: p.sheet_size,
    thickness: p.thickness,
    sheet_yield: p.sheet_yield,
    sheet_cutting_time_sec: p.sheet_cutting_time_sec,
    item_cutting_time_sec: p.item_cutting_time_sec,
    raw_material_code: p.raw_material_code,
    raw_material_id: null
  }));
}

export async function fetchCuttingBatches(supabase) {
  let localBatches = [];
  try {
    const raw = localStorage.getItem(LOCAL_BATCHES_KEY);
    if (raw) localBatches = JSON.parse(raw);
  } catch (e) {}

  if (!supabase) return localBatches;

  try {
    const { data: dbBatches, error } = await supabase
      .from('rubber_cutting_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && dbBatches) {
      // Merge unique by id
      const map = new Map();
      localBatches.forEach(b => map.set(b.id, b));
      dbBatches.forEach(b => map.set(b.id, b));
      return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  } catch (err) {
    console.warn('[rubberCuttingService] DB batches fetch fallback:', err);
  }

  return localBatches;
}

/**
 * Create a new pending rubber cutting request from Foreman 2
 */
export async function createPendingRubberOrder(supabase, {
  part,
  sheetsCount,
  plannedQuantity,
  priority = 'normal',
  notes = '',
  createdBy = ''
}) {
  const batchId = crypto.randomUUID();
  const batchNumber = `RC-${Date.now().toString().slice(-6)}`;
  const plannedDuration = (Number(sheetsCount) || 1) * (Number(part?.sheet_cutting_time_sec) || 0);
  const sheetsQty = Number(sheetsCount) || 1;
  const plannedQty = Number(plannedQuantity) || (sheetsQty * (Number(part?.sheet_yield) || 1));

  let rawNomId = part?.raw_material_id || null;
  let rawNomName = part?.sheet_size ? `Гума листова ${part.sheet_size}` : (part?.raw_material_code || 'Гума листова');

  if (supabase && part?.raw_material_code) {
    try {
      const { data: rawNom } = await supabase
        .from('nomenclatures_v2')
        .select('id, name')
        .eq('code', part.raw_material_code)
        .maybeSingle();
      if (rawNom?.id) rawNomId = rawNom.id;
      if (rawNom?.name) rawNomName = rawNom.name;
    } catch (e) {
      console.warn('[rubberCuttingService] Resolve raw material error:', e);
    }
  }

  const batchRecord = {
    id: batchId,
    batch_number: batchNumber,
    status: supabase ? 'awaiting_material' : 'pending',
    part_id: part?.id && !part.id.startsWith('local-') ? part.id : null,
    part_code: part?.code || '',
    part_name: part?.name || '',
    part_size: part?.part_size || '',
    raw_material_id: rawNomId,
    raw_material_code: part?.raw_material_code || '',
    raw_material_name: rawNomName,
    sheets_count: sheetsQty,
    sheet_yield: Number(part?.sheet_yield) || 1,
    planned_quantity: plannedQty,
    actual_quantity: 0,
    scrap_quantity: 0,
    scrap_reason: null,
    planned_duration_sec: plannedDuration,
    actual_duration_sec: 0,
    shift: 'Без зміни',
    operators: [],
    operator_name: '',
    started_at: null,
    completed_at: null,
    notes: [priority === 'urgent' ? '🔴 ТЕРМІНОВО' : null, notes, createdBy ? `Створив: ${createdBy}` : null].filter(Boolean).join(' | '),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await saveCuttingBatch(supabase, batchRecord);

  // Create material request for Warehouse V2 (Склад виробництва)
  if (supabase) {
    try {
      const { error: reqErr } = await supabase.from('material_requests').insert([{
        nomenclature_id: rawNomId,
        quantity: sheetsQty,
        status: 'pending',
        target_warehouse: 'operational',
        category: 'raw',
        details: `ПОРІЗКА ГУМИ #${batchNumber}: ${rawNomName} — ${sheetsQty} шт. (для: ${part?.name || ''}, ${plannedQty} шт) [RUBBER_BATCH:${batchId}]`
      }]);
      if (reqErr) {
        console.warn('[rubberCuttingService] Create material_request error:', reqErr.message);
      } else {
        window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'material_requests' } }));
      }
    } catch (reqCatchErr) {
      console.warn('[rubberCuttingService] Create material_request exception:', reqCatchErr);
    }
  }

  window.dispatchEvent(new CustomEvent('mes:rubber-order-created', { detail: batchRecord }));
  return { success: true, batch: batchRecord };
}

/**
 * Start cutting task by polishers
 */
export async function startRubberCuttingTask(supabase, {
  batchId,
  operators = [],
  shift = 'Без зміни'
}) {
  const operatorNames = Array.isArray(operators) ? operators.filter(Boolean) : [operators].filter(Boolean);
  const operatorStr = operatorNames.join(', ');

  const updatePayload = {
    id: batchId,
    status: 'in_progress',
    operators: operatorNames,
    operator_name: operatorStr,
    shift: shift || 'Без зміни',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Update in local cache
  try {
    const raw = localStorage.getItem(LOCAL_BATCHES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const updated = list.map(b => b.id === batchId ? { ...b, ...updatePayload } : b);
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(updated));
  } catch (e) {}

  if (supabase) {
    try {
      await supabase
        .from('rubber_cutting_batches')
        .update(updatePayload)
        .eq('id', batchId);
    } catch (e) {
      console.warn('[rubberCuttingService] Start task DB update:', e);
    }
  }

  return { success: true, batchId };
}

/**
 * Cancel a pending rubber order
 */
export async function cancelRubberOrder(supabase, batchId) {
  try {
    const raw = localStorage.getItem(LOCAL_BATCHES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(b => b.id !== batchId);
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(filtered));
  } catch (e) {}

  if (supabase) {
    try {
      await supabase
        .from('rubber_cutting_batches')
        .delete()
        .eq('id', batchId);
      await supabase
        .from('material_requests')
        .delete()
        .ilike('details', `%[RUBBER_BATCH:${batchId}]%`)
        .eq('status', 'pending');
      window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'material_requests' } }));
    } catch (e) {
      console.warn('[rubberCuttingService] Cancel order DB delete:', e);
    }
  }

  return { success: true };
}

export async function saveCuttingBatch(supabase, batch) {
  // Always update local cache first for resilience
  try {
    const raw = localStorage.getItem(LOCAL_BATCHES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(b => b.id !== batch.id);
    filtered.unshift(batch);
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(filtered.slice(0, 200)));
  } catch (e) {}

  if (!supabase) return { success: true, batch };

  try {
    const { data, error } = await supabase
      .from('rubber_cutting_batches')
      .upsert([batch])
      .select()
      .single();

    if (error) {
      console.warn('[rubberCuttingService] Upsert batch DB warning:', error.message);
      return { success: true, batch, isLocal: true };
    }
    return { success: true, batch: data || batch };
  } catch (err) {
    console.warn('[rubberCuttingService] DB error:', err);
    return { success: true, batch, isLocal: true };
  }
}

/**
 * Execute cutting completion:
 * 1. Deduct raw sheets from warehouse SV (inventory)
 * 2. Credit finished rubber parts to Shop 2 buffer (inventory)
 * 3. Log the batch in rubber_cutting_batches
 */
export async function completeCuttingTransaction(supabase, {
  batchId,
  part,
  sheetsCount,
  actualParts,
  scrapParts = 0,
  scrapReason = '',
  elapsedSeconds,
  shift,
  operators = [],
  notes = ''
}) {
  const batchNumber = `RC-${Date.now().toString().slice(-6)}`;
  const operatorNames = Array.isArray(operators) ? operators.filter(Boolean) : [operators].filter(Boolean);
  const operatorStr = operatorNames.join(', ');

  const batchRecord = {
    id: batchId || crypto.randomUUID(),
    batch_number: batchNumber,
    status: 'completed',
    part_id: part?.id && !part.id.startsWith('local-') ? part.id : null,
    part_code: part?.code || '',
    part_name: part?.name || '',
    part_size: part?.part_size || '',
    raw_material_id: part?.raw_material_id || null,
    raw_material_code: part?.raw_material_code || '',
    raw_material_name: part?.sheet_size ? `Гума листова ${part.sheet_size}` : '',
    sheets_count: Number(sheetsCount) || 1,
    sheet_yield: Number(part?.sheet_yield) || 1,
    planned_quantity: (Number(sheetsCount) || 1) * (Number(part?.sheet_yield) || 1),
    actual_quantity: Number(actualParts) || 0,
    scrap_quantity: Number(scrapParts) || 0,
    scrap_reason: scrapReason || null,
    planned_duration_sec: (Number(sheetsCount) || 1) * (Number(part?.sheet_cutting_time_sec) || 0),
    actual_duration_sec: Number(elapsedSeconds) || 0,
    shift: shift || 'Без зміни',
    operators: operatorNames,
    operator_name: operatorStr,
    completed_at: new Date().toISOString(),
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Save Batch Record
  await saveCuttingBatch(supabase, batchRecord);

  // 2. Perform Inventory Movements if Supabase connected
  if (supabase) {
    try {
      // 2a. Deduct raw sheets from Warehouse SV (and release reservation if issued via Warehouse)
      let issuedWarehouseReq = null;
      if (batchId) {
        const { data: whReqs } = await supabase
          .from('material_requests')
          .select('id, status, inventory_id, quantity')
          .ilike('details', `%[RUBBER_BATCH:${batchId}]%`)
          .eq('status', 'issued')
          .limit(1);
        if (whReqs && whReqs.length > 0) {
          issuedWarehouseReq = whReqs[0];
        }
      }

      const rawCode = part?.raw_material_code;
      if (rawCode || issuedWarehouseReq?.inventory_id) {
        let targetInvRow = null;
        if (issuedWarehouseReq?.inventory_id) {
          const { data: invById } = await supabase
            .from('inventory')
            .select('*')
            .eq('id', issuedWarehouseReq.inventory_id)
            .maybeSingle();
          targetInvRow = invById || null;
        }
        if (!targetInvRow && rawCode) {
          const { data: rawNoms } = await supabase
            .from('nomenclatures_v2')
            .select('id')
            .eq('code', rawCode)
            .maybeSingle();

          const rawNomId = rawNoms?.id || part?.raw_material_id;
          if (rawNomId) {
            const { data: invRows } = await supabase
              .from('inventory')
              .select('*')
              .eq('nomenclature_id', rawNomId)
              .limit(1);
            if (invRows && invRows.length > 0) {
              targetInvRow = invRows[0];
            }
          }
        }

        if (targetInvRow) {
          const currentTotal = Number(targetInvRow.total_qty) || 0;
          const currentReserved = Number(targetInvRow.reserved_qty) || 0;
          const newTotal = Math.max(0, currentTotal - Number(sheetsCount));
          const releaseQty = issuedWarehouseReq ? (Number(issuedWarehouseReq.quantity) || Number(sheetsCount)) : 0;
          const newReserved = Math.max(0, currentReserved - releaseQty);
          await supabase
            .from('inventory')
            .update({
              total_qty: newTotal,
              reserved_qty: issuedWarehouseReq ? newReserved : currentReserved,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetInvRow.id);
        }
      }

      if (issuedWarehouseReq) {
        await supabase
          .from('material_requests')
          .update({ status: 'completed' })
          .eq('id', issuedWarehouseReq.id);
        window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'material_requests' } }));
      }

      // 2b. Create SGP Reception Document (Прийомка на СГП → Метизи & Комплектуючі)
      if (Number(actualParts) > 0) {
        const { error: recErr } = await supabase.from('reception_docs').insert([{
          status: 'shipped',
          source_warehouse: 'shop2_rubber',
          target_warehouse: 'sgp',
          items: [{
            nomenclature_id: part?.id && !part.id.startsWith('local-') ? part.id : null,
            code: part?.code || '',
            name: part?.name || '',
            qty: Number(actualParts) || 0,
            expected_qty: Number(actualParts) || 0,
            unit: part?.unit || 'шт',
            type: 'hardware',
            batch_id: batchRecord.id,
            batch_number: batchNumber,
            source_label: 'Порізка гуми (Цех №2)',
            operators: operatorStr || 'Термінал порізки',
            scrap_qty: Number(scrapParts) || 0,
            created_at: new Date().toISOString()
          }],
          created_at: new Date().toISOString()
        }]);

        if (recErr) {
          console.warn('[rubberCuttingService] Create SGP reception_doc warning:', recErr.message);
        } else {
          window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'reception_docs' } }));
        }
      }

      window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'inventory' } }));
    } catch (invErr) {
      console.warn('[rubberCuttingService] Inventory balance sync notice:', invErr);
    }
  }

  return { success: true, batch: batchRecord };
}

