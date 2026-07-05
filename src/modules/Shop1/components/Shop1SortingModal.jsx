import React from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../supabase'

export function Shop1SortingModal({
  currentCard,
  scrapCount,
  setScrapCount,
  reworkCount,
  setReworkCount,
  selectedShift,
  setSelectedShift,
  selectedOperator,
  setSelectedOperator,
  getFilteredOperators,
  handleSortToShop2,
  isProcessing,
  setIsProcessing,
  setShowSortingModal,
  fetchData,
  getNom
}) {
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
  const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10021, padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #8b5cf640', display: 'flex', flexDirection: 'column', margin: 'auto 0' }}>
        <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #8b5cf620', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#8b5cf6' }}>🚀 ЗАВЕРШИТИ СОРТУВАННЯ</h3>
            <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '2px' }}>→ ВІДПРАВИТИ В БУФЕР ЦЕХУ №2</div>
          </div>
          <button onClick={() => setShowSortingModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNom(currentCard)?.name}</h3>
          <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '14px 18px', border: '1px solid #8b5cf620', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#8b5cf6', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Кількість по картці</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{currentCard.quantity} <small style={{ fontSize: '1rem', opacity: 0.4 }}>шт</small></div>
          </div>

          {/* Лічильник браку */}
          <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
            <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>КІЛЬКІСТЬ БРАКУ ПРИ СОРТУВАННІ</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
              <input type="number" min={0} max={currentCard.quantity - reworkCount} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                onChange={e => {
                  const val = e.target.value
                  setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - reworkCount, parseInt(val) || 0)))
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
              <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity - reworkCount, v + 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
            </div>
          </div>

          {/* Лічильник доопрацювання */}
          <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #f59e0b22' }}>
            <label style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ (Цех №2)</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <button onClick={() => setReworkCount(v => Math.max(0, v - 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
              <input type="number" min={0} max={currentCard.quantity - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                onChange={e => {
                  const val = e.target.value
                  setReworkCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - scrapCount, parseInt(val) || 0)))
                }}
                style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
              <button onClick={() => setReworkCount(v => Math.min(currentCard.quantity - scrapCount, v + 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
            </div>
          </div>

          {/* Підсумок */}
          <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '14px 18px', border: '1px solid #10b98122', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#555' }}>
              В Цех №2: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - scrapCount - reworkCount)} шт</strong>
              {' · '}Доопрацювання: <strong style={{ color: '#f59e0b' }}>{reworkCount} шт</strong>
              {' · '}Брак: <strong style={{ color: '#ef4444' }}>{scrapCount} шт</strong>
            </div>
          </div>

          {/* Зміна та оператор */}
          <div>
            <label style={labelStyle}>Зміна</label>
            <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
              <option value="">— Оберіть зміну —</option>
              <option value="Зміна 1">Зміна 1</option>
              <option value="Зміна 2">Зміна 2</option>
              <option value="Зміна 3">Зміна 3</option>
              <option value="Зміна 4">Зміна 4</option>
              <option value="Без зміни">Без зміни</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Відповідальний за сортування</label>
            <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
              <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
              {getFilteredOperators('Сортування', selectedShift, 'Сортування').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <button
            onClick={async () => {
              if (currentCard.status === 'in-progress' && currentCard.operation === 'Сортування') {
                setIsProcessing(true)
                try {
                  await supabase.from('work_cards').update({
                    status: 'at-buffer',
                    completed_at: new Date().toISOString()
                  }).eq('id', currentCard.id)
                  await new Promise(r => setTimeout(r, 300))
                  await fetchData(['work_cards']).catch(() => {})
                } catch(e) { console.error(e) } finally { setIsProcessing(false) }
              }
              setShowSortingModal(false)
              await handleSortToShop2()
            }}
            disabled={!selectedOperator || !selectedShift || isProcessing}
            style={{
              background: '#8b5cf6', color: '#fff', border: 'none', width: '100%',
              height: '64px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 1000,
              cursor: (!selectedOperator || !selectedShift || isProcessing) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 10px 30px rgba(139,92,246,0.3)',
              opacity: (!selectedOperator || !selectedShift || isProcessing) ? 0.5 : 1
            }}>
            🚀 {isProcessing ? 'ВІДПРАВКА...' : 'ВІДПРАВИТИ В БУФЕР ЦЕХУ №2'}
          </button>
        </div>
      </div>
    </div>
  )
}
