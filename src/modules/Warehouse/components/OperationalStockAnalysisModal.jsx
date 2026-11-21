import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownLeft, ArrowUpRight, History, Lock, Package, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../../supabase'

const formatQty = (val) => {
  const n = Number(val || 0)
  return Number.isInteger(n) ? n.toLocaleString('uk-UA') : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })
}

const formatSourceWarehouse = (src) => {
  const s = String(src || '').trim().toLowerCase()
  if (!s || s === 'supply' || s === 'procurement') return 'Поставка'
  if (s === 'production') return 'Переміщення з СВ'
  if (s === 'operational') return 'Переміщення з СО'
  if (s === 'sgp') return 'СГП'
  if (s === 'sz' || s === 'bz') return 'Склад БЗ'
  return src
}

const formatDateTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

export function OperationalStockAnalysisModal({ item, onClose }) {
  const [tab, setTab] = useState('all') // 'all' | 'receptions' | 'out' | 'adjustments' | 'reserves'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const loadHistory = async () => {
    if (!item?.id) return
    setLoading(true)
    setError('')
    try {
      const { data: res, error: rpcError } = await supabase.rpc('get_operational_stock_history', {
        p_inventory_id: item.id
      })
      if (rpcError) throw rpcError
      setData(res || null)
    } catch (err) {
      setError(err?.message || 'Не вдалося завантажити історію руху.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (item?.id) {
      setTab('all')
      loadHistory()
    } else {
      setData(null)
    }
  }, [item?.id])

  if (!item) return null

  const inv = data?.item || item
  const totalQty = Number(inv.total_qty || 0)
  const reservedQty = Number(inv.reserved_qty || 0)
  const availableQty = Math.max(0, totalQty - reservedQty)

  const receptions = data?.receptions || []
  const manualIssues = data?.manual_issues || []
  const adjustments = data?.adjustments || []
  const activeReserves = data?.active_reserves || []
  const completedRequests = data?.completed_requests || []

  const totalReceived = receptions.reduce((s, r) => s + (Number(r.qty) || 0), 0)
  const totalManualOut = manualIssues.reduce((s, m) => s + (Number(m.quantity) || 0), 0)
  const totalCompletedOut = completedRequests.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
  const netAdjustments = adjustments.reduce(
    (s, a) => s + (a.action === 'add' ? Number(a.delta_qty || 0) : -Number(a.delta_qty || 0)),
    0
  )

  return createPortal(
    <div
      onMouseDown={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}
    >
      <div style={{ width: 'min(960px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '18px', overflow: 'hidden', color: 'var(--text-strong)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} color="#ff9000" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900 }}>{inv.name}</h3>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Аналіз формування залишку та резервів СО</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" onClick={loadHistory} disabled={loading} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Оновити
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Summary KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', padding: '14px 20px', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ background: 'var(--surface-1)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Наявність зараз</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#ff9000' }}>{formatQty(totalQty)} <small style={{ fontSize: '0.72rem' }}>{inv.unit}</small></div>
          </div>
          <div style={{ background: 'var(--surface-1)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Вільно</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#10b981' }}>{formatQty(availableQty)}</div>
          </div>
          <div style={{ background: 'var(--surface-1)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Резерв (в роботі)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#3b82f6' }}>{formatQty(reservedQty)}</div>
          </div>
          <div style={{ background: 'var(--surface-1)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Прихід / Корекції</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-strong)', marginTop: '4px' }}>
              +{formatQty(totalReceived)} <span style={{ color: netAdjustments >= 0 ? '#10b981' : '#ef4444', marginLeft: '6px' }}>({netAdjustments >= 0 ? '+' : ''}{formatQty(netAdjustments)})</span>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Все разом' },
            { id: 'receptions', label: `Прихід (${receptions.length})` },
            { id: 'out', label: `Видано / Списано (${manualIssues.length + completedRequests.length})` },
            { id: 'adjustments', label: `Ручні корекції (${adjustments.length})` },
            { id: 'reserves', label: `Активні резерви (${activeReserves.length})` }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: tab === t.id ? '#ff9000' : 'var(--border-subtle)',
                background: tab === t.id ? 'rgba(255,144,0,0.14)' : 'var(--surface-2)',
                color: tab === t.id ? '#ff9000' : 'var(--text-soft)',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 700 }}>{error}</div>}
          {loading && !data && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Завантаження історії...</div>}

          {data && (tab === 'all' || tab === 'reserves') && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, fontSize: '0.84rem', marginBottom: '8px', color: '#3b82f6' }}>
                <Lock size={15} /> Активні резерви ({activeReserves.length})
              </div>
              {activeReserves.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>Активних резервів немає.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '7px 10px' }}>Дата</th>
                      <th style={{ padding: '7px 10px' }}>Наряд / Клієнт</th>
                      <th style={{ padding: '7px 10px' }}>Деталі</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>В резерві</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReserves.map(r => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 800 }}>№{r.order_num || '—'} {r.customer ? `(${r.customer})` : ''}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{r.details || '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#3b82f6' }}>{formatQty(r.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {data && (tab === 'all' || tab === 'adjustments') && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, fontSize: '0.84rem', marginBottom: '8px', color: '#f59e0b' }}>
                <History size={15} /> Ручні корекції ({adjustments.length})
              </div>
              {adjustments.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>Ручних корекцій не було.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '7px 10px' }}>Дата</th>
                      <th style={{ padding: '7px 10px' }}>Хто</th>
                      <th style={{ padding: '7px 10px' }}>Причина</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Зміна</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Було → Стало</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map(a => {
                      const isAdd = a.action === 'add'
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 700 }}>{a.actor_name}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{a.reason || '—'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: isAdd ? '#10b981' : '#ef4444' }}>
                            {isAdd ? '+' : '−'}{formatQty(a.delta_qty)}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatQty(a.qty_before)} → <strong style={{ color: 'var(--text-strong)' }}>{formatQty(a.qty_after)}</strong>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {data && (tab === 'all' || tab === 'receptions') && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, fontSize: '0.84rem', marginBottom: '8px', color: '#10b981' }}>
                <ArrowDownLeft size={15} /> Прихід на склад ({receptions.length} док., +{formatQty(totalReceived)})
              </div>
              {receptions.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>Надходжень по документах прийомки не знайдено.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '7px 10px' }}>Дата</th>
                      <th style={{ padding: '7px 10px' }}>Звідки / Наряд</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Прийнято</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receptions.map((r, idx) => (
                      <tr key={`${r.id}-${idx}`} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>{formatSourceWarehouse(r.source_warehouse)} {r.order_num ? `· Наряд №${r.order_num}` : ''}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>+{formatQty(r.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {data && (tab === 'all' || tab === 'out') && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, fontSize: '0.84rem', marginBottom: '8px', color: '#ef4444' }}>
                <ArrowUpRight size={15} /> Видано / Списано (Ручна: −{formatQty(totalManualOut)} · По нарядах: −{formatQty(totalCompletedOut)})
              </div>
              {manualIssues.length === 0 && completedRequests.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>Видач або списань не знайдено.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '7px 10px' }}>Дата</th>
                      <th style={{ padding: '7px 10px' }}>Тип</th>
                      <th style={{ padding: '7px 10px' }}>Деталі / Хто видав</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Кількість</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualIssues.map(m => (
                      <tr key={`man-${m.id}`} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(m.created_at)}</td>
                        <td style={{ padding: '7px 10px' }}><span style={{ padding: '2px 6px', borderRadius: '5px', background: 'rgba(239,68,68,0.14)', color: '#ef4444', fontWeight: 800, fontSize: '0.7rem' }}>РУЧНА ВИДАЧА</span></td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{m.issued_by_name} ({formatQty(m.stock_before)} → {formatQty(m.stock_after)})</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>−{formatQty(m.quantity)}</td>
                      </tr>
                    ))}
                    {completedRequests.map(c => (
                      <tr key={`req-${c.id}`} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(c.created_at)}</td>
                        <td style={{ padding: '7px 10px' }}><span style={{ padding: '2px 6px', borderRadius: '5px', background: 'var(--surface-2)', color: 'var(--text-soft)', fontWeight: 800, fontSize: '0.7rem' }}>НАРЯД</span></td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{c.order_num ? `№${c.order_num} ` : ''}{c.details || ''}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>−{formatQty(c.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
