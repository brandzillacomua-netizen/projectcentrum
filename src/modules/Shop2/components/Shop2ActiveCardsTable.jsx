import React from 'react'
import { RefreshCw, Eye } from 'lucide-react'
import { formatElapsedTime, formatPlanned, getPlannedTime, formatMachine } from '../utils/shop2Helpers'

export function Shop2ActiveCardsTable({
  workCards = [],
  isShop2Card = () => false,
  isSyncing = false,
  setSelectedCardId = () => {},
  getNomFromCard = () => null
}) {
  const activeCards = workCards.filter(c => isShop2Card(c) && (c.status === 'in-progress' || c.status === 'at-buffer'))

  return (
    <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflowX: 'auto' }}>
      <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>ДЕТАЛІ В ПРОЦЕСІ (ЦЕХ №2)</h3>
        {isSyncing && <RefreshCw className="animate-spin" size={16} color="#8b5cf6" />}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
        <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
          <tr>
            <th style={{ padding: '12px 15px' }}>ДЕТАЛЬ</th>
            <th style={{ padding: '12px 15px' }}>ЕТАП</th>
            <th style={{ padding: '12px 15px' }}>К-СТЬ</th>
            <th style={{ padding: '12px 15px' }}>БРАК ЦЕХУ 2</th>
            <th style={{ padding: '12px 15px' }}>ВИХІД СГП</th>
            <th style={{ padding: '12px 15px' }}>МАЙСТЕР</th>
            <th style={{ padding: '12px 15px' }}>ЗМІНА</th>
            <th style={{ padding: '12px 15px' }}>ОПЕРАТОР</th>
            <th style={{ padding: '12px 15px' }}>ВЕРСТАТ</th>
            <th style={{ padding: '12px 15px' }}>ПЛАН. ЧАС</th>
            <th style={{ padding: '12px 15px' }}>ЧАС</th>
            <th style={{ padding: '12px 15px' }}></th>
          </tr>
        </thead>
        <tbody>
          {activeCards.map(card => {
            const scrap = Number(card.scrap_qty || 0)
            const netYield = Math.max(0, Number(card.quantity || 0) - scrap)
            const nom = typeof getNomFromCard === 'function' ? getNomFromCard(card) : null
            return (
              <tr key={card.id} 
                onClick={() => setSelectedCardId(card.id)}
                style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem', cursor: 'pointer' }}>
                <td style={{ padding: '12px 15px', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                  {nom?.name || (card.card_info?.split('] ').pop() || `Картка #${card.id.slice(0, 8)}`)}
                </td>
                <td style={{ padding: '12px 15px' }}>
                  <span style={{ color: card.status === 'at-buffer' ? '#10b981' : '#8b5cf6', fontWeight: 900, fontSize: '0.7rem' }}>
                    {card.operation?.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '12px 15px', fontWeight: 900 }}>{card.quantity} шт</td>
                
                {/* БРАК ЦЕХУ 2 */}
                <td style={{ padding: '12px 15px' }}>
                  <span style={{ color: scrap > 0 ? '#ef4444' : '#555', fontWeight: 900, fontSize: '0.8rem' }}>
                    {scrap > 0 ? `${scrap} шт` : '0'}
                  </span>
                </td>

                {/* ВИХІД СГП */}
                <td style={{ padding: '12px 15px' }}>
                  <span style={{ color: '#10b981', fontWeight: 950, fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                    {netYield} шт
                  </span>
                </td>

                <td style={{ padding: '12px 15px', color: '#888' }}>{card.manager_name || '—'}</td>
                <td style={{ padding: '12px 15px', color: '#888' }}>{card.shift_name || '—'}</td>
                <td style={{ padding: '12px 15px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                <td style={{ padding: '12px 15px', color: '#eab308', fontWeight: 800 }}>{formatMachine(card.machine)}</td>
                <td style={{ padding: '12px 15px', color: '#3b82f6', fontWeight: 700 }}>{formatPlanned(getPlannedTime(card, getNomFromCard))}</td>
                <td style={{ padding: '12px 15px', color: '#10b981' }}>{formatElapsedTime(card.started_at)}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id) }}
                    style={{ background: '#eab308', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Відкрити">
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            )
          })}
          {activeCards.length === 0 && (
            <tr><td colSpan="12" style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.8rem' }}>Немає активних процесів у другому цеху</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
