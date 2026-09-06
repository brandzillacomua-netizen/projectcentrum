import React from 'react'

export const EmployeeReportView = ({ employeeStats }) => {
  return (
    <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#0a0a0a', color: '#666', textAlign: 'left' }}>
            <th style={{ padding: '15px', borderBottom: '1px solid #222' }}>Працівник</th>
            <th style={{ padding: '15px', borderBottom: '1px solid #222' }}>Цех / Посада</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Операцій</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Вироблено (шт)</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Брак (шт)</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#eab308' }}>Брак</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#f97316' }}>Карантин</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#ef4444' }}>Утиль</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Ефективність</th>
          </tr>
        </thead>
        <tbody>
          {employeeStats.map((emp, idx) => {
            const totalProcessed = emp.produced + emp.scrap;
            const efficiency = totalProcessed > 0 ? ((emp.produced / totalProcessed) * 100).toFixed(1) : 0;
            return (
              <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '15px', fontWeight: 800, color: '#fff' }}>{emp.name}</td>
                <td style={{ padding: '15px', color: '#888' }}>{emp.department} <span style={{ color: '#555' }}>({emp.position})</span></td>
                <td style={{ padding: '15px', textAlign: 'center', color: '#bbb' }}>{emp.operations}</td>
                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#22c55e' }}>{emp.produced}</td>
                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: emp.scrap > 0 ? '#ef4444' : '#555' }}>{emp.scrap}</td>
                <td style={{ padding: '15px', textAlign: 'center', color: emp.cat1 + emp.cat2 > 0 ? '#eab308' : '#444', fontWeight: emp.cat1 + emp.cat2 > 0 ? '900' : '400' }}>{emp.cat1 + emp.cat2}</td>
                <td style={{ padding: '15px', textAlign: 'center', color: emp.cat3 > 0 ? '#f97316' : '#444', fontWeight: emp.cat3 > 0 ? '900' : '400' }}>{emp.cat3}</td>
                <td style={{ padding: '15px', textAlign: 'center', color: emp.cat4 > 0 ? '#ef4444' : '#444', fontWeight: emp.cat4 > 0 ? '900' : '400' }}>{emp.cat4}</td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <div style={{ width: '50px', height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${efficiency}%`, height: '100%', background: Number(efficiency) > 95 ? '#22c55e' : (Number(efficiency) > 80 ? '#ff9000' : '#ef4444') }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{efficiency}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
