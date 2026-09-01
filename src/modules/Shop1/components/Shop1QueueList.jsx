import React from 'react'
import { X, Layers, AlertTriangle } from 'lucide-react'
import { CHAIN } from '../hooks/useShop1Data'

export function Shop1QueueList({
  queueCards,
  selectedCardId,
  setSelectedCardId,
  setSelectedOperator,
  isDrawerOpen,
  setIsDrawerOpen,
  setManualId,
  queueFilter,
  setQueueFilter,
  queueSectionFilter,
  setQueueSectionFilter,
  selectedTaskFilter,
  setSelectedTaskFilter,
  selectedNomFilter,
  setSelectedNomFilter,
  queueTasksOptions,
  queueNomOptions,
  orders,
  getNom
}) {
  const filteredQueueCards = queueCards.filter(card => {
    if (queueFilter === 'all') return true
    if (queueFilter === 'new') return card.status === 'new'
    if (queueFilter === 'at-buffer') return card.status === 'at-buffer'
    return true
  })

  return (
    <div
      className={`side-panel no-print ${isDrawerOpen ? 'drawer-open' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', background: '#121212', borderRight: '1px solid #222', transition: '0.3s transform' }}
    >
      <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        ЧЕРГА НАРЯДІВ ({filteredQueueCards.length})
        {isDrawerOpen && (
          <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Фільтри черги */}
      <div style={{ padding: '0 15px 15px', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['all', 'new', 'at-buffer'].map(f => (
            <button
              key={f}
              onClick={() => setQueueFilter(f)}
              style={{
                flex: 1,
                background: queueFilter === f ? '#eab308' : '#111',
                color: queueFilter === f ? '#000' : '#888',
                border: 'none',
                padding: '8px 4px',
                borderRadius: '8px',
                fontSize: '0.65rem',
                fontWeight: 900,
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {f === 'all' ? 'Всі' : f === 'new' ? 'Нові' : 'Буфер'}
            </button>
          ))}
        </div>

        <select
          value={queueSectionFilter}
          onChange={(e) => setQueueSectionFilter(e.target.value)}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
        >
          <option value="all">Усі процеси Цеху №1</option>
          <option value="Розкрій">Розкрій (Нові картки)</option>
          <option value="Галтовка">Галтовка (З буфера Розкрою)</option>
          <option value="Прийомка">Прийомка (З буфера Галтовки)</option>
          <option value="Сортування">Сортування (З буфера Прийомки)</option>
        </select>

        <select
          value={selectedTaskFilter}
          onChange={(e) => setSelectedTaskFilter(e.target.value)}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
        >
          <option value="all">Усі наряди (замовлення)</option>
          {queueTasksOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select
          value={selectedNomFilter}
          onChange={(e) => setSelectedNomFilter(e.target.value)}
          disabled={selectedTaskFilter === 'all' && queueNomOptions.length === 0}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, opacity: (selectedTaskFilter === 'all' && queueNomOptions.length === 0) ? 0.4 : 1 }}
        >
          <option value="all">Усі деталі</option>
          {queueNomOptions.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px 12px 20px', scrollbarWidth: 'none' }}>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {filteredQueueCards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Layers size={24} style={{ marginBottom: '10px', opacity: 0.2 }} /><br />
            {queueFilter === 'new' ? 'Немає нових карт' : queueFilter === 'at-buffer' ? 'Немає карт в буфері' : 'Черга порожня'}
          </div>
        )}
        {filteredQueueCards.map(card => {
          const nom = getNom(card)
          const active = selectedCardId === card.id
          const isBuffer = card.status === 'at-buffer'
          const statusColor = isBuffer ? '#f59e0b' : '#3b82f6'
          const statusLabel = isBuffer ? `БУФЕР · ${card.operation}` : `НОВА · ${CHAIN.includes(card.operation) ? card.operation : 'Розкрій'}`

          return (
            <div
              key={card.id}
              onClick={() => {
                setSelectedCardId(card.id)
                setSelectedOperator('')
                setIsDrawerOpen(false)
                setManualId('')
              }}
              style={{
                background: active ? '#eab308' : '#111',
                color: active ? '#000' : '#fff',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '10px',
                cursor: 'pointer',
                border: `1px solid ${active ? '#eab308' : '#1a1a1a'}`,
                boxShadow: active ? '0 10px 20px rgba(234,179,8,0.15)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: active ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                {(() => {
                  const seqMatch = (card.card_info || '').match(/(\d+\/\d+)|(№\d+)/)
                  const displayVal = seqMatch ? (seqMatch[1] || seqMatch[2]) : null
                  return displayVal ? (
                    <span style={{
                      background: active ? 'rgba(0,0,0,0.15)' : '#eab30820',
                      color: active ? '#000' : '#eab308',
                      border: active ? '1px solid rgba(0,0,0,0.15)' : '1px solid #eab30840',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 950
                    }}>
                      {displayVal}
                    </span>
                  ) : <div />
                })()}
                <div style={{ fontSize: '0.6rem', opacity: active ? 0.7 : 0.4, fontWeight: 600 }}>
                  №{orders?.find(o => o.id === card.order_id)?.order_num || ''} · #{card.id.slice(-8).toUpperCase()}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '-0.01em', lineHeight: '1.2' }}>
                  {nom?.name || 'Деталь'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 1000, color: active ? '#000' : '#fff', lineHeight: 1 }}>
                    {card.quantity}
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, marginLeft: '3px', opacity: 0.7 }}>шт</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                  <span style={{
                    fontSize: '0.55rem',
                    fontWeight: 1000,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: active ? 'rgba(0,0,0,0.1)' : `${statusColor}15`,
                    color: active ? '#000' : statusColor,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: active ? '1px solid rgba(0,0,0,0.1)' : 'none',
                    display: 'inline-block'
                  }}>
                    {statusLabel}
                  </span>
                  {card.status === 'at-buffer' && card.operation === 'Розкрій' && (() => {
                    const pColors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                    const pVal = card.galt_priority || 2
                    return (
                      <span style={{
                        fontSize: '0.55rem',
                        fontWeight: 1000,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: active ? 'rgba(0,0,0,0.15)' : `${pColors[pVal]}15`,
                        color: active ? '#000' : pColors[pVal],
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: active ? '1px solid rgba(0,0,0,0.1)' : `1px solid ${pColors[pVal]}30`,
                        display: 'inline-block'
                      }}>
                        ⚠️ ПРІОР: {pVal}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
