// Candidate adapter. Intentionally NOT imported by production screens.
// The caller passes the already selected Supabase client (/test or PROD).
// RPC permissions remain revoked until the application authorization phase.
const uuid = value => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Explicit UUID required');
  }
};
const quantity = value => {
  if (!Number.isInteger(value) || value < 0 || value > 2147483647) throw new Error('Non-negative integer quantity required');
};

export function createShop1InventoryCommands(client) {
  if (typeof client?.rpc !== 'function') throw new Error('Selected database client required');
  const call = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw Object.assign(new Error(error.message || 'Inventory transaction failed'), { cause: error });
    // No network retry, offline queue, alternate client or direct-table fallback.
    // A retry must preserve the exact same batch key / completion facts.
    return data;
  };
  return Object.freeze({
    async reserveSheets(taskId) {
      uuid(taskId);
      return call('shop1_v2_reserve_sheets', { p_task_id: taskId });
    },
    async createCards(taskId, batchKey, cards) {
      uuid(taskId);
      if (typeof batchKey !== 'string' || !batchKey.trim() || batchKey.length > 128) throw new Error('Stable batch key required');
      if (!Array.isArray(cards) || cards.length < 1 || cards.length > 100) throw new Error('Expected 1..100 cards');
      // The database validates every allocation and all three approvals.
      const data = await call('shop1_v2_create_cards', { p_task_id: taskId, p_batch_key: batchKey, p_cards: cards });
      if (!Array.isArray(data) || data.length !== cards.length) throw new Error('Uncertain generation result; retry the same batch key');
      data.forEach(uuid);
      return data;
    },
    async completeCutting({ cardId, actualCutters, operator, shift, scrapQty = 0, scrapInventoryId = null, scrapOperator = null }) {
      uuid(cardId); quantity(scrapQty);
      if (!actualCutters || Array.isArray(actualCutters) || typeof actualCutters !== 'object') throw new Error('Explicit cutter facts required');
      for (const [requestId, used] of Object.entries(actualCutters)) { uuid(requestId); quantity(used); }
      if (typeof operator !== 'string' || !operator.trim() || typeof shift !== 'string' || !shift.trim()) throw new Error('Operator and shift required');
      if (scrapQty > 0) uuid(scrapInventoryId);
      else if (scrapInventoryId !== null) throw new Error('Unexpected scrap inventory');
      if (scrapOperator !== null && (typeof scrapOperator !== 'string' || !scrapOperator.trim())) throw new Error('Invalid scrap operator');
      const data = await call('shop1_v2_complete_cutting', {
        p_card_id: cardId, p_actual: actualCutters, p_operator: operator, p_shift: shift,
        p_scrap_qty: scrapQty, p_scrap_inventory_id: scrapInventoryId, p_scrap_operator: scrapOperator,
      });
      if (data?.card_id !== cardId || data?.status !== 'at-buffer' || !Array.isArray(data?.lines)) {
        throw new Error('Uncertain completion result; retry with the same facts');
      }
      return data;
    },
  });
}
