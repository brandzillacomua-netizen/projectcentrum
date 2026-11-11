import React, { useState, useMemo } from 'react'
import {
  Cpu,
  Clock,
  PauseCircle,
  Wrench,
  Users,
  Layers,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  Filter,
  Search,
  ChevronRight,
  ChevronDown,
  Hammer,
  ShieldAlert,
  ArrowUpDown,
  RefreshCw,
  X
} from 'lucide-react'
import { compareMachinesBySequenceNumber, formatDurationSec } from '../hooks/useMachinesReport'
import { CardCommentsBadge, CardCommentsModal } from '../../../components/common/CardCommentsBadge.jsx'

const formatDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function MachinesReportView({
  machineReport,
  startDate,
  endDate,
  isSyncing
}) {
  const {
    machineAnalytics,
    filteredMachines,
    machineTypes,
    selectedMachineType,
    setSelectedMachineType,
    selectedMachineId,
    setSelectedMachineId,
    selectedMachineStat,
    totals,
    ordersById,
    tasksById,
    nomsById,
    workCardsById
  } = machineReport

  const [activeSubTab, setActiveSubTab] = useState('overview') // 'overview' | 'cards' | 'maintenance'
  const [selectedCardForComments, setSelectedCardForComments] = useState(null)
  const [selectedMachineForMaintenance, setSelectedMachineForMaintenance] = useState(null)
  const [cardSearch, setCardSearch] = useState('')
  const [operatorFilter, setOperatorFilter] = useState('all')
  const [sortBy, setSortBy] = useState('totalWorkSec') // 'totalWorkSec' | 'totalPauseSec' | 'cardsCount' | 'name'
  const [sortAsc, setSortAsc] = useState(false)

  // 1. Unique operators in currently selected machine(s)
  const currentOperators = useMemo(() => {
    if (selectedMachineStat) {
      return selectedMachineStat.operatorsList || []
    }
    return totals?.operatorsList || []
  }, [selectedMachineStat, totals])

  // 2. Filtered and Sorted Machine Analytics List (for Overview)
  const sortedMachineStats = useMemo(() => {
    const list = [...(machineAnalytics || [])].filter(m => {
      if (!m) return false

      // Фільтр за типом верстата
      if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) {
        return false
      }

      // Фільтр за конкретно обраним верстатом
      if (selectedMachineId !== 'all' && String(m.id) !== String(selectedMachineId)) {
        return false
      }

      // Фільтр за обраним оператором
      if (operatorFilter !== 'all') {
        const hasOp = (m.operatorsList || []).some(op => op === operatorFilter)
        if (!hasOp) return false
      }

      // Пошуковий рядок (пошук верстата за назвою, номером, типом або оператором)
      if (cardSearch && cardSearch.trim()) {
        const q = cardSearch.toLowerCase().trim()
        const matchName = String(m.name || '').toLowerCase().includes(q)
        const matchSeq = String(m.sequence_number || '').toLowerCase().includes(q)
        const matchType = String(m.type || '').toLowerCase().includes(q)
        const matchOp = (m.operatorsList || []).some(op => op.toLowerCase().includes(q))
        if (!matchName && !matchSeq && !matchType && !matchOp) return false
      }

      return true
    })

    list.sort((a, b) => {
      let valA = a[sortBy] || 0
      let valB = b[sortBy] || 0
      if (sortBy === 'name') {
        const nameDiff = sortAsc
          ? (a.name || '').localeCompare(b.name || '', 'uk-UA')
          : (b.name || '').localeCompare(a.name || '', 'uk-UA')
        if (nameDiff !== 0) return nameDiff
        return sortAsc
          ? compareMachinesBySequenceNumber(a, b)
          : compareMachinesBySequenceNumber(b, a)
      }
      return sortAsc ? valA - valB : valB - valA
    })

    return list
  }, [machineAnalytics, selectedMachineType, selectedMachineId, operatorFilter, cardSearch, sortBy, sortAsc])

  // 3. Filtered Cards List (for Cards tab or Detail View)
  const displayCards = useMemo(() => {
    let cards = []
    if (selectedMachineStat) {
      const fallbackMachineName = selectedMachineStat.fullName || (selectedMachineStat.name + (selectedMachineStat.sequence_number ? ` №${selectedMachineStat.sequence_number}` : ''))
      cards = (selectedMachineStat.cards || []).map(c => ({
        ...c,
        machineName: c.machineName || fallbackMachineName,
        machineType: selectedMachineStat.type
      }))
    } else {
      // All cards across filtered machines
      (machineAnalytics || []).forEach(m => {
        if (!m) return
        if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) return
        const fallbackMachineName = m.fullName || (m.name + (m.sequence_number ? ` №${m.sequence_number}` : ''))
        cards.push(...(m.cards || []).map(c => ({
          ...c,
          machineName: c.machineName || fallbackMachineName,
          machineType: m.type
        })))
      })
    }

    return cards.filter(c => {
      if (!c) return false
      if (operatorFilter !== 'all') {
        const hasOp = (c.operators || [c.operator_name]).some(op => op === operatorFilter)
        if (!hasOp) return false
      }
      if (cardSearch) {
        const q = cardSearch.toLowerCase()
        const order = ordersById?.get?.(String(c.task_id ? tasksById?.get?.(String(c.task_id))?.order_id : ''))
        const nom = nomsById?.get?.(String(c.nomenclature_id))
        const matchCard = String(c.card_id || '').toLowerCase().includes(q)
        const matchNom = (nom?.name || '').toLowerCase().includes(q)
        const matchOrder = (order?.order_num || '').toLowerCase().includes(q)
        const matchOp = (c.operator_name || '').toLowerCase().includes(q)
        const matchMachine = (c.machineName || '').toLowerCase().includes(q)
        return matchCard || matchNom || matchOrder || matchOp || matchMachine
      }
      return true
    }).sort((a, b) => {
      const tA = new Date(a.completed_at || a.started_at || a.created_at || 0).getTime()
      const tB = new Date(b.completed_at || b.started_at || b.created_at || 0).getTime()
      return tB - tA
    })
  }, [selectedMachineStat, machineAnalytics, selectedMachineType, operatorFilter, cardSearch, ordersById, tasksById, nomsById])

  // 4. Filtered Maintenance Logs
  const displayMaintenanceLogs = useMemo(() => {
    let logs = []
    if (selectedMachineStat) {
      const fallbackMachineName = selectedMachineStat.fullName || (selectedMachineStat.name + (selectedMachineStat.sequence_number ? ` №${selectedMachineStat.sequence_number}` : ''))
      logs = (selectedMachineStat.maintenanceLogs || []).map(l => ({
        ...l,
        machineName: l.machineName || fallbackMachineName,
        machineType: selectedMachineStat.type
      }))
    } else {
      (machineAnalytics || []).forEach(m => {
        if (!m) return
        if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) return
        const fallbackMachineName = m.fullName || (m.name + (m.sequence_number ? ` №${m.sequence_number}` : ''))
        logs.push(...(m.maintenanceLogs || []).map(l => ({
          ...l,
          machineName: l.machineName || fallbackMachineName,
          machineType: m.type
        })))
      })
    }
    return logs.sort((a, b) => new Date(b.triggered_at || 0) - new Date(a.triggered_at || 0))
  }, [selectedMachineStat, machineAnalytics, selectedMachineType])

  return (
    <div className="machines-report-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── TOP FILTER BAR ── */}
      <div className="glass-panel machines-filter-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          {/* Subtab Selector */}
          <div className="machines-subtabs-bar">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`machines-subtab-btn ${activeSubTab === 'overview' ? 'is-active' : ''}`}
            >
              <Cpu size={14} /> ОГЛЯД ВЕРСТАТІВ
            </button>
            <button
              onClick={() => setActiveSubTab('cards')}
              className={`machines-subtab-btn ${activeSubTab === 'cards' ? 'is-active' : ''}`}
            >
              <Layers size={14} /> ЖУРНАЛ КАРТ ({displayCards.length})
            </button>
            <button
              onClick={() => setActiveSubTab('maintenance')}
              className={`machines-subtab-btn ${activeSubTab === 'maintenance' ? 'is-active' : ''}`}
            >
              <Wrench size={14} /> ОБСЛУГОВУВАННЯ ТО ({displayMaintenanceLogs.length})
            </button>
          </div>

          {/* Machine Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="machines-select-label">ТИП:</span>
            <select
              value={selectedMachineType}
              onChange={(e) => {
                setSelectedMachineType(e.target.value)
                setSelectedMachineId('all')
              }}
              className={`machines-filter-select ${selectedMachineType !== 'all' ? 'is-active' : ''}`}
            >
              <option value="all">Всі типи ({machineTypes.length})</option>
              {machineTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Specific Machine Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="machines-select-label">ВЕРСТАТ:</span>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className={`machines-filter-select ${selectedMachineId !== 'all' ? 'is-active' : ''}`}
            >
              <option value="all">Усі верстати ({filteredMachines.length})</option>
              {filteredMachines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.sequence_number ? `(№${m.sequence_number})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operator Filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} className="machines-cell-dim" />
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className={`machines-filter-select ${operatorFilter !== 'all' ? 'is-active' : ''}`}
            >
              <option value="all">Всі оператори</option>
              {currentOperators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} className="machines-cell-dim" />
            <input
              type="text"
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder={activeSubTab === 'overview' ? "Пошук верстата / оператора..." : "Пошук картки / деталі..."}
              className="machines-search-input"
            />
          </div>

          {(selectedMachineId !== 'all' || selectedMachineType !== 'all' || operatorFilter !== 'all' || cardSearch.trim() !== '') && (
            <button
              onClick={() => {
                setSelectedMachineId('all')
                setSelectedMachineType('all')
                setOperatorFilter('all')
                setCardSearch('')
              }}
              className="machines-reset-btn"
              title="Скинути всі активні фільтри"
            >
              Скинути вибір
            </button>
          )}
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="machines-kpi-grid">
        {/* 1. Working Time */}
        <div className="glass-panel machines-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="machines-kpi-title">
              Час чистої різки
            </span>
            <Clock size={16} color="#10b981" />
          </div>
          <div className="machines-kpi-value" style={{ color: '#10b981' }}>
            {formatDurationSec(totals.totalWorkSec)}
          </div>
          <div className="machines-kpi-sub">
            {totals.totalCardsCount} карт порізано
          </div>
        </div>

        {/* 2. Pause Time */}
        <div className="glass-panel machines-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="machines-kpi-title">
              Час на паузах
            </span>
            <PauseCircle size={16} color="#3b82f6" />
          </div>
          <div className="machines-kpi-value" style={{ color: '#3b82f6' }}>
            {formatDurationSec(totals.totalPauseSec)}
          </div>
          <div className="machines-kpi-sub">
            {totals.totalPauseCount} зупинок ({totals.pausePercentage}% від часу)
          </div>
        </div>

        {/* 3. Maintenance (TO) */}
        <div className="glass-panel machines-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="machines-kpi-title">
              Обслуговування ТО
            </span>
            <Wrench size={16} color="#f59e0b" />
          </div>
          <div className="machines-kpi-value" style={{ color: '#f59e0b' }}>
            {totals.totalMaintenanceCount} разів
          </div>
          <div className="machines-kpi-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {Object.keys(totals?.globalMaintenanceTypes || {}).length > 0
              ? Object.entries(totals?.globalMaintenanceTypes || {}).map(([k, v]) => `${k} (${v})`).slice(0, 2).join(', ')
              : 'Записів ТО немає'}
          </div>
        </div>

        {/* 4. Production Output */}
        <div className="glass-panel machines-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="machines-kpi-title">
              Випуск деталей
            </span>
            <Layers size={16} color="#ff9000" />
          </div>
          <div className="machines-kpi-value" style={{ color: '#ff9000' }}>
            {totals?.totalProducedQty?.toLocaleString() || 0} шт
          </div>
          <div className="machines-kpi-sub">
            {totals?.totalSheets || 0} листів розкроєно
          </div>
        </div>

        {/* 5. Operators & Scrap */}
        <div className="glass-panel machines-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="machines-kpi-title">
              Оператори / Брак
            </span>
            <Users size={16} color="#a855f7" />
          </div>
          <div className="machines-kpi-value" style={{ color: '#a855f7' }}>
            {totals?.uniqueOperatorsCount || 0} чол.
          </div>
          <div className="machines-kpi-sub" style={{ color: (totals?.totalScrapQty || 0) > 0 ? '#ef4444' : '#10b981' }}>
            Брак: {totals?.totalScrapQty || 0} шт {(totals?.totalProducedQty || 0) > 0 ? `(${(((totals?.totalScrapQty || 0) / totals.totalProducedQty) * 100).toFixed(1)}%)` : ''}
          </div>
        </div>
      </div>

      {/* ── PAUSE REASONS BREAKDOWN PILLS (If any) ── */}
      {Object.keys(totals?.globalPauseReasons || {}).length > 0 && (
        <div className="machines-pause-box">
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PauseCircle size={14} /> Причини пауз:
          </span>
          {Object.entries(totals?.globalPauseReasons || {}).map(([reason, sec]) => (
            <span key={reason} className="machines-pause-pill">
              <strong>{reason}:</strong>
              <span style={{ color: '#3b82f6', fontWeight: 800 }}>{formatDurationSec(sec)}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── SUBTAB 1: MACHINES OVERVIEW TABLE ── */}
      {activeSubTab === 'overview' && (
        <div className="glass-panel machines-table-card">
          <div className="machines-table-header">
            <div>
              <h3>
                <Cpu size={18} color="#ff9000" />
                РЕЙТИНГ ТА ЗАВАНТАЖЕННЯ ВЕРСТАТІВ ({sortedMachineStats.length})
                {selectedMachineStat && <span style={{ color: '#ff9000' }}> • {selectedMachineStat.name}</span>}
              </h3>
              <div className="machines-cell-dim" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                {selectedMachineStat
                  ? 'Показано показники обраного верстата. Клікніть «Карти» для переходу в журнал.'
                  : 'Клікніть на рядок верстата для перегляду його карток'}
              </div>
            </div>

            {selectedMachineStat && (
              <button
                onClick={() => setSelectedMachineId('all')}
                className="machines-action-btn"
                style={{ padding: '6px 14px' }}
              >
                Показати всі верстати
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="machines-table">
              <thead>
                <tr className="machines-thead-row">
                  <th style={{ cursor: 'pointer' }} onClick={() => { setSortBy('name'); setSortAsc(!sortAsc) }}>
                    Верстат {sortBy === 'name' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th>Тип</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', color: '#10b981' }} onClick={() => { setSortBy('totalWorkSec'); setSortAsc(!sortAsc) }}>
                    Час різки {sortBy === 'totalWorkSec' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', color: '#3b82f6' }} onClick={() => { setSortBy('totalPauseSec'); setSortAsc(!sortAsc) }}>
                    Паузи {sortBy === 'totalPauseSec' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th style={{ textAlign: 'center', color: '#f59e0b' }}>ТО (к-сть)</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => { setSortBy('cardsCount'); setSortAsc(!sortAsc) }}>
                    Карт / Деталей {sortBy === 'cardsCount' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th style={{ textAlign: 'right' }}>Листів</th>
                  <th>Оператори</th>
                  <th style={{ textAlign: 'center' }}>Дія</th>
                </tr>
              </thead>
              <tbody>
                {sortedMachineStats.map(m => {
                  const isSelected = String(selectedMachineId) === String(m.id)
                  const hasMaintenance = m.maintenanceLogs.length > 0
                  return (
                    <tr
                      key={m.id}
                      onClick={() => {
                        setSelectedMachineId(m.id)
                        setActiveSubTab('cards')
                      }}
                      className={`machines-tr ${isSelected ? 'is-selected' : ''}`}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: m.status === 'repair' ? '#ef4444' : (m.cards.some(c => c.is_active) ? '#10b981' : '#71717a')
                          }} />
                          <span className="machines-name-text">
                            {m.name} {m.sequence_number ? `№${m.sequence_number}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="machines-cell-dim" style={{ padding: '12px 16px', fontSize: '0.78rem' }}>
                        {m.type}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        {formatDurationSec(m.totalWorkSec)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: m.totalPauseSec > 0 ? '#3b82f6' : 'var(--text-muted, #71717a)' }}>
                        {formatDurationSec(m.totalPauseSec)}
                        {m.pauseCount > 0 && <small className="machines-cell-dim" style={{ display: 'block', fontSize: '0.7rem' }}>({m.pauseCount} зуп.)</small>}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {hasMaintenance ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedMachineForMaintenance(m)
                            }}
                            title={`Клікніть, щоб переглянути проведене ТО (${m.maintenanceLogs.length})`}
                            style={{
                              background: 'rgba(245, 158, 11, 0.18)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.45)',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontWeight: 900,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease-in-out',
                              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.18)' }}
                          >
                            <Wrench size={12} />
                            <span>{m.maintenanceLogs.length}</span>
                          </button>
                        ) : (
                          <span className="machines-cell-dim">—</span>
                        )}
                      </td>
                      <td className="machines-cell-strong" style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {m.cardsCount} карт <small className="machines-cell-dim">({m.producedQty} дет.)</small>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#ff9000' }}>
                        {m.sheetsCount > 0 ? `${m.sheetsCount} л.` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {(m.operatorsList || []).length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(m.operatorsList || []).map(op => (
                              <span key={op} className="machines-op-badge">
                                {op}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="machines-cell-dim">—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button className="machines-action-btn">
                          Карти <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {sortedMachineStats.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }} className="machines-cell-dim">
                      За обраними фільтрами верстатів не знайдено.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBTAB 2: DETAILED WORK CARDS JOURNAL ── */}
      {activeSubTab === 'cards' && (
        <div className="glass-panel machines-table-card">
          <div className="machines-table-header">
            <div>
              <h3>
                <Layers size={18} color="#ff9000" />
                ЖУРНАЛ КАРТ РОЗКРОЮ ТА ОПЕРАТОРІВ
                {selectedMachineStat && (
                  <span style={{ color: '#ff9000' }}>
                    {' '}• {selectedMachineStat.fullName || (selectedMachineStat.name + (selectedMachineStat.sequence_number ? ` №${selectedMachineStat.sequence_number}` : ''))}
                  </span>
                )}
              </h3>
              <div className="machines-cell-dim" style={{ fontSize: '0.75rem', marginTop: '3px' }}>
                Всього знайдено карток: {displayCards.length}
              </div>
            </div>

            {selectedMachineStat && (
              <button
                onClick={() => setSelectedMachineId('all')}
                className="machines-action-btn"
                style={{ padding: '6px 14px' }}
              >
                Показати карти всіх верстатів
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="machines-table">
              <thead>
                <tr className="machines-thead-row">
                  <th>Статус / Час</th>
                  <th>Верстат</th>
                  <th>Картка / Наряд</th>
                  <th>Номенклатура / Деталь</th>
                  <th>Оператор</th>
                  <th style={{ textAlign: 'right', color: '#10b981' }}>Час різки</th>
                  <th style={{ color: '#3b82f6' }}>Пауза на картці</th>
                  <th style={{ textAlign: 'right' }}>Випуск / Брак</th>
                </tr>
              </thead>
              <tbody>
                {displayCards.map(c => {
                  const task = c.task_id ? tasksById?.get?.(String(c.task_id)) : null
                  const order = task?.order_id ? ordersById?.get?.(String(task.order_id)) : null
                  const nom = c.nomenclature_id ? nomsById?.get?.(String(c.nomenclature_id)) : null
                  const hasPause = c.pauseSec > 0 || (c.pauseReasons || []).length > 0 || c.is_paused

                  return (
                    <tr key={`${c.card_id}_${c.id}`} className="machines-tr" style={{ cursor: 'default' }}>
                      <td style={{ padding: '12px 16px' }}>
                        {c.is_paused ? (
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.72rem' }}>
                            ⏸ НА ПАУЗІ
                          </span>
                        ) : c.is_active ? (
                          <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.72rem' }}>
                            ▶ В РОБОТІ
                          </span>
                        ) : (
                          <span className="machines-cell-dim" style={{ fontSize: '0.75rem' }}>
                            {formatDateTime(c.completed_at || c.created_at)}
                          </span>
                        )}
                      </td>
                      <td className="machines-name-text" style={{ padding: '12px 16px' }}>
                        {c.machineName || selectedMachineStat?.fullName || (selectedMachineStat ? `${selectedMachineStat.name}${selectedMachineStat.sequence_number ? ` №${selectedMachineStat.sequence_number}` : ''}` : '—')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          const realCard = workCardsById?.get?.(String(c.card_id || c.id)) || c
                          const cardInfo = realCard?.card_info || c.card_info || ''
                          const cardForModal = {
                            ...c,
                            ...realCard,
                            id: c.card_id || c.id,
                            card_info: cardInfo,
                            operator_name: c.operator_name || realCard?.operator_name
                          }

                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, color: '#ff9000' }}>
                                  #{String(c.card_id || c.id).slice(0, 8)}
                                </span>
                                <CardCommentsBadge
                                  card={cardForModal}
                                  cardInfo={cardInfo}
                                  onClick={() => setSelectedCardForComments(cardForModal)}
                                />
                              </div>
                              <small className="machines-cell-dim">
                                {order?.order_num ? `Наряд №${order.order_num}` : '—'}
                              </small>
                            </>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="machines-cell-strong">
                          {nom?.name || '—'}
                        </div>
                        {c.sheets > 0 && (
                          <small className="machines-cell-dim">Листів: {c.sheets} шт</small>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={13} color="#a855f7" />
                          <span className="machines-name-text">
                            {(c.operators && c.operators.length > 0)
                              ? c.operators.join(', ')
                              : (c.operator_name && c.operator_name !== 'Команда' ? c.operator_name : 'Не вказано')}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        {formatDurationSec(c.workSec)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {hasPause ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{
                              background: 'rgba(59,130,246,0.15)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59,130,246,0.3)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ⏸ {formatDurationSec(c.pauseSec)}
                            </span>
                            {(c.pauseReasons || []).length > 0 && (
                              <small style={{ color: '#93c5fd', fontSize: '0.7rem' }}>
                                {(c.pauseReasons || []).map(r => r.reason).join(', ')}
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="machines-cell-dim" style={{ fontSize: '0.75rem' }}>Без пауз</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div className="machines-name-text">
                          {c.qty_completed} шт
                        </div>
                        {c.scrap_qty > 0 && (
                          <small style={{ color: '#ef4444', fontWeight: 700 }}>
                            Брак: {c.scrap_qty} шт
                          </small>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {displayCards.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }} className="machines-cell-dim">
                      За обраний період карток на цьому верстаті не знайдено.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBTAB 3: MAINTENANCE (TO) LOGS ── */}
      {activeSubTab === 'maintenance' && (
        <div className="glass-panel machines-table-card">
          <div className="machines-table-header">
            <h3>
              <Wrench size={18} color="#f59e0b" />
              ЖУРНАЛ ОБСЛУГОВУВАННЯ ВЕРСТАТІВ (ТО) ({displayMaintenanceLogs.length})
            </h3>
            <div className="machines-cell-dim" style={{ fontSize: '0.75rem' }}>
              Період: {startDate || '—'} по {endDate || '—'}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="machines-table">
              <thead>
                <tr className="machines-thead-row">
                  <th>Дата / Час</th>
                  <th>Верстат</th>
                  <th>Вид обслуговування</th>
                  <th>Голова / Вузол</th>
                  <th>Хто виконував</th>
                  <th>Примітки</th>
                </tr>
              </thead>
              <tbody>
                {displayMaintenanceLogs.map(log => (
                  <tr key={log.id} className="machines-tr" style={{ cursor: 'default' }}>
                    <td className="machines-cell-dim" style={{ padding: '12px 16px' }}>
                      {formatDateTime(log.triggered_at || log.created_at)}
                    </td>
                    <td className="machines-name-text" style={{ padding: '12px 16px' }}>
                      {log.machineName || selectedMachineStat?.fullName || (selectedMachineStat ? `${selectedMachineStat.name}${selectedMachineStat.sequence_number ? ` №${selectedMachineStat.sequence_number}` : ''}` : '—')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: 'rgba(245,158,11,0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.3)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.75rem'
                      }}>
                        {log.maintenance_type || 'Обслуговування'}
                      </span>
                    </td>
                    <td className="machines-cell-strong" style={{ padding: '12px 16px' }}>
                      {log.machine_head || log.spare_part || '—'}
                    </td>
                    <td className="machines-name-text" style={{ padding: '12px 16px' }}>
                      {log.performed_by || '—'}
                    </td>
                    <td className="machines-cell-dim" style={{ padding: '12px 16px', fontSize: '0.75rem' }}>
                      {log.notes || '—'}
                    </td>
                  </tr>
                ))}
                {displayMaintenanceLogs.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }} className="machines-cell-dim">
                      За обраний період обслуговування верстатів не проводилось.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CardCommentsModal
        isOpen={!!selectedCardForComments}
        onClose={() => setSelectedCardForComments(null)}
        card={selectedCardForComments}
        nom={selectedCardForComments?.nomenclature_id ? nomsById?.get?.(String(selectedCardForComments.nomenclature_id)) : null}
        orderNum={selectedCardForComments?.task_id ? ordersById?.get?.(String(tasksById?.get?.(String(selectedCardForComments.task_id))?.order_id))?.order_num : ''}
      />

      {/* ── MACHINE MAINTENANCE MODAL ── */}
      {selectedMachineForMaintenance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            backdropFilter: 'blur(5px)'
          }}
          onClick={() => setSelectedMachineForMaintenance(null)}
        >
          <div
            style={{
              background: 'var(--surface-1, #181c22)',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '85vh',
              borderRadius: '24px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
              color: 'var(--text-strong, #fff)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                background: 'var(--surface-2, #21262d)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Wrench size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950 }}>
                    ТО ВЕРСТАТА • {selectedMachineForMaintenance.name} {selectedMachineForMaintenance.sequence_number ? `(№${selectedMachineForMaintenance.sequence_number})` : ''}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800, marginTop: '2px' }}>
                    Зафіксовано записів ТО: {selectedMachineForMaintenance.maintenanceLogs.length}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMachineForMaintenance(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px'
                }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Logs List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedMachineForMaintenance.maintenanceLogs.map((log, idx) => {
                const dateStr = formatDateTime(log.triggered_at || log.created_at)
                const isCompleted = log.status === 'completed' || !log.status

                return (
                  <div
                    key={log.id || idx}
                    style={{
                      background: 'var(--surface-2, rgba(255, 255, 255, 0.035))',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                      borderRadius: '16px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 900,
                            fontSize: '0.75rem'
                          }}
                        >
                          🛠 {log.maintenance_type || 'Обслуговування'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
                          {dateStr}
                        </span>
                      </div>

                      <span
                        style={{
                          background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isCompleted ? '#10b981' : '#3b82f6',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 900,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase'
                        }}
                      >
                        {isCompleted ? '✓ ВИКОНАНО' : (log.status || 'В ПРОЦЕСІ')}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Вузол / Голова:</span>
                        <div style={{ fontWeight: 800, marginTop: '2px', color: 'var(--text-strong, #fff)' }}>
                          {log.machine_head || 'Всі робочі вузли'}
                        </div>
                      </div>

                      {log.spare_part && (
                        <div>
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Деталь:</span>
                          <div style={{ fontWeight: 800, marginTop: '2px', color: '#a78bfa' }}>
                            {log.spare_part}
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Хто виконував:</span>
                        <div style={{ fontWeight: 800, marginTop: '2px', color: 'var(--text-strong, #fff)' }}>
                          {log.performed_by || 'Не вказано'}
                        </div>
                      </div>

                      {log.maintenance_duration_seconds > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Тривалість робіт:</span>
                          <div style={{ fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
                            {formatDurationSec(log.maintenance_duration_seconds)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'var(--surface-inset, rgba(0, 0, 0, 0.25))', padding: '10px 12px', borderRadius: '10px', fontSize: '0.78rem', color: (log.notes || log.comment || log.description || log.details) ? 'var(--text-strong, #fff)' : 'var(--text-muted, #94a3b8)', lineHeight: 1.4, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <strong style={{ color: '#f59e0b' }}>Коментар / Примітки: </strong>
                      {(log.notes || log.comment || log.description || log.details) ? (
                        <span>{log.notes || log.comment || log.description || log.details}</span>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted, #94a3b8)' }}>Без коментаря (користувач не залишив приміток)</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                background: 'var(--surface-2, #21262d)',
                borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedMachineId(selectedMachineForMaintenance.id)
                  setActiveSubTab('maintenance')
                  setSelectedMachineForMaintenance(null)
                }}
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                Відкрити у повному журналі ТО →
              </button>

              <button
                type="button"
                onClick={() => setSelectedMachineForMaintenance(null)}
                style={{
                  background: 'var(--surface-1, #30363d)',
                  color: 'var(--text-strong, #fff)',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
