import React from 'react'
import { Briefcase, TrendingUp, Users } from 'lucide-react'

export const CrmHeader = ({ totalPipelineValue, leadsCount }) => {
  return (
    <div className="crm-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '25px',
      flexWrap: 'wrap',
      gap: '20px',
      paddingLeft: '65px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6366f1',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
        }}>
          <Briefcase size={28} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
              CRM Воронка Лідів & Запитів
            </h1>
            <span className="pillar-badge-crm" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
              CRM Leads
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px', margin: 0 }}>
            Управління лідами, переміщення та налаштування етапів воронки продажів
          </p>
        </div>
      </div>

      {/* Quick Stats Badges */}
      <div style={{ display: 'flex', gap: '15px' }}>
        <div className="glass-panel" style={{
          padding: '12px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--card-bg, rgba(255,255,255,0.03))',
          border: '1px solid var(--glass-border)'
        }}>
          <TrendingUp size={20} color="#6366f1" />
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Обсяг Воронки</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#6366f1' }}>
              ₴{totalPipelineValue.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{
          padding: '12px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--card-bg, rgba(255,255,255,0.03))',
          border: '1px solid var(--glass-border)'
        }}>
          <Users size={20} color="#10b981" />
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Всього Лідів</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>
              {leadsCount} запитів
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrmHeader
