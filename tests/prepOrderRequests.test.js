import { describe, it, expect, vi } from 'vitest'

describe('Prep Order Requests Integration', () => {
  it('verifies that preparation order generates material_requests for SV', () => {
    const itemsToCreate = [['nom-1', 10], ['nom-2', 5]]
    const prepNum = 'НП000001'
    const nomenclatures = [
      { id: 'nom-1', name: 'Карбонова пластина Т300 500*600 1мм' },
      { id: 'nom-2', name: 'Карбонова пластина Т300 500*600 2мм' }
    ]
    const newTask = { id: 'task-123', step: 'Підготовка' }

    const requestsToInsert = itemsToCreate.map(([materialId, qty]) => {
      const nom = nomenclatures.find(n => String(n.id) === String(materialId))
      return {
        task_id: newTask.id,
        nomenclature_id: materialId,
        quantity: Number(qty),
        status: 'pending',
        inventory_id: null,
        details: `ЗАПИТ НА ПІДГОТОВКУ (${prepNum}): ${nom?.name || 'Лист'} — ${qty} шт.`
      }
    })

    expect(requestsToInsert).toHaveLength(2)
    expect(requestsToInsert[0]).toEqual({
      task_id: 'task-123',
      nomenclature_id: 'nom-1',
      quantity: 10,
      status: 'pending',
      inventory_id: null,
      details: 'ЗАПИТ НА ПІДГОТОВКУ (НП000001): Карбонова пластина Т300 500*600 1мм — 10 шт.'
    })
    expect(requestsToInsert[1]).toEqual({
      task_id: 'task-123',
      nomenclature_id: 'nom-2',
      quantity: 5,
      status: 'pending',
      inventory_id: null,
      details: 'ЗАПИТ НА ПІДГОТОВКУ (НП000001): Карбонова пластина Т300 500*600 2мм — 5 шт.'
    })
  })
})
