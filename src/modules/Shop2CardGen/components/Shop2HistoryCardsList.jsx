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
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'var(--card-bg, #0a0a0a)', padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border, #1a1a1a)' }}>
        <div style={{ position: 'relative', flex: '1' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #555)' }} />
          <input
            type="text"
            placeholder="Пошук в архіві РК за назвою деталі або нарядом..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid var(--border, #222)', color: 'var(--text, #fff)', padding: '10px 14px 10px 40px', borderRadius: '12px', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Cards Table */}
      <div style={{ background: 'var(--card-bg, #0a0a0a)', borderRadius: '20px', border: '1px solid var(--border, #1a1a1a)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--table-head, #050505)', borderBottom: '1px solid var(--border, #1a1a1a)', color: 'var(--text-muted, #666)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                <td colSpan="5" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #444)' }}>
                  <Archive size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div>Архів виконаних РК Цеху №2 порожній.</div>
                </td>
              </tr>
            ) : (
              historyCards.map(card => {
                const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
                const order = orders.find(o => String(o.id) === String(card.order_id))

                return (
                  <tr key={card.id} style={{ borderBottom: '1px solid var(--border, #111)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 900, color: 'var(--text, #fff)' }}>
                      {nom?.name || card.name || 'Невідома деталь'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ background: 'var(--border, #161616)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.2)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900 }}>
                        {order?.order_num || 'Без наряду'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#38bdf8', fontWeight: 800 }}>
                      {card.operation || 'Пресування'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 950, color: '#10b981' }}>
                      {card.quantity} <span style={{ fontSize: '0.65rem' }}>шт</span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.75rem', fontWeight: 900 }}>
                        <CheckCircle2 size={14} /> ЗАВЕРШЕНО
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
