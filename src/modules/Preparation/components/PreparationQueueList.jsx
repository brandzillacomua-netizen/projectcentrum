import React from 'react'

export const PreparationQueueList = ({
  prepSubTasks,
  selectedSubTaskId,
  onSelectSubTask
}) => {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {prepSubTasks.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
          Немає активних завдань
        </div>
      )}
      {prepSubTasks.map(sub => {
        const isActive = selectedSubTaskId === sub.id
        return (
          <div
            key={sub.id}
            onClick={() => onSelectSubTask(sub.id)}
            style={{
              background: isActive ? '#10b981' : '#1a1a1a',
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '10px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: isActive ? '#10b981' : '#333',
              color: isActive ? '#000' : '#fff',
              transition: '0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, opacity: isActive ? 1 : 0.6 }}>
                № {sub.task.plan_snapshot?._prep_num || 'НП------'}
              </span>
            </div>
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '5px' }}>{sub.name}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '8px' }}>ПЛАН: {sub.plan} шт.</div>
            <span style={{
              fontSize: '0.6rem',
              background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(16, 185, 129, 0.1)',
              color: isActive ? '#000' : '#10b981',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: 900
            }}>
              {sub.status === 'in-progress' ? 'В РОБОТІ' : 'ОЧІКУЄ'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default PreparationQueueList
