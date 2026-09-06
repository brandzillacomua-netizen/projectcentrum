import React from 'react'
import { X, Calendar, Plus, Trash2 } from 'lucide-react'

export const BatchScheduleModal = ({
  isOpen,
  selectedOrder,
  batchScheduleList,
  onClose,
  onUpdateBatchItem,
  onRemoveBatchItem,
  onAddBatchItem,
  onSaveBatchSchedule,
  isSavingSchedule
}) => {
  if (!isOpen || !selectedOrder) return null

  const totalAllocated = batchScheduleList.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0)
  const totalQuantity = selectedOrder.quantity || 0
  const remaining = totalQuantity - totalAllocated
  const isComplete = totalAllocated === totalQuantity

  return (
    <div className="modal-backdrop-modern">
      <div className="glass-card modal-content-modern anim-slide-up" style={{ maxWidth: '650px' }}>
        <div className="modal-header-modern">
          <h2>📅 КАЛЕНДАР ПАРТІЙ <span className="text-orange">#{selectedOrder.order_num}</span></h2>
          <button onClick={onClose} className="btn-close-modal"><X size={24} /></button>
        </div>
        
        <div className="modal-body-modern" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.2)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: '800', letterSpacing: '1px' }}>ЗАГАЛЬНИЙ ТИРАЖ ЗАМОВЛЕННЯ</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ff9000' }}>{totalQuantity} шт</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: '800', letterSpacing: '1px' }}>РОЗПОДІЛЕНО / ЗАЛИШОК</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', color: isComplete ? '#22c55e' : '#ef4444' }}>
                {totalAllocated} / {remaining} шт
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
            {batchScheduleList.map((batch, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontWeight: '900', color: '#ff9000', minWidth: '85px', fontSize: '0.9rem' }}>
                  Партія №{idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', fontWeight: '800', marginBottom: '4px' }}>КІЛЬКІСТЬ (ШТ)</label>
                  <input
                    type="number"
                    value={batch.quantity}
                    onChange={e => onUpdateBatchItem(idx, 'quantity', e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '10px', width: '100%', outline: 'none', fontWeight: '700' }}
                    placeholder="Кількість..."
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', fontWeight: '800', marginBottom: '4px' }}>ДЕДЛАЙН</label>
                  <input
                    type="date"
                    value={batch.deadline}
                    onChange={e => onUpdateBatchItem(idx, 'deadline', e.target.value)}
                    onClick={e => e.target.showPicker()}
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '10px', width: '100%', outline: 'none', fontWeight: '700' }}
                  />
                </div>
                {batchScheduleList.length > 1 && (
                  <button
                    onClick={() => onRemoveBatchItem(idx)}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '16px' }}
                    title="Видалити партію"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={onAddBatchItem}
            className="btn-load-more"
            style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderStyle: 'dashed' }}
          >
            <Plus size={16} /> ДОДАТИ ПАРТІЮ В ГРАФІК
          </button>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button onClick={onClose} className="btn-load-more" style={{ padding: '12px 24px' }}>СКАСУВАТИ</button>
            <button
              onClick={onSaveBatchSchedule}
              disabled={isSavingSchedule}
              className="btn-primary-modern"
              style={{ padding: '12px 24px', marginTop: 0 }}
            >
              {isSavingSchedule ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ КАЛЕНДАР ПАРТІЙ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
