import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  X,
  Search,
  Stamp,
  CheckSquare,
  Clock,
  RefreshCw,
  FileCheck2,
  UserCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw
} from 'lucide-react'
import { parseQcOpsStamps } from '../../Shop1/utils/shop1Helpers.js'
import { extractCardSequence } from '../hooks/useBrakData.js'

const STAMP_FILTER_OPTIONS = [
  'Всі печатки',
  'ВКЯ 1',
  'ВКЯ 2',
  'ВКЯ 3',
  'ВКЯ 4',
  'ВКЯ 5',
  'ВКЯ 6',
  'ВКЯ 7',
  'ВКЯ 8',
]

const PERIOD_OPTIONS = [
  { id: 'all', label: 'За весь час' },
  { id: 'today', label: 'Сьогодні' },
  { id: 'yesterday', label: 'Вчора' },
  { id: 'week', label: '7 днів' },
  { id: 'month', label: '30 днів' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function isWithinDateFilter(dateStr, periodId, dateFrom, dateTo) {
  if (!dateStr) return periodId === 'all' && !dateFrom && !dateTo
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return true

  if (dateFrom) {
    const fromBoundary = new Date(`${dateFrom}T00:00:00`)
    if (!Number.isNaN(fromBoundary.getTime()) && d < fromBoundary) return false
  }
  if (dateTo) {
    const toBoundary = new Date(`${dateTo}T23:59:59.999`)
    if (!Number.isNaN(toBoundary.getTime()) && d > toBoundary) return false
  }

  if (periodId === 'all' || dateFrom || dateTo) return true

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (periodId === 'today') {
    return d >= startOfToday
  }
  if (periodId === 'yesterday') {
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    return d >= startOfYesterday && d < startOfToday
  }
  if (periodId === 'week') {
    const weekAgo = new Date(startOfToday)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }
  if (periodId === 'month') {
    const monthAgo = new Date(startOfToday)
    monthAgo.setDate(monthAgo.getDate() - 30)
    return d >= monthAgo
  }
  return true
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return String(isoStr)
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('...')
  for (let p = start; p <= end; p += 1) {
    pages.push(p)
  }
  if (end < totalPages - 1) pages.push('...')
  pages.push(totalPages)
  return pages
}

export const BrakStampsJournalModal = React.memo(({
  isOpen,
  onClose,
  supabase,
  workCards = [],
  orders = [],
  nomenclatures = [],
  machines = [],
  onOpenCardStampModal,
}) => {
  const [activeTab, setActiveTab] = useState('cards') // 'cards' | 'history'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStamp, setSelectedStamp] = useState('Всі печатки')
  const [selectedInspector, setSelectedInspector] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [dbStampedCards, setDbStampedCards] = useState([])
  const [historyLogs, setHistoryLogs] = useState([])
  const [expandedCardIds, setExpandedCardIds] = useState(() => new Set())

  const toggleCardExpanded = (cardId) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  // Lock body scroll and prevent background scroll bleeding on mobile touch
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

  const machinesMap = useMemo(() => {
    const map = new Map()
    ;(machines || []).forEach(m => map.set(m.id, m))
    return map
  }, [machines])

  const loadJournalData = useCallback(async () => {
    if (!supabase) return
    setIsLoading(true)
    try {
      const [cardsRes, historyRes] = await Promise.all([
        supabase
          .from('work_cards')
          .select('*')
          .ilike('card_info', '%[QC_OPS:%')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('work_card_history')
          .select('*')
          .eq('stage_name', 'Печатка ВКЯ (Операції)')
          .order('completed_at', { ascending: false })
          .limit(2000),
      ])

      if (!cardsRes.error && Array.isArray(cardsRes.data)) {
        setDbStampedCards(cardsRes.data)
      }
      if (!historyRes.error && Array.isArray(historyRes.data)) {
        setHistoryLogs(historyRes.data)
      }
    } catch (err) {
      console.error('Помилка завантаження журналу печаток ВКЯ:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (isOpen) {
      loadJournalData()
    }
  }, [isOpen, loadJournalData])

  // Reset pagination to page 1 when filters or tabs change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery, selectedStamp, selectedInspector, selectedPeriod, dateFrom, dateTo, pageSize])

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedStamp !== 'Всі печатки' ||
    selectedInspector !== 'all' ||
    selectedPeriod !== 'all' ||
    dateFrom ||
    dateTo
  )

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedStamp('Всі печатки')
    setSelectedInspector('all')
    setSelectedPeriod('all')
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
  }

  // Merge in-memory workCards with DB queried cards so any fresh stamp is immediately visible
  const allStampedCards = useMemo(() => {
    const mergedMap = new Map()
    ;(dbStampedCards || []).forEach(c => {
      if (c?.id && String(c.card_info || '').includes('[QC_OPS:')) {
        mergedMap.set(c.id, c)
      }
    })
    ;(workCards || []).forEach(c => {
      if (c?.id && String(c.card_info || '').includes('[QC_OPS:')) {
        mergedMap.set(c.id, c)
      }
    })

    const result = []
    mergedMap.forEach(card => {
      const qcData = parseQcOpsStamps(card.card_info)
      const opsEntries = Object.entries(qcData?.ops || {})
      const sheetsApproved = Boolean(qcData?.sheets?.verified || qcData?.sheets?.approved)
      if (opsEntries.length === 0 && !sheetsApproved) return

      const order = ordersMap.get(card.order_id)
      const nom = nomMap.get(card.nomenclature_id)
      const machine = machinesMap.get(card.machine_id)

      const stampsSet = new Set()
      const inspectorsSet = new Set()

      if (qcData.lastStamp) stampsSet.add(qcData.lastStamp)
      if (qcData.lastInspector) inspectorsSet.add(qcData.lastInspector)
      if (qcData.sheets?.stamp) stampsSet.add(qcData.sheets.stamp)
      if (qcData.sheets?.inspector) inspectorsSet.add(qcData.sheets.inspector)

      const opsList = opsEntries.map(([key, val]) => {
        if (val?.stamp) stampsSet.add(val.stamp)
        if (val?.inspector) inspectorsSet.add(val.inspector)
        return {
          key,
          name: val?.name || key,
          side: val?.side || '',
          stamp: val?.stamp || qcData.lastStamp || 'ВКЯ',
          inspector: val?.inspector || qcData.lastInspector || '',
          at: val?.at || '',
        }
      })

      const seqNum = extractCardSequence(card.card_info)
      const shortHex = String(card.id || '').slice(0, 8).toUpperCase()
      const updatedAt = qcData.updatedAt || card.updated_at || card.created_at

      result.push({
        card,
        qcData,
        opsList,
        sheetsApproved,
        sheetsInfo: qcData?.sheets || null,
        stamps: Array.from(stampsSet).filter(Boolean),
        inspectors: Array.from(inspectorsSet).filter(Boolean),
        lastStamp: qcData.lastStamp || Array.from(stampsSet)[0] || 'ВКЯ',
        lastInspector: qcData.lastInspector || Array.from(inspectorsSet)[0] || '—',
        orderNum: order?.order_num || '—',
        nomName: nom?.name || card.nomenclature_id || 'Деталь',
        machineName: machine?.name || card.machine || card.machine_name || '—',
        seqNum,
        shortHex,
        updatedAt,
      })
    })

    return result.sort((a, b) => {
      const tA = new Date(a.updatedAt || 0).getTime()
      const tB = new Date(b.updatedAt || 0).getTime()
      return tB - tA
    })
  }, [dbStampedCards, workCards, ordersMap, nomMap, machinesMap])

  // Enrich history logs
  const enrichedHistory = useMemo(() => {
    const cardsMap = new Map()
    ;(workCards || []).forEach(c => cardsMap.set(c.id, c))
    ;(dbStampedCards || []).forEach(c => {
      if (!cardsMap.has(c.id)) cardsMap.set(c.id, c)
    })

    return (historyLogs || []).map(row => {
      const linkedCard = cardsMap.get(row.card_id)
      const qcData = parseQcOpsStamps(row.card_info || linkedCard?.card_info || '')
      const opsEntries = Object.entries(qcData?.ops || {})
      const sheetsApproved = Boolean(qcData?.sheets?.verified || qcData?.sheets?.approved)

      const order = ordersMap.get(row.order_id || linkedCard?.order_id)
      const nom = nomMap.get(row.nomenclature_id || linkedCard?.nomenclature_id)
      const shortHex = String(row.card_id || '').slice(0, 8).toUpperCase()
      const seqNum = extractCardSequence(row.card_info || linkedCard?.card_info)

      const rawOp = String(row.operator_name || '')
      const parts = rawOp.split('·').map(s => s.trim())
      const stampLabel = parts[0] || qcData?.lastStamp || 'ВКЯ'
      const inspectorLabel = parts[1] || qcData?.lastInspector || rawOp || '—'

      return {
        id: row.id,
        cardId: row.card_id,
        linkedCard,
        completedAt: row.completed_at || row.created_at,
        stampLabel,
        inspectorLabel,
        orderNum: order?.order_num || '—',
        nomName: nom?.name || row.nomenclature_id || 'Деталь',
        machineName: row.machine_name || linkedCard?.machine || linkedCard?.machine_name || '—',
        shortHex,
        seqNum,
        sheetsApproved,
        opsList: opsEntries.map(([key, val]) => ({
          key,
          name: val?.name || key,
          side: val?.side || '',
          stamp: val?.stamp || stampLabel,
          inspector: val?.inspector || inspectorLabel,
          at: val?.at || '',
        })),
        comment: row.qc_scrap_comment || '',
      }
    })
  }, [historyLogs, workCards, dbStampedCards, ordersMap, nomMap])

  // Unique inspectors for dropdown
  const uniqueInspectors = useMemo(() => {
    const set = new Set()
    allStampedCards.forEach(item => {
      item.inspectors.forEach(i => {
        if (i && i !== '—') set.add(i)
      })
    })
    enrichedHistory.forEach(h => {
      if (h.inspectorLabel && h.inspectorLabel !== '—') set.add(h.inspectorLabel)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uk'))
  }, [allStampedCards, enrichedHistory])

  // Filtered cards
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allStampedCards.filter(item => {
      if (selectedStamp !== 'Всі печатки' && !item.stamps.includes(selectedStamp)) {
        return false
      }
      if (selectedInspector !== 'all' && !item.inspectors.includes(selectedInspector)) {
        return false
      }
      if (!isWithinDateFilter(item.updatedAt, selectedPeriod, dateFrom, dateTo)) {
        return false
      }
      if (q) {
        const hay = [
          item.shortHex,
          item.seqNum,
          item.orderNum,
          item.nomName,
          item.machineName,
          ...item.stamps,
          ...item.inspectors,
          ...item.opsList.map(o => o.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allStampedCards, searchQuery, selectedStamp, selectedInspector, selectedPeriod, dateFrom, dateTo])

  // Filtered history
  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return enrichedHistory.filter(item => {
      if (selectedStamp !== 'Всі печатки' && item.stampLabel !== selectedStamp) {
        return false
      }
      if (selectedInspector !== 'all' && item.inspectorLabel !== selectedInspector) {
        return false
      }
      if (!isWithinDateFilter(item.completedAt, selectedPeriod, dateFrom, dateTo)) {
        return false
      }
      if (q) {
        const hay = [
          item.shortHex,
          item.seqNum,
          item.orderNum,
          item.nomName,
          item.machineName,
          item.stampLabel,
          item.inspectorLabel,
          item.comment,
          ...item.opsList.map(o => o.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enrichedHistory, searchQuery, selectedStamp, selectedInspector, selectedPeriod, dateFrom, dateTo])

  // Pagination calculations
  const activeDataset = activeTab === 'cards' ? filteredCards : filteredHistory
  const totalItems = activeDataset.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const paginatedCards = useMemo(
    () => filteredCards.slice(startIndex, startIndex + pageSize),
    [filteredCards, startIndex, pageSize]
  )

  const paginatedHistory = useMemo(
    () => filteredHistory.slice(startIndex, startIndex + pageSize),
    [filteredHistory, startIndex, pageSize]
  )

  const pageNumbers = useMemo(
    () => buildPageNumbers(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages]
  )

  // KPI metrics
  const kpiStats = useMemo(() => {
    const totalCards = filteredCards.length
    const totalOps = filteredCards.reduce((acc, c) => acc + c.opsList.length, 0)
    const sheetsConfirmed = filteredCards.filter(c => c.sheetsApproved).length
    const activeInspectors = new Set()
    filteredCards.forEach(c => c.inspectors.forEach(i => activeInspectors.add(i)))
    return {
      totalCards,
      totalOps,
      sheetsConfirmed,
      inspectorsCount: activeInspectors.size,
    }
  }, [filteredCards])

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
        className="brak-journal-modal-content"
        style={{
          background: 'var(--modal-bg, #0d0f12)',
          color: 'var(--text-color, #fff)',
          width: '100%',
          maxWidth: '1280px',
          height: 'min(94dvh, 900px)',
          maxHeight: 'calc(100dvh - 16px)',
          borderRadius: '24px',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 26px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,78,59,0.04) 100%)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                fontSize: '1.35rem',
              }}
            >
              💮
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 950, letterSpacing: '0.3px', color: 'var(--text-color, #fff)' }}>
                ЖУРНАЛ ПЕЧАТОК ВКЯ · ОБЛІК ПЕРЕВІРЕНИХ КАРТОК ТА ОПЕРАЦІЙ
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, marginTop: '3px' }}>
                Реєстр усіх робочих карток, де контролери ВКЯ підтвердили відповідність листів та погодили технологічні операції
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={loadJournalData}
              disabled={isLoading}
              style={{
                padding: '9px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
              {isLoading ? 'ОНОВЛЕННЯ...' : 'ОНОВИТИ'}
            </button>
            <button
              onClick={onClose}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                background: 'var(--card-inner-bg, rgba(148,163,184,0.08))',
                color: 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div
          className="brak-journal-kpi-cards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            padding: '14px 26px',
            background: 'var(--card-inner-bg, rgba(148,163,184,0.04))',
            borderBottom: '1px solid var(--border-color, rgba(148,163,184,0.15))',
          }}
        >
          <div className="brak-kpi-journal-card brak-kpi-journal-cards" style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCheck2 size={24} color="#10b981" />
            <div>
              <div className="kpi-label" style={{ fontSize: '0.65rem', fontWeight: 850, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Перевірено карток</div>
              <div className="kpi-val" style={{ fontSize: '1.35rem', fontWeight: 950, color: '#10b981' }}>{kpiStats.totalCards}</div>
            </div>
          </div>

          <div className="brak-kpi-journal-card brak-kpi-journal-ops" style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckSquare size={24} color="#3b82f6" />
            <div>
              <div className="kpi-label" style={{ fontSize: '0.65rem', fontWeight: 850, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Погоджено операцій</div>
              <div className="kpi-val" style={{ fontSize: '1.35rem', fontWeight: 950, color: '#3b82f6' }}>{kpiStats.totalOps}</div>
            </div>
          </div>

          <div className="brak-kpi-journal-card brak-kpi-journal-sheets" style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Layers size={24} color="#f59e0b" />
            <div>
              <div className="kpi-label" style={{ fontSize: '0.65rem', fontWeight: 850, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Листи відповідають ✓</div>
              <div className="kpi-val" style={{ fontSize: '1.35rem', fontWeight: 950, color: '#f59e0b' }}>{kpiStats.sheetsConfirmed}</div>
            </div>
          </div>

          <div className="brak-kpi-journal-card brak-kpi-journal-inspectors" style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={24} color="#a855f7" />
            <div>
              <div className="kpi-label" style={{ fontSize: '0.65rem', fontWeight: 850, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Інспекторів ВКЯ</div>
              <div className="kpi-val" style={{ fontSize: '1.35rem', fontWeight: 950, color: '#a855f7' }}>{kpiStats.inspectorsCount}</div>
            </div>
          </div>
        </div>

        {/* Tabs + Filters Bar */}
        <div
          style={{
            padding: '12px 26px',
            borderBottom: '1px solid var(--border-color, rgba(148,163,184,0.15))',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Row 1: Mode Tabs + Search + Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--card-inner-bg, rgba(148,163,184,0.1))', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(148,163,184,0.2))' }}>
              <button
                onClick={() => setActiveTab('cards')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'cards' ? '#10b981' : 'transparent',
                  color: activeTab === 'cards' ? '#fff' : 'var(--text-muted, #64748b)',
                  fontSize: '0.76rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Stamp size={15} />
                Перевірені картки ({filteredCards.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'history' ? '#10b981' : 'transparent',
                  color: activeTab === 'history' ? '#fff' : 'var(--text-muted, #64748b)',
                  fontSize: '0.76rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={15} />
                Хронологія дій ({filteredHistory.length})
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 12px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                  background: 'var(--card-inner-bg, rgba(148,163,184,0.06))',
                  minWidth: '240px',
                }}
              >
                <Search size={15} color="#94a3b8" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Картка, наряд, деталь, операція, ПІБ..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-color, inherit)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    width: '100%',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={selectedStamp}
                onChange={e => setSelectedStamp(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                  background: 'var(--card-inner-bg, transparent)',
                  color: 'var(--text-color, inherit)',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  outline: 'none',
                }}
              >
                {STAMP_FILTER_OPTIONS.map(st => (
                  <option key={st} value={st} style={{ background: 'var(--modal-bg, #fff)', color: 'var(--text-color, #000)' }}>
                    {st}
                  </option>
                ))}
              </select>

              <select
                value={selectedInspector}
                onChange={e => setSelectedInspector(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                  background: 'var(--card-inner-bg, transparent)',
                  color: 'var(--text-color, inherit)',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  outline: 'none',
                }}
              >
                <option value="all" style={{ background: 'var(--modal-bg, #fff)', color: 'var(--text-color, #000)' }}>
                  Всі контролери ВКЯ
                </option>
                {uniqueInspectors.map(insp => (
                  <option key={insp} value={insp} style={{ background: 'var(--modal-bg, #fff)', color: 'var(--text-color, #000)' }}>
                    {insp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Quick Period + Custom Date Range + Reset */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {PERIOD_OPTIONS.map(p => {
                const isSelected = selectedPeriod === p.id && !dateFrom && !dateTo
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPeriod(p.id)
                      setDateFrom('')
                      setDateTo('')
                    }}
                    style={{
                      height: '32px',
                      padding: '0 11px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #10b981' : '1px solid var(--border-color, rgba(148,163,184,0.25))',
                      background: isSelected ? 'rgba(16, 185, 129, 0.16)' : 'var(--card-inner-bg, transparent)',
                      color: isSelected ? '#10b981' : 'var(--text-muted, #64748b)',
                      fontSize: '0.72rem',
                      fontWeight: 850,
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>Період:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                    background: 'var(--card-inner-bg, transparent)',
                    color: 'var(--text-color, inherit)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                />
                <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.72rem' }}>—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                    background: 'var(--card-inner-bg, transparent)',
                    color: 'var(--text-color, inherit)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  fontSize: '0.72rem',
                  fontWeight: 850,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <RotateCcw size={13} />
                Скинути фільтри
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 26px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeTab === 'cards' ? (
            paginatedCards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #64748b)' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>💮</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-color, #475569)' }}>
                  Перевірених карток за цими фільтрами ще немає
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                  Коли контролер ВКЯ ставить печатку на операціях картки, вона автоматично з&apos;являється у цьому журналі.
                </div>
              </div>
            ) : (
              paginatedCards.map(item => (
                <div
                  key={item.card.id}
                  className="brak-journal-card-row"
                  style={{
                    borderRadius: '16px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'var(--card-inner-bg, rgba(16, 185, 129, 0.03))',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Top Row: Card info + Stamp badges + Action button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.14)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#059669',
                            fontSize: '0.78rem',
                            fontWeight: 950,
                          }}
                        >
                          Картка #{item.shortHex} {item.seqNum ? `(№${item.seqNum})` : ''}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted, #64748b)' }}>
                          Наряд №{item.orderNum}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                          {item.machineName}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                          🕒 {formatDateTime(item.updatedAt)}
                        </span>
                      </div>

                      <div style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--text-color, inherit)', marginTop: '2px' }}>
                        {item.nomName}
                      </div>
                    </div>

                    {/* Right badges + Edit button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {item.stamps.map(st => (
                        <span
                          key={st}
                          style={{
                            padding: '5px 11px',
                            borderRadius: '999px',
                            background: '#ecfdf5',
                            border: '1.5px solid #10b981',
                            color: '#047857',
                            fontSize: '0.75rem',
                            fontWeight: 950,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          💮 {st}
                        </span>
                      ))}

                      <span
                        style={{
                          padding: '5px 11px',
                          borderRadius: '999px',
                          background: 'rgba(168, 85, 247, 0.12)',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                          color: '#9333ea',
                          fontSize: '0.74rem',
                          fontWeight: 850,
                        }}
                      >
                        👤 {item.inspectors.join(', ') || '—'}
                      </span>

                      {item.sheetsApproved ? (
                        <span
                          style={{
                            padding: '5px 11px',
                            borderRadius: '999px',
                            background: 'rgba(16, 185, 129, 0.14)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#059669',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                          }}
                        >
                          ✓ Листи відповідають ({item.sheetsInfo?.stamp || item.lastStamp})
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '5px 11px',
                            borderRadius: '999px',
                            background: 'rgba(148, 163, 184, 0.12)',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            color: 'var(--text-muted, #64748b)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                          }}
                        >
                          Листи не відмічено
                        </span>
                      )}

                      {typeof onOpenCardStampModal === 'function' && (
                        <button
                          onClick={() => onOpenCardStampModal(item.card)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: '1px solid #10b981',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#059669',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          💮 Відкрити / Змінити печатки
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selected Operations List */}
                  <div
                    className="brak-journal-ops-box"
                    style={{
                      background: 'var(--modal-bg, rgba(148, 163, 184, 0.06))',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      border: '1px solid var(--border-color, rgba(148,163,184,0.2))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                        Погоджені операції ВКЯ ({item.opsList.length}):
                      </div>
                      {item.opsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleCardExpanded(item.card.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#10b981',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            padding: '2px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {expandedCardIds.has(item.card.id) ? 'Згорнути ▴' : `Всі операції (${item.opsList.length}) ▾`}
                        </button>
                      )}
                    </div>

                    {item.opsList.length === 0 ? (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>
                        Відмічено лише відповідність листів (операції ще не обрано)
                      </div>
                    ) : (
                      (() => {
                        const isExpanded = expandedCardIds.has(item.card.id)
                        const displayedOps = isExpanded ? item.opsList : [item.opsList[item.opsList.length - 1]]
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {!isExpanded && item.opsList.length > 1 && (
                              <div style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 900, textTransform: 'uppercase' }}>
                                Остання дія:
                              </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {displayedOps.map(op => (
                                <div
                                  key={op.key}
                                  className="brak-journal-op-pill"
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {op.side && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0284c7', textTransform: 'uppercase' }}>
                                      [{op.side}]
                                    </span>
                                  )}
                                  <span style={{ fontWeight: 850, color: 'var(--text-color, inherit)' }}>
                                    {op.name}
                                  </span>
                                  <span
                                    style={{
                                      padding: '1px 6px',
                                      borderRadius: '999px',
                                      background: '#10b981',
                                      color: '#fff',
                                      fontSize: '0.64rem',
                                      fontWeight: 950,
                                    }}
                                  >
                                    {op.stamp}
                                  </span>
                                  {op.inspector && (
                                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                                      ({op.inspector}{op.at ? `, ${op.at}` : ''})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {!isExpanded && item.opsList.length > 1 && (
                              <div
                                onClick={() => toggleCardExpanded(item.card.id)}
                                style={{
                                  fontSize: '0.68rem',
                                  color: 'var(--text-muted, #64748b)',
                                  cursor: 'pointer',
                                  marginTop: '2px',
                                  userSelect: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>🔍</span>
                                <span>+ ще {item.opsList.length - 1} погоджених операцій (натисніть, щоб розгорнути всі)</span>
                              </div>
                            )}
                          </div>
                        )
                      })()
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            /* History Tab */
            paginatedHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #64748b)' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🕒</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-color, #475569)' }}>
                  Записів в історії дій за цими фільтрами не знайдено
                </div>
              </div>
            ) : (
              paginatedHistory.map(row => (
                <div
                  key={row.id}
                  style={{
                    borderRadius: '14px',
                    border: '1px solid var(--border-color, rgba(148,163,184,0.22))',
                    background: 'var(--card-inner-bg, rgba(148,163,184,0.04))',
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#059669' }}>
                        🕒 {formatDateTime(row.completedAt)}
                      </span>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: '#ecfdf5',
                          border: '1px solid #10b981',
                          color: '#047857',
                          fontSize: '0.72rem',
                          fontWeight: 950,
                        }}
                      >
                        💮 {row.stampLabel}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#9333ea' }}>
                        👤 {row.inspectorLabel}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--text-color, inherit)' }}>
                        · Картка #{row.shortHex} {row.seqNum ? `(№${row.seqNum})` : ''}
                      </span>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
                        · Наряд №{row.orderNum} · {row.nomName}
                      </span>
                    </div>

                    {row.linkedCard && typeof onOpenCardStampModal === 'function' && (
                      <button
                        onClick={() => onOpenCardStampModal(row.linkedCard)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#059669',
                          fontSize: '0.7rem',
                          fontWeight: 850,
                          cursor: 'pointer',
                        }}
                      >
                        Відкрити картку
                      </button>
                    )}
                  </div>

                  {row.comment && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-color, inherit)',
                        fontWeight: 700,
                        background: 'var(--modal-bg, rgba(148,163,184,0.06))',
                        border: '1px solid var(--border-color, rgba(148,163,184,0.18))',
                        padding: '8px 12px',
                        borderRadius: '8px',
                      }}
                    >
                      {row.comment}
                    </div>
                  )}

                  {row.opsList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {row.opsList.map(op => (
                        <span
                          key={op.key}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#059669',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                          }}
                        >
                          {op.side ? `[${op.side}] ` : ''}{op.name} ({op.stamp})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '12px 26px',
            borderTop: '1px solid var(--border-color, rgba(148,163,184,0.2))',
            background: 'var(--card-inner-bg, rgba(148,163,184,0.04))',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Left: Range summary + Page size selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
              {totalItems > 0
                ? `Показано ${startIndex + 1}–${endIndex} із ${totalItems} записів`
                : 'Записів: 0'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                На сторінці:
              </span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value) || 20)}
                style={{
                  height: '30px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                  background: 'var(--modal-bg, transparent)',
                  color: 'var(--text-color, inherit)',
                  fontSize: '0.74rem',
                  fontWeight: 850,
                  outline: 'none',
                }}
              >
                {PAGE_SIZE_OPTIONS.map(sz => (
                  <option key={sz} value={sz} style={{ background: 'var(--modal-bg, #fff)', color: 'var(--text-color, #000)' }}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Page Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              title="Перша сторінка"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                background: 'var(--modal-bg, transparent)',
                color: 'var(--text-color, inherit)',
                cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage <= 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronsLeft size={15} />
            </button>

            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                background: 'var(--modal-bg, transparent)',
                color: 'var(--text-color, inherit)',
                fontSize: '0.74rem',
                fontWeight: 850,
                cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage <= 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ChevronLeft size={14} />
              Попередня
            </button>

            {pageNumbers.map((page, idx) =>
              page === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  style={{ padding: '0 6px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    border: safeCurrentPage === page ? '1px solid #10b981' : '1px solid var(--border-color, rgba(148,163,184,0.25))',
                    background: safeCurrentPage === page ? '#10b981' : 'var(--modal-bg, transparent)',
                    color: safeCurrentPage === page ? '#fff' : 'var(--text-color, inherit)',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                background: 'var(--modal-bg, transparent)',
                color: 'var(--text-color, inherit)',
                fontSize: '0.74rem',
                fontWeight: 850,
                cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage >= totalPages ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Наступна
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              title="Остання сторінка"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(148,163,184,0.25))',
                background: 'var(--modal-bg, transparent)',
                color: 'var(--text-color, inherit)',
                cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage >= totalPages ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronsRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
