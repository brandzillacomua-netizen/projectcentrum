import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Packaging Module Mobile Responsive & Natural Scrolling', () => {
  const cssPath = path.resolve(__dirname, '../src/modules/Packaging/PackagingResponsive.css')
  const modulePath = path.resolve(__dirname, '../src/modules/PackagingModule.tsx')
  const journalPath = path.resolve(__dirname, '../src/modules/Packaging/components/Packaging1CJournal.jsx')
  const docViewPath = path.resolve(__dirname, '../src/modules/Packaging/components/Packaging1CDocumentView.jsx')
  const bomListPath = path.resolve(__dirname, '../src/modules/Packaging/components/PackagingBomList.jsx')

  it('PackagingResponsive.css defines mobile rules for natural scrolling and 2x2 compact KPI grid', () => {
    const css = fs.readFileSync(cssPath, 'utf8')

    expect(css).toContain('@media (max-width: 768px)')

    // Container unlocks fixed 100vh height on mobile
    expect(css).toContain('.packaging-container-outer')
    expect(css).toContain('height: auto !important;')

    // Journal card unlocks fixed height on mobile
    expect(css).toContain('.packaging-journal-card')
    expect(css).toContain('overflow: visible !important;')

    // KPI grid transforms into compact 2x2 grid instead of 320px 1-column stack
    expect(css).toContain('.packaging-kpi-grid')
    expect(css).toContain('grid-template-columns: 1fr 1fr !important;')

    // Table hides on mobile, replaced by mobile cards
    expect(css).toContain('.packaging-table-container')
    expect(css).toContain('display: none !important;')
    expect(css).toContain('.packaging-mobile-orders-list')
    expect(css).toContain('display: flex !important;')

    // Document view unlocks fixed height on mobile so entire page scrolls naturally
    expect(css).toContain('.packaging-doc-container')
    expect(css).toContain('.packaging-doc-header')
    expect(css).toContain('.packaging-doc-body')
    expect(css).toContain('overflow: visible !important;')

    // Sticky commands on mobile
    expect(css).toContain('.packaging-doc-commands')
    expect(css).toContain('position: sticky !important;')
  })

  it('PackagingModule.tsx imports responsive css and uses packaging-container-outer', () => {
    const code = fs.readFileSync(modulePath, 'utf8')

    expect(code).toContain("import './Packaging/PackagingResponsive.css'")
    expect(code).toContain('className="packaging-container-outer"')
  })

  it('Packaging1CJournal.jsx implements mobile order cards and responsive classes', () => {
    const code = fs.readFileSync(journalPath, 'utf8')

    expect(code).toContain("import '../PackagingResponsive.css'")
    expect(code).toContain('className="packaging-journal-card"')
    expect(code).toContain('className="packaging-journal-header"')
    expect(code).toContain('className="packaging-kpi-grid"')
    expect(code).toContain('className="packaging-kpi-tile"')
    expect(code).toContain('className="packaging-table-container"')
    expect(code).toContain('className="packaging-desktop-table"')

    // Mobile cards list
    expect(code).toContain('className="packaging-mobile-orders-list"')
    expect(code).toContain('className="packaging-mobile-order-card"')
    expect(code).toContain('className="packaging-card-order-num"')
    expect(code).toContain('className="packaging-card-metrics-grid"')
    expect(code).toContain('className="packaging-card-open-btn"')
    expect(code).toContain('Відкрити наряд на пакування')
  })

  it('Packaging1CDocumentView.jsx has responsive container, header and body classes', () => {
    const code = fs.readFileSync(docViewPath, 'utf8')

    expect(code).toContain("import '../PackagingResponsive.css'")
    expect(code).toContain('className="packaging-doc-container"')
    expect(code).toContain('className="packaging-doc-commands"')
    expect(code).toContain('className="packaging-doc-header"')
    expect(code).toContain('className="packaging-doc-body"')
    expect(code).toContain('className="packaging-doc-footer"')
  })

  it('PackagingBomList.jsx wraps table in horizontal scroll wrapper with min-width', () => {
    const code = fs.readFileSync(bomListPath, 'utf8')

    expect(code).toContain("import '../PackagingResponsive.css'")
    expect(code).toContain('className="packaging-bom-table-wrapper"')
    expect(code).toContain("minWidth: '700px'")
  })
})

