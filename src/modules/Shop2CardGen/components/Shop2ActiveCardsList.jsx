import React, { useState } from 'react'
import { Clock, Search, Cpu, Printer, X, CheckSquare, Square, CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { isShop2WorkCard } from '../hooks/useShop2BufferData'

export function Shop2ActiveCardsList({
  workCards = [],
  orders = [],
  nomenclatures = [],
  shop2TaskIdsSet
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCardIds, setSelectedCardIds] = useState(new Set())
  const [printModalCards, setPrintModalCards] = useState(null)

  // Filter cards belonging to Shop 2 that are in active status
  const activeCards = workCards.filter(card => {
    const isShop2 = isShop2WorkCard(card, shop2TaskIdsSet)
    if (!isShop2) return false

    const isRunning = ['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer'].includes(card.status)
    if (!isRunning) return false

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
      const order = orders.find(o => String(o.id) === String(card.order_id))
      const matchNom = nom?.name?.toLowerCase().includes(term)
      const matchOrder = order?.order_num?.toLowerCase().includes(term)
      const matchOp = String(card.operation || '').toLowerCase().includes(term)
      const matchCode = String(card.id || '').toLowerCase().includes(term)
      if (!matchNom && !matchOrder && !matchOp && !matchCode) return false
    }

    return true
  })

  // Selection helpers
  const toggleSelectCard = (id) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedCardIds.size === activeCards.length && activeCards.length > 0) {
      setSelectedCardIds(new Set())
    } else {
      setSelectedCardIds(new Set(activeCards.map(c => c.id)))
    }
  }

  const handleOpenPrintModal = (cardsToPrint = null) => {
    const targetCards = cardsToPrint || (selectedCardIds.size > 0 
      ? activeCards.filter(c => selectedCardIds.has(c.id))
      : activeCards)
    if (!targetCards || targetCards.length === 0) return
    setPrintModalCards(targetCards)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in-progress':
        return (
          <span style={{
            background: '#059669',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: 950,
            boxShadow: '0 2px 6px rgba(5,150,105,0.3)'
          }}>
            ⚡ В РОБОТІ
          </span>
        )
      case 'completed':
        return (
          <span style={{
            background: '#0284c7',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: 950
          }}>
            ✅ ЗАВЕРШЕНО
          </span>
        )
      default:
        return (
          <span style={{
            background: '#d97706',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: 950
          }}>
            ⏳ ОЧІКУЄ
          </span>
        )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Header */}
      <div style={{
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--card-bg, #ffffff)',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '2px solid var(--border, #cbd5e1)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
          <input
            type="text"
            placeholder="Пошук активних РК за назвою деталі, операцією або нарядом..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--input-bg, #f8fafc)',
              border: '1.5px solid var(--border, #cbd5e1)',
              color: 'var(--text, #0f172a)',
              padding: '10px 14px 10px 40px',
              borderRadius: '12px',
              fontSize: '0.88rem',
              fontWeight: 700,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Selection & Print Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {activeCards.length > 0 && (
            <button
              onClick={toggleSelectAll}
              style={{
                background: 'var(--input-bg, #f1f5f9)',
                border: '1.5px solid var(--border, #cbd5e1)',
                color: 'var(--text, #0f172a)',
                padding: '9px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 950,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {selectedCardIds.size === activeCards.length ? <CheckSquare size={16} color="#0284c7" /> : <Square size={16} />}
              Виділити всі ({activeCards.length})
            </button>
          )}

          <button
            onClick={() => handleOpenPrintModal()}
            disabled={activeCards.length === 0}
            style={{
              background: selectedIdsCount(selectedCardIds) > 0 ? '#ff9000' : 'var(--card-bg, #ffffff)',
              color: selectedIdsCount(selectedCardIds) > 0 ? '#ffffff' : 'var(--text, #0f172a)',
              border: selectedIdsCount(selectedCardIds) > 0 ? 'none' : '1.5px solid var(--border, #cbd5e1)',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 950,
              cursor: activeCards.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: selectedIdsCount(selectedCardIds) > 0 ? '0 4px 12px rgba(255,144,0,0.3)' : 'none',
              opacity: activeCards.length === 0 ? 0.5 : 1
            }}
          >
            <Printer size={16} />
            {selectedCardIds.size > 0 
              ? `ДРУКУВАТИ ОБРАНІ (${selectedCardIds.size})` 
              : `ДРУКУВАТИ ВСІ (${activeCards.length})`}
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {activeCards.length === 0 ? (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '20px',
          border: '2px solid var(--border, #cbd5e1)',
          padding: '50px 20px',
          textAlign: 'center',
          color: 'var(--text-muted, #64748b)'
        }}>
          <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 900 }}>Немає активних робочих карток у Цеху №2.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {activeCards.map(card => {
            const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
            const order = orders.find(o => String(o.id) === String(card.order_id))
            const isSelected = selectedCardIds.has(card.id)

            return (
              <div
                key={card.id}
                onClick={() => toggleSelectCard(card.id)}
                style={{
                  background: isSelected ? 'var(--card-selected-bg, #f0f9ff)' : 'var(--card-bg, #ffffff)',
                  border: isSelected ? '3px solid #0284c7' : '2px solid var(--border, #cbd5e1)',
                  borderRadius: '18px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: isSelected ? '0 8px 20px rgba(2,132,199,0.18)' : '0 4px 14px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Header Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {isSelected ? (
                        <CheckSquare size={20} color="#0284c7" />
                      ) : (
                        <Square size={20} color="var(--text-muted, #94a3b8)" />
                      )}
                    </div>

                    {/* Order Number Badge */}
                    <span style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 950,
                      letterSpacing: '0.5px'
                    }}>
                      {order?.order_num || 'Без наряду'}
                    </span>

                    {/* System Card Code */}
                    <span style={{
                      background: '#0f172a',
                      color: '#fbbf24',
                      border: '1.5px solid #475569',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 950,
                      fontFamily: 'monospace'
                    }}>
                      #{card.id.slice(-8).toUpperCase()}
                    </span>
                  </div>

                  {getStatusBadge(card.status)}
                </div>

                {/* Nomenclature Name */}
                <div style={{ fontWeight: 950, color: 'var(--text, #0f172a)', fontSize: '1.05rem', lineHeight: 1.3 }}>
                  {nom?.name || card.name || 'Невідома деталь'}
                </div>

                {/* Operation & Quantity Container - CLEAN HIGH CONTRAST LIGHT/DARK BOX */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--input-bg, #f1f5f9)',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border, #cbd5e1)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900 }}>
                      Етап / Операція
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--op-text, #0369a1)', fontWeight: 950, marginTop: '2px' }}>
                      {card.operation || 'Пресування'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900 }}>
                      Обсяг партій
                    </div>
                    <div style={{ fontSize: '1.15rem', color: '#059669', fontWeight: 950 }}>
                      {card.quantity} <small style={{ fontSize: '0.7rem', color: 'var(--text-muted, #475569)' }}>шт</small>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer: Machine & Quick Print Icon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  {card.machine && card.machine !== 'Не вказано' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted, #475569)', fontWeight: 900 }}>
                      <Cpu size={15} color="#d97706" />
                      <span>Верстат: <strong>{card.machine}</strong></span>
                    </div>
                  ) : (
                    <div />
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenPrintModal([card])
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      fontSize: '0.78rem',
                      fontWeight: 950,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}
                    title="Друк цієї картки"
                  >
                    <Printer size={15} /> Друк
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ───── SHOP 2 CARD PRINT MODAL ───── */}
      {printModalCards && (
        <div className="print-modal-backdrop" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            color: '#0f172a',
            padding: '28px',
            borderRadius: '24px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
          }}>
            {/* Modal Header */}
            <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 950, color: '#0f172a' }}>
                  🖨️ Друк Робочих Карт Цеху №2
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', fontWeight: 800 }}>
                  Кількість карток до друку: {printModalCards.length} шт
                </div>
              </div>
              <button
                onClick={() => setPrintModalCards(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} color="#0f172a" />
              </button>
            </div>

            {/* Print Cards Grid */}
            <div className="print-cards-grid" style={{
              display: 'grid',
              gridTemplateColumns: printModalCards.length > 1 ? 'repeat(auto-fill, minmax(360px, 1fr))' : '1fr',
              gap: '16px'
            }}>
              {printModalCards.map((card) => {
                const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
                const order = orders.find(o => String(o.id) === String(card.order_id))

                return (
                  <div
                    key={card.id}
                    className="shop2-print-card"
                    style={{
                      background: '#ffffff',
                      color: '#000000',
                      border: '2px solid #000000',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* QR Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <QRCodeSVG
                        value={JSON.stringify({ id: card.id, type: 'work_card_shop2' })}
                        size={110}
                        level="H"
                        includeMargin={true}
                      />
                      <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: 950, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                        #{card.id.slice(-8).toUpperCase()}
                      </div>
                    </div>

                    {/* Info Section */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>
                        Робоча картка Цех №2
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 950, color: '#000000' }}>
                        Наряд: {order?.order_num || 'Без наряду'}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#000000', lineHeight: 1.2 }}>
                        {nom?.name || card.name || 'Деталь'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Етап</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 950, color: '#0284c7' }}>{card.operation || 'Пресування'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Кількість</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#059669' }}>{card.quantity} шт</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Print Trigger Button */}
            <button
              className="print-hide"
              onClick={() => window.print()}
              style={{
                width: '100%',
                background: '#ff9000',
                color: '#ffffff',
                border: 'none',
                padding: '16px',
                borderRadius: '16px',
                fontWeight: 950,
                fontSize: '1.05rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginTop: '24px',
                boxShadow: '0 8px 20px rgba(255,144,0,0.3)'
              }}
            >
              <Printer size={20} />
              ДРУКУВАТИ КАРТКИ ({printModalCards.length} шт)
            </button>
          </div>
        </div>
      )}

      {/* Print CSS Rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-modal-backdrop, .print-modal-backdrop * {
            visibility: visible;
          }
          .print-modal-backdrop {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            padding: 0 !important;
          }
          .print-hide {
            display: none !important;
          }
          .shop2-print-card {
            page-break-inside: avoid;
            border: 2px solid #000 !important;
          }
        }
      `}</style>
    </div>
  )
}

function selectedIdsCount(set) {
  return set ? set.size : 0
}
