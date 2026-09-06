import React from 'react'
import { LayoutDashboard, Search, RefreshCw } from 'lucide-react'

export const DashboardFilterControls = ({
  searchQuery,
  setSearchQuery,
  wipOnly,
  setWipOnly,
  isRefreshing,
  handleRefresh
}) => {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '25px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 950, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text, #ffffff)', letterSpacing: '0.5px' }}>
            <LayoutDashboard style={{ color: '#ff9000' }} size={24} /> ДАШБОРД ВИРОБНИЦТВА (WIP)
          </h2>
          <p style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.78rem', margin: 0 }}>Розподіл деталей та напівфабрикатів за етапами технологічного ланцюжка</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{ background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, #27272a)', color: '#fff', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', fontSize: '0.85rem' }}
          >
            <RefreshCw className={isRefreshing ? 'anim-spin' : ''} size={16} />
            <span>Оновити дані</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: 'var(--bg, #09090b)', padding: '15px 20px', borderRadius: '18px', marginBottom: '20px', border: '1px solid var(--glass-border, #27272a)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
          <input
            type="text"
            placeholder="Пошук деталі за назвою або кодом..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 15px 12px 42px', background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, #27272a)', borderRadius: '12px', color: '#fff', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = '#ff9000'}
            onBlur={e => e.target.style.borderColor = '#27272a'}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted, #a1a1aa)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={wipOnly}
            onChange={e => setWipOnly(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#ff9000', cursor: 'pointer' }}
          />
          <span>Тільки ті, на які є замовлення</span>
        </label>
      </div>
    </>
  )
}
