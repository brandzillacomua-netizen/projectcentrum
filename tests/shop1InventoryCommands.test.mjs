import { describe, it, expect, vi } from 'vitest';
import { createShop1InventoryCommands } from '../src/domain/shop1Inventory/commands.mjs';
const cardId = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000002';
const input = { cardId, actualCutters: { [requestId]: 1 }, operator: 'Оператор', shift: '1' };
describe('candidate inventory commands', () => {
  it('uses only the injected client and preserves exact cutter facts', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { card_id: cardId, status: 'at-buffer', lines: [] }, error: null });
    await createShop1InventoryCommands({ rpc }).completeCutting(input);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('shop1_v2_complete_cutting', {
      p_card_id: cardId, p_actual: { [requestId]: 1 }, p_operator: 'Оператор', p_shift: '1',
      p_scrap_qty: 0, p_scrap_inventory_id: null, p_scrap_operator: null,
    });
  });
  it('does not retry or call a legacy writer on RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    const from = vi.fn();
    await expect(createShop1InventoryCommands({ rpc, from }).completeCutting(input)).rejects.toThrow('permission denied');
    expect(rpc).toHaveBeenCalledTimes(1); expect(from).not.toHaveBeenCalled();
  });
  it('leaves network failures uncertain instead of writing twice', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('network timeout'));
    await expect(createShop1InventoryCommands({ rpc }).completeCutting(input)).rejects.toThrow('network timeout');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid facts before making a request', async () => {
    const rpc = vi.fn(); const commands = createShop1InventoryCommands({ rpc });
    for (const actual of [-1, 0.5, NaN, Infinity, '1', null]) {
      await expect(commands.completeCutting({ ...input, actualCutters: { [requestId]: actual } })).rejects.toThrow();
    }
    await expect(commands.completeCutting({ ...input, scrapQty: 1 })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not treat an empty response as a successful completion', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(createShop1InventoryCommands({ rpc }).completeCutting(input)).rejects.toThrow('Uncertain completion');
  });
  it('preserves the batch key for caller-controlled retries', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cardId], error: null });
    const commands = createShop1InventoryCommands({ rpc });
    await commands.createCards(cardId, 'batch-1', [{}]);
    await commands.createCards(cardId, 'batch-1', [{}]);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
});
