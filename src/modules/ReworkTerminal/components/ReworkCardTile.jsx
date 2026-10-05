import React from 'react'
import { CheckCircle, Play } from 'lucide-react'

export function ReworkCardTile({ card, onTakeInWork, onComplete, isProcessing }) {
  const nom = card.nom
  const order = card.order

  return (
    <div className="card-tile glass-panel" style={{
      padding: '20px',
      marginBottom: '15px',
      borderRadius: 'var(--radius)',
      background: 'var(--card-bg)',
      border: '1px solid var(--glass-border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: 'var(--shadow)'
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ color: 'var(--text)', fontSize: '18px', fontWeight: 'bold' }}>{nom?.name || 'Невідома деталь'}</span>
          <span style={{ background: 'var(--info)', color: '#fff', padding: '2px 8px', borderRadius: '5px', fontSize: '12px' }}>
            #{card.id.slice(-6)}
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>
          Замовлення: {order?.order_num || '—'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>
          Надійшло: <span style={{ color: 'var(--text)' }}>{new Date(card.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Кількість на доопрацювання: <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{card.quantity} шт</span>
        </div>
      </div>
      <div>
        {card.status === 'new' ? (
          <button
            onClick={() => onTakeInWork(card.id)}
            disabled={isProcessing}
            style={{
              background: 'var(--info)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.7 : 1
            }}
          >
            <Play size={20} />
            В роботу
          </button>
        ) : (
          <button
            onClick={() => onComplete(card)}
            disabled={isProcessing}
            style={{
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.7 : 1
            }}
          >
            <CheckCircle size={20} />
            Завершити
          </button>
        )}
      </div>
    </div>
  )
}
