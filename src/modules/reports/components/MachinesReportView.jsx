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
  RefreshCw
} from 'lucide-react'
import { formatDurationSec } from '../hooks/useMachinesReport'

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
    nomsById
  } = machineReport

  const [activeSubTab, setActiveSubTab] = useState('overview') // 'overview' | 'cards' | 'maintenance'
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
      if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) return false
      return true
    })

    list.sort((a, b) => {
      let valA = a[sortBy] || 0
      let valB = b[sortBy] || 0
      if (sortBy === 'name') {
        return sortAsc ? (a.name || '').localeCompare(b.name || '', 'uk-UA') : (b.name || '').localeCompare(a.name || '', 'uk-UA')
      }
      return sortAsc ? valA - valB : valB - valA
    })

    return list
  }, [machineAnalytics, selectedMachineType, sortBy, sortAsc])

  // 3. Filtered Cards List (for Cards tab or Detail View)
  const displayCards = useMemo(() => {
    let cards = []
    if (selectedMachineStat) {
      cards = selectedMachineStat.cards || []
    } else {
      // All cards across filtered machines
      (machineAnalytics || []).forEach(m => {
        if (!m) return
        if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) return
        cards.push(...(m.cards || []).map(c => ({ ...c, machineName: m.name, machineType: m.type })))
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
      logs = selectedMachineStat.maintenanceLogs || []
    } else {
      (machineAnalytics || []).forEach(m => {
        if (!m) return
        if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) return
        logs.push(...(m.maintenanceLogs || []).map(l => ({ ...l, machineName: m.name, machineType: m.type })))
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeSubTab === 'cards' && (
            <>
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
                  placeholder="Пошук картки / деталі..."
                  className="machines-search-input"
                />
              </div>
            </>
          )}

          {selectedMachineId !== 'all' && (
            <button
              onClick={() => setSelectedMachineId('all')}
              className="machines-reset-btn"
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
            <h3>
              <Cpu size={18} color="#ff9000" />
              РЕЙТИНГ ТА ЗАВАНТАЖЕННЯ ВЕРСТАТІВ ({sortedMachineStats.length})
            </h3>
            <div className="machines-cell-dim" style={{ fontSize: '0.78rem' }}>
              Клікніть на рядок верстата для перегляду його карток
            </div>
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
                          <span style={{
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}>
                            🛠 {m.maintenanceLogs.length}
                          </span>
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
                {selectedMachineStat && <span style={{ color: '#ff9000' }}> • {selectedMachineStat.name}</span>}
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
                        {c.machineName || selectedMachineStat?.name || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#ff9000' }}>
                          #{String(c.card_id || c.id).slice(0, 8)}
                        </div>
                        <small className="machines-cell-dim">
                          {order?.order_num ? `Наряд №${order.order_num}` : '—'}
                        </small>
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
                      {log.machineName || selectedMachineStat?.name || '—'}
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
    </div>
  )
}
