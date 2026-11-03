import React, { useEffect } from 'react'
import { Package, Search, X, ClipboardList, Play } from 'lucide-react'

export const Shop2StorageExplorerModal = ({
  showStorageExplorer,
  setShowStorageExplorer,
  workCards,
  isShop2Card,
  tasks,
  orders,
  nomenclatures,
  inventory,
  bufferSearchQuery,
  setBufferSearchQuery,
  calculateTotalBufferParts
}) => {
  // Lock background scrolling when modal is open
  useEffect(() => {
    if (!showStorageExplorer) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [showStorageExplorer])

  if (!showStorageExplorer) return null

  // 1. Collect all active buffer cards for Route 1 (at-shop2-buffer) & Route 2 (VKYA return / rework)
  const bufferCards = (workCards || []).filter(c => {
    if (isShop2Card(c)) return false
    const status = String(c.status || '')
    return status === 'at-shop2-buffer'
  })

  // 2. Group buffer items by Task ID / Order
  const taskGroups = {}

  bufferCards.forEach(card => {
    const qty = Number(card.quantity || 0)
    const used = Number(card.used_in_shop2_qty || 0)
    const avail = Math.max(0, qty - used)
    if (avail <= 0) return

    const taskId = card.task_id || 'unassigned'
    if (!taskGroups[taskId]) {
      const taskObj = (tasks || []).find(t => String(t.id) === String(taskId))
      const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
      const rawNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Вільний запас'
      const orderNumStr = String(rawNum)
      const displayNum = orderNumStr.startsWith('№') || orderNumStr.includes('Вільний') || orderNumStr.includes('Загальний')
        ? orderNumStr
        : `Наряд №${orderNumStr}`

      taskGroups[taskId] = {
        taskId,
        orderNum: displayNum,
        items: {}
      }
    }

    const nomId = card.nomenclature_id
    if (!taskGroups[taskId].items[nomId]) {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(nomId))
      
      // Calculate Shop 2 scrap for this part / order
      let scrapQty = 0
      ;(workCards || []).forEach(sc => {
        if (isShop2Card(sc) && String(sc.nomenclature_id) === String(nomId)) {
          if (!card.order_id || String(sc.order_id) === String(card.order_id)) {
            scrapQty += Number(sc.scrap_qty || 0)
          }
        }
      })

      taskGroups[taskId].items[nomId] = {
        nomId,
        name: nom?.name || 'Деталь',
        unit: nom?.unit || 'шт',
        material: nom?.material_type || nom?.material || '—',
        rawReceived: 0,
        total_qty: 0,
        scrapQty,
        cardCount: 0,
        updated_at: card.created_at
      }
    }
    taskGroups[taskId].items[nomId].rawReceived += qty
    taskGroups[taskId].items[nomId].total_qty += avail
    taskGroups[taskId].items[nomId].cardCount += 1
  })

  const rawGroupList = Object.values(taskGroups).filter(g => Object.keys(g.items).length > 0)

  // Calculate Summary KPIs
  let totalBufferPartsCount = 0
  const nomSet = new Set()

  rawGroupList.forEach(group => {
    Object.values(group.items).forEach(item => {
      if (item.total_qty > 0) {
        totalBufferPartsCount += item.total_qty
        nomSet.add(item.nomId)
      }
    })
  })

  // Filter groups by bufferSearchQuery if present
  const q = String(bufferSearchQuery || '').trim().toLowerCase()
  const groupList = rawGroupList.map(group => {
    if (!q) return group
    const matchesGroupTitle = group.orderNum.toLowerCase().includes(q)
    if (matchesGroupTitle) return group
    
    const filteredItems = {}
    Object.entries(group.items).forEach(([nid, item]) => {
      if (item.name.toLowerCase().includes(q) || (item.material && item.material.toLowerCase().includes(q))) {
        filteredItems[nid] = item
      }
    })
    return { ...group, items: filteredItems }
  }).filter(g => Object.keys(g.items).length > 0)

  return (
    <div className="shop2-storage-modal">
      {/* Header */}
      <div className="shop2-storage-header">
        <div className="shop2-storage-header-left">
          <div className="shop2-storage-icon-box">
            <Package size={22} className="shop2-storage-icon" />
          </div>
          <div>
            <h2 className="shop2-storage-title">
              БУФЕР ЦЕХУ №2
            </h2>
            <div className="shop2-storage-subtitle">
              Надходження деталей з Розкрою / Сортування / ВКЯ
            </div>
          </div>
        </div>

        {/* Search Control Bar */}
        <div className="shop2-storage-search-bar">
          <div className="shop2-storage-search-input-wrap">
            <Search size={16} className="shop2-storage-search-icon" />
            <input
              type="text"
              placeholder="Пошук по деталях або № наряду..."
              value={bufferSearchQuery}
              onChange={e => setBufferSearchQuery(e.target.value)}
              className="shop2-storage-search-input"
            />
            {bufferSearchQuery && (
              <X
                size={14}
                className="shop2-storage-search-clear"
                onClick={() => setBufferSearchQuery('')}
              />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowStorageExplorer(false)}
          className="shop2-storage-close-btn"
          title="Закрити вікно буфера"
        >
          <X size={20} />
        </button>
      </div>

      {/* Summary KPI Bar — EXACTLY 2 CARDS */}
      <div className="shop2-storage-kpi-bar">
        {/* Card 1: Нарядів у буфері */}
        <div className="shop2-storage-kpi-card">
          <ClipboardList size={22} className="shop2-storage-kpi-icon" />
          <div>
            <div className="shop2-storage-kpi-label">НАРЯДІВ У БУФЕРІ</div>
            <div className="shop2-storage-kpi-val">
              {rawGroupList.filter(g => g.taskId !== 'unassigned').length} нарядів
            </div>
          </div>
        </div>

        {/* Card 2: Вільних деталей у буфері */}
        <div className="shop2-storage-kpi-card shop2-storage-kpi-card-accent">
          <Play size={22} className="shop2-storage-kpi-icon-accent" />
          <div>
            <div className="shop2-storage-kpi-label-accent">ВІЛЬНИХ ДЕТАЛЕЙ У БУФЕРІ</div>
            <div className="shop2-storage-kpi-val-accent">
              {totalBufferPartsCount.toLocaleString('uk-UA')} шт
            </div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="shop2-storage-content">
        {groupList.length === 0 ? (
          <div className="shop2-storage-empty">
            <Package size={52} className="shop2-storage-empty-icon" />
            <div className="shop2-storage-empty-text">
              {bufferSearchQuery ? 'Нічого не знайдено за вашим запитом' : 'НЕМАЄ ДЕТАЛЕЙ В БУФЕРІ'}
            </div>
          </div>
        ) : (
          <div className="shop2-storage-groups-list">
            {groupList.map(group => {
              const totalGroupQty = Object.values(group.items).reduce((sum, item) => sum + item.total_qty, 0)
              const isUnassigned = group.taskId === 'unassigned'
              const itemCount = Object.keys(group.items).length

              return (
                <div
                  key={group.taskId}
                  className={`shop2-storage-order-card ${isUnassigned ? 'is-unassigned' : ''}`}
                >
                  {/* Task Header */}
                  <div className="shop2-storage-order-header">
                    <div className="shop2-storage-order-badge-row">
                      <div className={`shop2-storage-order-badge ${isUnassigned ? 'badge-unassigned' : ''}`}>
                        {isUnassigned ? '📦' : '📋'} {group.orderNum}
                      </div>
                      {isUnassigned && (
                        <span className="shop2-storage-unassigned-hint">
                          (Складський резерв БЗ без прив'язки до наряду)
                        </span>
                      )}
                    </div>
                    <div className="shop2-storage-order-summary">
                      <span>{itemCount} найменувань</span>
                      <span>•</span>
                      <span>Усього в буфері: <strong className={isUnassigned ? 'text-amber' : 'text-purple'}>{totalGroupQty.toLocaleString('uk-UA')} шт</strong></span>
                    </div>
                  </div>

                  {/* Part Grid */}
                  <div className="shop2-storage-parts-grid">
                    {Object.values(group.items).filter(item => item.total_qty > 0).map(item => (
                      <div
                        key={item.nomId}
                        className="shop2-storage-part-card"
                      >
                        <div className="shop2-storage-part-info">
                          <div className="shop2-storage-part-name" title={item.name}>
                            {item.name}
                          </div>
                          <div className="shop2-storage-part-meta">
                            {item.material !== '—' ? `${item.material} · ` : ''}{item.cardCount > 0 ? `${item.cardCount} карток` : 'в наявності'}
                          </div>
                        </div>
                        <div className="shop2-storage-part-qty-box">
                          <div className={`shop2-storage-part-qty ${isUnassigned ? 'qty-amber' : 'qty-purple'}`}>
                            {item.total_qty.toLocaleString('uk-UA')}
                          </div>
                          <div className="shop2-storage-part-qty-label">ВІЛЬНІ ДЕТАЛІ</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── SHOP 2 BUFFER MODAL STYLES (THEME-ADAPTIVE) ── */
        .shop2-storage-modal {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          background: var(--s2-buf-bg);
          color: var(--s2-buf-text);
          overscroll-behavior: contain;
          font-family: inherit;
        }

        /* ── DARK THEME DEFAULT VARIABLES ── */
        .shop2-storage-modal {
          --s2-buf-bg: #09090b;
          --s2-buf-content-bg: #0a0a0f;
          --s2-buf-header-bg: #121217;
          --s2-buf-kpi-bar-bg: #0e0e13;
          --s2-buf-card-bg: #14141b;
          --s2-buf-part-bg: #1a1a24;
          --s2-buf-part-hover: #222230;
          --s2-buf-border: #242432;
          --s2-buf-border-subtle: #2d2d3e;
          --s2-buf-text: #f8fafc;
          --s2-buf-text-muted: #94a3b8;
          --s2-buf-input-bg: #1a1a22;
          --s2-buf-btn-bg: #1c1c26;
          --s2-buf-btn-hover: #282836;
          --s2-buf-accent: #a78bfa;
          --s2-buf-accent-bg: rgba(167, 139, 250, 0.15);
          --s2-buf-accent-border: rgba(167, 139, 250, 0.35);
          --s2-buf-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        /* ── LIGHT THEME OVERRIDES ── */
        body.light-theme .shop2-storage-modal,
        .light-theme .shop2-storage-modal {
          --s2-buf-bg: #f8fafc;
          --s2-buf-content-bg: #f1f5f9;
          --s2-buf-header-bg: #ffffff;
          --s2-buf-kpi-bar-bg: #f8fafc;
          --s2-buf-card-bg: #ffffff;
          --s2-buf-part-bg: #f8fafc;
          --s2-buf-part-hover: #f1f5f9;
          --s2-buf-border: #e2e8f0;
          --s2-buf-border-subtle: #cbd5e1;
          --s2-buf-text: #0f172a;
          --s2-buf-text-muted: #64748b;
          --s2-buf-input-bg: #f8fafc;
          --s2-buf-btn-bg: #f1f5f9;
          --s2-buf-btn-hover: #e2e8f0;
          --s2-buf-accent: #7c3aed;
          --s2-buf-accent-bg: rgba(124, 58, 237, 0.1);
          --s2-buf-accent-border: rgba(124, 58, 237, 0.28);
          --s2-buf-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }

        /* Header elements */
        .shop2-storage-header {
          padding: 16px 24px;
          background: var(--s2-buf-header-bg);
          border-bottom: 1px solid var(--s2-buf-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          flex-shrink: 0;
        }
        .shop2-storage-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .shop2-storage-icon-box {
          background: var(--s2-buf-accent-bg);
          border: 1px solid var(--s2-buf-accent-border);
          padding: 10px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .shop2-storage-icon {
          color: var(--s2-buf-accent);
        }
        .shop2-storage-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 950;
          letter-spacing: -0.01em;
          color: var(--s2-buf-text);
        }
        .shop2-storage-subtitle {
          font-size: 0.65rem;
          color: var(--s2-buf-text-muted);
          font-weight: 850;
          text-transform: uppercase;
          margin-top: 3px;
          letter-spacing: 0.5px;
        }

        /* Search */
        .shop2-storage-search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          max-width: 440px;
          min-width: 220px;
        }
        .shop2-storage-search-input-wrap {
          position: relative;
          width: 100%;
        }
        .shop2-storage-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--s2-buf-text-muted);
        }
        .shop2-storage-search-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--s2-buf-text-muted);
          cursor: pointer;
        }
        .shop2-storage-search-input {
          width: 100%;
          background: var(--s2-buf-input-bg);
          border: 1px solid var(--s2-buf-border-subtle);
          color: var(--s2-buf-text);
          padding: 9px 36px 9px 38px;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 700;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .shop2-storage-search-input:focus {
          border-color: var(--s2-buf-accent);
        }

        /* Close button */
        .shop2-storage-close-btn {
          background: var(--s2-buf-btn-bg);
          border: 1px solid var(--s2-buf-border-subtle);
          color: var(--s2-buf-text);
          width: 40px;
          height: 40px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .shop2-storage-close-btn:hover {
          background: var(--s2-buf-btn-hover);
        }

        /* KPI Bar */
        .shop2-storage-kpi-bar {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
          padding: 14px 24px;
          background: var(--s2-buf-kpi-bar-bg);
          border-bottom: 1px solid var(--s2-buf-border);
          flex-shrink: 0;
        }
        .shop2-storage-kpi-card {
          background: var(--s2-buf-card-bg);
          border: 1px solid var(--s2-buf-border);
          border-radius: 14px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .shop2-storage-kpi-icon {
          color: var(--s2-buf-accent);
        }
        .shop2-storage-kpi-label {
          color: var(--s2-buf-text-muted);
          font-size: 0.62rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .shop2-storage-kpi-val {
          color: var(--s2-buf-text);
          font-size: 1.25rem;
          font-weight: 950;
          margin-top: 2px;
        }

        .shop2-storage-kpi-card-accent {
          border-color: var(--s2-buf-accent-border);
        }
        .shop2-storage-kpi-icon-accent {
          color: var(--s2-buf-accent);
        }
        .shop2-storage-kpi-label-accent {
          color: var(--s2-buf-accent);
          font-size: 0.62rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .shop2-storage-kpi-val-accent {
          color: var(--s2-buf-accent);
          font-size: 1.25rem;
          font-weight: 950;
          margin-top: 2px;
        }

        /* Content scroll container */
        .shop2-storage-content {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px 24px;
          background: var(--s2-buf-content-bg);
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .shop2-storage-empty {
          text-align: center;
          padding: 70px 20px;
          color: var(--s2-buf-text-muted);
        }
        .shop2-storage-empty-icon {
          margin-bottom: 16px;
          opacity: 0.2;
        }
        .shop2-storage-empty-text {
          font-weight: 900;
          font-size: 0.95rem;
        }
        .shop2-storage-groups-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Order card */
        .shop2-storage-order-card {
          background: var(--s2-buf-card-bg);
          border: 1px solid var(--s2-buf-border);
          border-radius: 20px;
          padding: 20px;
          box-shadow: var(--s2-buf-shadow);
        }
        .shop2-storage-order-card.is-unassigned {
          background: rgba(234, 179, 8, 0.05);
          border-color: rgba(234, 179, 8, 0.35);
        }
        .shop2-storage-order-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--s2-buf-border);
          flex-wrap: wrap;
          gap: 10px;
        }
        .shop2-storage-order-badge-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .shop2-storage-order-badge {
          background: var(--s2-buf-accent-bg);
          border: 1px solid var(--s2-buf-accent-border);
          color: var(--s2-buf-accent);
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 950;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .shop2-storage-order-badge.badge-unassigned {
          background: rgba(234, 179, 8, 0.15);
          border-color: rgba(234, 179, 8, 0.4);
          color: #d97706;
        }
        .shop2-storage-unassigned-hint {
          color: var(--s2-buf-text-muted);
          font-size: 0.68rem;
          font-weight: 800;
        }
        .shop2-storage-order-summary {
          color: var(--s2-buf-text-muted);
          font-size: 0.76rem;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .text-purple {
          color: var(--s2-buf-accent);
          font-size: 0.95rem;
          font-weight: 950;
        }
        .text-amber {
          color: #d97706;
          font-size: 0.95rem;
          font-weight: 950;
        }

        /* Parts grid */
        .shop2-storage-parts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .shop2-storage-part-card {
          background: var(--s2-buf-part-bg);
          border: 1px solid var(--s2-buf-border);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .shop2-storage-part-card:hover {
          background: var(--s2-buf-part-hover);
          border-color: var(--s2-buf-border-subtle);
          transform: translateY(-1px);
        }
        .shop2-storage-part-info {
          flex: 1;
          min-width: 0;
          padding-right: 12px;
        }
        .shop2-storage-part-name {
          font-size: 0.84rem;
          font-weight: 900;
          color: var(--s2-buf-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .shop2-storage-part-meta {
          font-size: 0.64rem;
          color: var(--s2-buf-text-muted);
          font-weight: 850;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .shop2-storage-part-qty-box {
          text-align: right;
          flex-shrink: 0;
        }
        .shop2-storage-part-qty {
          font-size: 1.45rem;
          font-weight: 1000;
          line-height: 1;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .shop2-storage-part-qty.qty-purple {
          color: var(--s2-buf-accent);
        }
        .shop2-storage-part-qty.qty-amber {
          color: #d97706;
        }
        .shop2-storage-part-qty-label {
          font-size: 0.54rem;
          color: var(--s2-buf-text-muted);
          font-weight: 900;
          margin-top: 3px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .shop2-storage-header {
            padding: 12px 14px;
            gap: 10px;
          }
          .shop2-storage-title {
            font-size: 1.05rem;
          }
          .shop2-storage-search-bar {
            max-width: 100%;
            order: 3;
            width: 100%;
          }
          .shop2-storage-kpi-bar {
            grid-template-columns: 1fr 1fr;
            padding: 10px 14px;
            gap: 8px;
          }
          .shop2-storage-kpi-card {
            padding: 10px 12px;
            gap: 10px;
          }
          .shop2-storage-kpi-val,
          .shop2-storage-kpi-val-accent {
            font-size: 1.05rem;
          }
          .shop2-storage-content {
            padding: 12px 14px;
          }
          .shop2-storage-order-card {
            padding: 14px 12px;
            border-radius: 16px;
          }
          .shop2-storage-parts-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}} />
    </div>
  )
}
