import React, { useState, useEffect } from 'react';
import { Play, X, UserCheck, Scissors, AlertCircle, Clock, Layers } from 'lucide-react';
import { OperatorMultiSelect } from '../../../../components/common/OperatorMultiSelect.jsx';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, formatDurationSec } from '../../utils/rubberConstants';

export function StartCuttingTaskModal({
  isOpen,
  onClose,
  order,
  onConfirmStart,
  onShiftOperators = [],
  allStageOperators = [],
  isSubmitting = false
}) {
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // When modal opens, pre-fill with onShiftOperators or initial selection
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      if (onShiftOperators.length > 0) {
        setSelectedOperators([onShiftOperators[0]]);
      } else {
        setSelectedOperators([]);
      }
    }
  }, [isOpen, onShiftOperators]);

  if (!isOpen || !order) return null;

  const handleStart = (e) => {
    e.preventDefault();
    if (!selectedOperators || selectedOperators.length === 0) {
      setErrorMessage('Будь ласка, оберіть хоча б одного лицювальника-полірувальника!');
      return;
    }
    onConfirmStart({
      order,
      operators: selectedOperators
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 10000
    }}>
      <div style={{
        background: '#0d0d12',
        border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.35)`,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: `rgba(${ACCENT_RUBBER_RGB}, 0.15)`,
              padding: '10px',
              borderRadius: '12px',
              border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.3)`
            }}>
              <Scissors size={22} color={ACCENT_RUBBER} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#fff', margin: 0 }}>
                Початок порізки замовлення
              </h2>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#d97706', fontWeight: 800 }}>
                #{order.batch_number}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#94a3b8',
              width: 36,
              height: 36,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Order Details Summary Box */}
        <div style={{
          background: '#13131c',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
              Деталь для розкрою
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 950, color: '#fff', marginTop: '2px' }}>
              {order.part_name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
              {order.part_code} • {order.raw_material_code || 'Гума листова'}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            background: 'rgba(255,255,255,0.02)',
            padding: '12px',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 800 }}>ПЛАН ДЕТАЛЕЙ</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#10b981', marginTop: '2px' }}>
                {order.planned_quantity} шт
              </div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 800 }}>ЛИСТІВ ГУМИ</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff', marginTop: '2px' }}>
                {order.sheets_count} л
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 800 }}>ПЛАНОВИЙ ЧАС</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                {formatDurationSec(order.planned_duration_sec)}
              </div>
            </div>
          </div>

          {order.notes && (
            <div style={{
              fontSize: '0.72rem',
              color: '#cbd5e1',
              background: 'rgba(0,0,0,0.3)',
              padding: '8px 12px',
              borderRadius: '8px',
              borderLeft: `2px solid ${ACCENT_RUBBER}`
            }}>
              {order.notes}
            </div>
          )}
        </div>

        {/* Operator Selection */}
        <div style={{
          background: '#13131c',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color={ACCENT_RUBBER} />
              <span style={{ fontSize: '0.8rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase' }}>
                ЛИЦЮВАЛЬНИК-ПОЛІРУВАЛЬНИК (ХТО НА ЗМІНІ)
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: ACCENT_RUBBER, fontWeight: 900 }}>
              Обрано: {selectedOperators.length}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Оберіть одного або декількох лицювальників-полірувальників, які виконують цю порізку:
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

        {/* Error message if no operator selected */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#ef4444',
            fontSize: '0.78rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '14px',
              color: '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleStart}
            disabled={isSubmitting}
            style={{
              flex: 2,
              background: `linear-gradient(135deg, ${ACCENT_RUBBER} 0%, #e67e00 100%)`,
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              color: '#000',
              fontSize: '0.9rem',
              fontWeight: 950,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: `0 4px 18px rgba(${ACCENT_RUBBER_RGB}, 0.35)`
            }}
          >
            <Play size={18} fill="#000" />
            <span>{isSubmitting ? 'Запуск...' : 'РОЗПОЧАТИ ПОРІЗКУ (СТАРТ)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

