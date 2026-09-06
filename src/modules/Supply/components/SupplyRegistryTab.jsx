import React from 'react'
import { History, Package, CheckCircle, Warehouse } from 'lucide-react'
import { apiService } from '../../../services/apiDispatcher'
import { getStatusLabel, getDocDisplayId, resolveItemName, resolveItemQty } from '../utils/supplyHelpers'

export const SupplyRegistryTab = ({
  isProcurementOnly,
  receptionDocs = [],
  expandedDoc,
  setExpandedDoc,
  processingDocs,
  setProcessingDocs,
  setReceptionDocToAccept,
  isDocAvailable,
  sendDocToWarehouse,
  supabase,
  refreshTable
}) => {
  return (
    <section className="registry-col" style={{ width: '100%' }}>
      <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted, #555)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <History size={18} className="text-secondary" /> РЕЄСТР ПОСТАВОК
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(receptionDocs || [])
          .filter(doc => {
            if (isProcurementOnly) {
              return doc.target_warehouse === 'production' || !doc.target_warehouse || doc.type === 'purchase'
            } else {
              return doc.target_warehouse === 'production' || doc.source_warehouse === 'production' || doc.type === 'internal_transfer'
            }
          })
          .map(doc => (
          <div key={doc.id} className="doc-card" style={{ background: 'var(--card-bg, #111)', borderRadius: '20px', border: '1px solid var(--border-color, #222)', overflow: 'hidden' }}>
            <div
              onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
              style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ background: 'var(--card-inner-bg, #0a0a0a)', padding: '12px', borderRadius: '12px', color: doc.status === 'completed' ? '#10b981' : '#ff9000' }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-color, #fff)' }}>{getDocDisplayId(doc)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #444)' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className={`status-pill ${doc.status}`} style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', padding: '5px 10px', borderRadius: '20px' }}>
                {getStatusLabel(doc.status)}
              </div>
            </div>

            {expandedDoc === doc.id && (
              <div style={{ padding: '20px', background: 'var(--card-inner-bg, #0a0a0a)', borderTop: '1px solid var(--border-color, #222)' }}>
                <div style={{ marginBottom: '15px' }}>
                  {(doc.items || []).map((it, idx) => {
                    const itemName = resolveItemName(it, idx)
                    const itemQty = resolveItemQty(it)
                    const expectedQty = it.expected_qty ?? it.qty ?? it.needed ?? it.missingAmount ?? it.quantity
                    const actualQty = it.actual_qty ?? it.accepted_qty
                    const discrepancyQty = Number(it.discrepancy_qty) || 0
                    const hasReceptionAudit = actualQty !== undefined || discrepancyQty !== 0
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-color, #111)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)' }}>{itemName}</span>
                        {hasReceptionAudit ? (
                          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted, #777)' }}>
                            <div>Док: <strong style={{ color: 'var(--text-color, #fff)' }}>{expectedQty}</strong> · Факт: <strong style={{ color: '#10b981' }}>{actualQty}</strong></div>
                            {discrepancyQty !== 0 && (
                              <div style={{ color: discrepancyQty < 0 ? '#ef4444' : '#f59e0b', fontWeight: 900 }}>
                                Акт розбіжності: {discrepancyQty > 0 ? `+${discrepancyQty}` : discrepancyQty}
                              </div>
                            )}
                          </div>
                        ) : (
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-color, #fff)' }}>{itemQty}</strong>
                        )}
                      </div>
                    )
                  })}
                </div>

                {doc.status !== 'completed' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '15px', borderTop: '1px dashed var(--border-color, #222)', paddingTop: '15px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #555)', fontWeight: 800 }}>СКЛАД ПРИЗНАЧЕННЯ:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[
                        { id: 'operational', label: 'СО (Операційний)' },
                        { id: 'production', label: 'СВ (Виробництва)' }
                      ].map(w => {
                        const active = (doc.target_warehouse || 'production') === w.id
                        return (
                          <button
                            key={w.id}
                            type="button"
                            disabled={processingDocs.has(doc.id)}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setProcessingDocs(prev => new Set(prev).add(doc.id))
                              try {
                                const { error } = await supabase
                                  .from('reception_docs')
                                  .update({ target_warehouse: w.id })
                                  .eq('id', doc.id)
                                if (error) throw error
                                if (typeof refreshTable === 'function') refreshTable('reception_docs')
                              } catch (err) {
                                alert('Помилка оновлення складу: ' + err.message)
                              } finally {
                                setProcessingDocs(prev => { const next = new Set(prev); next.delete(doc.id); return next; })
                              }
                            }}
                            style={{
                              background: active ? 'rgba(255, 144, 0, 0.12)' : 'transparent',
                              border: active ? '1px solid #ff9000' : '1px solid var(--border-color, rgba(255,255,255,0.07))',
                              color: active ? '#ff9000' : 'var(--text-muted, #888)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {w.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {doc.status === 'shipped' && !isProcurementOnly && (
                  <button
                    disabled={processingDocs.has(doc.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setReceptionDocToAccept(doc)
                    }}
                    style={{ width: '100%', padding: '12px', background: '#10b981', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.75rem', cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: processingDocs.has(doc.id) ? 0.5 : 1 }}
                  >
                    <CheckCircle size={16} /> {processingDocs.has(doc.id) ? 'ПРИЙНЯТТЯ...' : 'ПРИЙНЯТИ НА СКЛАД'}
                  </button>
                )}

                {doc.status === 'ordered' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      disabled={processingDocs.has(doc.id) || !isDocAvailable(doc)}
                      onClick={async (e) => {
                        e.stopPropagation()
                        setProcessingDocs(prev => new Set(prev).add(doc.id))
                        try {
                          const newTarget = isProcurementOnly ? 'production' : 'operational'
                          const newSource = isProcurementOnly ? null : 'production'
                          await apiService.submitSendDocToWarehouse(doc.id, sendDocToWarehouse, newTarget, newSource)
                        } finally {
                          setProcessingDocs(prev => { const next = new Set(prev); next.delete(doc.id); return next; })
                        }
                      }}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        background: isDocAvailable(doc) ? '#0ea5e9' : 'var(--btn-disabled-bg, #333)', 
                        color: isDocAvailable(doc) ? '#fff' : 'var(--text-muted, #666)', 
                        border: 'none', 
                        borderRadius: '10px', 
                        fontWeight: 900, 
                        fontSize: '0.75rem', 
                        cursor: (processingDocs.has(doc.id) || !isDocAvailable(doc)) ? 'not-allowed' : 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '10px', 
                        opacity: processingDocs.has(doc.id) ? 0.5 : 1 
                      }}
                    >
                      <Warehouse size={16} /> 
                      {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 
                       (isProcurementOnly ? 'ВІДПРАВИТИ У ВИРОБНИЦТВО' : 'ПЕРЕДАТИ НА СО')
                      }
                    </button>
                    {!isDocAvailable(doc) && (
                      <div style={{ fontSize: '0.65rem', color: '#ef4444', textAlign: 'center', fontWeight: 800 }}>
                        НЕМАЄ НА СКЛАДІ (ОЧІКУЙТЕ ПОСТАЧАННЯ)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {(receptionDocs || []).length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted, #333)', fontSize: '0.85rem' }}>Історія поставок порожня</div>
        )}
      </div>
    </section>
  )
}
