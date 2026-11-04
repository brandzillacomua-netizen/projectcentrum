import React, { useState } from 'react'
import {
  Zap,
  Clock,
  Award,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Sliders,
  FileSpreadsheet
} from 'lucide-react'
import { formatMinutesToHours } from '../../../utils/cuttingTimeUtils.js'

export function EfficiencyReportView({
  efficiencyReport,
  isSyncing,
  startDate,
  endDate,
  onExport
}) {
  const {
    allSessions = [],
    operatorsList = [],
    partsComparison = [],
    shiftChangesLog = [],
    totals = {},
    isLoadingMetadata
  } = efficiencyReport || {}

  const [activeSubTab, setActiveSubTab] = useState('leaderboard') // 'leaderboard' | 'parts' | 'handovers'
  const [expandedOperator, setExpandedOperator] = useState(null)
  const [expandedPart, setExpandedPart] = useState(null)
  const [localSearch, setLocalSearch] = useState('')

  const toggleOperator = (name) => {
    setExpandedOperator(prev => (prev === name ? null : name))
  }

  const togglePart = (id) => {
    setExpandedPart(prev => (prev === id ? null : id))
  }

  const getKpiBadge = (efficiencyPercent, status) => {
    if (efficiencyPercent === null || efficiencyPercent === undefined) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'var(--surface-inset, #f1f5f9)',
          color: 'var(--text-muted, #94a3b8)',
          border: '1px solid var(--border-subtle, #cbd5e1)',
          padding: '2px 8px',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '0.74rem'
        }}>
          Не тарифіковано
        </span>
      )
    }

    if (efficiencyPercent >= 105) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#16a34a',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          padding: '3px 8px',
          borderRadius: '8px',
          fontWeight: 900,
          fontSize: '0.82rem'
        }}>
          <ArrowUpRight size={13} strokeWidth={2.5} />
          {efficiencyPercent}%
        </span>
      )
    }

    if (efficiencyPercent >= 95) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(59, 130, 246, 0.12)',
          color: '#2563eb',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          padding: '3px 8px',
          borderRadius: '8px',
          fontWeight: 900,
          fontSize: '0.82rem'
        }}>
          {efficiencyPercent}%
        </span>
      )
    }

    if (efficiencyPercent >= 85) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#d97706',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '3px 8px',
          borderRadius: '8px',
          fontWeight: 900,
          fontSize: '0.82rem'
        }}>
          {efficiencyPercent}%
        </span>
      )
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(239, 68, 68, 0.15)',
        color: '#dc2626',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        padding: '3px 8px',
        borderRadius: '8px',
        fontWeight: 900,
        fontSize: '0.82rem'
      }}>
        <ArrowDownRight size={13} strokeWidth={2.5} />
        {efficiencyPercent}%
      </span>
    )
  }

  // Filtered lists by local search
  const filteredOperators = operatorsList.filter(op => {
    if (!localSearch) return true
    const q = localSearch.toLowerCase()
    return op.operatorName.toLowerCase().includes(q) || (op.shiftName && op.shiftName.toLowerCase().includes(q))
  })

  const filteredParts = partsComparison.filter(p => {
    if (!localSearch) return true
    const q = localSearch.toLowerCase()
    return p.nomenclatureName.toLowerCase().includes(q) || (p.nomenclatureCode && p.nomenclatureCode.toLowerCase().includes(q))
  })

  const filteredHandovers = shiftChangesLog.filter(h => {
    if (!localSearch) return true
    const q = localSearch.toLowerCase()
    return (
      h.operatorName.toLowerCase().includes(q) ||
      h.nomenclatureName.toLowerCase().includes(q) ||
      h.cardCode.toLowerCase().includes(q) ||
      (h.replacedBy && h.replacedBy.toLowerCase().includes(q))
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* ══════════════════════════════════════════════════════════════════════
          1. HEADER KPI CARDS BAR
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Shop Efficiency % */}
        <div className="glass-panel" style={{
          background: 'var(--surface-1, #ffffff)',
          border: '1.5px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '18px',
          padding: '18px 20px',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', letterSpacing: '0.5px' }}>
              Ефективність розкрою
            </span>
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '6px', borderRadius: '10px', color: '#f59e0b' }}>
              <Zap size={18} strokeWidth={2.5} />
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 950, color: (totals?.overallShopEfficiency || 0) >= 100 ? '#16a34a' : '#d97706' }}>
            {totals?.overallShopEfficiency || 0}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim, #94a3b8)', marginTop: '4px', fontWeight: 700 }}>
            Співвідношення (План / Факт)
          </div>
        </div>

        {/* Card 2: Produced Norm Hours (Plan) */}
        <div className="glass-panel" style={{
          background: 'var(--surface-1, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '18px',
          padding: '18px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', letterSpacing: '0.5px' }}>
              Вироблено (План)
            </span>
            <span style={{ background: 'rgba(59, 130, 246, 0.12)', padding: '6px', borderRadius: '10px', color: '#3b82f6' }}>
              <Clock size={18} />
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 950, color: 'var(--text-strong, #0f172a)' }}>
            {totals?.totalPlanHours || 0} <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-muted)' }}>год</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim, #94a3b8)', marginTop: '4px', fontWeight: 700 }}>
            {totals?.totalPlanMinutes || 0} нормо-хвилин операцій
          </div>
        </div>

        {/* Card 3: Worked Actual Hours (Fact) */}
        <div className="glass-panel" style={{
          background: 'var(--surface-1, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '18px',
          padding: '18px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', letterSpacing: '0.5px' }}>
              Відпрацьовано (Факт)
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '6px', borderRadius: '10px', color: '#10b981' }}>
              <Layers size={18} />
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 950, color: 'var(--text-strong, #0f172a)' }}>
            {totals?.totalFactHours || 0} <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-muted)' }}>год</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim, #94a3b8)', marginTop: '4px', fontWeight: 700 }}>
            {totals?.totalFactMinutes || 0} фактичних хвилин
          </div>
        </div>

        {/* Card 4: Net Balance (Delta Hours) */}
        <div className="glass-panel" style={{
          background: 'var(--surface-1, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '18px',
          padding: '18px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', letterSpacing: '0.5px' }}>
              Баланс часу
            </span>
            <span style={{ background: (totals?.totalDeltaHours || 0) >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', padding: '6px', borderRadius: '10px', color: (totals?.totalDeltaHours || 0) >= 0 ? '#16a34a' : '#ef4444' }}>
              <TrendingUp size={18} />
            </span>
          </div>
          <div style={{
            fontSize: '1.85rem',
            fontWeight: 950,
            color: (totals?.totalDeltaHours || 0) >= 0 ? '#16a34a' : '#ef4444'
          }}>
            {(totals?.totalDeltaHours || 0) >= 0 ? `+${totals.totalDeltaHours}` : totals.totalDeltaHours} <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>год</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim, #94a3b8)', marginTop: '4px', fontWeight: 700 }}>
            {(totals?.totalDeltaHours || 0) >= 0 ? '⚡ Економія робочого часу' : '⚠️ Затримка проти плану'}
          </div>
        </div>

        {/* Card 5: Top Operator */}
        <div className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.04) 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '18px',
          padding: '18px 20px',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.5px' }}>
              Лідер ефективності
            </span>
            <span style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '6px', borderRadius: '10px', color: '#f59e0b' }}>
              <Award size={18} strokeWidth={2.5} />
            </span>
          </div>
          {totals?.topOperator ? (
            <>
              <div style={{ fontSize: '1.25rem', fontWeight: 950, color: 'var(--text-strong, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {totals.topOperator.operatorName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                {getKpiBadge(totals.topOperator.avgEfficiencyPercent, totals.topOperator.status)}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  ({totals.topOperator.sessionsCount} сесій, {totals.topOperator.totalFactHours} год)
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>Дані відсутні</div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. SUB-TABS NAVIGATION & SEARCH BAR
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
        paddingBottom: '14px'
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('leaderboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer',
              border: activeSubTab === 'leaderboard' ? '1.5px solid #f59e0b' : '1px solid var(--border-subtle, #e2e8f0)',
              background: activeSubTab === 'leaderboard' ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-1, #ffffff)',
              color: activeSubTab === 'leaderboard' ? '#d97706' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={16} />
            <span>Рейтинг операторів</span>
            <span style={{
              background: activeSubTab === 'leaderboard' ? '#f59e0b' : 'var(--border-subtle, #e2e8f0)',
              color: activeSubTab === 'leaderboard' ? '#ffffff' : 'var(--text-muted, #64748b)',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 950
            }}>
              {operatorsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('parts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer',
              border: activeSubTab === 'parts' ? '1.5px solid #f59e0b' : '1px solid var(--border-subtle, #e2e8f0)',
              background: activeSubTab === 'parts' ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-1, #ffffff)',
              color: activeSubTab === 'parts' ? '#d97706' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s ease'
            }}
          >
            <Sliders size={16} />
            <span>Порівняння по деталях</span>
            <span style={{
              background: activeSubTab === 'parts' ? '#f59e0b' : 'var(--border-subtle, #e2e8f0)',
              color: activeSubTab === 'parts' ? '#ffffff' : 'var(--text-muted, #64748b)',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 950
            }}>
              {partsComparison.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('handovers')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer',
              border: activeSubTab === 'handovers' ? '1.5px solid #f59e0b' : '1px solid var(--border-subtle, #e2e8f0)',
              background: activeSubTab === 'handovers' ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-1, #ffffff)',
              color: activeSubTab === 'handovers' ? '#d97706' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCw size={16} />
            <span>Журнал перезмінок ЧПК</span>
            <span style={{
              background: activeSubTab === 'handovers' ? '#f59e0b' : 'var(--border-subtle, #e2e8f0)',
              color: activeSubTab === 'handovers' ? '#ffffff' : 'var(--text-muted, #64748b)',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 950
            }}>
              {shiftChangesLog.length}
            </span>
          </button>
        </div>

        {/* Quick Search Input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder={
              activeSubTab === 'leaderboard' ? 'Пошук оператора...' :
              activeSubTab === 'parts' ? 'Пошук деталі чи артикулу...' :
              'Пошук у перезмінках...'
            }
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle, #cbd5e1)',
              background: 'var(--surface-inset, #f8fafc)',
              color: 'var(--text-strong, #0f172a)',
              fontSize: '0.84rem',
              fontWeight: 700,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. SUBTAB CONTENT
          ══════════════════════════════════════════════════════════════════════ */}

      {/* ──────────────────────────────────────────────────────────────────
          SUBTAB 1: LEADERBOARD OF OPERATORS
          ────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'leaderboard' && (
        <div className="glass-panel" style={{
          background: 'var(--surface-1, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          {filteredOperators.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <Users size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Не знайдено сесій розкрою за обраний період</div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Спробуйте розширити діапазон дат або скинути фільтри</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-inset, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', width: '60px' }}>#</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Оператор</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Зміна</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center' }}>Карт / Сесій</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>План (год)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>Факт (год)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>Баланс (+/- год)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center', width: '140px' }}>Ефективність</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOperators.map((op, idx) => {
                    const isExpanded = expandedOperator === op.operatorName
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null

                    return (
                      <React.Fragment key={op.operatorName}>
                        <tr
                          onClick={() => toggleOperator(op.operatorName)}
                          style={{
                            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                            cursor: 'pointer',
                            background: isExpanded ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '14px 16px', fontWeight: 950, color: medal ? '#b45309' : 'var(--text-muted)' }}>
                            {medal ? `${medal} ${idx + 1}` : `#${idx + 1}`}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-strong, #0f172a)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{op.operatorName}</span>
                              {op.sessionsCount >= 5 && op.avgEfficiencyPercent >= 105 && (
                                <span title="Високоефективний майстер" style={{ fontSize: '0.85rem' }}>🔥</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              background: 'var(--surface-inset, #f1f5f9)',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              color: 'var(--text-muted)'
                            }}>
                              {op.shiftName}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800 }}>
                            <span style={{ color: 'var(--text-strong)' }}>{op.cardsCount}</span>
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}> / {op.sessionsCount}</span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: '#3b82f6' }}>
                            {op.totalPlanHours} год
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--text-strong)' }}>
                            {op.totalFactHours} год
                          </td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'right',
                            fontWeight: 950,
                            color: op.deltaHours >= 0 ? '#16a34a' : '#ef4444'
                          }}>
                            {op.deltaHours >= 0 ? `+${op.deltaHours}` : op.deltaHours} год
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {getKpiBadge(op.avgEfficiencyPercent, op.status)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </td>
                        </tr>

                        {/* Drilldown accordion row */}
                        {isExpanded && (
                          <tr style={{ background: 'var(--surface-inset, #f8fafc)' }}>
                            <td colSpan={9} style={{ padding: '18px 22px', borderBottom: '1.5px solid rgba(245, 158, 11, 0.3)' }}>
                              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Sparkles size={16} />
                                  <span>Історія роботи та перезмінок оператора {op.operatorName} ({op.sessions.length} записів):</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                  Унікальних деталей: {op.parts.length}
                                </div>
                              </div>

                              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-subtle, #cbd5e1)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: '#ffffff' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--surface-inset, #f1f5f9)', borderBottom: '1px solid var(--border-subtle)' }}>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)' }}>Дата</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)' }}>Картка</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)' }}>Деталь</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)' }}>Верстат & Листи</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)' }}>Виконані операції</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>План</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>Факт</th>
                                      <th style={{ padding: '8px 12px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center' }}>KPI</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {op.sessions.map((s, si) => (
                                      <tr key={s.id || si} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>
                                          {s.date ? new Date(s.date).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 900 }}>
                                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.74rem' }}>
                                            {s.cardCode}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 800 }}>
                                          <div>{s.nomenclatureName}</div>
                                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.nomenclatureCode}</div>
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                          <div style={{ fontWeight: 800, color: '#b45309' }}>{s.machineName}</div>
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {s.sheetCount} {s.sheetCount === 1 ? 'лист' : s.sheetCount < 5 ? 'листи' : 'листів'}
                                          </div>
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                          {s.isHandover ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>
                                                Перезмінка
                                              </span>
                                              <span style={{ fontSize: '0.74rem', color: 'var(--text-strong)' }}>
                                                до {s.currentEndOp} ({s.operationsCount} оп.)
                                              </span>
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 800 }}>
                                              Завершення картки ({s.operationsCount || 'всі'} оп.)
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: s.hasPlan ? '#3b82f6' : 'var(--text-muted)' }}>
                                          {s.hasPlan ? formatMinutesToHours(s.planMinutes) : '—'}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: 'var(--text-strong)' }}>
                                          {formatMinutesToHours(s.factMinutes)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                          {getKpiBadge(s.efficiencyPercent, s.status)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
      )}

      {/* ──────────────────────────────────────────────────────────────────
          SUBTAB 2: HEAD-TO-HEAD COMPARISON BY PART (NOMENCLATURE)
          ────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'parts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '14px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Sliders size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-strong, #0f172a)', lineHeight: 1.4 }}>
              <strong>Аналіз швидкості виконання однакових деталей різними операторами:</strong> Тут відображено порівняння операторів, які різали ту саму деталь у різні зміни чи дні. Ви можете бачити середній фактичний час на деталь, ефективність кожного оператора та виявляти лідерів і відстаючих.
            </div>
          </div>

          {filteredParts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)', borderRadius: '18px' }}>
              <Sliders size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Немає даних по деталях за обраний період</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredParts.map(part => {
                const isExpanded = expandedPart === part.nomenclatureId
                const hasMultipleOperators = part.operators.length > 1

                return (
                  <div
                    key={part.nomenclatureId || part.nomenclatureName}
                    className="glass-panel"
                    style={{
                      background: 'var(--surface-1, #ffffff)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Part Header */}
                    <div
                      onClick={() => togglePart(part.nomenclatureId)}
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                        borderBottom: isExpanded ? '1px solid var(--border-subtle, #e2e8f0)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🧩</span>
                        <div>
                          <div style={{ fontSize: '0.96rem', fontWeight: 950, color: 'var(--text-strong, #0f172a)' }}>
                            {part.nomenclatureName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted, #64748b)', background: 'var(--surface-inset, #f1f5f9)', padding: '1px 6px', borderRadius: '4px' }}>
                              {part.nomenclatureCode}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim, #94a3b8)', fontWeight: 700 }}>
                              • Запусків: {part.totalRuns}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim, #94a3b8)', fontWeight: 700 }}>
                              • Операторів: {part.operators.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {hasMultipleOperators && part.fastestOperator && (
                          <div style={{ textAlign: 'right', display: 'none', mdDisplay: 'block' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Найшвидший виконавець:
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#16a34a' }}>
                              ⚡ {part.fastestOperator.operatorName} ({part.fastestOperator.efficiencyPercent}%)
                            </div>
                          </div>
                        )}

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Загальна точність норми:
                          </div>
                          <div>{getKpiBadge(part.overallEfficiencyPercent)}</div>
                        </div>

                        <div style={{ color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Operator comparison table inside part */}
                    {isExpanded && (
                      <div style={{ padding: '16px 20px', background: 'var(--surface-inset, #f8fafc)' }}>
                        <div style={{ marginBottom: '10px', fontSize: '0.78rem', fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Порівняльна таблиця операторів для деталі «{part.nomenclatureName}»:
                        </div>

                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-subtle, #cbd5e1)', background: '#ffffff' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--surface-inset, #f1f5f9)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)' }}>Оператор</th>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)' }}>Зміна</th>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center' }}>К-сть запусків</th>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>Сер. факт час</th>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>Сер. план час</th>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center' }}>Ефективність</th>
                                <th style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center' }}>Статус на деталі</th>
                              </tr>
                            </thead>
                            <tbody>
                              {part.operators.map((op, opIdx) => {
                                const isFastest = part.fastestOperator?.operatorName === op.operatorName && part.operators.length > 1
                                const isSlowest = part.slowestOperator?.operatorName === op.operatorName && part.operators.length > 1 && !isFastest

                                return (
                                  <tr key={op.operatorName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--text-strong)' }}>
                                      {op.operatorName}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                      {op.shiftName}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>
                                      {op.runsCount}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: 'var(--text-strong)' }}>
                                      {formatMinutesToHours(op.avgFactMinutes)}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#3b82f6' }}>
                                      {formatMinutesToHours(op.avgPlanMinutes)}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      {getKpiBadge(op.efficiencyPercent, op.status)}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      {isFastest ? (
                                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900 }}>
                                          ⚡ Найшвидший
                                        </span>
                                      ) : isSlowest ? (
                                        <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900 }}>
                                          ⏳ Відставання
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          SUBTAB 3: SHIFT HANDOVERS LOG (ЖУРНАЛ ПЕРЕЗМІНОК ЧПК)
          ────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'handovers' && (
        <div className="glass-panel" style={{
          background: 'var(--surface-1, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          {filteredHandovers.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <RotateCw size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Не знайдено подій перезмінки за обраний період</div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Події перезмінки фіксуються, коли оператор здає картку на зміні через термінал ЧПК</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-inset, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Час передачі</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Картка</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Деталь</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Здав зміну ➡️ Прийняв</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)' }}>Відмітка зупинки ([LAST_OP])</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>План відрізку</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'right' }}>Факт відрізку</th>
                    <th style={{ padding: '14px 16px', fontWeight: 900, color: 'var(--text-muted)', textAlign: 'center' }}>Ефективність</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHandovers.map((h, hi) => (
                    <tr key={h.id || hi} style={{ borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {h.date ? new Date(h.date).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 900 }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.76rem' }}>
                          {h.cardCode}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 900, color: 'var(--text-strong)' }}>{h.nomenclatureName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{h.nomenclatureCode}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                          <span style={{ color: 'var(--text-strong)' }}>{h.operatorName}</span>
                          <span style={{ color: '#d97706' }}>➡️</span>
                          <span style={{ color: '#0369a1' }}>{h.replacedBy}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          {h.shiftName} • {h.machineName}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          display: 'inline-block'
                        }}>
                          <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#b45309' }}>
                            📍 {h.rawHandoverText}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            Виконано операцій: {h.operationsCount}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: h.hasPlan ? '#3b82f6' : 'var(--text-muted)' }}>
                        {h.hasPlan ? formatMinutesToHours(h.planMinutes) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--text-strong)' }}>
                        {formatMinutesToHours(h.factMinutes)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {getKpiBadge(h.efficiencyPercent, h.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

