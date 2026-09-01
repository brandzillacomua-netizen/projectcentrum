import React, { useState } from 'react'
import { Clock, Search, Cpu } from 'lucide-react'
import { isShop2WorkCard } from '../hooks/useShop2BufferData'

export function Shop2ActiveCardsList({
  workCards = [],
  orders = [],
  nomenclatures = [],
  shop2TaskIdsSet
}) {
  const [searchTerm, setSearchTerm] = useState('')

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
      if (!matchNom && !matchOrder && !matchOp) return false
    }

    return true
  })

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in-progress':
        return <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900 }}>В РОБОТІ</span>
      case 'completed':
        return <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900 }}>ЗАВЕРШЕНО</span>
      default:
        return <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900 }}>ОЧІКУЄ</span>
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search Header */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'var(--card-bg, #0a0a0a)', padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border, #1a1a1a)' }}>
        <div style={{ position: 'relative', flex: '1' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #555)' }} />
          <input
            type="text"
            placeholder="Пошук активних РК за назвою деталі, операцією або нарядом..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid var(--border, #222)', color: 'var(--text, #fff)', padding: '10px 14px 10px 40px', borderRadius: '12px', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Cards Grid */}
      {activeCards.length === 0 ? (
        <div style={{ background: 'var(--card-bg, #0a0a0a)', borderRadius: '20px', border: '1px solid var(--border, #1a1a1a)', padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #444)' }}>
          <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div>Немає активних робочих карток у Цеху №2.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {activeCards.map(card => {
            const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
            const order = orders.find(o => String(o.id) === String(card.order_id))

            return (
              <div key={card.id} style={{ background: 'var(--card-bg, #0a0a0a)', border: '1px solid var(--border, #1c1c1c)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ background: 'var(--border, #161616)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.2)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>
                      {order?.order_num || 'Без наряду'}
                    </span>
                    <div style={{ fontWeight: 950, color: 'var(--text, #fff)', fontSize: '0.95rem', marginTop: '6px' }}>
                      {nom?.name || card.name || 'Невідома деталь'}
                    </div>
                  </div>
                  {getStatusBadge(card.status)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--input-bg, #040404)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border, #141414)' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', textTransform: 'uppercase', fontWeight: 800 }}>Етап / Операція</div>
                    <div style={{ fontSize: '0.88rem', color: '#38bdf8', fontWeight: 900, marginTop: '2px' }}>{card.operation || 'Пресування'}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', textTransform: 'uppercase', fontWeight: 800 }}>Обсяг партій</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--text, #fff)', fontWeight: 950 }}>
                      {card.quantity} <small style={{ fontSize: '0.65rem', color: 'var(--text-muted, #666)' }}>шт</small>
                    </div>
                  </div>
                </div>

                {card.machine && card.machine !== 'Не вказано' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted, #777)' }}>
                    <Cpu size={14} color="#ff9000" />
                    <span>Верстат: {card.machine}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
