import React from 'react'
import { Boxes, Package, AlertCircle } from 'lucide-react'

export const InventoryTab = ({
  item,
  loadingInventory,
  inventoryBalances,
  totalStockQty,
  totalReservedQty,
  freeAvailableQty
}) => {
  return (
    <>
              
              {/* Balances KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '18px 22px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                      ° V ° »!
  Q   · ° » Q!¬ U T ( !!
 U V U)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text, #0f172a)', marginTop: '4px' }}>
                    {totalStockQty} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{item.unit || '!¬!'}</span>
                  </div>
                </div>

                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '18px 22px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                      °! µ · µ!  U  °  U  W! ‘  · ° X U  » µ  !
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '4px' }}>
                    {totalReservedQty} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{item.unit || '!¬!'}</span>
                  </div>
                </div>

                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '18px 22px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                      U!!!S W  U ( ! »!
  Q   · ° » Q!¬ U T)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: freeAvailableQty >= 0 ? '#059669' : '#dc2626', marginTop: '4px' }}>
                    {freeAvailableQty} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{item.unit || '!¬!'}</span>
                  </div>
                </div>
              </div>

              {/* Table of storage locations and balances */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '16px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-header-bg, #f8fafc)', fontWeight: 900, fontSize: '0.85rem' }}>
                     U · W U ‘! »  · ° » Q!¬ T!   W U ! T » ° ‘ °!& ! ° !  µ!& °!&
                </div>
                
                {inventoryBalances.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 20px' }}>  T » ° ‘ /  : U T °! !!</th>
                        <th style={{ padding: '12px 20px' }}> ^ Q W  U ± »! T!S</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>  ° V ° »!
  °  T-!!!
</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>   µ · µ! </th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}> ! »!
  U</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryBalances.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 800 }}>
                            {row.warehouse === 'sgp' ? '@_¬    _ (  U! U  °  W! U ‘!S T! !!)' : 
                             row.warehouse === 'shop1' ? '@_­  ¦ µ!& 1 ( ¤! µ · µ!!S  °  !)' : 
                             row.warehouse === 'shop2' ? '@_§  ¦ µ!& 2 (  T » ° ‘ °  !)' : 
                             (row.warehouse || '  T » ° ‘')}
                            {row.location ? ` / ${row.location}` : ''}
                          </td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-muted, #64748b)' }}>
                            {row.type || '2'}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 800 }}>
                            {row.total_qty || 0}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#ea580c', fontWeight: 800 }}>
                            {row.reserved_qty || 0}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#059669', fontWeight: 900 }}>
                            {(Number(row.total_qty) || 0) - (Number(row.reserved_qty) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                    {loadingInventory ? '  °  ° ! ° ¶ µ  !  · ° » Q!¬ T! ...' : ' \ µ  ·  °  ‘ µ  U ! T » ° ‘!!
 T Q!&  · ° W Q!!   ‘ »! ! !!!  W U · Q! !! ( · ° » Q!¬ U T 0).'}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R2"R
              TAB 5: BOM SPECIFICATION & WHERE-USED (  W µ!  Q!! T °! !! ! °  !& U ‘ ¶ µ  !)
    </>
  )
}
