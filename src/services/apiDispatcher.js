import { requestBuilder } from '../api/requestBuilder';
import { supabase } from '../supabase';

const baseUrl = '/api';

// ── Rust availability cache ────────────────────────────────────────────────
// Avoids N×1200ms timeouts when Rust is offline.
// Resets every 2 minutes so we retry if backend comes back online.
let rustAvailable = null;
let rustLastCheck = 0;
const RUST_CACHE_TTL = 2 * 60 * 1000; // 2 min

const checkRustAvailability = async (token) => {
  const now = Date.now();
  if (rustAvailable !== null && now - rustLastCheck < RUST_CACHE_TTL) {
    return rustAvailable;
  }
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 600); // 600ms ping
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      signal: controller.signal
    });
    clearTimeout(id);
    rustAvailable = res.ok;
  } catch {
    rustAvailable = false;
  }
  rustLastCheck = now;
  return rustAvailable;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 800) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// Fire-and-forget Rust sync — does NOT block the UI
const syncToRustAsync = async (header, items, token) => {
  try {
    const activeToken = token || localStorage.getItem('BACKEND_TOKEN') || '';
    if (!activeToken) return;

    const isUp = await checkRustAvailability(activeToken);
    if (!isUp) return;

    const authHeaders = { 'Authorization': `Bearer ${activeToken}`, 'Content-Type': 'application/json' };
    const nomenclatureId = header.nomenclature_id || (items?.length > 0 ? items[0].nomenclature_id : null);
    if (!nomenclatureId) return;

    let characteristicId = '00000000-0000-0000-0000-000000000000';
    let customerId = '00000000-0000-0000-0000-000000000000';

    // Resolve characteristic + counterparty IN PARALLEL
    const [charRes, cpRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/nomenclature/${nomenclatureId}/characteristics`, { headers: authHeaders }, 800),
      fetchWithTimeout(`${baseUrl}/counterparties`, { headers: authHeaders }, 800)
    ]);

    if (charRes.ok) {
      const charData = await charRes.json();
      const charItems = charData.items || charData || [];
      if (charItems.length > 0) {
        characteristicId = charItems[0].id;
      } else {
        const newCharRes = await fetchWithTimeout(`${baseUrl}/nomenclature/${nomenclatureId}/characteristics`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ name: 'Базова', code: 'BASE-' + Date.now().toString().slice(-4), is_base: true })
        }, 800);
        if (newCharRes.ok) characteristicId = (await newCharRes.json()).id;
      }
    }

    if (cpRes.ok) {
      const counterparties = (await cpRes.json()).items || [];
      const customerName = (header.customer || '').toLowerCase().trim();
      let found = counterparties.find(c => c.name.toLowerCase().trim() === customerName);
      if (!found) {
        const newCpRes = await fetchWithTimeout(`${baseUrl}/counterparties`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ name: header.customer.trim(), type: 'customer', code: 'CL-' + Date.now().toString().slice(-6) })
        }, 800);
        if (newCpRes.ok) found = await newCpRes.json();
      }
      if (found) customerId = found.id;
    }

    const payload = requestBuilder.buildOrderPayload({ ...header, customer_id: customerId }, items, characteristicId);
    await fetchWithTimeout(`${baseUrl}/orders`, { method: 'POST', headers: authHeaders, body: JSON.stringify(payload) }, 800);
  } catch (err) {
    // Non-blocking — never surfaces to UI
    console.warn('⚠️ Rust async sync failed (non-blocking):', err.message);
    rustAvailable = false; // Mark as unavailable so next call skips immediately
    rustLastCheck = Date.now();
  }
};

export const apiService = {
  submitOrder: async (header, items, fallback, token) => {
    // ── Step 1: Save customer to Supabase immediately ──────────────────────
    if (header.customer) {
      try {
        const trimmedName = header.customer.trim();
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .ilike('name', trimmedName)
          .maybeSingle();
        if (!existing) {
          await supabase
            .from('customers')
            .insert([{ name: trimmedName, official_name: header.official_customer?.trim() || '' }]);
        }
      } catch (err) {
        console.warn('⚠️ Failed to auto-create customer:', err.message);
      }
    }

    // ── Step 2: Save order to Supabase (primary, instant) ─────────────────
    // This is the real write — Rust is just a mirror/sync
    try {
      await fallback(header, items);
    } catch (err) {
      console.error('❌ Supabase order error:', err.message);
      throw err;
    }

    // ── Step 3: Fire-and-forget Rust sync (does NOT block UI) ─────────────
    syncToRustAsync(header, items, token).catch(() => {});

    return true;
  },

  submitNomenclature: async (data, fallback) => {
    const payload = requestBuilder.buildNomenclaturePayload(data);
    console.log("%c--- 📦 BACKEND ACTION: NOMENCLATURE SAVE ---", "color: #eab308; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') fallback(data);
    return true;
  },

  submitBOM: async (parentId, draftBOM, fallback) => {
    const payload = requestBuilder.buildBOMPayload(parentId, draftBOM);
    console.log("%c--- 📦 BACKEND ACTION: BOM SYNC ---", "color: #a855f7; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(parentId, draftBOM);
    return true;
  },

  submitInventory: async (data, fallback) => {
    const payload = requestBuilder.buildInventoryPayload(data);
    console.log("%c--- 📦 BACKEND ACTION: INVENTORY ADD ---", "color: #14b8a6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') fallback(data);
    return true;
  },

  submitDelete: async (id, type, fallback) => {
    const payload = requestBuilder.buildDeletePayload(id, type);
    console.log(`%c--- 📦 BACKEND ACTION: DELETE ${type.toUpperCase()} ---`, "color: #ef4444; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') fallback(id);
    return true;
  },

  submitReserveBatch: async (orderId, reqList, taskId, cbIssueBatch) => {
    const payload = requestBuilder.buildReserveBatchPayload(orderId, reqList, taskId);
    console.log("%c--- 📦 BACKEND ACTION: RESERVE BATCH (WAREHOUSE) ---", "color: #f59e0b; font-weight: bold; font-size: 16px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof cbIssueBatch === 'function') {
      await cbIssueBatch(reqList.map(r => r.id), taskId);
    }
    return true;
  },

  submitCreateTask: async (orderId, machine, fallback) => {
    const payload = requestBuilder.buildCreateTaskPayload(orderId, machine);
    console.log("%c--- 📦 BACKEND ACTION: CREATE PRODUCTION NARYAD ---", "color: #f59e0b; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(orderId, machine);
    return true;
  },

  submitCreateWorkCardsBatch: async (taskId, orderId, nomenclatureId, cardsArray, fallback) => {
    const payload = requestBuilder.buildWorkCardBatchPayload(taskId, orderId, nomenclatureId, cardsArray);
    console.log("%c--- 📦 BACKEND ACTION: CREATE WORK CARDS BATCH ---", "color: #ec4899; font-weight: bold; font-size: 16px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    const results = [];
    if (typeof fallback === 'function') {
      if (fallback.name === 'createWorkCardsBatch' || fallback.length === 4) {
        const res = await fallback(taskId, orderId, nomenclatureId, cardsArray);
        if (res) return Array.isArray(res) ? res : [res];
      } else {
        for (const c of cardsArray) {
          const res = await fallback(taskId, orderId, nomenclatureId, c.operation, c.machine, c.estimatedTime, c.cardInfo, c.quantity, c.bufferQty);
          if (res) results.push(res);
        }
      }
    }
    return results;
  },

  submitCompleteTaskByMaster: async (taskId, fallback) => {
    const payload = requestBuilder.buildCompleteTaskByMasterPayload(taskId);
    console.log("%c--- 📦 BACKEND ACTION: MASTER COMPLETE TASK ---", "color: #ef4444; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(taskId);
    return true;
  },

  submitCreateWorkCard: async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, fallback, bufferQty, cardInfo, quantity) => {
    const payload = requestBuilder.buildCreateWorkCardPayload(taskId, orderId, nomenclatureId, operation, machine, estimatedTime, bufferQty);
    console.log("%c--- 📦 BACKEND ACTION: CREATE WORK CARD ---", "color: #ec4899; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(taskId, orderId, nomenclatureId, operation, machine, estimatedTime, cardInfo, quantity, bufferQty);
    return true;
  },

  submitApproveEngineer: async (taskId, fallback) => {
    const payload = requestBuilder.buildApproveEngineerPayload(taskId);
    console.log("%c--- 📦 BACKEND ACTION: ENGINEER APPROVE ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(taskId);
    return true;
  },
  
  submitApproveDirector: async (taskId, fallback) => {
    const payload = requestBuilder.buildApproveDirectorPayload(taskId);
    console.log("%c--- 📦 BACKEND ACTION: DIRECTOR APPROVE ---", "color: #10b981; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(taskId);
    return true;
  },

  submitOperatorAction: async (action, taskId, cardId, operator, extra, fallback) => {
    const payload = requestBuilder.buildOperatorActionPayload(action, taskId, cardId, operator, extra);
    let color = (action === 'complete') ? "#10b981" : (action === 'scrap') ? "#ef4444" : "#fbbf24";
    console.log(`%c--- 📦 BACKEND ACTION: OPERATOR ${action.toUpperCase()} ---`, `color: ${color}; font-weight: bold; font-size: 14px; text-decoration: underline;`);
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(taskId, cardId, operator, extra);
    return true;
  },

  submitShipOrder: async (orderId, fallback) => {
    const payload = requestBuilder.buildShipOrderPayload(orderId);
    console.log("%c--- 📦 BACKEND ACTION: SHIP ORDER ---", "color: #10b981; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(orderId, 'shipped');
    return true;
  },

  submitPurchaseRequest: async (orderId, orderNum, items, taskId, fallback) => {
    const payload = requestBuilder.buildPurchaseRequestPayload(orderId, orderNum, items);
    console.log("%c--- 📦 BACKEND ACTION: PURCHASE REQUEST ---", "color: #ef4444; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(orderId, orderNum, items, taskId);
    return true;
  },

  submitConfirmReception: async (docId, fallback) => {
    const payload = requestBuilder.buildConfirmReceptionPayload(docId);
    console.log("%c--- 📦 BACKEND ACTION: RECEPTION CONFIRM ---", "color: #10b981; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(docId);
    return true;
  },

  submitCreateReceptionDoc: async (items, taskId, fallback, targetWarehouse = 'production', sourceWarehouse = null) => {
    const payload = requestBuilder.buildCreateReceptionDocPayload(items);
    console.log("%c--- 📦 BACKEND ACTION: CREATE RECEPTION DOC ---", "color: #0ea5e9; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(items, 'pending', null, taskId, targetWarehouse, sourceWarehouse);
    return true;
  },

  submitConvertRequestToOrder: async (requestId, fallback) => {
    const payload = requestBuilder.buildConvertRequestToOrderPayload(requestId);
    console.log("%c--- 📦 BACKEND ACTION: CONVERT REQUEST TO ORDER ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(requestId);
    return true;
  },

  submitSendDocToWarehouse: async (docId, fallback, newTarget = null, newSource = null) => {
    const payload = { action: 'SEND_TO_WAREHOUSE', docId, newTarget, newSource };
    console.log("%c--- 📦 BACKEND ACTION: NOTIFY WAREHOUSE ---", "color: #0ea5e9; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(docId, newTarget, newSource);
    return true;
  },

  submitBufferConfirmation: async (cardId, scrapData, fallback, cuttersUsed = 0, cuttersBreakdown = null) => {
    const payload = { action: 'BUFFER_CONFIRMATION', cardId, scrapData, cuttersUsed, cuttersBreakdown };
    console.log("%c--- 📦 BACKEND ACTION: BUFFER RECEPTION ---", "color: #ef4444; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(cardId, scrapData, cuttersUsed, cuttersBreakdown);
    return true;
  },

  submitMachine: async (data, fallback) => {
    console.log("%c--- 📦 BACKEND ACTION: MACHINE ADD ---", "color: #ff9000; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", data);
    if (typeof fallback === 'function') await fallback(data);
    return true;
  },

  submitUpdateMachine: async (id, data, fallback) => {
    console.log("%c--- 📦 BACKEND ACTION: MACHINE UPDATE ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("ID:", id, "Data:", data);
    if (typeof fallback === 'function') await fallback(id, data);
    return true;
  },

  submitUserAction: async (userData, fallback, token) => {
    if (typeof fallback === 'function') await fallback(userData);
    return true;
  },

  submitLogin: async (login, password) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);
      const res = await fetch(baseUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: login, password: password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }
};
