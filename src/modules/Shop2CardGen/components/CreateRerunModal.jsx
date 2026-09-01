import React, { useState } from 'react'
import { X, AlertTriangle, Send, Loader2 } from 'lucide-react'
import { shop2RerunService } from '../services/shop2RerunService'

export function CreateRerunModal({
  row,
  orders = [],
  onClose,
  onSuccess
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    if (row?.ordersList && row.ordersList.length > 0) {
      return row.ordersList[0].orderId !== 'no-order' ? row.ordersList[0].orderId : ''
    }
    return row?.orderId !== 'no-order' ? row?.orderId || '' : ''
  })

  const [rerunQty, setRerunQty] = useState(() => {
    return row?.shop2ScrapQty > 0 ? row.shop2ScrapQty : 10
  })

  const [reason, setReason] = useState('Брак у Цеху №2 (Малярка/Пресування)')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!row) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rerunQty || Number(rerunQty) <= 0) {
      setError('Вкажіть кількість деталей для довипуску')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await shop2RerunService.createRerunRequest({
        orderId: selectedOrderId || null,
        nomenclatureId: row.nomId,
        qty: Number(rerunQty),
        reason
      })

      alert(`✅ Запит на Довипуск створено успішно!\nСформовано Наряд Цеху №1: ${res.rerunOrderNum} на ${rerunQty} шт.`)
      if (typeof onSuccess === 'function') onSuccess(res)
      onClose()
    } catch (err) {
      console.error('[CreateRerunModal] Error:', err)
      setError(err.message || 'Помилка створення довипуску')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg, #0e0e0e)', width: '100%', maxWidth: '540px', borderRadius: '24px', padding: '36px', position: 'relative', border: '1px solid var(--border, #222)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '22px', right: '22px', background: 'var(--border, #1c1c1c)', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 900, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} /> ЗАПИТ ДОВИПУСКУ В ЦЕХ №1
          </span>
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 950, margin: '0 0 4px', color: 'var(--text, #fff)' }}>
          Оформлення Довипуску
        </h2>
        <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.9rem', marginBottom: '20px', fontWeight: 800 }}>
          {row.nomName} {row.nomCode ? `(${row.nomCode})` : ''}
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Target Order Selection */}
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
              Батьківський Наряд (до якого прив'язати Довипуск):
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid var(--border, #2a2a2a)', color: 'var(--text, #fff)', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', outline: 'none', fontWeight: 800 }}
            >
              <option value="">-- Без прив'язки (Загальний складський довипуск) --</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.order_num} {o.customer ? `(${o.customer})` : ''}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.68rem', color: '#ff9000', marginTop: '6px', display: 'block', fontWeight: 800 }}>
              💡 У Цеху №1 буде створено дочірній наряд (наприклад: {selectedOrderId ? (orders.find(o => String(o.id) === String(selectedOrderId))?.order_num || 'Наряд') + '-Д1' : 'Наряд-Д1'}) з розрахунком листів металу та фрез.
            </span>
          </div>

          {/* Quantity Input */}
          <div>
            <label style={{ display: 'block', color: '#ef4444', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
              Кількість для Довипуску (шт):
            </label>
            <input
              type="number"
              min="1"
              value={rerunQty}
              onChange={(e) => setRerunQty(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontSize: '1.4rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '14px', outline: 'none' }}
            />
          </div>

          {/* Reason Input */}
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
              Причина Довипуску:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина списання заготовок..."
              style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid var(--border, #2a2a2a)', color: 'var(--text, #fff)', padding: '12px', borderRadius: '14px', fontSize: '0.85rem', outline: 'none', fontWeight: 700 }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '8px',
              width: '100%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              padding: '18px',
              borderRadius: '16px',
              fontSize: '0.95rem',
              fontWeight: 950,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              border: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 10px 20px -5px rgba(239, 68, 68, 0.4)'
            }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {isSubmitting ? 'Надсилання...' : '🚀 Створити Наряд-Довипуск у Цех №1'}
          </button>
        </form>
      </div>
    </div>
  )
}
