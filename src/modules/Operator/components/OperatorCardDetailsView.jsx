import React from 'react'
import { X, Layers, Box, Gauge } from 'lucide-react'

const SpecCard = ({ icon: Icon, label, value, color = "#eab308" }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
      <Icon size={14} /> {label}
    </div>
    <div style={{ fontSize: '1.2rem', fontWeight: 900, color }}>{value}</div>
  </div>
)

export const OperatorCardDetailsView = ({
  currentCard,
  setSelectedCardId,
  orders,
  getNomFromCard,
  getQtyFromCard,
  selectedMachine,
  setSelectedMachine,
  selectedMaster,
  setSelectedMaster,
  selectedShift,
  setSelectedShift,
  selectedOperator,
  setSelectedOperator,
  selectedStage,
  machines,
  getFilteredManagers,
  getFilteredOperators,
  getCardDept,
  maintenanceCheckEnabled,
  isProcessing,
  handleStartOperation,
  setShowPinModal,
  submitCompletion,
  currentTime
}) => {
  if (!currentCard) return null

  const formatElapsedTime = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }} className="anim-fade-in">
      <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ background: currentCard.status === 'new' ? '#ef4444' : '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>
              {currentCard.status === 'new' ? 'НОВА КАРТА' : 'РОБОЧА КАРТА'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
              ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} | КАРТКА #{currentCard.id.slice(0, 8).toUpperCase()}... | {(() => {
                const bz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
                const need = Number(currentCard.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(currentCard.quantity) - bz)
                if (bz > 0) return `${currentCard.quantity} ШТ (${need}+${bz} БЗ)`
                return `${currentCard.quantity} ШТ`
              })()}
            </div>
          </div>
          <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {getNomFromCard(currentCard)?.name || 'Деталь'}
          </h2>
        </div>
        <button onClick={() => setSelectedCardId(null)} style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
        <SpecCard icon={Layers} label="Матеріал" value={getNomFromCard(currentCard)?.material_type || '—'} color="#10b981" />
        <SpecCard icon={Box} label="Кількість" value={`${currentCard.quantity || getQtyFromCard(currentCard)} шт`} color="#3b82f6" />
        <SpecCard icon={Gauge} label="Обладнання" value={currentCard.machine || '—'} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid #1a1a1a', padding: '40px' }}>
        {currentCard.status === 'new' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '500px', margin: '0 auto' }}>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Виберіть верстат</label>
              <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">— Оберіть обладнання —</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.floor ? `(${m.floor} пов.)` : ''} 
                    {maintenanceCheckEnabled && m.status === 'maintenance_required' ? ' ⚠️ [ПОТРЕБУЄ ЧИСТКИ СТОЛА]' : maintenanceCheckEnabled && m.status === 'under_maintenance' ? ' 🛠️ [В РЕМОНТІ/ОБСЛУГОВУВАННІ]' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Майстер</label>
              <select value={selectedMaster} onChange={(e) => setSelectedMaster(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">— Оберіть майстра —</option>
                {getFilteredManagers(getCardDept(currentCard)).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Зміна</label>
              <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">— Оберіть зміну —</option>
                <option value="Зміна 1">Зміна 1</option>
                <option value="Зміна 2">Зміна 2</option>
                <option value="Нічна зміна">Нічна зміна</option>
              </select>
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Відповідальний оператор</label>
              <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">— Оберіть оператора —</option>
                {getFilteredOperators(getCardDept(currentCard), selectedShift, selectedStage || currentCard.operation).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {(() => {
              const selectedMachObj = machines.find(m => String(m.id) === String(selectedMachine))
              const isMachBlocked = maintenanceCheckEnabled && selectedMachObj && (selectedMachObj.status === 'maintenance_required' || selectedMachObj.status === 'under_maintenance')
              return (
                <>
                  {isMachBlocked && (
                    <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '10px' }}>
                      ⚠️ Верстат заблоковано! Очікується проведення технологічного ремонту (очистка стола).
                    </div>
                  )}
                  <button disabled={isProcessing || !selectedOperator || isMachBlocked} onClick={handleStartOperation} style={{ background: isMachBlocked ? '#333' : '#3b82f6', color: isMachBlocked ? '#666' : '#fff', border: 'none', padding: '22px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: isMachBlocked ? 'not-allowed' : 'pointer' }}>ВЗЯТИ В РОБОТУ</button>
                </>
              )
            })()}
            
            <button onClick={() => setShowPinModal(true)} style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '0.8rem', cursor: 'pointer' }}>ШВИДКИЙ ВХІД (555)</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px' }}>ЧАС ВИКОНАННЯ</div>
            <div style={{ fontSize: '6rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace' }}>{formatElapsedTime(currentCard.started_at)}</div>
            <button onClick={submitCompletion} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 70px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', marginTop: '30px' }}>ЗАВЕРШИТИ ТА В БУФЕР</button>
          </div>
        )}
      </div>
    </div>
  )
}
