import { describe, it, expect } from 'vitest'
import { detectCutterDiameter, extractCuttersByDiameter } from '../src/modules/Shop1/utils/shop1Helpers.js'

describe('detectCutterDiameter & extractCuttersByDiameter', () => {
  it('detects diameter from diverse cutter naming formats', () => {
    expect(detectCutterDiameter('Фреза кукурудзка 2х8х38')).toBe('2мм')
    expect(detectCutterDiameter('Фреза 1.5х6х38')).toBe('1,5мм')
    expect(detectCutterDiameter('1,5х6х38')).toBe('1,5мм')
    expect(detectCutterDiameter('Фреза кінцева 3х12х38')).toBe('3мм')
    expect(detectCutterDiameter('Фреза 4х15')).toBe('4мм')
    expect(detectCutterDiameter('6х22')).toBe('6мм')
    expect(detectCutterDiameter('Фреза Ф2мм')).toBe('2мм')
    expect(detectCutterDiameter('Ф3')).toBe('3мм')
    expect(detectCutterDiameter('2мм')).toBe('2мм')
    expect(detectCutterDiameter('1,5мм')).toBe('1,5мм')
  })

  it('aggregates breakdown by standard diameters', () => {
    const rawBreakdown = {
      'Фреза кукурудзка 2х8х38': 10,
      'Фреза кінцева 3х12х38': 4,
      '1,5мм': 2
    }
    const res = extractCuttersByDiameter(rawBreakdown)
    expect(res['2мм']).toBe(10)
    expect(res['3мм']).toBe(4)
    expect(res['1,5мм']).toBe(2)
    expect(res['4мм']).toBe(0)
    expect(res['6мм']).toBe(0)
    expect(res.total).toBe(16)
    expect(res.hasData).toBe(true)
  })

  it('parses directly from card_info string', () => {
    const cardInfo = 'Наряд №261022-2 [CUTTERS_BREAKDOWN:{"Фреза кукурудзка 2х8х38":10,"3мм":4}] [QC_OPS:{}]'
    const res = extractCuttersByDiameter(cardInfo)
    expect(res['2мм']).toBe(10)
    expect(res['3мм']).toBe(4)
    expect(res.total).toBe(14)
  })
})

