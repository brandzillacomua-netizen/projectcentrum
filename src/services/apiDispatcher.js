import { requestBuilder } from '../api/requestBuilder';

const baseUrl = 'https://8ff5-37-248-226-236.ngrok-free.app/api';

export const apiService = {
  submitOrder: async (header, items, fallback, token) => {
    const payload = requestBuilder.buildOrderPayload(header, items);

    console.log("%c--- 📦 BACKEND ACTION: CREATE ORDER (HYBRID) ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload to Backend:", payload);

    // 1. Sync with External Backend
    try {
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        console.log("External Backend Response:", data);
      }
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.warn("⚠️ Backend Offline (ngrok link expired or server down). Sync skipped, using Supabase fallback.");
      } else {
        console.error("Backend Sync error:", err.message);
      }
    }

    // 2. Save to local Supabase via fallback
    if (typeof fallback === 'function') await fallback(header, items);
    
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

  submitReserveBatch: async (orderId, reqList, taskId, cbIssue, cbApprove) => {
    const payload = requestBuilder.buildReserveBatchPayload(orderId, reqList, taskId);
    console.log("%c--- 📦 BACKEND ACTION: RESERVE BATCH (WAREHOUSE) ---", "color: #f59e0b; font-weight: bold; font-size: 16px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    for (const r of reqList) if (typeof cbIssue === 'function') await cbIssue(r.id);
    if (taskId && typeof cbApprove === 'function') await cbApprove(taskId);
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
      for (const c of cardsArray) {
        const res = await fallback(taskId, orderId, nomenclatureId, c.operation, c.machine, c.estimatedTime, c.cardInfo, c.quantity, c.bufferQty);
        if (res) results.push(res);
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

  submitPurchaseRequest: async (orderId, orderNum, items, fallback) => {
    const payload = requestBuilder.buildPurchaseRequestPayload(orderId, orderNum, items);
    console.log("%c--- 📦 BACKEND ACTION: PURCHASE REQUEST ---", "color: #ef4444; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(orderId, orderNum, items);
    return true;
  },

  submitConfirmReception: async (docId, fallback) => {
    const payload = requestBuilder.buildConfirmReceptionPayload(docId);
    console.log("%c--- 📦 BACKEND ACTION: RECEPTION CONFIRM ---", "color: #10b981; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(docId);
    return true;
  },

  submitCreateReceptionDoc: async (items, fallback) => {
    const payload = requestBuilder.buildCreateReceptionDocPayload(items);
    console.log("%c--- 📦 BACKEND ACTION: CREATE RECEPTION DOC ---", "color: #0ea5e9; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(items);
    return true;
  },

  submitConvertRequestToOrder: async (requestId, fallback) => {
    const payload = requestBuilder.buildConvertRequestToOrderPayload(requestId);
    console.log("%c--- 📦 BACKEND ACTION: CONVERT REQUEST TO ORDER ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(requestId);
    return true;
  },

  submitSendDocToWarehouse: async (docId, fallback) => {
    const payload = { action: 'SEND_TO_WAREHOUSE', docId };
    console.log("%c--- 📦 BACKEND ACTION: NOTIFY WAREHOUSE ---", "color: #0ea5e9; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(docId);
    return true;
  },

  submitBufferConfirmation: async (cardId, scrapData, fallback) => {
    const payload = { action: 'BUFFER_CONFIRMATION', cardId, scrapData };
    console.log("%c--- 📦 BACKEND ACTION: BUFFER RECEPTION ---", "color: #ef4444; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(cardId, scrapData);
    return true;
  },

  submitUserAction: async (userData, fallback, token) => {
    const payload = requestBuilder.buildExternalUserPayload(userData);
    console.log("%c--- 👤 BACKEND ACTION: USER SYNC (HYBRID) ---", "color: #ac94f1; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload to External Backend:", payload);

    try {
      const res = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log("External Backend Response:", data);
    } catch (err) {
      console.warn("External Backend User Sync failed:", err.message);
    }

    // Always fallback to local Supabase
    if (typeof fallback === 'function') await fallback(userData);
    return true;
  },

  submitLogin: async (login, password) => {
    console.log("%c--- 🔑 BACKEND ACTION: AUTH SYNC ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    
    try {
      const res = await fetch(baseUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: login, password: password })
      });
      const data = await res.json();
      console.log("Backend Response:", data);
      return data;
    } catch (err) {
      console.warn("Backend Auth Sync failed (offline or wrong URL):", err.message);
      return null;
    }
  }
};
