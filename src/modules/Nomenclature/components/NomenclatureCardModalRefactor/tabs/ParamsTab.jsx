import React from 'react'
import { Layers, Clock, Tag } from 'lucide-react'

export const ParamsTab = ({
  item,
  linkedSheet,
  normQty,
  cutterRes
}) => {
  return (
    <>
              
              {/* Material & Yield Card */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                      '! · °  °  » Q!! U  ° ! Q! U  Q  °
                  </div>
                  {linkedSheet ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>@_</span>
                      <div>
                        <div style={{ fontWeight: 900, color: '#059669', fontSize: '0.95rem' }}>{linkedSheet.name}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted, #64748b)' }}>{linkedSheet.code}</div>
                      </div>
                    </div>
                  ) : item.default_material_id ? (
                    <div style={{ color: '#059669', fontWeight: 800 }}> : Q!! [ID: {item.default_material_id.substring(0, 8)}...]</div>
                  ) : (
                    <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>2Y ?Q   Q! U  Q !S   µ  · ° T!! W » µ  U</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                     \ U! X °   Q!& U ‘!S  ·  » Q!! °
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: normQty ? '#059669' : 'var(--text-muted, #64748b)' }}>
                    {normQty ? `${normQty} !¬! /  » Q!!` : '2'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                       µ!!S!! !! µ · Q
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: cutterRes ? '#d97706' : 'var(--text-muted, #64748b)' }}>
                    {cutterRes ? `${cutterRes}  » / !!` : '2'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                      ° · U  °  U ‘ Q  Q! !   Q X!!!S
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                    {item.unit || '!¬!'}
                  </div>
                </div>
              </div>

              {/* Load Timings ( ^ °  X!  V Q   °  ° ! ° ¶ µ  !   °  » Q!!) */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid var(--border-color, #e2e8f0)'
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#ff9000" />
                   ^ °  X!  V Q  · °  ° ! ° ¶ µ  !  § _ Y ( · ° » µ ¶  U  ! ‘  W °!!!!  » Q!!! ):
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  {[2, 4, 8, 16, 32, 64].map(sheets => {
                    const timeVal = item.rule_params?.loadTimings ? item.rule_params.loadTimings[sheets] : null
                    const hasVal = timeVal !== '' && timeVal !== null && timeVal !== undefined
                    return (
                      <div 
                        key={sheets}
                        style={{
                          background: hasVal ? 'rgba(255, 144, 0, 0.08)' : 'var(--bg, #f1f5f9)',
                          border: hasVal ? '1px solid rgba(255, 144, 0, 0.3)' : '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: '12px',
                          padding: '12px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
                          {sheets} {sheets < 5 ? ' » Q!! Q' : ' » Q!!! '}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: hasVal ? '#d97706' : 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                          {hasVal ? `${timeVal} !& ` : '2'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Full Rule Params JSON Explorer */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid var(--border-color, #e2e8f0)'
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={18} color="#ff9000" />
                   !! ! µ!& !!! !  W °! ° X µ!! Q (ERP Registry Rule Params):
                </h3>

                {item.rule_params && Object.keys(item.rule_params).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {Object.entries(item.rule_params)
                      .filter(([key]) => key !== 'loadTimings')
                      .map(([key, value]) => (
                        <div 
                          key={key}
                          style={{
                            background: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '10px',
                            padding: '10px 14px'
                          }}
                        >
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                            {key}
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #0f172a)', marginTop: '3px' }}>
                            {typeof value === 'boolean' ? (value ? ' ^ ° T' : ' \!') : String(value || '2')}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}> _ °! ° X µ!! Q  ! ‘!!S! !</div>
                )}
              </div>
            </div>
          )}

          {/* 2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R
              TAB 3: CNC OPERATIONS ( ^ " ђ \ [ : [    § \    [ _ "   R ¦   !  § _ Y)
    </>
  )
}
