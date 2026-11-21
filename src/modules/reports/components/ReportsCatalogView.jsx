import React, { useMemo, useState } from 'react'
import { ArrowRight, FolderKanban, Search } from 'lucide-react'
import { REPORT_CATEGORIES, REPORTS_REGISTRY } from '../reportsRegistry'

export function ReportsCatalogView({ onSelectReport }) {
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

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px 24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', fontWeight: 950, color: 'var(--text-strong)' }}>
            <FolderKanban size={20} color="#ff9000" />
            Категорії звітів та підзвіти
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Оберіть потрібний розділ — дані звіту завантажаться після вибору.
          </div>
        </div>
        <div style={{ position: 'relative', minWidth: '280px', flex: '0 1 340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Знайти звіт або підзвіт..."
            style={{ width: '100%', height: '40px', padding: '0 12px 0 36px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)', fontSize: '0.84rem' }}
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', background: 'var(--surface-1)', border: '1px dashed var(--border-subtle)', borderRadius: '16px', color: 'var(--text-muted)' }}>
          За запитом «{query}» звітів не знайдено.
        </div>
      ) : (
        grouped.map(cat => (
          <section key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-strong)' }}>
                {cat.label}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {cat.items.length}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '14px' }}>
              {cat.items.map(r => {
                const Icon = r.icon
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectReport(r.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                      textAlign: 'left',
                      padding: '18px 20px',
                      borderRadius: '14px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-1)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s, border-color 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff9000'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'rgba(255, 144, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9000', flexShrink: 0 }}>
                        <Icon size={20} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {r.badge && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.16)', color: '#10b981' }}>
                            {r.badge}
                          </span>
                        )}
                        <ArrowRight size={16} color="var(--text-muted)" />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-strong)' }}>{r.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>{r.subtitle}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
