import React from 'react'

export const PreparationMonitoringTable = ({
  prepSubTasks,
  formatElapsedTime,
  onSelectSubTask
}) => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '25px' }}>МОНІТОРИНГ ВІДДІЛУ ПІДГОТОВКИ</h2>
      <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflowX: 'auto' }}>
        <div style={{ padding: '25px', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '12px 15px' }}>ДЕТАЛЬ</th>
              <th style={{ padding: '12px 15px' }}>СТАТУС</th>
              <th style={{ padding: '12px 15px' }}>К-СТЬ</th>
              <th style={{ padding: '12px 15px' }}>ЗМІНА</th>
              <th style={{ padding: '12px 15px' }}>ОПЕРАТОР</th>
              <th style={{ padding: '12px 15px' }}>ЧАС</th>
              <th style={{ padding: '12px 15px', width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {prepSubTasks.map(sub => {
              const subTaskSnapshot = sub.task?.plan_snapshot?.[sub.nomenclatureId]
              const startedAt = subTaskSnapshot?.started_at
              const operatorName = subTaskSnapshot?.operator || '—'
              const shiftName = subTaskSnapshot?.shift || '—'
              return (
                <tr key={sub.id} style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem' }}>
                  <td style={{ padding: '12px 15px', fontWeight: 800, fontSize: '0.75rem' }}>{sub.name}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{
                      color: sub.status === 'in-progress' ? '#3b82f6' : '#eab308',
                      fontWeight: 900,
                      fontSize: '0.7rem',
                      background: sub.status === 'in-progress' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {sub.status === 'in-progress' ? 'В РОБОТІ' : 'ОЧІКУЄ'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 15px', fontWeight: 900 }}>{sub.plan} шт</td>
                  <td style={{ padding: '12px 15px', color: '#888' }}>{shiftName}</td>
                  <td style={{ padding: '12px 15px', color: '#aaa' }}>{operatorName}</td>
                  <td style={{ padding: '12px 15px', color: '#10b981' }}>
                    {sub.status === 'in-progress' ? formatElapsedTime(startedAt) : '—'}
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectSubTask(sub.id)}
                      style={{ background: '#10b981', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Відкрити"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {prepSubTasks.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
                  Немає активних карток у відділі підготовки
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PreparationMonitoringTable
