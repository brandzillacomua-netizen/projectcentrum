import React, { useMemo, useState } from 'react'
import {
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Info
} from 'lucide-react'
import { formatDurationHuman } from '../utils/autopilotEngine'

const STAGE_COLORS = {
  Розкрій: '#2563eb',
  Галтовка: '#0d9488',
  Прийомка: '#0284c7',
  Сортування: '#4f46e5',
  Пресування: '#d97706',
  Фарбування: '#db2777',
  Доопрацювання: '#ea580c',
  Пакування: '#059669',
  Інше: '#64748b'
}

function getStageColor(stageGroup = '', isBuffer = false) {
  if (isBuffer || String(stageGroup).startsWith('Буфер')) return '#7c3aed'
  return STAGE_COLORS[stageGroup] || '#475569'
}

function formatDateTimeShort(ms) {
  if (!Number.isFinite(ms)) return '—'
  const d = new Date(ms)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${min}`
}

function formatDayShort(ms) {
  const d = new Date(ms)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dow = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]
  return { label: `${dd}.${mm}`, dow, isWeekend: d.getDay() === 0 || d.getDay() === 6 }
}

const COMPLETED_STATUSES = new Set(['completed', 'done', 'shipped', 'archived'])

export default function ProductionGanttView({
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  search,
  setSearch,
  loading,
  error,
  ganttOrders,
  orderPartsMap,
  loadingOrderParts,
  loadOrderParts
}) {
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'completed'
  const [showBuffers, setShowBuffers] = useState(true)
  const [zoomMode, setZoomMode] = useState('fit') // 'fit' | 'detailed'
  const [expandedOrders, setExpandedOrders] = useState(() => new Set())
  const [expandedStages, setExpandedStages] = useState(() => new Set())
  const [hoverInfo, setHoverInfo] = useState(null)

  const filteredOrders = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    return (ganttOrders || []).filter(o => {
      const isDone = COMPLETED_STATUSES.has(String(o.orderStatus || '').toLowerCase())
      if (statusFilter === 'active' && isDone) return false
      if (statusFilter === 'completed' && !isDone) return false
      if (!q) return true
      return (
        String(o.productName || '').toLowerCase().includes(q) ||
        String(o.orderNum || '').toLowerCase().includes(q) ||
        String(o.customer || '').toLowerCase().includes(q)
      )
    })
  }, [ganttOrders, search, statusFilter])

  const { viewStartMs, viewEndMs, days } = useMemo(() => {
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Date.now() - 14 * 86400000
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Date.now()
    const safeStart = Number.isFinite(start) ? start : Date.now() - 14 * 86400000
    const safeEnd = Number.isFinite(end) && end > safeStart ? end : safeStart + 86400000

    const dayList = []
    let cursor = new Date(safeStart)
    cursor.setHours(0, 0, 0, 0)
    while (cursor.getTime() <= safeEnd && dayList.length < 120) {
      const ms = cursor.getTime()
      dayList.push({ ms, ...formatDayShort(ms) })
      cursor = new Date(ms + 86400000)
    }
    return { viewStartMs: safeStart, viewEndMs: safeEnd, days: dayList }
  }, [dateFrom, dateTo])

  const totalSpanMs = Math.max(1, viewEndMs - viewStartMs)
  const nowMs = Date.now()
  const nowPct = ((nowMs - viewStartMs) / totalSpanMs) * 100
  const showNowLine = nowPct >= 0 && nowPct <= 100

  const kpi = useMemo(() => {
    let activeCnt = 0
    let doneCnt = 0
    let overdueCnt = 0
    let leadSum = 0
    filteredOrders.forEach(o => {
      const isDone = COMPLETED_STATUSES.has(String(o.orderStatus || '').toLowerCase())
      if (isDone) doneCnt += 1
      else activeCnt += 1
      if (o.deadlineMs) {
        const refMs = isDone ? o.lastEndMs : Math.max(nowMs, o.lastEndMs)
        if (refMs > o.deadlineMs) overdueCnt += 1
      }
      leadSum += o.leadTimeMinutes || 0
    })
    const avgLead = filteredOrders.length > 0 ? leadSum / filteredOrders.length : 0
    return { total: filteredOrders.length, activeCnt, doneCnt, overdueCnt, avgLead }
  }, [filteredOrders, nowMs])

  const toggleOrder = (orderId) => {
    const key = String(orderId)
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        if (!orderPartsMap.has(key) && typeof loadOrderParts === 'function') {
          loadOrderParts(key)
        }
      }
      return next
    })
  }

  const toggleStage = (orderId, stageGroup) => {
    const key = `${orderId}::${stageGroup}`
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    if (!orderPartsMap.has(String(orderId)) && typeof loadOrderParts === 'function') {
      loadOrderParts(String(orderId))
    }
  }

  const collapseAll = () => {
    setExpandedOrders(new Set())
    setExpandedStages(new Set())
  }

  const calcBarPos = (startMs, endMs) => {
    const clampedStart = Math.max(viewStartMs, startMs)
    const clampedEnd = Math.min(viewEndMs, endMs)
    if (clampedEnd <= clampedStart) return null
    const leftPct = ((clampedStart - viewStartMs) / totalSpanMs) * 100
    const widthPct = ((clampedEnd - clampedStart) / totalSpanMs) * 100
    return { leftPct, widthPct }
  }

  const handleBarEnter = (e, info) => {
    setHoverInfo({
      ...info,
      x: e.clientX,
      y: e.clientY
    })
  }

  const handleBarMove = (e) => {
    setHoverInfo(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
  }

  const handleBarLeave = () => {
    setHoverInfo(null)
  }

  const timelineMinWidth = zoomMode === 'detailed' ? Math.max(900, days.length * 140) : 0
  const gridMinWidth = zoomMode === 'detailed' ? `${320 + timelineMinWidth}px` : '100%'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%' }}>
      {/* Filters & Controls */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Пошук виробу, наряду, замовника..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '8px 12px 8px 34px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 700, boxSizing: 'border-box' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'inline-flex', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '3px', gap: '2px', flexShrink: 0 }}>
          {[
            { id: 'all', label: 'Усі' },
            { id: 'active', label: 'В роботі' },
            { id: 'completed', label: 'Завершені' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 850,
                whiteSpace: 'nowrap',
                background: statusFilter === opt.id ? '#0284c7' : 'transparent',
                color: statusFilter === opt.id ? '#fff' : 'var(--text)'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Zoom Filter */}
        <div style={{ display: 'inline-flex', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '3px', gap: '2px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setZoomMode('fit')}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 850,
              whiteSpace: 'nowrap',
              background: zoomMode === 'fit' ? '#4f46e5' : 'transparent',
              color: zoomMode === 'fit' ? '#fff' : 'var(--text)'
            }}
          >
            Огляд
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('detailed')}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 850,
              whiteSpace: 'nowrap',
              background: zoomMode === 'detailed' ? '#4f46e5' : 'transparent',
              color: zoomMode === 'detailed' ? '#fff' : 'var(--text)'
            }}
          >
            Детально
          </button>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#7c3aed', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={showBuffers}
            onChange={e => setShowBuffers(e.target.checked)}
            style={{ accentColor: '#7c3aed', width: '15px', height: '15px' }}
          />
          Показувати буфери
        </label>

        {expandedOrders.size > 0 && (
          <button
            type="button"
            onClick={collapseAll}
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--input-bg)',
              color: 'var(--text)',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Згорнути всі
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Нарядів на шкалі</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#0284c7', marginTop: '3px' }}>{kpi.total}</div>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>В роботі / Завершено</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#059669', marginTop: '3px' }}>
            {kpi.activeCnt} <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/ {kpi.doneCnt}</span>
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Перевищили дедлайн</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 950, color: kpi.overdueCnt > 0 ? '#ef4444' : '#059669', marginTop: '3px' }}>
            {kpi.overdueCnt}
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,144,0,0.35)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>Середній цикл (Lead Time)</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#ea580c', marginTop: '3px' }}>
            {kpi.avgLead > 0 ? formatDurationHuman(kpi.avgLead) : '—'}
          </div>
        </div>
      </div>

      {/* Legend & Guide */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.74rem', fontWeight: 750 }}>
          {Object.entries(STAGE_COLORS).filter(([k]) => k !== 'Інше').map(([name, color]) => (
            <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text)' }}>
              <span style={{ width: '12px', height: '10px', borderRadius: '3px', background: color, display: 'inline-block' }} />
              {name}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#7c3aed', fontWeight: 850 }}>
            <span
              style={{
                width: '14px',
                height: '10px',
                borderRadius: '3px',
                background: 'repeating-linear-gradient(45deg, rgba(124,58,237,0.85), rgba(124,58,237,0.85) 3px, rgba(124,58,237,0.35) 3px, rgba(124,58,237,0.35) 6px)',
                display: 'inline-block'
              }}
            />
            Буфери (очікування)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ea580c', fontWeight: 850 }}>
            <span style={{ width: '2px', height: '12px', background: '#ea580c', display: 'inline-block' }} />
            Зараз
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontWeight: 850 }}>
            ◆ Дедлайн наряду
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={13} color="#0284c7" />
          Натисніть на наряд, щоб розкрити етапи в часі; натисніть на етап — щоб побачити деталі. Наведіть курсор на будь-яку смужку для точного часу.
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
          Побудова діаграми Ганта за обраний період...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
          За обраними фільтрами активних відрізків на шкалі часу не знайдено.
        </div>
      ) : (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', overflow: 'hidden', width: '100%', maxWidth: '100%' }}>
          <div style={{ overflow: 'auto', maxHeight: '72vh', position: 'relative', width: '100%' }}>
            <div style={{ minWidth: gridMinWidth, width: '100%' }}>
              {/* Header Row */}
              <div style={{ display: 'flex', borderBottom: '1.5px solid var(--border-subtle)', background: 'var(--fill-subtle)', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ width: '320px', flexShrink: 0, padding: '10px 14px', borderRight: '1px solid var(--border-subtle)', position: 'sticky', left: 0, zIndex: 12, background: 'var(--card-bg)', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Наряд / Етап / Деталь</span>
                  <span>Цикл (Lead Time)</span>
                </div>
                <div style={{ flex: 1, position: 'relative', display: 'flex', minWidth: timelineMinWidth ? `${timelineMinWidth}px` : 0 }}>
                  {days.map(d => (
                    <div
                      key={d.ms}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderRight: '1px solid var(--border-subtle)',
                        padding: '6px 2px',
                        textAlign: 'center',
                        background: d.isWeekend ? 'rgba(148,163,184,0.08)' : 'transparent'
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', fontWeight: 900, color: d.isWeekend ? 'var(--text-muted)' : 'var(--text-strong)' }}>{d.label}</div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d.dow}</div>
                      {zoomMode === 'detailed' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.52rem', color: 'var(--text-muted)', marginTop: '2px', padding: '0 4px', opacity: 0.8 }}>
                          <span>00</span><span>06</span><span>12</span><span>18</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {showNowLine && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${nowPct}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        background: '#ea580c',
                        zIndex: 5,
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Order Rows */}
              {filteredOrders.map(ord => {
                const isOrderOpen = expandedOrders.has(ord.orderId)
                const isDone = COMPLETED_STATUSES.has(String(ord.orderStatus || '').toLowerCase())
                const isOverdue = Boolean(ord.deadlineMs && (isDone ? ord.lastEndMs : Math.max(nowMs, ord.lastEndMs)) > ord.deadlineMs)
                const visibleStages = showBuffers ? ord.stages : ord.stages.filter(s => !s.isBuffer)
                const spanBar = calcBarPos(ord.firstStartMs, ord.lastEndMs)
                const deadlinePct = ord.deadlineMs ? ((ord.deadlineMs - viewStartMs) / totalSpanMs) * 100 : null
                const partsByStage = orderPartsMap.get(ord.orderId)
                const isLoadingParts = loadingOrderParts.has(ord.orderId)

                return (
                  <React.Fragment key={ord.orderId}>
                    {/* Level 1: Order Row */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: isOrderOpen ? 'rgba(2,132,199,0.05)' : 'transparent' }}>
                      <button
                        type="button"
                        onClick={() => toggleOrder(ord.orderId)}
                        style={{
                          width: '320px',
                          flexShrink: 0,
                          padding: '10px 14px',
                          borderRight: '1px solid var(--border-subtle)',
                          borderTop: 'none',
                          borderLeft: 'none',
                          borderBottom: 'none',
                          position: 'sticky',
                          left: 0,
                          zIndex: 6,
                          background: isOrderOpen ? 'var(--fill-subtle)' : 'var(--card-bg)',
                          color: 'inherit',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          {isOrderOpen ? <ChevronDown size={16} color="#0284c7" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 900, fontSize: '0.84rem', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={ord.productName}>
                                {ord.productName}
                              </span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 850, background: 'rgba(2,132,199,0.14)', color: '#0284c7', padding: '1px 6px', borderRadius: '5px' }}>
                                №{ord.orderNum}
                              </span>
                              {isDone ? (
                                <CheckCircle2 size={13} color="#059669" title="Завершено" />
                              ) : isOverdue ? (
                                <AlertTriangle size={13} color="#ef4444" title="Прострочено дедлайн" />
                              ) : null}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {ord.orderQty > 0 && <span>{ord.orderQty.toLocaleString()} шт</span>}
                              {ord.deadline && (
                                <span style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)', fontWeight: isOverdue ? 800 : 600 }}>
                                  Дедл: {new Date(ord.deadline).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 950, color: '#0284c7' }}>
                            {formatDurationHuman(ord.leadTimeMinutes)}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            роботи: {formatDurationHuman(ord.activeMinutes)}
                          </div>
                        </div>
                      </button>

                      {/* Order Timeline Track */}
                      <div style={{ flex: 1, position: 'relative', minWidth: timelineMinWidth ? `${timelineMinWidth}px` : 0, display: 'flex', alignItems: 'center' }}>
                        {/* Day grid */}
                        {days.map(d => (
                          <div
                            key={d.ms}
                            style={{
                              flex: 1,
                              height: '100%',
                              borderRight: '1px solid var(--border-subtle)',
                              background: d.isWeekend ? 'rgba(148,163,184,0.05)' : 'transparent'
                            }}
                          />
                        ))}
                        {/* Overall lead-time span bar */}
                        {spanBar && (
                          <div
                            onMouseEnter={e => handleBarEnter(e, {
                              title: `${ord.productName} (Наряд №${ord.orderNum})`,
                              subtitle: 'Загальний цикл наряду (Lead Time)',
                              startMs: ord.firstStartMs,
                              endMs: ord.lastEndMs,
                              minutes: ord.leadTimeMinutes,
                              cardsCount: null
                            })}
                            onMouseMove={handleBarMove}
                            onMouseLeave={handleBarLeave}
                            style={{
                              position: 'absolute',
                              left: `${spanBar.leftPct}%`,
                              width: `${spanBar.widthPct}%`,
                              minWidth: '6px',
                              height: '20px',
                              borderRadius: '6px',
                              background: isDone ? 'rgba(5,150,105,0.16)' : isOverdue ? 'rgba(239,68,68,0.16)' : 'rgba(2,132,199,0.16)',
                              border: `1.5px solid ${isDone ? '#059669' : isOverdue ? '#ef4444' : '#0284c7'}`,
                              zIndex: 2,
                              cursor: 'pointer'
                            }}
                          />
                        )}
                        {/* Active merged order segments */}
                        {ord.orderSegments.map((seg, idx) => {
                          const pos = calcBarPos(seg.startMs, seg.endMs)
                          if (!pos) return null
                          return (
                            <div
                              key={idx}
                              onMouseEnter={e => handleBarEnter(e, {
                                title: `${ord.productName} (Наряд №${ord.orderNum})`,
                                subtitle: 'Активна робота / перебування в цеху',
                                startMs: seg.startMs,
                                endMs: seg.endMs,
                                minutes: seg.minutes,
                                cardsCount: seg.cardsCount
                              })}
                              onMouseMove={handleBarMove}
                              onMouseLeave={handleBarLeave}
                              style={{
                                position: 'absolute',
                                left: `${pos.leftPct}%`,
                                width: `${pos.widthPct}%`,
                                minWidth: '4px',
                                height: '12px',
                                borderRadius: '4px',
                                background: isDone ? '#059669' : isOverdue ? '#ef4444' : '#0284c7',
                                zIndex: 3,
                                cursor: 'pointer'
                              }}
                            />
                          )
                        })}
                        {/* Deadline diamond marker */}
                        {deadlinePct !== null && deadlinePct >= 0 && deadlinePct <= 100 && (
                          <div
                            title={`Дедлайн: ${new Date(ord.deadlineMs).toLocaleDateString('uk-UA')}`}
                            style={{
                              position: 'absolute',
                              left: `${deadlinePct}%`,
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: isOverdue ? '#ef4444' : '#059669',
                              fontSize: '0.85rem',
                              fontWeight: 950,
                              zIndex: 4,
                              pointerEvents: 'none'
                            }}
                          >
                            ◆
                          </div>
                        )}
                        {showNowLine && (
                          <div style={{ position: 'absolute', left: `${nowPct}%`, top: 0, bottom: 0, width: '2px', background: 'rgba(234,88,12,0.55)', zIndex: 4, pointerEvents: 'none' }} />
                        )}
                      </div>
                    </div>

                    {/* Level 2: Stages inside Order */}
                    {isOrderOpen && visibleStages.map(st => {
                      const stageKey = `${ord.orderId}::${st.stageGroup}`
                      const isStageOpen = expandedStages.has(stageKey)
                      const color = getStageColor(st.stageGroup, st.isBuffer)
                      const stageParts = partsByStage?.get(st.stageGroup) || []

                      return (
                        <React.Fragment key={stageKey}>
                          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--fill-subtle)' }}>
                            <button
                              type="button"
                              onClick={() => toggleStage(ord.orderId, st.stageGroup)}
                              style={{
                                width: '320px',
                                flexShrink: 0,
                                padding: '7px 14px 7px 32px',
                                borderRight: '1px solid var(--border-subtle)',
                                borderTop: 'none',
                                borderLeft: 'none',
                                borderBottom: 'none',
                                position: 'sticky',
                                left: 0,
                                zIndex: 6,
                                background: 'var(--card-bg)',
                                color: 'inherit',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                {isStageOpen ? <ChevronDown size={14} color={color} /> : <ChevronRight size={14} color="var(--text-muted)" />}
                                <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: 850, color: st.isBuffer ? '#7c3aed' : 'var(--text-strong)' }}>
                                  {st.stageGroup}
                                </span>
                                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                  ({st.cardsCount} карт)
                                </span>
                              </div>
                              <span style={{ fontSize: '0.76rem', fontWeight: 850, color }}>
                                {formatDurationHuman(st.totalMinutes)}
                              </span>
                            </button>

                            <div style={{ flex: 1, position: 'relative', minWidth: timelineMinWidth ? `${timelineMinWidth}px` : 0, display: 'flex', alignItems: 'center' }}>
                              {days.map(d => (
                                <div key={d.ms} style={{ flex: 1, height: '100%', borderRight: '1px solid var(--border-subtle)', background: d.isWeekend ? 'rgba(148,163,184,0.05)' : 'transparent' }} />
                              ))}
                              {st.segments.map((seg, idx) => {
                                const pos = calcBarPos(seg.startMs, seg.endMs)
                                if (!pos) return null
                                return (
                                  <div
                                    key={idx}
                                    onMouseEnter={e => handleBarEnter(e, {
                                      title: `${ord.productName} (№${ord.orderNum}) → ${st.stageGroup}`,
                                      subtitle: st.isBuffer ? 'Очікування в буфері' : 'Виробничий етап',
                                      startMs: seg.startMs,
                                      endMs: seg.endMs,
                                      minutes: seg.minutes,
                                      cardsCount: seg.cardsCount
                                    })}
                                    onMouseMove={handleBarMove}
                                    onMouseLeave={handleBarLeave}
                                    style={{
                                      position: 'absolute',
                                      left: `${pos.leftPct}%`,
                                      width: `${pos.widthPct}%`,
                                      minWidth: '4px',
                                      height: '14px',
                                      borderRadius: '4px',
                                      background: st.isBuffer
                                        ? `repeating-linear-gradient(45deg, rgba(124,58,237,0.85), rgba(124,58,237,0.85) 4px, rgba(124,58,237,0.35) 4px, rgba(124,58,237,0.35) 8px)`
                                        : color,
                                      zIndex: 3,
                                      cursor: 'pointer'
                                    }}
                                  />
                                )
                              })}
                              {showNowLine && (
                                <div style={{ position: 'absolute', left: `${nowPct}%`, top: 0, bottom: 0, width: '2px', background: 'rgba(234,88,12,0.45)', zIndex: 4, pointerEvents: 'none' }} />
                              )}
                            </div>
                          </div>

                          {/* Level 3: Parts inside Stage */}
                          {isStageOpen && (
                            isLoadingParts && stageParts.length === 0 ? (
                              <div style={{ padding: '6px 14px 6px 52px', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                                Завантаження деталей етапу...
                              </div>
                            ) : stageParts.map(part => (
                              <div key={`${stageKey}::${part.nomId}`} style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div
                                  style={{
                                    width: '320px',
                                    flexShrink: 0,
                                    padding: '6px 14px 6px 52px',
                                    borderRight: '1px solid var(--border-subtle)',
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 6,
                                    background: 'var(--card-bg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '6px'
                                  }}
                                >
                                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '205px' }} title={part.nomName}>
                                    {part.nomName}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {formatDurationHuman(part.totalMinutes)}
                                  </span>
                                </div>
                                <div style={{ flex: 1, position: 'relative', minWidth: timelineMinWidth ? `${timelineMinWidth}px` : 0, display: 'flex', alignItems: 'center' }}>
                                  {days.map(d => (
                                    <div key={d.ms} style={{ flex: 1, height: '100%', borderRight: '1px solid var(--border-subtle)', background: d.isWeekend ? 'rgba(148,163,184,0.04)' : 'transparent' }} />
                                  ))}
                                  {part.segments.map((seg, idx) => {
                                    const pos = calcBarPos(seg.startMs, seg.endMs)
                                    if (!pos) return null
                                    return (
                                      <div
                                        key={idx}
                                        onMouseEnter={e => handleBarEnter(e, {
                                          title: `${part.nomName} (${st.stageGroup})`,
                                          subtitle: `Наряд №${ord.orderNum}`,
                                          startMs: seg.startMs,
                                          endMs: seg.endMs,
                                          minutes: seg.minutes,
                                          cardsCount: seg.cardsCount
                                        })}
                                        onMouseMove={handleBarMove}
                                        onMouseLeave={handleBarLeave}
                                        style={{
                                          position: 'absolute',
                                          left: `${pos.leftPct}%`,
                                          width: `${pos.widthPct}%`,
                                          minWidth: '4px',
                                          height: '10px',
                                          borderRadius: '3px',
                                          background: color,
                                          opacity: st.isBuffer ? 0.65 : 0.88,
                                          zIndex: 3,
                                          cursor: 'pointer'
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoverInfo && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 295, hoverInfo.x + 14),
            top: Math.min(window.innerHeight - 165, hoverInfo.y + 14),
            zIndex: 9999,
            background: 'var(--card-bg)',
            color: 'var(--text)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '10px 14px',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
            pointerEvents: 'none',
            minWidth: '245px',
            maxWidth: '305px',
            fontSize: '0.76rem'
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '0.8rem', marginBottom: '2px', color: 'var(--text-strong)' }}>{hoverInfo.title}</div>
          {hoverInfo.subtitle && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>{hoverInfo.subtitle}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Початок:</span>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{formatDateTimeShort(hoverInfo.startMs)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Кінець:</span>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{formatDateTimeShort(hoverInfo.endMs)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '3px', paddingTop: '5px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> Тривалість:</span>
              <span style={{ fontWeight: 950, color: '#0284c7' }}>{formatDurationHuman(hoverInfo.minutes)}</span>
            </div>
            {hoverInfo.cardsCount !== null && hoverInfo.cardsCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Карток у відрізку:</span>
                <span style={{ fontWeight: 900, color: '#7c3aed' }}>{hoverInfo.cardsCount}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
