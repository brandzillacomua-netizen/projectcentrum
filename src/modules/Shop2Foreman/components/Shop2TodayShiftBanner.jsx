import React from 'react'
import { Users, CheckCircle2 } from 'lucide-react'
import { SHOP2_ROLE_GROUPS } from '../utils/shop2ForemanUtils.js'

export const Shop2TodayShiftBanner = ({ todayShiftSummary }) => {
  const { dateKey, totalCount, byRole } = todayShiftSummary || {
    dateKey: '',
    totalCount: 0,
    byRole: {}
  }

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '20px',
      padding: '18px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.14)',
            color: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 950, color: 'var(--text-strong)' }}>
              СФОРМОВАНА ЗМІНА НА СЬОГОДНІ ({dateKey})
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>
              Працівники з відміткою «Р» автоматично підтягуються в Термінал Цеху №2
            </div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '12px',
          background: totalCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
          color: totalCount > 0 ? '#10b981' : '#eab308',
          fontWeight: 900,
          fontSize: '0.82rem'
        }}>
          <CheckCircle2 size={16} />
          На зміні сьогодні: {totalCount}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        {SHOP2_ROLE_GROUPS.map(group => {
          const list = byRole?.[group.key] || []
          if (group.key === 'other' && list.length === 0) return null
          return (
            <div key={group.key} style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: group.color, textTransform: 'uppercase' }}>
                  {group.label}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 950,
                  background: `${group.color}20`,
                  color: group.color,
                  padding: '2px 8px',
                  borderRadius: '999px'
                }}>
                  {list.length}
                </span>
              </div>

              {list.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Нікого не відмічено</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {list.map(member => (
                    <span
                      key={member.id}
                      title={`${member.position || ''} · ${member.shift}`}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-strong)'
                      }}
                    >
                      {member.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

