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
    <section style={{
      background: 'rgba(15, 15, 22, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.03)',
      borderRadius: '20px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', margin: 0 }}>
          Комплектність нарядів {totalPages > 1 ? `(${orderPage + 1}/${totalPages})` : ''}
        </h2>
        <Sparkles size={14} color="#ff9000" />
      </div>

      <div ref={col1Ref} style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        scrollbarWidth: 'none'
      }}>
        {orderKits.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
            <Layers size={48} />
            <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>Немає активних нарядів</div>
          </div>
        ) : (
          displayedKits.map(kit => (
            <div key={kit.orderId} style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
              padding: '14px',
              position: 'relative'
            }}>
              {/* Order header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#ff9000', letterSpacing: '0.5px' }}>{kit.orderNum}</div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', marginTop: '6px', fontWeight: 800 }}>{kit.productName}</div>
                </div>
                {kit.deadlineStr && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    fontWeight: 900
                  }}>
                    <Calendar size={12} />
                    {new Date(kit.deadlineStr).toLocaleDateString('uk-UA')}
                  </div>
                )}
              </div>

              {/* Components breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {kit.components.map(comp => {
                  const isBottleneck = comp.id === kit.bottleneckId
                  const percent = Math.min(100, Math.round(comp.kitRatio * 100))
                  const bzPercent = Math.min(100, Math.round((comp.bzQty / comp.totalNeeded) * 100))
                  const producedPercent = Math.min(100, Math.round((comp.producedQty / comp.totalNeeded) * 100))

                  return (
                    <div key={comp.id} style={{
                      padding: '12px 14px',
                      background: isBottleneck ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255,255,255,0.01)',
                      border: isBottleneck ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(255,255,255,0.03)',
                      borderRadius: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isBottleneck ? '#ef4444' : '#eee' }}>
                            {comp.name}
                          </span>
                          <span style={{
                            background: `${comp.statusColor}12`,
                            color: comp.statusColor,
                            border: `1px solid ${comp.statusColor}25`,
                            fontSize: '0.6rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 800,
                            textTransform: 'uppercase'
                          }}>
                            {comp.statusText}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isBottleneck && (
                            <span style={{
                              background: '#ef4444',
                              color: '#000',
                              fontSize: '0.6rem',
                              fontWeight: 950,
                              padding: '2px 6px',
                              borderRadius: '5px',
                              textTransform: 'uppercase',
                              animation: 'pulse 1.5s infinite'
                            }}>
                              Вузьке місце
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#aaa' }}>
                            {Math.round(comp.completedKits)} / {kit.targetQty} компл. ({percent}%)
                          </span>
                        </div>
                      </div>

                      {/* Double-segmented progress bar */}
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{
                          width: `${bzPercent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                          transition: 'width 0.4s'
                        }} title={`Запас з БЗ: ${bzPercent}%`} />
                        <div style={{
                          width: `${producedPercent}%`,
                          height: '100%',
                          background: isBottleneck ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                          transition: 'width 0.4s'
                        }} title={`Випущено цехом: ${producedPercent}%`} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.65rem', color: '#666', fontWeight: 700 }}>
                        <span>БЗ: {Math.round(comp.bzQty)} шт ({Math.round(comp.bzQty / comp.qtyPerParent)} компл)</span>
                        <span>Випущено: {Math.round(comp.producedQty)} шт ({Math.round(comp.producedQty / comp.qtyPerParent)} компл)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px 0', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: orderPage === i ? '#ff9000' : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      )}
    </section>
  )
}
