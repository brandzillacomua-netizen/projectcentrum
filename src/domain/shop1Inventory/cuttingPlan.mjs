function id(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Explicit identifiers required');
}
function qty(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Non-negative integer quantities required');
}

// Pure offline proposal. No database, side effects, UI imports, or implicit material matching.
// Caller must supply a consistent snapshot. Concurrency/idempotency require a future DB transaction.
export function planCuttingCompletion({ card, sheets, cutters }) {
  id(card.id); id(card.taskId);
  if (card.stage !== 'cutting' || card.inventoryFinalized !== false) throw new Error('Card is not eligible for cutting finalization');
  if (!Array.isArray(cutters)) throw new Error('Explicit cutter allocations required');
  const seen = new Set();
  const lines = [sheets, ...cutters].map((line, index) => {
    id(line.inventoryId); id(line.reservationId); id(line.taskId);
    if (line.taskId !== card.taskId) throw new Error('Reservation belongs to another task');
    if (seen.has(line.inventoryId)) throw new Error('Duplicate stock row; normalize allocations first');
    seen.add(line.inventoryId);
    for (const field of ['physical', 'reserved', 'remaining']) qty(line[field]);
    if (line.reserved > line.physical || line.remaining > line.reserved) throw new Error('Inconsistent stock snapshot');
    const isSheet = index === 0;
    const consumed = isSheet ? card.sheetQty : line.actual;
    const released = isSheet ? card.sheetQty : line.allocated;
    qty(consumed); qty(released);
    if (isSheet && consumed === 0) throw new Error('Explicit positive card sheet quantity required');
    if (!isSheet && line.cardId !== card.id) throw new Error('Cutter allocation belongs to another card');
    if (consumed > released) throw new Error('Excess cutter use needs an explicit additional allocation');
    if (released > line.remaining || consumed > line.physical) throw new Error('Insufficient reservation or stock');
    const physicalAfter = line.physical - consumed;
    const reservedAfter = line.reserved - released;
    return Object.freeze({
      kind: isSheet ? 'sheet' : 'cutter', inventoryId: line.inventoryId,
      reservationId: line.reservationId, consumed, released,
      unusedReleased: released - consumed,
      physicalAfter, reservedAfter, freeAfter: physicalAfter - reservedAfter,
      reservationRemainingAfter: line.remaining - released,
    });
  });
  return Object.freeze({ cardId: card.id, taskId: card.taskId,
    eventKey: `shop1:cutting-completed:${card.id}`, nextStage: 'cutting-buffer',
    lines: Object.freeze(lines) });
}
