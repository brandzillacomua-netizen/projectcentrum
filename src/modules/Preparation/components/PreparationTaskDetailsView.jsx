import React from 'react'
import { Play, CheckCircle, X } from 'lucide-react'

export const PreparationTaskDetailsView = ({
  currentSubTask,
  selectedShift,
  setSelectedShift,
  selectedOperator,
  setSelectedOperator,
  prepOperators,
  isProcessing,
  handleStart,
  handleCompleteClick,
  formatElapsedTime,
  onDeselect
}) => {
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              display: 'inline-block',
              background: currentSubTask.status === 'new' ? '#ef4444' : '#3b82f6',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.65rem',
              fontWeight: 900
            }}>
              {currentSubTask.status === 'new' ? 'НОВЕ ЗАВДАННЯ' : 'В РОБОТІ'}
            </span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>
            НАРЯД № {currentSubTask.task.plan_snapshot?._prep_num || 'НП------'}
          </h2>
          <div style={{ fontSize: '1.1rem', color: '#10b981', fontWeight: 800, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ПІДГОТОВКА СИРОВИНИ
          </div>
          <div style={{ fontSize: 'clamp(1rem, 3vw, 1.35rem)', color: '#eee', marginTop: '15px', fontWeight: 900 }}>
            Деталь: <span style={{ color: '#ff9000' }}>{currentSubTask.name}</span>
          </div>
        </div>
        <button
          onClick={onDeselect}
          style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer', flexShrink: 0 }}
        >
          <X size={24} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900 }}>ПЛАНОВА КІЛЬКІСТЬ</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#3b82f6' }}>{currentSubTask.plan} шт</div>
        </div>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900 }}>ОБЛАДНАННЯ</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff' }}>{currentSubTask.task.machine_name || '—'}</div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'clamp(15px, 4vw, 30px)', borderRadius: '24px', border: '1px solid #222' }}>
        {currentSubTask.status === 'new' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Зміна</label>
              <select
                value={selectedShift}
                onChange={e => { setSelectedShift(e.target.value); setSelectedOperator('') }}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#10b981', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 800 }}
              >
                <option value="">— Оберіть зміну —</option>
                <option value="Зміна 1">Зміна 1</option>
                <option value="Зміна 2">Зміна 2</option>
                <option value="Зміна 3">Зміна 3</option>
                <option value="Зміна 4">Зміна 4</option>
                <option value="Без зміни">Без зміни</option>
              </select>
            </div>

            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>ПРАЦІВНИК ВП (АВТОРИЗАЦІЯ)</label>
              <select
                value={selectedOperator}
                onChange={e => setSelectedOperator(e.target.value)}
                disabled={!selectedShift}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#10b981', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 800, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}
              >
                <option value="">{selectedShift ? '— Оберіть працівника —' : '— Спочатку оберіть зміну —'}</option>
                {prepOperators.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <button
              disabled={isProcessing || !selectedOperator || !selectedShift}
              onClick={handleStart}
              style={{
                width: '100%',
                padding: '20px',
                background: '#10b981',
                color: '#000',
                border: 'none',
                borderRadius: '16px',
                fontSize: '1.2rem',
                fontWeight: 950,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '15px',
                cursor: (isProcessing || !selectedOperator || !selectedShift) ? 'not-allowed' : 'pointer',
                opacity: (isProcessing || !selectedOperator || !selectedShift) ? 0.7 : 1
              }}
            >
              <Play size={24} fill="currentColor" /> {isProcessing ? 'ЧЕКАЙТЕ...' : 'РОЗПОЧАТИ ПІДГОТОВКУ'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '20px 0' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle size={40} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>ПРОЦЕС ВИКОНУЄТЬСЯ...</h3>
            <div style={{ fontSize: '1rem', color: '#888', marginTop: '-10px' }}>
              Працівник: <strong style={{ color: '#fff' }}>{currentSubTask.operator}</strong>
            </div>
            <div style={{ fontSize: 'clamp(3rem, 10vw, 4.5rem)', fontWeight: 1000, color: '#fff', fontFamily: 'monospace', letterSpacing: '-2px', margin: '15px 0' }}>
              {formatElapsedTime(currentSubTask.task?.plan_snapshot?.[currentSubTask.nomenclatureId]?.started_at)}
            </div>
            <button
              onClick={handleCompleteClick}
              style={{ width: '100%', padding: '20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 950, marginTop: '20px', cursor: 'pointer', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)' }}
            >
              ЗАКРИТИ ЗАДАЧУ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreparationTaskDetailsView
