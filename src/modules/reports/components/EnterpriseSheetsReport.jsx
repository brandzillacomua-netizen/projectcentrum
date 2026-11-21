import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, PackageMinus, Play, RefreshCw, Search } from 'lucide-react'
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

export default function EnterpriseSheetsReport({ startDate, endDate, setStartDate, setEndDate }) {
  const [viewMode, setViewMode] = useState('orders') // 'orders' | 'balance' | 'manual'
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportData, setReportData] = useState(null)
  const [expandedOrders, setExpandedOrders] = useState(() => new Set())
  const [expandedMaterials, setExpandedMaterials] = useState(() => new Set())
  const [expandedManualMats, setExpandedManualMats] = useState(() => new Set())
  const [cardsByKey, setCardsByKey] = useState({})
  const [loadingCardsKey, setLoadingCardsKey] = useState('')
  const [generatedRange, setGeneratedRange] = useState(null)

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
      const { data, error: rpcError } = await supabase.rpc('get_sheets_report_1c', {
        p_start: startIso,
        p_end: endIso
      })
      if (rpcError) throw rpcError
      setReportData(data || null)
      setGeneratedRange({ startIso, endIso })
      setCardsByKey({})
      setExpandedOrders(new Set())
      setExpandedMaterials(new Set())
      setExpandedManualMats(new Set())
    } catch (err) {
      setError(err?.message || 'Не вдалося сформувати звіт по листах.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleOrder = (orderNum) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderNum)) next.delete(orderNum)
      else next.add(orderNum)
      return next
    })
  }

  const toggleMaterial = async (key, orderNum, materialName) => {
    const willOpen = !expandedMaterials.has(key)
    setExpandedMaterials(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    if (willOpen && !cardsByKey[key] && generatedRange) {
      setLoadingCardsKey(key)
      try {
        const { data, error: cardsErr } = await supabase.rpc('get_sheets_report_cards_1c', {
          p_start: generatedRange.startIso,
          p_end: generatedRange.endIso,
          p_order_num: orderNum,
          p_material_name: materialName
        })
        if (cardsErr) throw cardsErr
        setCardsByKey(prev => ({ ...prev, [key]: Array.isArray(data) ? data : [] }))
      } catch (err) {
        setError(err?.message || 'Не вдалося завантажити картки.')
      } finally {
        setLoadingCardsKey(prev => (prev === key ? '' : prev))
      }
    }
  }

  const toggleManualMat = (id) => {
    setExpandedManualMats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = search.trim().toLowerCase()

  const filteredOrders = useMemo(() => {
    const list = reportData?.by_order || []
    if (!q) return list
    return list.filter(ord =>
      String(ord.order_num || '').toLowerCase().includes(q) ||
      String(ord.customer || '').toLowerCase().includes(q) ||
      (ord.materials || []).some(m =>
        String(m.material_name || '').toLowerCase().includes(q) ||
        (m.cards || []).some(c => String(c.part_name || '').toLowerCase().includes(q))
      )
    )
  }, [reportData, q])

  const filteredMaterials = useMemo(() => {
    const list = reportData?.by_material || []
    if (!q) return list
    return list.filter(m => String(m.material_name || '').toLowerCase().includes(q))
  }, [reportData, q])

  const filteredManual = useMemo(() => {
    const list = reportData?.manual_issues?.by_material || []
    if (!q) return list
    return list.filter(m =>
      String(m.material_name || '').toLowerCase().includes(q) ||
      (m.items || []).some(i => String(i.issued_by_name || '').toLowerCase().includes(q))
    )
  }, [reportData, q])

  const summary = reportData?.summary || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Конструктор / Фільтр (1С стиль — нічого не вантажиться до кліку) */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-strong)' }}>
            <Layers size={18} color="#f59e0b" />
            Ієрархічний звіт по листах (розрахунки в БД)
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => applyPreset(0)} className="rep-preset-btn" style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Сьогодні</button>
            <button type="button" onClick={() => applyPreset(6)} className="rep-preset-btn" style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>7 днів</button>
            <button type="button" onClick={() => applyPreset(29)} className="rep-preset-btn" style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>30 днів</button>
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
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Пошук (наряд, лист, деталь)</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="№ наряду, марка листа або деталь..."
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
              background: '#f59e0b',
              color: '#000',
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
          Оберіть період і натисніть <strong style={{ color: 'var(--text-strong)' }}>«Сформувати звіт»</strong> — дані розрахуються безпосередньо в базі даних.
        </div>
      )}

      {reportData && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Розкроєно по нарядах</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#f59e0b', marginTop: '4px' }}>{formatNum(summary.total_used_orders)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>л.</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Карток: {formatNum(summary.total_cards)} · Деталей: {formatNum(summary.total_qty_produced)}</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ручна видача зі складу</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#ef4444', marginTop: '4px' }}>{formatNum(summary.total_manual_issued)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>л.</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Операцій: {formatNum(reportData?.manual_issues?.issues_count)}</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Надійшло на склад</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#10b981', marginTop: '4px' }}>{formatNum(summary.total_supplied)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>л.</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>За обраний період</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Залишок зараз</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--text-strong)', marginTop: '4px' }}>{formatNum(summary.stock_available)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>л. вільно</span></div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Всього: {formatNum(summary.stock_total)} · Резерв: {formatNum(summary.stock_reserved)}</div>
            </div>
          </div>

          {/* Перемикач розрізів */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'orders', label: `По нарядах (${filteredOrders.length})` },
              { id: 'manual', label: `Ручна видача (${formatNum(reportData?.manual_issues?.total_qty)} л.)` },
              { id: 'balance', label: `Баланс по листах (${filteredMaterials.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: '1px solid',
                  borderColor: viewMode === tab.id ? '#f59e0b' : 'var(--border-subtle)',
                  background: viewMode === tab.id ? 'rgba(245, 158, 11, 0.14)' : 'var(--surface-1)',
                  color: viewMode === tab.id ? '#f59e0b' : 'var(--text-soft)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1. ІЄРАРХІЯ ПО НАРЯДАХ */}
          {viewMode === 'orders' && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden' }}>
              {filteredOrders.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>За обраний період розкроїв по нарядах не знайдено.</div>
              ) : (
                filteredOrders.map(ord => {
                  const isOrdOpen = expandedOrders.has(ord.order_num)
                  return (
                    <div key={ord.order_num} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div
                        onClick={() => toggleOrder(ord.order_num)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: isOrdOpen ? 'var(--surface-2)' : 'transparent', gap: '12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          {isOrdOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span style={{ fontWeight: 900, color: 'var(--text-strong)' }}>Наряд №{ord.order_num}</span>
                          {ord.customer && ord.customer !== '—' && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>({ord.customer})</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '0.82rem', flexShrink: 0 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Карток: <strong style={{ color: 'var(--text-strong)' }}>{ord.cards_count}</strong></span>
                          <span style={{ color: 'var(--text-muted)' }}>Деталей: <strong style={{ color: 'var(--text-strong)' }}>{formatNum(ord.qty_produced)}</strong></span>
                          <span style={{ fontWeight: 950, color: '#f59e0b', minWidth: '75px', textAlign: 'right' }}>{formatNum(ord.total_sheets)} л.</span>
                        </div>
                      </div>

                      {isOrdOpen && (
                        <div style={{ padding: '4px 16px 12px 34px', background: 'var(--surface-inset)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(ord.materials || []).map(mat => {
                            const matKey = `${ord.order_num}::${mat.material_name}`
                            const isMatOpen = expandedMaterials.has(matKey)
                            return (
                              <div key={matKey} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--surface-1)', overflow: 'hidden' }}>
                                <div
                                  onClick={() => toggleMaterial(matKey, ord.order_num, mat.material_name)}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', cursor: 'pointer', gap: '10px' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-strong)' }}>
                                    {isMatOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {mat.material_name}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Карток: {mat.cards_count}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Вироблено: {formatNum(mat.qty_produced)} шт</span>
                                    <span style={{ fontWeight: 900, color: '#f59e0b' }}>{formatNum(mat.sheets_count)} л.</span>
                                  </div>
                                </div>

                                {isMatOpen && (
                                  <div style={{ borderTop: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                                    {loadingCardsKey === matKey && !cardsByKey[matKey] ? (
                                      <div style={{ padding: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Завантаження карток...</div>
                                    ) : (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                        <thead>
                                          <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                            <th style={{ padding: '7px 10px' }}>Дата</th>
                                            <th style={{ padding: '7px 10px' }}>Деталь</th>
                                            <th style={{ padding: '7px 10px' }}>Верстат</th>
                                            <th style={{ padding: '7px 10px' }}>Оператор</th>
                                            <th style={{ padding: '7px 10px', textAlign: 'right' }}>Листи</th>
                                            <th style={{ padding: '7px 10px', textAlign: 'right' }}>Годні / Брак</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(cardsByKey[matKey] || mat.cards || []).map((c, idx) => (
                                          <tr key={c.card_id || idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{formatDateTime(c.completed_at)}</td>
                                            <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--text-strong)' }}>
                                              {c.part_name}
                                              {c.is_redo && <span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239,68,68,0.14)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 900 }}>ДОВИПУСК</span>}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{c.machine_name}</td>
                                            <td style={{ padding: '7px 10px', color: 'var(--text-soft)' }}>{c.operator_name}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#f59e0b' }}>{formatNum(c.sheets_count)} л.</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                              <span style={{ color: '#10b981', fontWeight: 800 }}>{formatNum(c.qty_produced)}</span>
                                              {Number(c.scrap_qty) > 0 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>/{formatNum(c.scrap_qty)}</span>}
                                            </td>
                                          </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
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

          {/* 2. РУЧНА ВИДАЧА ЗІ СКЛАДУ */}
          {viewMode === 'manual' && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden' }}>
              {filteredManual.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Ручних видач листів за цей період не було.</div>
              ) : (
                filteredManual.map(mat => {
                  const isOpen = expandedManualMats.has(mat.nomenclature_id)
                  return (
                    <div key={mat.nomenclature_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div
                        onClick={() => toggleManualMat(mat.nomenclature_id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: isOpen ? 'var(--surface-2)' : 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, color: 'var(--text-strong)' }}>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <PackageMinus size={15} color="#ef4444" />
                          {mat.material_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Операцій: {mat.issues_count}</span>
                          <span style={{ fontWeight: 950, color: '#ef4444' }}>{formatNum(mat.total_qty)} л.</span>
                        </div>
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
                              {(mat.items || []).map(item => (
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

          {/* 3. БАЛАНС ПО ЛИСТАХ */}
          {viewMode === 'balance' && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Марка / Товщина листа</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>По нарядах</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Ручна видача</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Разом розхід</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Надійшло</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Залишок (Вільно / Резерв)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map(m => (
                    <tr key={m.material_name} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-strong)' }}>{m.material_name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{formatNum(m.used_orders)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatNum(m.manual_issued)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: 'var(--text-strong)' }}>{formatNum(m.total_out)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatNum(m.supplied)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <strong style={{ color: 'var(--text-strong)' }}>{formatNum(m.stock_available)}</strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '5px', fontSize: '0.72rem' }}>(резерв: {formatNum(m.stock_reserved)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
