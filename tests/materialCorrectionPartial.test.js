import { describe, it, expect } from 'vitest'
import {
  analyzePartCardsForCorrection,
  findMatchingOldRequests,
  isSheetMaterial,
  getOperationalStockForNom
} from '../src/modules/Foreman2/features/material-correction/useMaterialCorrection.js'
import { getKittingSheetsForPart } from '../src/modules/Foreman2/features/card-generation/kittingAvailability.js'
import { getPendingRequestsForCard } from '../src/utils/materialCardMatching.js'

describe('Partial Material Correction with Active + New Cards', () => {
  it('separates safe new cards for deletion, preserves active sheets, and calculates remaining sheets', () => {
    const part = {
      nomId: 'part-1',
      name: 'Київ К-ІП9/10-Х-3-39',
      unitsPerSheet: 39,
      plannedSheets: 698,
      productionCards: [
        { id: 'c1', status: 'in-progress', quantity: 39 * 40, sheets: 40 },
        { id: 'c2', status: 'completed', quantity: 39 * 12, sheets: 12 },
        { id: 'c3', status: 'new', quantity: 39 * 8, sheets: 8 }
      ]
    }

    const analysis = analyzePartCardsForCorrection(part)
    expect(analysis.safeNewCards.map(c => c.id)).toEqual(['c3'])
    expect(analysis.activeLockedCards.map(c => c.id)).toEqual(['c1', 'c2'])
    expect(analysis.usedSheets).toBe(52)
    expect(analysis.remainingSheets).toBe(646)
  })

  it('matches old material requests even when oldEntry.nomenclature_id is null or uses V1/V2 legacy_ids', () => {
    const requests = [
      {
        id: 'r1',
        status: 'pending',
        nomenclature_id: null,
        details: 'СКЛАД ОПЕРАТИВНИЙ: Лист T300 (3мм) — 984 л. (Для: Київ К-ІП9: 30000шт)'
      },
      {
        id: 'r2',
        status: 'pending',
        nomenclature_id: 'v1-t300-7',
        details: 'СКЛАД ОПЕРАТИВНИЙ: Лист Т300 (7мм) — 1256 л.'
      },
      {
        id: 'r3',
        card_id: 'c1',
        status: 'pending',
        nomenclature_id: null,
        details: 'СКЛАД ОПЕРАТИВНИЙ: Лист Т300 (3мм) — 10 л.'
      }
    ]

    const matchedByName = findMatchingOldRequests({
      requests,
      oldEntry: { matName: 'Лист Т300 (3мм)', nomenclature_id: null },
      oldKey: 'virtual-Т300-3мм',
      oldMaterial: 'Лист Т300 (3мм)',
      nomenclatures: []
    })
    expect(matchedByName.map(r => r.id)).toEqual(['r1'])

    const matchedByLegacy = findMatchingOldRequests({
      requests,
      oldEntry: { matName: 'Лист Т300 (7мм)', nomenclature_id: 'v2-t300-7' },
      oldKey: 'v2-t300-7-Т300',
      oldMaterial: 'Лист Т300 (7мм)',
      nomenclatures: [{ id: 'v2-t300-7', name: 'Лист Т300 (7мм)', legacy_ids: ['v1-t300-7'] }]
    })
    expect(matchedByLegacy.map(r => r.id)).toEqual(['r2'])
  })

  it('detects sheet nomenclatures and computes available operational warehouse (СО) stock', () => {
    const t700 = { id: 'nom-t700', name: 'Лист Т700 (3мм)', type: 'raw', legacy_ids: ['v1-t700'] }
    const unprepared = { id: 'nom-raw', name: 'Лист Т700 (3мм) [непідготовлений]', type: 'raw' }
    const part = { id: 'nom-part', name: 'Лист Т700 деталь', type: 'part' }

    expect(isSheetMaterial(t700)).toBe(true)
    expect(isSheetMaterial(unprepared)).toBe(false)
    expect(isSheetMaterial(part)).toBe(false)

    const inventory = [
      { id: 'inv-so-1', nomenclature_id: 'nom-t700', warehouse: 'operational', total_qty: 800, reserved_qty: 120 },
      { id: 'inv-so-2', nomenclature_id: 'v1-t700', warehouse: 'operational', total_qty: 50, reserved_qty: 10 },
      { id: 'inv-other', nomenclature_id: 'nom-t700', warehouse: 'raw', total_qty: 9999, reserved_qty: 0 }
    ]

    const stock = getOperationalStockForNom(t700, inventory)
    expect(stock.inventory_id).toBe('inv-so-1')
    expect(stock.available).toBe(720)
  })

  it('orders pending requests before issued requests so already-issued sheets for active cards remain issued', () => {
    const requests = [
      { id: 'req-issued', status: 'issued', nomenclature_id: 't300-3', quantity: 2476 },
      { id: 'req-pending', status: 'pending', nomenclature_id: 't300-3', quantity: 984 }
    ]
    const matched = findMatchingOldRequests({
      requests,
      oldEntry: { nomenclature_id: 't300-3', matName: 'Лист Т300 (3мм)' },
      oldKey: 't300-3',
      oldMaterial: 'Лист Т300 (3мм)',
      nomenclatures: []
    })
    expect(matched.map(r => r.id)).toEqual(['req-pending', 'req-issued'])
  })

  it('blocks generation (waiting for СО) when material was corrected and 0 sheets of new material are issued', () => {
    const task = { id: 't1', order_id: 'o1', warehouse_conf: 'partial', plan_snapshot: {} }
    const part = {
      nomId: 'p1',
      name: 'Київ К-ІП9-Х-3-39',
      material: 'Лист Т700 (3мм)',
      unitsPerSheet: 39,
      productionCards: [{ id: 'c1', status: 'in-progress', quantity: 39 * 52, sheets: 52 }]
    }
    const nomenclatures = [
      { id: 'p1', name: 'Київ К-ІП9-Х-3-39', units_per_sheet: 39 },
      { id: 't700-3', name: 'Лист Т700 (3мм)', type: 'raw' },
      { id: 't300-3', name: 'Лист Т300 (3мм)', type: 'raw' }
    ]
    const materialRequests = [
      { id: 'r-old', task_id: 't1', nomenclature_id: 't300-3', status: 'issued', quantity: 52, details: 'Лист Т300 (3мм)' },
      { id: 'r-new', task_id: 't1', nomenclature_id: 't700-3', status: 'pending', quantity: 646, details: 'ВИПРАВЛЕНО В НАРЯДІ: Лист Т300 (3мм) → Лист Т700 (3мм) — 646 л.' }
    ]

    const res = getKittingSheetsForPart({ task, part, materialRequests, nomenclatures, workCards: part.productionCards })
    expect(res.issuedSheets).toBe(0)
    expect(res.pendingSheets).toBe(646)
    expect(res.poolIssuedRemaining).toBe(0)
    expect(res.hasSheetReqs).toBe(true)

    // Once СО issues the 646 sheets, generation is unlocked
    const afterIssue = getKittingSheetsForPart({
      task,
      part,
      materialRequests: [
        materialRequests[0],
        { ...materialRequests[1], status: 'issued' }
      ],
      nomenclatures,
      workCards: part.productionCards
    })
    expect(afterIssue.issuedSheets).toBe(646)
    expect(afterIssue.pendingSheets).toBe(0)
    expect(afterIssue.poolIssuedRemaining).toBeGreaterThan(0)
  })

  it('does not block pre-existing cards on old material when a MATERIAL_CORRECTION request is pending', () => {
    const card = {
      id: 'card-old-t300',
      task_id: 't1',
      nomenclature_id: 'part-7',
      created_at: '2026-11-12T10:00:00Z'
    }
    const req = {
      id: 'req-corr-t700',
      task_id: 't1',
      nomenclature_id: 't700-7',
      status: 'pending',
      created_at: '2026-11-12T12:00:00Z',
      details: 'ВИПРАВЛЕНО В НАРЯДІ: Лист Т300 (7мм) → Лист Т700 (7мм) — 2605 л. [MATERIAL_CORRECTION:part-7]'
    }
    const task = {
      id: 't1',
      plan_snapshot: {
        materialSummary: {
          't700-7': {
            nomenclature_id: 't700-7',
            matName: 'Лист Т700 (7мм)',
            components: ['Київ К-ІП9-10-П-7-46: залишок 2605 л.']
          }
        }
      }
    }
    const nomenclatures = [{ id: 'part-7', name: 'Київ К-ІП9-10-П-7-46' }]

    expect(getPendingRequestsForCard(card, [req], task, nomenclatures)).toEqual([])
  })
})

