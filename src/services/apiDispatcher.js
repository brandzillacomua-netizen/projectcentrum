import { requestBuilder } from '../api/requestBuilder';

export const apiService = {
  submitOrder: async (header, items, fallback) => {
    const payload = requestBuilder.buildOrderPayload(header, items);
    console.log("%c--- 📦 BACKEND ACTION: CREATE ORDER ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') fallback(header, items);
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
    if (typeof fallback === 'function') fallback(orderId, machine);
    return true;
  },

  submitCreateWorkCardsBatch: async (taskId, orderId, nomenclatureId, cardsArray, fallback) => {
    const payload = requestBuilder.buildWorkCardBatchPayload(taskId, orderId, nomenclatureId, cardsArray);
    console.log("%c--- 📦 BACKEND ACTION: CREATE WORK CARDS BATCH ---", "color: #ec4899; font-weight: bold; font-size: 16px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    const results = [];
    if (typeof fallback === 'function') {
      for (const c of cardsArray) {
        const res = await fallback(taskId, orderId, nomenclatureId, c.operation, c.machine, c.estimatedTime, c.cardInfo, c.quantity);
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

  submitCreateWorkCard: async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, fallback) => {
    const payload = requestBuilder.buildCreateWorkCardPayload(taskId, orderId, nomenclatureId, operation, machine, estimatedTime);
    console.log("%c--- 📦 BACKEND ACTION: CREATE WORK CARD ---", "color: #ec4899; font-weight: bold; font-size: 14px; text-decoration: underline;");
    console.log("JSON Payload:", payload);
    if (typeof fallback === 'function') await fallback(taskId, orderId, nomenclatureId, operation, machine, estimatedTime, null);
    return true;
  },

  submitApproveEngineer: async (taskId, fallback) => {
    const payload = requestBuilder.buildApproveEngineerPayload(taskId);
    console.log("%c--- 📦 BACKEND ACTION: ENGINEER APPROVE ---", "color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: underline;");
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
  }
};
