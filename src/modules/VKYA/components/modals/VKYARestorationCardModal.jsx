import React from 'react'
import { CornerUpLeft, Play, ShieldCheck, X } from 'lucide-react'

export const VKYARestorationCardModal = ({
  selectedCard,
  onClose,
  operator,
  setOperator,
  startCard,
  completedQty,
  setCompletedQty,
  finalScrapQty,
  setFinalScrapQty,
  completeCard,
  returnToSourceRoute,
  returnLegacyToBZ,
  dispatchToShop2,
  saving
}) => {
  if (!selectedCard) return null

  return (
    <div onClick={() => !saving && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,.86)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 510, background: 'var(--card-bg, #0d0d0d)', border: '1px solid var(--glass-border, #292929)', borderRadius: 24, padding: 26, color: 'var(--text, #fff)', boxShadow: 'var(--shadow, 0 25px 50px rgba(0,0,0,0.5))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15 }}>
          <div>
            <div style={{ color: '#06b6d4', fontSize: '.7rem', fontWeight: 950 }}>КАРТА №{selectedCard.card_number}</div>
            <h2 style={{ margin: '8px 0 4px', color: 'var(--text, #fff)' }}>{selectedCard.nomenclature_name}</h2>
            <div style={{ color: 'var(--text-muted, #888)' }}>{selectedCard.restoration_stage} · {selectedCard.quantity} {selectedCard.unit}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: 'var(--text-muted, #777)', cursor: 'pointer' }}><X/></button>
        </div>

        {selectedCard.status === 'new' && (
          <>
            <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '.72rem', fontWeight: 900, margin: '25px 0 8px' }}>ПРАЦІВНИК ВКЯ</label>
            <input
              autoFocus
              value={operator}
              onChange={e => setOperator(e.target.value)}
              placeholder="Вкажіть працівника"
              style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #050505)', border: '1px solid var(--glass-border, #333)', borderRadius: 12, color: 'var(--text, #fff)', padding: 14 }}
            />
            <button onClick={startCard} disabled={saving || !operator.trim()} style={{ width: '100%', marginTop: 20, background: '#06b6d4', border: 0, borderRadius: 13, padding: 14, color: '#001014', fontWeight: 1000, cursor: 'pointer' }}>
              <Play size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ВЗЯТИ В РОБОТУ
            </button>
          </>
        )}

        {selectedCard.status === 'in_progress' && (
          <>
            <label style={{ display: 'block', color: '#ef4444', fontSize: '.72rem', fontWeight: 1000, margin: '25px 0 8px' }}>СКІЛЬКИ ДЕТАЛЕЙ ПЕРЕВЕСТИ В УТИЛЬ, {selectedCard.unit}</label>
            <input
              autoFocus
              type="number"
              min="0"
              max={selectedCard.quantity}
              value={finalScrapQty}
              onChange={event => {
                setFinalScrapQty(event.target.value)
                const scrap = Number(event.target.value)
                setCompletedQty(Number.isFinite(scrap) ? String(Math.max(0, Number(selectedCard.quantity) - scrap)) : '')
              }}
              style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #160707)', border: '1px solid #ef444466', borderRadius: 12, color: 'var(--text, #fff)', padding: 14, fontSize: '1.15rem', fontWeight: 900 }}
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, background: 'var(--card-bg, #07140f)', border: '1px solid #10b98144', borderRadius: 12, padding: 13 }}>
              <span style={{ color: 'var(--text-muted, #8a9a93)', fontSize: '.75rem', fontWeight: 850 }}>БУДЕ ВІДНОВЛЕНО</span>
              <strong style={{ color: '#10b981' }}>{completedQty || 0} {selectedCard.unit}</strong>
            </div>
            <div style={{ color: 'var(--text-muted, #777)', fontSize: '.7rem', marginTop: 10 }}>Уся кількість карти має бути розподілена між відновленими деталями та остаточним утилем.</div>
            <button onClick={completeCard} disabled={saving || finalScrapQty === '' || !Number.isInteger(Number(finalScrapQty)) || Number(finalScrapQty) < 0 || Number(finalScrapQty) > Number(selectedCard.quantity)} style={{ width: '100%', marginTop: 20, background: '#10b981', border: 0, borderRadius: 13, padding: 14, color: '#00150e', fontWeight: 1000, cursor: 'pointer' }}>
              <ShieldCheck size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ЗАВЕРШИТИ КАРТУ
            </button>
          </>
        )}

        {selectedCard.status === 'completed' && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 15 }}>
            {selectedCard.source_history_id && selectedCard.source_task_id ? (
              <div style={{ background: '#10b98112', border: '1px solid #10b98144', borderRadius: 14, padding: 15 }}>
                <div style={{ color: '#10b981', fontSize: '.72rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ У БУФЕР ЦЕХУ №2</div>
                <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '.7rem', marginTop: 7 }}>Відновлені деталі надійдуть у Буфер Цеху №2 початкового наряду. Начальник Цеху №2 зможе направити їх на потрібний етап (Пресування, Фарбування тощо).</div>
                <button onClick={returnToSourceRoute} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ width: '100%', marginTop: 14, background: '#10b981', border: 0, borderRadius: 12, padding: 14, color: '#00150e', fontWeight: 1000, cursor: 'pointer' }}>
                  <CornerUpLeft size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ПОВЕРНУТИ В НАРЯД (В БУФЕР ЦЕХУ №2) · {selectedCard.completed_quantity} {selectedCard.unit}
                </button>
              </div>
            ) : (
              <div style={{ background: '#f59e0b12', border: '1px solid #f59e0b44', borderRadius: 14, padding: 15 }}>
                <div style={{ color: '#f59e0b', fontSize: '.72rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ НА СКЛАД (В БАЗОВИЙ ЗАЛИШОК)</div>
                <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '.7rem', marginTop: 7 }}>Ця карта створена зі старого обліку і не має зв'язку з активним нарядом. Відновлені деталі будуть зараховані безпосередньо в Базовий залишок (БЗ) на склад.</div>
                <button onClick={returnLegacyToBZ} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ width: '100%', marginTop: 14, background: '#f59e0b', border: 0, borderRadius: 12, padding: 14, color: '#170d00', fontWeight: 1000, cursor: 'pointer' }}>
                  <CornerUpLeft size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ПОВЕРНУТИ НА СКЛАД (БЗ) · {selectedCard.completed_quantity} {selectedCard.unit}
                </button>
              </div>
            )}

            <div style={{ background: '#06b6d412', border: '1px solid #06b6d444', borderRadius: 14, padding: 15 }}>
              <div style={{ color: '#06b6d4', fontSize: '.72rem', fontWeight: 1000 }}>ПЕРЕДАЧА В ЦЕХ №2</div>
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '.7rem', marginTop: 7 }}>Ви можете передати ці відновлені деталі як нове завдання у Цех №2 для проходження додаткової обробки.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                <button onClick={() => dispatchToShop2('Пресування')} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ background: '#06b6d4', border: 0, borderRadius: 12, padding: 12, color: '#001014', fontWeight: 1000, cursor: 'pointer', fontSize: '.78rem' }}>🛠️ ПРЕСУВАННЯ</button>
                <button onClick={() => dispatchToShop2('Фарбування')} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ background: '#06b6d4', border: 0, borderRadius: 12, padding: 12, color: '#001014', fontWeight: 1000, cursor: 'pointer', fontSize: '.78rem' }}>🎨 ФАРБУВАННЯ</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VKYARestorationCardModal
