import { describe, it, expect } from 'vitest'
import { createProductionCardsActions } from '../src/contexts/production/productionCards.js'

describe('confirmBuffer Execution & FSM Validation', () => {
  const mockCard = {
    id: 'card-test-vitest',
    nomenclature_id: 'nom-test-part',
    status: 'waiting-buffer',
    operation: 'Розкрій',
    quantity: 10,
    machine_id: 'mach-1',
    machine: 'KE XIN',
    card_info: '[SHOP:1]'
  }

  it('rejects invalid scrap quantities greater than card quantity', async () => {
    const actions = createProductionCardsActions({
      workCards: [mockCard],
      nomenclatures: [],
      inventory: [],
      machines: [],
      setWorkCards: () => {},
      refreshTable: () => Promise.resolve()
    })

    await expect(actions.confirmBuffer('card-test-vitest', 15)).rejects.toThrow(
      'Кількість браку (15) перевищує кількість у картці (10).'
    )
  })

  it('rejects negative or non-finite scrap quantities', async () => {
    const actions = createProductionCardsActions({
      workCards: [mockCard],
      nomenclatures: [],
      inventory: [],
      machines: [],
      setWorkCards: () => {},
      refreshTable: () => Promise.resolve()
    })

    await expect(actions.confirmBuffer('card-test-vitest', -2)).rejects.toThrow(
      'Вказано некоректну кількість браку.'
    )
  })
})
