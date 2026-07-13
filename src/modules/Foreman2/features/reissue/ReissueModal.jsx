import React, { useMemo, useState } from 'react'
import { Loader2, X, Wrench } from 'lucide-react'
import { formatQty } from '../../utils/normalize.js'
import { buildReissuePlan } from './reissueCalculations.js'

export default function ReissueModal({ task, part, machines, onClose, onConfirm, isBusy, error }) {
  const [capacity, setCapacity] = useState('')

  const plan = useMemo(() => {
    return buildReissuePlan({
      task,
      part,
      machines,
      capacityOverride: capacity ? Number(capacity) : null
    })
  }, [task, part, machines, capacity])

  if (!task || !part) return null

  const minCap = plan.valid ? (Number(plan.machine?.min_capacity) || 1) : 1
  const maxCap = plan.valid ? (Number(plan.machine?.max_capacity || plan.machine?.sheet_capacity) || 1) : 1
  const currentCapacity = plan.valid ? plan.capacity : 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: '#101010', border: '1px solid #272727', borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,.45)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #242424', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#ef4444', fontSize: '.68rem', fontWeight: 950, letterSpacing: '.14em', textTransform: 'uppercase' }}>Довипуск Foreman2</div>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem' }}>{part.name}</h3>
          </div>
          <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #2a2a2a', background: '#151515', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
              <div style={{ color: '#666', fontSize: '.62rem', fontWeight: 950 }}>НЕСТАЧА</div>
              <strong style={{ color: '#ef4444', fontSize: '1.25rem' }}>{formatQty(part.shortage)}</strong>
            </div>
            <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
              <div style={{ color: '#666', fontSize: '.62rem', fontWeight: 950 }}>ЛИСТІВ</div>
              <strong style={{ color: '#ffb020', fontSize: '1.25rem' }}>{plan.valid ? formatQty(plan.sheets) : '-'}</strong>
            </div>
            <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
              <div style={{ color: '#666', fontSize: '.62rem', fontWeight: 950 }}>КАРТОК</div>
              <strong style={{ color: '#fff', fontSize: '1.25rem' }}>{plan.valid ? formatQty(plan.totalCards) : '-'}</strong>
            </div>
          </div>

          <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ color: '#666', fontSize: '.68rem', fontWeight: 950, textTransform: 'uppercase', marginBottom: '8px' }}>Верстат</div>
            <div style={{ color: '#fff', fontWeight: 900 }}>{plan.valid ? plan.machine?.name : part.machine || 'Не вказано'}</div>
          </div>

          <label style={{ display: 'block', color: '#777', fontSize: '.72rem', fontWeight: 900, marginBottom: '8px' }}>Завантаження листів у картку</label>
          <input
            type="number"
            min={minCap}
            max={maxCap}
            value={capacity || currentCapacity}
            onChange={event => setCapacity(event.target.value)}
            style={{ width: '100%', background: '#050505', border: '1px solid #303030', borderRadius: '8px', color: '#fff', padding: '12px', fontWeight: 900, marginBottom: '14px' }}
          />

          {plan.valid && (
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #222', borderRadius: '8px', marginBottom: '14px' }}>
              {plan.cards.map((card, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #191919', fontSize: '.78rem' }}>
                  <span style={{ color: '#aaa' }}>{card.cardInfo}</span>
                  <strong style={{ color: '#fff' }}>{formatQty(card.quantity)} шт</strong>
                </div>
              ))}
            </div>
          )}

          {(error || !plan.valid) && (
            <div style={{ color: '#fecaca', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.35)', borderRadius: '8px', padding: '10px 12px', fontSize: '.78rem', fontWeight: 850, marginBottom: '14px' }}>
              {error || plan.reason}
            </div>
          )}

          <button
            onClick={() => onConfirm({ capacityOverride: capacity ? Number(capacity) : null })}
            disabled={isBusy || !plan.valid}
            style={{ width: '100%', border: 'none', borderRadius: '8px', background: isBusy || !plan.valid ? '#242424' : '#ef4444', color: '#fff', padding: '14px', fontWeight: 950, cursor: isBusy || !plan.valid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isBusy ? <Loader2 size={16} className="spin" /> : <Wrench size={16} />}
            Створити довипуск
          </button>
        </div>
      </div>
    </div>
  )
}
