import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { WarehouseTransferRequestModal } from '../src/modules/Warehouse/components/modals/WarehouseTransferRequestModal.jsx'

describe('WarehouseTransferRequestModal', () => {
  const sampleNomenclatures = [
    { id: 'nom-1', name: 'Фреза конічна R0.5', code: 'FR-05', unit: 'шт', category: 'cutter' },
    { id: 'nom-2', name: 'Фреза спіральна D6', code: 'FR-6', unit: 'шт', category: 'cutter' },
    { id: 'nom-3', name: 'МДФ 16мм Шліфований', code: 'MDF-16', unit: 'м2', category: 'sheet' }
  ]

  const sampleInventory = [
    {
      id: 'inv-sv-1',
      nomenclature_id: 'nom-1',
      name: 'Фреза конічна R0.5',
      warehouse: 'production',
      total_qty: 10,
      reserved_qty: 2,
      unit: 'шт'
    },
    {
      id: 'inv-so-1',
      nomenclature_id: 'nom-1',
      name: 'Фреза конічна R0.5',
      warehouse: 'operational',
      total_qty: 3,
      reserved_qty: 0,
      unit: 'шт'
    },
    {
      id: 'inv-sv-2',
      nomenclature_id: 'nom-2',
      name: 'Фреза спіральна D6',
      warehouse: 'production',
      total_qty: 5,
      reserved_qty: 0,
      unit: 'шт'
    }
  ]

  it('renders nothing when show is false', () => {
    const html = renderToString(
      React.createElement(WarehouseTransferRequestModal, {
        show: false,
        onClose: () => {},
        inventory: sampleInventory,
        nomenclatures: sampleNomenclatures
      })
    )
    expect(html).toBe('')
  })

  it('renders modal header, cutter list, and stock balances on SV and SO when show is true', () => {
    const html = renderToString(
      React.createElement(WarehouseTransferRequestModal, {
        show: true,
        onClose: () => {},
        inventory: sampleInventory,
        nomenclatures: sampleNomenclatures
      })
    )

    expect(html).toContain('ЗАПИТ НА ПЕРЕМІЩЕННЯ (СВ → СО)')
    expect(html).toContain('Фреза конічна R0.5')
    expect(html).toContain('Фреза спіральна D6')
    // Check СВ balance: total 10 - reserved 2 = 8 available
    expect(html).toMatch(/8\s*<!--.*?-->\s*шт|8\s*шт/)
    // Check СО balance: 3 шт
    expect(html).toMatch(/3\s*<!--.*?-->\s*шт|3\s*шт/)
    expect(html).toContain('НАДІСЛАТИ ЗАПИТ НА СВ')
  })

  it('filters cutters tab appropriately', () => {
    const html = renderToString(
      React.createElement(WarehouseTransferRequestModal, {
        show: true,
        onClose: () => {},
        inventory: sampleInventory,
        nomenclatures: sampleNomenclatures
      })
    )

    // The default active tab is 'cutters', so sheet MDF should not be in the cutter tab view by default
    expect(html).toContain('Фреза конічна R0.5')
    expect(html).not.toContain('МДФ 16мм Шліфований')
  })

  it('renders red cancel button and green submit action button', () => {
    const html = renderToString(
      React.createElement(WarehouseTransferRequestModal, {
        show: true,
        onClose: () => {},
        inventory: sampleInventory,
        nomenclatures: sampleNomenclatures
      })
    )

    expect(html).toContain('СКАСУВАТИ')
    expect(html).toContain('НАДІСЛАТИ ЗАПИТ НА СВ')
    // Red styling for cancel
    expect(html).toMatch(/color:\s*(?:#dc2626|#f87171|rgb\(220,\s*38,\s*38\)|rgb\(248,\s*113,\s*113\))/)
    // Green styling for header badge
    expect(html).toContain('#10b981')
  })
})
