import React from 'react'
import { ArrowLeft, Clock3, RefreshCw, Search, ShieldCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'

export const VKYARestorationHeader = ({
  tab,
  setTab,
  query,
  setQuery,
  loading,
  loadCards,
  activeCount,
  awaitingCount,
  completedCount,
  legacyCount
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link to="/brak" style={{ color: 'var(--text-muted, #888)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '.85rem' }}>
          <ArrowLeft size={18}/> До ВКЯ
        </Link>
        <div style={{ width: 1, height: 24, background: 'var(--glass-border, #333)' }}/>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', display: 'grid', placeItems: 'center', color: '#06b6d4' }}>
          <Wrench size={22}/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950, letterSpacing: '-0.02em', color: 'var(--text, #fff)' }}>
            Термінал відновлення деталей
          </h1>
          <div style={{ color: 'var(--text-muted, #777)', fontSize: '.78rem', marginTop: 2 }}>
            Облік та відновлення бракованої продукції ВКЯ
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--card-bg, #121212)', border: '1px solid var(--glass-border, #222)', borderRadius: 12, padding: 4 }}>
          <button onClick={() => setTab('active')} className={`vkya-tab-btn ${tab === 'active' ? 'active' : ''}`}>
            <Clock3 size={15}/> В роботі ({activeCount})
          </button>
          <button onClick={() => setTab('awaiting_action')} className={`vkya-tab-btn ${tab === 'awaiting_action' ? 'active' : ''}`}>
            <Wrench size={15}/> Очікує дії ({awaitingCount})
          </button>
          <button onClick={() => setTab('completed')} className={`vkya-tab-btn ${tab === 'completed' ? 'active' : ''}`}>
            <ShieldCheck size={15}/> Завершено ({completedCount})
          </button>
          <button onClick={() => setTab('legacy')} className={`vkya-tab-btn ${tab === 'legacy' ? 'active' : ''}`}>
            📦 Старий облік ({legacyCount})
          </button>
        </div>

        <div style={{ position: 'relative', width: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #666)' }}/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук карти..."
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg, #121212)', border: '1px solid var(--glass-border, #222)', borderRadius: 10, color: 'var(--text, #fff)', padding: '8px 12px 8px 34px', fontSize: '.82rem' }}
          />
        </div>

        <button onClick={loadCards} disabled={loading} style={{ background: 'var(--card-bg, #121212)', border: '1px solid var(--glass-border, #222)', color: 'var(--text, #fff)', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''}/>
        </button>
      </div>
    </div>
  )
}

export default VKYARestorationHeader
