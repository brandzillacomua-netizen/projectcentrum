import React from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Minus, Plus, Box, Clock, UserCheck } from 'lucide-react';
import { OperatorMultiSelect } from '../../../../components/common/OperatorMultiSelect.jsx';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, formatDurationSec } from '../../utils/rubberConstants';

export function CuttingActiveCard({
  selectedPart,
  activeBatch = null,
  sheetsCount,
  setSheetsCount,
  selectedOperators,
  setSelectedOperators,
  onShiftOperators = [],
  allStageOperators = [],
  isTimerRunning,
  elapsedSeconds,
  startTimer,
  pauseTimer,
  resetTimer,
  plannedDurationSec,
  plannedTotalParts,
  handleOpenCompleteModal
}) {
  if (!selectedPart) {
    return (
      <div style={{
        background: '#0d0d12',
        borderRadius: '18px',
        border: '1px dashed rgba(255,255,255,0.12)',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '12px',
        color: 'var(--text-dim, #64748b)'
      }}>
        <Box size={40} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
          Оберіть деталь для порізки вище
        </div>
        <div style={{ fontSize: '0.78rem', maxWidth: '380px' }}>
          Після вибору деталі тут відкриється робочий термінал: налаштування кількості листів, вибір операторів та живий таймер циклу різання станка.
        </div>
      </div>
    );
  }

  // Timer Progress Calculation
  const progressRatio = plannedDurationSec > 0 ? (elapsedSeconds / plannedDurationSec) : 0;
  const progressPercent = Math.min(100, Math.round(progressRatio * 100));

  let timerColor = '#10b981'; // Green
  let paceLabel = 'В межах планового часу';
  if (plannedDurationSec > 0) {
    if (elapsedSeconds > plannedDurationSec) {
      timerColor = '#ef4444'; // Red (Overtime)
      paceLabel = `Перевищення плану (+${formatDurationSec(elapsedSeconds - plannedDurationSec)})`;
    } else if (elapsedSeconds > plannedDurationSec * 0.85) {
      timerColor = '#f59e0b'; // Amber (Near completion)
      paceLabel = 'Завершення планового циклу';
    }
  }

  return (
    <div style={{
      background: '#0d0d12',
      borderRadius: '20px',
      border: `2px solid rgba(${ACCENT_RUBBER_RGB}, 0.4)`,
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      position: 'relative'
    }}>
      {/* Top: Active Part Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          {activeBatch && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              background: 'rgba(217,119,6,0.15)',
              border: '1px solid rgba(217,119,6,0.3)',
              padding: '4px 10px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fbbf24' }}>
                📋 Замовлення #{activeBatch.batch_number} від Нач. Цеху №2
              </span>
              {activeBatch.notes && (
                <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                  • {activeBatch.notes}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: ACCENT_RUBBER,
              color: '#000',
              fontWeight: 950,
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              В РОБОТІ
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#d97706', fontWeight: 900 }}>
              {selectedPart.code}
            </span>
            <span style={{ color: 'var(--text-dim, #64748b)', fontSize: '0.75rem', fontWeight: 700 }}>
              • Лист: {selectedPart.sheet_size} мм ({selectedPart.raw_material_code})
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 950, color: '#fff', margin: '8px 0 4px 0' }}>
            {selectedPart.name}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 800 }}>
              Норма: {selectedPart.sheet_yield} шт/лист
            </span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 800 }}>
              План на 1 лист: {formatDurationSec(selectedPart.sheet_cutting_time_sec)}
            </span>
            {selectedPart.item_cutting_time_sec > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #64748b)', fontWeight: 700 }}>
                ({selectedPart.item_cutting_time_sec} сек/шт)
              </span>
            )}
          </div>
        </div>

        {/* Sheets Quantity Stepper */}
        <div style={{
          background: '#13131a',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-dim, #64748b)', textTransform: 'uppercase' }}>
            Кількість листів у розкрій
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSheetsCount(prev => Math.max(1, prev - 1))}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                width: 34,
                height: 34,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Minus size={16} />
            </button>

            <span style={{ fontSize: '1.4rem', fontWeight: 950, color: '#fff', minWidth: '40px', textAlign: 'center' }}>
              {sheetsCount}
            </span>

            <button
              onClick={() => setSheetsCount(prev => prev + 1)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                width: 34,
                height: 34,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 900 }}>
            = {plannedTotalParts} шт. деталей
          </span>
        </div>
      </div>

      {/* Middle Grid: Operator Selection & Timer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Operators Column */}
        <div style={{
          background: '#13131a',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={16} color={ACCENT_RUBBER} />
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
              Лицювальник-полірувальник ({selectedOperators.length} обрано)
            </span>
          </div>

          <OperatorMultiSelect
            value={selectedOperators}
            onChange={setSelectedOperators}
            onShiftOperators={onShiftOperators}
            allStageOperators={allStageOperators}
            stage="порізка гуми"
            inline={true}
          />
        </div>

        {/* Live Timer Column */}
        <div style={{
          background: '#13131a',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-dim, #64748b)', textTransform: 'uppercase' }}>
                Таймер різання станка
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: timerColor }}>
                {paceLabel}
              </span>
            </div>

            {/* Big Timer Digits */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <div style={{
                fontSize: '2.4rem',
                fontWeight: 950,
                fontFamily: 'monospace',
                color: timerColor,
                letterSpacing: '1px'
              }}>
                {formatDurationSec(elapsedSeconds)}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-dim, #64748b)', fontWeight: 800 }}>
                / план {formatDurationSec(plannedDurationSec)}
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '12px'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: timerColor,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Timer Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isTimerRunning ? (
              <button
                onClick={startTimer}
                style={{
                  flex: 1,
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(16,185,129,0.3)'
                }}
              >
                <Play size={16} fill="#fff" /> Старт різання
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                style={{
                  flex: 1,
                  background: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(245,158,11,0.3)'
                }}
              >
                <Pause size={16} fill="#000" /> Пауза
              </button>
            )}

            <button
              onClick={resetTimer}
              title="Скинути таймер"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-dim, #64748b)',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Complete Cutting Action Button */}
      <button
        onClick={handleOpenCompleteModal}
        style={{
          background: `linear-gradient(135deg, ${ACCENT_RUBBER} 0%, #e07d00 100%)`,
          color: '#ffffff',
          border: 'none',
          borderRadius: '14px',
          padding: '16px 24px',
          fontWeight: 950,
          fontSize: '1rem',
          letterSpacing: '0.5px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          boxShadow: `0 6px 20px rgba(${ACCENT_RUBBER_RGB}, 0.35)`,
          transition: 'all 0.15s ease'
        }}
      >
        <CheckCircle2 size={20} />
        ЗАВЕРШИТИ ПОРІЗКУ ({sheetsCount} ЛИСТ / {plannedTotalParts} ДЕТАЛЕЙ)
      </button>
    </div>
  );
}

