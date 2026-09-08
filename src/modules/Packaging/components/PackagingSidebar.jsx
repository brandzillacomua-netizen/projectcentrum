import React, { useState, useMemo } from 'react'
import { ClipboardList, CheckCircle2, Scan, Clock, Package, X, Search, Table, LayoutGrid, Zap } from 'lucide-react'

export const PackagingSidebar = ({
  batchList,
  selectedBatch,
  setSelectedBatch,
  isDrawerOpen,
  setIsDrawerOpen
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'ready', 'processing', 'completed'
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  const filteredBatches = useMemo(() => {
    return batchList.filter(b => {
      if (filterStatus === 'ready' && b.packStatus !== 'ready') return false
      if (filterStatus === 'processing' && (b.packStatus !== 'processing' && b.packStatus !== 'waiting')) return false
      if (filterStatus === 'completed' && b.packStatus !== 'completed') return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchNum = String(b.orderNum || '').toLowerCase().includes(q)
        const matchCust = String(b.customer || '').toLowerCase().includes(q)
        const matchProd = String(b.productNames || '').toLowerCase().includes(q)
        const matchIdx = String(b.batchIndex || '').toLowerCase().includes(q)
        if (!matchNum && !matchCust && !matchProd && !matchIdx) return false
      }
      return true
    })
  }, [batchList, filterStatus, searchTerm])

  const counts = useMemo(() => {
    return {
      all: batchList.length,
      ready: batchList.filter(b => b.packStatus === 'ready').length,
      processing: batchList.filter(b => b.packStatus === 'processing' || b.packStatus === 'waiting').length,
      completed: batchList.filter(b => b.packStatus === 'completed').length
    }
  }, [batchList])

  return (
    <>
      {isDrawerOpen && (
        <div 
          className="drawer-backdrop" 
          onClick={() => setIsDrawerOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* SIDEBAR PANEL */}
      <div className={`side-panel glass-panel ${isDrawerOpen ? 'drawer-open' : ''}`} style={{ background: 'var(--card-bg, #ffffff)', padding: '20px', borderRadius: '24px', border: '1px solid var(--glass-border, #cbd5e1)', boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,0.05))', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={20} color="#f43f5e" />
            <h3 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text, #0f172a)', fontWeight: 900, textTransform: 'uppercase' }}>Черга нарядів</h3>
            <span style={{ background: '#f43f5e22', color: '#f43f5e', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 950 }}>{filteredBatches.length}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* VIEW MODE TOGGLE */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Режим карток"
                style={{
                  background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Режим таблиці (1С style)"
                style={{
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  color: viewMode === 'table' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Table size={14} />
              </button>
            </div>

            {isDrawerOpen && (
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', padding: '2px' }}>
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* SEARCH INPUT */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Пошук наряду, клієнта, виробу..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 10px 6px 30px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.78rem',
              background: '#f8fafc',
              color: '#0f172a'
            }}
          />
        </div>

        {/* QUICK STATUS FILTERS */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: 'Всі', count: counts.all },
            { id: 'ready', label: 'Готові', count: counts.ready },
            { id: 'processing', label: 'В роботі', count: counts.processing },
            { id: 'completed', label: 'Спаковано', count: counts.completed },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '6px',
                border: 'none',
                background: filterStatus === f.id ? '#0f172a' : '#f1f5f9',
                color: filterStatus === f.id ? '#ffffff' : '#64748b',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: '0.15s'
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* BATCH LIST / TABLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
          {viewMode === 'cards' ? (
            /* CARDS VIEW */
            filteredBatches.map(batch => {
              const isSelected = selectedBatch?.key === batch.key
              const isCompleted = batch.packStatus === 'completed'
              const isReady = batch.packStatus === 'ready'
              const isProc = batch.packStatus === 'processing'
              let statusColor = '#d97706', statusBg = 'rgba(217, 119, 6, 0.12)', statusLabel = 'ОЧІКУЄ ЗАПИТУ'
              if (isCompleted) { statusColor = '#64748b'; statusBg = 'var(--card-header-bg, #f1f5f9)'; statusLabel = 'ЗАПАКОВАНО' }
              else if (isReady) { statusColor = '#059669'; statusBg = 'rgba(16, 185, 129, 0.12)'; statusLabel = 'ГОТОВО ДО ПАКУВАННЯ' }
              else if (isProc) { statusColor = '#2563eb'; statusBg = 'rgba(37, 99, 235, 0.12)'; statusLabel = 'ЗАПИТ В ОБРОБЦІ' }

              return (
                <div 
                  key={batch.key} 
                  onClick={() => { setSelectedBatch(batch); setIsDrawerOpen(false); }} 
                  className={`pack-order-card ${isReady ? 'ready-pulse' : ''}`}
                  style={{ 
                    flexShrink: 0, 
                    padding: '12px 14px', 
                    background: isSelected ? `${statusColor}14` : (isCompleted ? 'var(--card-header-bg, #f8fafc)' : 'var(--card-bg, #ffffff)'), 
                    border: `1.5px solid ${isSelected ? statusColor : 'var(--border-color, #e2e8f0)'}`, 
                    boxShadow: isSelected ? `0 4px 14px ${statusColor}22` : 'var(--shadow, 0 2px 6px rgba(0,0,0,0.03))',
                    borderRadius: '14px', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s ease', 
                    position: 'relative', 
                    opacity: isCompleted ? 0.5 : 1, 
                    overflow: 'hidden' 
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: statusColor }}></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 950, color: 'var(--text, #0f172a)' }}>
                        № {batch.orderNum}{batch.batchIndex ? `/${batch.batchIndex}` : ''}
                      </span>
                      {batch.hasPendingScheduleSplit && (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '2px', border: '1px solid #fde68a' }}>
                          <Zap size={9} /> {batch.batchSchedule?.length} ПАРТІЇ
                        </span>
                      )}
                    </div>
                    <div style={{ background: statusBg, padding: '2px 5px', borderRadius: '4px', fontSize: '0.52rem', color: statusColor, fontWeight: 950, display: 'flex', alignItems: 'center', gap: '3px', border: `1px solid ${statusColor}33` }}>
                      {isCompleted ? <CheckCircle2 size={8} /> : (isReady ? <Scan size={8} /> : <Clock size={8} />)} {statusLabel}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 700, marginBottom: '2px' }}>{batch.customer}</div>
                  <div style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: 900, marginBottom: '8px', lineHeight: 1.2 }}>{batch.productNames}</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ОБСЯГ:</span>
                    <span style={{ fontSize: '0.84rem', color: '#059669', fontWeight: 900 }}>{batch.plannedSets} шт</span>
                  </div>
                </div>
              )
            })
          ) : (
            /* ERP 1C TABLE VIEW */
            <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', color: '#334155' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 900 }}>Наряд</th>
                    <th style={{ padding: '6px 8px', fontWeight: 900 }}>Клієнт</th>
                    <th style={{ padding: '6px 8px', fontWeight: 900 }}>Обсяг</th>
                    <th style={{ padding: '6px 8px', fontWeight: 900 }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map(batch => {
                    const isSelected = selectedBatch?.key === batch.key
                    const isCompleted = batch.packStatus === 'completed'
                    const isReady = batch.packStatus === 'ready'
                    let statusColor = '#d97706', statusLabel = 'ОЧІКУЄ'
                    if (isCompleted) { statusColor = '#64748b'; statusLabel = 'СПАКОВАНО' }
                    else if (isReady) { statusColor = '#059669'; statusLabel = 'ГОТОВО' }

                    return (
                      <tr
                        key={batch.key}
                        onClick={() => { setSelectedBatch(batch); setIsDrawerOpen(false); }}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : (isCompleted ? '#f8fafc' : '#ffffff'),
                          cursor: 'pointer',
                          fontWeight: isSelected ? 900 : 600,
                          opacity: isCompleted ? 0.6 : 1
                        }}
                      >
                        <td style={{ padding: '6px 8px', color: '#0f172a' }}>
                          <div>№ {batch.orderNum}{batch.batchIndex ? `/${batch.batchIndex}` : ''}</div>
                          {batch.hasPendingScheduleSplit && (
                            <span style={{ color: '#d97706', fontSize: '0.62rem', fontWeight: 800 }}>⚡ розбивка</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#475569' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                            {batch.customer}
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', color: '#059669', fontWeight: 900 }}>
                          {batch.plannedSets} шт
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <span style={{
                            padding: '2px 5px',
                            borderRadius: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            color: statusColor,
                            background: `${statusColor}18`
                          }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredBatches.length === 0 && (
            <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-muted, #64748b)', border: '2px dashed var(--border-color, #cbd5e1)', borderRadius: '16px' }}>
              <Package size={36} style={{ opacity: 0.2, margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>Не знайдено нарядів</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
