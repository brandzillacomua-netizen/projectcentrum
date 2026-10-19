import { describe, expect, it } from 'vitest'
import {
  buildRequestedCuttersBreakdown,
  isConcreteCutterName,
  resolveActualCutterToRequested
} from '../src/modules/Foreman/utils/cutterReport.js'

describe('cutter report source of truth', () => {
  const inventory = [
    { id: 'stock-f2', nomenclature_id: 'nom-f2', name: 'Фреза кукурудза 2х3,175х10,5х38' },
    { id: 'stock-f3', nomenclature_id: 'nom-f3' }
  ]
  const nomenclatures = [
    { id: 'nom-f2', name: 'Фреза кукурудза 2х3,175х10,5х38' },
    { id: 'nom-f3', name: 'Фреза кукурудза 3х3,175х12х38' }
  ]

  it('rejects virtual cutter types from the report', () => {
    expect(isConcreteCutterName('Фреза Ф2')).toBe(false)
    expect(isConcreteCutterName('Фреза ф6 (90)')).toBe(false)
    expect(isConcreteCutterName('Тип Ф3')).toBe(false)
    expect(isConcreteCutterName('Фреза кукурудза 2х3,175х10,5х38')).toBe(true)
  })

  it('builds plan only from requested physical inventory rows and preserves declared quantity', () => {
    const result = buildRequestedCuttersBreakdown([
      { id: 1, inventory_id: 'stock-f2', status: 'completed', quantity: 0, details: 'Заявка для наряду 261015-1: Фреза кукурудза 2х3,175х10,5х38 — 1497 од. (картка 4/74)' },
      { id: 2, inventory_id: 'stock-f3', status: 'issued', quantity: 1305, details: 'Фреза кукурудза 3х3,175х12х38 — 1305 шт' },
      { id: 3, nomenclature: { name: 'Фреза Ф6 (90)' }, status: 'issued', quantity: 24 },
      { id: 4, inventory_id: 'stock-f2', status: 'cancelled', quantity: 99 }
    ], inventory, nomenclatures)

    expect(result).toEqual({
      'Фреза кукурудза 2х3,175х10,5х38': 1497,
      'Фреза кукурудза 3х3,175х12х38': 1305
    })
  })

  it('maps legacy generic facts to the single requested physical cutter of that diameter', () => {
    const requested = nomenclatures.map(item => item.name)
    expect(resolveActualCutterToRequested('Фреза Ф2', requested)).toBe(nomenclatures[0].name)
    expect(resolveActualCutterToRequested('Фреза Ф3', requested)).toBe(nomenclatures[1].name)
  })

  it('does not guess when two requested physical cutters have the same diameter', () => {
    expect(resolveActualCutterToRequested('Фреза Ф2', [
      'Фреза кукурудза 2х3,175х10,5х38',
      'Фреза кукурудза 2х3,175х16х50'
    ])).toBeNull()
  })
})
