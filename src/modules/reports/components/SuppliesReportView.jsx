import React from 'react'
import { Truck } from 'lucide-react'

export const SuppliesReportView = ({ supplyStats }) => {
  return (
    <div className="glass-panel" style={{ background: 'var(--surface-1)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
      <h3 style={{ margin: '0 0 20px', color: '#ff9000', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' }}>
        <Truck size={20} /> Рух матеріалів (Поставки та Витрати)
      </h3>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'var(--surface-inset)', color: '#666', textAlign: 'left' }}>
            <th style={{ padding: '15px', borderBottom: '1px solid var(--border-subtle)', width: '35%' }}>Матеріал / Номенклатура</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Поставлено</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Витрачено</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Розрахунковий Залишок</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Фактично на Складі</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Розбіжність</th>
          </tr>
        </thead>
        <tbody>
          {supplyStats.map((stat, idx) => {
            const calculatedBalance = stat.supplied - stat.used;
            const diff = stat.actual - calculatedBalance;
            return (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--fill-subtle)' }}>
                <td style={{ padding: '15px', fontWeight: 800, color: 'var(--text-strong)' }}>{stat.name}</td>
                <td style={{ padding: '15px', textAlign: 'center', color: '#3b82f6', fontWeight: 900 }}>{stat.supplied > 0 ? `+${stat.supplied}` : 0}</td>
                <td style={{ padding: '15px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{stat.used > 0 ? `-${stat.used}` : 0}</td>
                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }}>{calculatedBalance}</td>
                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#22c55e' }}>{stat.actual}</td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  {diff === 0 ? (
                    <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>ОК</span>
                  ) : diff > 0 ? (
                    <span style={{ color: '#22c55e', fontWeight: 900, background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: '4px' }}>+{diff} (Надлишок)</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontWeight: 900, background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '4px' }}>{diff} (Дефіцит)</span>
                  )}
                </td>
              </tr>
            )
          })}
          {supplyStats.length === 0 && (
            <tr>
              <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                Немає даних про поставки або витрати матеріалів за обраний період.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
