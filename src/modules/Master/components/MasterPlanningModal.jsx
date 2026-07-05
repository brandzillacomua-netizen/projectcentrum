import React from 'react'
import { X, Printer } from 'lucide-react'

export function MasterPlanningModal({
  activeNaryadOrder,
  setActiveNaryadOrder,
  isReprintMode,
  reprintTask,
  naryadQtys,
  setNaryadQtys,
  naryadDeadline,
  setNaryadDeadline,
  nomenclatures,
  getDisplayPartsForOrderItem,
  inventory,
  rowMachines,
  setRowMachines,
  rowMachinesSplits,
  setRowMachinesSplits,
  partCutterOverrides,
  setPartCutterOverrides,
  materialSplits,
  consumableSummary,
  selectedCutters,
  setSelectedCutters,
  materialSummary,
  handlePrint,
  isPrintDisabled,
  MACHINE_TYPES,
  getPlannedQty
}) {
  if (!activeNaryadOrder) return null

  const inputStyle = { width: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }

  return (
    <div className="worksheet-modal-overlay no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
      <div className="worksheet-panel" style={{ background: '#0d0d0d', border: '1px solid #222', width: '100%', maxWidth: '1000px', borderRadius: '24px', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflowY: 'auto', maxHeight: '95vh' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isReprintMode ? 'ДРУК ТЕХНОЛОГІЧНОЇ КАРТИ (КОПІЯ)' : 'ПЛАНУВАННЯ ТА СТВОРЕННЯ НАРЯДУ'}
            </h2>
            <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '4px' }}>
              Замовлення: <strong>№{activeNaryadOrder.order_num}</strong> | Клієнт: {activeNaryadOrder.customer}
            </div>
          </div>
          <button onClick={() => setActiveNaryadOrder(null)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        {/* Quantities editor */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#ff9000', marginBottom: '12px', fontWeight: 900 }}>ДЕТАЛІ ТА ВЕРСТАТИ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeNaryadOrder.order_items?.map(it => {
              const displayParts = getDisplayPartsForOrderItem(it)
              const planned = getPlannedQty(it.id)
              const total = Number(it.quantity)
              const nom = nomenclatures.find(n => n.id === it.nomenclature_id)

              return (
                <div key={it.id} style={{ background: '#111', padding: '16px', borderRadius: '16px', border: '1px solid #222' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{nom?.name}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#666' }}>Заплановано: {planned} / {total} шт</span>
                      {!isReprintMode && (
                        <input
                          type="number"
                          min={0}
                          max={total - planned}
                          value={naryadQtys[it.id] ?? ''}
                          onChange={e => {
                            const val = e.target.value
                            setNaryadQtys(prev => ({ ...prev, [it.id]: val === '' ? '' : Math.max(0, Math.min(total - planned, parseInt(val) || 0)) }))
                          }}
                          style={{ width: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '6px', borderRadius: '8px', textAlign: 'center', fontWeight: 900 }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Parts in BOM */}
                  {displayParts.map((part, pIdx) => {
                    if (!part.nom) return null
                    const mName = rowMachines[part.nom.id] || ''

                    return (
                      <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '10px 14px', borderRadius: '10px', marginTop: '6px', border: '1px solid #1a1a1a' }}>
                        <span style={{ fontSize: '0.78rem', color: '#aaa' }}>{part.nom.name}</span>
                        {!isReprintMode ? (
                          <select
                            value={mName}
                            onChange={e => setRowMachines(prev => ({ ...prev, [part.nom.id]: e.target.value }))}
                            style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', outline: 'none' }}
                          >
                            <option value="">-- Оберіть верстат --</option>
                            {MACHINE_TYPES.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#ff9000', fontWeight: 800 }}>{mName || '—'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Action Button & Print */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #1a1a1a', paddingTop: '20px' }}>
          <button onClick={() => setActiveNaryadOrder(null)} style={{ background: '#1a1a1a', border: 'none', color: '#aaa', padding: '12px 24px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
          <button
            onClick={handlePrint}
            disabled={isPrintDisabled}
            style={{
              background: isPrintDisabled ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)',
              color: isPrintDisabled ? '#555' : '#000',
              border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 950,
              cursor: isPrintDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Printer size={16} /> ДРУКУВАТИ ТА СТВОРИТИ
          </button>
        </div>

      </div>
    </div>
  )
}
