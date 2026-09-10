import { describe, expect, it, vi } from 'vitest'
import { deleteInventoryItem } from '../src/services/inventoryDeletion.js'

function mockClient(dependencies, result = { data: [{ id: 'stock' }], error: null }) {
  const remove = vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(async () => result) })) }))
  const client = { from: vi.fn(table => table === 'material_requests'
    ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(async () => dependencies) })) })) })) }
    : { delete: remove }) }
  return { client, remove }
}

describe('Inventory deletion preserves document references', () => {
  it('does not attempt deletion when material requests reference the stock row', async () => {
    const { client, remove } = mockClient({ count: 3, error: null })
    await expect(deleteInventoryItem(client, 'stock')).rejects.toThrow('заявки на матеріали (3)')
    expect(remove).not.toHaveBeenCalled()
  })

  it('stops if the dependency check fails', async () => {
    const { client, remove } = mockClient({ error: { message: 'Offline' } })
    await expect(deleteInventoryItem(client, 'stock')).rejects.toThrow('Не вдалося перевірити')
    expect(remove).not.toHaveBeenCalled()
  })

  it('identifies a completed request that is absent from the picking queue', async () => {
    const { client, remove } = mockClient({ count: 1, data: [
      { id: 'old-request', status: 'completed', details: 'Лист Т300 (7мм)', created_at: '2026-08-10T10:00:00Z' }
    ] })
    await expect(deleteInventoryItem(client, 'stock')).rejects.toThrow('завершено, 2026-08-10\n  Лист Т300 (7мм)\n  ID заявки: old-request')
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes an unreferenced row', async () => {
    const { client, remove } = mockClient({ count: 0, error: null })
    await deleteInventoryItem(client, 'stock')
    expect(remove).toHaveBeenCalledOnce()
  })

  it('explains a database dependency that was not visible during the check', async () => {
    const { client } = mockClient({ count: 0 }, { error: { code: '23503' } })
    await expect(deleteInventoryItem(client, 'stock')).rejects.toThrow('історію обліку збережено')
  })

  it('does not report success when no row was deleted', async () => {
    const { client } = mockClient({ count: 0 }, { data: [] })
    await expect(deleteInventoryItem(client, 'stock')).rejects.toThrow('немає прав')
  })
})
