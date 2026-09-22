import React from 'react'
import { Cpu, Tag, ExternalLink } from 'lucide-react'

export const CncTab = ({
  item,
  loadingCnc,
  cncOperations,
  resolveCutterInfo
}) => {
  return (
    <>
              
              {/* Multi-Machine Cutters Summary Matrix */}
              {cncOperations && cncOperations.length > 0 && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  borderRadius: '16px',
                  padding: '18px 22px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>2Y"?Q</span>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                            Q!! °! Q ! !!!!S X µ !!S (!! µ ·)  · ° ! Q W ° X Q   µ!!! °!! 
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                           \ U! X Q ! W Q! °  ! !! µ · ! U ·! °!& U  °  U !  ‘ Q ! ‘!S ° »!
  U  W! ‘  T U ¶ µ  ! Q W   µ!!! °! ° (  ° » °!¬!!S  °  !)
                        </div>
                      </div>
                    </div>
                    <span style={{
                      background: 'rgba(255, 144, 0, 0.1)',
                      color: '#d97706',
                      border: '1px solid rgba(255, 144, 0, 0.25)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: 800
                    }}>
                        µ!!! °!!  !S ! W µ!  Q!! T °! !!: {cncOperations.length}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {cncOperations.map((op, idx) => {
                      const rawCutters = [...(op.side1_ops || []), ...(op.side2_ops || []), ...(op.side2_cut_ops || [])].filter(s => typeof s === 'string' && s.startsWith('__CUTTER__'))
                      const cutters = rawCutters.map(s => {
                        const parts = s.split(':')
                        return resolveCutterInfo(parts[1], parseFloat(parts[2]) || 1)
                      })

                      return (
                        <div 
                          key={op.id || idx}
                          style={{
                            background: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '6px' }}>
                            <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>@_ђ?Q</span>
                              <span>{op.machine_type || `  µ!!! °! #${idx + 1}`}</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)', fontWeight: 700 }}>
                              {cutters.length > 0 ? `${cutters.length} !! µ ·` : '  µ · !! µ ·'}
                            </span>
                          </div>

                          {cutters.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {cutters.map((c, ci) => (
                                <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text, #0f172a)' }}>
                                    <span style={{ color: '#d97706', marginRight: '6px' }}>2^</span>
                                    {c.name}
                                  </div>
                                  <div style={{ fontWeight: 900, color: '#d97706', background: 'rgba(255, 144, 0, 0.12)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                                    {c.qty} !¬!
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                                Q!! °! Q !! µ ·   µ  · °!! T! U  °  U
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {cncOperations && cncOperations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {cncOperations.map((op, idx) => {
                    const side1List = (op.side1_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                    const side2List = (op.side2_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                    const realCutOps = (op.side2_cut_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                    const rawCutters = [...(op.side1_ops || []), ...(op.side2_ops || []), ...(op.side2_cut_ops || [])].filter(s => typeof s === 'string' && s.startsWith('__CUTTER__'))
                    
                    const cutterItems = rawCutters.map(s => {
                      const parts = s.split(':')
                      return resolveCutterInfo(parts[1], parseFloat(parts[2]) || 1)
                    })

                    return (
                      <div 
                        key={op.id || idx}
                        style={{
                          background: 'var(--card-bg, #ffffff)',
                          borderRadius: '16px',
                          padding: '20px 24px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>@_ђ?Q</span>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#d97706' }}>
                                 \ ° » °!¬!!S  °  ! #{idx + 1}: {op.machine_type || ' ! °  ‘ °!!  Q   § _ Y'}
                              </div>
                              {op.machine_id && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                                    µ!!! °! ID: {op.machine_id}
                                </div>
                              )}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            background: 'rgba(255, 144, 0, 0.1)',
                            color: '#d97706',
                            border: '1px solid rgba(255, 144, 0, 0.25)',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontWeight: 800
                          }}>
                             ^ Q W !! °  T °: {op.machine_type || ' \ µ   T ° · °  U'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                          {/* Side 1 */}
                          <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0284c7', marginBottom: '8px' }}>
                              @_µ  ! U! U  ° 1 (Side 1)
                            </div>
                            {side1List.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {side1List.map((s, i) => (
                                  <span key={i} style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.78rem' }}> \ µ X °!  U W µ! °! !   ‘ »! !! U! U  Q 1</span>
                            )}
                          </div>

                          {/* Side 2 */}
                          <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#059669', marginBottom: '8px' }}>
                              @__^  ! U! U  ° 2 (Side 2)
                            </div>
                            {side2List.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {side2List.map((s, i) => (
                                  <span key={i} style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.78rem' }}> \ µ X °!  U W µ! °! !   ‘ »! !! U! U  Q 2</span>
                            )}
                          </div>

                          {/* Cut Ops (Only real cut operations without __CUTTER__ strings) */}
                          {realCutOps.length > 0 && (
                            <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color, #e2e8f0)', gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#d97706', marginBottom: '8px' }}>
                                2Z?Q  ! ‘!! · !  U W µ! °! !! (Side 2 Cut Ops)
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {realCutOps.map((s, i) => (
                                  <span key={i} style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dedicated Cutters Consumption Section with Machine Type */}
                          {cutterItems.length > 0 && (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(255, 144, 0, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)',
                              borderRadius: '14px',
                              padding: '16px',
                              border: '1px solid rgba(255, 144, 0, 0.3)',
                              gridColumn: '1 / -1'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                  <span>@_: ?Q</span>
                                  <span> !! °  U  » µ !   Q!! °! Q !! µ ·  ‘ »!   µ!!! °! ° «{op.machine_type || ` \ ° » °!¬!!S  °  ! #${idx + 1}`}»:</span>
                                </div>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: '#fff',
                                  color: '#b45309',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255, 144, 0, 0.2)'
                                }}>
                                  2Y"?Q {op.machine_type || ' § _ Y'}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                {cutterItems.map((c, i) => (
                                  <div 
                                    key={i}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      background: 'var(--card-bg, #ffffff)',
                                      padding: '12px 16px',
                                      borderRadius: '10px',
                                      border: '1px solid var(--border-color, #e2e8f0)',
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#d97706' }}>@_</span>
                                        <span>{c.name}</span>
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                        <span>  µ!!! °!: <b>{op.machine_type || ' § _ Y'}</b></span>
                                        {c.code && <span style={{ fontFamily: 'monospace' }}>[{c.code}]</span>}
                                      </div>
                                    </div>
                                    <div style={{
                                      background: 'rgba(255, 144, 0, 0.15)',
                                      color: '#d97706',
                                      padding: '5px 12px',
                                      borderRadius: '8px',
                                      fontSize: '0.85rem',
                                      fontWeight: 900,
                                      whiteSpace: 'nowrap',
                                      marginLeft: '12px',
                                      textAlign: 'right'
                                    }}>
                                      <div>{c.qty} !¬!</div>
                                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>  °  W °!!!!</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  borderRadius: '16px',
                  padding: '40px',
                  textAlign: 'center',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)'
                }}>
                  <Cpu size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                      »! ! !!!   U X µ  T » °!!S! Q !0 µ   µ   ° » °!¬! U  °  U ! µ!&  U » U V!!! !  U W µ! °! !!  § _ Y
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                     [ W µ! °! !! ( ! U! U  ° 1,  ! U! U  ° 2, !! µ · Q)  X U ¶  °   ° » °!¬!!S  °! Q !S  X U ‘!S »! «    ¶ µ  µ!»  ° ± U «  W µ!  Q!! T °! !!».
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R
              TAB 4: INVENTORY BALANCES (   _ /  ¦ " ђ 1 /  ¦ " ђ 2)
    </>
  )
}
