import { asNumber } from './a/centrum/src/utils/normalize.js';

export const getCardSheets = (card, unitsPerSheet) => {
  const explicit = Number(card?.actual_sheets || card?.actualSheets || card?.sheets) || 0
  if (explicit > 0) return explicit
  if (card?.card_info) {
    const match = String(card.card_info).match(/\[REQ:(\d+)\]/)
    if (match) {
      // REQ tag is explicitly present — use it even if 0 (BZ-only card needs 0 sheets to cut)
      const reqQty = Number(match[1]) || 0
      return reqQty > 0 ? Math.ceil(reqQty / Math.max(1, Number(unitsPerSheet) || 1)) : 0
    }
  }
  // No REQ tag at all → fall back to quantity + scrap_qty_from_history
  const targetQty = (Number(card?.quantity) || 0) + (Number(card?.scrap_qty_from_history) || 0)
  return Math.ceil(targetQty / Math.max(1, Number(unitsPerSheet) || 1))
}

const card1 = {
  card_info: '№131/131 [NEED:16] [REQ:16] [BZ:10]',
  quantity: 0,
  actual_sheets: null,
  scrap_qty_from_history: 26
};

const card2 = {
  card_info: '№130/131 [NEED:26] [REQ:26] [BZ:0]',
  quantity: 0,
  actual_sheets: null,
  scrap_qty_from_history: 26
};

const card3 = {
  card_info: '№129/131 [NEED:104] [REQ:104] [BZ:0]',
  quantity: 0,
  actual_sheets: null,
  scrap_qty_from_history: 104
};

console.log('card1:', getCardSheets(card1, 26)); // should be 1
console.log('card2:', getCardSheets(card2, 26)); // should be 1
console.log('card3:', getCardSheets(card3, 26)); // should be 4
