import React from 'react'
import { Layers, ClipboardList, Camera, X } from 'lucide-react'

const Shop1QueueCard = React.memo(({
  card,
  active,
  nom,
  orders,
  CHAIN,
  setSelectedCardId,
  setSelectedOperator,
  setIsDrawerOpen,
  setManualId
}) => {
  const isBuffer = card.status === 'at-buffer'
  const statusColor = isBuffer ? '#f59e0b' : '#3b82f6'
  const statusLabel = isBuffer ? `БУФЕР · ${card.operation}` : `НОВА · ${CHAIN.includes(card.operation) ? card.operation : 'Розкрій'}`
  const orderNum = orders?.find(o => o.id === card.order_id)?.order_num || ''

  const displayVal = React.useMemo(() => {
    const seqMatch = (card.card_info || '').match(/(\d+\/\d+)|(№\d+)/)
    return seqMatch ? (seqMatch[1] || seqMatch[2]) : null
  }, [card.card_info])

  return (
    <div
      onClick={() => {
        setSelectedCardId(card.id)
        setSelectedOperator('')
        if (setIsDrawerOpen) setIsDrawerOpen(false)
        if (setManualId) setManualId('')
      }}
      style={{
        background: active ? '#eab308' : '#111',
        color: active ? '#000' : '#fff',
        borderRadius: '16px', padding: '16px', marginBottom: '10px', cursor: 'pointer',
        border: `1px solid ${active ? '#eab308' : '#1a1a1a'}`,
        boxShadow: active ? '0 10px 20px rgba(234,179,8,0.15)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: active ? 'scale(1.02)' : 'scale(1)'
      }}>
      {/* Верхній рядок: Порядковий номер (Зліва) та Номер замовлення (Справа) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        {displayVal ? (
          <span style={{
            background: active ? 'rgba(0,0,0,0.15)' : '#eab30820',
            color: active ? '#000' : '#eab308',
            border: active ? '1px solid rgba(0,0,0,0.15)' : '1px solid #eab30840',
            padding: '2px 8px', borderRadius: '6px',
            fontSize: '0.65rem', fontWeight: 950
          }}>
            {displayVal}
          </span>
        ) : <div />}
        <div style={{ fontSize: '0.6rem', opacity: active ? 0.7 : 0.4, fontWeight: 600 }}>
          №{orderNum} · #{card.id.slice(-8).toUpperCase()}
        </div>
      </div>

      {/* Назва деталі */}
      <div style={{ marginBottom: '12px' }}>
        <strong style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '-0.01em', lineHeight: '1.2' }}>
          {nom?.name || 'Деталь'}
        </strong>
      </div>

      {/* Нижня частина: Кількість та Статус */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 1000, color: active ? '#000' : '#fff', lineHeight: 1 }}>
            {card.quantity}
            <span style={{ fontSize: '0.65rem', fontWeight: 800, marginLeft: '3px', opacity: 0.7 }}>шт</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          <span style={{
            fontSize: '0.55rem', fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em',
            background: active ? 'rgba(0,0,0,0.1)' : `${statusColor}15`,
            color: active ? '#000' : statusColor,
            padding: '3px 8px', borderRadius: '6px', border: active ? '1px solid rgba(0,0,0,0.1)' : 'none',
            display: 'inline-block'
          }}>{statusLabel}</span>
          {card.status === 'at-buffer' && card.operation === 'Розкрій' && (() => {
            const pColors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
            const pVal = card.galt_priority || 2
            return (
              <span style={{
                fontSize: '0.55rem', fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: active ? 'rgba(0,0,0,0.15)' : `${pColors[pVal]}15`,
                color: active ? '#000' : pColors[pVal],
                padding: '3px 8px', borderRadius: '6px',
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
})

export function Shop1QueueList({
  queueCards,
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
  selectedCardId,
  setSelectedCardId,
  setSelectedOperator,
  setIsDrawerOpen,
  setManualId,
  setIsScanning,
  getNom,
  orders,
  CHAIN,
  isMobile = false
}) {
  const uniqueFilteredQueueCards = React.useMemo(() => {
    const filtered = (queueCards || []).filter(card => {
      if (queueFilter === 'all') return true
      if (queueFilter === 'new') return card.status === 'new'
      if (queueFilter === 'at-buffer') return card.status === 'at-buffer'
      return true
    })
    return Array.from(new Map(filtered.map(c => [String(c.id), c])).values())
  }, [queueCards, queueFilter])

  const [visibleLimit, setVisibleLimit] = React.useState(50)

  // Reset visible limit when tab/section/task filter changes
  React.useEffect(() => {
    setVisibleLimit(50)
  }, [queueFilter, queueSectionFilter, selectedTaskFilter])

  // Ensure active selected card is visible even if it lies beyond initial limit
  React.useEffect(() => {
    if (!selectedCardId) return
    const idx = uniqueFilteredQueueCards.findIndex(c => c.id === selectedCardId)
    if (idx >= visibleLimit) {
      setVisibleLimit(idx + 15)
    }
  }, [selectedCardId, uniqueFilteredQueueCards])

  const visibleCards = React.useMemo(() => {
    return uniqueFilteredQueueCards.slice(0, visibleLimit)
  }, [uniqueFilteredQueueCards, visibleLimit])

  const handleQueueScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 250) {
      if (visibleLimit < uniqueFilteredQueueCards.length) {
        setVisibleLimit(prev => Math.min(prev + 40, uniqueFilteredQueueCards.length))
      }
    }
  }

  const renderQueueItems = () => (
    <div
      onScroll={handleQueueScroll}
      style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px', scrollbarWidth: 'none' }}
    >
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      {uniqueFilteredQueueCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Layers size={24} style={{ marginBottom: '10px', opacity: 0.2 }} /><br />
          {queueFilter === 'new' ? 'Немає нових карт' : queueFilter === 'at-buffer' ? 'Немає карт в буфері' : 'Черга порожня'}
        </div>
      )}
      {visibleCards.map(card => {
        const nom = getNom(card)
        const active = selectedCardId === card.id

        return (
          <Shop1QueueCard
            key={card.id}
            card={card}
            active={active}
            nom={nom}
            orders={orders}
            CHAIN={CHAIN}
            setSelectedCardId={setSelectedCardId}
            setSelectedOperator={setSelectedOperator}
            setIsDrawerOpen={setIsDrawerOpen}
            setManualId={setManualId}
          />
        )
      })}
      {visibleLimit < uniqueFilteredQueueCards.length && (
        <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
          <button
            onClick={() => setVisibleLimit(prev => Math.min(prev + 50, uniqueFilteredQueueCards.length))}
            style={{
              background: '#1a1a24',
              border: '1px solid #2d2d3d',
              color: '#aaa',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Показано {visibleCards.length} з {uniqueFilteredQueueCards.length} · Завантажити ще
          </button>
        </div>
      )}
    </div>
  )

  const filterControls = (
    <>
      <div>
        <select
          value={queueSectionFilter}
          onChange={e => setQueueSectionFilter(e.target.value)}
          style={{
            width: '100%', background: '#18181f', border: '1px solid #2a2a35', color: '#fff',
            padding: '8px 10px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800,
            outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="all">🌐 УСІ ДІЛЬНИЦІ</option>
          <option value="Розкрій">📐 РОЗКРІЙ (НОВІ)</option>
          <option value="Галтовка">🌀 ГАЛТОВКА (БУФЕР)</option>
          <option value="Прийомка">📦 ПРИЙОМКА (БУФЕР)</option>
          <option value="Сортування">🔍 СОРТУВАННЯ (БУФЕР)</option>
        </select>
      </div>

      <div>
        <select
          value={selectedTaskFilter}
          onChange={e => setSelectedTaskFilter(e.target.value)}
          style={{
            width: '100%', background: '#18181f', border: '1px solid #2a2a35', color: '#fff',
            padding: '8px 10px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800,
            outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="all">📋 УСІ НАРЯДИ</option>
          {(queueTasksOptions || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <select
          value={selectedNomFilter}
          onChange={e => setSelectedNomFilter(e.target.value)}
          style={{
            width: '100%', background: '#18181f', border: '1px solid #2a2a35', color: '#fff',
            padding: '8px 10px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800,
            outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="all">🔍 УСІ ДЕТАЛІ</option>
          {(queueNomOptions || []).map(nom => (
            <option key={nom.id} value={nom.id}>{nom.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {[['all', 'ВСІ'], ['new', 'НОВІ'], ['at-buffer', 'БУФЕР']].map(([val, label]) => (
          <button key={val} onClick={() => setQueueFilter(val)} style={{
            flex: 1, padding: isMobile ? '6px 0' : '5px 0', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: isMobile ? '0.6rem' : '0.55rem', fontWeight: 900, letterSpacing: '0.02em',
            transition: 'all 0.15s',
            background: queueFilter === val
              ? (val === 'new' ? '#3b82f6' : val === 'at-buffer' ? '#f59e0b' : '#fff')
              : '#1a1a1a',
            color: queueFilter === val
              ? (val === 'all' ? '#000' : '#fff')
              : '#555',
            boxShadow: queueFilter === val ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
          }}>{label}</button>
        ))}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <>
        <div className="drawer-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '15px 20px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
            <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
          </div>
          {filterControls}
        </div>
        {renderQueueItems()}
      </>
    )
  }

  return (
    <>
      <div style={{ padding: '20px 15px 15px', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
        </div>
        {filterControls}
      </div>
      {renderQueueItems()}
      <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
        <button onClick={() => setIsScanning(true)}
          style={{ width: '100%', background: '#eab30815', border: '1px solid #eab30830', color: '#eab308', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Camera size={18} /> СКАНУВАТИ
        </button>
      </div>
    </>
  )
}
