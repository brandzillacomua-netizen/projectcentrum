import React from 'react'

/**
 * Shared badge/banner displaying resolved Shop 2 painting instructions
 * (base color, edge color swatch, manager notes) from detail flags + order painting info.
 */
export function Shop2PaintingBadge({ routing, compact = false }) {
  if (!routing) return null

  const paint = routing.paintingDisplay

  if (!routing.shouldPaint) {
    if (compact) return null
    if (!routing.requiresPainting && !routing.isRoutingConfigured) return null

    const skipLabel = routing.paintSkippedByOrder
      ? '🎨 У наряді обрано «Без фарбування»'
      : '🔩 Деталь без фарбування (за номенклатурою)'

    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.68rem',
        fontWeight: 800,
        background: 'rgba(100, 116, 139, 0.12)',
        border: '1px solid rgba(100, 116, 139, 0.25)',
        color: 'var(--text-muted, #94a3b8)'
      }}>
        {skipLabel}
      </div>
    )
  }

  if (!paint) return null

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 7px',
        borderRadius: '6px',
        fontSize: '0.64rem',
        fontWeight: 900,
        background: 'rgba(236, 72, 153, 0.14)',
        border: '1px solid rgba(236, 72, 153, 0.35)',
        color: '#f472b6'
      }}>
        {paint.baseSwatch && (
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: paint.baseSwatch,
            border: '1px solid rgba(255,255,255,0.45)',
            display: 'inline-block'
          }} />
        )}
        {paint.edgeSwatch && (
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: paint.edgeSwatch,
            border: '1px solid rgba(255,255,255,0.45)',
            display: 'inline-block'
          }} />
        )}
        <span>🎨 {paint.summaryText}</span>
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '7px 10px',
      borderRadius: '9px',
      background: 'rgba(236, 72, 153, 0.1)',
      border: '1px solid rgba(236, 72, 153, 0.32)',
      marginTop: '6px'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 900, color: '#ec4899' }}>
        <span>🎨 {paint.typeLabel}:</span>
        {paint.baseColor && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.16)',
            color: 'var(--text, #fff)',
            padding: '1px 7px',
            borderRadius: '999px',
            fontSize: '0.68rem',
            fontWeight: 900
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: paint.baseSwatch, border: '1px solid rgba(255,255,255,0.4)', display: 'inline-block' }} />
            Повне: {paint.baseColor}
          </span>
        )}
        {paint.edgeColor && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.16)',
            color: 'var(--text, #fff)',
            padding: '1px 7px',
            borderRadius: '999px',
            fontSize: '0.68rem',
            fontWeight: 900
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: paint.edgeSwatch, border: '1px solid rgba(255,255,255,0.4)', display: 'inline-block' }} />
            Торці: {paint.edgeColor}
          </span>
        )}
      </div>
      {paint.notes && (
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-sub, #d1d5db)' }}>
          Примітка малярці: {paint.notes}
        </div>
      )}
    </div>
  )
}

