import React from 'react'
import { Link } from 'react-router-dom'

const InspectCardModal = ({ inspectCardModal, onClose, tasks = [], ordersMap = {}, orders = [] }) => {
  if (!inspectCardModal) return null

  const infoParts = (inspectCardModal.card_info || '').split(' ')
  const cardNumBadge = infoParts[0] && (infoParts[0].includes('/') || infoParts[0].includes('['))
    ? infoParts[0]
    : (inspectCardModal.card_number || `№ ${String(inspectCardModal.id).substring(0, 8)}`)
  const sysHexNum = `#${String(inspectCardModal.id).substring(0, 8).toUpperCase()}`

  const task = tasks.find(t => String(t.id) === String(inspectCardModal.task_id))
  const ord = ordersMap[inspectCardModal.order_id] || (task ? ordersMap[task.order_id] : null) || orders.find(o => String(o.id) === String(inspectCardModal.order_id))
  const orderNumText = ord?.order_num ? `№ ${ord.order_num}` : (inspectCardModal.order_id ? `№ ${String(inspectCardModal.order_id).substring(0, 8)}` : '—')

  const op = String(inspectCardModal.operation || '').toLowerCase()
  const isShop1Card = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(10px)',
      zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', boxSizing: 'border-box'
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #16161a)', border: '1px solid #ff9000', borderRadius: '24px',
          maxWidth: '600px', width: '100%', padding: '24px', boxShadow: '0 0 30px rgba(255,144,0,0.2)',
          color: 'var(--text, #f4f4f5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000',
                border: '1px solid rgba(255, 144, 0, 0.3)', padding: '2px 8px',
                borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900
              }}>
                № КАРТКИ: {cardNumBadge.startsWith('№') ? cardNumBadge.substring(1).trim() : cardNumBadge}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 0', fontSize: '1.3rem', fontWeight: 950, color: 'var(--text, #f4f4f5)', fontFamily: 'monospace' }}>
              СИСТЕМНИЙ НОМЕР: <span style={{ color: '#ff9000' }}>{sysHexNum}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--glass-border, rgba(0,0,0,0.1))', border: 'none', color: 'var(--text, #f4f4f5)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}
          >
            ✕
          </button>
        </div>

        <div style={{ background: 'var(--bg, #0d0d0f)', borderRadius: '16px', padding: '16px', border: '1px solid var(--glass-border, rgba(0,0,0,0.12))', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem' }}>
          <div>
            <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.68rem', fontWeight: 700 }}>ОПЕРАЦІЯ</div>
            <div style={{ fontWeight: 900, color: '#ff9000', fontSize: '0.95rem', marginTop: '2px' }}>{inspectCardModal.operation || '—'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.68rem', fontWeight: 700 }}>СТАТУС</div>
            <div style={{ fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{inspectCardModal.status}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.68rem', fontWeight: 700 }}>КІЛЬКІСТЬ</div>
            <div style={{ fontWeight: 900, color: 'var(--text, #f4f4f5)', fontSize: '1.1rem', marginTop: '2px' }}>{inspectCardModal.quantity} шт</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.68rem', fontWeight: 700 }}>БРАК / ВІДХОДИ</div>
            <div style={{ fontWeight: 900, color: inspectCardModal.scrap_qty > 0 ? '#ef4444' : 'var(--text-muted, #71717a)', marginTop: '2px' }}>{inspectCardModal.scrap_qty || 0} шт</div>
          </div>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '20px', lineHeight: 1.6 }}>
          <div><strong>Наряд:</strong> <span style={{ color: '#ff9000', fontWeight: 900 }}>{orderNumText}</span></div>
          <div><strong>Замовник:</strong> {ord?.customer || '—'}</div>
          <div><strong>Створено:</strong> {inspectCardModal.created_at ? new Date(inspectCardModal.created_at).toLocaleString('uk-UA') : '—'}</div>
          {inspectCardModal.completed_at && <div><strong>Завершено:</strong> {new Date(inspectCardModal.completed_at).toLocaleString('uk-UA')}</div>}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {isShop1Card ? (
            <Link
              to="/shop1"
              style={{
                flex: 1, textAlign: 'center', background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff', textDecoration: 'none', padding: '12px 16px', borderRadius: '12px',
                fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(2,132,199,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              🚀 Перейти до Терміналу Цеху №1
            </Link>
          ) : (
            <Link
              to="/shop2"
              style={{
                flex: 1, textAlign: 'center', background: 'linear-gradient(135deg, #ff9000, #ea580c)',
                color: '#fff', textDecoration: 'none', padding: '12px 16px', borderRadius: '12px',
                fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(255,144,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              🚀 Перейти до Терміналу Цеху №2
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default InspectCardModal
