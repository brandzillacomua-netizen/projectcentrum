import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  LayoutDashboard,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  Package,
  Search
} from 'lucide-react'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const renderVal = (val = 0, type = 'normal', demand = 0) => {
  if (val === 0 && !demand) {
    return <span style={{ color: '#3f3f46', fontWeight: 400 }}>0</span>
  }
  let color = '#f4f4f5'
  let bg = 'rgba(255,255,255,0.04)'
  let border = '1px solid rgba(255,255,255,0.08)'

  if (type === 'sum') {
    color = '#ff9000'; bg = 'rgba(255,144,0,0.08)'; border = '1px solid rgba(255,144,0,0.2)'
  } else if (type === 'sgp' || type === 'bz') {
    color = '#10b981'; bg = 'rgba(16,185,129,0.08)'; border = '1px solid rgba(16,185,129,0.2)'
  } else if (type === 'scrap') {
    color = '#ef4444'; bg = 'rgba(239,68,68,0.08)'; border = '1px solid rgba(239,68,68,0.2)'
  }

  const displayVal = type === 'sum' && demand > 0 ? `${val} / ${demand}` : val

  return (
    <span className={type === 'sum' ? 'wip-sum-badge' : ''} style={{
      fontWeight: 'bold', color, background: bg, border, padding: '2px 6px',
      borderRadius: '4px', display: 'inline-block', minWidth: '24px',
      textAlign: 'center', whiteSpace: 'nowrap'
    }}>
      {displayVal}
    </span>
  )
}

const getGroupTotals = (rows) => {
  const r = { qCutWait: 0, qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMalWait: 0, qMal: 0, qMalBuf: 0, qPresWait: 0, qPres: 0, qPresBuf: 0, qDoopWait: 0, qDoop: 0, qDoopBuf: 0, qSgp: 0, qBz: 0, qScrap: 0, sum: 0 }
  rows.forEach(row => {
    Object.keys(r).forEach(k => { r[k] += row[k] || 0 })
  })
  return r
}

const fetchWorkCardHistoryByCardIds = async (cardIds = []) => {
  const rows = []
  const chunkSize = 25
  const pageSize = 1000

  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('work_card_history')
        .select('id, card_id, nomenclature_id, scrap_qty, created_at, completed_at')
        .in('card_id', chunk)
        .gt('scrap_qty', 0)
        .order('created_at', { ascending: true })
        .range(from, to)

      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
  }

  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

const fetchWorkCardsByTaskIds = async (taskIds = [], columns = '*') => {
  const rows = []
  const chunkSize = 25
  const pageSize = 1000

  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const chunk = taskIds.slice(i, i + chunkSize)
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('work_cards')
        .select(columns)
        .in('task_id', chunk)
        .order('created_at', { ascending: true })
        .range(from, to)

      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
  }

  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

// ─────────────────────────────────────────────────────────────
// WIP Table component (reusable for overview & per-order)
// ─────────────────────────────────────────────────────────────
const WipTable = ({ groupedData, maxHeight = 'calc(100vh - 320px)', emptyText = 'Немає даних' }) => {
  const [isFull, setIsFull] = React.useState(false)

  const renderTable = (scrollMaxHeight) => (
    <div style={{ borderRadius: '16px', border: '1px solid #27272a', background: '#09090b', overflow: 'auto', maxHeight: scrollMaxHeight, width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: '#f4f4f5', minWidth: '800px' }}>
        <thead>
          <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'center', borderBottom: '2px solid #27272a' }}>
            <th className="wip-col-nomenclature" style={TH_STICKY}>Номенклатура</th>
            <th className="wip-col-sum" style={TH_SUM}>Сума</th>
            <th style={TH}>Очік. Розкрій</th>
            <th style={TH}>Розкрій</th>
            <th style={TH}>Буфер Розкр.</th>
            <th style={TH}>Галтовка</th>
            <th style={TH}>Буфер Галт.</th>
            <th style={TH}>Прийомка</th>
            <th style={TH}>Сортування</th>
            <th style={TH}>Буфер Цех2</th>
            <th style={TH}>Очік. Малярка</th>
            <th style={TH}>Малярка</th>
            <th style={TH}>Буфер Мал.</th>
            <th style={TH}>Очік. Прес.</th>
            <th style={TH}>Пресування</th>
            <th style={TH}>Буфер Прес.</th>
            <th style={TH}>Очік. Доопр.</th>
            <th style={TH}>Доопрац.</th>
            <th style={TH}>Буфер Доопр.</th>
            <th style={{ ...TH, color: '#10b981', background: '#12251e' }}>СГП</th>
            <th style={{ ...TH, color: '#10b981', background: '#12251e' }}>БЗ</th>
            <th style={{ ...TH, color: '#ef4444', background: '#221414', borderRight: 'none' }}>Брак</th>
          </tr>
        </thead>
        <tbody>
          {groupedData.length === 0 ? (
            <tr>
              <td colSpan={22} style={{ padding: '40px', textAlign: 'center', color: '#52525b', fontStyle: 'italic' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            groupedData.map(group => {
              const gt = getGroupTotals(group.rows)
              return (
                <React.Fragment key={group.id}>
                  {/* Group header */}
                  <tr style={{ background: '#1c1917', borderBottom: '2px solid #27272a' }}>
                    <td colSpan={22} style={{ padding: '12px 16px', fontWeight: 'bold', color: '#fff', position: 'sticky', left: 0, background: '#1c1917', zIndex: 2 }}>
                      <span style={{ color: '#ff9000', marginRight: '8px' }}>📦</span>
                      {group.name}{group.code ? ` (${group.code})` : ''}
                      {group.trend && (
                        <span style={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '12px' }}>
                          Потенційний тренд: <strong style={{ color: '#fff' }}>{group.trend.potential}</strong> / {group.trend.demand || 0} компл.
                          {' '}| На СГП: <strong style={{ color: '#10b981' }}>{group.trend.actual} компл.</strong>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Rows */}
                  {group.rows.map(row => (
                    <tr key={row.id} style={{ background: '#09090b', borderBottom: '1px solid #1f1f22', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#18181b'}
                      onMouseLeave={e => e.currentTarget.style.background = '#09090b'}>
                      <td className="wip-col-nomenclature" style={{ ...TD_STICKY, paddingLeft: '28px' }}>
                        {row.name}
                        {row.code && <span style={{ display: 'block', fontSize: '0.68rem', color: '#52525b', marginTop: '1px' }}>Код: {row.code}</span>}
                      </td>
                      <td className="wip-col-sum" style={TD_SUM}>{renderVal(row.sum, 'sum', row.demand)}</td>
                      <td style={TD}>{renderVal(row.qCutWait)}</td>
                      <td style={TD}>{renderVal(row.qCut)}</td>
                      <td style={TD}>{renderVal(row.qCutBuf)}</td>
                      <td style={TD}>{renderVal(row.qGalt)}</td>
                      <td style={TD}>{renderVal(row.qGaltBuf)}</td>
                      <td style={TD}>{renderVal(row.qPriy)}</td>
                      <td style={TD}>{renderVal(row.qSortAct)}</td>
                      <td style={TD}>{renderVal(row.qSort)}</td>
                      <td style={TD}>{renderVal(row.qMalWait)}</td>
                      <td style={TD}>{renderVal(row.qMal)}</td>
                      <td style={TD}>{renderVal(row.qMalBuf)}</td>
                      <td style={TD}>{renderVal(row.qPresWait)}</td>
                      <td style={TD}>{renderVal(row.qPres)}</td>
                      <td style={TD}>{renderVal(row.qPresBuf)}</td>
                      <td style={TD}>{renderVal(row.qDoopWait)}</td>
                      <td style={TD}>{renderVal(row.qDoop)}</td>
                      <td style={TD}>{renderVal(row.qDoopBuf)}</td>
                      <td style={{ ...TD, background: 'rgba(16,185,129,0.03)' }}>{renderVal(row.qSgp, 'sgp')}</td>
                      <td style={{ ...TD, background: 'rgba(16,185,129,0.03)' }}>{renderVal(row.qBz, 'bz')}</td>
                      <td style={{ ...TD, background: 'rgba(239,68,68,0.03)', borderRight: 'none' }}>{renderVal(row.qScrap, 'scrap')}</td>
                    </tr>
                  ))}

                  {/* Subtotals */}
                  <tr style={{ background: '#141416', fontWeight: 'bold', borderTop: '1px solid #27272a', borderBottom: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.76rem' }}>
                    <td className="wip-col-nomenclature" style={{ ...TD_STICKY, fontStyle: 'italic', paddingLeft: '28px', color: '#52525b' }}>Підсумок по виробу:</td>
                    <td className="wip-col-sum" style={{ ...TD_SUM, background: '#251a12' }}>{renderVal(gt.sum, 'sum')}</td>
                    <td style={TD}>{renderVal(gt.qCutWait)}</td>
                    <td style={TD}>{renderVal(gt.qCut)}</td>
                    <td style={TD}>{renderVal(gt.qCutBuf)}</td>
                    <td style={TD}>{renderVal(gt.qGalt)}</td>
                    <td style={TD}>{renderVal(gt.qGaltBuf)}</td>
                    <td style={TD}>{renderVal(gt.qPriy)}</td>
                    <td style={TD}>{renderVal(gt.qSortAct)}</td>
                    <td style={TD}>{renderVal(gt.qSort)}</td>
                    <td style={TD}>{renderVal(gt.qMalWait)}</td>
                    <td style={TD}>{renderVal(gt.qMal)}</td>
                    <td style={TD}>{renderVal(gt.qMalBuf)}</td>
                    <td style={TD}>{renderVal(gt.qPresWait)}</td>
                    <td style={TD}>{renderVal(gt.qPres)}</td>
                    <td style={TD}>{renderVal(gt.qPresBuf)}</td>
                    <td style={TD}>{renderVal(gt.qDoopWait)}</td>
                    <td style={TD}>{renderVal(gt.qDoop)}</td>
                    <td style={TD}>{renderVal(gt.qDoopBuf)}</td>
                    <td style={{ ...TD, background: 'rgba(16,185,129,0.08)' }}>{renderVal(gt.qSgp, 'sgp')}</td>
                    <td style={{ ...TD, background: 'rgba(16,185,129,0.08)' }}>{renderVal(gt.qBz, 'bz')}</td>
                    <td style={{ ...TD, background: 'rgba(239,68,68,0.08)', borderRight: 'none' }}>{renderVal(gt.qScrap, 'scrap')}</td>
                  </tr>
                </React.Fragment>
              )
            })
          )}

          {/* Grand total */}
          {groupedData.length > 1 && (() => {
            const allRows = groupedData.flatMap(g => g.rows)
            const gt = getGroupTotals(allRows)
            return (
              <tr style={{ background: '#18181b', fontWeight: 'bold', borderTop: '2px solid #ff9000', color: '#fff', fontSize: '0.8rem' }}>
                <td className="wip-col-nomenclature" style={{ ...TD_STICKY, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.72rem' }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>
                <td className="wip-col-sum" style={{ ...TD_SUM, background: '#2e2014', color: '#ff9000' }}>{renderVal(gt.sum, 'sum')}</td>
                <td style={TD}>{renderVal(gt.qCutWait)}</td>
                <td style={TD}>{renderVal(gt.qCut)}</td>
                <td style={TD}>{renderVal(gt.qCutBuf)}</td>
                <td style={TD}>{renderVal(gt.qGalt)}</td>
                <td style={TD}>{renderVal(gt.qGaltBuf)}</td>
                <td style={TD}>{renderVal(gt.qPriy)}</td>
                <td style={TD}>{renderVal(gt.qSortAct)}</td>
                <td style={TD}>{renderVal(gt.qSort)}</td>
                <td style={TD}>{renderVal(gt.qMalWait)}</td>
                <td style={TD}>{renderVal(gt.qMal)}</td>
                <td style={TD}>{renderVal(gt.qMalBuf)}</td>
                <td style={TD}>{renderVal(gt.qPresWait)}</td>
                <td style={TD}>{renderVal(gt.qPres)}</td>
                <td style={TD}>{renderVal(gt.qPresBuf)}</td>
                <td style={TD}>{renderVal(gt.qDoopWait)}</td>
                <td style={TD}>{renderVal(gt.qDoop)}</td>
                <td style={TD}>{renderVal(gt.qDoopBuf)}</td>
                <td style={{ ...TD, background: 'rgba(16,185,129,0.12)' }}>{renderVal(gt.qSgp, 'sgp')}</td>
                <td style={{ ...TD, background: 'rgba(16,185,129,0.12)' }}>{renderVal(gt.qBz, 'bz')}</td>
                <td style={{ ...TD, background: 'rgba(239,68,68,0.12)', borderRight: 'none' }}>{renderVal(gt.qScrap, 'scrap')}</td>
              </tr>
            )
          })()}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      {/* Mobile-only toggle full screen button */}
      <div className="mobile-fullscreen-btn-container" style={{ display: 'none', marginBottom: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setIsFull(true)}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>🖥️</span> На весь екран
        </button>
      </div>

      {renderTable(maxHeight)}

      {/* Full screen modal */}
      {isFull && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#09090b', zIndex: 99999, padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: '#ff9000' }}>WIP Таблиця (Повноекранний аналіз)</span>
            <button
              onClick={() => setIsFull(false)}
              style={{ background: '#27272a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Закрити ✕
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {renderTable('100%')}
          </div>
        </div>
      )}
    </div>
  )
}

// Table cell style constants
const TH = { padding: '11px 10px', fontWeight: 600, borderRight: '1px solid #27272a', position: 'sticky', top: 0, background: '#18181b', zIndex: 10, whiteSpace: 'nowrap', fontSize: '0.72rem' }
const TH_STICKY = { ...TH, textAlign: 'left', color: '#f4f4f5', position: 'sticky', top: 0, left: 0, zIndex: 40, minWidth: '200px', maxWidth: '200px', width: '200px' }
const TH_SUM = { ...TH, background: '#251b14', color: '#ff9000', position: 'sticky', top: 0, left: '200px', zIndex: 40, minWidth: '110px', maxWidth: '110px', width: '110px' }
const TD = { padding: '10px 10px', textAlign: 'center', borderRight: '1px solid #1f1f22' }
const TD_STICKY = { ...TD, textAlign: 'left', fontWeight: 'bold', color: '#f4f4f5', borderRight: '1px solid #27272a', position: 'sticky', left: 0, background: '#09090b', zIndex: 2, minWidth: '200px', maxWidth: '200px', width: '200px' }
const TD_SUM = { ...TD, background: '#1c130d', borderRight: '1px solid #27272a', fontWeight: 'bold', position: 'sticky', left: '200px', zIndex: 2, minWidth: '110px', maxWidth: '110px', width: '110px' }

// ─────────────────────────────────────────────────────────────
// Main Module
// ─────────────────────────────────────────────────────────────

const ForemanDashboardModule = () => {
  const {
    currentUser, workCards, inventory, nomenclatures, fetchData,
    orders, bomItems, tasks, workCardHistory, workCardScrapTotals = [], fetchModuleData
  } = useMES()

  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedBottlenecks, setExpandedBottlenecks] = useState({})

  // Extra state for per-order drill-down
  const [orderAllCards, setOrderAllCards] = useState({}) // taskId -> cards[]
  const [loadingCards, setLoadingCards] = useState({})

  // ── Load data on mount ──
  useEffect(() => {
    fetchModuleData('foreman')
    if (typeof fetchData === 'function') {
      // Don't fetch work_cards/work_card_history globally — they are loaded
      // per-task via loadAllTasksCards to avoid pulling the entire table
      fetchData(['orders', 'tasks', 'inventory', 'nomenclatures', 'bom_items'])
    }
  }, [])

  // ── relevantTasks — same filter as ForemanWorkplace ──
  const relevantTasks = useMemo(() => {
    return tasks.filter(t => {
      const stepName = (t.step || '').toLowerCase()
      const isLaser = stepName.includes('розкрій') || stepName.includes('різка')
      
      const hasActiveShop2Task = tasks.some(s2 =>
        String(s2.order_id) === String(t.order_id) &&
        s2.batch_index === t.batch_index &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
        s2.status !== 'completed'
      )

      if (t.status !== 'completed' || hasActiveShop2Task) {
        return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
      }
      // Show recently completed (last 3 days)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) ||
        (t.updated_at && new Date(t.updated_at) > threeDaysAgo)
      return isRecent && (isLaser || !t.step)
    }).sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [tasks])

  // ── Active (non-completed) tasks ──
  const activeTasks = useMemo(() => {
    return relevantTasks.filter(t => {
      if (t.status !== 'completed') return true
      const hasActiveShop2Task = tasks.some(s2 =>
        String(s2.order_id) === String(t.order_id) &&
        s2.batch_index === t.batch_index &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
        s2.status !== 'completed'
      )
      return hasActiveShop2Task
    })
  }, [relevantTasks, tasks])

  // ── Orders map ──
  const ordersMap = useMemo(() => {
    const m = {}
    orders.forEach(o => { m[o.id] = o })
    return m
  }, [orders])

  // Extra state for per-order drill-down and overall WIP
  const [allTasksCards, setAllTasksCards] = useState([])
  const [allCardsHistory, setAllCardsHistory] = useState([])
  const [loadingAllData, setLoadingAllData] = useState(false)
  const dashboardCards = useMemo(() => {
    return Array.from(new Map([...(workCards || []), ...(allTasksCards || [])].filter(Boolean).map(card => [String(card.id), card])).values())
  }, [workCards, allTasksCards])
  const totalsHistoryRows = useMemo(() => {
    return (workCardScrapTotals || [])
      .filter(row => (Number(row.total_scrap) || 0) > 0)
      .map(row => ({
        id: `scrap-total-${row.id || `${row.card_id}-${row.nomenclature_id}`}`,
        card_id: row.card_id,
        task_id: row.task_id,
        order_id: row.order_id,
        nomenclature_id: row.nomenclature_id,
        scrap_qty: Number(row.total_scrap) || 0,
        created_at: row.last_scrap_at || row.updated_at,
        completed_at: row.last_scrap_at || row.updated_at,
        is_scrap_total: true
      }))
  }, [workCardScrapTotals])
  const dashboardHistory = useMemo(() => {
    const sourceRows = totalsHistoryRows.length > 0
      ? totalsHistoryRows
      : [...(workCardHistory || []), ...(allCardsHistory || [])]
    return Array.from(new Map(sourceRows.filter(Boolean).map(row => [String(row.id || `${row.card_id}-${row.created_at || row.completed_at || Math.random()}`), row])).values())
  }, [workCardHistory, allCardsHistory, totalsHistoryRows])

  const loadAllTasksCards = async (taskList) => {
    if (!taskList || taskList.length === 0) {
      setAllTasksCards([])
      setAllCardsHistory([])
      return
    }
    try {
      const orderIds = Array.from(new Set(taskList.map(t => t.order_id).filter(Boolean)))
      const allTaskIdsForOrders = tasks
        .filter(t => orderIds.includes(t.order_id))
        .map(t => t.id)
      
      const taskIds = allTaskIdsForOrders.length > 0 ? allTaskIdsForOrders : taskList.map(t => t.id)

      const cards = await fetchWorkCardsByTaskIds(taskIds, 'id, task_id, nomenclature_id, status, quantity, operation, used_in_shop2_qty, card_info, created_at')

      if (cards) {
        setAllTasksCards(cards)
        const cardIds = cards.map(c => c.id)
        if (totalsHistoryRows.length > 0) {
          setAllCardsHistory(totalsHistoryRows)
        } else if (cardIds.length > 0) {
          const history = await fetchWorkCardHistoryByCardIds(cardIds)
          setAllCardsHistory(history)
        } else {
          setAllCardsHistory([])
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ── Load all cards and history for all relevant tasks ──
  useEffect(() => {
    setLoadingAllData(true)
    loadAllTasksCards(relevantTasks).finally(() => setLoadingAllData(false))
  }, [relevantTasks, totalsHistoryRows.length])

  // ── Load all cards for a specific task (for drill-down) ──
  useEffect(() => {
    if (!selectedTaskId) return
    if (orderAllCards[selectedTaskId]) return // already loaded
    setLoadingCards(prev => ({ ...prev, [selectedTaskId]: true }))
    fetchWorkCardsByTaskIds([selectedTaskId], '*')
      .then(data => {
        setOrderAllCards(prev => ({ ...prev, [selectedTaskId]: data || [] }))
        setLoadingCards(prev => ({ ...prev, [selectedTaskId]: false }))
      })
      .catch(error => {
        console.error(error)
        setLoadingCards(prev => ({ ...prev, [selectedTaskId]: false }))
      })
  }, [selectedTaskId])

  // ── Index cards by task_id for O(1) lookups (instead of O(n) filter everywhere) ──
  const cardsByTaskId = useMemo(() => {
    const map = {}
    dashboardCards.forEach(c => {
      if (!map[c.task_id]) map[c.task_id] = []
      map[c.task_id].push(c)
    })
    return map
  }, [dashboardCards])

  // ── Production cache: task_id -> nom_id -> produced qty ──
  const productionCache = useMemo(() => {
    const cache = {}
    
    relevantTasks.forEach(task => {
      cache[task.id] = {}
      const taskCards = cardsByTaskId[task.id] || []
      const snapshot = task.plan_snapshot || {}
      
      Object.keys(snapshot).forEach(nid => {
        const nomCards = taskCards.filter(c => String(c.nomenclature_id) === nid)
        
        const getQ = (ops, statuses) => {
          return nomCards.filter(c => {
            const isMatchOp = ops.some(op => op === 'Галтовка' ? (c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')) : c.operation === op)
            return isMatchOp && statuses.includes(c.status)
          }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        }

        const qCutWait = getQ(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
        const qCut = getQ(['Розкрій'], ['in-progress', 'paused', 'hold'])
        const qCutBuf = getQ(['Розкрій'], ['at-buffer'])
        const qGalt = getQ(['Галтовка'], ['in-progress'])
        const qGaltBuf = getQ(['Галтовка'], ['at-buffer'])
        const qPriy = getQ(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
        const qSortAct = getQ(['Сортування'], ['in-progress', 'at-buffer'])
        const qSort = nomCards.filter(c => c.status === 'at-shop2-buffer')
          .reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

        const groupProduced = nomCards.filter(c => {
          const op = (c.operation || '').toLowerCase()
          const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
          return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const totalShop2Qty = nomCards.filter(c => {
          const op = (c.operation || '').toLowerCase()
          return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const bzCardsQty = nomCards.filter(c => c.operation === 'Склад БЗ').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        
        const qBz = Math.max(0, groupProduced - qSort - totalShop2Qty) + bzCardsQty

        const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qBz
        
        cache[task.id][nid] = sum
      })
    })
    return cache
  }, [cardsByTaskId, relevantTasks])

  // ── Scrap cache ──
  const scrapCache = useMemo(() => {
    const cache = {}
    const cardMap = {}
    dashboardCards.forEach(c => { cardMap[c.id] = c })
    
    dashboardHistory.forEach(h => {
      if (!h.card_id) return
      const card = cardMap[h.card_id]
      if (!card) return
      const tid = card.task_id
      const nid = String(card.nomenclature_id)
      if (!cache[tid]) cache[tid] = {}
      cache[tid][nid] = (cache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
    })
    return cache
  }, [dashboardHistory, dashboardCards])

  // ── Task status map ──
  const taskStatusMap = useMemo(() => {
    const map = {}
    relevantTasks.forEach(task => {
      const shop2Tasks = tasks.filter(s2 =>
        String(s2.order_id) === String(task.order_id) &&
        s2.batch_index === task.batch_index &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання'))
      )
      // Shop 2 is considered "active" only if it has non-completed cards
      // If all cards are done (or no cards but task not yet closed), check actual card state
      const hasActiveShop2Task = shop2Tasks.some(s2 => {
        if (s2.status === 'completed') return false
        const s2Cards = (cardsByTaskId[s2.id] || []).filter(c => c.operation !== 'Склад БЗ')
        // If no cards in Shop 2 task yet → it's still waiting/active
        if (s2Cards.length === 0) return s2.status === 'waiting' || s2.status === 'in-progress'
        // If all Shop 2 cards are completed → treat as done
        return s2Cards.some(c => c.status !== 'completed')
      })

      if (task.status === 'completed' && !hasActiveShop2Task) { map[task.id] = 'completed'; return }
      const taskCards = (cardsByTaskId[task.id] || []).filter(c => c.operation !== 'Склад БЗ')
      if (taskCards.length === 0 && task.status !== 'completed') { map[task.id] = 'new'; return }

      const snapshot = task.plan_snapshot || {}
      const taskProd = productionCache[task.id] || {}
      const taskScrap = scrapCache[task.id] || {}

      let allDone = true
      let hasShortage = false

      Object.keys(snapshot).forEach(nomIdStr => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(nomIdStr)) return
        const snap = snapshot[nomIdStr]
        if (!snap || snap.need === 0) return
        const produced = taskProd[nomIdStr] || 0
        if (produced < snap.need) allDone = false

        // Shortage check — only flag if actual production is still below need
        // If produced >= need, never show shortage regardless of scrap math
        const need = snap.need || 0
        const stock = snap.stock || 0
        const sheets = snap.sheets || 0
        const units = snap.units_per_sheet || 1
        const scrap = taskScrap[nomIdStr] || 0
        const totalBZ = (sheets * units) + stock - need
        if (produced < need && (totalBZ - scrap) < 0) hasShortage = true
      })

      // Cards still actively being processed in Shop 1 pipeline (not yet sorted/transferred)
      const hasActivePipelineCards = taskCards.some(c =>
        c.operation !== 'Склад БЗ' &&
        c.status !== 'completed' &&
        c.status !== 'at-shop2-buffer'
      )
      // Cards in Shop 2 buffer — only relevant if we haven't yet produced enough
      const hasBufferCards = taskCards.some(c => c.status === 'at-shop2-buffer')

      // Ready: all produced AND no cards still in Shop 1 pipeline
      // at-shop2-buffer cards are OK to ignore when allDone=true because their output is already in SGP
      const hasActiveCards = hasActivePipelineCards || (hasBufferCards && !allDone)

      // Ready: all produced AND no cards in pipeline AND no active Shop 2 work
      // hasActiveShop2Task is smart: true only when Shop2 has non-completed cards OR has no cards but is still in-progress/waiting
      if (allDone && !hasActiveCards && !hasActiveShop2Task) map[task.id] = 'ready'
      else if (hasShortage) map[task.id] = 'shortage'
      else if (hasActiveShop2Task || hasActiveCards) map[task.id] = 'in_progress'
      else map[task.id] = 'in_progress'
    })
    return map
  }, [relevantTasks, cardsByTaskId, productionCache, scrapCache, tasks])

  // ── Per-task progress (actual / demand sets) ──
  const taskProgressMap = useMemo(() => {
    const map = {}
    relevantTasks.forEach(task => {
      const order = ordersMap[task.order_id]
      const planned = Number(task.planned_sets) || Number(order?.quantity) || 0
      const taskProd = productionCache[task.id] || {}
      const snapshot = task.plan_snapshot || {}

      // Min sets approach: find bottleneck part
      let minSets = Infinity
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const snapKeys = Object.keys(snapshot).filter(k => uuidRegex.test(k))

      if (snapKeys.length > 0) {
        snapKeys.forEach(nomIdStr => {
          const snap = snapshot[nomIdStr]
          if (!snap || !snap.need) return
          const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
          if (nom?.type !== 'part') return
          const qtyPer = planned > 0 ? Math.round(snap.need / planned) : 1
          if (qtyPer <= 0) return
          const produced = taskProd[nomIdStr] || 0
          const sets = Math.floor(produced / qtyPer)
          if (sets < minSets) minSets = sets
        })
      }

      map[task.id] = {
        actual: minSets === Infinity ? 0 : minSets,
        demand: planned
      }
    })
    return map
  }, [relevantTasks, productionCache, nomenclatures, ordersMap])

  // ── Build WIP rows for a given set of tasks (overview or single) ──
  const buildWipGroups = (filterTaskIds) => {
    if (!nomenclatures || !bomItems || !orders) return []

    // For the given task IDs, find all tasks that belong to the same orders
    const selectedTasks = tasks.filter(t => filterTaskIds.includes(t.id))
    const orderIds = Array.from(new Set(selectedTasks.map(t => t.order_id).filter(Boolean)))
    const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))
    const allTaskIdsForOrders = allTasksForOrders.map(t => t.id)

    const filterSet = new Set(allTaskIdsForOrders)
    const filteredCards = dashboardCards.filter(c => c.task_id && filterSet.has(c.task_id))

    // Build parent->children map from snapshots or static BOM
    const parentToChildren = {}
    const childToParents = {}
    const taskParentMap = {}

    allTaskIdsForOrders.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      const order = ordersMap[task.order_id]
      if (!order) return

      let parentId = order.nomenclature_id
      if (!parentId && order.order_items?.length > 0) parentId = order.order_items[0].nomenclature_id
      if (!parentId) return
      parentId = String(parentId)
      taskParentMap[taskId] = parentId

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const taskWithSnap = task.plan_snapshot && Object.keys(task.plan_snapshot).some(k => uuidRegex.test(k)) ? task : null

      if (!parentToChildren[parentId]) parentToChildren[parentId] = {}
      if (taskWithSnap) {
        const plannedSets = Number(task.planned_sets) || 1
        Object.entries(task.plan_snapshot).forEach(([childId, entry]) => {
          if (!uuidRegex.test(childId)) return
          const need = Number(entry.need) || 0
          const qtyPer = plannedSets > 0 ? Math.round(need / plannedSets) : need
          parentToChildren[parentId][childId] = qtyPer
          if (!childToParents[childId]) childToParents[childId] = new Set()
          childToParents[childId].add(parentId)
        })
      } else {
        bomItems.filter(b => String(b.parent_id) === parentId).forEach(b => {
          const childId = String(b.child_id)
          parentToChildren[parentId][childId] = Number(b.quantity_per_parent) || 1
          if (!childToParents[childId]) childToParents[childId] = new Set()
          childToParents[childId].add(parentId)
        })
      }
    })

    // Build groups
    const groups = {}
    const productNoms = nomenclatures.filter(n => n.type === 'product')
    productNoms.forEach(prod => {
      if (parentToChildren[String(prod.id)]) {
        groups[prod.id] = { id: prod.id, name: prod.name, code: prod.code || '', rows: [], trend: null }
      }
    })

    const parts = nomenclatures.filter(n => n.type === 'part')

    parts.forEach(nom => {
      const parentIds = childToParents[nom.id] ? Array.from(childToParents[nom.id]) : []
      if (parentIds.length === 0) return

      parentIds.forEach(parentId => {
        if (!groups[parentId]) return

        const qtyPerProduct = parentToChildren[parentId]?.[nom.id] || 1

        // Demand: sum across orders for this parent
        const demandForParent = (() => {
          let d = 0
          filterTaskIds.forEach(taskId => {
            if (taskParentMap[taskId] !== parentId) return
            const task = tasks.find(t => t.id === taskId)
            d += Number(task?.planned_sets) || 0
          })
          return d * qtyPerProduct
        })()

        const getQ = (ops, statuses) => {
          const opArr = Array.isArray(ops) ? ops : [ops]
          const stArr = Array.isArray(statuses) ? statuses : [statuses]
          return filteredCards.filter(c => {
            if (String(c.nomenclature_id) !== String(nom.id)) return false
            if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
            const isMatchOp = opArr.some(op => op === 'Галтовка' ? (c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')) : c.operation === op)
            return isMatchOp && stArr.includes(c.status)
          }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        }

        const qCutWait = getQ(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
        const qCut = getQ(['Розкрій'], ['in-progress', 'paused', 'hold'])
        const qCutBuf = getQ(['Розкрій'], ['at-buffer'])
        const qGalt = getQ(['Галтовка'], ['in-progress'])
        const qGaltBuf = getQ(['Галтовка'], ['at-buffer'])
        const qPriy = getQ(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
        const qSortAct = getQ(['Сортування'], ['in-progress', 'at-buffer'])
        const qSort = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          return c.status === 'at-shop2-buffer'
        }).reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

        const qMalWait = getQ(['Фарбування', 'Малярка'], ['new'])
        const qMal = getQ(['Фарбування', 'Малярка'], ['in-progress'])
        const qMalBuf = getQ(['Фарбування', 'Малярка'], ['at-buffer'])
        const qPresWait = getQ(['Пресування'], ['new'])
        const qPres = getQ(['Пресування'], ['in-progress'])
        const qPresBuf = getQ(['Пресування'], ['at-buffer'])
        const qDoopWait = getQ(['Доопрацювання'], ['new'])
        const qDoop = getQ(['Доопрацювання'], ['in-progress'])
        const qDoopBuf = getQ(['Доопрацювання'], ['at-buffer'])

        // Find booked BZ from plan snapshot (which is already ready/finished for this order), summing across all relevant orders
        let initialStock = 0
        const orderTasks = tasks.filter(t => t.order_id && orderIds.includes(t.order_id))
        const ordersWithTasks = Array.from(new Set(orderTasks.map(t => t.order_id)))
        ordersWithTasks.forEach(oid => {
          const taskWithSnap = orderTasks.find(t => t.order_id === oid && t.plan_snapshot && t.plan_snapshot[String(nom.id)])
          if (taskWithSnap) {
            initialStock += Number(taskWithSnap.plan_snapshot[String(nom.id)].stock) || 0
          }
        })

        // Shop 2 completed cards + booked BZ go to SGP (capped at demand)
        const completedShop2Qty = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          const op = (c.operation || '').toLowerCase()
          const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
          return isShop2 && c.status === 'completed'
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const totalPotentialSgp = completedShop2Qty + initialStock
        const qSgp = Math.min(demandForParent, totalPotentialSgp)

        // Shop 1 completed or at-shop2-buffer cards count as total produced by Shop 1
        const groupProduced = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          const op = (c.operation || '').toLowerCase()
          const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
          return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        // All Shop 2 cards for this task
        const totalShop2Qty = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          const op = (c.operation || '').toLowerCase()
          return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        // qBz is newly produced BZ (not yet in Shop 2) + excess SGP
        const bzExcess = Math.max(0, totalPotentialSgp - demandForParent)
        const qBz = Math.max(0, groupProduced - qSort - totalShop2Qty) + bzExcess

        // Scrap from task card history
        const cardIdsForThisPart = new Set(filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          return true
        }).map(c => c.id))
        const qScrap = dashboardHistory.filter(h => h.card_id && cardIdsForThisPart.has(h.card_id)).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)

        const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf + qSgp + qBz

        const matchSearch = !searchQuery ||
          nom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (nom.code || '').toLowerCase().includes(searchQuery.toLowerCase())

        if (matchSearch && demandForParent > 0) {
          groups[parentId].rows.push({
            id: nom.id + '_' + parentId,
            name: nom.name,
            code: nom.code || '',
            demand: demandForParent,
            qtyPerProduct,
            qCutWait, qCut, qCutBuf, qGalt, qGaltBuf, qPriy,
            qSortAct, qSort, qMalWait, qMal, qMalBuf, qPresWait, qPres,
            qPresBuf, qDoopWait, qDoop, qDoopBuf, qSgp, qBz, qScrap, sum
          })
        }
      })
    })

    return Object.values(groups).filter(g => g.rows.length > 0)
  }

  // ── Overview WIP groups (all active tasks) ──
  const overviewGroups = useMemo(() => {
    if (!selectedTaskId) {
      return buildWipGroups(activeTasks.map(t => t.id))
    }
    return buildWipGroups([selectedTaskId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, dashboardCards, dashboardHistory, inventory, nomenclatures, bomItems, tasks, orders, searchQuery])

  // ── Refresh ──
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchData(['orders', 'tasks', 'inventory', 'nomenclatures', 'bom_items'])
      await loadAllTasksCards(relevantTasks)
      // Clear per-order card cache
      setOrderAllCards({})
    } catch (e) {
      console.error(e)
    } finally {
      setIsRefreshing(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────

  const selectedTask = selectedTaskId ? relevantTasks.find(t => t.id === selectedTaskId) : null
  const selectedOrder = selectedTask ? ordersMap[selectedTask.order_id] : null

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#f4f4f5', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── NAV ── */}
      <nav style={{ flexShrink: 0, padding: '0 24px', height: '68px', background: '#09090b', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#71717a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#71717a'}>
            <ArrowLeft size={16} /> На головну
          </Link>
          <div style={{ width: '1px', height: '24px', background: '#27272a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={18} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.1 }}>
                Дашборд Нарядів
              </div>
              <div style={{ fontSize: '0.62rem', color: '#71717a', fontWeight: 600, letterSpacing: '0.05em' }}>
                FOREMAN · ВИРОБНИЦТВО ЦЕХ №1
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{ background: '#18181b', border: '1px solid #27272a', color: '#fff', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#1c1010' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.background = '#18181b' }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            Оновити
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentUser?.position}</div>
          </div>
        </div>
      </nav>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', padding: '14px 24px', background: '#09090b', borderBottom: '1px solid #27272a', scrollbarWidth: 'none' }}>
        {/* Overview tab */}
        <button
          onClick={() => setSelectedTaskId(null)}
          style={{
            background: selectedTaskId === null ? 'rgba(239,68,68,0.12)' : '#18181b',
            color: selectedTaskId === null ? '#ef4444' : '#71717a',
            border: `1px solid ${selectedTaskId === null ? 'rgba(239,68,68,0.4)' : '#27272a'}`,
            padding: '8px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '7px'
          }}
        >
          <LayoutDashboard size={14} />
          ЗАГАЛЬНА ТАБЛИЦЯ
          <span style={{
            background: selectedTaskId === null ? '#ef4444' : '#27272a',
            color: '#fff', borderRadius: '6px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 900
          }}>
            {activeTasks.length}
          </span>
        </button>

        {/* Per-task tabs */}
        {(() => {
          const sortedTasks = [...relevantTasks].sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1
            if (a.status !== 'completed' && b.status === 'completed') return -1

            const aShortage = taskStatusMap[a.id] === 'shortage'
            const bShortage = taskStatusMap[b.id] === 'shortage'
            if (aShortage && !bShortage) return -1
            if (!aShortage && bShortage) return 1

            return new Date(b.created_at) - new Date(a.created_at)
          })
          return sortedTasks.map(task => {
            const order = ordersMap[task.order_id]
          const displayNum = order?.order_num || task.id.split('-')[0]
          const batchSuffix = task.batch_index ? `/${task.batch_index}` : ''
          const status = taskStatusMap[task.id]
          const isActive = selectedTaskId === task.id

          const tabColor = status === 'ready' ? '#10b981'
            : status === 'shortage' ? '#ef4444'
              : status === 'new' ? '#3b82f6'
                : status === 'completed' ? '#52525b'
                  : '#eab308'

          const statusDot = status === 'ready' ? '🟢'
            : status === 'shortage' ? '🔴'
              : status === 'new' ? '🔵'
                : status === 'completed' ? '⚪'
                  : '🟡'

          return (
            <button
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              style={{
                background: isActive ? `${tabColor}18` : '#18181b',
                color: isActive ? tabColor : '#71717a',
                border: `1px solid ${isActive ? tabColor + '60' : '#27272a'}`,
                padding: '8px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{statusDot}</span>
              №{displayNum}{batchSuffix}
              {status === 'completed' && <span style={{ fontSize: '0.62rem', opacity: 0.6 }}>✓</span>}
            </button>
          )
        })
      })()}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {selectedTask === null ? (
          /* ═══════════════════ OVERVIEW MODE ═══════════════════ */
          <div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Всього нарядів', value: activeTasks.length, color: '#ff9000', icon: '📋' },
                { label: 'Готові до закриття', value: activeTasks.filter(t => taskStatusMap[t.id] === 'ready').length, color: '#10b981', icon: '✅' },
                { label: 'В роботі', value: activeTasks.filter(t => taskStatusMap[t.id] === 'in_progress').length, color: '#eab308', icon: '⚙️' },
                { label: 'Потреба в довипуску', value: activeTasks.filter(t => taskStatusMap[t.id] === 'shortage').length, color: '#ef4444', icon: '⚠️' },
                { label: 'Нові (без карток)', value: activeTasks.filter(t => taskStatusMap[t.id] === 'new').length, color: '#3b82f6', icon: '🆕' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px 18px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{stat.icon}</div>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 950, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                    <div style={{ fontSize: '0.66rem', color: '#52525b', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order cards grid */}
            {activeTasks.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={14} color="#ef4444" />
                  ОГЛЯД НАРЯДІВ
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                  {(() => {
                    const sortedActiveTasks = [...activeTasks].sort((a, b) => {
                      const aShortage = taskStatusMap[a.id] === 'shortage'
                      const bShortage = taskStatusMap[b.id] === 'shortage'
                      if (aShortage && !bShortage) return -1
                      if (!aShortage && bShortage) return 1
                      return new Date(b.created_at) - new Date(a.created_at)
                    })
                    return sortedActiveTasks.map(task => {
                      const order = ordersMap[task.order_id]
                    const displayNum = order?.order_num || task.id.split('-')[0]
                    const batchSuffix = task.batch_index ? `/${task.batch_index}` : ''
                    const status = taskStatusMap[task.id]
                    const progress = taskProgressMap[task.id] || { actual: 0, demand: 0 }
                    const pct = progress.demand > 0 ? Math.min(100, Math.round((progress.actual / progress.demand) * 100)) : 0
                    const prodNames = (order?.order_items || []).map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'

                    const accentColor = status === 'ready' ? '#10b981'
                      : status === 'shortage' ? '#ef4444'
                        : status === 'new' ? '#3b82f6' : '#eab308'

                    const statusBadge = status === 'ready'
                      ? <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>🟢 ГОТОВО</span>
                      : status === 'shortage'
                        ? <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>🔴 НЕСТАЧА</span>
                        : status === 'new'
                          ? <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>🔵 НОВИЙ</span>
                          : <span style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>🟡 В РОБОТІ</span>

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        style={{
                          background: 'linear-gradient(145deg, #141417, #111113)',
                          border: `1px solid ${accentColor}30`,
                          borderRadius: '18px', cursor: 'pointer', overflow: 'hidden',
                          transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}50` }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)' }}
                      >
                        <div style={{ height: '3px', background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
                        <div style={{ padding: '16px 18px' }}>
                          {/* Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff', lineHeight: 1.2 }}>
                                Наряд №{displayNum}{batchSuffix}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px', fontWeight: 600 }}>{order?.customer || '—'}</div>
                            </div>
                            {statusBadge}
                          </div>
                          {/* Product */}
                          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '12px', fontWeight: 600, lineHeight: 1.3 }}>{prodNames}</div>
                          {/* Progress */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, marginBottom: '4px' }}>
                              <span style={{ color: '#52525b' }}>Виконання</span>
                              <span style={{ color: accentColor }}>{progress.actual} / {progress.demand} компл. ({pct}%)</span>
                            </div>
                            <div style={{ height: '6px', background: '#1f1f23', borderRadius: '6px', overflow: 'hidden', border: '1px solid #27272a' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`, borderRadius: '6px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${accentColor}60` }} />
                            </div>
                          </div>
                          {/* Click hint */}
                          <div style={{ fontSize: '0.64rem', color: '#3f3f46', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Клікніть для деталей →
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
                </div>
              </div>
            )}

            {/* Search */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
                <input
                  type="text"
                  placeholder="Пошук деталі..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', color: '#fff', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = '#27272a'}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ЗАГАЛЬНА ТАБЛИЦЯ WIP — ВСІ НАРЯДИ
              </div>
            </div>

            {/* Overview WIP table */}
            <WipTable groupedData={overviewGroups} emptyText="Немає активних деталей. Запустіть наряди в Foreman." />
          </div>
        ) : (
          /* ═══════════════════ ORDER DETAIL MODE ═══════════════════ */
          <OrderDetailView
            task={selectedTask}
            order={selectedOrder}
            ordersMap={ordersMap}
            tasks={tasks}
            workCards={workCards}
            allTasksCards={dashboardCards}
            cardsByTaskId={cardsByTaskId}
            allCardsHistory={dashboardHistory}
            nomenclatures={nomenclatures}
            bomItems={bomItems}
            inventory={inventory}
            productionCache={productionCache}
            scrapCache={scrapCache}
            taskStatusMap={taskStatusMap}
            taskProgressMap={taskProgressMap}
            orderAllCards={orderAllCards[selectedTaskId] || []}
            isLoadingCards={loadingCards[selectedTaskId] || false}
            wipGroups={overviewGroups}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            expandedBottlenecks={expandedBottlenecks}
            setExpandedBottlenecks={setExpandedBottlenecks}
          />
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0d; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

        /* Mobile specific overrides */
        @media (max-width: 768px) {
          .mobile-fullscreen-btn-container {
            display: flex !important;
          }
          nav {
            padding: 0 12px !important;
            height: auto !important;
            min-height: 60px;
            flex-direction: column;
            gap: 10px;
            align-items: stretch !important;
            justify-content: center;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
          nav > div {
            justify-content: space-between;
            width: 100%;
          }
          nav button {
            padding: 6px 10px !important;
            font-size: 0.75rem !important;
          }
          /* Hide user name on small devices to free up screen real estate */
          nav > div:last-child > div:last-child {
            display: none !important;
          }
          
          /* Make stats and cards grid layout fit mobile viewports */
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
          
          /* Scale down padding and text sizes of order preview cards */
          div[style*="borderRadius: '18px'"] {
            border-radius: 12px !important;
          }
          div[style*="padding: '16px 18px'"] {
            padding: 10px 12px !important;
          }
          div[style*="fontSize: '1.1rem'"] {
            font-size: 0.95rem !important;
          }
          div[style*="fontSize: '0.8rem'"] {
            font-size: 0.72rem !important;
          }
          
          /* Compact tabs navigation bar */
          div[style*="padding: '14px 24px'"] {
            padding: 8px 12px !important;
            gap: 4px !important;
          }
          div[style*="padding: '14px 24px'"] button {
            padding: 6px 12px !important;
            font-size: 0.72rem !important;
          }
          
          /* General page container padding */
          div[style*="padding: '24px'"] {
            padding: 12px !important;
          }

          /* Compact table styles for mobile screens */
          table {
            font-size: 0.62rem !important;
            min-width: 700px !important;
          }
          th, td {
            padding: 5px 6px !important;
          }
          /* Override sticky Nomenclature column on mobile */
          .wip-col-nomenclature {
            position: sticky !important;
            left: 0 !important;
            min-width: 110px !important;
            max-width: 110px !important;
            width: 110px !important;
            font-size: 0.6rem !important;
            z-index: 2 !important;
          }
          th.wip-col-nomenclature {
            z-index: 40 !important;
          }

          /* Override sticky Sum column on mobile */
          .wip-col-sum {
            position: sticky !important;
            left: 110px !important;
            min-width: 70px !important;
            max-width: 70px !important;
            width: 70px !important;
            z-index: 2 !important;
          }
          th.wip-col-sum {
            z-index: 40 !important;
          }

          /* Compact orange sum badge sizing to fit the sum column bounds on mobile */
          .wip-sum-badge {
            font-size: 0.5rem !important;
            padding: 1px 3px !important;
            letter-spacing: -0.2px !important;
          }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Order Detail View component
// ─────────────────────────────────────────────────────────────
const OrderDetailView = ({
  task, order, tasks, workCards, allTasksCards, cardsByTaskId, allCardsHistory, nomenclatures, bomItems, inventory,
  productionCache, scrapCache, taskStatusMap, taskProgressMap,
  orderAllCards, isLoadingCards, wipGroups, searchQuery, setSearchQuery
}) => {
  if (!task || !order) return <div style={{ padding: '20px', color: '#52525b' }}>Наряд не знайдено...</div>

  const status = taskStatusMap[task.id]
  const progress = taskProgressMap[task.id] || { actual: 0, demand: 0 }
  const pct = progress.demand > 0 ? Math.min(100, Math.round((progress.actual / progress.demand) * 100)) : 0

  const [taskHistory, setTaskHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedCardsState, setExpandedCardsState] = useState({})

  useEffect(() => {
    if (!task?.id || !orderAllCards || orderAllCards.length === 0) {
      setTaskHistory([])
      return
    }
    setLoadingHistory(true)
    const cardIds = orderAllCards.map(c => c.id)
    let cancelled = false
    fetchWorkCardHistoryByCardIds(cardIds)
      .then(data => {
        if (!cancelled) {
          setTaskHistory(data.sort((a, b) => new Date(a.completed_at || a.created_at || 0) - new Date(b.completed_at || b.created_at || 0)))
        }
      })
      .catch(error => console.warn('Error loading task history:', error?.message || error))
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => { cancelled = true }
  }, [task?.id, orderAllCards])

  const accentColor = status === 'ready' ? '#10b981'
    : status === 'shortage' ? '#ef4444'
      : status === 'new' ? '#3b82f6'
        : status === 'completed' ? '#10b981'
          : '#eab308'

  const displayNum = order.order_num || task.id.split('-')[0]
  const batchSuffix = task.batch_index ? `/${task.batch_index}` : ''

  const prodNames = (order?.order_items || [])
    .map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
    .filter(Boolean).join(', ') || '—'

  const dateStr = task.created_at
    ? new Date(task.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  // Build bottlenecks list from snapshot
  const bottlenecks = useMemo(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const snapshot = task.plan_snapshot || {}
    const taskProd = productionCache[task.id] || {}
    const list = []

    Object.keys(snapshot).filter(k => uuidRegex.test(k)).forEach(nomIdStr => {
      const snap = snapshot[nomIdStr]
      if (!snap || !snap.need) return
      const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
      if (nom?.type !== 'part') return

      const need = snap.need || 0
      const produced = taskProd[nomIdStr] || 0
      const shortage = Math.max(0, need - produced)
      const qtyPer = progress.demand > 0 ? Math.round(need / progress.demand) : 1
      const potential = qtyPer > 0 ? Math.floor(produced / qtyPer) : 0

      if (shortage > 0) {
        list.push({ name: nom.name, code: nom.code, potential, qty: produced, needed: need, shortage, qtyPer })
      }
    })
    list.sort((a, b) => a.potential - b.potential)
    return list
  }, [task, productionCache, nomenclatures, progress.demand])

  // Per-part detail table from workCards
  const partDetails = useMemo(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const snapshot = task.plan_snapshot || {}
    
    // Get all task IDs for the same order
    const orderTasks = tasks.filter(t => t.order_id === task.order_id)
    const orderTaskIdSet = new Set(orderTasks.map(t => t.id))
    const allTaskCards = orderTasks.flatMap(t => cardsByTaskId[t.id] || [])

    const parts = []
    Object.keys(snapshot).filter(k => uuidRegex.test(k)).forEach(nomIdStr => {
      const snap = snapshot[nomIdStr]
      if (!snap) return
      const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
      if (!nom || nom.type !== 'part') return

      const nomCards = allTaskCards.filter(c => String(c.nomenclature_id) === nomIdStr)

      const getQFromCards = (ops, statuses) => {
        const opArr = Array.isArray(ops) ? ops : [ops]
        const stArr = Array.isArray(statuses) ? statuses : [statuses]
        return nomCards.filter(c => {
          const isMatchOp = opArr.some(op => op === 'Галтовка' ? (c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')) : c.operation === op)
          return isMatchOp && stArr.includes(c.status)
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
      }

      const qCutWait = getQFromCards(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
      const qCut = getQFromCards(['Розкрій'], ['in-progress', 'paused', 'hold'])
      const qCutBuf = getQFromCards(['Розкрій'], ['at-buffer'])
      const qGalt = getQFromCards(['Галтовка'], ['in-progress'])
      const qGaltBuf = getQFromCards(['Галтовка'], ['at-buffer'])
      const qPriy = getQFromCards(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
      const qSortAct = getQFromCards(['Сортування'], ['in-progress', 'at-buffer'])
      const qSort = nomCards.filter(c => c.status === 'at-shop2-buffer')
        .reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
      const qMalWait = getQFromCards(['Фарбування', 'Малярка'], ['new'])
      const qMal = getQFromCards(['Фарбування', 'Малярка'], ['in-progress'])
      const qMalBuf = getQFromCards(['Фарбування', 'Малярка'], ['at-buffer'])
      const qPresWait = getQFromCards(['Пресування'], ['new'])
      const qPres = getQFromCards(['Пресування'], ['in-progress'])
      const qPresBuf = getQFromCards(['Пресування'], ['at-buffer'])
      const qDoopWait = getQFromCards(['Доопрацювання'], ['new'])
      const qDoop = getQFromCards(['Доопрацювання'], ['in-progress'])
      const qDoopBuf = getQFromCards(['Доопрацювання'], ['at-buffer'])

      const groupProduced = nomCards.filter(c => {
        const op = (c.operation || '').toLowerCase()
        const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
        return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const totalShop2Qty = nomCards.filter(c => {
        const op = (c.operation || '').toLowerCase()
        return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const completedShop2Qty = nomCards.filter(c => {
        const op = (c.operation || '').toLowerCase()
        const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        return isShop2 && c.status === 'completed'
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const initialStock = Number(snap.stock) || 0
      const totalPotentialSgp = completedShop2Qty + initialStock
      const qSgp = Math.min(snap.need || 0, totalPotentialSgp)

      // qBz is newly produced BZ + excess SGP
      const bzExcess = Math.max(0, totalPotentialSgp - (snap.need || 0))
      const qBz = Math.max(0, groupProduced - qSort - totalShop2Qty) + bzExcess

      const cardIdsForThisPart = new Set(nomCards.map(c => c.id))
      const scrap = allCardsHistory.filter(h => h.card_id && cardIdsForThisPart.has(h.card_id)).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)

      const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf + qBz + qSgp

      const matchSearch = !searchQuery ||
        nom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (nom.code || '').toLowerCase().includes(searchQuery.toLowerCase())

      if (matchSearch) {
        parts.push({
          id: nomIdStr, name: nom.name, code: nom.code || '',
          demand: snap.need || 0,
          qCutWait, qCut, qCutBuf, qGalt, qGaltBuf, qPriy,
          qSortAct, qSort, qMalWait, qMal, qMalBuf, qPresWait, qPres,
          qPresBuf, qDoopWait, qDoop, qDoopBuf, qBz, qSgp, qScrap: scrap, sum
        })
      }
    })
    return parts
  }, [task, orderAllCards, nomenclatures, allCardsHistory, searchQuery])

  const detailGroup = partDetails.length > 0
    ? [{ id: 'detail', name: prodNames, code: '', rows: partDetails, trend: { potential: progress.actual, actual: progress.actual, demand: progress.demand } }]
    : []

  return (
    <div>
      {/* Header card */}
      <div style={{ background: 'linear-gradient(145deg, #141417, #111113)', border: `1px solid ${accentColor}30`, borderRadius: '20px', overflow: 'hidden', marginBottom: '24px', boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}15` }}>
        <div style={{ height: '4px', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}40)` }} />
        <div style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              {/* Status badge */}
              <div style={{ marginBottom: '8px' }}>
                {status === 'ready' && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>✅ ГОТОВО ДО ЗАКРИТТЯ</span>}
                {status === 'shortage' && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>⚠️ ПОТРІБЕН ДОВИПУСК</span>}
                {status === 'new' && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>🆕 НОВИЙ (картки не створено)</span>}
                {status === 'in_progress' && <span style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>⚙️ В РОБОТІ</span>}
                {status === 'completed' && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>✓ НАРЯД ВИКОНАНО</span>}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#fff', lineHeight: 1.1 }}>
                Наряд №{displayNum}{batchSuffix}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#71717a', marginTop: '4px', fontWeight: 600 }}>
                <span style={{ color: '#a1a1aa' }}>ВИРІБ:</span> <span style={{ color: accentColor }}>{prodNames}</span>
                <span style={{ margin: '0 10px', color: '#27272a' }}>|</span>
                <span>{order.customer || '—'}</span>
                <span style={{ margin: '0 10px', color: '#27272a' }}>|</span>
                <span style={{ color: '#52525b' }}>від {dateStr}</span>
                {task.batch_index && (
                  <span style={{ marginLeft: '10px', background: '#eab308', color: '#000', padding: '1px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 900 }}>ПАРТІЯ #{task.batch_index}</span>
                )}
              </div>
            </div>
            {/* Progress stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '12px', textAlign: 'center' }}>
              {[
                { label: 'На СГП', value: progress.actual, color: '#10b981' },
                { label: 'Потреба', value: progress.demand, color: '#a1a1aa' },
                { label: 'Виконано', value: `${pct}%`, color: accentColor },
              ].map(s => (
                <div key={s.label} style={{ background: '#0f0f12', border: '1px solid #27272a', borderRadius: '12px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 950, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.08em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, marginBottom: '6px' }}>
              <span style={{ color: '#52525b' }}>ВИКОНАННЯ НАРЯДУ</span>
              <span style={{ color: accentColor }}>{pct}%</span>
            </div>
            <div style={{ height: '10px', background: '#0f0f12', borderRadius: '10px', overflow: 'hidden', border: '1px solid #27272a', position: 'relative' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`, borderRadius: '10px', transition: 'width 0.6s ease', boxShadow: `0 0 10px ${accentColor}50` }} />
              {pct > 0 && pct < 100 && (
                <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translateY(-50%)', width: '2px', height: '14px', background: '#fff', opacity: 0.4 }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks panel */}
      {bottlenecks.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '18px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Вузькі місця — нестача деталей ({bottlenecks.length})
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {bottlenecks.map(b => (
              <div key={b.name} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{b.name}{b.code ? ` (${b.code})` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                  <span style={{ color: '#9ca3af' }}>Є: <strong style={{ color: '#fca5a5' }}>{b.qty}</strong> / {b.needed} шт.</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>Дефіцит: -{b.shortage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
          <input
            type="text"
            placeholder="Пошук деталі..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', color: '#fff', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#ef4444'}
            onBlur={e => e.target.style.borderColor = '#27272a'}
          />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          РУХ ДЕТАЛЕЙ ПО ОПЕРАЦІЯХ
        </div>
        {isLoadingCards && (
          <div style={{ fontSize: '0.72rem', color: '#52525b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Завантаження...
          </div>
        )}
      </div>

      {/* Detail WIP table */}
      <WipTable
        groupedData={detailGroup}
        maxHeight="calc(100vh - 420px)"
        emptyText={isLoadingCards ? 'Завантаження деталей наряду...' : 'Немає деталей для відображення. Перевірте план-знімок наряду.'}
      />

      {/* ─── CARD FLOW VISUALIZATION SECTION ─── */}
      <div style={{ marginTop: '35px', background: '#111115', border: '1px solid #27272a', borderRadius: '24px', padding: '25px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ff9000', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span>📊</span> ХРОНОЛОГІЯ ТА СТАТУС РУХУ КАРТ (ПО ВСІХ КАРТКАХ ДЕТАЛІ)
          </h3>
          <div style={{ fontSize: '0.72rem', color: '#71717a', fontWeight: 600 }}>
            Аналітика вузьких місць за часовими інтервалами всього наряду
          </div>
        </div>
        
        {loadingHistory ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Завантаження історії руху карт...
          </div>
        ) : partDetails.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#52525b', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Дані про рух деталей відсутні
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {partDetails.map(part => {
              // 1. Get ALL cards for this nomenclature inside the active task/order
              const partCards = orderAllCards.filter(c => String(c.nomenclature_id) === String(part.id))
              if (partCards.length === 0) return null
              
              const cardIds = partCards.map(c => c.id)
              const cardHistory = taskHistory.filter(h => cardIds.includes(h.card_id))

              // 2. Define stages config with custom bright gradient colors
              const stagesConfig = [
                { key: 'Cutting', label: 'Розкрій', ops: ['Розкрій', 'Різка'], color: '#f97316' },
                { key: 'Tumbling', label: 'Галтовка', ops: ['Галтовка', 'Галтовка (Вібростіл)', 'Галтовка (Мийка)', 'Галтовка (Галтовка)', 'Галтовка (Сушка)'], color: '#06b6d4' },
                { key: 'Acceptance', label: 'Прийомка', ops: ['Прийомка'], color: '#10b981' },
                { key: 'Sorting', label: 'Сортування', ops: ['Сортування'], color: '#8b5cf6' },
                { key: 'Pressing', label: 'Пресування', ops: ['Пресування'], color: '#eab308' },
                { key: 'Painting', label: 'Фарбування', ops: ['Фарбування', 'Малярка'], color: '#ec4899' },
                { key: 'Rework', label: 'Доопрацювання', ops: ['Доопрацювання'], color: '#ef4444' },
                { key: 'Sgp', label: 'СГП/Пак', ops: ['Пакування', 'Пакування/СГП', 'СГП'], color: '#6366f1' }
              ]

              // 3. Sum history durations by stage across ALL cards of this part
              const stageDurations = {}
              stagesConfig.forEach(s => { stageDurations[s.key] = 0 })

              cardHistory.forEach(h => {
                const matchedStage = stagesConfig.find(s => s.ops.some(op => h.stage_name === op || h.stage_name?.startsWith(op)))
                if (matchedStage && h.started_at && h.completed_at) {
                  const diff = new Date(h.completed_at) - new Date(h.started_at)
                  if (diff > 0) {
                    stageDurations[matchedStage.key] += diff
                  }
                }
              })

              // Add currently running active session to the calculations
              partCards.forEach(c => {
                if (c.status === 'in-progress' && c.started_at) {
                  const matchedStage = stagesConfig.find(s => s.ops.some(op => c.operation === op || c.operation?.startsWith(op)))
                  if (matchedStage) {
                    const diff = new Date() - new Date(c.started_at)
                    if (diff > 0) {
                      stageDurations[matchedStage.key] += diff
                    }
                  }
                }
              })

              const totalDurationMs = Object.values(stageDurations).reduce((sum, v) => sum + v, 0)
              
              // Helper to format duration
              const formatMs = (ms) => {
                if (ms <= 0) return '0хв'
                const totalMins = Math.round(ms / 60000)
                const hrs = Math.floor(totalMins / 60)
                const mins = totalMins % 60
                return hrs > 0 ? `${hrs}г ${mins}хв` : `${mins}хв`
              }

              // Determine bottleneck (longest stage)
              let bottleneckStage = null
              let maxMs = 0
              Object.entries(stageDurations).forEach(([key, ms]) => {
                if (ms > maxMs) {
                  maxMs = ms
                  bottleneckStage = stagesConfig.find(s => s.key === key)
                }
              })

              const bottleneckPct = totalDurationMs > 0 ? Math.round((maxMs / totalDurationMs) * 100) : 0

              return (
                <div key={part.id} style={{ background: '#18181c', border: '1px solid #2d2d39', borderRadius: '20px', padding: '20px', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  
                  {/* Part Title and Overall info */}
                  {(() => {
                    const totalQty = partCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                    const activePartCards = partCards.filter(c => c.operation !== 'Склад БЗ' && c.operation !== 'Склад BZ')
                    const avgCardDurationMs = activePartCards.length > 0 ? totalDurationMs / activePartCards.length : 0
                    const activePartCardsQty = activePartCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                    const avgPartDurationMs = activePartCardsQty > 0 ? totalDurationMs / activePartCardsQty : 0

                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <strong style={{ fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.2px' }}>{part.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#71717a', marginLeft: '12px' }}>Код: {part.code || '—'}</span>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.68rem', color: '#a1a1aa' }}>
                            <span>Всього деталей: <strong style={{ color: '#fff' }}>{totalQty} шт</strong></span>
                            <span style={{ color: '#3f3f46' }}>|</span>
                            <span>Сер. час на карту: <strong style={{ color: '#10b981' }}>{formatMs(avgCardDurationMs)}</strong></span>
                            <span style={{ color: '#3f3f46' }}>|</span>
                            <span>Сер. час на 1 шт: <strong style={{ color: '#06b6d4' }}>{formatMs(avgPartDurationMs)}</strong></span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                          <div style={{ textTransform: 'uppercase', fontSize: '0.66rem', color: '#52525b', fontWeight: 800, textAlign: 'right' }}>
                            <div>Загальний час робіт:</div>
                            <strong style={{ color: '#ff9000', fontSize: '0.85rem' }}>{formatMs(totalDurationMs)}</strong>
                          </div>
                          <span style={{ background: 'rgba(255, 144, 0, 0.1)', border: '1px solid rgba(255, 144, 0, 0.2)', color: '#ff9000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>
                            {partCards.length} КАРТ(И)
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── STACKED TIME TIMELINE BAR ── */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ height: '24px', background: '#09090b', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden', display: 'flex', width: '100%', position: 'relative' }}>
                      {totalDurationMs === 0 ? (
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          ⏳ Очікування запуску першої операції
                        </div>
                      ) : (
                        stagesConfig.map(s => {
                          const ms = stageDurations[s.key] || 0
                          if (ms <= 0) return null
                          const pct = (ms / totalDurationMs) * 100
                          return (
                            <div 
                              key={s.key} 
                              style={{ 
                                width: `${pct}%`, 
                                height: '100%', 
                                background: s.color, 
                                transition: 'width 0.4s ease', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                minWidth: pct > 8 ? '50px' : '6px',
                                position: 'relative'
                              }}
                              title={`${s.label}: ${formatMs(ms)} (${Math.round(pct)}%)`}
                            >
                              {pct > 12 && (
                                <span style={{ color: '#000', fontSize: '0.62rem', fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {s.label} ({Math.round(pct)}%)
                                </span>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Timeline breakdown legend */}
                  {totalDurationMs > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', fontSize: '0.72rem', color: '#a1a1aa', padding: '10px 12px', background: '#0f0f13', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '16px' }}>
                      {stagesConfig.map(s => {
                        const ms = stageDurations[s.key] || 0
                        if (ms <= 0) return null
                        const pct = Math.round((ms / totalDurationMs) * 100)
                        return (
                          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color }} />
                            <span>{s.label}: <strong style={{ color: '#fff' }}>{formatMs(ms)}</strong> ({pct}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ── BOTTLENECK ANALYSIS NOTE ── */}
                  {totalDurationMs > 0 && bottleneckStage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.95rem' }}>⚠️</span>
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>
                        Вузьке місце наряду: деталь пролежала/провела найдовше на етапі <strong style={{ textTransform: 'uppercase', textDecoration: 'underline', color: '#fff' }}>{bottleneckStage.label}</strong> — <strong style={{ color: '#fff' }}>{formatMs(maxMs)}</strong> ({bottleneckPct}% від усього часу виробництва).
                      </div>
                    </div>
                  )}

                  {/* ── DETAILED INDIVIDUAL CARDS TRACKING (COLLAPSIBLE) ── */}
                  <div style={{ borderTop: '1px dashed #2d2d39', paddingTop: '14px', marginTop: '10px' }}>
                    {(() => {
                      const isExpanded = !!expandedCardsState[part.id]
                      return (
                        <>
                          <button
                            onClick={() => setExpandedCardsState(prev => ({ ...prev, [part.id]: !prev[part.id] }))}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#a1a1aa',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 0',
                              transition: 'color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                            onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
                          >
                            <span>{isExpanded ? '📂' : '📁'}</span>
                            {isExpanded ? 'Сховати список карток' : 'Показати список карток'} ({partCards.length})
                            <span style={{ fontSize: '0.62rem', marginLeft: '2px', color: '#ff9000' }}>{isExpanded ? '▲' : '▼'}</span>
                          </button>

                          {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingLeft: '6px' }}>
                              {partCards.map(c => {
                                const historyRows = cardHistory.filter(h => h.card_id === c.id)
                                const cDuration = historyRows.reduce((sum, h) => {
                                  if (h.started_at && h.completed_at) {
                                    const diff = new Date(h.completed_at) - new Date(h.started_at)
                                    return sum + (diff > 0 ? diff : 0)
                                  }
                                  return sum
                                }, 0)

                                const cPct = c.status === 'completed' ? '🟢 ЗАВЕРШЕНО' 
                                  : c.status === 'at-buffer' ? '🔵 В БУФЕРІ' 
                                    : c.status === 'in-progress' ? '🟡 В РОБОТІ' 
                                      : '⚪ ОЧІКУЄ'

                                const currentOp = c.operation || 'Створення'

                                return (
                                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0c', border: '1px solid #1f1f25', padding: '10px 14px', borderRadius: '10px', fontSize: '0.74rem' }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                      <strong style={{ color: '#ff9000', fontFamily: 'monospace' }}>#{c.id.slice(-8).toUpperCase()}</strong>
                                      <span style={{ color: '#888' }}>К-сть: <strong>{c.quantity || 0} шт</strong></span>
                                      <span style={{ color: '#52525b' }}>|</span>
                                      <span style={{ color: '#ddd' }}>Етап: <strong>{currentOp}</strong></span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: c.status === 'completed' ? '#10b981' : (c.status === 'in-progress' ? '#f59e0b' : '#3b82f6') }}>{cPct}</span>
                                      <span style={{ color: '#888', fontSize: '0.68rem' }}>Час карти: <strong style={{ color: '#fff' }}>{formatMs(cDuration)}</strong></span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>



                </div>
              )
            })}
          </div>
        )}
      </div>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Link to Foreman */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to={`/foreman?task=${task.id}`}
          style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
            padding: '10px 20px', borderRadius: '12px', textDecoration: 'none', fontWeight: 900,
            fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          Відкрити в Foreman →
        </Link>
      </div>
    </div>
  )
}

export default ForemanDashboardModule
