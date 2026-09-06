import React from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Play, Wrench } from 'lucide-react'

const STATUS = {
  new: { label: 'ОЧІКУЄ', color: '#f59e0b' },
  in_progress: { label: 'В РОБОТІ', color: '#06b6d4' },
  completed: { label: 'ЗАВЕРШЕНО', color: '#10b981' }
}

export const VKYARestorationCardGrid = ({
  tab,
  loading,
  paginatedCards,
  legacyItems,
  onSelectCard,
  onSelectLegacy,
  currentPage,
  setCurrentPage,
  totalPages
}) => {
  if (tab === 'legacy') {
    return (
      <div style={{ background: 'var(--card-bg, #121212)', border: '1px solid var(--glass-border, #222)', borderRadius: 16, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', color: '#f59e0b' }}>Брак зі старого обліку (потребує відновлення)</h3>
        {legacyItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, #666)' }}>Немає позицій старого обліку браку</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border, #222)', color: 'var(--text-muted, #777)', textAlign: 'left' }}>
                <th style={{ padding: 10 }}>Назва деталі</th>
                <th style={{ padding: 10 }}>Кількість</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Дія</th>
              </tr>
            </thead>
            <tbody>
              {legacyItems.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border, #1a1a1a)' }}>
                  <td style={{ padding: 10, fontWeight: 700 }}>{item.name}</td>
                  <td style={{ padding: 10, color: '#f59e0b', fontWeight: 900 }}>{item.total_qty} {item.unit || 'шт'}</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectLegacy(item)}
                      style={{ background: '#f59e0b', border: 0, color: '#000', padding: '6px 12px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}
                    >
                      Створити карту відновлення
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="vkya-card-grid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1', padding: 60, textAlign: 'center', color: 'var(--text-muted, #777)' }}>Завантаження карт...</div>
        ) : paginatedCards.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 60, textAlign: 'center', color: 'var(--text-muted, #777)' }}>Немає карт відновлення у цьому розділі</div>
        ) : paginatedCards.map(card => {
          const st = STATUS[card.status] || STATUS.new
          return (
            <div key={card.id} className="vkya-card" onClick={() => onSelectCard(card)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ background: `${st.color}22`, color: st.color, border: `1px solid ${st.color}44`, padding: '2px 8px', borderRadius: 6, fontSize: '.68rem', fontWeight: 950 }}>
                  {st.label}
                </span>
                <span style={{ fontSize: '.72rem', color: 'var(--text-muted, #666)', fontWeight: 800 }}>№{card.card_number}</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 900, color: 'var(--text, #fff)' }}>{card.nomenclature_name}</h3>
              <div style={{ fontSize: '.78rem', color: '#06b6d4', fontWeight: 800, marginBottom: 8 }}>{card.restoration_stage}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--text-muted, #888)' }}>
                <span>Кількість: <strong style={{ color: 'var(--text, #fff)' }}>{card.quantity} {card.unit}</strong></span>
                {card.operator_name && <span>{card.operator_name}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ background: 'var(--card-bg, #141414)', border: '1px solid var(--glass-border, #282828)', color: currentPage === 1 ? 'var(--text-dim, #444)' : 'var(--text, #fff)', borderRadius: 9, padding: '7px 14px', cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.82rem', fontWeight: 900 }}
          >
            <ChevronLeft size={16}/> Назад
          </button>
          <span style={{ color: 'var(--text-muted, #aaa)', fontSize: '.82rem', fontWeight: 800 }}>
            Сторінка {currentPage} з {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ background: 'var(--card-bg, #141414)', border: '1px solid var(--glass-border, #282828)', color: currentPage === totalPages ? 'var(--text-dim, #444)' : 'var(--text, #fff)', borderRadius: 9, padding: '7px 14px', cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.82rem', fontWeight: 900 }}
          >
            Вперед <ChevronRight size={16}/>
          </button>
        </div>
      )}
    </div>
  )
}

export default VKYARestorationCardGrid
