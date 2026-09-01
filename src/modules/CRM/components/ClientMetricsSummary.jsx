import React from 'react'
import { Users, TrendingUp, DollarSign, Crown, Award, ShoppingBag } from 'lucide-react'

export const ClientMetricsSummary = ({ summaryMetrics }) => {
  const {
    totalClientsCount = 0,
    totalRevenueSum = 0,
    totalOrdersCount = 0,
    overallAvgCheck = 0,
    vipCount = 0
  } = summaryMetrics || {}

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    }}>
      {/* Metric 1: Всього Клієнтів */}
      <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            База Клієнтів
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 950, color: '#6366f1' }}>
            {totalClientsCount} замовників
          </div>
        </div>
      </div>

      {/* Metric 2: Загальний LTV / Вал */}
      <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Загальний LTV (Вал)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 950, color: '#10b981' }}>
            {totalRevenueSum > 0 ? `₴${totalRevenueSum.toLocaleString()}` : '₴0'}
          </div>
        </div>
      </div>

      {/* Metric 3: Середній Чек */}
      <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Середній Чек
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 950, color: '#ff9000' }}>
            {overallAvgCheck > 0 ? `₴${overallAvgCheck.toLocaleString()}` : 'Без цін'}
          </div>
        </div>
      </div>

      {/* Metric 4: VIP Клієнти */}
      <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Crown size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            VIP Сегмент
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 950, color: '#ec4899' }}>
            {vipCount} компаній
          </div>
        </div>
      </div>
    </div>
  )
}
