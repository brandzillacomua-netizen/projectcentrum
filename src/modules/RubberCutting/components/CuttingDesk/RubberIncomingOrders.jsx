import React from 'react';
import { Scissors, Play, Box, RefreshCw } from 'lucide-react';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, formatDurationSec } from '../../utils/rubberConstants';

export function RubberIncomingOrders({
  pendingOrders = [],
  onTakeToWork,
  onRefresh,
  loading = false
}) {
  return (
    <div style={{
      background: 'var(--card-bg, #0d0d12)',
      borderRadius: '18px',
      border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: `rgba(${ACCENT_RUBBER_RGB}, 0.15)`,
            padding: '8px',
            borderRadius: '10px',
            border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.3)`
          }}>
            <Scissors size={18} color={ACCENT_RUBBER} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--text, #fff)', margin: 0, textTransform: 'uppercase' }}>
                Завдання від начальника цеху
              </h2>
              <span style={{
                background: pendingOrders.length > 0 ? ACCENT_RUBBER : 'var(--fill-subtle, rgba(255,255,255,0.08))',
                color: pendingOrders.length > 0 ? '#000' : 'var(--text-muted, #94a3b8)',
                fontWeight: 950,
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '8px'
              }}>
                {pendingOrders.length}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: 'var(--button-bg, rgba(255,255,255,0.05))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            color: 'var(--text-muted, #94a3b8)',
            borderRadius: '9px',
            padding: '6px 12px',
            fontSize: '0.72rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Оновити</span>
        </button>
      </div>

      {/* Compact List or Empty State */}
      {pendingOrders.length === 0 ? (
        <div style={{
          background: 'var(--fill-subtle, rgba(255,255,255,0.02))',
          borderRadius: '12px',
          border: '1px dashed var(--border-color, rgba(255,255,255,0.1))',
          padding: '24px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Box size={28} style={{ color: 'var(--text-dim, #64748b)', opacity: 0.5 }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text, #fff)' }}>
            Активних завдань на порізку немає
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
            Коли начальник цеху створить заявку на вироби з гуми, вона з'явиться тут списком.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pendingOrders.map(order => {
            const isUrgent = (order.notes && order.notes.includes('ТЕРМІНОВО')) || order.priority === 'urgent';
            const isAwaitingMaterial = order.status === 'awaiting_material';
            return (
              <div
                key={order.id}
                style={{
                  background: 'var(--surface-1, #13131a)',
                  borderRadius: '12px',
                  border: isUrgent ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border-color, rgba(255,255,255,0.07))',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  flexWrap: 'wrap'
                }}
              >
                {/* Left: Batch, Priority, Name, Notes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 280px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    color: '#d97706',
                    background: 'rgba(217,119,6,0.12)',
                    padding: '3px 7px',
                    borderRadius: '6px',
                    flexShrink: 0
                  }}>
                    #{order.batch_number}
                  </span>

                  {isAwaitingMaterial && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(139, 92, 246, 0.14)',
                      color: '#8b5cf6',
                      border: '1px solid rgba(139, 92, 246, 0.35)',
                      flexShrink: 0
                    }}>
                      ⏳ Очікує СВ
                    </span>
                  )}

                  {isUrgent && (
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 950,
                      padding: '2px 7px',
                      borderRadius: '5px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      flexShrink: 0
                    }}>
                      🔴 ТЕРМІНОВО
                    </span>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.part_name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim, #64748b)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-muted, #94a3b8)' }}>{order.part_code}</span>
                      <span>•</span>
                      <span>{order.raw_material_code || 'Гума листова'}</span>
                      {order.notes && (
                        <>
                          <span>•</span>
                          <span style={{ color: 'var(--text-muted, #cbd5e1)', fontStyle: 'italic' }}>{order.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Compact metrics */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>Ціль</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 950, color: '#10b981' }}>{order.planned_quantity} шт</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>Листів</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 950, color: 'var(--text, #fff)' }}>{order.sheets_count} л</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '54px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>План</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0284c7' }}>{formatDurationSec(order.planned_duration_sec)}</div>
                  </div>

                  {/* Right: Action Button */}
                  <button
                    type="button"
                    disabled={isAwaitingMaterial}
                    onClick={() => { if (!isAwaitingMaterial) onTakeToWork(order); }}
                    title={isAwaitingMaterial ? 'Очікує видачі листів зі складу СВ' : 'Взяти завдання в роботу'}
                    style={{
                      background: isAwaitingMaterial
                        ? 'var(--surface-2, #e2e8f0)'
                        : `linear-gradient(135deg, ${ACCENT_RUBBER} 0%, #e67e00 100%)`,
                      border: isAwaitingMaterial ? '1px solid var(--border-subtle, #cbd5e1)' : 'none',
                      color: isAwaitingMaterial ? 'var(--text-dim, #94a3b8)' : '#000',
                      borderRadius: '10px',
                      padding: '9px 16px',
                      fontWeight: 950,
                      fontSize: '0.78rem',
                      cursor: isAwaitingMaterial ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isAwaitingMaterial ? 'none' : `0 3px 12px rgba(${ACCENT_RUBBER_RGB}, 0.25)`,
                      opacity: isAwaitingMaterial ? 0.75 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Play size={14} fill={isAwaitingMaterial ? 'currentColor' : '#000'} />
                    <span>ВЗЯТИ В РОБОТУ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
