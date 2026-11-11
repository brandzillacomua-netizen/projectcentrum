import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { getPlannedShop1SheetTimings } from '../src/modules/Nomenclature/utils/nomenclatureHelpers'

describe('Nomenclature Shop 1 timing badges (getPlannedShop1SheetTimings)', () => {
  it('ignores stale legacy loadTimings when Shop 1 operation timings are empty', () => {
    const itemWithStaleLoadTimings = {
      id: 'eae279af-4009-4792-a090-123e02e20b9a',
      code: 'V2-90762',
      name: 'Київ К-ІП10-11-П-7-44',
      rule_params: {
        loadTimings: { '2': 480, '4': 270 },
        operation_timings: {},
        tumbling_operation_timings: {},
        reception_operation_timings: {},
        sorting_operation_timings: {}
      }
    }

    expect(getPlannedShop1SheetTimings(itemWithStaleLoadTimings)).toEqual([])
    expect(getPlannedShop1SheetTimings({ rule_params: { loadTimings: { 2: 480, 4: 270 } } })).toEqual([])
    expect(getPlannedShop1SheetTimings(null)).toEqual([])
  })

  it('aggregates CNC, tumbling, reception, and sorting timings per sheet sorted ascending without double-counting machines', () => {
    const item = {
      rule_params: {
        loadTimings: { '2': 480, '4': 270 },
        operation_timings: {
          'CNC KE XIN': {
            'Чорнове фрезерування': { '2': 60, '4': 110 },
            'Фрезерування пазів': { '2': 30, '4': 50 }
          },
          'CNC 4x2': {
            'Чорнове фрезерування': { '2': 50, '8': 200 }
          }
        },
        tumbling_operation_timings: {
          'Галтовка (Вібростіл)': { '2': 15, '4': 20 },
          'Галтовка (Сушка)': { '2': 10 }
        },
        reception_operation_timings: {
          'Прийомка (Перерахунок та пакування)': { '4': 15 }
        },
        sorting_operation_timings: {
          'Сортування (Сортування та перевірка партій)': { '2': 5, '8': 25 }
        }
      }
    }

    expect(getPlannedShop1SheetTimings(item)).toEqual([
      { sheets: 2, minutes: 120 }, // max CNC (90 vs 50) + tumbling 25 + sorting 5
      { sheets: 4, minutes: 195 }, // CNC 160 + tumbling 20 + reception 15
      { sheets: 8, minutes: 225 }  // CNC 200 + sorting 25
    ])
  })

  it('NomenclatureTable renders getPlannedShop1SheetTimings instead of legacy loadTimings', () => {
    const root = process.cwd()
    const tableSrc = fs.readFileSync(path.join(root, 'src/modules/Nomenclature/components/NomenclatureTable.jsx'), 'utf8')
    expect(tableSrc).toContain('getPlannedShop1SheetTimings(item)')
    expect(tableSrc).not.toContain('loadTimings')
  })

  it('NomenclatureTable pagination buttons use surface tokens instead of var(--text-strong)', () => {
    const root = process.cwd()
    const tableSrc = fs.readFileSync(path.join(root, 'src/modules/Nomenclature/components/NomenclatureTable.jsx'), 'utf8')
    expect(tableSrc).toContain('getPageButtonStyle')
    expect(tableSrc).toContain('var(--surface-1, #ffffff)')
    expect(tableSrc).not.toContain('var(--text-strong)')
  })

  it('NomenclatureCardModal persists Shop 1 rule_params to nomenclatures_v2 and removes stale loadTimings', () => {
    const root = process.cwd()
    const modalSrc = fs.readFileSync(path.join(root, 'src/modules/Nomenclature/components/NomenclatureCardModal/index.jsx'), 'utf8')
    expect(modalSrc).toContain('persistShop1RuleParams')
    expect(modalSrc).toContain("supabase.from('nomenclatures_v2').update(payload)")
    expect(modalSrc).toContain('delete nextRuleParams.loadTimings')
  })
})

