import React from 'react'
import { Layers, Sparkles, Calendar } from 'lucide-react'

export function TumblingKitsColumn({
  col1Ref,
  orderKits,
  displayedKits,
  orderPage,
  totalPages
}) {
  return (
    <section className="tumbling-col-panel" style={{
      background: 'var(--col-bg, #0f172a)',
      border: '2px solid var(--col-border, #334155)',
      borderRadius: '20px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--col-shadow, 0 10px 30px rgba(0,0,0,0.15))'
    }}>
      <div style={{
        padding: '14px 20px',
        background: 'var(--col-head-bg, #1e293b)',
        borderBottom: '2px solid var(--col-border, #334155)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', margin: 0 }}>
          Комплектність нарядів {totalPages > 1 ? `(${orderPage + 1}/${totalPages})` : ''}
        </h2>
        <Sparkles size={18} color="#ff9000" />
      </div>

      <div ref={col1Ref} style={{
        flex: 1,
        padding: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        scrollbarWidth: 'none'
      }}>
        {orderKits.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
            <Layers size={52} color="#ff9000" />
            <div style={{ fontSize: '0.9rem', marginTop: '10px', fontWeight: 900 }}>Немає активних нарядів</div>
          </div>
        ) : (
          displayedKits.map(kit => {
            const compCount = kit.components.length
            const isCompact = compCount > 4

            return (
              <div key={kit.orderId} style={{
                background: 'var(--kit-card-bg, #ffffff)',
                border: '2px solid var(--kit-card-border, #cbd5e1)',
                borderRadius: '16px',
                padding: isCompact ? '12px' : '16px',
                position: 'relative',
                boxShadow: '0 6px 16px rgba(0,0,0,0.06)'
              }}>
                {/* Order header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: isCompact ? '10px' : '14px',
                  borderBottom: '2px solid var(--border-subtle, #e2e8f0)',
                  paddingBottom: isCompact ? '8px' : '10px'
                }}>
                  <div>
                    <div style={{ fontSize: isCompact ? '1.3rem' : '1.5rem', fontWeight: 950, color: '#d97706', letterSpacing: '0.5px' }}>
                      {kit.orderNum}
                    </div>
                    <div style={{ fontSize: isCompact ? '0.9rem' : '1.05rem', color: 'var(--text-primary, #0f172a)', marginTop: '2px', fontWeight: 900 }}>
                      {kit.productName}
                    </div>
                  </div>
                  {kit.deadlineStr && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isCompact ? '0.75rem' : '0.85rem',
                      background: '#fef2f2',
                      color: '#dc2626',
                      padding: isCompact ? '4px 8px' : '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #fca5a5',
                      fontWeight: 950
                    }}>
                      <Calendar size={13} />
                      {new Date(kit.deadlineStr).toLocaleDateString('uk-UA')}
                    </div>
                  )}
                </div>

                {/* Components breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: isCompact ? '8px' : '12px' }}>
                  {kit.components.map(comp => {
                    const isBottleneck = comp.id === kit.bottleneckId
                    const percent = Math.min(100, Math.round(comp.kitRatio * 100))
                    const bzPercent = Math.min(100, Math.round((comp.bzQty / comp.totalNeeded) * 100))
                    const producedPercent = Math.min(100, Math.round((comp.producedQty / comp.totalNeeded) * 100))

                    return (
                      <div key={comp.id} style={{
                        padding: isCompact ? '6px 10px' : '10px 14px',
                        background: isBottleneck ? 'var(--bottleneck-item-bg, #fff1f1)' : 'var(--comp-item-bg, #f8fafc)',
                        border: isBottleneck ? '2px solid #dc2626' : '1px solid var(--comp-item-border, #cbd5e1)',
                        borderRadius: '10px',
                        boxShadow: isBottleneck ? '0 3px 10px rgba(220,38,38,0.12)' : 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCompact ? '4px' : '8px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: isCompact ? '0.82rem' : '0.95rem', fontWeight: 950, color: isBottleneck ? '#dc2626' : 'var(--text-primary, #0f172a)' }}>
                              {comp.name}
                            </span>
                            <span style={{
                              background: comp.statusColor,
                              color: '#ffffff',
                              fontSize: isCompact ? '0.62rem' : '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 950,
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px'
                            }}>
                              {comp.statusText}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isBottleneck && (
                              <span style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                fontSize: isCompact ? '0.6rem' : '0.68rem',
                                fontWeight: 950,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                animation: 'pulse 1.5s infinite'
                              }}>
                                Вузьке місце
                              </span>
                            )}
                            <span style={{ fontSize: isCompact ? '0.8rem' : '0.9rem', fontWeight: 950, color: 'var(--text-primary, #0f172a)' }}>
                              {Math.round(comp.completedKits)} / {kit.targetQty} компл. ({percent}%)
                            </span>
                          </div>
                        </div>

                        {/* Double-segmented progress bar */}
                        <div style={{ height: isCompact ? '6px' : '9px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{
                            width: `${bzPercent}%`,
                            height: '100%',
                            background: '#f59e0b',
                            transition: 'width 0.4s'
                          }} title={`Запас з БЗ: ${bzPercent}%`} />
                          <div style={{
                            width: `${producedPercent}%`,
                            height: '100%',
                            background: isBottleneck ? '#dc2626' : '#0284c7',
                            transition: 'width 0.4s'
                          }} title={`Випущено цехом: ${producedPercent}%`} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: isCompact ? '4px' : '6px', fontSize: isCompact ? '0.68rem' : '0.75rem', color: 'var(--text-muted, #475569)', fontWeight: 900 }}>
                          <span>БЗ: {Math.round(comp.bzQty)} шт ({Math.round(comp.bzQty / comp.qtyPerParent)} компл)</span>
                          <span>Випущено: {Math.round(comp.producedQty)} шт ({Math.round(comp.producedQty / comp.qtyPerParent)} компл)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '10px 0', background: 'var(--col-head-bg, #1e293b)', borderTop: '2px solid var(--col-border, #334155)' }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i} style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: orderPage === i ? '#ff9000' : '#64748b',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      )}
    </section>
  )
}
