import React from 'react'
import { Scissors } from 'lucide-react'

export const CuttersReportView = ({ cuttersStats }) => {
  return (
    <div className="glass-panel" style={{ background: '#09090b', padding: '30px', borderRadius: '24px', border: '1px solid #27272a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
      <h3 style={{ margin: '0 0 25px', color: '#ff9000', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '12px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
        <Scissors size={24} color="#ff9000" /> ДАШБОРД ВИКОРИСТАННЯ ФРЕЗ
      </h3>

      <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: '#09090b' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'left', borderBottom: '2px solid #27272a' }}>
              <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Назва фрези (Розхідник)</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6' }}>Отримано на склад</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444' }}>Використано (шт)</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Фактично на Складі</th>
            </tr>
          </thead>
          <tbody>
            {cuttersStats.map((stat, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', background: 'transparent', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#18181b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '16px 20px', fontWeight: 900, color: '#f4f4f5', fontSize: '0.95rem' }}>{stat.name}</td>
                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                  {stat.supplied > 0 ? <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.supplied}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                  {stat.used > 0 ? <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.used}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '6px 14px', borderRadius: '10px', fontWeight: 950, fontSize: '1.05rem' }}>
                    {Math.max(0, stat.actual - stat.reserved)}
                  </span>
                </td>
              </tr>
            ))}
            {cuttersStats.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
                  Немає даних про використання фрез
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
