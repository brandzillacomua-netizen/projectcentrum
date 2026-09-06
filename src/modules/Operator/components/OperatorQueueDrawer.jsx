import React from 'react'
import { ClipboardList, X } from 'lucide-react'

export const OperatorQueueDrawer = ({
  queuedCards,
  selectedCardId,
  setSelectedCardId,
  isDrawerOpen,
  setIsDrawerOpen,
  getNomFromCard,
  getQtyFromCard,
  getSheetsFromCard,
  orders
}) => {
  const renderQueueContent = () => (
    <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {queuedCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>
          Поки що немає прийнятих карт. Відскануйте першу...
        </div>
      )}
      {queuedCards.map(card => {
        const nom = getNomFromCard(card)
        const isActive = selectedCardId === card.id
        return (
          <div
            key={card.id}
            onClick={() => { setSelectedCardId(card.id); setIsDrawerOpen(false) }}
            style={{
              background: isActive ? '#eab308' : '#1a1a1a',
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '10px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: isActive ? '#eab308' : '#333',
              transition: '0.2s',
              color: isActive ? '#000' : '#fff'
            }}
          >
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                №{orders?.find(o => o.id === card.order_id)?.order_num || '—'} | {(() => {
                  const bz = Number(card.buffer_qty) || Number(card.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
                  const need = Number(card.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(card.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(card.quantity) - bz)
                  if (bz > 0) return `${card.quantity} шт (${need}+${bz} БЗ)`
                  return `${card.quantity} шт`
                })()} | {card.operation} {getSheetsFromCard(card) ? `| Лист ${getSheetsFromCard(card)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.1)', color: isActive ? '#000' : '#eab308', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>
                {card.status === 'in-progress' ? 'У РОБОТІ' : 'ОЧІКУЄ'}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                {(() => {
                  const totalMin = Math.round((Number(card.estimated_time) || 0) / 60)
                  const h = Math.floor(totalMin / 60)
                  const m = totalMin % 60
                  return h > 0 ? `${h}год ${m}хв` : `${m}хв`
                })()}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardList size={16} /> ЧЕРГА КАРТ ({queuedCards.length})
        </div>
        {renderQueueContent()}
      </div>

      {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
      <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
          <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
        </div>
        {renderQueueContent()}
      </div>
    </>
  )
}
