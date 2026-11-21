import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { REPORT_CATEGORIES, REPORTS_REGISTRY } from '../reportsRegistry'

export function ReportsSidebar({ activeTab, onSelectReport, isCollapsed, setIsCollapsed }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const grouped = useMemo(() => {
    return REPORT_CATEGORIES.map(cat => ({
      ...cat,
      items: REPORTS_REGISTRY.filter(r =>
        r.category === cat.id &&
        (!q || r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q))
      )
    })).filter(cat => cat.items.length > 0)
  }, [q])

  if (isCollapsed) {
    return (
      <aside style={{ width: '56px', flexShrink: 0, background: 'var(--surface-1)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 6px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title="Розгорнути меню звітів"
          style={{ width: '38px', height: '38px', borderRadius: '9px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-strong)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}
        >
          <ChevronRight size={16} />
        </button>
        {REPORTS_REGISTRY.map(r => {
          const Icon = r.icon
          const active = activeTab === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectReport(r.id)}
              title={r.title}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                border: '1px solid',
                borderColor: active ? '#ff9000' : 'transparent',
                background: active ? 'rgba(255, 144, 0, 0.14)' : 'transparent',
                color: active ? '#ff9000' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon size={17} />
            </button>
          )
        })}
      </aside>
    )
  }

  return (
    <aside style={{ width: '264px', flexShrink: 0, background: 'var(--surface-1)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '14px 12px', gap: '12px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук звіту..."
            style={{ width: '100%', height: '34px', padding: '0 10px 0 30px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)', fontSize: '0.78rem' }}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          title="Згорнути меню"
          style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {grouped.map(cat => (
          <div key={cat.id}>
            <div style={{ fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 8px 6px' }}>
              {cat.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {cat.items.map(r => {
                const Icon = r.icon
                const active = activeTab === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectReport(r.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '9px',
                      border: '1px solid',
                      borderColor: active ? 'rgba(255, 144, 0, 0.45)' : 'transparent',
                      background: active ? 'rgba(255, 144, 0, 0.12)' : 'transparent',
                      color: active ? 'var(--text-strong)' : 'var(--text-soft)',
                      cursor: 'pointer',
                      transition: '0.15s'
                    }}
                  >
                    <Icon size={16} color={active ? '#ff9000' : 'currentColor'} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: active ? 900 : 700 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                        {r.badge && (
                          <span style={{ fontSize: '0.58rem', fontWeight: 900, padding: '1px 5px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.16)', color: '#10b981' }}>
                            {r.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.subtitle}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
