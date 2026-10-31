import React, { useState } from 'react'
import { Award, TrendingUp, AlertTriangle, Cpu, Eye, Sparkles, Filter, ChevronRight } from 'lucide-react'

export const TeamLeaderboard = ({
  operators = [],
  aiInsights = [],
  onSelectOperator
}) => {
  const [tierFilter, setTierFilter] = useState('ALL') // 'ALL' | 'S' | 'A' | 'B' | 'C'

  const filteredOperators = operators.filter(o => {
    if (tierFilter === 'ALL') return true
    return o.tier === tierFilter
  })

  // Summary figures
  const totalProduced = operators.reduce((s, o) => s + o.producedQty, 0)
  const totalScrap = operators.reduce((s, o) => s + o.scrapQty, 0)
  const avgScrapRate = totalProduced + totalScrap > 0 ? Math.round((totalScrap / (totalProduced + totalScrap)) * 1000) / 10 : 0
  const speeds = operators.map(o => o.unitsPerHour).filter(s => s > 0)
  const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 0

  return (
    <div className="leaderboard-container">
      {/* Top High-level KPIs */}
      <div className="leaderboard-kpi-row">
        <div className="lb-kpi-card">
          <span className="lb-kpi-label">АКТИВНИХ ПРАЦІВНИКІВ</span>
          <span className="lb-kpi-val text-white">{operators.length} чол</span>
          <span className="lb-kpi-sub">Зафіксовано в системі</span>
        </div>

        <div className="lb-kpi-card">
          <span className="lb-kpi-label">СУМАРНИЙ ВИПУСК</span>
          <span className="lb-kpi-val text-green">{totalProduced.toLocaleString()} шт</span>
          <span className="lb-kpi-sub">Готових виробів та деталей</span>
        </div>

        <div className="lb-kpi-card">
          <span className="lb-kpi-label">СЕРЕДНЯ ШВИДКІСТЬ</span>
          <span className="lb-kpi-val text-amber">{avgSpeed} шт/год</span>
          <span className="lb-kpi-sub">Чистий робочий темп цехів</span>
        </div>

        <div className="lb-kpi-card">
          <span className="lb-kpi-label">СЕРЕДНІЙ РІВЕНЬ БРАКУ</span>
          <span className={`lb-kpi-val ${avgScrapRate > 2.5 ? 'text-red' : 'text-green'}`}>
            {avgScrapRate}%
          </span>
          <span className="lb-kpi-sub">{totalScrap.toLocaleString()} шт списано</span>
        </div>
      </div>

      {/* AI Strategic Insights Carousel / Grid */}
      {aiInsights.length > 0 && (
        <div className="lb-ai-insights-section">
          <div className="lb-ai-title">
            <Sparkles size={16} className="text-amber-400" />
            <span>AI АНАЛІТИКА ТА ОПЕРАТИВНІ ВИСНОВКИ ДИРЕКТОРУ:</span>
          </div>

          <div className="lb-ai-grid">
            {aiInsights.map((ins, idx) => (
              <div
                key={idx}
                className={`lb-ai-card type-${ins.type}`}
                onClick={() => {
                  if (ins.operatorName) {
                    const found = operators.find(o => o.name === ins.operatorName)
                    if (found) onSelectOperator(found)
                  }
                }}
              >
                <div className="ai-card-badge">{ins.badge}</div>
                <h4 className="ai-card-title">{ins.title}</h4>
                <p className="ai-card-desc">{ins.desc}</p>
                {ins.actionLabel && (
                  <div className="ai-card-action">
                    <span>{ins.actionLabel}</span>
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Filter Tabs */}
      <div className="lb-table-header-bar">
        <div className="lb-tier-filters">
          <button
            className={`tier-pill ${tierFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setTierFilter('ALL')}
          >
            Всі класи ({operators.length})
          </button>
          <button
            className={`tier-pill pill-s ${tierFilter === 'S' ? 'active' : ''}`}
            onClick={() => setTierFilter('S')}
          >
            ⭐ S-Tier (Лідер)
          </button>
          <button
            className={`tier-pill pill-a ${tierFilter === 'A' ? 'active' : ''}`}
            onClick={() => setTierFilter('A')}
          >
            🟢 A-Tier (Надійні)
          </button>
          <button
            className={`tier-pill pill-b ${tierFilter === 'B' ? 'active' : ''}`}
            onClick={() => setTierFilter('B')}
          >
            🟡 B-Tier (Увага)
          </button>
          <button
            className={`tier-pill pill-c ${tierFilter === 'C' ? 'active' : ''}`}
            onClick={() => setTierFilter('C')}
          >
            🔴 C-Tier (Ризик)
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>#</th>
              <th style={{ width: '22%' }}>Працівник</th>
              <th style={{ width: '10%' }}>Клас (Tier)</th>
              <th style={{ width: '14%' }}>ККД Рейтинг</th>
              <th style={{ width: '12%' }}>Швидкість</th>
              <th style={{ width: '12%' }}>Виробіток</th>
              <th style={{ width: '10%' }}>Брак</th>
              <th style={{ width: '8%' }}>Простої</th>
              <th style={{ width: '8%' }}>Дії</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperators.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Немає працівників за заданими критеріями фільтру
                </td>
              </tr>
            ) : (
              filteredOperators.map((op, idx) => (
                <tr key={op.name} onClick={() => onSelectOperator(op)} className="lb-row-clickable">
                  <td className="rank-cell">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </td>

                  <td>
                    <div className="op-info-cell">
                      <span className="op-name">{op.name}</span>
                      <span className="op-sub">{op.position} • {op.shift}</span>
                    </div>
                  </td>

                  <td>
                    <span className="op-tier-badge" style={{ color: op.tierColor, borderColor: op.tierColor }}>
                      {op.tierBadge} {op.tier}
                    </span>
                  </td>

                  <td>
                    <div className="op-score-wrap">
                      <div className="op-score-bar">
                        <div
                          className="op-score-fill"
                          style={{
                            width: `${op.compositeScore}%`,
                            background: op.tierColor
                          }}
                        />
                      </div>
                      <span className="op-score-val">{op.compositeScore}/100</span>
                    </div>
                  </td>

                  <td>
                    <span className="op-speed-val font-mono">{op.unitsPerHour} шт/год</span>
                  </td>

                  <td>
                    <span className="op-qty-val font-mono">{op.producedQty.toLocaleString()} шт</span>
                  </td>

                  <td>
                    <span className={`op-scrap-val font-mono ${op.scrapRate > 3 ? 'text-red' : 'text-green'}`}>
                      {op.scrapRate}%
                    </span>
                  </td>

                  <td>
                    <span className="op-pause-val font-mono text-dim">{op.pauseHours} год</span>
                  </td>

                  <td>
                    <button
                      className="btn-open-dossier"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectOperator(op)
                      }}
                      title="Відкрити детальне досьє"
                    >
                      <Eye size={14} />
                      <span>Досьє</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

