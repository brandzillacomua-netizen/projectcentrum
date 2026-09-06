import React from 'react'
import { Plus, Search, Settings } from 'lucide-react'

export const CrmControlBar = ({
  selectedStageFilter,
  setSelectedStageFilter,
  leads,
  stages,
  searchQuery,
  setSearchQuery,
  openStageModalForCreate,
  openLeadModalForCreate
}) => {
  return (
    <div className="glass-panel" style={{
      padding: '12px 16px',
      borderRadius: '16px',
      marginBottom: '25px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      background: 'var(--card-bg, rgba(255,255,255,0.03))',
      border: '1px solid var(--glass-border)',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Stage Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', alignItems: 'center', paddingBottom: '2px' }}>
        <button
          onClick={() => setSelectedStageFilter('all')}
          style={{
            padding: '7px 12px',
            borderRadius: '10px',
            border: selectedStageFilter === 'all' ? '1px solid #6366f1' : '1px solid var(--glass-border)',
            background: selectedStageFilter === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: selectedStageFilter === 'all' ? '#6366f1' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Усі ({leads.length})
        </button>
        {stages.map(s => {
          const count = leads.filter(l => l.stageId === s.id).length
          const isSel = selectedStageFilter === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStageFilter(s.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '10px',
                border: isSel ? `1px solid ${s.color}` : '1px solid var(--glass-border)',
                background: isSel ? `${s.color}20` : 'transparent',
                color: isSel ? s.color : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {s.title} ({count})
            </button>
          )
        })}
      </div>

      {/* Search & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 200px', minWidth: '180px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Пошук ліда, замовника, виробу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '9px 12px 9px 36px',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              background: 'var(--card-bg, rgba(0,0,0,0.2))',
              color: 'var(--text)',
              fontSize: '0.85rem',
              width: '100%',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={openStageModalForCreate}
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Settings size={15} /> + Етап
          </button>

          <button
            onClick={openLeadModalForCreate}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={16} /> + Новий Лід
          </button>
        </div>
      </div>
    </div>
  )
}

export default CrmControlBar
