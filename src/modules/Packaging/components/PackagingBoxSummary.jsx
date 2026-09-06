import React from 'react'
import { Hash, Package } from 'lucide-react'
import { getBoxColor } from '../utils/packagingHelpers'

export const PackagingBoxSummary = ({ boxSummary }) => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
        <Hash size={20} color="#f43f5e" />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--text, #0f172a)', textTransform: 'uppercase' }}>Зміст коробок</h3>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted, #64748b)', fontSize: '0.8rem', fontWeight: 800 }}>{boxSummary.length} КОРОБОК</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {boxSummary.map(box => {
          const color = getBoxColor(box.boxNumber)
          return (
            <div key={box.boxNumber} style={{ background: 'var(--card-bg, #ffffff)', border: `2px solid ${color}44`, borderRadius: '20px', overflow: 'hidden' }}>
              <div style={{ background: `${color}18`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${color}33` }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={16} color="#fff" />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 1000, color: 'var(--text, #0f172a)' }}>Коробка {box.boxNumber}</span>
                <span style={{ marginLeft: 'auto', background: 'var(--card-header-bg, #f1f5f9)', color: color, padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 950 }}>{box.items.length} поз.</span>
              </div>
              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {box.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text, #1e293b)', fontWeight: 600, lineHeight: 1.3 }}>{it.nom.name}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 1000, color: color, marginLeft: '10px', flexShrink: 0 }}>
                      {it.qty} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)' }}>{it.nom.unit || 'шт'}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
