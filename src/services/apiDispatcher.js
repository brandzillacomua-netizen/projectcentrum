import { supabase } from '../supabase.js';

/**
 * CENTRUM MES — Pure Supabase API Dispatcher (v2.0)
 * 
 * Вся бізнес-логіка, транзакції та контроль цілісності виконуються
 * виключно через Supabase / PostgreSQL Engine. Будь-які застарілі
 * виклики до експериментального бекенда Rust повністю ліквідовані.
 */

export const apiService = {
  submitOrder: async (header, items, fallback) => {
    // ── Авто-створення контрагента в Supabase за потреби ───────────────────
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
        console.warn('⚠️ [apiService] Не вдалося авто-створити клієнта:', err.message);
      }
    }

    // ── Основний запис замовлення в Supabase ──────────────────────────────
    if (typeof fallback === 'function') {
      await fallback(header, items);
    }
    return true;
  },

  submitNomenclature: async (data, fallback) => {
    if (typeof fallback === 'function') await fallback(data);
    return true;
  },

  submitBOM: async (parentId, draftBOM, fallback) => {
    if (typeof fallback === 'function') await fallback(parentId, draftBOM);
    return true;
  },

  submitInventory: async (data, fallback) => {
    if (typeof fallback === 'function') await fallback(data);
    return true;
  },

  submitDelete: async (id, type, fallback) => {
    if (typeof fallback === 'function') await fallback(id);
    return true;
  },

  submitReserveBatch: async (orderId, reqList, taskId, cbIssueBatch) => {
    if (typeof cbIssueBatch === 'function') {
      return await cbIssueBatch(reqList.map(r => r.id), taskId);
    }
    return true;
  },

  submitCreateTask: async (orderId, machine, fallback) => {
    if (typeof fallback === 'function') {
      return await fallback(orderId, machine);
    }
    return true;
  },

  submitCreateWorkCardsBatch: async (taskId, orderId, nomenclatureId, cardsArray, fallback) => {
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
    if (typeof fallback === 'function') await fallback(taskId);
    return true;
  },

  submitCreateWorkCard: async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, fallback, bufferQty, cardInfo, quantity) => {
    if (typeof fallback === 'function') await fallback(taskId, orderId, nomenclatureId, operation, machine, estimatedTime, cardInfo, quantity, bufferQty);
    return true;
  },

  submitApproveEngineer: async (taskId, fallback) => {
    if (typeof fallback === 'function') await fallback(taskId);
    return true;
  },
  
  submitApproveDirector: async (taskId, fallback) => {
    if (typeof fallback === 'function') await fallback(taskId);
    return true;
  },

  submitOperatorAction: async (action, taskId, cardId, operator, extra, fallback) => {
    if (typeof fallback === 'function') await fallback(taskId, cardId, operator, extra);
    return true;
  },

  submitShipOrder: async (orderId, fallback) => {
    if (typeof fallback === 'function') await fallback(orderId, 'shipped');
    return true;
  },

  submitPurchaseRequest: async (orderId, orderNum, items, taskId, fallback) => {
    if (typeof fallback === 'function') await fallback(orderId, orderNum, items, taskId);
    return true;
  },

  submitConfirmReception: async (docId, fallback) => {
    if (typeof fallback === 'function') await fallback(docId);
    return true;
  },

  submitCreateReceptionDoc: async (items, taskId, fallback, targetWarehouse = 'production', sourceWarehouse = null) => {
    if (typeof fallback === 'function') await fallback(items, 'pending', null, taskId, targetWarehouse, sourceWarehouse);
    return true;
  },

  submitConvertRequestToOrder: async (requestId, fallback) => {
    if (typeof fallback === 'function') {
      const result = await fallback(requestId);
      if (result?.error) throw result.error;
      return result;
    }
    return true;
  },

  submitSendDocToWarehouse: async (docId, fallback, newTarget = null, newSource = null) => {
    if (typeof fallback === 'function') await fallback(docId, newTarget, newSource);
    return true;
  },

  submitBufferConfirmation: async (cardId, scrapData, fallback, cuttersUsed = 0, cuttersBreakdown = null) => {
    if (typeof fallback === 'function') await fallback(cardId, scrapData, cuttersUsed, cuttersBreakdown);
    return true;
  },

  submitMachine: async (data, fallback) => {
    if (typeof fallback === 'function') await fallback(data);
    return true;
  },

  submitUpdateMachine: async (id, data, fallback) => {
    if (typeof fallback === 'function') await fallback(id, data);
    return true;
  },

  submitUserAction: async (userData, fallback) => {
    if (typeof fallback === 'function') await fallback(userData);
    return true;
  },

  submitLogin: async () => {
    return null;
  }
};
