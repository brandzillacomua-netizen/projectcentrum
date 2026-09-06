import React from 'react'
import { Link } from 'react-router-dom'
import { X, ClipboardList, Layers, Box, Gauge, CheckCircle, Package } from 'lucide-react'
import { formatElapsedTime } from '../utils/shop2Helpers'

export function Shop2CardDetails({
  currentCard,
  setSelectedCardId,
  setScannedCardIds,
  orders,
  getNomFromCard = () => null,
  setShowQCModal,
  selectedStage,
  setSelectedStage,
  shop2Stages,
  selectedManager,
  setSelectedManager,
  getFilteredManagers,
  selectedShift,
  setSelectedShift,
  selectedOperator,
  setSelectedOperator,
  getFilteredOperators,
  selectedMachine,
  handleStartOperation,
  handoverToSGP,
  submitCompletion,
  isProcessing,
  setIsProcessing
}) {
  const SpecCard = ({ icon: Icon, label, value, color = "#8b5cf6" }) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color }}>{value}</div>
    </div>
  )

  const nom = typeof getNomFromCard === 'function' ? getNomFromCard(currentCard) : null
  const orderNum = orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            {currentCard.status === 'new' && (
              <div style={{ background: '#8b5cf6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>НОВА КАРТА ЦЕХ №2</div>
            )}
            {currentCard.status === 'at-buffer' && (
              <div style={{ background: '#eab308', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>ОЧІКУЄ ЕТАПУ</div>
            )}
            {currentCard.status === 'in-progress' && (
              <div style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>У РОБОТІ</div>
            )}
            <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
              ЗАМОВЛЕННЯ №{orderNum} · #{currentCard.id.slice(-8).toUpperCase()}
            </div>
          </div>
          <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {nom?.name || (currentCard.card_info?.split('] ').pop() || `Картка #${currentCard.id.slice(0, 8)}`)}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentCard.task_id && (
            <Link
              to="/shop2-card-gen"
              state={{ taskId: currentCard.task_id }}
              style={{ background: '#8b5cf615', border: '1px solid #8b5cf640', color: '#8b5cf6', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              title="Перейти до батьківського наряду">
              📋 <span className="hide-mobile">НАРЯД</span>
            </Link>
          )}
          <button onClick={() => setShowQCModal(true)}
            style={{ background: '#ef4444', border: 'none', color: '#ffffff', padding: '10px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
            title="Фіксація браку ВКЯ">
            🛡️ БРАК ВКЯ
          </button>
          <button onClick={() => setSelectedCardId(null)} style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
        <SpecCard icon={ClipboardList} label="Замовлення" value={`№${orderNum}`} color="#f43f5e" />
        <SpecCard icon={Layers} label="Матеріал" value={nom?.material_type || '—'} color="#10b981" />
        <SpecCard
          icon={Box}
          label="Кількість"
          value={((() => {
            const need = currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]
            const bz = currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1] || currentCard.buffer_qty
            if (need && bz) return `${currentCard.quantity} шт (${need}+${bz} БЗ)`
            return `${currentCard.quantity} шт`
          }))()}
          color="#3b82f6"
        />
        <SpecCard icon={Gauge} label="Етап" value={currentCard.status === 'at-buffer' ? `Буфер ${currentCard.operation?.toLowerCase()}` : (currentCard.operation || '—')} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid #1a1a1a', padding: '40px' }}>
        {currentCard.status === 'completed' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: '#10b98122', border: '2px solid #10b98155',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 25px'
            }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <div style={{ color: '#10b981', fontSize: '1.6rem', fontWeight: 950, marginBottom: '10px' }}>
              ПЕРЕДАНО НА СГП
            </div>
            <div style={{ color: '#444', fontSize: '0.85rem', fontWeight: 700, marginBottom: '30px' }}>
              Ця картка вже завершена і передана на склад готової продукції.
            </div>
            <div style={{
              background: '#ef444411', border: '1px solid #ef444433',
              borderRadius: '16px', padding: '15px 20px',
              color: '#ef4444', fontSize: '0.8rem', fontWeight: 800
            }}>
              ⛔ Повторні дії по цій картці заблоковані. Наряд закрито.
            </div>
            <button
              onClick={() => { setSelectedCardId(null); setScannedCardIds(prev => prev.filter(id => String(id) !== String(currentCard.id))) }}
              style={{ marginTop: '25px', background: '#222', border: 'none', color: '#888', padding: '12px 30px', borderRadius: '14px', cursor: 'pointer', fontWeight: 800 }}
            >
              Закрити
            </button>
          </div>
        ) : (currentCard.status === 'new' || currentCard.status === 'at-buffer') ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '500px', margin: '0 auto' }}>
            {currentCard.status === 'at-buffer' && currentCard.operator_name && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '15px', padding: '15px', color: '#10b981', fontWeight: 800, fontSize: '0.85rem', textAlign: 'center' }}>
                👤 ВИКОНАВЕЦЬ: {currentCard.operator_name} {currentCard.shift_name ? `(${currentCard.shift_name})` : ''}
              </div>
            )}
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Поточний етап (ЦЕХ №2)</label>
              <select value={selectedStage || currentCard.operation} onChange={(e) => setSelectedStage(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                {shop2Stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Майстер</label>
              <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">— Оберіть майстра —</option>
                {getFilteredManagers('Цех №2').map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Зміна</label>
              <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">— Оберіть зміну —</option>
                <option value="Зміна 1">Зміна 1</option>
                <option value="Зміна 2">Зміна 2</option>
                <option value="Зміна 3">Зміна 3</option>
                <option value="Зміна 4">Зміна 4</option>
                <option value="Без зміни">Без зміни</option>
              </select>
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Відповідальний оператор</label>
              <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                {getFilteredOperators('Цех №2', selectedShift, selectedStage || currentCard.operation).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <button
              disabled={isProcessing || !selectedOperator || (currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation)}
              onClick={handleStartOperation}
              style={{
                background: '#8b5cf6',
                color: '#fff',
                border: 'none',
                padding: '22px',
                borderRadius: '18px',
                fontSize: '1.4rem',
                fontWeight: 900,
                cursor: (isProcessing || !selectedOperator || (currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation)) ? 'not-allowed' : 'pointer',
                transition: '0.2s',
                opacity: (isProcessing || !selectedOperator || (currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation)) ? 0.3 : 1
              }}
            >
              {currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation ? 'ЕТАП ЗАВЕРШЕНО (В БУФЕРІ)' : 'ВЗЯТИ В РОБОТУ'}
            </button>
            {currentCard.status === 'at-buffer' && (
              <button
                disabled={isProcessing}
                onClick={async () => {
                  if (isProcessing) return
                  setIsProcessing(true)
                  try {
                    await handoverToSGP(currentCard.id)
                    setSelectedCardId(null)
                    setScannedCardIds(prev => prev.filter(id => String(id) !== String(currentCard.id)))
                  } catch (e) {
                    alert('Помилка передачі: ' + e.message)
                  } finally {
                    setIsProcessing(false)
                  }
                }}
                style={{
                  background: isProcessing ? '#555' : '#f43f5e',
                  color: '#fff', border: 'none', padding: '15px',
                  borderRadius: '18px', fontSize: '1rem', fontWeight: 900,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  opacity: isProcessing ? 0.5 : 1
                }}
              >
                <Package size={18} /> {isProcessing ? 'ПЕРЕДАЧА...' : 'ПЕРЕДАТИ НА СКЛАД СГП'}
              </button>
            )}
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#444', fontWeight: 700 }}>Робоча картка автоматично збережеться в базу</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px' }}>ЧАС В РОБОТІ</div>
            <div style={{ fontSize: '6.5rem', fontWeight: 1000, color: '#fff', fontFamily: 'monospace', letterSpacing: '-2px' }}>{formatElapsedTime(currentCard.started_at)}</div>
            <div style={{ color: '#555', marginBottom: '30px', fontWeight: 800 }}>ОПЕРАТОР: {currentCard.operator_name}</div>
            <button onClick={submitCompletion} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 70px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 40px rgba(236, 72, 153, 0.3)' }}>ЗАВЕРШИТИ ЕТАП</button>
          </div>
        )}
      </div>
    </div>
  )
}
