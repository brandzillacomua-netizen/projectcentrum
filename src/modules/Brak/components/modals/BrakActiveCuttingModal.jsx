import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Flame,
  Search,
  RefreshCw,
  Clock,
  Stamp,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  User,
  ChevronRight,
  Filter
} from 'lucide-react'
import { parseQcOpsStamps } from '../../../Shop1/utils/shop1Helpers.js'
import { extractCardSequence } from '../../hooks/useBrakData.js'

function formatDurationFromMs(ms) {
  if (!ms || ms < 0) return '0 хв'
  const totalMins = Math.floor(ms / 60000)
  if (totalMins < 60) return `${totalMins} хв`
  const hours = Math.floor(totalMins / 60)
  const remainingMins = totalMins % 60
  if (remainingMins === 0) return `${hours} год`
  return `${hours} год ${remainingMins} хв`
}

function formatTimeOnly(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return String(isoStr)
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

export function isCardInCutting(card, nomMapOrList) {
  if (!card) return false
  const status = String(card.status || '').toLowerCase()
  const isActive = status === 'in-progress' || status === 'in_progress' || status === 'paused' || status === 'hold' || status === 'working'
  if (!isActive) return false

  const op = String(card.operation || card.current_operation || '').trim()
  if (op !== 'Розкрій' && !op.toLowerCase().startsWith('розкрій')) return false

  const info = String(card.card_info || '')
  if (
    info.includes('[ЗІ СКЛАДУ СГП]') ||
    info.includes('[SHOP:2]') ||
    info.includes('[ЦЕХ №2] Автоматично') ||
    info.includes('[ЦЕХ 2] Автоматично')
  ) {
    return false
  }

  if (nomMapOrList) {
    const nom = Array.isArray(nomMapOrList)
      ? nomMapOrList.find(n => String(n.id) === String(card.nomenclature_id))
      : nomMapOrList.get?.(card.nomenclature_id) || nomMapOrList[card.nomenclature_id]
    if (nom && nom.type && nom.type !== 'part') {
      return false
    }
  }

  return true
}

export function getActiveCuttingCards(workCards = [], nomMapOrList = null) {
  const uniqueMap = new Map()
  for (const card of workCards || []) {
    if (!card || !card.id) continue
    const cardId = String(card.id)
    if (uniqueMap.has(cardId)) continue
    if (isCardInCutting(card, nomMapOrList)) {
      uniqueMap.set(cardId, card)
    }
  }
  return Array.from(uniqueMap.values())
}

export const BrakActiveCuttingModal = React.memo(({
  isOpen,
  onClose,
  workCards = [],
  orders = [],
  nomenclatures = [],
  machines = [],
  fetchData,
  onOpenCardStampModal
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all') // 'all' | 'uninspected' | 'needs_recheck' | 'inspected'
  const [selectedMachine, setSelectedMachine] = useState('all')
  const [sortBy, setSortBy] = useState('duration_desc') // 'duration_desc' | 'qc_urgency' | 'machine'
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Keep a live minute ticker for durations
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 30000)
    return () => clearInterval(interval)
  }, [isOpen])

  // Lock body scroll on open
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.body.style.touchAction = 'pan-y'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
      document.body.style.touchAction = prevTouchAction
    }
  }, [isOpen])

  const ordersMap = useMemo(() => {
    const map = new Map()
    ;(orders || []).forEach(o => map.set(o.id, o))
    return map
  }, [orders])

  const nomMap = useMemo(() => {
    const map = new Map()
    ;(nomenclatures || []).forEach(n => map.set(n.id, n))
    return map
  }, [nomenclatures])

  const handleRefresh = async () => {
    if (typeof fetchData === 'function') {
      setIsRefreshing(true)
      try {
        await fetchData()
      } finally {
        setIsRefreshing(false)
      }
    }
  }

  // Build cutting cards models with all metrics
  const cuttingCards = useMemo(() => {
    const active = getActiveCuttingCards(workCards, nomMap)

    return active.map(card => {
      const order = ordersMap.get(card.order_id)
      const nom = nomMap.get(card.nomenclature_id)
      const qcData = parseQcOpsStamps(card.card_info)
      const opsEntries = Object.entries(qcData?.ops || {})
      const stampedOpsCount = opsEntries.length
      const sheetsApproved = Boolean(qcData?.sheets?.verified || qcData?.sheets?.approved)
      const hasAnyStamp = stampedOpsCount > 0 || sheetsApproved

      // Duration in cutting
      const startTime = card.started_at ? new Date(card.started_at).getTime() : new Date(card.created_at || Date.now()).getTime()
      const durationMs = Math.max(0, now - startTime)

      // Time since last VKYA stamp
      let lastStampMs = null
      let lastStampDate = null
      if (qcData?.updatedAt) {
        lastStampDate = new Date(qcData.updatedAt)
        if (!Number.isNaN(lastStampDate.getTime())) {
          lastStampMs = Math.max(0, now - lastStampDate.getTime())
        }
      }

      // Sheets count
      const matchSheets = String(card.card_info || '').match(/\[SHEETS:(\d+)\]/)
      const sheetsCount = matchSheets ? Number(matchSheets[1]) : (card.sheets_count || 1)

      const seqNum = extractCardSequence(card.card_info)
      const shortHex = String(card.id || '').slice(0, 8).toUpperCase()

      // Inspection state categorization:
      // - uninspected: no stamps at all
      // - urgent_recheck: inspected > 2 hours ago
      // - needs_recheck: inspected between 45m and 2h ago
      // - fresh: inspected < 45m ago
      let inspectionTier = 'uninspected'
      if (hasAnyStamp) {
        if (lastStampMs === null || lastStampMs > 2 * 3600 * 1000) {
          inspectionTier = 'urgent_recheck'
        } else if (lastStampMs > 45 * 60 * 1000) {
          inspectionTier = 'needs_recheck'
        } else {
          inspectionTier = 'fresh'
        }
      }

      return {
        card,
        order,
        nom,
        qcData,
        stampedOpsCount,
        sheetsApproved,
        hasAnyStamp,
        durationMs,
        startTime,
        lastStampMs,
        lastStampDate,
        sheetsCount,
        seqNum,
        shortHex,
        inspectionTier,
        machineName: card.machine || 'ЧПК',
        operatorName: card.operator_name || 'Не вказано'
      }
    })
  }, [workCards, ordersMap, nomMap, now])

  // Extract unique machines list
  const availableMachines = useMemo(() => {
    const list = Array.from(new Set(cuttingCards.map(c => c.machineName).filter(Boolean)))
    return list.sort()
  }, [cuttingCards])

  // Filter & Sort
  const filteredCards = useMemo(() => {
    return cuttingCards.filter(item => {
      // Machine filter
      if (selectedMachine !== 'all' && item.machineName !== selectedMachine) {
        return false
      }

      // Tier filter
      if (selectedFilter === 'uninspected' && item.hasAnyStamp) return false
      if (selectedFilter === 'needs_recheck' && (item.inspectionTier !== 'urgent_recheck' && item.inspectionTier !== 'needs_recheck')) return false
      if (selectedFilter === 'inspected' && item.inspectionTier !== 'fresh') return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const textToSearch = [
          item.card.id,
          item.shortHex,
          item.seqNum,
          item.order?.order_num,
          item.nom?.name,
          item.machineName,
          item.operatorName
        ].filter(Boolean).join(' ').toLowerCase()

        if (!textToSearch.includes(q)) return false
      }

      return true
    }).sort((a, b) => {
      if (sortBy === 'duration_desc') {
        return b.durationMs - a.durationMs
      }
      if (sortBy === 'qc_urgency') {
        const tierWeight = { uninspected: 4, urgent_recheck: 3, needs_recheck: 2, fresh: 1 }
        const diff = (tierWeight[b.inspectionTier] || 0) - (tierWeight[a.inspectionTier] || 0)
        if (diff !== 0) return diff
        return b.durationMs - a.durationMs
      }
      if (sortBy === 'machine') {
        return a.machineName.localeCompare(b.machineName)
      }
      return 0
    })
  }, [cuttingCards, selectedMachine, selectedFilter, searchQuery, sortBy])

  // Stats
  const stats = useMemo(() => {
    const total = cuttingCards.length
    const uninspected = cuttingCards.filter(c => !c.hasAnyStamp).length
    const needsRecheck = cuttingCards.filter(c => c.inspectionTier === 'urgent_recheck' || c.inspectionTier === 'needs_recheck').length
    const fresh = cuttingCards.filter(c => c.inspectionTier === 'fresh').length
    return { total, uninspected, needsRecheck, fresh }
  }, [cuttingCards])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100060, // Above mobile-app-topbar (99990)
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--modal-bg, #0d0f12)',
          color: 'var(--text-color, #fff)',
          width: '100%',
          maxWidth: '1200px',
          height: 'min(94dvh, 880px)',
          maxHeight: 'calc(100dvh - 16px)',
          borderRadius: '22px',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.7), 0 0 35px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(180,83,9,0.04) 100%)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                flexShrink: 0
              }}
            >
              <Flame size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 950, color: 'var(--text-strong, #fff)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                  КАРТКИ В РОЗКРОЇ · МОНІТОРИНГ ВКЯ
                </h2>
                <span
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    fontWeight: 950,
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}
                >
                  {cuttingCards.length} в роботі
                </span>
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                Контроль часу розкрою на верстатах ЧПК та своєчасне погодження операцій ВКЯ
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                background: 'var(--card-inner-bg, rgba(255,255,255,0.06))',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#f59e0b',
                padding: '7px 12px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 850,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-s1' : ''} />
              <span>Оновити</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Quick KPI Counters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
            padding: '10px 16px',
            background: 'var(--card-inner-bg, rgba(255,255,255,0.02))',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            flexShrink: 0
          }}
        >
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '8px 12px' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase' }}>В розкрої зараз</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: 'var(--text-strong, #fff)', marginTop: '2px' }}>
              {stats.total} <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>карток</span>
            </div>
          </div>

          <div
            onClick={() => setSelectedFilter(selectedFilter === 'uninspected' ? 'all' : 'uninspected')}
            style={{
              background: stats.uninspected > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              border: stats.uninspected > 0 ? '1.5px solid #ef4444' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 900, color: stats.uninspected > 0 ? '#ef4444' : 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
              🚨 Ще без печаток
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: stats.uninspected > 0 ? '#ef4444' : 'var(--text-strong, #fff)', marginTop: '2px' }}>
              {stats.uninspected}
            </div>
          </div>

          <div
            onClick={() => setSelectedFilter(selectedFilter === 'needs_recheck' ? 'all' : 'needs_recheck')}
            style={{
              background: stats.needsRecheck > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
              border: stats.needsRecheck > 0 ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase' }}>
              ⏳ Перевірити знову (&gt;45хв)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: 'var(--text-strong, #fff)', marginTop: '2px' }}>
              {stats.needsRecheck}
            </div>
          </div>

          <div
            onClick={() => setSelectedFilter(selectedFilter === 'inspected' ? 'all' : 'inspected')}
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>
              ✅ Свіжо перевірені
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 950, color: 'var(--text-strong, #fff)', marginTop: '2px' }}>
              {stats.fresh}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--card-inner-bg, rgba(255,255,255,0.015))',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--modal-bg, #000)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              borderRadius: '10px',
              padding: '0 10px',
              height: '34px',
              flex: '1 1 220px'
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted, #888)', marginRight: '6px' }} />
            <input
              type="text"
              placeholder="Пошук за карткою, нарядом, деталлю, верстатом..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-color, #fff)',
                fontSize: '0.78rem',
                outline: 'none',
                width: '100%',
                fontWeight: 700
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #777)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Machine Filter */}
          {availableMachines.length > 1 && (
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                background: 'var(--modal-bg, #000)',
                color: 'var(--text-color, #fff)',
                fontSize: '0.76rem',
                fontWeight: 800,
                outline: 'none'
              }}
            >
              <option value="all">Всі верстати ({availableMachines.length})</option>
              {availableMachines.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}

          {/* Quick Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {[
              { id: 'all', label: 'Всі' },
              { id: 'uninspected', label: '🚨 Без печаток' },
              { id: 'needs_recheck', label: '⏳ Перевірити знову' },
              { id: 'inspected', label: '✅ Нещодавні' }
            ].map(tab => {
              const active = selectedFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFilter(tab.id)}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: active ? '1px solid #f59e0b' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
                    background: active ? 'rgba(245,158,11,0.18)' : 'transparent',
                    color: active ? '#f59e0b' : 'var(--text-muted, #94a3b8)',
                    fontSize: '0.72rem',
                    fontWeight: 850,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              height: '34px',
              padding: '0 10px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              background: 'var(--modal-bg, #000)',
              color: 'var(--text-color, #fff)',
              fontSize: '0.76rem',
              fontWeight: 800,
              outline: 'none',
              marginLeft: 'auto'
            }}
          >
            <option value="duration_desc">⏱️ Найдовше в роботі</option>
            <option value="qc_urgency">🚨 Терміновість перевірки ВКЯ</option>
            <option value="machine">Верстат (А-Я)</option>
          </select>
        </div>

        {/* Scrollable Cards Grid / List */}
        <div
          style={{
            padding: '14px 16px',
            overflowY: 'auto',
            flex: 1,
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {filteredCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #94a3b8)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚙️</div>
              <div style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--text-strong, #fff)' }}>
                {cuttingCards.length === 0
                  ? 'Наразі немає активних карток у розкрої'
                  : 'За обраними фільтрами карток не знайдено'}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '6px', maxWidth: '420px', margin: '6px auto 0' }}>
                {cuttingCards.length === 0
                  ? 'Коли оператор візьме картку в роботу на верстаті ЧПК, вона автоматично відобразиться тут для оперативного контролю ВКЯ.'
                  : 'Спробуйте скинути фільтри або змінити пошуковий запит.'}
              </div>
            </div>
          ) : (
            filteredCards.map(item => {
              const { card, order, nom, qcData, durationMs, lastStampMs, inspectionTier } = item

              // Determine border and accent color based on urgency
              const isUrgent = inspectionTier === 'uninspected' || inspectionTier === 'urgent_recheck'
              const borderStyle = isUrgent
                ? '1.5px solid rgba(239, 68, 68, 0.45)'
                : inspectionTier === 'fresh'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(245, 158, 11, 0.35)'

              return (
                <div
                  key={card.id}
                  style={{
                    background: 'var(--card-inner-bg, rgba(255,255,255,0.03))',
                    border: borderStyle,
                    borderRadius: '16px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: isUrgent ? '0 4px 18px rgba(239, 68, 68, 0.12)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {/* Top Bar: Machine + Order / Card Hex + Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Machine Badge */}
                      <span
                        style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          color: '#60a5fa',
                          fontWeight: 950,
                          fontSize: '0.76rem',
                          padding: '3px 9px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Cpu size={14} />
                        <span>{item.machineName}</span>
                      </span>

                      {/* Card ID */}
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          fontWeight: 950,
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          borderRadius: '8px'
                        }}
                      >
                        Картка #{item.shortHex}{item.seqNum ? ` (${item.seqNum})` : ''}
                      </span>

                      {/* Order Number */}
                      {order?.order_num && (
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #94a3b8)' }}>
                          Наряд №<strong>{order.order_num}</strong>
                        </span>
                      )}
                    </div>

                    {/* Work Status (Running / Paused) */}
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        background: card.status === 'paused' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                        color: card.status === 'paused' ? '#ef4444' : '#22c55e',
                        border: card.status === 'paused' ? '1px solid #ef444440' : '1px solid #22c55e40'
                      }}
                    >
                      {card.status === 'paused' ? '⏸ ПАУЗА' : '▶ В РОЗКРОЇ'}
                    </span>
                  </div>

                  {/* Main Info: Nomenclature & Quantity */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{ fontSize: '1.02rem', fontWeight: 950, color: 'var(--text-strong, #fff)', wordBreak: 'break-word', lineHeight: 1.25 }}>
                        {nom?.name || 'Деталь розкрою'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Layers size={14} color="#f59e0b" />
                          <span>Листів: <strong style={{ color: 'var(--text-strong, #fff)' }}>{item.sheetsCount}</strong></span>
                        </span>
                        <span>·</span>
                        <span>Кількість: <strong style={{ color: 'var(--text-strong, #fff)' }}>{card.quantity || 0} шт</strong></span>
                        <span>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={13} />
                          <span>Оператор: <strong style={{ color: 'var(--text-strong, #fff)' }}>{item.operatorName}</strong></span>
                        </span>
                      </div>
                    </div>

                    {/* Action Button: Check / Stamp */}
                    <button
                      type="button"
                      onClick={() => onOpenCardStampModal && onOpenCardStampModal(card)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: item.hasAnyStamp
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        fontSize: '0.84rem',
                        fontWeight: 950,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: item.hasAnyStamp ? '0 4px 14px rgba(16,185,129,0.3)' : '0 4px 14px rgba(245,158,11,0.35)',
                        flexShrink: 0
                      }}
                    >
                      <Stamp size={17} />
                      <span>{item.hasAnyStamp ? '💮 ПЕРЕВІРИТИ / РЕДАГУВАТИ' : '💮 ПЕРЕВІРИТИ КАРТКУ'}</span>
                    </button>
                  </div>

                  {/* Two Monitoring Boxes: 1. Time in cutting | 2. VKYA last check */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '10px',
                      marginTop: '2px'
                    }}
                  >
                    {/* Box 1: Time in Cutting */}
                    <div
                      style={{
                        background: 'var(--modal-bg, rgba(0,0,0,0.3))',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: durationMs > 3 * 3600 * 1000 ? 'rgba(239,68,68,0.15)' : durationMs > 90 * 60 * 1000 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                          color: durationMs > 3 * 3600 * 1000 ? '#ef4444' : durationMs > 90 * 60 * 1000 ? '#f59e0b' : '#60a5fa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Clock size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 850, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                          Час у розкрої:
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 950, color: 'var(--text-strong, #fff)' }}>
                          {formatDurationFromMs(durationMs)}
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', marginLeft: '6px' }}>
                            (старт о {formatTimeOnly(card.started_at || card.created_at)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Box 2: VKYA Inspection Status */}
                    <div
                      style={{
                        background: !item.hasAnyStamp
                          ? 'rgba(239,68,68,0.08)'
                          : inspectionTier === 'urgent_recheck'
                          ? 'rgba(239,68,68,0.06)'
                          : inspectionTier === 'needs_recheck'
                          ? 'rgba(245,158,11,0.06)'
                          : 'rgba(16,185,129,0.06)',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        border: !item.hasAnyStamp
                          ? '1px solid rgba(239,68,68,0.3)'
                          : inspectionTier === 'urgent_recheck'
                          ? '1px solid rgba(239,68,68,0.25)'
                          : inspectionTier === 'needs_recheck'
                          ? '1px solid rgba(245,158,11,0.25)'
                          : '1px solid rgba(16,185,129,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: !item.hasAnyStamp
                            ? 'rgba(239,68,68,0.2)'
                            : inspectionTier === 'urgent_recheck'
                            ? 'rgba(239,68,68,0.2)'
                            : inspectionTier === 'needs_recheck'
                            ? 'rgba(245,158,11,0.2)'
                            : 'rgba(16,185,129,0.2)',
                          color: !item.hasAnyStamp
                            ? '#ef4444'
                            : inspectionTier === 'urgent_recheck'
                            ? '#ef4444'
                            : inspectionTier === 'needs_recheck'
                            ? '#f59e0b'
                            : '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {!item.hasAnyStamp ? (
                          <AlertTriangle size={18} />
                        ) : (
                          <Stamp size={18} />
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 850, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                          Остання перевірка ВКЯ:
                        </div>
                        {!item.hasAnyStamp ? (
                          <div style={{ fontSize: '0.82rem', fontWeight: 950, color: '#ef4444' }}>
                            ⚠️ Ще не перевірялось ВКЯ (потрібен контроль)
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 950, color: 'var(--text-strong, #fff)' }}>
                              {lastStampMs !== null ? `${formatDurationFromMs(lastStampMs)} тому` : (qcData?.lastStampedAt || 'погоджено')}
                              <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#10b981', marginLeft: '6px' }}>
                                ({qcData?.lastStamp || 'ВКЯ'} · {qcData?.lastInspector || 'Інспектор'})
                              </span>
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #94a3b8)', marginTop: '1px' }}>
                              Погоджено: <strong style={{ color: '#10b981' }}>{item.stampedOpsCount} опер.</strong>
                              {item.sheetsApproved ? ' · Листи відповідають ✓' : ' · Листи не відмічено'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
})

