import React, { useState } from 'react'
import { CheckCircle2, Search, Archive } from 'lucide-react'

export function Shop2HistoryCardsList({
  workCards = [],
  orders = [],
  nomenclatures = [],
  shop2TaskIdsSet
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const historyCards = workCards.filter(card => {
    const isShop2Card = shop2TaskIdsSet?.has(String(card.task_id)) || card.card_info?.includes('[SHOP:2]')
    if (!isShop2Card) return false

    if (card.status !== 'completed') return false

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
      const order = orders.find(o => String(o.id) === String(card.order_id))
      const matchNom = nom?.name?.toLowerCase().includes(term)
      const matchOrder = order?.order_num?.toLowerCase().includes(term)
      if (!matchNom && !matchOrder) return false
    }

    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search Header */}
      <div style={{
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
        background: 'var(--card-bg, #ffffff)',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '2px solid var(--border, #cbd5e1)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
      }}>
        <div style={{ position: 'relative', flex: '1' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
          <input
            type="text"
            placeholder="Пошук в архіві РК за назвою деталі або нарядом..."
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
      </div>

      {/* Cards Table */}
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '20px',
        border: '2px solid var(--border, #cbd5e1)',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{
              background: 'var(--table-head, #f8fafc)',
              borderBottom: '2px solid var(--border, #cbd5e1)',
              color: 'var(--text-muted, #64748b)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 900
            }}>
              <th style={{ padding: '16px 20px' }}>Деталь</th>
              <th style={{ padding: '16px 20px' }}>Наряд</th>
              <th style={{ padding: '16px 20px' }}>Етап</th>
              <th style={{ padding: '16px 20px', textAlign: 'center' }}>Виконано</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {historyCards.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <Archive size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 900 }}>Архів виконаних РК Цеху №2 порожній.</div>
                </td>
              </tr>
            ) : (
              historyCards.map(card => {
                const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
                const order = orders.find(o => String(o.id) === String(card.order_id))

                return (
                  <tr key={card.id} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 950, color: 'var(--text, #0f172a)' }}>
                      {nom?.name || card.name || 'Невідома деталь'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 950
                      }}>
                        {order?.order_num || 'Без наряду'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#0369a1', fontWeight: 950 }}>
                      {card.operation || 'Пресування'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 950, color: '#059669', fontSize: '1rem' }}>
                      {card.quantity} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>шт</span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.8rem', fontWeight: 950 }}>
                        <CheckCircle2 size={16} /> ЗАВЕРШЕНО
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
