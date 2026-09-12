import { describe, expect, it } from 'vitest'
import { isHardware, normalizeKey } from '../src/modules/WarehouseFGP/warehouseFgpInventory.js'

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
})
