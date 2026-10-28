import { describe, expect, it } from 'vitest'
import { isHardware, isFinishedStockRow, isSemiStockRow, normalizeKey } from '../src/modules/WarehouseFGP/warehouseFgpInventory.js'
import { getAvailableSGPStock } from '../src/modules/Nomenclature/utils/nomenclatureHelpers.js'

describe('warehouse FGP inventory identity', () => {
  it('normalizes whitespace, separators and Cyrillic/Latin homoglyphs', () => {
    expect(normalizeKey('  АВЕ-КМ НОРСТХ  ')).toBe('abe-km-hopctx')
    expect(normalizeKey('A_B  C')).toBe('a-b-c')
    expect(normalizeKey(null)).toBe('')
  })

  it.each(['hardware', 'fastener', 'mount'])('recognizes the %s inventory type', type => {
    expect(isHardware({ type, name: 'Компонент' })).toBe(true)
  })

  it.each([
    'Гвинт М4', 'Гайка', 'Болт', 'Шайба', 'Стійка', 'Накладка', 'Тримач',
    'Метиз', 'Кріплення', 'Саморіз', 'Втулка', 'Фіксатор'
  ])('recognizes hardware by name: %s', name => {
    expect(isHardware({ type: 'finished', name })).toBe(true)
  })

  it('does not classify an ordinary finished product as hardware', () => {
    expect(isHardware({ type: 'finished', name: 'Табличка готова' })).toBe(false)
  })

  it.each(['finished', 'product', 'part', 'bz', 'bz_shop2', 'wip_bz'])(
    'classifies ready inventory type %s as finished stock',
    type => {
      expect(isFinishedStockRow({ type, name: 'Деталь карбонова' })).toBe(true)
      expect(isSemiStockRow({ type, name: 'Деталь карбонова' })).toBe(false)
    }
  )

  it.each(['semi', 'semi_shop1', 'semi_shop2'])(
    'classifies intermediate type %s as semi stock',
    type => {
      expect(isSemiStockRow({ type, name: 'Заготовка' })).toBe(true)
      expect(isFinishedStockRow({ type, name: 'Заготовка' })).toBe(false)
    }
  )
})

describe('getAvailableSGPStock', () => {
  it('correctly aggregates finished, bz, and wip_bz available stock for naryad planning', () => {
    const partNom = {
      id: 'nom-90755',
      name: 'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39'
    }
    const inventory = [
      {
        nomenclature_id: 'nom-90755',
        name: 'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39',
        type: 'finished',
        warehouse: 'sgp',
        total_qty: 1852,
        reserved_qty: 0,
        pocket_owner: null
      },
      {
        nomenclature_id: 'nom-90755',
        name: 'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39',
        type: 'bz',
        warehouse: 'operational',
        total_qty: 10000,
        reserved_qty: 2700,
        pocket_owner: null
      },
      {
        nomenclature_id: 'nom-90755',
        name: 'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39',
        type: 'wip_bz',
        warehouse: 'operational',
        total_qty: 12700,
        reserved_qty: 10000,
        pocket_owner: null
      }
    ]

    expect(getAvailableSGPStock(partNom, inventory)).toBe(11852)
  })

  it('excludes pocket_owner items from generic available SGP stock', () => {
    const partNom = { id: 'nom-1', name: 'Деталь 1' }
    const inventory = [
      { nomenclature_id: 'nom-1', name: 'Деталь 1', type: 'finished', total_qty: 100, reserved_qty: 0, pocket_owner: 'Замовник А' },
      { nomenclature_id: 'nom-1', name: 'Деталь 1', type: 'finished', total_qty: 50, reserved_qty: 0, pocket_owner: null }
    ]
    expect(getAvailableSGPStock(partNom, inventory)).toBe(50)
  })
})

