import React, { useState, useEffect } from 'react'
import { CheckCircle2, Search, Archive, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { isShop2WorkCard } from '../hooks/useShop2BufferData'

export function Shop2HistoryCardsList({
  workCards = [],
  orders = [],
  nomenclatures = [],
  shop2TaskIdsSet,
  isLoading = false
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const historyCards = workCards.filter(card => {
    const isShop2Card = isShop2WorkCard(card, shop2TaskIdsSet)
    if (!isShop2Card) return false

    if (card.status !== 'completed') return false

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
      const order = orders.find(o => String(o.id) === String(card.order_id))
      const matchNom = nom?.name?.toLowerCase().includes(term)
      const matchOrder = order?.order_num?.toLowerCase().includes(term)
      const matchOp = card.operation?.toLowerCase().includes(term)
      if (!matchNom && !matchOrder && !matchOp) return false
    }

    return true
  })

  const totalItems = historyCards.length
  const effectiveSize = pageSize === 'all' ? (totalItems || 1) : Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(totalItems / effectiveSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * effectiveSize
  const endIndex = pageSize === 'all' ? totalItems : Math.min(startIndex + effectiveSize, totalItems)
  const displayedCards = pageSize === 'all' ? historyCards : historyCards.slice(startIndex, endIndex)

  const navBtnStyle = (disabled) => ({
    background: disabled ? 'var(--input-bg, #f1f5f9)' : 'var(--card-bg, #ffffff)',
    border: '1.5px solid var(--border, #cbd5e1)',
    borderRadius: '10px',
    padding: '6px 12px',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: disabled ? 'var(--text-muted, #94a3b8)' : 'var(--text, #0f172a)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease'
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
              <th style={{ padding: '16px 20px' }}>Дата / час</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {displayedCards.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <Archive size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 900 }}>
                    {isLoading ? 'Завантаження архіву виконаних РК Цеху №2…' : 'Архів виконаних РК Цеху №2 порожній.'}
                  </div>
                </td>
              </tr>
            ) : (
              displayedCards.map(card => {
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
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted, #64748b)', fontWeight: 750, whiteSpace: 'nowrap' }}>
                      {card.completed_at
                        ? new Date(card.completed_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'medium' })
                        : '—'}
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

        {/* ── PAGINATION CONTROLS ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          background: 'var(--table-head, #f8fafc)',
          borderTop: '2px solid var(--border, #cbd5e1)'
        }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
            {totalItems > 0 ? (
              <>
                Показано <strong style={{ color: 'var(--text, #0f172a)' }}>{startIndex + 1}–{endIndex}</strong> з <strong style={{ color: '#0284c7' }}>{totalItems.toLocaleString('uk-UA')}</strong> записів
              </>
            ) : (
              'Записи відсутні'
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
              <span>На сторінці:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value)
                  setPageSize(val)
                  setCurrentPage(1)
                }}
                style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1.5px solid var(--border, #cbd5e1)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  color: 'var(--text, #0f172a)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value="all">Усі ({totalItems})</option>
              </select>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  style={navBtnStyle(safePage === 1)}
                  title="Перша сторінка"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  style={navBtnStyle(safePage === 1)}
                  title="Попередня сторінка"
                >
                  <ChevronLeft size={16} /> Назад
                </button>

                <span style={{ fontSize: '0.84rem', fontWeight: 900, padding: '0 8px', color: 'var(--text, #0f172a)' }}>
                  {safePage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                  style={navBtnStyle(safePage === totalPages)}
                  title="Наступна сторінка"
                >
                  Вперед <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  style={navBtnStyle(safePage === totalPages)}
                  title="Остання сторінка"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
