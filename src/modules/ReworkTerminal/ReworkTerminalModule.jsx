import React, { useState } from 'react'
import { useReworkData } from './hooks/useReworkData.js'
import { useReworkActions } from './hooks/useReworkActions.js'
import { ReworkCardTile } from './components/ReworkCardTile.jsx'
import { Wrench } from 'lucide-react'
import { useMES } from '../../MESContext.jsx'

export default function ReworkTerminalModule() {
  const mes = useMES()

  // Ensure dictionaries are loaded
  React.useEffect(() => {
    if (mes && typeof mes.fetchData === 'function') {
      mes.fetchData(['nomenclatures', 'orders', 'tasks']).catch(() => {})
    }
  }, [mes])

  const { cards, loading, error } = useReworkData(mes)
  const { takeInWork, completeWork, isProcessing } = useReworkActions()

  const [operatorName, setOperatorName] = useState('Оператор Доопрацювання')

  if (loading) {
    return (
      <div style={{ color: 'var(--text)', padding: '40px', textAlign: 'center', fontSize: '20px' }}>
        Завантаження карток на доопрацювання...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: 'var(--danger)', padding: '40px', textAlign: 'center', fontSize: '20px' }}>
        Помилка: {error}
      </div>
    )
  }

  const newCards = cards.filter(c => c.status === 'new')
  const inProgressCards = cards.filter(c => c.status === 'in-progress')

  return (
    <div className="module-content" style={{ padding: '30px', color: 'var(--text)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <Wrench size={32} color="var(--primary)" />
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Термінал Доопрацювання</h1>
      </div>

      <div style={{ marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>ПІБ Оператора:</span>
        <input 
          type="text" 
          value={operatorName}
          onChange={(e) => setOperatorName(e.target.value)}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--glass-border)',
            padding: '10px 15px',
            color: 'var(--text)',
            borderRadius: '8px',
            fontSize: '16px',
            width: '300px'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '24px', color: 'var(--warning)', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px' }}>
            Очікують ({newCards.length})
          </h2>
          {newCards.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Немає карток в очікуванні</div>
          ) : (
            newCards.map(c => (
              <ReworkCardTile 
                key={c.id} 
                card={c} 
                onTakeInWork={(id) => takeInWork(id, operatorName)} 
                isProcessing={isProcessing} 
              />
            ))
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '24px', color: 'var(--info)', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px' }}>
            В роботі ({inProgressCards.length})
          </h2>
          {inProgressCards.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Немає карток в роботі</div>
          ) : (
            inProgressCards.map(c => (
              <ReworkCardTile 
                key={c.id} 
                card={c} 
                onComplete={(card) => completeWork(card, operatorName)} 
                isProcessing={isProcessing} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
