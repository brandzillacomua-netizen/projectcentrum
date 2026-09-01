import React, { useState, useMemo } from 'react'
import { TrendingUp, Sliders, DollarSign, Award, ArrowUpRight, BarChart2, PieChart, Sparkles } from 'lucide-react'

export const MarginAnalyticsTab = ({
  nomenclatures = [],
  orders = [],
  calculateItemCost
}) => {
  // Simulator State: What-if price hike in Raw Materials (%)
  const [steelPriceHikePercent, setSteelPriceHikePercent] = useState(15)
  const [laborPriceHikePercent, setLaborPriceHikePercent] = useState(10)

  // Overall Margin analytics across all nomenclatures
  const itemCostSummaries = useMemo(() => {
    return nomenclatures.map(item => {
      const c = calculateItemCost(item.id)
      return { item, c }
    }).filter(x => x.c)
  }, [nomenclatures, calculateItemCost])

  const overallAvgMargin = useMemo(() => {
    if (itemCostSummaries.length === 0) return 0
    const sum = itemCostSummaries.reduce((acc, x) => acc + x.c.marginPercentage, 0)
    return Math.round(sum / itemCostSummaries.length)
  }, [itemCostSummaries])

  // Simulated Scenario Results
  const simulatedSummaries = useMemo(() => {
    const rawMultiplier = 1 + (steelPriceHikePercent / 100)
    const laborMultiplier = 1 + (laborPriceHikePercent / 100)

    return itemCostSummaries.map(({ item, c }) => {
      const simMaterial = Math.round(c.materialCost * rawMultiplier)
      const simLabor = Math.round(c.directLaborCost * laborMultiplier)
      const simOverhead = Math.round((simMaterial + simLabor) * 0.15)
      const simTotalCOGS = simMaterial + simLabor + simOverhead
      const simRecPrice = Math.round(simTotalCOGS / (1 - 0.35))
      const priceDelta = simRecPrice - c.recommendedPrice

      return {
        item,
        originalCOGS: c.totalUnitCost,
        originalPrice: c.recommendedPrice,
        simTotalCOGS,
        simRecPrice,
        priceDelta
      }
    })
  }, [itemCostSummaries, steelPriceHikePercent, laborPriceHikePercent])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Executive Financial Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* KPI 1 */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Середня Маржинальність
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#10b981', marginTop: '2px' }}>
              {overallAvgMargin}%
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.18)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Кількість Позицій
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#6366f1', marginTop: '2px' }}>
              {nomenclatures.length} шт
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 144, 0, 0.18)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Активні Прайс-листи
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
              3 типи ціни
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Simulator Section */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '22px', background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.05))', border: '1px solid #6366f1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Sparkles size={22} color="#6366f1" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 950, color: 'var(--text)' }}>
              Економічний Симулятор «Що якщо...?»
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Моделювання впливу зміни цін сировини та зарплати на підсумкову ціну продукції
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {/* Slider 1: Raw Material Price Hike */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 900, marginBottom: '8px' }}>
              <span>Здорожчання Металу / Сировини:</span>
              <span style={{ color: '#ef4444' }}>+{steelPriceHikePercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={steelPriceHikePercent}
              onChange={(e) => setSteelPriceHikePercent(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }}
            />
          </div>

          {/* Slider 2: Labor Cost Hike */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 900, marginBottom: '8px' }}>
              <span>Зростання Тарифів Заробітної Плати:</span>
              <span style={{ color: '#ff9000' }}>+{laborPriceHikePercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={laborPriceHikePercent}
              onChange={(e) => setLaborPriceHikePercent(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#ff9000', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Simulation Table Preview */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px' }}>Позиція Номенклатури</th>
                <th style={{ padding: '10px' }}>Поточна Собівартість</th>
                <th style={{ padding: '10px' }}>Собівартість після Інфляції</th>
                <th style={{ padding: '10px' }}>Поточна Ціна</th>
                <th style={{ padding: '10px' }}>Нова Необхідна Ціна</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Необхідна Коригування</th>
              </tr>
            </thead>
            <tbody>
              {simulatedSummaries.slice(0, 10).map(({ item, originalCOGS, originalPrice, simTotalCOGS, simRecPrice, priceDelta }) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px', fontWeight: 900 }}>{item.name}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>₴{originalCOGS}</td>
                  <td style={{ padding: '10px', color: '#ef4444', fontWeight: 900 }}>₴{simTotalCOGS}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>₴{originalPrice}</td>
                  <td style={{ padding: '10px', color: '#10b981', fontWeight: 950 }}>₴{simRecPrice}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 950, color: '#10b981' }}>
                    +₴{priceDelta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
