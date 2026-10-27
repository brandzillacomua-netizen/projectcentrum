import { describe, expect, it } from 'vitest'
import { isHardware, isFinishedStockRow, isSemiStockRow, normalizeKey } from '../src/modules/WarehouseFGP/warehouseFgpInventory.js'

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

