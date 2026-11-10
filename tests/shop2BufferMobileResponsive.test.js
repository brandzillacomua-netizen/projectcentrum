import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Shop2BufferQueueTable Mobile Responsive & Column Toggle', () => {
  const cssPath = path.resolve(__dirname, '../src/modules/Shop2CardGen/Shop2CardGen.css')
  const tableComponentPath = path.resolve(__dirname, '../src/modules/Shop2CardGen/components/Shop2BufferQueueTable.jsx')
  const moduleComponentPath = path.resolve(__dirname, '../src/modules/Shop2CardGen/Shop2CardGenModule.jsx')

  it('Shop2CardGen.css defines responsive mobile rules and styles', () => {
    const css = fs.readFileSync(cssPath, 'utf8')

    // Media queries
    expect(css).toContain('@media (max-width: 768px)')
    expect(css).toContain('@media (max-width: 420px)')

    // Responsive swapping: hide desktop table, show mobile cards
    expect(css).toContain('.shop2-table-wrapper')
    expect(css).toContain('display: none !important;')
    expect(css).toContain('.shop2-mobile-cards-list')
    expect(css).toContain('display: flex !important;')

    // Mobile card classes
    expect(css).toContain('.shop2-mobile-card')
    expect(css).toContain('.shop2-mobile-card-header')
    expect(css).toContain('.shop2-mobile-part-name')
    expect(css).toContain('.shop2-mobile-avail-badge')
    expect(css).toContain('.shop2-mobile-metrics-grid')
    expect(css).toContain('.shop2-metric-pill')
    expect(css).toContain('.shop2-mobile-launch-btn')

    // Toggle pill
    expect(css).toContain('.shop2-toggle-orders-pill')
  })

  it('Shop2BufferQueueTable imports css and manages showOrdersColumn toggle state', () => {
    const code = fs.readFileSync(tableComponentPath, 'utf8')

    // Imports
    expect(code).toContain("import { useState } from 'react'")
    expect(code).toContain("import '../Shop2CardGen.css'")

    // State definition with localStorage persistence
    expect(code).toContain('const [showOrdersColumn, setShowOrdersColumn] = useState')
    expect(code).toContain("localStorage.getItem('shop2_buffer_show_orders_col')")
    expect(code).toContain("localStorage.setItem('shop2_buffer_show_orders_col'")

    // Toggle control in the filters bar
    expect(code).toContain('shop2-toggle-orders-pill')
    expect(code).toContain('Показувати колонку «Наряди»')
    expect(code).toContain('handleToggleOrdersColumn')
  })

  it('conditionally displays "Наряди у купі" column in desktop tables', () => {
    const code = fs.readFileSync(tableComponentPath, 'utf8')

    // Product Section desktop table
    expect(code).toContain('{showOrdersColumn && <th style={{ padding: \'14px 20px\' }}>Наряди у купі</th>}')
    expect(code).toContain('{showOrdersColumn && (\n                              <td style={{ padding: \'14px 20px\' }}>')

    // Flat view desktop table
    expect(code).toContain('{showOrdersColumn && <th style={{ padding: \'16px 20px\' }}>Наряди у купі</th>}')
    expect(code).toContain('{showOrdersColumn && (\n                          <td style={{ padding: \'16px 20px\' }}>')
    expect(code).toContain('colSpan={showOrdersColumn ? 12 : 11}')
  })

  it('implements renderMobileCards with touch-friendly layout and full-width launch button', () => {
    const code = fs.readFileSync(tableComponentPath, 'utf8')

    expect(code).toContain('const renderMobileCards = (rowsList) =>')
    expect(code).toContain('className="shop2-mobile-cards-list"')
    expect(code).toContain('className="shop2-mobile-card"')
    expect(code).toContain('className="shop2-mobile-part-name"')
    expect(code).toContain('className={`shop2-mobile-avail-badge')
    expect(code).toContain('className="shop2-mobile-metrics-grid"')
    expect(code).toContain('className="shop2-metric-pill total"')
    expect(code).toContain('className={`shop2-mobile-launch-btn')
    expect(code).toContain('Створити РК')

    // Mobile orders conditional display
    expect(code).toContain('showOrdersColumn && row.ordersList && row.ordersList.length > 0')

    // Rendered in both product and flat views
    expect(code).toContain('{renderMobileCards(sec.rows)}')
    expect(code).toContain('{rows.length > 0 && renderMobileCards(rows)}')
  })

  it('Shop2CardGenModule uses responsive container classes and imports css', () => {
    const moduleCode = fs.readFileSync(moduleComponentPath, 'utf8')

    expect(moduleCode).toContain("import './Shop2CardGen.css'")
    expect(moduleCode).toContain('className="shop2-cardgen-container"')
    expect(moduleCode).toContain('className="shop2-topbar"')
    expect(moduleCode).toContain('className="shop2-stats-grid"')
    expect(moduleCode).toContain('className="shop2-stat-card"')
    expect(moduleCode).toContain('className="shop2-tabs-bar"')
  })
})
