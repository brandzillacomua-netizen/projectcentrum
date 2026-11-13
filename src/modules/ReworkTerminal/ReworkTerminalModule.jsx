import React, { useState } from 'react'
import { useReworkData } from './hooks/useReworkData.js'
import { useReworkActions } from './hooks/useReworkActions.js'
import { ReworkCardTile } from './components/ReworkCardTile.jsx'
import { ReworkStartModal } from './components/ReworkStartModal.jsx'
import { Wrench, Users } from 'lucide-react'
import { useMES } from '../../MESContext.jsx'
import { useStore } from '../../store/index.js'
import { selectFilteredOperatorNames } from '../../contexts/userDirectorySelectors.js'
import { getTodayCalendarKey } from '../Shop2Foreman/utils/shop2ForemanUtils.js'

export default function ReworkTerminalModule() {
  const mes = useMES()
  const systemUsers = useStore(state => state.systemUsers)

  // Ensure dictionaries and users are loaded
  React.useEffect(() => {
    if (mes && typeof mes.fetchData === 'function') {
      mes.fetchData(['nomenclatures', 'orders', 'tasks', 'system_users']).catch(() => {})
    }
  }, [mes])

  const { waitingCards, inProgressCards, completedCards, loading, error } = useReworkData(mes)
  const { takeInWork, completeWork, isProcessing } = useReworkActions()

  const todayKey = getTodayCalendarKey()
  const onShiftPolishers = React.useMemo(() => {
    const fromStore = selectFilteredOperatorNames(systemUsers, null, null, 'Доопрацювання', { onlyOnShiftDate: todayKey })
    if (fromStore.length > 0) return fromStore
    return mes?.getFilteredOperators ? mes.getFilteredOperators(null, null, 'Доопрацювання', { onlyOnShiftDate: todayKey }) : []
  }, [systemUsers, mes, todayKey])

  const allPolishers = React.useMemo(() => {
    const fromStore = selectFilteredOperatorNames(systemUsers, null, null, 'Доопрацювання')
    if (fromStore.length > 0) return fromStore
    return mes?.getFilteredOperators ? mes.getFilteredOperators(null, null, 'Доопрацювання') : []
  }, [systemUsers, mes])

  const [viewMode, setViewMode] = useState('active')
  const [pendingStartCard, setPendingStartCard] = useState(null)

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

  return (
    <div className="module-content" style={{ padding: '30px', color: 'var(--text)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Wrench size={32} color="var(--primary)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>Термінал Доопрацювання</h1>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Лицювально-полірувальні та відновлювальні роботи
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '8px 14px',
            borderRadius: '10px',
            color: '#10b981',
            fontSize: '13px',
            fontWeight: 800
          }}>
            <Users size={16} />
            <span>Лицювальників на зміні: {onShiftPolishers.length}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setViewMode('active')}
              style={{
                background: viewMode === 'active' ? 'var(--primary)' : 'var(--card-bg)',
                color: viewMode === 'active' ? '#fff' : 'var(--text)',
                border: '1px solid var(--glass-border)',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              В роботі та черзі ({waitingCards.length + inProgressCards.length})
            </button>
            <button
              onClick={() => setViewMode('completed')}
              style={{
                background: viewMode === 'completed' ? '#10b981' : 'var(--card-bg)',
                color: viewMode === 'completed' ? '#fff' : 'var(--text)',
                border: '1px solid var(--glass-border)',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ВИКОНАНІ ({completedCards.length})
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'completed' ? (
        <div>
          <h2 style={{ fontSize: '24px', color: '#10b981', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px' }}>
            Виконані картки ({completedCards.length})
          </h2>
          {completedCards.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Немає виконаних карток доопрацювання</div>
          ) : (
            completedCards.map(c => (
              <ReworkCardTile
                key={c.id}
                card={c}
                isProcessing={isProcessing}
              />
            ))
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', color: 'var(--warning)', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px' }}>
              Очікують ({waitingCards.length})
            </h2>
            {waitingCards.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Немає карток в очікуванні</div>
            ) : (
              waitingCards.map(c => (
                <ReworkCardTile 
                  key={c.id} 
                  card={c} 
                  onTakeInWork={(card) => setPendingStartCard(card)} 
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
                  onComplete={(card) => completeWork(card)} 
                  isProcessing={isProcessing} 
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Start Rework Modal */}
      <ReworkStartModal
        pendingStartCard={pendingStartCard}
        onClose={() => setPendingStartCard(null)}
        onConfirm={async (cardId, opName) => {
          await takeInWork(cardId, opName)
          setPendingStartCard(null)
        }}
        isProcessing={isProcessing}
        onShiftPolishers={onShiftPolishers}
        allPolishers={allPolishers}
      />
    </div>
  )
}
