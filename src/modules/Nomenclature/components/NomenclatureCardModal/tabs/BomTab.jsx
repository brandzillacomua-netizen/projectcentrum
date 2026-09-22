import React from 'react'
import { Package, ExternalLink, RefreshCw } from 'lucide-react'

export const BomTab = ({
  item,
  loadingBom,
  bomItems,
  whereUsedItems,
  parentProductsMap,
  itemsMap,
  copyToClipboard,
  copiedKey
}) => {
  return (
    <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#ff9000" />
                    W µ!  Q!! T °! !! BOM ! °  · '! · T Q  ‘ µ! ° » µ :
                </h3>
                {loadingBom && (
                  <span style={{ fontSize: '0.8rem', color: '#ff9000', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} className="animate-spin" />   °  ° ! ° ¶ µ  !...
                  </span>
                )}
              </div>

              {/* 1. WHERE-USED:   U ! T Q!& ! W µ!  Q!! T °! !    ° » µ ¶ Q!!
 ! !  ‘ µ! ° »!
 */}
              {whereUsedItems.length > 0 && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>{whereUsedItems.length === 1 ? '@_' : '@_?Q'}</span>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                          {whereUsedItems.length === 1 
                            ? '  µ! ° »!
   ° » µ ¶ Q!!
  ‘ U 1 ! W µ!  Q!! T °! !!:' 
                            : `  µ! ° »!
   Q T U! Q!! U !S!!!
!! !S  T! »!
 T U!& ! W µ!  Q!! T °! !!!& (${whereUsedItems.length}):`}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                            Q! U ± Q, ! ° X Q  ° ± U ! T » ° ‘ ° »!
 !  U ‘ Q  Q! !,  ‘ U ! T » ° ‘!S ! T Q!&  !& U ‘ Q!!
 ! !  ‘ µ! ° »!

                        </div>
                      </div>
                    </div>
                    <span style={{
                      background: whereUsedItems.length === 1 ? '#dcfce7' : 'rgba(255, 144, 0, 0.12)',
                      color: whereUsedItems.length === 1 ? '#15803d' : '#d97706',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 900
                    }}>
                      {whereUsedItems.length === 1 ? '1 ! W µ!  Q!! T °! !!' : `${whereUsedItems.length} ! W µ!  Q!! T °! ! `}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                    {whereUsedItems.map((bom, idx) => {
                      const parentNom = itemsMap.get(bom.parent_id) || parentProductsMap[bom.parent_id]
                      const parentGroup = parentNom ? groups.find(g => g.id === parentNom.group_id) : null
                      return (
                        <div
                          key={bom.id || idx}
                          style={{
                            background: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '12px',
                            padding: '14px 18px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '1.1rem' }}>@_¦</span>
                              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {parentNom ? parentNom.name : `  Q!! ± [ID: ${bom.parent_id?.substring(0, 8)}...]`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                              {parentNom?.code && (
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-muted, #64748b)', background: '#fff', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                  {parentNom.code}
                                </span>
                              )}
                              {parentGroup && (
                                <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  {parentGroup.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(255, 144, 0, 0.12)',
                            color: '#d97706',
                            border: '1px solid rgba(255, 144, 0, 0.25)',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            marginLeft: '10px'
                          }}>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>
                              {bom.quantity_per_parent} {item.unit || '!¬!'}
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                ° 1   Q!! ±
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 2. COMPONENTS BOM:  !&! ‘ !  ‘ µ! ° »!   Q! U ±!S (! T!0 U ! ° X   Q!! ± ! T » ° ‘ °!!!
!!  ·  T U X W U  µ !! ) */}
              {bomItems.length > 0 && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} color="#ff9000" />
                        W µ!  Q!! T °! !!   Q! U ±!S ( !&! ‘ !  X °! µ!! ° » Q ! °  T U X W U  µ ! Q):
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                       Z °! µ!! ° » Q ! °  ‘ µ! ° »!, !0 U   Q!! °!! °!!!
!!   °   Q V U! U  » µ  ! ! !!!  W U · Q! !!
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-header-bg, #f8fafc)', color: 'var(--text-muted, #64748b)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 20px' }}> Y U ‘ /  \ ° ·  °  T U X W U  µ ! °</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}> Y! »!
 T!!!!
   ° 1  U ‘.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomItems.map(bom => {
                        const childNom = itemsMap.get(bom.child_id) || parentProductsMap[bom.child_id]
                        return (
                          <tr key={bom.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                            <td style={{ padding: '12px 20px', fontWeight: 800 }}>
                              <div>{childNom ? childNom.name : (bom.child_id || ' Y U X W U  µ !')}</div>
                              {childNom?.code && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>
                                  {childNom.code}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 900, color: '#d97706' }}>
                              {bom.quantity_per_parent} {childNom?.unit || '!¬!'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. EMPTY STATE:  \ µ X °!  ° ! ! W µ!  Q!! T °! ! ,  ° !  !&! ‘  Q!&  T U X W U  µ !!  */}
              {whereUsedItems.length === 0 && bomItems.length === 0 && !loadingBom && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  borderRadius: '16px',
                  padding: '40px',
                  textAlign: 'center',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)'
                }}>
                  <Package size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                     ¦!  ‘ µ! ° »!
  W U T Q !0 U   µ  W! Q '! · °  °  ‘ U  ¶ U ‘  U! ! W µ!  Q!! T °! !!
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                     _! Q '! · T °  ‘ µ! ° » µ   ‘ U   Q! U ±!    Q T U !S!!!
!! !S  X U ‘!S »! «    ¶ µ  µ!»  ° ± U «  W µ!  Q!! T °! !!».
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-header-bg, #f8fafc)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
            <span>ID   U X µ  T » °!!S! Q:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.id}</span>
            <button
              onClick={() => copyToClipboard(item.id, 'id')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', padding: '2px' }}
              title="  T U W!!  °! Q ID"
            >
              {copiedKey === 'id' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: '10px',
              padding: '8px 20px',
              fontSize: '0.85rem',
    </>
  )
}
