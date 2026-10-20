import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Printer,
  CheckSquare,
  Square,
  Search,
  LayoutGrid,
  Eye,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Scissors,
  FileText
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const LAYOUT_OPTIONS = [
  {
    id: '6_per_page',
    label: '6 на аркуш (2 × 3)',
    badge: 'Оптимально',
    perPage: 6,
    cols: 2,
    rows: 3,
    cardWidthMm: 92,
    cardHeightMm: 84,
    qrSize: 52,
    description: 'Збалансований розмір: чіткий QR 52мм, зручно читати з 0.5м'
  },
  {
    id: '8_per_page',
    label: '8 на аркуш (2 × 4)',
    badge: 'Компактно',
    perPage: 8,
    cols: 2,
    rows: 4,
    cardWidthMm: 92,
    cardHeightMm: 62,
    qrSize: 42,
    description: 'Максимальна економія паперу (61 верстат = лише 8 аркушів)'
  },
  {
    id: '4_per_page',
    label: '4 на аркуш (2 × 2)',
    badge: 'Великий',
    perPage: 4,
    cols: 2,
    rows: 2,
    cardWidthMm: 92,
    cardHeightMm: 126,
    qrSize: 68,
    description: 'Збільшений розмір для монтажу на каркас або стіну'
  },
  {
    id: '1_per_page',
    label: '1 на аркуш (1 × 1)',
    badge: 'Плакат',
    perPage: 1,
    cols: 1,
    rows: 1,
    cardWidthMm: 184,
    cardHeightMm: 255,
    qrSize: 140,
    description: 'Великий плакат на повний лист А4'
  }
]

export function MachinesBatchQrPrintModal({
  isOpen,
  onClose,
  machines = [],
  initialSelectedId = null
}) {
  const [selectedIds, setSelectedIds] = useState(() => {
    if (initialSelectedId) {
      return new Set([initialSelectedId])
    }
    // By default select all machines
    return new Set(machines.map(m => m.id))
  })

  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [layoutId, setLayoutId] = useState('6_per_page')
  const [borderStyle, setBorderStyle] = useState('dashed') // 'dashed' | 'solid'
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'selection'

  // When initialSelectedId changes, update selection if modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialSelectedId) {
        setSelectedIds(new Set([initialSelectedId]))
        setActiveTab('preview')
      } else if (selectedIds.size === 0 && machines.length > 0) {
        setSelectedIds(new Set(machines.map(m => m.id)))
      }
    }
  }, [isOpen, initialSelectedId, machines])

  // Unique machine types for filtering
  const machineTypes = useMemo(() => {
    const types = new Set()
    machines.forEach(m => {
      if (m.type) types.add(m.type)
    })
    return Array.from(types).sort()
  }, [machines])

  // Filtered machines for selection table
  const filteredMachines = useMemo(() => {
    return machines.filter(m => {
      if (selectedTypeFilter !== 'ALL' && m.type !== selectedTypeFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = String(m.name || '').toLowerCase().includes(q)
        const matchSeq = String(m.sequence_number || '').toLowerCase().includes(q)
        const matchType = String(m.type || '').toLowerCase().includes(q)
        const matchInv = String(m.inventory_no || '').toLowerCase().includes(q)
        if (!matchName && !matchSeq && !matchType && !matchInv) return false
      }
      return true
    })
  }, [machines, selectedTypeFilter, searchQuery])

  // Ordered list of machines that are selected to print
  const machinesToPrint = useMemo(() => {
    return machines.filter(m => selectedIds.has(m.id))
  }, [machines, selectedIds])

  const currentLayout = useMemo(() => {
    return LAYOUT_OPTIONS.find(l => l.id === layoutId) || LAYOUT_OPTIONS[0]
  }, [layoutId])

  // Split selected machines into pages
  const pages = useMemo(() => {
    const result = []
    const perPage = currentLayout.perPage
    for (let i = 0; i < machinesToPrint.length; i += perPage) {
      result.push(machinesToPrint.slice(i, i + perPage))
    }
    return result
  }, [machinesToPrint, currentLayout.perPage])

  const totalPages = pages.length || 1

  // Selection handlers
  const handleSelectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredMachines.forEach(m => next.add(m.id))
      return next
    })
  }

  const handleDeselectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredMachines.forEach(m => next.delete(m.id))
      return next
    })
  }

  const handleToggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(machines.map(m => m.id)))
  }

  const handleClearAll = () => {
    setSelectedIds(new Set())
  }

  const handleDirectPrint = () => {
    if (machinesToPrint.length === 0) return
    window.print()
  }

  const handleOpenPrintWindow = () => {
    if (machinesToPrint.length === 0) return

    const printWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!printWindow) {
      alert('Будь ласка, дозвольте спливаючі вікна для друку або скористайтеся кнопкою «ДРУКУВАТИ (Ctrl+P)»')
      return
    }

    const pagesHtml = pages.map((pageMachines, pageIdx) => {
      const cardsHtml = pageMachines.map(m => {
        const qrUrl = `${window.location.origin}/machines/${m.id}`
        // High-res SVG QR for popup window via quick online SVG fallback or local SVG
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${currentLayout.qrSize * 4}x${currentLayout.qrSize * 4}&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrUrl)}`

        return `
          <div class="print-card card-${layoutId} border-${borderStyle}">
            <div class="card-header">
              <div class="card-title-group">
                <span class="card-name">${m.name || 'ВЕРСТАТ'}</span>
                ${m.sequence_number ? `<span class="card-seq">№${m.sequence_number}</span>` : ''}
              </div>
              ${m.type ? `
                <div class="card-type-row">
                  <span class="card-type">${m.type}</span>
                </div>
              ` : ''}
            </div>

            <div class="card-body">
              <div class="card-qr-box">
                <img src="${qrImgUrl}" alt="QR" class="card-qr-img" />
              </div>
            </div>
          </div>
        `
      }).join('')

      return `
        <div class="print-page page-${layoutId}">
          <div class="page-grid grid-${layoutId}">
            ${cardsHtml}
          </div>
          <div class="page-footer">
            Аркуш ${pageIdx + 1} з ${totalPages} • CENTRUM ERP • Система моніторингу верстатів
          </div>
        </div>
      `
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Друк QR-кодів верстатів (${machinesToPrint.length} шт)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .print-page {
              width: 198mm;
              min-height: 0;
              height: auto;
              margin: 0 auto;
              padding: 0 0 4mm 0;
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .page-grid {
              display: grid;
              justify-content: center;
              align-content: start;
              gap: 5mm 6mm;
            }
            .grid-6_per_page {
              grid-template-columns: repeat(2, 92mm);
              grid-auto-rows: 84mm;
              gap: 5mm 6mm;
            }
            .grid-8_per_page {
              grid-template-columns: repeat(2, 92mm);
              grid-auto-rows: 62mm;
              gap: 3.5mm 6mm;
            }
            .grid-4_per_page {
              grid-template-columns: repeat(2, 92mm);
              grid-auto-rows: 126mm;
              gap: 6mm 6mm;
            }
            .grid-1_per_page {
              grid-template-columns: 184mm;
              grid-auto-rows: 255mm;
            }
            .print-card {
              border-radius: 10px;
              background: #fff;
              padding: 8px 10px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: hidden;
            }
            .border-dashed { border: 1.5px dashed #444; }
            .border-solid { border: 2px solid #000; }
            .card-header {
              border-bottom: 1.5px solid #000;
              padding-bottom: 4px;
              margin-bottom: 4px;
            }
            .card-title-group {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 8px;
            }
            .card-name {
              font-size: 15px;
              font-weight: 950;
              letter-spacing: -0.3px;
              line-height: 1.1;
              text-transform: uppercase;
              color: #000;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .card-seq {
              font-size: 11px;
              font-weight: 950;
              background: #000;
              color: #fff;
              padding: 2px 7px;
              border-radius: 6px;
              letter-spacing: 0.3px;
              flex-shrink: 0;
            }
            .card-type-row {
              display: flex;
              justify-content: space-between;
              font-size: 8.5px;
              color: #333;
              font-weight: 700;
              margin-top: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .card-body {
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 1;
            }
            .card-qr-box {
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .card-qr-img {
              width: ${currentLayout.qrSize}mm;
              height: ${currentLayout.qrSize}mm;
              display: block;
            }
            .card-info-box {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 3px;
            }
            .card-call-title {
              font-size: 7.5px;
              font-weight: 900;
              letter-spacing: 0.4px;
              color: #000;
              text-transform: uppercase;
            }
            .card-badges-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3px;
            }
            .action-badge {
              font-size: 7.5px;
              font-weight: 900;
              border: 1px solid #000;
              padding: 2px 3px;
              border-radius: 4px;
              text-align: center;
              white-space: nowrap;
              color: #000;
              background: #f8f8f8;
            }
            .card-call-desc {
              font-size: 7px;
              font-weight: 600;
              color: #555;
              line-height: 1.1;
              margin-top: 2px;
            }
            .page-footer {
              text-align: center;
              font-size: 7.5px;
              font-weight: 700;
              color: #888;
              border-top: 1px solid #ddd;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (!isOpen) return null

  return (
    <div className="machines-batch-print-backdrop">
      {/* Top Floating Control Bar (Hidden on Print) */}
      <div className="print-modal-header print-hide">
        <div className="header-left">
          <div className="modal-icon-badge">
            <Printer size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 1000, letterSpacing: '-0.3px', color: '#fff' }}>
              ДРУК QR-КОДІВ ВЕРСТАТІВ
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '0.8rem', color: '#888' }}>
              <span>Всього в системі: <strong style={{ color: '#fff' }}>{machines.length}</strong></span>
              <span>•</span>
              <span style={{ color: selectedIds.size > 0 ? '#ff9000' : '#888', fontWeight: 900 }}>
                Обрано до друку: <strong>{selectedIds.size}</strong>
              </span>
              <span>•</span>
              <span>Аркушів А4: <strong style={{ color: '#fff' }}>{pages.length}</strong></span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* View Tab Toggle */}
          <div className="view-toggle-pill">
            <button
              className={activeTab === 'preview' ? 'active' : ''}
              onClick={() => setActiveTab('preview')}
            >
              <Eye size={15} /> МАКЕТ А4
            </button>
            <button
              className={activeTab === 'selection' ? 'active' : ''}
              onClick={() => setActiveTab('selection')}
            >
              <Sliders size={15} /> СПИСОК ВЕРСТАТІВ ({selectedIds.size})
            </button>
          </div>

          {/* Dedicated Window Fallback */}
          <button
            onClick={handleOpenPrintWindow}
            disabled={selectedIds.size === 0}
            className="secondary-btn"
            title="Відкрити друк у новому автономному вікні"
          >
            <ExternalLink size={16} />
            <span className="hide-on-mobile">В ОКРЕМОМУ ВІКНІ</span>
          </button>

          {/* Primary Print Button */}
          <button
            onClick={handleDirectPrint}
            disabled={selectedIds.size === 0}
            className="primary-print-btn"
            title="Надіслати на принтер (A4)"
          >
            <Printer size={18} />
            <span>ДРУКУВАТИ ({selectedIds.size} шт • {pages.length} арк.)</span>
          </button>

          <button onClick={onClose} className="close-btn" title="Закрити вікно">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="print-modal-body print-hide">
        {/* Controls and Filters Sub-bar */}
        <div className="print-toolbar">
          {/* Density Layout Selector */}
          <div className="toolbar-section">
            <label className="toolbar-label">
              <LayoutGrid size={13} /> ФОРМАТ НА АРКУШІ А4:
            </label>
            <div className="layout-pills-row">
              {LAYOUT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setLayoutId(opt.id)}
                  className={`layout-pill ${layoutId === opt.id ? 'active' : ''}`}
                >
                  <span className="opt-title">{opt.label}</span>
                  <span className="opt-badge">{opt.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Border style */}
          <div className="toolbar-section">
            <label className="toolbar-label">
              <Scissors size={13} /> ЛІНІЇ РІЗУ:
            </label>
            <div className="border-toggle-group">
              <button
                className={borderStyle === 'dashed' ? 'active' : ''}
                onClick={() => setBorderStyle('dashed')}
                title="Пунктирні лінії для зручного різання ножицями"
              >
                Пунктир (ніж)
              </button>
              <button
                className={borderStyle === 'solid' ? 'active' : ''}
                onClick={() => setBorderStyle('solid')}
                title="Суцільна чорна рамка"
              >
                Суцільна рамка
              </button>
            </div>
          </div>

          {/* Bulk Selection Actions */}
          <div className="toolbar-section selection-actions-section">
            <label className="toolbar-label">
              <CheckSquare size={13} /> ШВИДКИЙ ВИБІР:
            </label>
            <div className="quick-actions-row">
              <button onClick={handleSelectAll} className="quick-action-btn">
                Вибрати всі ({machines.length})
              </button>
              <button onClick={handleClearAll} className="quick-action-btn">
                Зняти всі
              </button>
              {machineTypes.length > 0 && (
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="type-filter-select"
                >
                  <option value="ALL">Всі типи обладнання</option>
                  {machineTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        {activeTab === 'selection' ? (
          <div className="selection-view-container">
            {/* Search filter inside selection */}
            <div className="search-filter-row">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Пошук за назвою верстата, номером або інв. №..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="search-clear-btn">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSelectAllFiltered} className="sub-btn">
                  Обрати всі відфільтровані ({filteredMachines.length})
                </button>
                <button onClick={handleDeselectAllFiltered} className="sub-btn">
                  Зняти вибір відфільтрованих
                </button>
              </div>
            </div>

            {/* Grid of machine checkboxes */}
            <div className="machines-select-grid">
              {filteredMachines.map(m => {
                const isSelected = selectedIds.has(m.id)
                return (
                  <div
                    key={m.id}
                    onClick={() => handleToggleOne(m.id)}
                    className={`machine-select-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="select-checkbox">
                      {isSelected ? <CheckSquare size={19} color="#ff9000" /> : <Square size={19} color="#555" />}
                    </div>
                    <div className="select-info">
                      <div className="select-name-row">
                        <strong className="machine-name-text">{m.name}</strong>
                        {m.sequence_number && (
                          <span className="select-seq-badge">№{m.sequence_number}</span>
                        )}
                      </div>
                      <div className="select-type-text">
                        {m.type || 'Верстат'}
                      </div>
                      <div className="select-meta-text">
                        {m.floor ? `${m.floor} поверх` : 'Цех №1'}
                        {m.inventory_no ? ` • Інв: ${m.inventory_no}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Live Interactive Preview of A4 Pages */
          <div className="preview-view-container">
            <div className="preview-banner">
              <FileText size={16} />
              <span>
                Попередній перегляд макета <strong>A4 Portrait</strong>. До друку готово <strong>{machinesToPrint.length} верстатів</strong> на <strong>{pages.length} аркушах</strong>.
                Натисніть помаранчеву кнопку «ДРУКУВАТИ» або скористайтеся Ctrl+P.
              </span>
            </div>

            <div className="a4-pages-scroll-area">
              {pages.map((pageMachines, pageIndex) => (
                <div key={pageIndex} className="preview-a4-sheet-wrapper">
                  <div className="preview-sheet-label">
                    <span>АРКУШ {pageIndex + 1} З {totalPages}</span>
                    <span style={{ color: '#888' }}>({pageMachines.length} верстатів)</span>
                  </div>

                  {/* Simulated A4 Paper */}
                  <div className="preview-a4-paper">
                    <div className={`print-cards-grid grid-${layoutId}`}>
                      {pageMachines.map(machine => (
                        <MachineCardRender
                          key={machine.id}
                          machine={machine}
                          layout={currentLayout}
                          borderStyle={borderStyle}
                        />
                      ))}
                    </div>

                    <div className="paper-footer-tag">
                      Аркуш {pageIndex + 1} з {totalPages} • CENTRUM ERP • Система моніторингу обладнання
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PRINT-ONLY CONTAINER ATTACHED TO BODY (Enables clean native browser pagination for window.print()) */}
      {typeof document !== 'undefined' && createPortal(
        <div id="machines-batch-print-root" className="print-only">
          {pages.map((pageMachines, pageIdx) => (
            <div key={pageIdx} className="print-a4-page">
              <div className={`print-cards-grid grid-${layoutId}`}>
                {pageMachines.map(machine => (
                  <MachineCardRender
                    key={machine.id}
                    machine={machine}
                    layout={currentLayout}
                    borderStyle={borderStyle}
                  />
                ))}
              </div>
              <div className="print-page-number">
                Аркуш {pageIdx + 1} з {totalPages} • CENTRUM ERP • Система моніторингу обладнання
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* STYLES & PRINT MEDIA CSS */}
      <style>{`
        .machines-batch-print-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(8, 8, 10, 0.95);
          backdrop-filter: blur(16px);
          z-index: 99999;
          display: flex;
          flex-direction: column;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .print-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 28px;
          background: #111114;
          border-bottom: 1px solid #222228;
          flex-shrink: 0;
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .modal-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 144, 0, 0.15);
          border: 1px solid rgba(255, 144, 0, 0.4);
          color: #ff9000;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .view-toggle-pill {
          display: flex;
          background: #1a1a20;
          border: 1px solid #2a2a35;
          border-radius: 12px;
          padding: 3px;
        }

        .view-toggle-pill button {
          background: none;
          border: none;
          color: #888;
          font-weight: 850;
          font-size: 0.78rem;
          padding: 8px 16px;
          border-radius: 9px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: 0.15s;
        }

        .view-toggle-pill button.active {
          background: #2a2a35;
          color: #fff;
        }

        .secondary-btn {
          background: #1e1e24;
          color: #ddd;
          border: 1px solid #33333d;
          padding: 11px 18px;
          border-radius: 12px;
          font-weight: 850;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: 0.2s;
        }
        .secondary-btn:hover:not(:disabled) {
          background: #282830;
          color: #fff;
          border-color: #444;
        }

        .primary-print-btn {
          background: linear-gradient(135deg, #ff9000, #ff7700);
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 950;
          font-size: 0.92rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 18px rgba(255, 144, 0, 0.35);
          transition: 0.2s;
        }
        .primary-print-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(255, 144, 0, 0.5);
        }
        .primary-print-btn:disabled, .secondary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .close-btn {
          background: #1a1a20;
          border: 1px solid #2a2a35;
          color: #aaa;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s;
        }
        .close-btn:hover {
          color: #fff;
          background: #262630;
        }

        .print-modal-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .print-toolbar {
          background: #16161c;
          border-bottom: 1px solid #242430;
          padding: 12px 28px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        }

        .toolbar-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .toolbar-label {
          font-size: 0.7rem;
          font-weight: 900;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .layout-pills-row {
          display: flex;
          gap: 6px;
        }

        .layout-pill {
          background: #1e1e26;
          border: 1px solid #2d2d3a;
          color: #aaa;
          border-radius: 10px;
          padding: 6px 12px;
          font-size: 0.78rem;
          font-weight: 850;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: 0.15s;
        }
        .layout-pill:hover {
          border-color: #444;
          color: #fff;
        }
        .layout-pill.active {
          background: rgba(255, 144, 0, 0.15);
          border-color: #ff9000;
          color: #ff9000;
        }
        .layout-pill .opt-badge {
          font-size: 0.65rem;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 5px;
          border-radius: 4px;
        }
        .layout-pill.active .opt-badge {
          background: #ff9000;
          color: #000;
          font-weight: 950;
        }

        .border-toggle-group {
          display: flex;
          background: #1e1e26;
          border: 1px solid #2d2d3a;
          border-radius: 10px;
          padding: 2px;
        }
        .border-toggle-group button {
          background: none;
          border: none;
          color: #888;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: 0.15s;
        }
        .border-toggle-group button.active {
          background: #2e2e3a;
          color: #fff;
        }

        .quick-actions-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .quick-action-btn {
          background: #1e1e26;
          border: 1px solid #2d2d3a;
          color: #bbb;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: 0.15s;
        }
        .quick-action-btn:hover {
          background: #2a2a35;
          color: #fff;
        }

        .type-filter-select {
          background: #1e1e26;
          border: 1px solid #2d2d3a;
          color: #ff9000;
          font-size: 0.75rem;
          font-weight: 850;
          padding: 6px 10px;
          border-radius: 8px;
          outline: none;
          cursor: pointer;
        }

        /* Selection View */
        .selection-view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 20px 28px;
          gap: 16px;
        }

        .search-filter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #121216;
          border: 1px solid #242430;
          border-radius: 12px;
          padding: 10px 16px;
          flex: 1;
          max-width: 500px;
        }
        .search-box input {
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font-size: 0.88rem;
          width: 100%;
        }
        .search-clear-btn {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
        }

        .sub-btn {
          background: #1a1a22;
          border: 1px solid #282835;
          color: #bbb;
          padding: 9px 14px;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }
        .sub-btn:hover {
          background: #242430;
          color: #fff;
        }

        .machines-select-grid {
          flex: 1;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
          align-content: start;
          padding-right: 6px;
        }

        .machine-select-card {
          background: #121217;
          border: 1px solid #1f1f28;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          transition: 0.2s;
        }
        .machine-select-card:hover {
          border-color: #333342;
          background: #16161e;
        }
        .machine-select-card.selected {
          border-color: rgba(255, 144, 0, 0.45);
          background: rgba(255, 144, 0, 0.04);
        }

        .select-checkbox {
          margin-top: 2px;
        }
        .select-info {
          flex: 1;
          min-width: 0;
        }
        .select-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .machine-name-text {
          font-size: 0.95rem;
          color: #fff;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .select-seq-badge {
          background: #000;
          color: #ff9000;
          border: 1px solid rgba(255, 144, 0, 0.3);
          font-size: 0.72rem;
          font-weight: 950;
          padding: 1px 6px;
          border-radius: 6px;
        }
        .select-type-text {
          font-size: 0.78rem;
          color: #888;
          font-weight: 700;
          margin-top: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .select-meta-text {
          font-size: 0.7rem;
          color: #555;
          margin-top: 2px;
        }

        /* Preview View */
        .preview-view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .preview-banner {
          background: rgba(255, 144, 0, 0.08);
          border-bottom: 1px solid rgba(255, 144, 0, 0.15);
          padding: 10px 28px;
          font-size: 0.8rem;
          color: #ccc;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .preview-banner strong {
          color: #ff9000;
        }

        .a4-pages-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 40px;
          background: #09090b;
        }

        .preview-a4-sheet-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .preview-sheet-label {
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #aaa;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* The Paper Canvas on Screen */
        .preview-a4-paper {
          width: 198mm;
          min-height: 280mm;
          max-height: 280mm;
          background: #ffffff;
          color: #000000;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(0,0,0,0.4);
          border-radius: 4px;
          padding: 8mm 6mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .paper-footer-tag {
          font-size: 7.5px;
          font-weight: 700;
          color: #888;
          border-top: 1px solid #eee;
          padding-top: 2mm;
          text-align: center;
          text-transform: uppercase;
        }

        /* Card Grids for Preview and Print */
        .print-cards-grid {
          display: grid;
          justify-content: center;
          align-content: start;
          box-sizing: border-box;
          width: 100%;
        }

        .grid-6_per_page {
          grid-template-columns: repeat(2, 92mm);
          grid-auto-rows: 84mm;
          gap: 5mm 6mm;
        }
        .grid-8_per_page {
          grid-template-columns: repeat(2, 92mm);
          grid-auto-rows: 62mm;
          gap: 3.5mm 6mm;
        }
        .grid-4_per_page {
          grid-template-columns: repeat(2, 92mm);
          grid-auto-rows: 126mm;
          gap: 6mm 6mm;
        }
        .grid-1_per_page {
          grid-template-columns: 184mm;
          grid-auto-rows: 255mm;
        }

        /* Individual Machine Card inside Paper */
        .preview-machine-card {
          box-sizing: border-box;
          background: #ffffff;
          color: #000000;
          border-radius: 10px;
          padding: 7px 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
        }
        .preview-machine-card.border-dashed {
          border: 1.5px dashed #444;
        }
        .preview-machine-card.border-solid {
          border: 2px solid #000;
        }

        .render-header {
          border-bottom: 1.5px solid #000;
          padding-bottom: 3px;
          margin-bottom: 4px;
        }
        .render-title-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }
        .render-machine-name {
          font-size: 14.5px;
          font-weight: 950;
          letter-spacing: -0.3px;
          line-height: 1.1;
          text-transform: uppercase;
          color: #000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .render-seq-badge {
          font-size: 10.5px;
          font-weight: 950;
          background: #000;
          color: #fff;
          padding: 2px 7px;
          border-radius: 6px;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }
        .render-sub-line {
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #333;
          font-weight: 700;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .render-body {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }
        .render-qr-box {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .render-info-box {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
        }
        .render-call-title {
          font-size: 7.5px;
          font-weight: 900;
          letter-spacing: 0.3px;
          color: #000;
          text-transform: uppercase;
        }
        .render-badges-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
        }
        .render-action-badge {
          font-size: 7.5px;
          font-weight: 900;
          border: 1px solid #000;
          padding: 2.5px 3px;
          border-radius: 4px;
          text-align: center;
          white-space: nowrap;
          color: #000;
          background: #f7f7f7;
        }
        .render-call-desc {
          font-size: 7px;
          font-weight: 600;
          color: #555;
          line-height: 1.1;
          margin-top: 2px;
        }

        /* 4 per page specific scaling */
        .card-4_per_page .render-machine-name {
          font-size: 19px;
        }
        .card-4_per_page .render-seq-badge {
          font-size: 13px;
          padding: 3px 10px;
        }
        .card-4_per_page .render-sub-line {
          font-size: 11px;
        }
        .card-4_per_page .render-action-badge {
          font-size: 9.5px;
          padding: 4px 6px;
        }
        .card-4_per_page .render-call-title {
          font-size: 9px;
        }
        .card-4_per_page .render-call-desc {
          font-size: 8.5px;
        }

        /* 1 per page (poster) specific scaling */
        .card-1_per_page {
          padding: 20px 25px;
        }
        .card-1_per_page .render-header {
          border-bottom: 3px solid #000;
          padding-bottom: 12px;
          margin-bottom: 15px;
        }
        .card-1_per_page .render-machine-name {
          font-size: 36px;
        }
        .card-1_per_page .render-seq-badge {
          font-size: 20px;
          padding: 6px 16px;
          border-radius: 10px;
        }
        .card-1_per_page .render-sub-line {
          font-size: 16px;
          margin-top: 8px;
        }
        .card-1_per_page .render-body {
          flex-direction: column;
          gap: 20px;
        }
        .card-1_per_page .render-info-box {
          width: 100%;
          align-items: center;
          gap: 12px;
        }
        .card-1_per_page .render-call-title {
          font-size: 16px;
          letter-spacing: 1px;
        }
        .card-1_per_page .render-badges-grid {
          display: flex;
          gap: 10px;
          width: 100%;
          justify-content: center;
        }
        .card-1_per_page .render-action-badge {
          font-size: 14px;
          padding: 8px 16px;
          border: 2px solid #000;
          border-radius: 8px;
        }
        .card-1_per_page .render-call-desc {
          font-size: 13px;
        }

        /* Hidden by default on screen */
        .print-only {
          display: none;
        }

        /* ---------------- PRINT MEDIA RULES ---------------- */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }

          /* Hide all application chrome and elements outside the print portal */
          body > *:not(#machines-batch-print-root) {
            display: none !important;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #machines-batch-print-root {
            display: block !important;
            position: static !important;
            float: none !important;
            width: 100% !important;
            max-width: 198mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .print-a4-page {
            width: 100% !important;
            max-width: 198mm !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 auto !important;
            padding: 0 0 4mm 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }

          .print-a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .print-cards-grid {
            display: grid !important;
            justify-content: center !important;
            align-content: start !important;
            box-sizing: border-box !important;
            width: 100% !important;
          }

          .print-page-number {
            text-align: center !important;
            font-size: 7.5px !important;
            font-weight: 700 !important;
            color: #888 !important;
            border-top: 1px solid #ddd !important;
            padding-top: 2mm !important;
            margin-top: 2mm !important;
          }

          .preview-machine-card {
            border-radius: 10px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .preview-machine-card.border-dashed {
            border: 1.5px dashed #000000 !important;
          }
          .preview-machine-card.border-solid {
            border: 2px solid #000000 !important;
          }

          .render-seq-badge {
            background: #000000 !important;
            color: #ffffff !important;
          }

          .print-hide {
            display: none !important;
          }
        }

        @media (max-width: 768px) {
          .hide-on-mobile {
            display: none;
          }
          .print-modal-header {
            padding: 12px 16px;
          }
          .print-toolbar {
            padding: 10px 16px;
          }
          .a4-pages-scroll-area {
            padding: 16px 8px;
          }
          .preview-a4-paper {
            width: 100%;
            max-width: 198mm;
            padding: 12px;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Single machine card rendered with vector SVG QR code
 */
function MachineCardRender({ machine, layout, borderStyle }) {
  const qrUrl = `${window.location.origin}/machines/${machine.id}`

  return (
    <div className={`preview-machine-card card-${layout.id} border-${borderStyle}`}>
      {/* Top Header */}
      <div className="render-header">
        <div className="render-title-line">
          <span className="render-machine-name" title={machine.name}>
            {machine.name || 'ВЕРСТАТ'}
          </span>
          {machine.sequence_number && (
            <span className="render-seq-badge">
              №{machine.sequence_number}
            </span>
          )}
        </div>
        {machine.type && (
          <div className="render-sub-line">
            <span>{machine.type}</span>
          </div>
        )}
      </div>

      {/* Body with QR */}
      <div className="render-body">
        <div className="render-qr-box">
          <QRCodeSVG
            value={qrUrl}
            size={layout.qrSize * 3.78} // Convert mm to approximate SVG px
            level="M"
            includeMargin={false}
          />
        </div>
      </div>
    </div>
  )
}
