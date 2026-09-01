import React, { useState } from 'react'
import { X, AlertTriangle, Send, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { shop2RerunService } from '../services/shop2RerunService'

export function DeficitRerunListModal({
  deficitRows = [],
  orders = [],
  onClose,
  onSuccess
}) {
  const [submittingKey, setSubmittingKey] = useState(null)
  const [completedKeys, setCompletedKeys] = useState(new Set())
  const [error, setError] = useState(null)

  const handleOrderRerun = async (row) => {
    setSubmittingKey(row.key)
    setError(null)

    try {
      const orderId = (row.ordersList && row.ordersList.length > 0 && row.ordersList[0].orderId !== 'no-order')
        ? row.ordersList[0].orderId
        : (row.orderId !== 'no-order' ? row.orderId : null)

      const res = await shop2RerunService.createRerunRequest({
        orderId,
        nomenclatureId: row.nomId,
        qty: row.shop2ScrapQty,
        reason: 'Авто-запит через дефіцит браку Цеху №2'
      })

      setCompletedKeys(prev => new Set(prev).add(row.key))
      if (typeof onSuccess === 'function') onSuccess(res)
    } catch (err) {
      console.error('[DeficitRerunListModal] Error:', err)
      setError(`Помилка для ${row.nomName}: ${err.message}`)
    } finally {
      setSubmittingKey(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg, #ffffff)', width: '100%', maxWidth: '680px', borderRadius: '24px', padding: '32px', position: 'relative', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', color: 'var(--text, #0f172a)' }} onClick={e => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '22px', right: '22px', background: 'var(--input-bg, #f1f5f9)', border: '1px solid var(--border, #cbd5e1)', color: 'var(--text-muted, #64748b)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 900, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={15} /> ДЕФІЦИТ ДЕТАЛЕЙ У ЦЕХУ №2
          </span>
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 950, margin: '0 0 6px', color: 'var(--text, #0f172a)' }}>
          Критичні деталі, що потребують Довипуску
        </h2>
        <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', marginBottom: '24px', fontWeight: 600 }}>
          Через зафіксований брак у Цеху №2 виник дефіцит під закриття нарядів. Створіть дочірній наряд розкрою в 1 клік:
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {/* Deficit List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {deficitRows.map(row => {
            const isDone = completedKeys.has(row.key)
            const isSubmitting = submittingKey === row.key

            return (
              <div
                key={row.key}
                style={{
                  background: 'var(--input-bg, #f8fafc)',
                  border: isDone ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: '0.95rem', color: 'var(--text, #0f172a)' }}>
                    {row.nomName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Серія: {row.productFamily}</span>
                    <span>•</span>
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>Брак Цеху 2: -{row.shop2ScrapQty} шт</span>
                  </div>
                </div>

                <div>
                  {isDone ? (
                    <span style={{ color: '#059669', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '8px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Надіслано в Цех 1
                    </span>
                  ) : (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleOrderRerun(row)}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 950,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <Send size={14} />
                      {isSubmitting ? 'Створення...' : `Довипуск ${row.shop2ScrapQty} шт`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
