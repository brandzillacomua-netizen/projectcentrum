import React from 'react'
import { Package, Layers } from 'lucide-react'
import { Shop2ActiveCardsTable } from './Shop2ActiveCardsTable'
import { matchesStage } from '../utils/shop2Helpers'

export function Shop2Dashboard({
  workCards = [],
  workCardHistory = [],
  isShop2Card = () => false,
  calculateTotalBufferParts = () => 0,
  setShowStorageExplorer = () => {},
  setDetailStage = () => {},
  shop2Stages = ['Пресування', 'Фарбування', 'Доопрацювання'],
  isSyncing = false,
  setSelectedCardId = () => {},
  getNomFromCard = () => null
}) {
  const bufferQty = calculateTotalBufferParts()

  return (
    <div style={{ width: '100%', padding: '0 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>МОНІТОРИНГ ЦЕХУ №2</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '50px' }}>
        {/* КАРТКА ВХІДНОГО БУФЕРА */}
        <div onClick={() => setShowStorageExplorer(true)} style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, rgba(139, 92, 246, 0.3))', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s', boxShadow: '0 10px 30px -10px rgba(139, 92, 246, 0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 950, textTransform: 'uppercase' }}>ВХІДНИЙ БУФЕР</span>
            <Package size={14} color="#8b5cf6" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 800 }}>ВІЛЬНІ ДЕТАЛІ</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: 'var(--text-primary, #0f172a)', lineHeight: 1 }}>{bufferQty.toLocaleString('uk-UA')}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color, #e2e8f0)', paddingLeft: '8px', gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СТАН БУФЕРА</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: bufferQty > 0 ? '#8b5cf6' : 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                {bufferQty > 0 ? 'Вільні для нових карток' : 'Буфер порожній'}
              </div>
            </div>
          </div>
        </div>

        {/* ЕТАПИ ЦЕХУ №2 */}
        {shop2Stages.map(stage => {
          const stageCards = workCards.filter(c => isShop2Card(c) && matchesStage(c.operation, stage))
          const workQty = stageCards.filter(c => c.status === 'in-progress').reduce((acc, c) => acc + (c.quantity || 0), 0)
          const bQty = stageCards.filter(c => ['at-buffer', 'waiting-buffer'].includes(c.status)).reduce((acc, c) => acc + (c.quantity || 0), 0)
          const scrapQty = workCardHistory.filter(h => isShop2Card(h) && matchesStage(h.stage_name, stage)).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)

          return (
            <div key={stage} onClick={() => setDetailStage(stage)} style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{stage}</span>
                <Layers size={14} color="#8b5cf6" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 800 }}>В РОБОТІ</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 950, color: workQty > 0 ? '#fff' : '#222' }}>{workQty}</div>
                </div>
                <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800 }}>БУФЕР</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 950, color: bQty > 0 ? '#10b981' : '#222' }}>{bQty}</div>
                </div>
                <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800 }}>БРАК</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 950, color: scrapQty > 0 ? '#ef4444' : '#222' }}>{scrapQty}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Shop2ActiveCardsTable
        workCards={workCards}
        isShop2Card={isShop2Card}
        isSyncing={isSyncing}
        setSelectedCardId={setSelectedCardId}
        getNomFromCard={getNomFromCard}
      />
    </div>
  )
}
