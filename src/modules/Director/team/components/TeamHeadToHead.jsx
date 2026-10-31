import React, { useState } from 'react'
import { ArrowRightLeft, Award, Sparkles, Check, AlertTriangle, TrendingUp } from 'lucide-react'

export const TeamHeadToHead = ({ operators = [], shifts = [] }) => {
  const [mode, setMode] = useState('operators') // 'operators' | 'shifts'
  const [op1Name, setOp1Name] = useState(operators[0]?.name || '')
  const [op2Name, setOp2Name] = useState(operators[1]?.name || operators[0]?.name || '')

  const op1 = operators.find(o => o.name === op1Name) || operators[0]
  const op2 = operators.find(o => o.name === op2Name) || operators[1] || operators[0]

  return (
    <div className="head-to-head-container">
      {/* Mode Switcher */}
      <div className="h2h-mode-bar">
        <button
          className={`h2h-mode-btn ${mode === 'operators' ? 'active' : ''}`}
          onClick={() => setMode('operators')}
        >
          <ArrowRightLeft size={14} /> <span>Порівняння працівників</span>
        </button>
        <button
          className={`h2h-mode-btn ${mode === 'shifts' ? 'active' : ''}`}
          onClick={() => setMode('shifts')}
        >
          <TrendingUp size={14} /> <span>Бенчмарк змін (Зміна 1 vs 2 vs 3)</span>
        </button>
      </div>

      {mode === 'operators' ? (
        <>
          {/* Operator Selectors */}
          <div className="h2h-selectors-row">
            <div className="h2h-select-box">
              <label>Працівник №1:</label>
              <select value={op1Name} onChange={e => setOp1Name(e.target.value)}>
                {operators.map(o => (
                  <option key={o.name} value={o.name}>
                    {o.tierBadge} {o.name} ({o.unitsPerHour} шт/год)
                  </option>
                ))}
              </select>
            </div>

            <div className="h2h-vs-badge">VS</div>

            <div className="h2h-select-box">
              <label>Працівник №2:</label>
              <select value={op2Name} onChange={e => setOp2Name(e.target.value)}>
                {operators.map(o => (
                  <option key={o.name} value={o.name}>
                    {o.tierBadge} {o.name} ({o.unitsPerHour} шт/год)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {op1 && op2 && (
            <div className="h2h-cards-grid">
              {/* Profile Card 1 */}
              <div className="h2h-operator-card" style={{ borderTopColor: op1.tierColor }}>
                <div className="h2h-card-badge">{op1.tierBadge} {op1.tierLabel}</div>
                <h3>{op1.name}</h3>
                <span className="h2h-card-role">{op1.position} • {op1.shift}</span>
                <div className="h2h-score-tag">ККД: {op1.compositeScore}/100</div>
              </div>

              {/* Profile Card 2 */}
              <div className="h2h-operator-card" style={{ borderTopColor: op2.tierColor }}>
                <div className="h2h-card-badge">{op2.tierBadge} {op2.tierLabel}</div>
                <h3>{op2.name}</h3>
                <span className="h2h-card-role">{op2.position} • {op2.shift}</span>
                <div className="h2h-score-tag">ККД: {op2.compositeScore}/100</div>
              </div>

              {/* Comparison Metrics Table */}
              <div className="h2h-table-wrap">
                <table className="h2h-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '35%' }}>Показник</th>
                      <th style={{ textAlign: 'center', width: '25%' }}>{op1.name}</th>
                      <th style={{ textAlign: 'center', width: '25%' }}>{op2.name}</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Перевага</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="metric-title">Швидкість випуску</td>
                      <td className={`val-cell ${op1.unitsPerHour >= op2.unitsPerHour ? 'win' : ''}`}>
                        {op1.unitsPerHour} шт/год
                      </td>
                      <td className={`val-cell ${op2.unitsPerHour >= op1.unitsPerHour ? 'win' : ''}`}>
                        {op2.unitsPerHour} шт/год
                      </td>
                      <td className="lead-cell">
                        {op1.unitsPerHour > op2.unitsPerHour ? `+${op1.unitsPerHour - op2.unitsPerHour} (№1)` : op2.unitsPerHour > op1.unitsPerHour ? `+${op2.unitsPerHour - op1.unitsPerHour} (№2)` : 'Рівно'}
                      </td>
                    </tr>

                    <tr>
                      <td className="metric-title">Відсоток браку (якість)</td>
                      <td className={`val-cell ${op1.scrapRate <= op2.scrapRate ? 'win' : 'lose'}`}>
                        {op1.scrapRate}% ({op1.scrapQty} шт)
                      </td>
                      <td className={`val-cell ${op2.scrapRate <= op1.scrapRate ? 'win' : 'lose'}`}>
                        {op2.scrapRate}% ({op2.scrapQty} шт)
                      </td>
                      <td className="lead-cell">
                        {op1.scrapRate < op2.scrapRate ? '№1 якісніше' : op2.scrapRate < op1.scrapRate ? '№2 якісніше' : 'Рівно'}
                      </td>
                    </tr>

                    <tr>
                      <td className="metric-title">Загальний виробіток</td>
                      <td className={`val-cell ${op1.producedQty >= op2.producedQty ? 'win' : ''}`}>
                        {op1.producedQty.toLocaleString()} шт
                      </td>
                      <td className={`val-cell ${op2.producedQty >= op1.producedQty ? 'win' : ''}`}>
                        {op2.producedQty.toLocaleString()} шт
                      </td>
                      <td className="lead-cell">
                        {op1.producedQty > op2.producedQty ? '№1' : op2.producedQty > op1.producedQty ? '№2' : 'Рівно'}
                      </td>
                    </tr>

                    <tr>
                      <td className="metric-title">Час на простоях / паузах</td>
                      <td className={`val-cell ${op1.pauseHours <= op2.pauseHours ? 'win' : ''}`}>
                        {op1.pauseHours} год ({op1.downtimeRatio}%)
                      </td>
                      <td className={`val-cell ${op2.pauseHours <= op1.pauseHours ? 'win' : ''}`}>
                        {op2.pauseHours} год ({op2.downtimeRatio}%)
                      </td>
                      <td className="lead-cell">
                        {op1.pauseHours < op2.pauseHours ? '№1 менше стоїть' : op2.pauseHours < op1.pauseHours ? '№2 менше стоїть' : 'Рівно'}
                      </td>
                    </tr>

                    <tr>
                      <td className="metric-title">Оброблено робочих карт</td>
                      <td className="val-cell">{op1.cardsCount} карт</td>
                      <td className="val-cell">{op2.cardsCount} карт</td>
                      <td className="lead-cell">{op1.cardsCount >= op2.cardsCount ? '№1' : '№2'}</td>
                    </tr>

                    <tr>
                      <td className="metric-title">Ефективний верстат</td>
                      <td className="val-cell font-mono">{op1.topMachine}</td>
                      <td className="val-cell font-mono">{op2.topMachine}</td>
                      <td className="lead-cell">—</td>
                    </tr>

                    <tr>
                      <td className="metric-title">Основний виріб</td>
                      <td className="val-cell text-dim" style={{ fontSize: '0.72rem' }}>{op1.topNom}</td>
                      <td className="val-cell text-dim" style={{ fontSize: '0.72rem' }}>{op2.topNom}</td>
                      <td className="lead-cell">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* AI Head to Head Verdict */}
              <div className="h2h-ai-verdict">
                <div className="verdict-head">
                  <Sparkles size={16} className="text-amber-400" />
                  <span>AI ВЕРДИКТ ДИРЕКТОРУ:</span>
                </div>
                <p>
                  {op1.compositeScore > op2.compositeScore ? (
                    <>
                      <strong>{op1.name}</strong> переважає за сукупним ККД (<strong>{op1.compositeScore}</strong> проти <strong>{op2.compositeScore}</strong>). 
                      {op1.scrapRate < op2.scrapRate && ` Має на ${Math.round((op2.scrapRate - op1.scrapRate) * 10) / 10}% чистіший випуск без браку.`}
                      {op1.unitsPerHour > op2.unitsPerHour && ` Швидкість вища на ${op1.unitsPerHour - op2.unitsPerHour} шт/год.`}
                      {` Рекомендовано ставити ${op1.name} на пріоритетні та гарячі замовлення.`}
                    </>
                  ) : op2.compositeScore > op1.compositeScore ? (
                    <>
                      <strong>{op2.name}</strong> переважає за сукупним ККД (<strong>{op2.compositeScore}</strong> проти <strong>{op1.compositeScore}</strong>).
                      {op2.scrapRate < op1.scrapRate && ` Має на ${Math.round((op1.scrapRate - op2.scrapRate) * 10) / 10}% чистіший випуск без браку.`}
                      {op2.unitsPerHour > op1.unitsPerHour && ` Швидкість вища на ${op2.unitsPerHour - op1.unitsPerHour} шт/год.`}
                      {` Рекомендовано ставити ${op2.name} на пріоритетні та гарячі замовлення.`}
                    </>
                  ) : (
                    <>Обидва оператори показують абсолютно рівний рівень майстерності (ККД {op1.compositeScore}/100).</>
                  )}
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Shifts Benchmark */
        <div className="shifts-benchmark-grid">
          {shifts.map(sh => (
            <div key={sh.name} className="shift-card">
              <div className="shift-card-header">
                <h3>{sh.name}</h3>
                <span className="shift-operators-count">{sh.operatorCount} операторів</span>
              </div>

              <div className="shift-metrics-list">
                <div className="shift-metric-item">
                  <span className="sh-label">Загальний випуск:</span>
                  <span className="sh-val text-green">{sh.produced.toLocaleString()} шт</span>
                </div>
                <div className="shift-metric-item">
                  <span className="sh-label">Середня швидкість:</span>
                  <span className="sh-val text-amber">{sh.speed} шт/год</span>
                </div>
                <div className="shift-metric-item">
                  <span className="sh-label">Відсоток браку:</span>
                  <span className={`sh-val ${sh.scrapRate > 3 ? 'text-red' : 'text-green'}`}>
                    {sh.scrapRate}% ({sh.scrap} шт)
                  </span>
                </div>
                <div className="shift-metric-item">
                  <span className="sh-label">Відпрацьовано годин:</span>
                  <span className="sh-val">{sh.activeHours} год</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

