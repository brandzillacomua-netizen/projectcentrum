import React, { useEffect, useMemo, useState } from 'react'
import { X, Search, Layers, Copy, Check, CheckCircle2, Calendar, User, ChevronLeft, ChevronRight, ArrowUpRight, History } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import { normalizeKey } from '../warehouseFgpInventory.js'

const PAGE_SIZE = 25

const formatQty = (val) => Number(val || 0).toLocaleString('uk-UA')

const formatDateTime = (ts) => {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('uk-UA', {
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

export function StockCardsAnalysisModal({
  item,
  nomenclatures = [],
  onClose
}) {
  const { theme } = useMES()
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.body.classList.contains('light-theme'))
  const isDark = !isLight

  const [activeTab, setActiveTab] = useState('receipts') // 'receipts' | 'expenses' | 'adjustments'
  const [modalSearch, setModalSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [copiedId, setCopiedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(modalSearch)
      setPage(0)
    }, 250)
    return () => clearTimeout(t)
  }, [modalSearch])

  useEffect(() => {
    setActiveTab('receipts')
    setModalSearch('')
    setDebouncedSearch('')
    setPage(0)
  }, [item?.id, item?.key])

  const linkedNom = useMemo(() => {
    if (!item || !nomenclatures?.length) return null
    if (item.nomenclature_id) {
      const byId = nomenclatures.find(n =>
        String(n.id) === String(item.nomenclature_id) ||
        (n.legacy_ids || []).some(id => String(id) === String(item.nomenclature_id))
      )
      if (byId) return byId
    }
    const targetKey = normalizeKey(item.name)
    if (!targetKey) return null
    return nomenclatures.find(n => normalizeKey(n.name) === targetKey && n.code) ||
      nomenclatures.find(n => normalizeKey(n.name) === targetKey) ||
      null
  }, [item, nomenclatures])

  const inventoryIds = useMemo(() => {
    if (!item) return []
    const rawIds = (item.rawItems || []).map(r => r.id).filter(Boolean)
    if (rawIds.length > 0) return rawIds
    return item.id ? [item.id] : []
  }, [item])

  useEffect(() => {
    if (!item) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: rpcError } = await supabase.rpc('get_sgp_stock_analysis', {
          p_inventory_ids: inventoryIds,
          p_nomenclature_id: item.nomenclature_id || linkedNom?.id || null,
          p_item_name: item.name || null,
          p_tab: activeTab,
          p_search: debouncedSearch,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE
        })
        if (rpcError) throw rpcError
        if (!cancelled) setAnalysis(data || null)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Не вдалося завантажити аналіз залишку СГП.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [item, inventoryIds, linkedNom?.id, activeTab, debouncedSearch, page])

  if (!item) return null

  const t = {
    overlayBg: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(15,23,42,0.55)',
    modalBg: isDark ? '#0f1115' : '#ffffff',
    modalBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    headerBg: isDark ? '#161920' : '#f8fafc',
    textPrimary: isDark ? '#ffffff' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    cardBg: isDark ? '#161920' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    inputBg: isDark ? '#090a0d' : '#f8fafc',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
    tableHeaderBg: isDark ? '#1b1f28' : '#f1f5f9',
    tableRowBorder: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    tableRowHover: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc'
  }

  const summary = analysis?.summary || {}
  const currentStock = analysis ? Number(summary.current_stock || 0) : Number(item.total_qty || 0)
  const totalInCards = Number(summary.total_in_cards || 0)
  const totalOut = Number(summary.total_out || 0)
  const adjNet = Number(summary.adjustments_net || 0)
  const totalRows = Number(analysis?.total_rows || 0)
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const rows = analysis?.rows || []
  const itemCode = linkedNom?.code || ''

  const handleCopyId = (idText) => {
    if (!idText) return
    navigator.clipboard.writeText(idText)
    setCopiedId(idText)
    setTimeout(() => setCopiedId(null), 1600)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: '20px',
          width: '100%', maxWidth: '960px', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)', overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', background: t.headerBg, borderBottom: `1px solid ${t.modalBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Layers size={22} color="#10b981" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: t.textPrimary }}>АНАЛІЗ ЗАЛИШКУ ТА РУХУ СГП</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textPrimary }}>{item.name}</span>
                {itemCode && (
                  <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '6px', background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0', color: t.textSecondary, fontWeight: 700 }}>
                    Артикул: {itemCode}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ width: '34px', height: '34px', borderRadius: '50%', border: `1px solid ${t.cardBorder}`, background: t.cardBg, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Summary KPI */}
        <div style={{ padding: '16px 24px 0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="#10b981" />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Поточний залишок СГП</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: t.textPrimary }}>{formatQty(currentStock)} <small style={{ fontSize: '0.72rem', color: t.textSecondary }}>{item.unit || 'шт'}</small></div>
            </div>
          </div>
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="#3b82f6" />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Надійшло з карток</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#3b82f6' }}>+{formatQty(totalInCards)} <small style={{ fontSize: '0.72rem', color: t.textSecondary }}>({formatQty(summary.receipts_count)})</small></div>
            </div>
          </div>
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowUpRight size={20} color="#ef4444" />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Витрата / Відвантажено</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ef4444' }}>−{formatQty(totalOut)} <small style={{ fontSize: '0.72rem', color: t.textSecondary }}>({formatQty(summary.expenses_count)})</small></div>
            </div>
          </div>
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} color="#f59e0b" />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>Ручні корекції</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: adjNet >= 0 ? '#10b981' : '#ef4444' }}>
                {adjNet >= 0 ? '+' : ''}{formatQty(adjNet)} <small style={{ fontSize: '0.72rem', color: t.textSecondary }}>({formatQty(summary.adjustments_count)})</small>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tabs & Search */}
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'receipts', label: `Надходження (${formatQty(summary.receipts_count)})`, color: '#10b981' },
              { id: 'expenses', label: `Витрати / Відвантаження (${formatQty(summary.expenses_count)})`, color: '#ef4444' },
              { id: 'adjustments', label: `Корекції (${formatQty(summary.adjustments_count)})`, color: '#f59e0b' }
            ].map(tabItem => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => { setActiveTab(tabItem.id); setPage(0) }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '9px',
                  border: '1px solid',
                  borderColor: activeTab === tabItem.id ? tabItem.color : t.cardBorder,
                  background: activeTab === tabItem.id ? `${tabItem.color}20` : t.cardBg,
                  color: activeTab === tabItem.id ? tabItem.color : t.textSecondary,
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '240px', flex: '0 1 280px' }}>
            <Search size={14} color={t.textMuted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Пошук по № наряду, картці, оператору..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: '9px',
                border: `1px solid ${t.inputBorder}`, background: t.inputBg,
                color: t.textPrimary, fontSize: '0.8rem', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px 24px' }}>
          {error && <div style={{ color: '#ef4444', marginBottom: '10px', fontSize: '0.82rem', fontWeight: 700 }}>{error}</div>}
          {loading && rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: t.textSecondary }}>Завантаження з бази...</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: t.cardBg, border: `1px dashed ${t.cardBorder}`, borderRadius: '14px', color: t.textSecondary, fontSize: '0.86rem' }}>
              Записів за обраним фільтром не знайдено.
            </div>
          ) : (
            <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: '12px', overflow: 'hidden', background: t.cardBg }}>
              {activeTab === 'receipts' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: t.tableHeaderBg, borderBottom: `1px solid ${t.cardBorder}`, fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 14px' }}>Дата / Час</th>
                      <th style={{ padding: '10px 14px' }}>Картка ID</th>
                      <th style={{ padding: '10px 14px' }}>Наряд</th>
                      <th style={{ padding: '10px 14px' }}>Кількість</th>
                      <th style={{ padding: '10px 14px' }}>Стадія</th>
                      <th style={{ padding: '10px 14px' }}>Оператор</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const shortId = r.card_id ? `#${String(r.card_id).slice(-8).toUpperCase()}` : '—'
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${t.tableRowBorder}` }}>
                          <td style={{ padding: '10px 14px', color: t.textSecondary, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Calendar size={12} color={t.textMuted} /> {formatDateTime(r.timestamp)}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {r.card_id ? (
                              <span
                                onClick={() => handleCopyId(r.card_id)}
                                title={r.card_id}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '6px', background: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5', color: '#10b981', fontWeight: 800, fontFamily: 'monospace', cursor: 'pointer', fontSize: '0.76rem' }}
                              >
                                {shortId} {copiedId === r.card_id ? <Check size={11} /> : <Copy size={11} />}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: t.textPrimary }}>№{r.order_num}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 900, color: '#10b981' }}>+{formatQty(r.quantity)}</td>
                          <td style={{ padding: '10px 14px', color: t.textSecondary }}>{r.source}</td>
                          <td style={{ padding: '10px 14px', color: t.textPrimary }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <User size={12} color={t.textMuted} /> {r.operator_name}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {activeTab === 'expenses' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: t.tableHeaderBg, borderBottom: `1px solid ${t.cardBorder}`, fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 14px' }}>Дата / Час</th>
                      <th style={{ padding: '10px 14px' }}>Наряд / Клієнт</th>
                      <th style={{ padding: '10px 14px' }}>Опис</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Списано</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${t.tableRowBorder}` }}>
                        <td style={{ padding: '10px 14px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: t.textPrimary }}>№{r.order_num} {r.customer && r.customer !== '—' ? `(${r.customer})` : ''}</td>
                        <td style={{ padding: '10px 14px', color: t.textSecondary }}>{r.details}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>−{formatQty(r.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'adjustments' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: t.tableHeaderBg, borderBottom: `1px solid ${t.cardBorder}`, fontSize: '0.7rem', fontWeight: 800, color: t.textSecondary, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 14px' }}>Дата / Час</th>
                      <th style={{ padding: '10px 14px' }}>Хто змінив</th>
                      <th style={{ padding: '10px 14px' }}>Причина</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Зміна</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Було → Стало</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(a => {
                      const isAdd = a.action === 'add'
                      return (
                        <tr key={a.id} style={{ borderBottom: `1px solid ${t.tableRowBorder}` }}>
                          <td style={{ padding: '10px 14px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: t.textPrimary }}>{a.actor_name}</td>
                          <td style={{ padding: '10px 14px', color: t.textSecondary }}>{a.reason || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: isAdd ? '#10b981' : '#ef4444' }}>
                            {isAdd ? '+' : '−'}{formatQty(a.delta_qty)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: t.textSecondary }}>
                            {formatQty(a.qty_before)} → <strong style={{ color: t.textPrimary }}>{formatQty(a.qty_after)}</strong>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div style={{ padding: '12px 24px', background: t.headerBg, borderTop: `1px solid ${t.modalBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: t.textSecondary }}>
            Записів у вкладці: <strong style={{ color: t.textPrimary }}>{formatQty(totalRows)}</strong> · Сторінка <strong style={{ color: t.textPrimary }}>{page + 1}</strong> з <strong style={{ color: t.textPrimary }}>{totalPages}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page <= 0 || loading}
              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.cardBorder}`, background: t.cardBg, color: t.textPrimary, cursor: page <= 0 ? 'not-allowed' : 'pointer', opacity: page <= 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
            >
              <ChevronLeft size={14} /> Попередня
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${t.cardBorder}`, background: t.cardBg, color: t.textPrimary, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
            >
              Наступна <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', marginLeft: '6px' }}
            >
              ЗАКРИТИ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
