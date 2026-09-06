import React from 'react'
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--bg-primary, #0a0a0a)',
      display: 'flex', flexDirection: 'column',
      color: 'var(--text-primary, #ffffff)'
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 25px',
        background: 'var(--card-bg, #ffffff)',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '10px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} color="#8b5cf6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950, letterSpacing: '-0.01em', color: 'var(--text-primary, #0f172a)' }}>
              БУФЕР ЦЕХУ №2
            </h2>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted, #64748b)', fontWeight: 850, textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.5px' }}>
              Надходження деталей з Розкрою / Сортування / ВКЯ
            </div>
          </div>
        </div>

        {/* Search Control Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '420px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="var(--text-muted, #64748b)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Пошук по деталях або № наряду..."
              value={bufferSearchQuery}
              onChange={e => setBufferSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border-color, #cbd5e1)',
                color: 'var(--text-primary, #0f172a)',
                padding: '9px 14px 9px 38px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                outline: 'none'
              }}
            />
            {bufferSearchQuery && (
              <X
                size={14}
                color="var(--text-muted, #64748b)"
                onClick={() => setBufferSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }}
              />
            )}
          </div>
        </div>

        <button onClick={() => setShowStorageExplorer(false)} style={{ background: 'var(--bg-secondary, #f1f5f9)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-primary, #0f172a)', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={20} />
        </button>
      </div>

      {/* Summary KPI Bar — EXACTLY 2 CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '14px',
        padding: '14px 25px',
        background: 'var(--bg-secondary, #f8fafc)',
        borderBottom: '1px solid var(--border-color, #e2e8f0)'
      }}>
        {/* Card 1: Нарядів у буфері */}
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <ClipboardList size={22} color="#8b5cf6" />
          <div>
            <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>НАРЯДІВ У БУФЕРІ</div>
            <div style={{ color: 'var(--text-primary, #0f172a)', fontSize: '1.25rem', fontWeight: 950, marginTop: '2px' }}>{rawGroupList.filter(g => g.taskId !== 'unassigned').length} нарядів</div>
          </div>
        </div>

        {/* Card 2: Вільних деталей у буфері */}
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <Play size={22} color="#8b5cf6" />
          <div>
            <div style={{ color: '#8b5cf6', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ВІЛЬНИХ ДЕТАЛЕЙ У БУФЕРІ</div>
            <div style={{ color: '#8b5cf6', fontSize: '1.25rem', fontWeight: 950, marginTop: '2px' }}>{totalBufferPartsCount.toLocaleString('uk-UA')} шт</div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 25px', background: 'var(--bg-primary, #f1f5f9)' }}>
        {groupList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 20px', color: 'var(--text-muted, #64748b)' }}>
            <Package size={52} style={{ marginBottom: '16px', opacity: 0.15 }} />
            <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>
              {bufferSearchQuery ? 'Нічого не знайдено за вашим запитом' : 'НЕМАЄ ДЕТАЛЕЙ В БУФЕРІ'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {groupList.map(group => {
              const totalGroupQty = Object.values(group.items).reduce((sum, item) => sum + item.total_qty, 0)
              const isUnassigned = group.taskId === 'unassigned'
              const itemCount = Object.keys(group.items).length

              return (
                <div
                  key={group.taskId}
                  style={{
                    background: isUnassigned ? 'rgba(234, 179, 8, 0.05)' : 'var(--card-bg, #ffffff)',
                    border: isUnassigned ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Task Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color, #f1f5f9)', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        background: isUnassigned ? 'rgba(234, 179, 8, 0.15)' : 'rgba(139, 92, 246, 0.12)',
                        border: `1px solid ${isUnassigned ? 'rgba(234, 179, 8, 0.4)' : 'rgba(139, 92, 246, 0.3)'}`,
                        color: isUnassigned ? '#d97706' : '#8b5cf6',
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        fontWeight: 950,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {isUnassigned ? '📦' : '📋'} {group.orderNum}
                      </div>
                      {isUnassigned && (
                        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.66rem', fontWeight: 800 }}>
                          (Складський резерв БЗ без прив'язки до наряду)
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.74rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>{itemCount} найменувань</span>
                      <span>•</span>
                      <span>Усього в буфері: <strong style={{ color: isUnassigned ? '#d97706' : '#8b5cf6', fontSize: '0.95rem', fontWeight: 950 }}>{totalGroupQty.toLocaleString('uk-UA')} шт</strong></span>
                    </div>
                  </div>

                  {/* Part Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {Object.values(group.items).filter(item => item.total_qty > 0).map(item => (
                      <div
                        key={item.nomId}
                        style={{
                          background: 'var(--bg-secondary, #f8fafc)',
                          borderRadius: '14px',
                          padding: '14px 16px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 900, color: 'var(--text-primary, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted, #64748b)', fontWeight: 850, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.material !== '—' ? `${item.material} · ` : ''}{item.cardCount > 0 ? `${item.cardCount} карток` : 'в наявності'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.45rem', fontWeight: 1000, color: isUnassigned ? '#d97706' : '#8b5cf6', lineHeight: 1, fontFamily: 'monospace' }}>
                            {item.total_qty.toLocaleString('uk-UA')}
                          </div>
                          <div style={{ fontSize: '0.52rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }}>ВІЛЬНІ ДЕТАЛІ</div>
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
    </div>
  )
}
