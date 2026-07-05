import React from 'react'
import { Package } from 'lucide-react'

export function WarehousePrepBoxes({
  cardsWithBoxes,
  expandedNaryads,
  setExpandedNaryads,
  expandedNomenclatures,
  setExpandedNomenclatures,
  checkedCutters,
  handleToggleCutterCheck,
  handlePrepareBox,
  isProcessing
}) {
  const grouped = React.useMemo(() => {
    const map = {}
    cardsWithBoxes.forEach(item => {
      const orderNum = item.task?.order_num || item.card?.order_num || 'Без наряду'
      if (!map[orderNum]) {
        map[orderNum] = { orderNum, nomenclatures: {} }
      }
      const nomName = item.nom?.name || 'Інше'
      if (!map[orderNum].nomenclatures[nomName]) {
        map[orderNum].nomenclatures[nomName] = []
      }
      map[orderNum].nomenclatures[nomName].push(item)
    })
    return Object.values(map)
  }, [cardsWithBoxes])

  if (cardsWithBoxes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        Немає боксів для підготовки
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {grouped.map(g => {
        const isExpanded = !!expandedNaryads[g.orderNum]
        const allBoxes = Object.values(g.nomenclatures).flat()
        const totalCards = allBoxes.length
        const preparedCards = allBoxes.filter(b => b.isPrepared).length

        return (
          <div key={g.orderNum} style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
            <div 
              onClick={() => setExpandedNaryads(prev => ({ ...prev, [g.orderNum]: !isExpanded }))}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', cursor: 'pointer', background: '#161616' }}
            >
              <div>
                <strong style={{ fontSize: '1.05rem' }}>НАРЯД #{g.orderNum}</strong>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  Зібрано фрез: <strong style={{ color: preparedCards === totalCards ? '#10b981' : '#ff9000' }}>{preparedCards} / {totalCards}</strong> боксів
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900 }}>
                  {isExpanded ? 'ЗГОРНУТИ' : 'РОЗГОРНУТИ'}
                </span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {Object.entries(g.nomenclatures).map(([nomName, boxList]) => {
                  const nomKey = `${g.orderNum}-${nomName}`
                  const isNomExpanded = !!expandedNomenclatures[nomKey]
                  return (
                    <div key={nomName} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div 
                        onClick={() => setExpandedNomenclatures(prev => ({ ...prev, [nomKey]: !isNomExpanded }))}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.05)', padding: '10px 15px', borderRadius: '12px', cursor: 'pointer' }}
                      >
                        <span style={{ fontWeight: 800 }}>{nomName}</span>
                        <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>{isNomExpanded ? 'Згорнути' : 'Розгорнути'}</span>
                      </div>

                      {isNomExpanded && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                          {boxList.map(boxItem => {
                            const cardId = boxItem.card.id
                            const cardNum = boxItem.card.card_info?.split(' ')[0] || `№${cardId.substring(0, 8)}`
                            const isAllChecked = boxItem.cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])

                            return (
                              <div key={cardId} style={{ background: '#151515', padding: '15px', borderRadius: '16px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <strong>Картка {cardNum}</strong>
                                  <span style={{ color: boxItem.isPrepared ? '#10b981' : '#f59e0b' }}>
                                    {boxItem.isPrepared ? 'ГОТОВО' : 'ОЧІКУЄ'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                  Верстат: {boxItem.card.machine || '—'} | Листи: {boxItem.cardSheets} л.
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {boxItem.cutters.map(cutter => {
                                    const isChecked = !!checkedCutters[cardId]?.[cutter.nomenclature_id] || boxItem.isPrepared
                                    return (
                                      <div 
                                        key={cutter.nomenclature_id}
                                        onClick={() => !boxItem.isPrepared && handleToggleCutterCheck(cardId, cutter.nomenclature_id)}
                                        style={{ display: 'flex', justifyContent: 'space-between', background: '#0e0e0e', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                                      >
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                          <input type="checkbox" checked={isChecked} readOnly disabled={boxItem.isPrepared} />
                                          <span style={{ fontSize: '0.75rem' }}>{cutter.name}</span>
                                        </div>
                                        <strong>{cutter.qty} шт</strong>
                                      </div>
                                    )
                                  })}
                                </div>
                                {!boxItem.isPrepared && (
                                  <button
                                    disabled={isProcessing || !isAllChecked}
                                    onClick={() => handlePrepareBox(boxItem)}
                                    style={{ width: '100%', padding: '10px', background: isAllChecked ? '#10b981' : '#222', color: isAllChecked ? '#000' : '#555', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                                  >
                                    Зібрати бокс
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
