import React, { useState } from 'react'
import { PackageCheck, CheckCircle2, Clock, Scissors, ArrowRight, Pencil, Check } from 'lucide-react'
import { supabase } from '../../../supabase'

export function SgpReceptionPanel({
  docs = [],
  confirmReception,
  currentUser,
  onAccepted,
  isDark,
  t
}) {
  const [actualQuantities, setActualQuantities] = useState({})
  const [editingKeys, setEditingKeys] = useState({})
  const [processingId, setProcessingId] = useState(null)

  const posLower = String(currentUser?.position || '').toLowerCase()
  const roleLower = String(currentUser?.role || '').toLowerCase()
  const isAdmin = posLower.includes('адмін') || roleLower === 'admin' || currentUser?.login === 'admin@workshop.local'

  if (!docs || docs.length === 0) return null

  const getQtyValue = (docId, idx, defaultQty) => {
    const key = `${docId}-${idx}`
    return actualQuantities[key] !== undefined ? actualQuantities[key] : String(defaultQty)
  }

  const handleQtyChange = (docId, idx, val) => {
    if (!isAdmin) return
    setActualQuantities(prev => ({ ...prev, [`${docId}-${idx}`]: val }))
  }

  const handleAccept = async (doc) => {
    if (!confirmReception || processingId) return
    setProcessingId(doc.id)
    try {
      const docItems = Array.isArray(doc.items) ? doc.items : []
      const actualItems = docItems.map((item, idx) => {
        const expected = Number(item.expected_qty ?? item.qty ?? 0)
        const rawInput = isAdmin ? actualQuantities[`${doc.id}-${idx}`] : undefined
        const parsed = rawInput !== undefined ? Math.max(0, parseInt(rawInput, 10) || 0) : expected
        return {
          index: idx,
          actual_qty: parsed,
          qty: parsed
        }
      })

      const result = await confirmReception(doc.id, { actualItems })
      if (result?.success === false) return

      const acceptedByName = [currentUser?.first_name, currentUser?.last_name]
        .filter(Boolean)
        .join(' ') || currentUser?.login || 'Комірник СГП'
      const acceptedAt = new Date().toISOString()

      // Ensure accepted hardware/rubber items keep type='hardware' in SGP inventory
      // and stamp accepted_at / accepted_by into reception_docs.items for the registry.
      const updatedItems = docItems.map((item, idx) => {
        const acceptedQty = actualItems[idx]?.actual_qty ?? Number(item.qty || 0)
        return {
          ...item,
          accepted_qty: acceptedQty,
          actual_qty: acceptedQty,
          accepted_at: acceptedAt,
          accepted_by: acceptedByName
        }
      })

      for (const item of updatedItems) {
        if (item.type === 'hardware') {
          let q = supabase.from('inventory').select('id, type').eq('warehouse', 'sgp')
          if (item.nomenclature_id) q = q.eq('nomenclature_id', item.nomenclature_id)
          else if (item.name) q = q.ilike('name', item.name.trim())
          const { data: invRows } = await q
          if (invRows && invRows.length > 0) {
            const wrongTypeIds = invRows.filter(r => r.type !== 'hardware').map(r => r.id)
            if (wrongTypeIds.length > 0) {
              await supabase.from('inventory').update({ type: 'hardware' }).in('id', wrongTypeIds)
            }
          }
        }
      }

      await supabase
        .from('reception_docs')
        .update({ items: updatedItems })
        .eq('id', doc.id)

      if (typeof onAccepted === 'function') {
        onAccepted(doc)
      }
    } catch (err) {
      console.error('[SgpReceptionPanel] Accept error:', err)
      alert('Помилка прийомки на СГП: ' + (err?.message || 'Невідома помилка'))
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div style={{
      background: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
      border: `1.5px solid ${isDark ? 'rgba(52, 211, 153, 0.35)' : '#6ee7b7'}`,
      borderRadius: '18px',
      padding: '18px 20px',
      marginBottom: '20px',
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(16, 185, 129, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
            padding: '8px',
            borderRadius: '10px',
            color: isDark ? '#34d399' : '#059669'
          }}>
            <PackageCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 950, color: t.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>ПРИЙОМКА НА СГП (ВХІДНІ ПАРТІЇ)</span>
              <span style={{
                background: '#10b981',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 900
              }}>
                {docs.length}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: t.textSecondary, fontWeight: 700, marginTop: '2px' }}>
              Підтвердьте надходження готових комплектуючих для зарахування на СГП та фіксації в реєстрі
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '12px' }}>
        {docs.map(doc => {
          const items = Array.isArray(doc.items) ? doc.items : []
          const firstItem = items[0] || {}
          const isBusy = processingId === doc.id

          return (
            <div
              key={doc.id}
              style={{
                background: t.cardBg,
                border: `1.5px solid ${t.cardBorder}`,
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 900, color: isDark ? '#fbbf24' : '#d97706' }}>
                  <Scissors size={14} />
                  <span>{firstItem.source_label || 'Порізка гуми (Цех №2)'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: t.textMuted, fontWeight: 700 }}>
                  <Clock size={12} />
                  <span>{doc.created_at ? new Date(doc.created_at).toLocaleString('uk-UA') : '—'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((item, idx) => {
                  const expected = Number(item.expected_qty ?? item.qty ?? 0)
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                        border: `1px solid ${t.tableBorder}`,
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 900, color: t.textPrimary }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {item.code && <span style={{ fontFamily: 'monospace' }}>{item.code}</span>}
                          {item.batch_number && <span>• Партія: <strong>{item.batch_number}</strong></span>}
                          {item.operators && <span>• {item.operators}</span>}
                        </div>
                        <div style={{ marginTop: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 800, color: isDark ? '#fb923c' : '#ea580c' }}>
                          <ArrowRight size={11} />
                          <span>Метизи & Комплектуючі (СГП)</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.65rem', color: t.textMuted, fontWeight: 800 }}>
                          Очікується: {expected} {item.unit || 'шт'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isAdmin && editingKeys[`${doc.id}-${idx}`] ? (
                            <>
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={getQtyValue(doc.id, idx, expected)}
                                onChange={e => handleQtyChange(doc.id, idx, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    setEditingKeys(prev => ({ ...prev, [`${doc.id}-${idx}`]: false }))
                                  }
                                }}
                                style={{
                                  width: '78px',
                                  padding: '5px 8px',
                                  borderRadius: '8px',
                                  border: '1.5px solid #10b981',
                                  background: t.inputBg,
                                  color: t.textPrimary,
                                  fontWeight: 900,
                                  fontSize: '0.88rem',
                                  textAlign: 'center',
                                  outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: t.textSecondary }}>
                                {item.unit || 'шт'}
                              </span>
                              <button
                                type="button"
                                title="Готово"
                                onClick={() => setEditingKeys(prev => ({ ...prev, [`${doc.id}-${idx}`]: false }))}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.16)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: '#10b981',
                                  borderRadius: '6px',
                                  width: '26px',
                                  height: '26px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span style={{
                                fontWeight: 950,
                                fontSize: '1.05rem',
                                color: t.textPrimary
                              }}>
                                {isAdmin ? getQtyValue(doc.id, idx, expected) : expected} {item.unit || 'шт'}
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  title="Редагувати кількість (тільки адмін)"
                                  onClick={() => setEditingKeys(prev => ({ ...prev, [`${doc.id}-${idx}`]: true }))}
                                  style={{
                                    background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                                    border: `1px solid ${t.tableBorder}`,
                                    color: t.textMuted,
                                    borderRadius: '6px',
                                    width: '26px',
                                    height: '26px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleAccept(doc)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#10b981',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  cursor: isBusy ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isBusy ? 0.7 : 1
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isBusy ? 'ЗАРАХУВАННЯ...' : 'ПРИЙНЯТИ НА СГП'}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

