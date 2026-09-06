import React from 'react'
import { Link } from 'react-router-dom'
import { Package, Layers } from 'lucide-react'

const CellCardsModal = ({ selectedCellModal, onClose, onInspectCard, tasks = [], ordersMap = {}, orders = [] }) => {
  if (!selectedCellModal) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', boxSizing: 'border-box'
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #121215)', border: '1px solid var(--glass-border, rgba(0,0,0,0.12))', borderRadius: '24px',
          maxWidth: '900px', width: '100%', maxHeight: '85vh', display: 'flex',
          flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden', color: 'var(--text, #f4f4f5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.1))',
          background: 'var(--bg, #09090b)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={20} color="#ff9000" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text, #f4f4f5)' }}>
                {selectedCellModal.row?.name}
                {selectedCellModal.row?.code && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 600, marginLeft: '8px' }}>({selectedCellModal.row.code})</span>}
              </h3>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #71717a)', marginTop: '4px', fontWeight: 700 }}>
              Етап: <span style={{ color: '#ff9000' }}>{selectedCellModal.stageName}</span> | Всього на етапі: <strong style={{ color: 'var(--text, #f4f4f5)' }}>{selectedCellModal.val} шт</strong> ({selectedCellModal.cards.length} карток)
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--glass-border, rgba(0,0,0,0.1))', border: 'none', color: 'var(--text, #f4f4f5)',
              width: '32px', height: '32px', borderRadius: '50%',
              fontWeight: 900, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Content / Cards List */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: 'var(--card-bg, #121215)' }}>
          {selectedCellModal.cards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted, #71717a)' }}>
              <Layers size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>Фізичних робочих карток на цьому етапі зараз немає.</p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #52525b)', marginTop: '4px', display: 'block' }}>
                Показник розраховано за первинним планом або складом БЗ.
              </span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: 'var(--text, #f4f4f5)' }}>
              <thead>
                <tr style={{ background: 'var(--bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', textAlign: 'left', borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.1))' }}>
                  <th style={{ padding: '12px' }}>№ Картки / Системний номер</th>
                  <th style={{ padding: '12px' }}>Наряд</th>
                  <th style={{ padding: '12px' }}>Операція</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Статус</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Кількість</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Дія</th>
                </tr>
              </thead>
              <tbody>
                {selectedCellModal.cards.map(c => {
                  const task = tasks.find(t => String(t.id) === String(c.task_id))
                  const ord = ordersMap[c.order_id] || (task ? ordersMap[task.order_id] : null) || orders.find(o => String(o.id) === String(c.order_id))
                  const orderNumText = ord?.order_num ? `Наряд № ${ord.order_num}` : (c.order_id ? `№ ${String(c.order_id).substring(0, 8)}` : 'Без наряду')

                  const infoParts = (c.card_info || '').split(' ')
                  const cardNumBadge = infoParts[0] && (infoParts[0].includes('/') || infoParts[0].includes('[')) ? infoParts[0] : (c.card_number || `№ ${String(c.id).substring(0, 8)}`)
                  const sysHexNum = `#${String(c.id).substring(0, 8).toUpperCase()}`
                  const restCardInfo = infoParts.slice(cardNumBadge === infoParts[0] ? 1 : 0).join(' ')

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onInspectCard(c)}
                      style={{
                        borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.08))', transition: 'background 0.15s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--chip-bg, rgba(255,255,255,0.05))'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000',
                            border: '1px solid rgba(255, 144, 0, 0.3)', padding: '2px 8px',
                            borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900
                          }}>
                            {cardNumBadge.startsWith('№') ? cardNumBadge : `№ ${cardNumBadge}`}
                          </span>
                          <span style={{ fontWeight: 900, color: 'var(--text, #f4f4f5)', fontFamily: 'monospace', fontSize: '0.88rem', letterSpacing: '0.5px' }}>
                            {sysHexNum}
                          </span>
                        </div>
                        {restCardInfo && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #71717a)', marginTop: '4px' }}>{restCardInfo}</div>}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 900, color: 'var(--text, #f4f4f5)', fontSize: '0.88rem' }}>{orderNumText}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #71717a)' }}>{ord?.customer || '—'}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'var(--bg, #27272a)', color: 'var(--text, #f4f4f5)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                          {c.operation || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          background: c.status === 'completed' ? 'rgba(16,185,129,0.15)' : c.status === 'at-shop2-buffer' ? 'rgba(255,144,0,0.15)' : 'rgba(59,130,246,0.15)',
                          color: c.status === 'completed' ? '#10b981' : c.status === 'at-shop2-buffer' ? '#ff9000' : '#3b82f6',
                          border: c.status === 'completed' ? '1px solid rgba(16,185,129,0.3)' : c.status === 'at-shop2-buffer' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(59,130,246,0.3)',
                          padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 900, color: 'var(--text, #f4f4f5)', fontSize: '0.9rem' }}>
                        {c.quantity} шт
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onInspectCard(c)
                            }}
                            style={{
                              background: 'var(--bg, #27272a)',
                              color: 'var(--text, #f4f4f5)', border: '1px solid var(--glass-border, rgba(0,0,0,0.12))', padding: '6px 10px',
                              borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            🔎 Деталі
                          </button>
                          {['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => (c.operation || '').toLowerCase().includes(o)) ? (
                            <Link
                              to="/shop1"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                                color: '#fff', textDecoration: 'none', padding: '6px 10px',
                                borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                                boxShadow: '0 2px 6px rgba(2,132,199,0.3)'
                              }}
                            >
                              🚀 Термінал Цеху 1
                            </Link>
                          ) : (
                            <Link
                              to="/shop2"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: 'linear-gradient(135deg, #ff9000, #ea580c)',
                                color: '#fff', textDecoration: 'none', padding: '6px 10px',
                                borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                                boxShadow: '0 2px 6px rgba(255,144,0,0.3)'
                              }}
                            >
                              🚀 Термінал Цеху 2
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default CellCardsModal
