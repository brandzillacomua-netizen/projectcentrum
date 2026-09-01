import React, { useState, useEffect } from 'react'
import { X, Play, Loader2, AlertCircle } from 'lucide-react'

export function GenerateShop2CardModal({
  row,
  stages = [],
  isSubmitting = false,
  error = null,
  onClose,
  onGenerate
}) {
  const [stage, setStage] = useState('Пресування')
  const [batchSize, setBatchSize] = useState(500)
  const [cardCount, setCardCount] = useState(1)

  useEffect(() => {
    if (row) {
      const avail = row.availableQty || 0
      if (avail > 0) {
        const defaultBatch = Math.min(avail, 500)
        setBatchSize(defaultBatch)
        setCardCount(Math.ceil(avail / defaultBatch) || 1)
      } else {
        setBatchSize(0)
        setCardCount(0)
      }
    }
  }, [row])

  if (!row) return null

  const availableQty = row.availableQty || 0
  const totalQtyToCreate = Math.max(0, batchSize * cardCount)
  const isOverBuffer = totalQtyToCreate > availableQty
  const isValid = totalQtyToCreate > 0 && !isOverBuffer && !isSubmitting

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    onGenerate({
      row,
      stage,
      batchSize: Number(batchSize),
      cardCount: Number(cardCount)
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg, #0e0e0e)', width: '100%', maxWidth: '560px', borderRadius: '24px', padding: '36px', position: 'relative', border: '1px solid var(--border, #222)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '22px', right: '22px', background: 'var(--border, #1c1c1c)', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 900, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '4px 12px', borderRadius: '8px' }}>
            ВІЛЬНО В КУПІ: {availableQty.toLocaleString()} шт
          </span>
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 950, margin: '0 0 4px', color: 'var(--text, #fff)' }}>
          Створення РК Цеху №2
        </h2>
        <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.9rem', marginBottom: '16px', fontWeight: 800 }}>
          {row.nomName} {row.nomCode ? `(${row.nomCode})` : ''}
        </p>

        {/* Orders Breakdown Badge Pool */}
        {row.ordersList && row.ordersList.length > 0 && (
          <div style={{ background: 'var(--input-bg, #060606)', border: '1px solid var(--border, #161616)', borderRadius: '12px', padding: '10px 14px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #666)', fontWeight: 800 }}>📦 НАРАДИ В КУПІ:</span>
            {row.ordersList.map((o, idx) => (
              <span key={idx} style={{ fontSize: '0.7rem', background: 'var(--border, #161616)', color: '#ff9000', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                {o.orderNum} ({o.availableQty} шт)
              </span>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Stage selection */}
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
              Обрати Етап Обробки:
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid var(--border, #2a2a2a)', color: 'var(--text, #fff)', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', outline: 'none', fontWeight: 800 }}
            >
              {stages.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Batch Size & Card Count */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#ff9000', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                Кількість в картці (шт):
              </label>
              <input
                type="number"
                min="1"
                max={availableQty}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid rgba(255,144,0,0.4)', color: '#ff9000', fontSize: '1.4rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#10b981', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                На скільки карт розбити:
              </label>
              <input
                type="number"
                min="1"
                value={cardCount}
                onChange={(e) => setCardCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--text, #fff)', fontSize: '1.4rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '14px', outline: 'none' }}
              />
            </div>
          </div>

          {/* Summary Box */}
          <div style={{ background: isOverBuffer ? 'rgba(239, 68, 68, 0.08)' : 'var(--input-bg, #050505)', border: isOverBuffer ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border, #1a1a1a)', borderRadius: '16px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: isOverBuffer ? '#ef4444' : 'var(--text-muted, #888)', fontWeight: 800 }}>
              {isOverBuffer ? '⚠️ Перевищено доступний буфер!' : 'Разом у випуск:'}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 950, color: isOverBuffer ? '#ef4444' : '#38bdf8' }}>
              {totalQtyToCreate.toLocaleString()} <small style={{ fontSize: '0.7rem', color: 'var(--text-muted, #666)' }}>шт</small>
            </span>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={!isValid}
            style={{
              marginTop: '6px',
              width: '100%',
              background: isValid ? 'linear-gradient(135deg, #ff9000, #ff5500)' : 'var(--border, #1f1f1f)',
              color: isValid ? '#fff' : 'var(--text-muted, #444)',
              padding: '18px',
              borderRadius: '16px',
              fontSize: '0.95rem',
              fontWeight: 950,
              cursor: isValid ? 'pointer' : 'not-allowed',
              border: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isValid ? '0 10px 20px -5px rgba(255, 144, 0, 0.4)' : 'none'
            }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill={isValid ? '#fff' : 'none'} />}
            {isSubmitting ? 'Створення...' : 'Підтвердити та запустити РК'}
          </button>
        </form>
      </div>
    </div>
  )
}
