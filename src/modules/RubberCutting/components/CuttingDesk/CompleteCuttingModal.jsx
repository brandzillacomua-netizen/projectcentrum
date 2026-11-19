import React from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, PackageMinus, PackagePlus, Clock, Users } from 'lucide-react';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, SCRAP_REASONS, formatDurationSec } from '../../utils/rubberConstants';

export function CompleteCuttingModal({
  isOpen,
  onClose,
  selectedPart,
  sheetsCount,
  actualProduced,
  setActualProduced,
  scrapCount,
  setScrapCount,
  scrapReason,
  setScrapReason,
  completionNotes,
  setCompletionNotes,
  elapsedSeconds,
  plannedDurationSec,
  selectedOperators = [],
  isSubmitting,
  onSubmit
}) {
  if (!isOpen || !selectedPart) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.35)`,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow, 0 20px 60px rgba(0,0,0,0.25))',
        overflow: 'hidden',
        color: 'var(--text, #0f172a)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card-header-bg, rgba(0,0,0,0.02))'
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 900, color: ACCENT_RUBBER, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Фіксація результатів розкрою
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 950, color: 'var(--text, #0f172a)' }}>
              {selectedPart.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'var(--button-bg, rgba(0,0,0,0.05))',
              border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
              color: 'var(--text-muted, #64748b)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Summary Metric Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: 'var(--surface-1, #f8fafc)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>Листів</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--text, #0f172a)', marginTop: '4px' }}>{sheetsCount} шт</div>
            </div>
            <div style={{ background: 'var(--surface-1, #f8fafc)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>Час факту</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#0284c7', marginTop: '4px' }}>{formatDurationSec(elapsedSeconds)}</div>
            </div>
            <div style={{ background: 'var(--surface-1, #f8fafc)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>Час плану</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--text-muted, #475569)', marginTop: '4px' }}>{formatDurationSec(plannedDurationSec)}</div>
            </div>
          </div>

          {/* Actual produced count input */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text, #0f172a)', display: 'block', marginBottom: '8px' }}>
              КІЛЬКІСТЬ ГОТОВИХ ПРИЙНЯТИХ ДЕТАЛЕЙ (ШТ)
            </label>
            <input
              type="number"
              min="0"
              value={actualProduced}
              onChange={e => setActualProduced(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{
                width: '100%',
                background: 'var(--input-bg, #ffffff)',
                border: `2px solid ${ACCENT_RUBBER}`,
                borderRadius: '12px',
                padding: '14px 16px',
                color: 'var(--text, #0f172a)',
                fontSize: '1.3rem',
                fontWeight: 950,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Scrap Count & Reasons */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} /> Брак / дефекти порізки (шт)
              </span>
              <input
                type="number"
                min="0"
                value={scrapCount}
                onChange={e => setScrapCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{
                  width: '90px',
                  background: 'var(--input-bg, #ffffff)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  color: '#ef4444',
                  fontSize: '1rem',
                  fontWeight: 950,
                  outline: 'none',
                  textAlign: 'center'
                }}
              />
            </div>

            {scrapCount > 0 && (
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, display: 'block', marginBottom: '6px' }}>
                  Причина виникнення браку:
                </label>
                <select
                  value={scrapReason}
                  onChange={e => setScrapReason(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, #ffffff)',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                    color: 'var(--text, #0f172a)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">— Оберіть причину —</option>
                  {SCRAP_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Stock movements preview */}
          <div style={{
            background: 'var(--surface-1, #f8fafc)',
            borderRadius: '16px',
            border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.78rem'
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-dim, #64748b)', textTransform: 'uppercase' }}>
              Автоматичні складські рухи
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 700 }}>
              <PackageMinus size={15} />
              <span>Списання з СВ: <strong>{sheetsCount} листів</strong> ({selectedPart.raw_material_code})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700 }}>
              <PackagePlus size={15} />
              <span>Оприбуткування Цех №2: <strong>{actualProduced} деталей</strong> ({selectedPart.code})</span>
            </div>
          </div>

          {/* Assigned Operators Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted, #475569)' }}>
            <Users size={14} color={ACCENT_RUBBER} />
            <span>Оператори: <strong style={{ color: 'var(--text, #0f172a)' }}>{selectedOperators.length > 0 ? selectedOperators.join(', ') : 'Не вказано'}</strong></span>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '18px 24px',
          borderTop: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          background: 'var(--card-header-bg, rgba(0,0,0,0.02))'
        }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'var(--button-bg, #f1f5f9)',
              border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
              color: 'var(--text-muted, #475569)',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Скасувати
          </button>

          <button
            onClick={onSubmit}
            disabled={isSubmitting || actualProduced < 0}
            style={{
              background: ACCENT_RUBBER,
              color: '#000',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: 950,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: `0 4px 15px rgba(${ACCENT_RUBBER_RGB}, 0.4)`,
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            <CheckCircle2 size={16} />
            {isSubmitting ? 'Збереження...' : 'Підтвердити та списати'}
          </button>
        </div>
      </div>
    </div>
  );
}

