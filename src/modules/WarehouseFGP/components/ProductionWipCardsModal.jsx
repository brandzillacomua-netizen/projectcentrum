import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Layers, Copy, Check, User, Clock, ArrowRight } from 'lucide-react'

export function ProductionWipCardsModal({
  item,
  isDark,
  t,
  onClose
}) {
  const [modalSearch, setModalSearch] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const cards = item?.cards || []

  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false
      if (!modalSearch.trim()) return true
      const q = modalSearch.toLowerCase().trim()
      const cId = String(c.id || '').toLowerCase()
      const op = String(c.subStage || c.operation || '').toLowerCase()
      const order = String(c.orderNumber || '').toLowerCase()
      const task = String(c.taskName || '').toLowerCase()
      return cId.includes(q) || op.includes(q) || order.includes(q) || task.includes(q)
    })
  }, [cards, stageFilter, modalSearch])

  const getStageColor = (stage) => {
    switch (stage) {
      case 'cnc':
        return { bg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', text: isDark ? '#38bdf8' : '#0284c7', border: isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd' }
      case 'tumbling':
        return { bg: isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff', text: isDark ? '#c084fc' : '#7e22ce', border: isDark ? 'rgba(168, 85, 247, 0.3)' : '#e9d5ff' }
      case 'sorting':
        return { bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', text: isDark ? '#fbbf24' : '#b45309', border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a' }
      case 'shop2':
        return { bg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe', text: isDark ? '#a78bfa' : '#6d28d9', border: isDark ? 'rgba(139, 92, 246, 0.3)' : '#ddd6fe' }
      default:
        return { bg: isDark ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9', text: isDark ? '#94a3b8' : '#475569', border: isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1' }
    }
  }

  if (!item) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: t.cardBg,
        border: `1.5px solid ${t.cardBorder}`,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '1050px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1.5px solid ${t.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: t.cardHeaderBg
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
                color: isDark ? '#38bdf8' : '#0284c7',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Layers size={13} />
                <span>НАПІВФАБРИКАТИ В РОБОТІ</span>
              </div>
              {item.code && item.code !== '—' && (
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: t.textSecondary }}>
                  Артикул: {item.code}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950, color: t.textPrimary }}>
              {item.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: t.textSecondary, fontWeight: 700 }}>
                Всього в роботі: <strong style={{ color: isDark ? '#38bdf8' : '#0284c7', fontSize: '0.95rem' }}>{Number(item.totalWip || 0).toLocaleString('uk-UA')} {item.unit}</strong>
              </span>
              <span style={{ fontSize: '0.78rem', color: t.textSecondary }}>•</span>
              <span style={{ fontSize: '0.82rem', color: t.textSecondary, fontWeight: 700 }}>
                Активних карток: <strong style={{ color: t.textPrimary }}>{cards.length}</strong>
              </span>
              {item.ordersList && item.ordersList.length > 0 && (
                <>
                  <span style={{ fontSize: '0.78rem', color: t.textSecondary }}>•</span>
                  <span style={{ fontSize: '0.82rem', color: t.textSecondary, fontWeight: 700 }}>
                    Наряди: <strong style={{ color: isDark ? '#a78bfa' : '#6d28d9' }}>{item.ordersList.join(', ')}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: t.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: '0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = t.textSecondary}
          >
            <X size={22} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: isDark ? 'rgba(0,0,0,0.1)' : '#f8fafc'
        }}>
          {/* Stage buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStageFilter('all')}
              style={{
                background: stageFilter === 'all' ? (isDark ? '#334155' : '#e2e8f0') : 'transparent',
                border: `1px solid ${stageFilter === 'all' ? (isDark ? '#475569' : '#cbd5e1') : 'transparent'}`,
                color: t.textPrimary,
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Всі ({cards.length})
            </button>
            <button
              onClick={() => setStageFilter('cnc')}
              style={{
                background: stageFilter === 'cnc' ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : 'transparent',
                border: `1px solid ${stageFilter === 'cnc' ? '#38bdf8' : 'transparent'}`,
                color: isDark ? '#38bdf8' : '#0284c7',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Розкрій ({cards.filter(c => c.stage === 'cnc').length})
            </button>
            <button
              onClick={() => setStageFilter('tumbling')}
              style={{
                background: stageFilter === 'tumbling' ? (isDark ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff') : 'transparent',
                border: `1px solid ${stageFilter === 'tumbling' ? '#a855f7' : 'transparent'}`,
                color: isDark ? '#c084fc' : '#7e22ce',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Галтовка ({cards.filter(c => c.stage === 'tumbling').length})
            </button>
            <button
              onClick={() => setStageFilter('sorting')}
              style={{
                background: stageFilter === 'sorting' ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7') : 'transparent',
                border: `1px solid ${stageFilter === 'sorting' ? '#f59e0b' : 'transparent'}`,
                color: isDark ? '#fbbf24' : '#b45309',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Сортування ({cards.filter(c => c.stage === 'sorting').length})
            </button>
            <button
              onClick={() => setStageFilter('shop2')}
              style={{
                background: stageFilter === 'shop2' ? (isDark ? 'rgba(139, 92, 246, 0.2)' : '#ede9fe') : 'transparent',
                border: `1px solid ${stageFilter === 'shop2' ? '#8b5cf6' : 'transparent'}`,
                color: isDark ? '#a78bfa' : '#6d28d9',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Цех 2 ({cards.filter(c => c.stage === 'shop2').length})
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
            <input
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                padding: '6px 10px 6px 30px',
                borderRadius: '10px',
                color: t.inputText,
                fontSize: '0.8rem',
                outline: 'none',
                width: '210px'
              }}
              placeholder="Пошук по ID або наряду..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px 24px' }}>
          {filteredCards.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: t.textSecondary }}>
              <Layers size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Не знайдено активних карток за заданими фільтрами</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: t.headBg, borderBottom: `1.5px solid ${t.border}`, color: t.textSecondary, fontWeight: 800, fontSize: '0.74rem' }}>
                  <th style={{ padding: '12px' }}>КАРТКА ID</th>
                  <th style={{ padding: '12px' }}>НАРЯД</th>
                  <th style={{ padding: '12px' }}>ЕТАП / ОПЕРАЦІЯ</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                  <th style={{ padding: '12px' }}>СТАТУС</th>
                  <th style={{ padding: '12px' }}>ОПЕРАТОР / ЗАВДАННЯ</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card, idx) => {
                  const fullCardId = String(card.id)
                  const shortCardId = `#${fullCardId.slice(-8).toUpperCase()}`
                  const isCopied = copiedId === fullCardId
                  const sc = getStageColor(card.stage)

                  return (
                    <tr key={card.id || idx} style={{ borderBottom: `1px solid ${t.rowBorder}`, background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.015)' : '#f8fafc') }}>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyId(fullCardId)}
                          style={{
                            background: isDark ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff',
                            border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
                            color: isDark ? '#38bdf8' : '#0284c7',
                            borderRadius: '8px',
                            padding: '3px 8px',
                            fontSize: '0.78rem',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={`Натисніть для копіювання повного ID: ${fullCardId}`}
                        >
                          <span>{shortCardId}</span>
                          {isCopied ? <Check size={12} color="#10b981" /> : <Copy size={11} style={{ opacity: 0.6 }} />}
                        </button>
                      </td>

                      <td style={{ padding: '12px', color: t.textPrimary, fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {card.orderNumber || 'Вільний запас'}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: sc.bg,
                          border: `1px solid ${sc.border}`,
                          color: sc.text,
                          fontWeight: 900,
                          fontSize: '0.8rem'
                        }}>
                          <span>{card.subStage || card.operation || card.stageName}</span>
                        </span>
                      </td>

                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                          border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
                          color: isDark ? '#38bdf8' : '#0284c7',
                          fontWeight: 950,
                          fontSize: '0.88rem'
                        }}>
                          {Number(card.quantity || 0).toLocaleString('uk-UA')} {item.unit}
                        </span>
                      </td>

                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: card.status.includes('buffer') ? (isDark ? '#fbbf24' : '#b45309') : (isDark ? '#34d399' : '#059669')
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: card.status.includes('buffer') ? '#f59e0b' : '#10b981' }} />
                          {card.status === 'in-progress' || card.status === 'in_progress' ? 'В роботі' : (card.status.includes('buffer') ? 'В буфері' : card.status)}
                        </span>
                      </td>

                      <td style={{ padding: '12px', color: t.textSecondary, fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} style={{ opacity: 0.7 }} />
                          <span>{card.operator || card.taskName || 'Цех'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1.5px solid ${t.rowBorder}`,
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: t.cardHeaderBg
        }}>
          <div style={{ fontSize: '0.82rem', color: t.textSecondary, fontWeight: 700 }}>
            Відображено: <strong style={{ color: t.textPrimary }}>{filteredCards.length}</strong> карток з сумою <strong style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>{filteredCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0).toLocaleString('uk-UA')} {item.unit}</strong>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '12px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: '0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#059669'}
            onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
          >
            ЗАКРИТИ
          </button>
        </div>
      </div>
    </div>
  )
}
