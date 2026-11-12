import React, { useState, useEffect, useMemo } from 'react'
import { X, Play, Loader2, AlertCircle, PackageCheck, Paintbrush, Wrench } from 'lucide-react'
import { isPackagingOperation } from '../constants/shop2Stages'
import {
  resolveShop2BufferRowRouting,
  getShop2UnitMinutes,
  calculateShop2PlannedMinutes,
  formatShop2PlannedMinutes
} from '../../../utils/shop2RoutingUtils'

export function GenerateShop2CardModal({
  row,
  stages = [],
  nomenclatures = [],
  orders = [],
  isSubmitting = false,
  error = null,
  onClose,
  onGenerate
}) {
  const [stage, setStage] = useState('Пресування')
  const [batchSize, setBatchSize] = useState(500)
  const [cardCount, setCardCount] = useState(1)

  const routing = useMemo(
    () => resolveShop2BufferRowRouting(row, nomenclatures, orders),
    [row, nomenclatures, orders]
  )

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
      if (routing.recommendedStage) {
        setStage(routing.recommendedStage)
      }
    }
  }, [row, routing.recommendedStage])

  if (!row) return null

  const availableQty = row.availableQty || 0
  const totalQtyToCreate = Math.max(0, batchSize * cardCount)
  const isOverBuffer = totalQtyToCreate > availableQty
  const isValid = totalQtyToCreate > 0 && !isOverBuffer && !isSubmitting
  const isDirectSGP = isPackagingOperation(stage)
  const unitPlannedMin = !isDirectSGP ? getShop2UnitMinutes(routing.nom, stage) : 0
  const batchPlannedMin = !isDirectSGP ? calculateShop2PlannedMinutes(routing.nom, stage, batchSize) : 0
  const totalPlannedMin = !isDirectSGP ? calculateShop2PlannedMinutes(routing.nom, stage, totalQtyToCreate) : 0

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
      <div style={{ background: 'var(--card-bg, #0e0e0e)', width: '100%', maxWidth: '560px', borderRadius: '24px', padding: '36px', position: 'relative', border: '1px solid var(--border, var(--border-subtle))', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
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

        {/* Shop 2 Routing & Order Painting Requirements */}
        {(routing.requiresPressing || routing.requiresPainting || routing.orderPaintingSpecsRaw.length > 0) && (
          <div style={{
            background: routing.shouldPaintAny ? 'rgba(139, 92, 246, 0.08)' : 'rgba(249, 115, 22, 0.07)',
            border: routing.shouldPaintAny ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(249, 115, 22, 0.25)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                Маршрут деталі (Цех №2):
              </span>
              {routing.requiresPressing && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 900, color: '#ea580c', background: 'rgba(249, 115, 22, 0.14)', border: '1px solid rgba(249, 115, 22, 0.35)', padding: '2px 8px', borderRadius: '6px' }}>
                  <Wrench size={12} /> Пресування
                </span>
              )}
              {routing.requiresPainting && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 900, color: '#7c3aed', background: 'rgba(139, 92, 246, 0.14)', border: '1px solid rgba(139, 92, 246, 0.35)', padding: '2px 8px', borderRadius: '6px' }}>
                  <Paintbrush size={12} /> Фарбується по номенклатурі
                </span>
              )}
              {routing.isRoutingConfigured && !routing.requiresPainting && (
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
                  (деталь не потребує фарбування)
                </span>
              )}
            </div>

            {routing.requiresPainting && routing.paintingSpecs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {routing.paintingSpecs.map((spec, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: 'var(--card-bg, rgba(255,255,255,0.04))',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    borderRadius: '10px',
                    padding: '8px 10px'
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 900, color: '#7c3aed' }}>
                      <span>🎨 {spec.typeLabel}: {spec.summaryText}</span>
                      {spec.edgeSwatch && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', padding: '2px 7px', borderRadius: '999px', fontSize: '0.72rem', color: 'var(--text, #0f172a)' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: spec.edgeSwatch, display: 'inline-block' }} />
                          Торці: {spec.edgeColor}
                        </span>
                      )}
                      {spec.orderNum && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
                          ({spec.orderNum})
                        </span>
                      )}
                    </div>
                    {spec.notes && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                        Примітка малярці: {spec.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {routing.requiresPainting && routing.paintingSpecs.length === 0 && (
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
                У нарядах цієї позиції обрано «Без фарбування» — деталь на малярку не направляється.
              </div>
            )}
          </div>
        )}

        {/* Orders Breakdown Badge Pool */}
        {row.ordersList && row.ordersList.length > 0 && (
          <div style={{ background: 'var(--input-bg, #060606)', border: '1px solid var(--border, #161616)', borderRadius: '12px', padding: '10px 14px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #666)', fontWeight: 800 }}>📦 НАРЯДИ В КУПІ:</span>
            {(row.ordersList.filter(o => o.availableQty > 0).length > 0 ? row.ordersList.filter(o => o.availableQty > 0) : row.ordersList).map((o, idx) => (
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

        {isDirectSGP && (
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', padding: '12px 16px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PackageCheck size={18} />
            <span>Пряма передача на склад СГП (минаючи обробку в Цеху №2). Деталі відразу підуть у <strong>ФАКТИЧНИЙ ВИХІД (СГП)</strong>.</span>
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
              style={{ width: '100%', background: 'var(--input-bg, #000)', border: '1px solid var(--border, var(--border-subtle))', color: 'var(--text, #fff)', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', outline: 'none', fontWeight: 800 }}
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
          <div style={{ background: isOverBuffer ? 'rgba(239, 68, 68, 0.08)' : 'var(--input-bg, #050505)', border: isOverBuffer ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border, var(--border-subtle))', borderRadius: '16px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: isOverBuffer ? '#ef4444' : 'var(--text-muted, #888)', fontWeight: 800 }}>
                {isOverBuffer ? '⚠️ Перевищено доступний буфер!' : 'Разом у випуск:'}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 950, color: isOverBuffer ? '#ef4444' : (isDirectSGP ? '#10b981' : '#38bdf8') }}>
                {totalQtyToCreate.toLocaleString()} <small style={{ fontSize: '0.7rem', color: 'var(--text-muted, #666)' }}>шт</small>
              </span>
            </div>
            {unitPlannedMin > 0 && !isOverBuffer && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: '8px', fontSize: '0.76rem', fontWeight: 800 }}>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                  ⏱️ План ({unitPlannedMin} хв/шт):
                </span>
                <span style={{ color: '#a78bfa', fontWeight: 900 }}>
                  {cardCount > 1
                    ? `${Math.round(batchPlannedMin)} хв/картка · всього ${Math.round(totalPlannedMin)} хв (${formatShop2PlannedMinutes(totalPlannedMin)})`
                    : `${Math.round(totalPlannedMin)} хв (${formatShop2PlannedMinutes(totalPlannedMin)})`}
                </span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={!isValid}
            style={{
              marginTop: '6px',
              width: '100%',
              background: isValid 
                ? (isDirectSGP ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ff9000, #ff5500)')
                : 'var(--border, #1f1f1f)',
              color: isValid ? 'var(--text-strong)' : 'var(--text-muted, #444)',
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
              boxShadow: isValid ? (isDirectSGP ? '0 10px 20px -5px rgba(16, 185, 129, 0.4)' : '0 10px 20px -5px rgba(255, 144, 0, 0.4)') : 'none'
            }}
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isDirectSGP ? (
              <PackageCheck size={18} />
            ) : (
              <Play size={18} fill={isValid ? '#fff' : 'none'} />
            )}
            {isSubmitting ? 'Створення...' : (isDirectSGP ? 'Підтвердити передачу на СГП' : 'Підтвердити та запустити РК')}
          </button>
        </form>
      </div>
    </div>
  )
}
