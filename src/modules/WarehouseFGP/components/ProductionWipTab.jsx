import React, { useState } from 'react'
import {
  Boxes,
  Layers,
  Scissors,
  RotateCw,
  CheckCircle2,
  Factory,
  Eye,
  Search,
  ExternalLink
} from 'lucide-react'
import { ProductionWipCardsModal } from './ProductionWipCardsModal'

export function ProductionWipTab({
  t,
  isDark,
  groupedWipItems = [],
  filteredWipItems = [],
  totalWipParts = 0,
  wipStageTotals = { cnc: 0, tumbling: 0, sorting: 0, shop2: 0, cardsCount: 0 },
  searchQuery = ''
}) {
  const [selectedWipItem, setSelectedWipItem] = useState(null)

  return (
    <div>
      {/* 1. Header KPIs banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Card 1: Всього в роботі */}
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0.06) 100%)' : '#f0f9ff',
          border: `1.5px solid ${isDark ? 'rgba(56,189,248,0.4)' : '#bae6fd'}`,
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: isDark ? '0 4px 18px rgba(56,189,248,0.12)' : '0 2px 10px rgba(56,189,248,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#7dd3fc' : '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ВСЬОГО В РОБОТІ (НЗП)
            </span>
            <Boxes size={18} color={isDark ? '#38bdf8' : '#0284c7'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 1000, color: isDark ? 'var(--text-strong)' : '#0369a1', lineHeight: 1 }}>
              {totalWipParts.toLocaleString('uk-UA')}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isDark ? '#7dd3fc' : '#0284c7' }}>шт</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#7dd3fc' : '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
            {wipStageTotals.cardsCount} активних робочих карток
          </div>
        </div>

        {/* Card 2: Розкрій */}
        <div style={{
          background: isDark ? '#161924' : '#ffffff',
          border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
              РОЗКРІЙ + БУФЕР
            </span>
            <Scissors size={17} color={isDark ? '#38bdf8' : '#0284c7'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 1000, color: isDark ? 'var(--text-strong)' : '#1e293b', lineHeight: 1 }}>
              {(wipStageTotals.cnc || 0).toLocaleString('uk-UA')}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: t.textSecondary }}>шт</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#38bdf8' : '#0284c7' }}>
            ЧПК та очікування порізки
          </div>
        </div>

        {/* Card 3: Галтовка */}
        <div style={{
          background: isDark ? '#161924' : '#ffffff',
          border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
              ГАЛТОВКА + БУФЕР
            </span>
            <RotateCw size={17} color={isDark ? '#c084fc' : '#7e22ce'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 1000, color: isDark ? 'var(--text-strong)' : '#1e293b', lineHeight: 1 }}>
              {(wipStageTotals.tumbling || 0).toLocaleString('uk-UA')}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: t.textSecondary }}>шт</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#c084fc' : '#7e22ce' }}>
            Вібростіл, мийка, барабани, сушка
          </div>
        </div>

        {/* Card 4: Сортування */}
        <div style={{
          background: isDark ? '#161924' : '#ffffff',
          border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
              СОРТУВАННЯ / ПРИЙОМКА
            </span>
            <CheckCircle2 size={17} color={isDark ? '#fbbf24' : '#b45309'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 1000, color: isDark ? 'var(--text-strong)' : '#1e293b', lineHeight: 1 }}>
              {(wipStageTotals.sorting || 0).toLocaleString('uk-UA')}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: t.textSecondary }}>шт</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#fbbf24' : '#b45309' }}>
            ОТК, перевірка та дефектовка
          </div>
        </div>

        {/* Card 5: Цех 2 */}
        <div style={{
          background: isDark ? '#161924' : '#ffffff',
          border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
              ЦЕХ 2 + БУФЕР
            </span>
            <Factory size={17} color={isDark ? '#a78bfa' : '#6d28d9'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 1000, color: isDark ? 'var(--text-strong)' : '#1e293b', lineHeight: 1 }}>
              {(wipStageTotals.shop2 || 0).toLocaleString('uk-UA')}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: t.textSecondary }}>шт</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#a78bfa' : '#6d28d9' }}>
            Пресування, фарбування, буфер
          </div>
        </div>
      </div>

      {/* 2. Main Table */}
      <div style={{ overflowX: 'auto', borderRadius: '14px', border: `1.5px solid ${t.tableBorder}` }}>
        <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, color: t.textSecondary, fontSize: '0.74rem' }}>
              <th style={{ padding: '14px 16px' }}>НАЙМЕНУВАННЯ ВИРОБУ</th>
              <th style={{ padding: '14px 16px', width: '110px' }}>АРТИКУЛ</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '140px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#38bdf8' : '#0284c7' }} /> В РОБОТІ
                </span>
              </th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '110px' }}>РОЗКРІЙ</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '110px' }}>ГАЛТОВКА</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '110px' }}>СОРТУВАННЯ</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '110px' }}>ЦЕХ 2</th>
              <th style={{ padding: '14px 16px' }}>АКТИВНІ НАРЯДИ</th>
              <th style={{ padding: '14px 16px', textAlign: 'right', width: '80px' }}>ДІЇ</th>
            </tr>
          </thead>
          <tbody>
            {filteredWipItems.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center', color: t.textSecondary }}>
                  <Boxes size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                    {searchQuery ? `Позицій за запитом "${searchQuery}" не знайдено` : 'Наразі немає активних деталей у виробничому циклі'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredWipItems.map(item => (
                <tr
                  key={item.key}
                  style={{
                    borderBottom: `1px solid ${t.tableRowBorder}`,
                    fontSize: '0.85rem',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.015)' : '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: t.textPrimary }}>
                    {item.name}
                  </td>

                  <td style={{ padding: '14px 16px', color: t.textSecondary, fontWeight: 600, fontSize: '0.85rem' }}>
                    {item.code}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedWipItem(item)}
                      title="Натисніть для перегляду карток по етапах виробництва"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(56, 189, 248, 0.14)' : '#e0f2fe',
                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
                        color: isDark ? '#38bdf8' : '#0284c7',
                        fontWeight: 950,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        outline: 'none',
                        boxShadow: isDark ? '0 2px 8px rgba(56, 189, 248, 0.12)' : '0 1px 3px rgba(2, 132, 199, 0.08)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.borderColor = isDark ? '#38bdf8' : '#0284c7'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 189, 248, 0.25)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.borderColor = isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'
                        e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(56, 189, 248, 0.12)' : '0 1px 3px rgba(2, 132, 199, 0.08)'
                      }}
                    >
                      <span>{Number(item.totalWip || 0).toLocaleString('uk-UA')}</span>
                      <small style={{ color: isDark ? '#7dd3fc' : '#0369a1', opacity: 0.8, fontWeight: 700, fontSize: '0.72rem' }}>{item.unit}</small>
                      <Eye size={13} style={{ opacity: 0.85, marginLeft: '2px' }} />
                    </button>
                  </td>

                  {/* CNC Qty */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {item.cncQty > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        fontWeight: 800,
                        fontSize: '0.82rem'
                      }}>
                        {item.cncQty.toLocaleString('uk-UA')}
                      </span>
                    ) : (
                      <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>

                  {/* Tumbling Qty */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {item.tumblingQty > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(168, 85, 247, 0.1)' : '#faf5ff',
                        color: isDark ? '#c084fc' : '#7e22ce',
                        fontWeight: 800,
                        fontSize: '0.82rem'
                      }}>
                        {item.tumblingQty.toLocaleString('uk-UA')}
                      </span>
                    ) : (
                      <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>

                  {/* Sorting Qty */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {item.sortingQty > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                        color: isDark ? '#fbbf24' : '#b45309',
                        fontWeight: 800,
                        fontSize: '0.82rem'
                      }}>
                        {item.sortingQty.toLocaleString('uk-UA')}
                      </span>
                    ) : (
                      <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>

                  {/* Shop 2 Qty */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {item.shop2Qty > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff',
                        color: isDark ? '#a78bfa' : '#6d28d9',
                        fontWeight: 800,
                        fontSize: '0.82rem'
                      }}>
                        {item.shop2Qty.toLocaleString('uk-UA')}
                      </span>
                    ) : (
                      <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>

                  {/* Active orders */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {item.ordersList && item.ordersList.length > 0 ? (
                        item.ordersList.slice(0, 4).map(o => (
                          <span
                            key={o}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                              color: t.textPrimary,
                              fontWeight: 800,
                              fontSize: '0.74rem'
                            }}
                          >
                            {o}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>Вільний випуск</span>
                      )}
                      {item.ordersList && item.ordersList.length > 4 && (
                        <span style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 700 }}>
                          +{item.ordersList.length - 4} ще
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedWipItem(item)}
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                        color: t.textPrimary,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? '#334155' : '#e2e8f0'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'
                      }}
                    >
                      <span>Картки</span>
                      <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for viewing active cards */}
      {selectedWipItem && (
        <ProductionWipCardsModal
          item={selectedWipItem}
          isDark={isDark}
          t={t}
          onClose={() => setSelectedWipItem(null)}
        />
      )}
    </div>
  )
}
