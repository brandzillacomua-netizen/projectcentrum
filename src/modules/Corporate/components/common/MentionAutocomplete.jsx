import React from 'react'
import { User, Check } from 'lucide-react'
import { CorporateAvatar } from './CorporateAvatar'

export function MentionAutocomplete({
  users = [],
  query = '',
  onSelect,
  style = {}
}) {
  const q = String(query || '').trim().toLowerCase()
  const filtered = (users || []).filter(u => {
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
    const login = String(u.login || '').toLowerCase()
    const position = String(u.position || '').toLowerCase()
    return fullName.includes(q) || login.includes(q) || position.includes(q)
  }).slice(0, 8)

  if (filtered.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: '320px',
        maxWidth: '100%',
        padding: '8px',
        background: 'var(--ch-surface-solid, #ffffff)',
        border: '1px solid var(--ch-border-accent, #6366f1)',
        borderRadius: '16px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.28), 0 4px 14px rgba(0, 0, 0, 0.12)',
        zIndex: 99999,
        boxSizing: 'border-box',
        ...style
      }}
    >
      <div style={{ fontSize: '0.68rem', color: 'var(--ch-text-dim)', padding: '4px 8px 6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Позначити співробітника (@):
      </div>

      <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {filtered.map(user => {
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.login

          return (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: '10px',
                color: 'var(--ch-text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ch-surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <CorporateAvatar
                user={user}
                size={30}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--ch-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </div>
                {user.position && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--ch-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.position}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
