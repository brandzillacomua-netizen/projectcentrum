import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, PackageMinus, Play, RefreshCw, Search, Scissors } from 'lucide-react'
import { supabase } from '../../../supabase'
import { dateInputBoundaryIso } from '../hooks/useReportsModuleData'

const formatNum = (val) => {
  const n = Number(val || 0)
  return Number.isInteger(n) ? n.toLocaleString('uk-UA') : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })
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

export default function EnterpriseCuttersReport({ startDate, endDate, setStartDate, setEndDate }) {
  const [viewMode, setViewMode] = useState('cutters') // 'cutters' | 'orders' | 'manual'
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportData, setReportData] = useState(null)
  const [expandedLevel1, setExpandedLevel1] = useState(() => new Set())
  const [expandedLevel2, setExpandedLevel2] = useState(() => new Set())

  const applyPreset = (daysBack) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - daysBack)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const handleGenerate = async () => {
    setIsLoading(true)
    setError('')
    try {
      const startIso = dateInputBoundaryIso(startDate)
      const endIso = dateInputBoundaryIso(endDate, true)
      const { data, error: rpcError } = await supabase.rpc('get_cutters_report_1c', {
        p_start: startIso,
        p_end: endIso
      })
      if (rpcError) throw rpcError
      setReportData(data || null)
      setExpandedLevel1(new Set())
      setExpandedLevel2(new Set())
    } catch (err) {
      setError(err?.message || 'Не вдалося сформувати звіт по фрезах.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleL1 = (key) => {
    setExpandedLevel1(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleL2 = (key) => {
    setExpandedLevel2(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const q = search.trim().toLowerCase()

  const filteredCutters = useMemo(() => {
    const list = reportData?.by_cutter || []
    if (!q) return list
    return list.filter(c =>
      String(c.cutter_name || '').toLowerCase().includes(q) ||
      (c.by_order || []).some(o =>
        String(o.order_num || '').toLowerCase().includes(q) ||
        (o.events || []).some(e =>
          String(e.actor_name || '').toLowerCase().includes(q) ||
          String(e.part_name || '').toLowerCase().includes(q)
        )
      )
    )
  }, [reportData, q])

  const filteredOrders = useMemo(() => {
    const list = reportData?.by_order || []
    if (!q) return list
    return list.filter(o =>
      String(o.order_num || '').toLowerCase().includes(q) ||
      String(o.customer || '').toLowerCase().includes(q) ||
      (o.cutters || []).some(c => String(c.cutter_name || '').toLowerCase().includes(q))
    )
  }, [reportData, q])

  const filteredManual = useMemo(() => {
    const list = reportData?.manual_issues?.by_cutter || []
    if (!q) return list
    return list.filter(c =>
      String(c.cutter_name || '').toLowerCase().includes(q) ||
      (c.items || []).some(i => String(i.issued_by_name || '').toLowerCase().includes(q))
    )
  }, [reportData, q])

  const summary = reportData?.summary || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Конструктор / Фільтр */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-strong)' }}>
            <Scissors size={18} color="#3b82f6" />
            Звіт по фактичному використанню фрез (введеному після розкрою)
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => applyPreset(0)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Сьогодні</button>
            <button type="button" onClick={() => applyPreset(6)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>7 днів</button>
            <button type="button" onClick={() => applyPreset(29)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>30 днів</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Період з</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)', fontWeight: 700 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Період по</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)', fontWeight: 700 }} />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Пошук (фреза, наряд, майстер)</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Назва фрези, № наряду або ПІБ..."
                style={{ width: '100%', height: '38px', padding: '0 10px 0 30px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)' }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '9px',
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            {isLoading ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            {isLoading ? 'ФОРМУВАННЯ...' : 'СФОРМУВАТИ ЗВІТ'}
          </button>
        </div>
        {error && <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.82rem', fontWeight: 700 }}>{error}</div>}
      </div>

      {!reportData && !isLoading && (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--surface-1)', border: '1px dashed var(--border-subtle)', borderRadius: '14px', color: 'var(--text-muted)' }}>
          Оберіть період і натисніть <strong style={{ color: 'var(--text-strong)' }}>«Сформувати звіт»</strong> — звіт порахується в БД за фактичними подіями використання фрез після розкрою.
        </div>
      )}

      {reportData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Фактично використано</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#3b82f6', marginTop: '4px' }}>{formatNum(summary.total_used_actual)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>шт</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Фіксацій розкрою: {formatNum(summary.events_count)}</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ручна видача зі складу</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#ef4444', marginTop: '4px' }}>{formatNum(summary.total_manual_issued)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>шт</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Операцій: {formatNum(reportData?.manual_issues?.issues_count)}</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Надійшло на склад</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#10b981', marginTop: '4px' }}>{formatNum(summary.total_supplied)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>шт</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>За обраний період</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Залишок зараз</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--text-strong)', marginTop: '4px' }}>{formatNum(summary.stock_available)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>шт вільно</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Всього: {formatNum(summary.stock_total)} · Резерв: {formatNum(summary.stock_reserved)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'cutters', label: `По фрезах (${filteredCutters.length})` },
              { id: 'orders', label: `По нарядах (${filteredOrders.length})` },
              { id: 'manual', label: `Ручна видача (${formatNum(reportData?.manual_issues?.total_qty)} шт)` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: '1px solid',
                  borderColor: viewMode === tab.id ? '#3b82f6' : 'var(--border-subtle)',
                  background: viewMode === tab.id ? 'rgba(59, 130, 246, 0.14)' : 'var(--surface-1)',
                  color: viewMode === tab.id ? '#3b82f6' : 'var(--text-soft)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1. ПО ФРЕЗАХ */}
          {viewMode === 'cutters' && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden' }}>
              {filteredCutters.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Даних по фрезах за цей період немає.</div>
              ) : (
                filteredCutters.map(c => {
                  const isOpen = expandedLevel1.has(c.nomenclature_id)
                  const hasChildren = (c.by_order || []).length > 0
                  return (
                    <div key={c.nomenclature_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div
                        onClick={() => hasChildren && toggleL1(c.nomenclature_id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: hasChildren ? 'pointer' : 'default', background: isOpen ? 'var(--surface-2)' : 'transparent', gap: '12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, color: 'var(--text-strong)' }}>
                          {hasChildren ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span style={{ width: '16px' }} />}
                          {c.cutter_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', flexShrink: 0 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Прихід: <strong style={{ color: '#10b981' }}>{formatNum(c.supplied)}</strong></span>
                          <span style={{ color: 'var(--text-muted)' }}>Ручна видача: <strong style={{ color: '#ef4444' }}>{formatNum(c.manual_issued)}</strong></span>
                          <span style={{ color: 'var(--text-muted)' }}>Вільно: <strong style={{ color: 'var(--text-strong)' }}>{formatNum(c.stock_available)}</strong></span>
                          <span style={{ fontWeight: 950, color: '#3b82f6', minWidth: '72px', textAlign: 'right' }}>Факт: {formatNum(c.used_actual)} шт</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '4px 16px 12px 34px', background: 'var(--surface-inset)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(c.by_order || []).map(ord => {
                            const k2 = `${c.nomenclature_id}::${ord.order_num}`
                            const isL2Open = expandedLevel2.has(k2)
                            return (
                              <div key={k2} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--surface-1)', overflow: 'hidden' }}>
                                <div onClick={() => toggleL2(k2)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', cursor: 'pointer' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-strong)' }}>
                                    {isL2Open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    Наряд №{ord.order_num} {ord.customer && ord.customer !== '—' ? `(${ord.customer})` : ''}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#3b82f6' }}>{formatNum(ord.total_qty)} шт ({ord.events_count})</div>
                                </div>
                                {isL2Open && (
                                  <div style={{ borderTop: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                      <thead>
                                        <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                          <th style={{ padding: '7px 10px' }}>Дата</th>
                                          <th style={{ padding: '7px 10px' }}>Деталь</th>
                                          <th style={{ padding: '7px 10px' }}>Верстат</th>
                                          <th style={{ padding: '7px 10px' }}>Зафіксував</th>
                                          <th style={{ padding: '7px 10px', textAlign: 'right' }}>Кількість</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(ord.events || []).map(ev => (
                                          <tr key={ev.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(ev.created_at)}</td>
                                            <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--text-strong)' }}>
                                              {ev.part_name}
                                              {ev.is_faceting && <span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(168,85,247,0.14)', color: '#a855f7', fontSize: '0.65rem', fontWeight: 800 }}>ФАСКА</span>}
                                              {ev.pocket_owner && <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>({ev.pocket_owner})</span>}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{ev.machine_name}</td>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{ev.actor_name}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#3b82f6' }}>{formatNum(ev.quantity)} шт</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* 2. ПО НАРЯДАХ */}
          {viewMode === 'orders' && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden' }}>
              {filteredOrders.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>За обраний період списань фрез по нарядах не зафіксовано.</div>
              ) : (
                filteredOrders.map(ord => {
                  const isOpen = expandedLevel1.has(`ord:${ord.order_num}`)
                  return (
                    <div key={ord.order_num} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div onClick={() => toggleL1(`ord:${ord.order_num}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: isOpen ? 'var(--surface-2)' : 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, color: 'var(--text-strong)' }}>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          Наряд №{ord.order_num} {ord.customer && ord.customer !== '—' ? `(${ord.customer})` : ''}
                        </div>
                        <div style={{ fontWeight: 950, color: '#3b82f6' }}>{formatNum(ord.total_qty)} шт</div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '4px 16px 12px 34px', background: 'var(--surface-inset)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(ord.cutters || []).map(c => {
                            const k2 = `ord:${ord.order_num}::${c.nomenclature_id}`
                            const isL2Open = expandedLevel2.has(k2)
                            return (
                              <div key={k2} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--surface-1)', overflow: 'hidden' }}>
                                <div onClick={() => toggleL2(k2)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', cursor: 'pointer' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-strong)' }}>
                                    {isL2Open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {c.cutter_name}
                                  </div>
                                  <div style={{ fontWeight: 900, color: '#3b82f6', fontSize: '0.8rem' }}>{formatNum(c.total_qty)} шт</div>
                                </div>
                                {isL2Open && (
                                  <div style={{ borderTop: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                      <thead>
                                        <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                          <th style={{ padding: '7px 10px' }}>Дата</th>
                                          <th style={{ padding: '7px 10px' }}>Деталь</th>
                                          <th style={{ padding: '7px 10px' }}>Верстат</th>
                                          <th style={{ padding: '7px 10px' }}>Зафіксував</th>
                                          <th style={{ padding: '7px 10px', textAlign: 'right' }}>Кількість</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(c.events || []).map(ev => (
                                          <tr key={ev.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{formatDateTime(ev.created_at)}</td>
                                            <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--text-strong)' }}>{ev.part_name}</td>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{ev.machine_name}</td>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{ev.actor_name}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#3b82f6' }}>{formatNum(ev.quantity)} шт</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* 3. РУЧНА ВИДАЧА */}
          {viewMode === 'manual' && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden' }}>
              {filteredManual.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Ручних видач фрез за цей період не було.</div>
              ) : (
                filteredManual.map(c => {
                  const isOpen = expandedLevel1.has(`man:${c.nomenclature_id}`)
                  return (
                    <div key={c.nomenclature_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div onClick={() => toggleL1(`man:${c.nomenclature_id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: isOpen ? 'var(--surface-2)' : 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, color: 'var(--text-strong)' }}>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <PackageMinus size={15} color="#ef4444" />
                          {c.cutter_name}
                        </div>
                        <div style={{ fontWeight: 950, color: '#ef4444' }}>{formatNum(c.total_qty)} шт</div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '8px 16px 14px 36px', background: 'var(--surface-inset)', overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: 'var(--surface-1)', borderRadius: '8px', overflow: 'hidden' }}>
                            <thead>
                              <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 10px' }}>Дата і час</th>
                                <th style={{ padding: '8px 10px' }}>Видав</th>
                                <th style={{ padding: '8px 10px' }}>Модуль</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Кількість</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Було → Стало</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(c.items || []).map(item => (
                                <tr key={item.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                  <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{formatDateTime(item.created_at)}</td>
                                  <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-strong)' }}>{item.issued_by_name}</td>
                                  <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>{item.source_module === 'warehouse_boxes' ? 'Склад боксів' : 'Склад'}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>-{formatNum(item.quantity)} {item.unit}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatNum(item.stock_before)} → {formatNum(item.stock_after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
