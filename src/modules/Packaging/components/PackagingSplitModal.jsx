import React, { useState, useEffect, useMemo } from 'react'
import { X, Split, CheckCircle2, Clock, AlertTriangle, ArrowRight, Zap, RefreshCw } from 'lucide-react'

export const PackagingSplitModal = ({
  isOpen,
  onClose,
  activeBatchData,
  batchSchedule = [],
  alreadyPackedCount = 0,
  onConfirmSplit,
  isProcessing = false
}) => {
  const [allocations, setAllocations] = useState({})
  const [packerName, setPackerName] = useState('')

  // Розрахунок автоматичного FIFO-розподілу
  const computeFIFO = useMemo(() => {
    return (packedTotal) => {
      let remaining = Math.max(0, packedTotal)
      const res = {}
      batchSchedule.forEach(b => {
        const qty = Number(b.quantity) || 0
        const take = Math.min(remaining, qty)
        res[b.batch_num] = take
        remaining -= take
      })
      return res
    }
  }, [batchSchedule])

  // Ініціалізація при відкритті
  useEffect(() => {
    if (isOpen && batchSchedule.length > 0) {
      setAllocations(computeFIFO(alreadyPackedCount))
    }
  }, [isOpen, batchSchedule, alreadyPackedCount, computeFIFO])

  if (!isOpen) return null

  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0)
  const diff = alreadyPackedCount - totalAllocated

  const handleQtyChange = (batchNum, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0)
    setAllocations(prev => ({
      ...prev,
      [batchNum]: num
    }))
  }

  const handleAutoFIFO = () => {
    setAllocations(computeFIFO(alreadyPackedCount))
  }

  const handleClearAll = () => {
    const res = {}
    batchSchedule.forEach(b => { res[b.batch_num] = 0 })
    setAllocations(res)
  }

  const handleSubmit = async () => {
    const splits = batchSchedule.map(b => {
      const packed = Number(allocations[b.batch_num]) || 0
      return {
        batch_num: b.batch_num,
        quantity: Number(b.quantity) || 0,
        deadline: b.deadline || null,
        packed_quantity: packed
      }
    })

    await onConfirmSplit(splits, packerName.trim() || 'Пакувальник')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '2px solid #cbd5e1',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#f43f5e',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Split size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, letterSpacing: '0.3px' }}>
                РОЗДІЛЕННЯ НАРЯДУ ПАКУВАННЯ ЗА ГРАФІКОМ МЕНЕДЖЕРА
              </h2>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px' }}>
                Наряд № {activeBatchData?.orderNum} ({activeBatchData?.customer || 'Замовник'}) — Всього: {activeBatchData?.plannedSets} шт
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* STATS BANNER */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Фактично вже спаковано коробок/комплектів:
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: '#0f172a' }}>
                {alreadyPackedCount} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>шт.</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleAutoFIFO}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Zap size={14} color="#f59e0b" /> Заповнити FIFO (Авто)
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                Очистити
              </button>
            </div>
          </div>

          {/* TABLE OF BATCHES (1C STYLE) */}
          <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 900 }}>Партія</th>
                  <th style={{ padding: '10px 12px', fontWeight: 900 }}>План менеджера</th>
                  <th style={{ padding: '10px 12px', fontWeight: 900 }}>Дедлайн</th>
                  <th style={{ padding: '10px 12px', fontWeight: 900 }}>Вже спаковано (шт)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 900 }}>Статус після спліту</th>
                </tr>
              </thead>
              <tbody>
                {batchSchedule.map(b => {
                  const planned = Number(b.quantity) || 0
                  const packed = Number(allocations[b.batch_num]) || 0
                  const isDone = packed >= planned && planned > 0
                  const remaining = Math.max(0, planned - packed)

                  return (
                    <tr key={b.batch_num} style={{ borderBottom: '1px solid #e2e8f0', background: isDone ? '#f0fdf4' : '#ffffff' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 900, color: '#0f172a' }}>
                        Партія П{b.batch_num}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                        {planned} шт
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>
                        {b.deadline || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min="0"
                            max={planned * 2}
                            value={allocations[b.batch_num] ?? 0}
                            onChange={(e) => handleQtyChange(b.batch_num, e.target.value)}
                            style={{
                              width: '80px',
                              padding: '6px 8px',
                              border: '1.5px solid #94a3b8',
                              borderRadius: '6px',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              color: '#0f172a'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(b.batch_num, planned)}
                            title="Поставити план"
                            style={{
                              padding: '4px 8px',
                              background: '#e2e8f0',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            План
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {isDone ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontWeight: 900,
                            fontSize: '0.72rem',
                            border: '1px solid #86efac'
                          }}>
                            <CheckCircle2 size={12} /> СПАКОВАНО (ВІДВАНТАЖЕННЯ)
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            border: '1px solid #fde68a'
                          }}>
                            <Clock size={12} /> В роботі (лишилось {remaining} шт)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* DISTRIBUTION BALANCE CHECK */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: diff === 0 ? '#f8fafc' : '#fffbeb',
            border: `1px solid ${diff === 0 ? '#e2e8f0' : '#fcd34d'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem'
          }}>
            <div>
              <span style={{ color: '#64748b', fontWeight: 700 }}>Розподілено по партіях: </span>
              <strong style={{ color: '#0f172a', fontWeight: 900 }}>{totalAllocated}</strong> із <strong style={{ color: '#0f172a', fontWeight: 900 }}>{alreadyPackedCount} шт.</strong>
            </div>
            {diff !== 0 && (
              <div style={{ color: '#b45309', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <AlertTriangle size={14} />
                {diff > 0 ? `Не розподілено: ${diff} шт.` : `Перевищення: +${Math.abs(diff)} шт.`}
              </div>
            )}
          </div>

          {/* PACKER OPERATOR INPUT */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
              Прізвище пакувальника (для фіксації в системі):
            </label>
            <input
              type="text"
              placeholder="Вкажіть своє ім'я або залиште порожнім"
              value={packerName}
              onChange={(e) => setPackerName(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}
            />
          </div>

        </div>

        {/* FOOTER */}
        <div style={{
          padding: '14px 20px',
          background: '#f8fafc',
          borderTop: '2px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: '10px 18px',
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.82rem',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            style={{
              padding: '10px 24px',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 900,
              fontSize: '0.88rem',
              cursor: isProcessing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)'
            }}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} className="spin-anim" /> Розділення нарядів...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Затвердити розділення наряду
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
