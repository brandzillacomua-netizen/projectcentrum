import React, { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Cpu,
  RefreshCw,
  Zap,
  Clock,
  BarChart2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  Layers,
  Paintbrush,
  CheckCircle2
} from 'lucide-react'
import { useMES } from '../../MESContext'
import { supabase } from '../../supabase'
import { computeProductionPriorities, formatDurationHuman } from './utils/autopilotEngine'
import { useFinishedProductsTimeReport } from './hooks/useFinishedProductsTimeReport'

function getDefaultMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatAvgPerCard(mins) {
  const val = Number(mins) || 0
  if (val <= 0) return '—'
  if (val < 1) return `${Math.max(1, Math.round(val * 60))} с`
  return formatDurationHuman(val)
}

function getPartCardsCount(part) {
  return Math.max(0, ...Object.values(part?.stageCards || {}))
}

export default function ProductionAutopilotModule() {
  const {
    orders = [],
    tasks = [],
    workCards = [],
    workCardHistory = [],
    inventory = [],
    nomenclatures = [],
    products = [],
    bomItems = [],
    fetchData
  } = useMES()

  const [activeTab, setActiveTab] = useState('priorities') // 'priorities' | 'products_time' | 'products_summary'
  const [timeMode, setTimeMode] = useState('calendar') // 'calendar' | 'cards'

  const renderTimeModeToggle = () => (
    <div
      style={{ display: 'inline-flex', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '3px', gap: '4px' }}
      title="Реальний календарний час об’єднує перекриті інтервали паралельних карток"
    >
      <button
        type="button"
        onClick={() => setTimeMode('calendar')}
        style={{
          padding: '6px 12px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.76rem',
          fontWeight: 850,
          background: timeMode === 'calendar' ? '#0284c7' : 'transparent',
          color: timeMode === 'calendar' ? '#fff' : 'var(--text-muted)'
        }}
      >
        Реальний календарний час
      </button>
      <button
        type="button"
        onClick={() => setTimeMode('cards')}
        style={{
          padding: '6px 12px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.76rem',
          fontWeight: 850,
          background: timeMode === 'cards' ? '#ea580c' : 'transparent',
          color: timeMode === 'cards' ? '#fff' : 'var(--text-muted)'
        }}
      >
        Сума по картках
      </button>
    </div>
  )
  const [dateFrom, setDateFrom] = useState(getDefaultMonthStart)
  const [dateTo, setDateTo] = useState(getTodayStr)
  const [productSearch, setProductSearch] = useState('')
  const [expandedProductKeys, setExpandedProductKeys] = useState(() => new Set())
  const [expandedSummaryKeys, setExpandedSummaryKeys] = useState(() => new Set())
  const [expandedOrderIds, setExpandedOrderIds] = useState(() => new Set())
  const [activeOrderCards, setActiveOrderCards] = useState([])

  useEffect(() => {
    if (typeof fetchData === 'function') {
      fetchData(['orders', 'tasks', 'work_cards', 'work_card_history', 'inventory', 'nomenclatures', 'bom_items']).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch ALL work_cards (including completed/archived) for active orders so kit-readiness is 100% accurate
  useEffect(() => {
    const activeIds = (orders || [])
      .filter(o => !['completed', 'done', 'archived', 'cancelled', 'shipped'].includes(String(o?.status || '').toLowerCase()))
      .map(o => o.id)
      .filter(Boolean)
    if (activeIds.length === 0) {
      setActiveOrderCards([])
      return
    }
    let cancelled = false
    const loadAllOrderCards = async () => {
      try {
        const chunks = []
        for (let i = 0; i < activeIds.length; i += 20) {
          chunks.push(activeIds.slice(i, i + 20))
        }
        const results = await Promise.all(
          chunks.map(chunk =>
            supabase
              .from('work_cards')
              .select('id, order_id, task_id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info')
              .in('order_id', chunk)
              .limit(5000)
          )
        )
        if (cancelled) return
        const merged = []
        results.forEach(({ data }) => {
          if (Array.isArray(data)) merged.push(...data)
        })
        setActiveOrderCards(merged)
      } catch (e) {
        console.warn('[ProductionAutopilot] Failed to load active order cards:', e)
      }
    }
    loadAllOrderCards()
    return () => {
      cancelled = true
    }
  }, [orders])

  const mergedWorkCards = useMemo(() => {
    const map = new Map()
    ;(workCards || []).forEach(c => map.set(String(c.id), c))
    ;(activeOrderCards || []).forEach(c => map.set(String(c.id), c))
    return [...map.values()]
  }, [workCards, activeOrderCards])

  const { orderReadinessList, shop1Queue, shop2Queue } = useMemo(
    () =>
      computeProductionPriorities({
        orders,
        tasks,
        workCards: mergedWorkCards,
        workCardHistory,
        inventory,
        nomenclatures,
        products,
        bomItems
      }),
    [orders, tasks, mergedWorkCards, workCardHistory, inventory, nomenclatures, products, bomItems]
  )

  const {
    loading: reportLoading,
    error: reportError,
    reportRows,
    reload: reloadReport
  } = useFinishedProductsTimeReport({
    enabled: activeTab === 'products_time' || activeTab === 'products_summary',
    dateFrom,
    dateTo,
    orders,
    workCards: mergedWorkCards,
    nomenclatures,
    products,
    bomItems
  })

  const filteredReportRows = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return reportRows
    return reportRows.filter(
      r =>
        String(r.productName || '').toLowerCase().includes(q) ||
        String(r.orderNum || '').toLowerCase().includes(q) ||
        String(r.customer || '').toLowerCase().includes(q) ||
        r.parts.some(p => String(p.nomName || '').toLowerCase().includes(q))
    )
  }, [reportRows, productSearch])

  // Aggregate per-order rows into flat per-Product rows (sum of orders + average per 1 product + per-part breakdown)
  const productSummaryRows = useMemo(() => {
    const isCalendar = timeMode === 'calendar'
    const map = new Map()
    filteredReportRows.forEach(r => {
      const key = String(r.productName || 'Без виробу').trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          key,
          productName: r.productName || 'Без виробу',
          orderNums: [],
          ordersCount: 0,
          totalOrderQty: 0,
          totalMinutes: 0,
          cardTotalMinutes: 0,
          totalScrap: 0,
          stages: {},
          cardStages: {},
          stageCards: {},
          partsMap: new Map(),
          stageColumns: r.stageColumns || []
        })
      }
      const cur = map.get(key)
      cur.ordersCount += 1
      if (r.orderNum && r.orderNum !== '—') cur.orderNums.push(r.orderNum)
      cur.totalOrderQty += Number(r.orderQty || 0)
      cur.totalMinutes += Number(isCalendar ? (r.wallTotalMinutes ?? r.totalMinutes) : r.totalMinutes || 0)
      cur.cardTotalMinutes += Number(r.totalMinutes || 0)
      cur.totalScrap += Number(r.totalScrap || 0)
      if (isCalendar) {
        Object.entries(r.wallStages || {}).forEach(([st, mins]) => {
          cur.stages[st] = (cur.stages[st] || 0) + Number(mins || 0)
        })
      }
      ;(r.parts || []).forEach(p => {
        if (!cur.partsMap.has(p.nomId)) {
          cur.partsMap.set(p.nomId, {
            nomId: p.nomId,
            nomName: p.nomName,
            nomCode: p.nomCode,
            qtyCompleted: 0,
            scrapQty: 0,
            totalMinutes: 0,
            cardTotalMinutes: 0,
            stages: {},
            cardStages: {},
            stageCards: {}
          })
        }
        const aggPart = cur.partsMap.get(p.nomId)
        aggPart.qtyCompleted += Number(p.qtyCompleted || 0)
        aggPart.scrapQty += Number(p.scrapQty || 0)
        aggPart.totalMinutes += Number(isCalendar ? (p.wallTotalMinutes ?? p.totalMinutes) : p.totalMinutes || 0)
        aggPart.cardTotalMinutes += Number(p.totalMinutes || 0)
        Object.entries(p.stages || {}).forEach(([st, mins]) => {
          const m = Number(mins || 0)
          cur.cardStages[st] = (cur.cardStages[st] || 0) + m
          aggPart.cardStages[st] = (aggPart.cardStages[st] || 0) + m
          if (!isCalendar) {
            cur.stages[st] = (cur.stages[st] || 0) + m
            aggPart.stages[st] = (aggPart.stages[st] || 0) + m
          }
        })
        if (isCalendar) {
          Object.entries(p.wallStages || {}).forEach(([st, mins]) => {
            aggPart.stages[st] = (aggPart.stages[st] || 0) + Number(mins || 0)
          })
        }
        Object.entries(p.stageCards || {}).forEach(([st, cnt]) => {
          const c = Number(cnt || 0)
          cur.stageCards[st] = (cur.stageCards[st] || 0) + c
          aggPart.stageCards[st] = (aggPart.stageCards[st] || 0) + c
        })
      })
    })
    return [...map.values()]
      .map(item => {
        const parts = [...item.partsMap.values()].sort((a, b) => b.totalMinutes - a.totalMinutes)
        const totalCards = parts.reduce((sum, p) => sum + getPartCardsCount(p), 0)
        return {
          ...item,
          orderNums: [...new Set(item.orderNums)],
          parts,
          totalCards,
          avgMinutesPerCard: totalCards > 0 ? item.cardTotalMinutes / totalCards : 0,
          avgMinutesPerProduct: item.totalOrderQty > 0 ? item.totalMinutes / item.totalOrderQty : 0,
          avgMinutesPerOrder: item.ordersCount > 0 ? item.totalMinutes / item.ordersCount : 0
        }
      })
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [filteredReportRows, timeMode])

  const toggleExpandSummary = (key) => {
    setExpandedSummaryKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleExpandOrder = (orderId) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const toggleExpandProduct = (key) => {
    setExpandedProductKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const avgKitPct = useMemo(() => {
    if (orderReadinessList.length === 0) return 0
    return Math.round(
      orderReadinessList.reduce((sum, o) => sum + o.kitsPct, 0) / orderReadinessList.length
    )
  }, [orderReadinessList])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-strong)',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={22} color="#8b5cf6" />
              <h1 style={{ fontSize: '1.35rem', fontWeight: 950, margin: 0, color: 'var(--text-strong)' }}>
                Автопілот Виробництва
              </h1>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Комплектність у реальному часі, пріоритети цехів та фактична трудомісткість виробів
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (typeof fetchData === 'function') {
              fetchData(['orders', 'tasks', 'work_cards', 'work_card_history', 'inventory', 'bom_items'], { force: true }).catch(() => {})
            }
            if (activeTab === 'products_time' || activeTab === 'products_summary') reloadReport()
          }}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-strong)',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={14} /> Оновити дані
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('priorities')}
          style={{
            background: activeTab === 'priorities' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'var(--card-bg)',
            color: activeTab === 'priorities' ? '#ffffff' : 'var(--text-muted)',
            border: activeTab === 'priorities' ? 'none' : '1px solid var(--border-subtle)',
            padding: '10px 18px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Zap size={16} /> Пріоритети та Комплектність
        </button>

        <button
          onClick={() => setActiveTab('products_time')}
          style={{
            background: activeTab === 'products_time' ? 'linear-gradient(135deg, #ff9000, #ea580c)' : 'var(--card-bg)',
            color: activeTab === 'products_time' ? '#ffffff' : 'var(--text-muted)',
            border: activeTab === 'products_time' ? 'none' : '1px solid var(--border-subtle)',
            padding: '10px 18px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={16} /> Фактичний час по нарядах
        </button>

        <button
          onClick={() => setActiveTab('products_summary')}
          style={{
            background: activeTab === 'products_summary' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'var(--card-bg)',
            color: activeTab === 'products_summary' ? '#ffffff' : 'var(--text-muted)',
            border: activeTab === 'products_summary' ? 'none' : '1px solid var(--border-subtle)',
            padding: '10px 18px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BarChart2 size={16} /> По виробах (Сума і Середній час)
        </button>
      </div>

      {/* TAB 1: PRIORITIES & KIT READINESS */}
      {activeTab === 'priorities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Активні наряди (з BOM)</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 950, color: '#0284c7', marginTop: '4px' }}>{orderReadinessList.length}</div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Середня комплектність</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 950, color: '#059669', marginTop: '4px' }}>{avgKitPct}%</div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>У черзі Цеху №1</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 950, color: '#ea580c', marginTop: '4px' }}>{shop1Queue.length} <small style={{ fontSize: '0.75rem' }}>поз.</small></div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Готово до запуску в Цех №2</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 950, color: '#7c3aed', marginTop: '4px' }}>{shop2Queue.length} <small style={{ fontSize: '0.75rem' }}>поз.</small></div>
            </div>
          </div>

          {/* Kit-Readiness per Order */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '18px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 950, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-strong)' }}>
              <Layers size={18} color="#0284c7" /> Готовність комплектів по нарядах (вузькі місця)
            </h2>
            {orderReadinessList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                Активних нарядів із BOM не знайдено.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Наряд / Виріб</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Комплекти</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Гальмо (вузька деталь)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Дедлайн</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Орієнт. залишок (ETA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderReadinessList.slice(0, 15).map(ord => {
                      const isOpen = expandedOrderIds.has(ord.orderId)
                      return (
                        <React.Fragment key={ord.orderId}>
                          <tr
                            onClick={() => toggleExpandOrder(ord.orderId)}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              background: isOpen ? 'var(--fill-subtle)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isOpen ? <ChevronDown size={16} color="#0284c7" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                                <div>
                                  <div style={{ fontWeight: 900, color: 'var(--text-strong)' }}>{ord.productName}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Наряд №{ord.orderNum} {ord.customer ? `· ${ord.customer}` : ''} · {(ord.parts || []).length} дет.
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900 }}>
                              <span style={{ color: ord.kitsPct >= 100 ? '#059669' : '#0284c7' }}>
                                {ord.kitsReady} / {ord.orderQty}
                              </span>
                              <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ({ord.kitsPct}%)
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#d97706', fontWeight: 800 }}>
                              {ord.bottleneckPart}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}>
                              {ord.daysLeft === null ? '—' : (
                                <span style={{ color: ord.daysLeft <= 2 ? '#ef4444' : ord.daysLeft <= 5 ? '#d97706' : '#059669' }}>
                                  {ord.daysLeft <= 0 ? 'Прострочено / сьогодні' : `${ord.daysLeft} дн.`}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>
                              {ord.estRemainingHours > 0 ? `~${ord.estRemainingHours} год` : 'Готово'}
                            </td>
                          </tr>

                          {isOpen && (ord.parts || []).length > 0 && (
                            <tr style={{ background: 'var(--fill-subtle)', borderBottom: '1.5px solid var(--border-subtle)' }}>
                              <td colSpan={5} style={{ padding: '10px 14px 14px 36px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>
                                      <th style={{ padding: '6px', textAlign: 'left' }}>Деталь (норма/компл)</th>
                                      <th style={{ padding: '6px', textAlign: 'right' }}>Потреба</th>
                                      <th style={{ padding: '6px', textAlign: 'right', color: '#059669' }}>Готово (СГП)</th>
                                      <th style={{ padding: '6px', textAlign: 'right', color: '#7c3aed' }}>Буфер Цех №2</th>
                                      <th style={{ padding: '6px', textAlign: 'right', color: '#ea580c' }}>У роботі Ц1</th>
                                      <th style={{ padding: '6px', textAlign: 'right', color: '#0284c7' }}>У роботі Ц2</th>
                                      <th style={{ padding: '6px', textAlign: 'right', color: '#ef4444' }}>Дефіцит</th>
                                      <th style={{ padding: '6px', textAlign: 'right' }}>Комплекти</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ord.parts.map(p => (
                                      <tr key={p.nomId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '6px', fontWeight: 850, color: 'var(--text-strong)' }}>
                                          {p.isCriticalDeficit ? (
                                            <span style={{ background: 'rgba(239,68,68,0.16)', color: '#ef4444', padding: '1px 5px', borderRadius: '4px', fontSize: '0.64rem', fontWeight: 900, marginRight: '6px' }}>
                                              КРИТИЧНО
                                            </span>
                                          ) : p.isBottleneck ? (
                                            <span style={{ background: 'rgba(245,158,11,0.16)', color: '#d97706', padding: '1px 5px', borderRadius: '4px', fontSize: '0.64rem', fontWeight: 900, marginRight: '6px' }}>
                                              ГАЛЬМО СГП
                                            </span>
                                          ) : null}
                                          {p.nomName}
                                          {p.qtyPerKit > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: '4px' }}>({p.qtyPerKit} шт/компл)</span>}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800 }}>
                                          {p.requiredTotal.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                                          {p.doneQty.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>
                                          {p.shop2BufferAvail > 0 ? p.shop2BufferAvail.toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>
                                          {p.inShop1Work > 0 ? p.inShop1Work.toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                                          {p.inShop2Work > 0 ? p.inShop2Work.toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 900, color: p.deficitForShop1 > 0 ? '#ef4444' : 'var(--text-dim)' }}>
                                          {p.deficitForShop1 > 0 ? p.deficitForShop1.toLocaleString() : '0'}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 900 }}>
                                          <span style={{ color: p.kitsReady >= ord.orderQty ? '#059669' : 'var(--text-strong)' }}>
                                            {p.kitsReady}
                                          </span>
                                          <span style={{ color: 'var(--text-muted)' }}> / {ord.orderQty}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Two Priority Queues */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            {/* Shop 1 Queue */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,144,0,0.35)', borderRadius: '18px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 950, color: '#ea580c' }}>
                🔥 Рекомендована черга · Цех №1 (Розкрій → Галтовка)
              </h3>
              {shop1Queue.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '12px 0' }}>Дефіциту в Цеху №1 немає.</div>
              ) : (
                shop1Queue.slice(0, 12).map((item, idx) => (
                  <div key={item.nomId} style={{ background: 'var(--fill-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ background: idx < 3 ? '#ef4444' : '#ff9000', color: '#fff', fontSize: '0.68rem', fontWeight: 950, padding: '2px 7px', borderRadius: '6px' }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontWeight: 900, fontSize: '0.86rem', color: 'var(--text-strong)' }}>{item.nomName}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {item.reasons.map((r, rIdx) => (
                          <span key={rIdx} style={{ background: 'rgba(255,144,0,0.14)', color: '#d97706', padding: '1px 6px', borderRadius: '5px', fontWeight: 700 }}>{r}</span>
                        ))}
                        {item.scrapRatePct > 0 && <span>· брак ~{item.scrapRatePct}%</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 950, color: '#ea580c', fontSize: '0.92rem' }}>
                        {item.recommendedQty.toLocaleString()} шт
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {item.etaMinutes > 0 ? `ETA ~${formatDurationHuman(item.etaMinutes)}` : `У роботі: ${item.inWorkQty}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Shop 2 Queue */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '18px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 950, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Paintbrush size={16} /> Рекомендована черга · Цех №2 (Буфер готовий до запуску)
              </h3>
              {shop2Queue.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '12px 0' }}>У буфері Цеху №2 немає вільних деталей за активними нарядами.</div>
              ) : (
                shop2Queue.slice(0, 12).map((item, idx) => (
                  <div key={item.nomId} style={{ background: 'var(--fill-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ background: idx < 3 ? '#8b5cf6' : '#64748b', color: '#fff', fontSize: '0.68rem', fontWeight: 950, padding: '2px 7px', borderRadius: '6px' }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontWeight: 900, fontSize: '0.86rem', color: 'var(--text-strong)' }}>{item.nomName}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {item.requiresPressing && <span style={{ color: '#ea580c', fontWeight: 800 }}>🔩 Прес</span>}
                        {item.requiresPainting && <span style={{ color: '#7c3aed', fontWeight: 800 }}>🎨 Фарб.{item.cassettesHint ? ` (${item.cassettesHint})` : ''}</span>}
                        {item.reasons.map((r, rIdx) => (
                          <span key={rIdx} style={{ background: 'rgba(139,92,246,0.14)', color: '#7c3aed', padding: '1px 6px', borderRadius: '5px', fontWeight: 700 }}>{r}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 950, color: '#059669', fontSize: '0.92rem' }}>
                        {item.bufferAvailQty.toLocaleString()} шт
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {item.etaMinutes > 0 ? `ETA ~${formatDurationHuman(item.etaMinutes)}` : 'Готово до запуску'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINISHED PRODUCTS ACTUAL TIME REPORT */}
      {activeTab === 'products_time' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Filters */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>З:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '7px 10px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 800 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>По:</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '7px 10px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 800 }}
              />
            </div>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Пошук виробу, наряду, замовника або деталі..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '8px 12px 8px 34px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 700, boxSizing: 'border-box' }}
              />
            </div>
            {renderTimeModeToggle()}
          </div>

          {/* Summary KPI */}
          {(() => {
            const isCalendar = timeMode === 'calendar'
            const totalOrderQty = filteredReportRows.reduce((s, r) => s + (r.orderQty || 0), 0)
            const totalMinutes = filteredReportRows.reduce(
              (s, r) => s + (isCalendar ? (r.wallTotalMinutes ?? r.totalMinutes) : (r.totalMinutes || 0)),
              0
            )
            const totalCardMinutes = filteredReportRows.reduce((s, r) => s + (r.totalMinutes || 0), 0)
            const totalCards = filteredReportRows.reduce(
              (s, r) => s + (r.parts || []).reduce((ps, p) => ps + getPartCardsCount(p), 0),
              0
            )
            const avgPerUnit = totalOrderQty > 0 ? Math.round((totalMinutes / totalOrderQty) * 10) / 10 : 0
            const avgPerCard = totalCards > 0 ? totalCardMinutes / totalCards : 0
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Виробів / нарядів за період</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0284c7', marginTop: '4px' }}>{filteredReportRows.length}</div>
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Кількість у нарядах</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#059669', marginTop: '4px' }}>
                    {totalOrderQty.toLocaleString()} шт
                  </div>
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Оброблено карт</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#7c3aed', marginTop: '4px' }}>
                    {totalCards.toLocaleString()}
                  </div>
                  {avgPerCard > 0 && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px' }}>
                      Середнє: ~{formatAvgPerCard(avgPerCard)} / картку
                    </div>
                  )}
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,144,0,0.35)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>Загалом фактичного часу</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#ea580c', marginTop: '4px' }}>
                    {formatDurationHuman(totalMinutes)}
                  </div>
                  {avgPerUnit > 0 && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px' }}>
                      Середнє: ~{avgPerUnit} хв / виріб
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {reportError && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> {reportError}
            </div>
          )}

          {/* Products List */}
          {reportLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
              Завантаження фактичних даних за період...
            </div>
          ) : filteredReportRows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
              За обраний період фактичних записів не знайдено.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredReportRows.map(prod => {
                const isCalendar = timeMode === 'calendar'
                const isExpanded = expandedProductKeys.has(prod.key)
                const isCompletedOrder = ['completed', 'done', 'shipped'].includes(String(prod.orderStatus || '').toLowerCase())
                const orderTimeMinutes = isCalendar ? (prod.wallTotalMinutes ?? prod.totalMinutes) : (prod.totalMinutes || 0)
                const perUnitMin = prod.orderQty > 0 ? Math.round((orderTimeMinutes / prod.orderQty) * 10) / 10 : 0
                const orderTotalCards = (prod.parts || []).reduce((s, p) => s + getPartCardsCount(p), 0)
                const orderAvgPerCard = orderTotalCards > 0 ? (prod.totalMinutes || 0) / orderTotalCards : 0

                return (
                  <div
                    key={prod.key}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpandProduct(prod.key)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        padding: '14px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '240px', flex: 1 }}>
                        {isExpanded ? <ChevronDown size={18} color="#ff9000" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 950, fontSize: '0.98rem', color: 'var(--text-strong)' }}>{prod.productName}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, background: 'rgba(2,132,199,0.14)', color: '#0284c7', padding: '2px 8px', borderRadius: '6px' }}>
                              Наряд №{prod.orderNum}
                            </span>
                            {orderTotalCards > 0 && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', padding: '2px 8px', borderRadius: '6px' }}>
                                {orderTotalCards.toLocaleString()} карт
                              </span>
                            )}
                            {isCompletedOrder && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'rgba(16,185,129,0.14)', color: '#059669', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} /> Завершено
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {prod.customer ? `${prod.customer} · ` : ''}Деталей у роботі: {prod.parts.length} · План наряду: {prod.orderQty.toLocaleString()} шт
                            {perUnitMin > 0 ? ` · ~${perUnitMin} хв/виріб` : ''}
                            {orderAvgPerCard > 0 ? ` · ~${formatAvgPerCard(orderAvgPerCard)}/карт` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {isCalendar ? 'Календарний час виробу' : 'Сума по виробу'}
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 950, color: isCalendar ? '#0284c7' : '#ea580c' }}>
                          {formatDurationHuman(orderTimeMinutes)}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 18px 16px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '860px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                              <th style={{ padding: '8px', textAlign: 'left' }}>Деталь</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Оброблено / Брак</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Карт</th>
                              <th style={{ padding: '8px', textAlign: 'right', color: '#0284c7' }}>Середнє / картку</th>
                              {prod.stageColumns.map(st => (
                                <th key={st} style={{ padding: '8px', textAlign: 'right', color: st.startsWith('Буфер') ? '#7c3aed' : undefined }}>{st}</th>
                              ))}
                              <th style={{ padding: '8px', textAlign: 'right', color: isCalendar ? '#0284c7' : '#ea580c' }}>Разом</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prod.parts.map(p => {
                              const partCardsCount = getPartCardsCount(p)
                              const partCardMins = p.totalMinutes || 0
                              const partDisplayMins = isCalendar ? (p.wallTotalMinutes ?? partCardMins) : partCardMins
                              const partPerCard = partCardsCount > 0 ? partCardMins / partCardsCount : 0
                              return (
                                <tr key={p.nomId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td style={{ padding: '8px', fontWeight: 850, color: 'var(--text-strong)' }}>
                                    {p.nomName} {p.nomCode ? <span style={{ color: 'var(--text-muted)' }}>({p.nomCode})</span> : ''}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800 }}>
                                    <span style={{ color: '#059669' }}>{p.qtyCompleted.toLocaleString()}</span>
                                    {p.scrapQty > 0 && <span style={{ color: '#ef4444' }}> / {p.scrapQty}</span>}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800, color: 'var(--text)' }}>
                                    {partCardsCount > 0 ? partCardsCount.toLocaleString() : '—'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, color: '#0284c7' }}>
                                    {partPerCard > 0 ? formatDurationHuman(partPerCard) : '—'}
                                  </td>
                                  {prod.stageColumns.map(st => {
                                    const stCardMins = p.stages[st] || 0
                                    const stMins = isCalendar ? (p.wallStages?.[st] ?? stCardMins) : stCardMins
                                    const stCards = p.stageCards?.[st] || 0
                                    const avgPerCard = stCards > 0 && stCardMins > 0 ? stCardMins / stCards : 0
                                    return (
                                      <td key={st} style={{ padding: '8px', textAlign: 'right' }}>
                                        {stMins > 0 ? (
                                          <div>
                                            <div style={{ color: 'var(--text)' }}>{formatDurationHuman(stMins)}</div>
                                            {avgPerCard > 0 && (
                                              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                                ~{formatAvgPerCard(avgPerCard)}/карт ({stCards})
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 950, color: isCalendar ? '#0284c7' : '#ea580c' }}>
                                    {formatDurationHuman(partDisplayMins)}
                                  </td>
                                </tr>
                              )
                            })}
                            {/* Total Row */}
                            <tr style={{ background: isCalendar ? 'rgba(2,132,199,0.08)' : 'rgba(255,144,0,0.08)', fontWeight: 950 }}>
                              <td style={{ padding: '10px 8px', color: 'var(--text-strong)' }}>СУМА ПО ВИРОБУ</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                {prod.totalScrap > 0 ? `Брак: ${prod.totalScrap} шт` : '—'}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text)' }}>
                                {orderTotalCards > 0 ? orderTotalCards.toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0284c7' }}>
                                {orderAvgPerCard > 0 ? formatDurationHuman(orderAvgPerCard) : '—'}
                              </td>
                              {prod.stageColumns.map(st => {
                                const stCardSum = prod.parts.reduce((s, p) => s + (p.stages[st] || 0), 0)
                                const stSum = isCalendar ? (prod.wallStages?.[st] ?? stCardSum) : stCardSum
                                const stCards = prod.parts.reduce((s, p) => s + (p.stageCards?.[st] || 0), 0)
                                const stAvg = stCards > 0 && stCardSum > 0 ? stCardSum / stCards : 0
                                return (
                                  <td key={st} style={{ padding: '10px 8px', textAlign: 'right' }}>
                                    {stSum > 0 ? (
                                      <div>
                                        <div>{formatDurationHuman(stSum)}</div>
                                        {stAvg > 0 && (
                                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                            ~{formatAvgPerCard(stAvg)}/карт ({stCards})
                                          </div>
                                        )}
                                      </div>
                                    ) : '—'}
                                  </td>
                                )
                              })}
                              <td style={{ padding: '10px 8px', textAlign: 'right', color: isCalendar ? '#0284c7' : '#ea580c', fontSize: '0.92rem' }}>
                                {formatDurationHuman(orderTimeMinutes)}
                              </td>
                            </tr>
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
      )}

      {/* TAB 3: FLAT SUMMARY BY PRODUCT (SUM OF ORDERS + AVG TIME PER PRODUCT) */}
      {activeTab === 'products_summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Filters */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>З:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '7px 10px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 800 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>По:</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '7px 10px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 800 }}
              />
            </div>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Пошук виробу або наряду..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '8px 12px 8px 34px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 700, boxSizing: 'border-box' }}
              />
            </div>
            {renderTimeModeToggle()}
          </div>

          {reportError && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> {reportError}
            </div>
          )}

          {reportLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
              Завантаження зведених даних по виробах...
            </div>
          ) : productSummaryRows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
              За обраний період даних по виробах не знайдено.
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '18px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '880px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border-subtle)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Виріб</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Нарядів</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Кількість (шт)</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', color: '#0284c7' }}>Середнє / 1 виріб</th>
                    {(productSummaryRows[0]?.stageColumns || []).map(st => (
                      <th key={st} style={{ padding: '10px 8px', textAlign: 'right', color: st.startsWith('Буфер') ? '#7c3aed' : undefined }}>{st}</th>
                    ))}
                    <th style={{ padding: '10px 8px', textAlign: 'right', color: '#ea580c' }}>Разом часу</th>
                  </tr>
                </thead>
                <tbody>
                  {productSummaryRows.map(item => {
                    const isOpen = expandedSummaryKeys.has(item.key)
                    const colCount = 5 + (item.stageColumns?.length || 0)
                    return (
                      <React.Fragment key={item.key}>
                        <tr
                          onClick={() => toggleExpandSummary(item.key)}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            background: isOpen ? 'var(--fill-subtle)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isOpen ? <ChevronDown size={16} color="#0284c7" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                              <div>
                                <div style={{ fontWeight: 950, color: 'var(--text-strong)', fontSize: '0.9rem' }}>
                                  {item.productName}
                                </div>
                                {item.orderNums.length > 0 && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Наряди: {item.orderNums.slice(0, 5).join(', ')}{item.orderNums.length > 5 ? ` +${item.orderNums.length - 5}` : ''} · {item.parts.length} дет.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800 }}>
                            {item.ordersCount}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                            {item.totalOrderQty.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 950, color: '#0284c7' }}>
                            <div>
                              {item.avgMinutesPerProduct > 0
                                ? `${Math.round(item.avgMinutesPerProduct * 10) / 10} хв/вир`
                                : '—'}
                            </div>
                            {item.avgMinutesPerCard > 0 && (
                              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                ~{formatAvgPerCard(item.avgMinutesPerCard)}/карт ({item.totalCards})
                              </div>
                            )}
                          </td>
                          {(item.stageColumns || []).map(st => {
                            const stMins = item.stages[st] || 0
                            const stCardMins = item.cardStages?.[st] || stMins
                            const stCards = item.stageCards?.[st] || 0
                            const stPerCard = stCards > 0 && stCardMins > 0 ? stCardMins / stCards : 0
                            const stPerUnit = item.totalOrderQty > 0 ? Math.round((stMins / item.totalOrderQty) * 10) / 10 : 0
                            return (
                              <td key={st} style={{ padding: '12px 8px', textAlign: 'right' }}>
                                {stMins > 0 ? (
                                  <div>
                                    <div style={{ fontWeight: 800, color: 'var(--text)' }}>{formatDurationHuman(stMins)}</div>
                                    {stPerCard > 0 ? (
                                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                        ~{formatAvgPerCard(stPerCard)}/карт ({stCards})
                                      </div>
                                    ) : stPerUnit > 0 ? (
                                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>~{stPerUnit} хв/шт</div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                                )}
                              </td>
                            )
                          })}
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 950, color: '#ea580c', fontSize: '0.92rem' }}>
                            {formatDurationHuman(item.totalMinutes)}
                          </td>
                        </tr>

                        {isOpen && item.parts.length > 0 && (
                          <tr style={{ background: 'var(--fill-subtle)', borderBottom: '1.5px solid var(--border-subtle)' }}>
                            <td colSpan={colCount} style={{ padding: '10px 14px 14px 32px' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Деталізація по деталях ({item.productName} · сума {item.ordersCount} нарядів):
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>Деталь</th>
                                    <th style={{ padding: '6px', textAlign: 'right' }}>Оброблено / Брак</th>
                                    <th style={{ padding: '6px', textAlign: 'center' }}>Карт</th>
                                    <th style={{ padding: '6px', textAlign: 'right', color: '#0284c7' }}>Середнє / картку</th>
                                    {(item.stageColumns || []).map(st => (
                                      <th key={st} style={{ padding: '6px', textAlign: 'right', color: st.startsWith('Буфер') ? '#7c3aed' : undefined }}>{st}</th>
                                    ))}
                                    <th style={{ padding: '6px', textAlign: 'right', color: '#ea580c' }}>Разом</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.parts.map(p => {
                                    const partCardsCount = getPartCardsCount(p)
                                    const partPerCard = partCardsCount > 0 ? (p.cardTotalMinutes ?? p.totalMinutes) / partCardsCount : 0
                                    return (
                                      <tr key={p.nomId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '6px', fontWeight: 850, color: 'var(--text-strong)' }}>
                                          {p.nomName} {p.nomCode ? <span style={{ color: 'var(--text-muted)' }}>({p.nomCode})</span> : ''}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800 }}>
                                          <span style={{ color: '#059669' }}>{p.qtyCompleted.toLocaleString()}</span>
                                          {p.scrapQty > 0 && <span style={{ color: '#ef4444' }}> / {p.scrapQty}</span>}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, color: 'var(--text)' }}>
                                          {partCardsCount > 0 ? partCardsCount.toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 900, color: '#0284c7' }}>
                                          {partPerCard > 0 ? `${formatDurationHuman(partPerCard)}` : '—'}
                                        </td>
                                        {(item.stageColumns || []).map(st => {
                                          const stMins = p.stages[st] || 0
                                          const stCardMins = p.cardStages?.[st] || stMins
                                          const stCards = p.stageCards?.[st] || 0
                                          const avgPerCard = stCards > 0 && stCardMins > 0 ? stCardMins / stCards : 0
                                          return (
                                            <td key={st} style={{ padding: '6px', textAlign: 'right' }}>
                                              {stMins > 0 ? (
                                                <div>
                                                  <div style={{ color: 'var(--text)' }}>{formatDurationHuman(stMins)}</div>
                                                  {avgPerCard > 0 && (
                                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                                      ~{formatAvgPerCard(avgPerCard)}/карт ({stCards})
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <span style={{ color: 'var(--text-dim)' }}>—</span>
                                              )}
                                            </td>
                                          )
                                        })}
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 950, color: '#ea580c' }}>
                                          {formatDurationHuman(p.totalMinutes)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                  {/* Grand Total Row */}
                  <tr style={{ background: 'rgba(2, 132, 199, 0.08)', fontWeight: 950 }}>
                    <td style={{ padding: '12px 8px', color: 'var(--text-strong)' }}>РАЗОМ ЗА ПЕРІОД ({productSummaryRows.length} виробів)</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {productSummaryRows.reduce((s, r) => s + r.ordersCount, 0)}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: '#059669' }}>
                      {productSummaryRows.reduce((s, r) => s + r.totalOrderQty, 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: '#0284c7' }}>
                      {(() => {
                        const totQty = productSummaryRows.reduce((s, r) => s + r.totalOrderQty, 0)
                        const totMin = productSummaryRows.reduce((s, r) => s + r.totalMinutes, 0)
                        return totQty > 0 ? `${Math.round((totMin / totQty) * 10) / 10} хв` : '—'
                      })()}
                    </td>
                    {(productSummaryRows[0]?.stageColumns || []).map(st => {
                      const stSum = productSummaryRows.reduce((s, r) => s + (r.stages[st] || 0), 0)
                      return (
                        <td key={st} style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {stSum > 0 ? formatDurationHuman(stSum) : '—'}
                        </td>
                      )
                    })}
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: '#ea580c', fontSize: '0.95rem' }}>
                      {formatDurationHuman(productSummaryRows.reduce((s, r) => s + r.totalMinutes, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
