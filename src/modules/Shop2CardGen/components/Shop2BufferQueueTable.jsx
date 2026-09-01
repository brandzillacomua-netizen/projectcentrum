import React from 'react'
import { Play, Search, Package, ArrowUpDown, Box, AlertTriangle, ShieldCheck } from 'lucide-react'

export function Shop2BufferQueueTable({
  rows = [],
  productSections = [],
  searchTerm = '',
  setSearchTerm,
  selectedOrderId = 'all',
  setSelectedOrderId,
  groupBy = 'product',
  setGroupBy,
  sortBy = 'available_desc',
  setSortBy,
  orders = [],
  onOpenGenModal
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Filters, Grouping & Sort Header ───────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'var(--card-bg, #ffffff)',
        padding: '18px 22px',
        borderRadius: '20px',
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
          <input
            type="text"
            placeholder="Пошук за готовим виробом, деталлю або кодом..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--input-bg, #f8fafc)',
              border: '1px solid var(--border, #cbd5e1)',
              color: 'var(--text, #0f172a)',
              padding: '10px 14px 10px 40px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              outline: 'none',
              fontWeight: 600
            }}
          />
        </div>

        {/* Group By selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>Вигляд:</label>
          <div style={{ display: 'flex', background: 'var(--input-bg, #f1f5f9)', border: '1px solid var(--border, #cbd5e1)', padding: '3px', borderRadius: '12px' }}>
            <button
              onClick={() => setGroupBy('product')}
              style={{
                background: groupBy === 'product' ? '#ff9000' : 'transparent',
                color: groupBy === 'product' ? '#ffffff' : 'var(--text-muted, #64748b)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '9px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              За готовими виробами
            </button>
            <button
              onClick={() => setGroupBy('part')}
              style={{
                background: groupBy === 'part' ? '#ff9000' : 'transparent',
                color: groupBy === 'part' ? '#ffffff' : 'var(--text-muted, #64748b)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '9px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Купи деталей
            </button>
            <button
              onClick={() => setGroupBy('order')}
              style={{
                background: groupBy === 'order' ? '#ff9000' : 'transparent',
                color: groupBy === 'order' ? '#ffffff' : 'var(--text-muted, #64748b)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '9px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              По нарядах
            </button>
          </div>
        </div>

        {/* Sort By selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={14} color="var(--text-muted, #64748b)" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'var(--input-bg, #f8fafc)',
              border: '1px solid var(--border, #cbd5e1)',
              color: 'var(--text, #0f172a)',
              padding: '8px 12px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              outline: 'none',
              fontWeight: 800
            }}
          >
            <option value="available_desc">Вільна кількість (найбільші ↓)</option>
            <option value="name_asc">Назва деталі (А-Я)</option>
            <option value="product_asc">Серія виробу / Проєкт</option>
          </select>
        </div>

        {/* Order filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            style={{
              background: 'var(--input-bg, #f8fafc)',
              border: '1px solid var(--border, #cbd5e1)',
              color: 'var(--text, #0f172a)',
              padding: '8px 12px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              outline: 'none',
              fontWeight: 800,
              maxWidth: '280px'
            }}
          >
            <option value="all">📋 Усі наряди в роботі ({orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled').length})</option>
            {orders.map(o => {
              const isCompleted = o.status === 'completed' || o.status === 'shipped' || o.status === 'cancelled'
              return (
                <option key={o.id} value={o.id}>
                  Наряд №{o.order_num}{o.customer ? ` (${o.customer})` : ''}{isCompleted ? ' [Завершено]' : ''}
                </option>
              )
            })}
          </select>
        </div>
      </div>

      {/* ── Product Sections View (When groupBy === 'product') ───────────── */}
      {groupBy === 'product' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {productSections.length === 0 ? (
            <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '20px', border: '1px solid var(--border, #e2e8f0)', padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div>Буфер Цеху №2 порожній або немає деталей за фільтрами.</div>
            </div>
          ) : (
            productSections.map(sec => (
              <div key={sec.title} style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '20px', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                {/* Product Section Header */}
                <div style={{
                  background: 'var(--header-bg, #f8fafc)',
                  borderBottom: '1px solid var(--border, #e2e8f0)',
                  padding: '16px 24px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(255, 144, 0, 0.12)', border: '1px solid rgba(255, 144, 0, 0.3)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box size={18} color="#ff9000" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 950, color: 'var(--text, #0f172a)', letterSpacing: '0.3px' }}>
                        {sec.title}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>
                        Деталей у виробі: {sec.rows.length}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {sec.totalScrap > 0 && (
                      <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 900, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> Брак Цеху 2: {sec.totalScrap.toLocaleString()} шт
                      </span>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>
                        Сума всього:
                      </span>
                      <span style={{ fontSize: '0.95rem', color: '#d97706', fontWeight: 950, background: 'rgba(255, 144, 0, 0.1)', border: '1px solid rgba(255, 144, 0, 0.4)', padding: '4px 14px', borderRadius: '10px', fontFamily: 'monospace' }}>
                        {sec.totalCovered.toLocaleString()} / {sec.totalRequirement.toLocaleString()} шт
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section Parts Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--table-head, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '14px 20px' }}>Деталь & Код</th>
                      <th style={{ padding: '14px 20px' }}>Наряди у купі</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', color: '#d97706' }}>СУМА (Є / ПОТРЕБА)</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', color: '#eab308' }}>ВЗЯТО З БЗ</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', color: '#0284c7' }}>В РОБОТІ (ЦЕХ 1)</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center' }}>В роботі (Цех 2)</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center' }}>БРАК ЦЕХУ 2</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center' }}>ФАКТИЧНИЙ ВИХІД (СГП / ПАКУВАННЯ)</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center' }}>ВІЛЬНО ДЛЯ РК</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Дія</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map(row => {
                      const canLaunch = row.availableQty > 0
                      const hasScrap = row.shop2ScrapQty > 0

                      return (
                        <tr key={row.key} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 900, color: 'var(--text, #0f172a)', fontSize: '0.9rem' }}>{row.nomName}</div>
                            {row.nomCode && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>{row.nomCode}</div>}
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                              {row.ordersList && row.ordersList.length > 0 ? (
                                row.ordersList.map((o, idx) => (
                                  <span key={idx} style={{ background: 'var(--input-bg, #f1f5f9)', color: o.availableQty > 0 ? '#d97706' : 'var(--text-muted, #64748b)', border: o.availableQty > 0 ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid var(--border, #cbd5e1)', padding: '2px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 800 }}>
                                    {o.orderNum} ({o.availableQty})
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>Без наряду</span>
                              )}
                            </div>
                          </td>

                          {/* СУМА (Є / ПОТРЕБА) */}
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <span style={{
                              background: 'rgba(255, 144, 0, 0.1)',
                              border: '1px solid rgba(255, 144, 0, 0.4)',
                              color: '#d97706',
                              padding: '5px 14px',
                              borderRadius: '10px',
                              fontWeight: 950,
                              fontSize: '0.92rem',
                              fontFamily: 'monospace',
                              display: 'inline-block'
                            }}>
                              {row.totalReceived} / {row.totalOrderRequirement}
                            </span>
                          </td>

                          {/* ВЗЯТО З БЗ */}
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <span style={{
                              color: row.stockBzQty > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)',
                              fontWeight: 950,
                              background: row.stockBzQty > 0 ? 'rgba(234, 179, 8, 0.08)' : 'transparent',
                              border: row.stockBzQty > 0 ? '1px solid rgba(234, 179, 8, 0.3)' : 'none',
                              padding: row.stockBzQty > 0 ? '4px 10px' : '0',
                              borderRadius: '8px',
                              fontSize: '0.85rem'
                            }}>
                              {row.stockBzQty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                            </span>
                          </td>

                          {/* ОЧІКУЄМО З ЦЕХУ 1 */}
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <span style={{
                              color: row.awaitingShop1Qty > 0 ? '#0284c7' : 'var(--text-muted, #94a3b8)',
                              fontWeight: 950,
                              background: row.awaitingShop1Qty > 0 ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                              border: row.awaitingShop1Qty > 0 ? '1px solid rgba(2, 132, 199, 0.3)' : 'none',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.85rem'
                            }}>
                              {row.awaitingShop1Qty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                            </span>
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <span style={{ color: row.inProgressQty > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)', fontWeight: 900 }}>
                              {row.inProgressQty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                            </span>
                          </td>

                          {/* БРАК ЦЕХУ 2 */}
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <span style={{
                              color: hasScrap ? '#ef4444' : 'var(--text-muted, #94a3b8)',
                              fontWeight: 950,
                              background: hasScrap ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                              border: hasScrap ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                              padding: hasScrap ? '4px 10px' : '0',
                              borderRadius: '8px',
                              fontSize: '0.85rem'
                            }}>
                              {row.shop2ScrapQty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                            </span>
                          </td>

                          {/* ФАКТИЧНИЙ ВИХІД (ПАКУВАННЯ) */}
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <span style={{
                              color: '#059669',
                              fontWeight: 950,
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '4px 12px',
                              borderRadius: '10px',
                              fontSize: '0.9rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <ShieldCheck size={14} />
                              {row.netPackagingQty.toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>шт</span>
                            </span>
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: canLaunch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.02)', border: canLaunch ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border, #cbd5e1)', padding: '4px 12px', borderRadius: '10px' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: 950, color: canLaunch ? '#059669' : 'var(--text-muted, #94a3b8)' }}>
                                {row.availableQty.toLocaleString()}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: canLaunch ? '#059669' : 'var(--text-muted, #94a3b8)', fontWeight: 800 }}>шт</span>
                            </div>
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <button
                              disabled={!canLaunch}
                              onClick={() => onOpenGenModal(row)}
                              style={{
                                background: canLaunch ? 'linear-gradient(135deg, #ff9000, #ff5500)' : 'var(--border, #cbd5e1)',
                                color: canLaunch ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 950,
                                cursor: canLaunch ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: canLaunch ? '0 4px 14px rgba(255, 144, 0, 0.3)' : 'none',
                                transition: '0.2s'
                              }}
                            >
                              <Play size={12} fill={canLaunch ? '#ffffff' : 'none'} />
                              Створити РК
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Flat Table View (When groupBy !== 'product') ──────────────────── */}
      {groupBy !== 'product' && (
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '20px', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--table-head, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '16px 20px' }}>Деталь & Серія виробу</th>
                <th style={{ padding: '16px 20px' }}>Наряди у купі</th>
                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#d97706' }}>СУМА (Є / ПОТРЕБА)</th>
                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#eab308' }}>ВЗЯТО З БЗ</th>
                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#0284c7' }}>В РОБОТІ (ЦЕХ 1)</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>В роботі (Цех 2)</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>БРАК ЦЕХУ 2</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>ФАКТИЧНИЙ ВИХІД (СГП / ПАКУВАННЯ)</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>ВІЛЬНО ДЛЯ РК</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Дія</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                    <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <div>Буфер Цеху №2 порожній або немає деталей за фільтрами.</div>
                  </td>
                </tr>
              ) : (
                rows.map(row => {
                  const canLaunch = row.availableQty > 0
                  const hasScrap = row.shop2ScrapQty > 0

                  return (
                    <tr key={row.key} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 900, color: 'var(--text, #0f172a)', fontSize: '0.92rem' }}>{row.nomName}</span>
                        </div>
                        {row.nomCode && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>{row.nomCode}</div>}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                          {row.ordersList && row.ordersList.length > 0 ? (
                            row.ordersList.map((o, idx) => (
                              <span key={idx} style={{ background: 'var(--input-bg, #f1f5f9)', color: o.availableQty > 0 ? '#d97706' : 'var(--text-muted, #64748b)', border: o.availableQty > 0 ? '1px solid rgba(217,119,6,0.3)' : '1px solid var(--border, #cbd5e1)', padding: '2px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 800 }}>
                                {o.orderNum} ({o.availableQty})
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>Без наряду</span>
                          )}
                        </div>
                      </td>

                      {/* СУМА (Є / ПОТРЕБА) */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          background: 'rgba(255, 144, 0, 0.1)',
                          border: '1px solid rgba(255, 144, 0, 0.4)',
                          color: '#d97706',
                          padding: '5px 14px',
                          borderRadius: '10px',
                          fontWeight: 950,
                          fontSize: '0.92rem',
                          fontFamily: 'monospace',
                          display: 'inline-block'
                        }}>
                          {row.totalReceived} / {row.totalOrderRequirement}
                        </span>
                      </td>

                      {/* ВЗЯТО З БЗ */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          color: row.stockBzQty > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)',
                          fontWeight: 950,
                          background: row.stockBzQty > 0 ? 'rgba(234, 179, 8, 0.08)' : 'transparent',
                          border: row.stockBzQty > 0 ? '1px solid rgba(234, 179, 8, 0.3)' : 'none',
                          padding: row.stockBzQty > 0 ? '4px 10px' : '0',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}>
                          {row.stockBzQty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                        </span>
                      </td>

                      {/* ОЧІКУЄМО З ЦЕХУ 1 */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          color: row.awaitingShop1Qty > 0 ? '#0284c7' : 'var(--text-muted, #94a3b8)',
                          fontWeight: 950,
                          background: row.awaitingShop1Qty > 0 ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                          border: row.awaitingShop1Qty > 0 ? '1px solid rgba(2, 132, 199, 0.3)' : 'none',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}>
                          {row.awaitingShop1Qty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{ color: row.inProgressQty > 0 ? '#d97706' : 'var(--text-muted, #94a3b8)', fontWeight: 900 }}>
                          {row.inProgressQty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                        </span>
                      </td>

                      {/* БРАК ЦЕХУ 2 */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          color: hasScrap ? '#ef4444' : 'var(--text-muted, #94a3b8)',
                          fontWeight: 950,
                          background: hasScrap ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                          border: hasScrap ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                          padding: hasScrap ? '4px 10px' : '0',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}>
                          {row.shop2ScrapQty.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>шт</span>
                        </span>
                      </td>

                      {/* ФАКТИЧНИЙ ВИХІД (ПАКУВАННЯ) */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          color: '#059669',
                          fontWeight: 950,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '4px 12px',
                          borderRadius: '10px',
                          fontSize: '0.9rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <ShieldCheck size={14} />
                          {row.netPackagingQty.toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>шт</span>
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: canLaunch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.02)', border: canLaunch ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border, #cbd5e1)', padding: '6px 14px', borderRadius: '12px' }}>
                          <span style={{ fontSize: '0.98rem', fontWeight: 950, color: canLaunch ? '#059669' : 'var(--text-muted, #94a3b8)' }}>
                            {row.availableQty.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: canLaunch ? '#059669' : 'var(--text-muted, #94a3b8)', fontWeight: 800 }}>ВІЛЬНО</span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          disabled={!canLaunch}
                          onClick={() => onOpenGenModal(row)}
                          style={{
                            background: canLaunch ? 'linear-gradient(135deg, #ff9000, #ff5500)' : 'var(--border, #cbd5e1)',
                            color: canLaunch ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                            border: 'none',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 950,
                            cursor: canLaunch ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: canLaunch ? '0 4px 14px rgba(255, 144, 0, 0.3)' : 'none',
                            transition: '0.2s'
                          }}
                        >
                          <Play size={14} fill={canLaunch ? '#ffffff' : 'none'} />
                          Створити РК
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
