import React, { useState, useMemo, useEffect } from 'react'
import '../employee-report.css'
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight,
  TrendingUp,
  Wrench,
  ShieldAlert,
  Trash2,
  ArrowUpDown,
  Scissors,
  Layers,
  Activity
} from 'lucide-react'
import { isShop1CuttingOperation, isShop2HistoryRecord } from '../hooks/useEmployeeReport'

/**
 * Clean up messy raw metadata tags like "[MACHINE_ID:] [STAGE:...] №1/1 [REQ:6454]"
 * into a clean, readable order identifier like "№1/1".
 */
export function cleanOrderLabel(raw) {
  if (!raw) return '—'
  const str = String(raw).trim()
  if (!str.includes('[')) return str

  // Extract explicit order / fraction sequence like "№1/1"
  const fractionMatch = str.match(/№\s*\d+(?:\/\d+)?/)
  if (fractionMatch) return fractionMatch[0]

  // Extract numeric order sequence
  const numMatch = str.match(/\b\d{5,}(?:-\d+)?\b/)
  if (numMatch) return numMatch[0]

  // Strip all bracketed tags and clean whitespace
  const clean = str.replace(/\[[A-Z0-9_:]+\]/g, '').replace(/\s+/g, ' ').trim()
  return clean || str
}

export const EmployeeReportView = ({
  employeeStats = [],
  productionSummary = null,
  selectedEmployeeFilter = 'all',
  setSelectedEmployeeFilter,
  startDate,
  endDate
}) => {
  const [localSearch, setLocalSearch] = useState('')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL')
  const [selectedScrapTypeFilter, setSelectedScrapTypeFilter] = useState('ALL') // 'ALL' | 'HAS_SCRAP' | 'REWORK' | 'QUARANTINE' | 'UTIL' | 'CLEAN'
  const [sortBy, setSortBy] = useState('produced') // 'produced' | 'scrap' | 'rework' | 'quarantine' | 'util' | 'efficiency' | 'name'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
  const [activeEmployeeDetail, setActiveEmployeeDetail] = useState(null)

  // Unique departments for filter pills
  const departments = useMemo(() => {
    const set = new Set()
    employeeStats.forEach(e => {
      if (e.department && e.department !== '-') {
        set.add(e.department)
      }
    })
    return Array.from(set).sort()
  }, [employeeStats])

  // Summary Totals for Top KPI Cards
  const totals = useMemo(() => {
    let produced = 0
    let scrap = 0
    let rework = 0
    let quarantine = 0
    let util = 0
    let operations = 0
    let shop1Produced = 0
    const shop1Cards = new Set()
    const shop2CardsMap = new Map()
    const allCards = new Set()

    employeeStats.forEach(e => {
      produced += Number(e.produced) || 0
      scrap += Number(e.scrap) || 0
      rework += Number(e.rework) || 0
      quarantine += Number(e.quarantine) || 0
      util += Number(e.util) || 0
      operations += Number(e.operations) || 0
      if (e.cardIds && typeof e.cardIds.forEach === 'function') {
        e.cardIds.forEach(id => allCards.add(id))
      }

      if (Array.isArray(e.history)) {
        e.history.forEach(h => {
          const qty = Number(h.produced) || 0
          if (qty <= 0) return

          const cardKey = h.cardId ? String(h.cardId) : (h.id ? String(h.id) : null)

          // 1. Shop 1 Cutting (Розкрій)
          if (h.isCutting || isShop1CuttingOperation(h.rawStage || h.stage, qty)) {
            shop1Produced += qty
            if (cardKey) shop1Cards.add(cardKey)
          }

          // 2. Shop 2 (Цех №2 unique cards)
          if (h.isShop2 || isShop2HistoryRecord(h, null, e.department)) {
            if (cardKey) {
              const currentMax = shop2CardsMap.get(cardKey) || 0
              shop2CardsMap.set(cardKey, Math.max(currentMax, qty))
            } else {
              shop2CardsMap.set(`row-${h.id}`, qty)
            }
          }
        })
      }
    })

    const computedShop2Produced = Array.from(shop2CardsMap.values()).reduce((sum, q) => sum + q, 0)
    const computedShop2Cards = shop2CardsMap.size

    // Fallback to productionSummary if passed directly from hook
    const finalShop1Produced = productionSummary?.shop1Produced !== undefined ? productionSummary.shop1Produced : shop1Produced
    const finalShop1Cards = productionSummary?.shop1Cards !== undefined ? productionSummary.shop1Cards : shop1Cards.size
    const finalShop2Produced = productionSummary?.shop2Produced !== undefined ? productionSummary.shop2Produced : computedShop2Produced
    const finalShop2Cards = productionSummary?.shop2Cards !== undefined ? productionSummary.shop2Cards : computedShop2Cards

    const totalProcessed = produced + scrap
    const efficiency = totalProcessed > 0
      ? ((produced / totalProcessed) * 100).toFixed(1)
      : '100.0'

    return {
      produced,
      shop1Produced: finalShop1Produced,
      shop1Cards: finalShop1Cards,
      shop2Produced: finalShop2Produced,
      shop2Cards: finalShop2Cards,
      scrap,
      rework,
      quarantine,
      util,
      operations,
      cards: allCards.size,
      efficiency,
      employeeCount: employeeStats.length
    }
  }, [employeeStats, productionSummary])

  // Filtered and Sorted Employee List
  const filteredEmployees = useMemo(() => {
    return employeeStats
      .filter(emp => {
        // Department filter
        if (selectedDeptFilter !== 'ALL' && emp.department !== selectedDeptFilter) {
          return false
        }

        // Scrap category filter
        if (selectedScrapTypeFilter === 'HAS_SCRAP' && emp.scrap <= 0) return false
        if (selectedScrapTypeFilter === 'REWORK' && emp.rework <= 0) return false
        if (selectedScrapTypeFilter === 'QUARANTINE' && emp.quarantine <= 0) return false
        if (selectedScrapTypeFilter === 'UTIL' && emp.util <= 0) return false
        if (selectedScrapTypeFilter === 'CLEAN' && (emp.scrap > 0 || emp.produced === 0)) return false

        // Search text
        if (localSearch.trim()) {
          const q = localSearch.toLowerCase().trim()
          const matchName = String(emp.name || '').toLowerCase().includes(q)
          const matchDept = String(emp.department || '').toLowerCase().includes(q)
          const matchPos = String(emp.position || '').toLowerCase().includes(q)
          if (!matchName && !matchDept && !matchPos) return false
        }

        return true
      })
      .sort((a, b) => {
        let diff = 0
        if (sortBy === 'name') {
          diff = String(a.name).localeCompare(String(b.name), 'uk-UA')
        } else {
          const valA = Number(a[sortBy]) || 0
          const valB = Number(b[sortBy]) || 0
          diff = valA - valB
        }
        return sortOrder === 'desc' ? -diff : diff
      })
  }, [employeeStats, selectedDeptFilter, selectedScrapTypeFilter, localSearch, sortBy, sortOrder])

  const handleToggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // Format initials from full name
  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="employee-report-wrapper">
      {/* ── TOP KPI METRIC CARDS ── */}
      <div className="emp-kpi-grid">
        {/* Shop 1 Produced (Розкрій) */}
        <div className="emp-metric-card border-green">
          <div className="emp-metric-label">
            <Scissors size={13} color="#22c55e" /> ВИРОБЛЕНО ЦЕХ №1 (РОЗКРІЙ)
          </div>
          <div className="emp-metric-val val-green">
            {totals.shop1Produced.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.shop1Cards.toLocaleString('uk-UA')} {totals.shop1Cards === 1 ? 'карта розкрою' : (totals.shop1Cards >= 2 && totals.shop1Cards <= 4 ? 'карти розкрою' : 'карт розкрою')}
          </div>
        </div>

        {/* Shop 2 Produced (Унікальні карти) */}
        <div className="emp-metric-card border-cyan">
          <div className="emp-metric-label">
            <Layers size={13} color="#06b6d4" /> ВИРОБЛЕНО ЦЕХ №2
          </div>
          <div className="emp-metric-val val-cyan">
            {totals.shop2Produced.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.shop2Cards.toLocaleString('uk-UA')} {totals.shop2Cards === 1 ? 'унікальна карта' : (totals.shop2Cards >= 2 && totals.shop2Cards <= 4 ? 'унікальні карти' : 'унікальних карт')}
          </div>
        </div>

        {/* Operational Output / Workload */}
        <div className="emp-metric-card border-purple">
          <div className="emp-metric-label">
            <Activity size={13} color="#a855f7" /> ОПЕРАЦІЙНИЙ ОБСЯГ
          </div>
          <div className="emp-metric-val val-purple">
            {totals.produced.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.cards > 0 ? `${totals.cards.toLocaleString('uk-UA')} карт · ` : ''}{totals.operations.toLocaleString('uk-UA')} операцій (трудомісткість)
          </div>
        </div>

        {/* Total Scrap */}
        <div className="emp-metric-card border-red">
          <div className="emp-metric-label">
            <AlertTriangle size={13} color="#ef4444" /> ЗАГАЛЬНИЙ БРАК
          </div>
          <div className={`emp-metric-val ${totals.scrap > 0 ? 'val-red' : 'val-muted'}`}>
            {totals.scrap.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.produced > 0 ? `${((totals.scrap / (totals.produced + totals.scrap)) * 100).toFixed(1)}% від усього обсягу` : '0.0%'}
          </div>
        </div>

        {/* Rework (Cat 1-2) */}
        <div className="emp-metric-card border-yellow">
          <div className="emp-metric-label">
            <Wrench size={13} color="#eab308" /> ВІДНОВЛЮВАНИЙ (КАТ. 1–2)
          </div>
          <div className="emp-metric-val val-yellow">
            {totals.rework.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.scrap > 0 ? `${((totals.rework / totals.scrap) * 100).toFixed(0)}% від браку (доопрацювання)` : 'Немає відновлюваного'}
          </div>
        </div>

        {/* Quarantine (Cat 3 + Pending) */}
        <div className="emp-metric-card border-orange">
          <div className="emp-metric-label">
            <ShieldAlert size={13} color="#f97316" /> НА КАРАНТИНІ / ВКЯ
          </div>
          <div className="emp-metric-val val-orange">
            {totals.quarantine.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.scrap > 0 ? `${((totals.quarantine / totals.scrap) * 100).toFixed(0)}% від браку (очікує рішення)` : 'Карантин порожній'}
          </div>
        </div>

        {/* Waste / Util (Cat 4) */}
        <div className="emp-metric-card border-darkred">
          <div className="emp-metric-label">
            <Trash2 size={13} color="#dc2626" /> УТИЛЬ / СПИСАНО (КАТ. 4)
          </div>
          <div className="emp-metric-val val-darkred">
            {totals.util.toLocaleString('uk-UA')} <span className="emp-metric-unit">шт</span>
          </div>
          <div className="emp-metric-sub">
            {totals.scrap > 0 ? `${((totals.util / totals.scrap) * 100).toFixed(0)}% від браку (безповоротний)` : 'Без утилю'}
          </div>
        </div>

        {/* Average Efficiency */}
        <div className="emp-metric-card border-blue">
          <div className="emp-metric-label">
            <TrendingUp size={13} color="#3b82f6" /> СЕРЕДНЯ ЕФЕКТИВНІСТЬ
          </div>
          <div className={`emp-metric-val ${Number(totals.efficiency) >= 98 ? 'val-green' : (Number(totals.efficiency) >= 90 ? 'val-orange' : 'val-red')}`}>
            {totals.efficiency}%
          </div>
          <div className="emp-metric-sub">
            Працювало: {totals.employeeCount} працівників/бригад
          </div>
        </div>
      </div>

      {/* ── ACTIVE FILTER BAR NOTICE (IF TOP DROPDOWN APPLIED) ── */}
      {Boolean(
        Array.isArray(selectedEmployeeFilter)
          ? selectedEmployeeFilter.length > 0 && !selectedEmployeeFilter.includes('all')
          : (selectedEmployeeFilter && selectedEmployeeFilter !== 'all')
      ) && (
        <div className="emp-active-filter-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} color="#ff9000" />
            <span>
              {Array.isArray(selectedEmployeeFilter) && selectedEmployeeFilter.length > 1
                ? `Фільтр за обраними працівниками (${selectedEmployeeFilter.length}): `
                : 'Фільтр за обраним працівником: '}
              <strong style={{ color: '#ff9000' }}>
                {Array.isArray(selectedEmployeeFilter) ? selectedEmployeeFilter.join(', ') : selectedEmployeeFilter}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setSelectedEmployeeFilter && setSelectedEmployeeFilter('all')}
            className="emp-banner-reset-btn"
          >
            Показати всіх працівників
          </button>
        </div>
      )}

      {/* ── TOOLBAR: SEARCH & SUB-FILTERS ── */}
      <div className="emp-toolbar-card">
        {/* Left: Search input */}
        <div className="emp-search-box">
          <Search size={15} className="emp-search-icon" />
          <input
            type="text"
            placeholder="Швидкий пошук (ПІБ, посада, цех)..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="emp-search-input"
          />
          {localSearch && (
            <button onClick={() => setLocalSearch('')} className="emp-search-clear">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Center: Department pills */}
        <div className="emp-filter-group">
          <span className="emp-filter-label">Цех:</span>
          <button
            onClick={() => setSelectedDeptFilter('ALL')}
            className={`filter-pill ${selectedDeptFilter === 'ALL' ? 'active' : ''}`}
          >
            Всі цехи
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDeptFilter(dept)}
              className={`filter-pill ${selectedDeptFilter === dept ? 'active' : ''}`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Right: Scrap filter pills */}
        <div className="emp-filter-group">
          <span className="emp-filter-label">Статус:</span>
          <button
            onClick={() => setSelectedScrapTypeFilter('ALL')}
            className={`filter-pill ${selectedScrapTypeFilter === 'ALL' ? 'active' : ''}`}
          >
            Всі ({employeeStats.length})
          </button>
          <button
            onClick={() => setSelectedScrapTypeFilter('HAS_SCRAP')}
            className={`filter-pill ${selectedScrapTypeFilter === 'HAS_SCRAP' ? 'active' : ''}`}
          >
            ⚠️ З браком
          </button>
          <button
            onClick={() => setSelectedScrapTypeFilter('REWORK')}
            className={`filter-pill ${selectedScrapTypeFilter === 'REWORK' ? 'active' : ''}`}
          >
            🔧 Відновлювані
          </button>
          <button
            onClick={() => setSelectedScrapTypeFilter('QUARANTINE')}
            className={`filter-pill ${selectedScrapTypeFilter === 'QUARANTINE' ? 'active' : ''}`}
          >
            🛡️ Карантин
          </button>
          <button
            onClick={() => setSelectedScrapTypeFilter('UTIL')}
            className={`filter-pill ${selectedScrapTypeFilter === 'UTIL' ? 'active' : ''}`}
          >
            ❌ Утиль
          </button>
        </div>
      </div>

      {/* ── MAIN EMPLOYEES DATA TABLE ── */}
      <div className="emp-table-panel">
        <div style={{ overflowX: 'auto' }}>
          <table className="emp-main-table">
            <thead>
              <tr className="emp-table-head-row">
                <th onClick={() => handleToggleSort('name')} className="sortable-th">
                  <div className="th-content">
                    <span>Працівник</span>
                    <ArrowUpDown size={12} color={sortBy === 'name' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th>Цех / Посада</th>
                <th onClick={() => handleToggleSort('cards')} className="sortable-th th-center" title="Кількість унікальних робочих карт">
                  <div className="th-content th-center">
                    <span>Карти</span>
                    <ArrowUpDown size={12} color={sortBy === 'cards' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('operations')} className="sortable-th th-center">
                  <div className="th-content th-center">
                    <span>Операцій</span>
                    <ArrowUpDown size={12} color={sortBy === 'operations' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('produced')} className="sortable-th th-center">
                  <div className="th-content th-center">
                    <span style={{ color: '#22c55e' }}>Вироблено (шт)</span>
                    <ArrowUpDown size={12} color={sortBy === 'produced' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('scrap')} className="sortable-th th-center">
                  <div className="th-content th-center">
                    <span style={{ color: '#ef4444' }}>Загальний брак</span>
                    <ArrowUpDown size={12} color={sortBy === 'scrap' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('rework')}
                  className="sortable-th th-center"
                  title="Відновлюваний брак (Категорія 1–2): доопрацювання або косметичний ремонт"
                >
                  <div className="th-content th-center">
                    <span style={{ color: '#eab308' }}>Відновлюваний (Кат. 1–2)</span>
                    <ArrowUpDown size={12} color={sortBy === 'rework' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('quarantine')}
                  className="sortable-th th-center"
                  title="Карантин (Категорія 3 + некласифіковано): очікує рішення інспектора ВКЯ"
                >
                  <div className="th-content th-center">
                    <span style={{ color: '#f97316' }}>Карантин (ВКЯ)</span>
                    <ArrowUpDown size={12} color={sortBy === 'quarantine' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('util')}
                  className="sortable-th th-center"
                  title="Утиль (Категорія 4): безповоротний брак, списано"
                >
                  <div className="th-content th-center">
                    <span style={{ color: '#dc2626' }}>Утиль (Кат. 4)</span>
                    <ArrowUpDown size={12} color={sortBy === 'util' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('efficiency')} className="sortable-th th-center">
                  <div className="th-content th-center">
                    <span>Ефективність</span>
                    <ArrowUpDown size={12} color={sortBy === 'efficiency' ? '#ff9000' : 'currentColor'} />
                  </div>
                </th>
                <th className="th-center">Дії</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="emp-empty-td">
                    За обраними критеріями працівників не знайдено
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const effNum = Number(emp.efficiency) || 0

                  return (
                    <tr
                      key={emp.key || idx}
                      onClick={() => setActiveEmployeeDetail(emp)}
                      className="emp-table-row"
                    >
                      {/* Name & Avatar */}
                      <td className="emp-cell-user">
                        <div className="emp-user-wrap">
                          <div className="emp-avatar-box">
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <div className="emp-name-text">
                              {emp.name}
                            </div>
                            {emp.login && (
                              <div className="emp-login-text">
                                @{emp.login}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department & Position */}
                      <td className="emp-cell-dept">
                        <div className="emp-dept-stack">
                          <span className="emp-dept-badge">
                            {emp.department || 'Виробництво'}
                          </span>
                          <span className="emp-pos-text">
                            {emp.position || 'Оператор'}
                          </span>
                        </div>
                      </td>

                      {/* Cards */}
                      <td className="emp-cell-cards">
                        {emp.cards || 0}
                      </td>

                      {/* Operations */}
                      <td className="emp-cell-ops">
                        {emp.operations}
                      </td>

                      {/* Produced */}
                      <td className="emp-cell-produced">
                        {emp.produced.toLocaleString('uk-UA')}
                      </td>

                      {/* Total Scrap */}
                      <td className={`emp-cell-scrap ${emp.scrap > 0 ? 'has-scrap' : 'is-zero'}`}>
                        {emp.scrap > 0 ? emp.scrap.toLocaleString('uk-UA') : '—'}
                      </td>

                      {/* Rework (Cat 1-2) */}
                      <td className={`emp-cell-rework ${emp.rework > 0 ? 'has-rework' : 'is-zero'}`}>
                        {emp.rework > 0 ? emp.rework.toLocaleString('uk-UA') : '—'}
                      </td>

                      {/* Quarantine (Cat 3 + Pending) */}
                      <td className={`emp-cell-quarantine ${emp.quarantine > 0 ? 'has-quarantine' : 'is-zero'}`}>
                        {emp.quarantine > 0 ? emp.quarantine.toLocaleString('uk-UA') : '—'}
                      </td>

                      {/* Util (Cat 4) */}
                      <td className={`emp-cell-util ${emp.util > 0 ? 'has-util' : 'is-zero'}`}>
                        {emp.util > 0 ? emp.util.toLocaleString('uk-UA') : '—'}
                      </td>

                      {/* Efficiency */}
                      <td className="emp-cell-eff">
                        <div className="emp-eff-wrap">
                          <span className={`emp-eff-number ${effNum >= 98 ? 'eff-good' : (effNum >= 90 ? 'eff-warn' : 'eff-bad')}`}>
                            {emp.efficiency}%
                          </span>
                          <div className="emp-eff-bar-bg">
                            <div
                              className={`emp-eff-bar-fill ${effNum >= 98 ? 'bg-good' : (effNum >= 90 ? 'bg-warn' : 'bg-bad')}`}
                              style={{ width: `${Math.min(100, Math.max(0, effNum))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="emp-cell-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveEmployeeDetail(emp)
                          }}
                          className="emp-details-btn"
                        >
                          Деталі <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── EMPLOYEE DETAIL MODAL / DRILLDOWN ── */}
      {activeEmployeeDetail && (
        <EmployeeDetailModal
          employee={activeEmployeeDetail}
          onClose={() => setActiveEmployeeDetail(null)}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  )
}

/**
 * Detailed Drill-down modal for a single employee
 * Styled for both dark and light modes.
 */
function EmployeeDetailModal({ employee, onClose, startDate, endDate }) {
  const [modalSearch, setModalSearch] = useState('')
  const [modalFilter, setModalFilter] = useState('ALL') // 'ALL' | 'SCRAP_ONLY' | 'REWORK' | 'QUARANTINE' | 'UTIL'

  const history = employee.history || []

  const [visibleCount, setVisibleCount] = useState(50)

  useEffect(() => {
    setVisibleCount(50)
  }, [modalFilter, modalSearch, employee?.key, employee?.name])

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      if (modalFilter === 'SCRAP_ONLY' && item.scrap <= 0) return false
      if (modalFilter === 'REWORK' && item.rework <= 0) return false
      if (modalFilter === 'QUARANTINE' && item.quarantine <= 0) return false
      if (modalFilter === 'UTIL' && item.util <= 0) return false

      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim()
        const cleanOrder = cleanOrderLabel(item.orderNum).toLowerCase()
        const matchNom = String(item.nomenclatureName || '').toLowerCase().includes(q)
        const matchOrder = cleanOrder.includes(q) || String(item.orderNum || '').toLowerCase().includes(q)
        const matchStage = String(item.stage || '').toLowerCase().includes(q)
        const matchReason = String(item.reason || '').toLowerCase().includes(q)
        if (!matchNom && !matchOrder && !matchStage && !matchReason) return false
      }

      return true
    })
  }, [history, modalFilter, modalSearch])

  return (
    <div className="emp-modal-overlay">
      <div className="emp-modal-panel">
        {/* Modal Header */}
        <div className="emp-modal-header">
          <div className="emp-modal-head-left">
            <div className="emp-modal-title-row">
              <h3 className="emp-modal-name">
                {employee.name}
              </h3>
              <span className="emp-modal-dept-badge">
                {employee.department}
              </span>
              <span className="emp-modal-pos-tag">
                • {employee.position}
              </span>
            </div>
            <div className="emp-modal-dates">
              Період: <strong>{startDate}</strong> — <strong>{endDate}</strong> • Зміна: <strong>{employee.shift}</strong> • Карт: <strong>{employee.cards || 0}</strong> • Операцій: <strong>{employee.operations || 0}</strong>
            </div>
          </div>

          <button
            onClick={onClose}
            className="emp-modal-close-btn"
            title="Закрити вікно"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal KPI Row */}
        <div className="emp-modal-kpi-row">
          <div className="emp-modal-kpi-card border-green">
            <div className="emp-modal-kpi-label">ВИРОБЛЕНО</div>
            <div className="emp-modal-kpi-val text-green">
              {employee.produced.toLocaleString('uk-UA')} <span className="unit">шт</span>
            </div>
          </div>

          <div className="emp-modal-kpi-card border-red">
            <div className="emp-modal-kpi-label">ЗАГАЛЬНИЙ БРАК</div>
            <div className={`emp-modal-kpi-val ${employee.scrap > 0 ? 'text-red' : 'text-muted'}`}>
              {employee.scrap.toLocaleString('uk-UA')} <span className="unit">шт</span>
            </div>
          </div>

          <div className="emp-modal-kpi-card border-yellow">
            <div className="emp-modal-kpi-label label-yellow">ВІДНОВЛЮВАНИЙ</div>
            <div className="emp-modal-kpi-val text-yellow">
              {employee.rework.toLocaleString('uk-UA')} <span className="unit">шт</span>
            </div>
          </div>

          <div className="emp-modal-kpi-card border-orange">
            <div className="emp-modal-kpi-label label-orange">КАРАНТИН (ВКЯ)</div>
            <div className="emp-modal-kpi-val text-orange">
              {employee.quarantine.toLocaleString('uk-UA')} <span className="unit">шт</span>
            </div>
          </div>

          <div className="emp-modal-kpi-card border-darkred">
            <div className="emp-modal-kpi-label label-darkred">УТИЛЬ (КАТ. 4)</div>
            <div className="emp-modal-kpi-val text-darkred">
              {employee.util.toLocaleString('uk-UA')} <span className="unit">шт</span>
            </div>
          </div>

          <div className="emp-modal-kpi-card border-blue">
            <div className="emp-modal-kpi-label label-blue">ЕФЕКТИВНІСТЬ</div>
            <div className={`emp-modal-kpi-val ${Number(employee.efficiency) >= 98 ? 'text-green' : (Number(employee.efficiency) >= 90 ? 'text-orange' : 'text-red')}`}>
              {employee.efficiency}%
            </div>
          </div>
        </div>

        {/* Modal Search & Sub-Filter Bar */}
        <div className="emp-modal-toolbar">
          <div className="emp-modal-search-box">
            <Search size={14} className="emp-modal-search-icon" />
            <input
              type="text"
              placeholder="Пошук за деталлю, нарядом чи етапом..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="emp-modal-search-input"
            />
            {modalSearch && (
              <button onClick={() => setModalSearch('')} className="emp-modal-search-clear">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="emp-modal-pills">
            <button
              onClick={() => setModalFilter('ALL')}
              className={`filter-pill ${modalFilter === 'ALL' ? 'active' : ''}`}
            >
              Всі операції ({history.length})
            </button>
            <button
              onClick={() => setModalFilter('SCRAP_ONLY')}
              className={`filter-pill ${modalFilter === 'SCRAP_ONLY' ? 'active' : ''}`}
            >
              ⚠️ З браком
            </button>
            <button
              onClick={() => setModalFilter('REWORK')}
              className={`filter-pill ${modalFilter === 'REWORK' ? 'active' : ''}`}
            >
              🔧 Відновлювані
            </button>
            <button
              onClick={() => setModalFilter('QUARANTINE')}
              className={`filter-pill ${modalFilter === 'QUARANTINE' ? 'active' : ''}`}
            >
              🛡️ Карантин
            </button>
            <button
              onClick={() => setModalFilter('UTIL')}
              className={`filter-pill ${modalFilter === 'UTIL' ? 'active' : ''}`}
            >
              ❌ Утиль
            </button>
          </div>
        </div>

        {/* Modal Operations Table */}
        <div className="emp-modal-table-wrap">
          <table className="emp-modal-table">
            <thead>
              <tr className="emp-modal-thead-tr">
                <th style={{ width: '110px' }}>Дата / Час</th>
                <th style={{ width: '130px' }}>Наряд</th>
                <th>Деталь / Номенклатура</th>
                <th>Етап / Верстат</th>
                <th style={{ textAlign: 'center', width: '85px', color: '#22c55e' }}>Вироблено</th>
                <th style={{ textAlign: 'center', width: '85px', color: '#ef4444' }}>Брак</th>
                <th>Розподіл браку</th>
                <th>Причина браку</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="emp-modal-empty-td">
                    Немає операцій за обраними критеріями фільтра
                  </td>
                </tr>
              ) : (
                filteredHistory.slice(0, visibleCount).map((item, idx) => {
                  const displayOrder = cleanOrderLabel(item.orderNum)

                  return (
                    <tr key={item.id || idx} className="emp-modal-tbody-tr">
                      {/* Date */}
                      <td className="emp-modal-date-td">
                        {item.date ? new Date(item.date).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>

                      {/* Naryad */}
                      <td className="emp-modal-order-td">
                        <span className="order-pill" title={item.orderNum}>
                          {displayOrder}
                        </span>
                      </td>

                      {/* Nomenclature */}
                      <td className="emp-modal-nom-td">
                        <div className="nom-title">{item.nomenclatureName}</div>
                        {item.nomenclatureCode && (
                          <div className="nom-code">{item.nomenclatureCode}</div>
                        )}
                      </td>

                      {/* Stage & Machine */}
                      <td className="emp-modal-stage-td">
                        <div className="stage-text">{item.stage}</div>
                        {item.machine && item.machine !== '—' && (
                          <div className="machine-text">{item.machine}</div>
                        )}
                      </td>

                      {/* Produced */}
                      <td className="emp-modal-num-td text-green">
                        {item.produced > 0 ? item.produced : '0'}
                      </td>

                      {/* Scrap */}
                      <td className={`emp-modal-num-td ${item.scrap > 0 ? 'text-red' : 'text-muted'}`}>
                        {item.scrap > 0 ? item.scrap : '—'}
                      </td>

                      {/* Scrap Breakdown Badges */}
                      <td className="emp-modal-badges-td">
                        {item.scrap > 0 ? (
                          <div className="badges-flex">
                            {item.rework > 0 && (
                              <span className="breakdown-badge badge-rework" title="Відновлюваний (Кат. 1–2)">
                                Віднов: {item.rework}
                              </span>
                            )}
                            {item.quarantine > 0 && (
                              <span className="breakdown-badge badge-quarantine" title="Карантин (ВКЯ / Кат. 3)">
                                Карантин: {item.quarantine}
                              </span>
                            )}
                            {item.util > 0 && (
                              <span className="breakdown-badge badge-util" title="Утиль (Кат. 4)">
                                Утиль: {item.util}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Defect Reason */}
                      <td className="emp-modal-reason-td">
                        {item.reason}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        {visibleCount < filteredHistory.length && (
            <div className="emp-modal-load-more-wrap">
              <span className="emp-modal-load-more-info">
                Показано {visibleCount} із {filteredHistory.length} операцій
              </span>
              <button
                type="button"
                onClick={() => setVisibleCount(prev => Math.min(prev + 50, filteredHistory.length))}
                className="emp-modal-load-more-btn"
              >
                Показати ще 50
              </button>
              {filteredHistory.length > visibleCount + 50 && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredHistory.length)}
                  className="emp-modal-load-more-btn"
                  style={{ background: 'transparent' }}
                >
                  Показати всі ({filteredHistory.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="emp-modal-footer">
          <button onClick={onClose} className="emp-modal-close-action-btn">
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
