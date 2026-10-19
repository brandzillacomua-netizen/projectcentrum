import { describe, expect, it } from 'vitest'
import { buildScrapDetailGroups, buildUtilDetailGroups } from '../src/modules/Foreman/utils/scrapDetailReport.js'

describe('naryad scrap detail grouping', () => {
  const nomenclatures = [
    { id: 'part-a', name: 'Деталь А', nomenclature_code: 'A-01' },
    { id: 'part-b', name: 'Деталь Б', nomenclature_code: 'B-02' }
  ]
  const cards = [
    { id: 'card-1', nomenclature_id: 'part-a', card_info: 'Завантаження 1/4' },
    { id: 'card-2', nomenclature_id: 'part-a', card_info: 'Завантаження 2/4' }
  ]

  it('shows one position total with the cards that formed it', () => {
    const groups = buildScrapDetailGroups({
      cards,
      nomenclatures,
      rows: [
        { id: 'h1', card_id: 'card-1', nomenclature_id: 'part-a', scrap_qty: 7, stage_name: 'Розкрій' },
        { id: 'h1b', card_id: 'card-1', nomenclature_id: 'part-a', scrap_qty: 2, stage_name: 'Сортування' },
        { id: 'h2', card_id: 'card-2', nomenclature_id: 'part-a', scrap_qty: 5, stage_name: 'Сортування' },
        { id: 'h3', card_id: 'card-x', nomenclature_id: 'part-b', scrap_qty: 3, stage_name: 'Прийомка' }
      ]
    })

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ name: 'Деталь А', qty: 14 })
    expect(groups[0].entries.map(entry => entry.cardLabel)).toEqual(['Картка 1/4', 'Картка 2/4'])
    expect(groups[0].entries[0]).toMatchObject({ qty: 9, stage: 'Розкрій, Сортування' })
  })

  it('traces category 4 util back to its exact cards and part', () => {
    const groups = buildUtilDetailGroups({
      cards,
      nomenclatures,
      historyRows: [
        { card_id: 'card-1', scrap_qty: 10, stage_name: 'Сортування', operator_name: 'Оператор 1' },
        { card_id: 'card-2', scrap_qty: 6, stage_name: 'Прийомка', operator_name: 'Оператор 2' }
      ],
      finalScrapRows: [
        { card_id: 'card-1', nomenclature_id: 'part-a', total_scrap: 3 },
        { card_id: 'card-2', nomenclature_id: 'part-a', total_scrap: 5 }
      ]
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].qty).toBe(8)
    expect(groups[0].entries).toHaveLength(2)
    expect(groups[0].entries[0]).toMatchObject({ cardLabel: 'Картка 2/4', qty: 5, operator: 'Оператор 2' })
  })

  it('reads legacy category 4 markers and keeps an honest unallocated remainder', () => {
    const groups = buildUtilDetailGroups({
      cards,
      nomenclatures,
      expectedTotal: 8,
      historyRows: [
        { id: 'legacy-1', card_id: 'card-1', nomenclature_id: 'part-a', scrap_qty: 5, qc_scrap_comment: '[SCRAP_CAT:{"cat1":2,"cat4":3}]' }
      ]
    })

    expect(groups.reduce((sum, group) => sum + group.qty, 0)).toBe(8)
    expect(groups.find(group => group.nomenclatureId === 'part-a')).toMatchObject({ qty: 3 })
    expect(groups.find(group => group.id === 'legacy-unallocated-util')).toMatchObject({ qty: 5 })
  })

  it('never expands util details beyond the util total shown in the report', () => {
    const groups = buildUtilDetailGroups({
      cards,
      nomenclatures,
      expectedTotal: 8,
      finalScrapRows: [
        { card_id: 'card-1', nomenclature_id: 'part-a', total_scrap: 8 },
        { card_id: 'card-2', nomenclature_id: 'part-a', total_scrap: 1026 }
      ]
    })

    expect(groups.reduce((sum, group) => sum + group.qty, 0)).toBe(8)
    expect(groups).toHaveLength(1)
    expect(groups[0].entries).toHaveLength(1)
    expect(groups[0].entries[0]).toMatchObject({ cardLabel: 'Картка 1/4', qty: 8 })
  })
})
