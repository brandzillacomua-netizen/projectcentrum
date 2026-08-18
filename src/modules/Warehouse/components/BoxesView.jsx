import React from 'react'
import { Package } from 'lucide-react'

export const BoxesView = ({
  cardsWithBoxes,
  searchQuery,
  orders,
  expandedNaryads,
  setExpandedNaryads,
  expandedNomenclatures,
  setExpandedNomenclatures,
  checkedCutters,
  handleToggleCutterCheck,
  handlePrepareBox,
  isProcessing
}) => {
  const [checkedSheets, setCheckedSheets] = React.useState({}) 
  
  // Group boxes
  const groups = {}
  cardsWithBoxes.forEach(box => {
    const search = searchQuery.toLowerCase().trim()
    const cardNum = box.card.card_info?.split(' ')[0] || ''
    const partName = box.nom?.name || ''
    const parentOrder = (orders || []).find(o => String(o.id) === String(box.card.order_id || box.task?.order_id))
    const orderNum = parentOrder ? parentOrder.order_num : 'Інші'
    
    if (search) {
      const matches = cardNum.toLowerCase().includes(search) || 
                      partName.toLowerCase().includes(search) || 
                      orderNum.toLowerCase().includes(search)
      if (!matches) return
    }

    if (!groups[orderNum]) {
      groups[orderNum] = {
        orderNum,
        orderId: parentOrder?.id,
        nomenclatures: {}
      }
    }
    
    const nomName = box.nom?.name || 'Без деталі'
    if (!groups[orderNum].nomenclatures[nomName]) {
      groups[orderNum].nomenclatures[nomName] = []
    }
    groups[orderNum].nomenclatures[nomName].push(box)
  })

  const parseCardIndex = (box) => {
    const firstWord = box.card.card_info?.split(' ')[0] || ''
    const match = firstWord.match(/^(\d+)\/(\d+)$/)
    return match ? parseInt(match[1]) : 999
  }

  Object.values(groups).forEach(g => {
    Object.keys(g.nomenclatures).forEach(nomName => {
      g.nomenclatures[nomName].sort((a, b) => parseCardIndex(a) - parseCardIndex(b))
    })
  })

  const groupList = Object.values(groups)

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
      {groupList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#555', fontSize: '0.85rem' }}>
          Не знайдено боксів для підготовки
        </div>
      ) : (
        groupList.map(g => {
          const isExpanded = expandedNaryads[g.orderNum] === true
          const totalNaryadCards = Object.values(g.nomenclatures).reduce((acc, list) => acc + list.length, 0)
          const pendingNaryadCards = Object.values(g.nomenclatures).reduce((acc, list) => acc + list.filter(b => !b.isPrepared).length, 0)
          const preparedNaryadCards = totalNaryadCards - pendingNaryadCards

          return (
            <div 
              key={g.orderNum} 
              style={{ 
                background: '#0a0a0a', 
                borderRadius: '24px', 
                border: '1px solid #1a1a1a', 
                overflow: 'hidden',
                boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
                marginBottom: '5px'
              }}
            >
              <div 
                onClick={() => setExpandedNaryads(prev => ({ ...prev, [g.orderNum]: !isExpanded }))}
                style={{ 
                  padding: '16px 15px', 
                  background: '#111', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid #1a1a1a' : 'none',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#151515'}
                onMouseLeave={e => e.currentTarget.style.background = '#111'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '1.2rem' }}>📦</span>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>НАРЯД #{g.orderNum}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                      Зібрано: <strong style={{ color: preparedNaryadCards === totalNaryadCards ? '#10b981' : '#ff9000' }}>{preparedNaryadCards} / {totalNaryadCards}</strong> боксів
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {preparedNaryadCards === totalNaryadCards ? (
                    <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900 }}>ГОТОВИЙ</span>
                  ) : (
                    <span style={{ background: 'rgba(255, 144, 0, 0.08)', color: '#ff9000', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900 }}>В РОБОТІ</span>
                  )}
                  <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900 }}>
                    {isExpanded ? 'ЗГОРНУТИ' : 'РОЗГОРНУТИ'}
                  </span>
                  <span style={{ color: '#ff9000', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '15px 10px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  {Object.entries(g.nomenclatures).map(([nomName, boxList]) => {
                    const totalNom = boxList.length
                    const pendingNom = boxList.filter(b => !b.isPrepared).length
                    const preparedNom = totalNom - pendingNom
                    const nomKey = `${g.orderNum}-${nomName}`
                    const isNomExpanded = expandedNomenclatures[nomKey] === true

                    const sheetsSummary = {}
                    const cuttersSummary = {}
                    boxList.forEach(item => {
                      const matName = item.activeMaterialName || 'Листи'
                      sheetsSummary[matName] = (sheetsSummary[matName] || 0) + item.cardSheets
                      item.cutters.forEach(c => {
                        cuttersSummary[c.name] = (cuttersSummary[c.name] || 0) + c.qty
                      })
                    })

                    return (
                      <div key={nomName} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div 
                          onClick={() => setExpandedNomenclatures(prev => ({ ...prev, [nomKey]: !isNomExpanded }))}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            background: 'rgba(59, 130, 246, 0.03)',
                            padding: '12px 18px',
                            borderRadius: '16px',
                            border: '1px solid rgba(59, 130, 246, 0.12)',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.03)'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.62rem', color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Номенклатура (Деталь)
                            </div>
                            <span style={{ fontSize: '0.68rem', color: '#3b82f6', fontWeight: 900 }}>
                              {isNomExpanded ? 'ЗГОРНУТИ ДЕТАЛЬ ▲' : 'РОЗГОРНУТИ ДЕТАЛЬ ▼'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <span style={{ fontSize: '0.92rem', color: '#fff', fontWeight: 800 }}>
                              {nomName}
                            </span>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              color: preparedNom === totalNom ? '#10b981' : '#ff9000', 
                              background: preparedNom === totalNom ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 144, 0, 0.1)',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontWeight: 800
                            }}>
                              Зібрано: {preparedNom} / {totalNom} боксів
                            </span>
                          </div>

                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '10px', 
                            marginTop: '12px', 
                            paddingTop: '12px', 
                            borderTop: '1px dashed rgba(59, 130, 246, 0.15)',
                            fontSize: '0.75rem'
                          }}>
                            <div style={{ color: '#888', display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ opacity: 0.8 }}>⚡</span> 
                              <span style={{ color: '#aaa', minWidth: '90px', fontWeight: 700 }}>Усього листів:</span>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {Object.entries(sheetsSummary).map(([mat, qty]) => (
                                  <span key={mat} style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px', color: '#eee', fontWeight: 800 }}>
                                    {qty} л. ({mat.replace(/лист\s*/gi, '')})
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ color: '#888', display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ opacity: 0.8 }}>🛠️</span> 
                              <span style={{ color: '#aaa', minWidth: '90px', fontWeight: 700 }}>Усього фрез:</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
                                {Object.entries(cuttersSummary).map(([cName, qty]) => (
                                  <div key={cName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '400px' }}>
                                    <span style={{ color: '#888', fontSize: '0.72rem', flex: 1, marginRight: '10px' }}>{cName.replace(/фреза\s*/gi, '')}</span>
                                    <span style={{ color: '#10b981', fontWeight: 900, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{qty} шт</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {isNomExpanded && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
                            {boxList.map(boxItem => {
                              const cardId = boxItem.card.id
                              const cardNum = boxItem.card.card_info?.split(' ')[0] || `№${cardId.substring(0, 8)}`
                              const isAllChecked = boxItem.cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])
                              const isSheetChecked = !!checkedSheets[cardId] || boxItem.isPrepared

                              const canSubmit = isAllChecked && isSheetChecked

                              return (
                                <div 
                                  key={cardId} 
                                  style={{ 
                                    background: boxItem.isPrepared ? 'rgba(16, 185, 129, 0.02)' : '#121212', 
                                    padding: '18px', 
                                    borderRadius: '20px', 
                                    border: boxItem.isPrepared ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #1e1e1e',
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '15px',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e1e1e', paddingBottom: '10px' }}>
                                    <div>
                                      <strong style={{ fontSize: '1.05rem', color: '#fff' }}>Картка {cardNum}</strong>
                                    </div>
                                    {boxItem.isPrepared ? (
                                      <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                        ✓ Зібрано
                                      </span>
                                    ) : (
                                      <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                        Очікує
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#090909', padding: '10px 15px', borderRadius: '14px', border: '1px solid #151515' }}>
                                    <div>
                                      <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>ВЕРСТАТ</div>
                                      <div style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 700 }}>{boxItem.card.machine || '—'}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>ЛИСТИ</div>
                                      <div style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 700 }}>{boxItem.cardSheets} л.</div>
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 800, marginBottom: '8px' }}>
                                      СПИСОК НАПОВНЕННЯ БОКСУ:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div 
                                        onClick={() => !boxItem.isPrepared && setCheckedSheets(prev => ({ ...prev, [cardId]: !prev[cardId] }))}
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'flex-start', 
                                          justifyContent: 'space-between', 
                                          background: isSheetChecked ? 'rgba(16, 185, 129, 0.04)' : '#0d0d0d', 
                                          padding: '10px 14px', 
                                          borderRadius: '10px', 
                                          border: isSheetChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #1e1e1e',
                                          cursor: boxItem.isPrepared ? 'default' : 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, marginRight: '10px' }}>
                                          <input 
                                            type="checkbox" 
                                            checked={isSheetChecked}
                                            disabled={boxItem.isPrepared}
                                            onChange={() => {}} 
                                            style={{ accentColor: '#10b981', marginTop: '2px', cursor: boxItem.isPrepared ? 'default' : 'pointer' }}
                                          />
                                          <span style={{ fontSize: '0.76rem', color: isSheetChecked ? '#aaa' : '#888', fontWeight: isSheetChecked ? 700 : 500 }}>
                                            {boxItem.activeMaterialName}
                                          </span>
                                        </div>
                                        <strong style={{ fontSize: '0.8rem', color: isSheetChecked ? '#10b981' : '#fff', whiteSpace: 'nowrap' }}>
                                          {boxItem.cardSheets} л.
                                        </strong>
                                      </div>

                                      {boxItem.cutters.map(cutter => {
                                        const isChecked = !!checkedCutters[cardId]?.[cutter.nomenclature_id] || boxItem.isPrepared
                                        return (
                                          <div 
                                            key={cutter.nomenclature_id}
                                            onClick={() => !boxItem.isPrepared && handleToggleCutterCheck(cardId, cutter.nomenclature_id)}
                                            style={{ 
                                              display: 'flex', 
                                              alignItems: 'flex-start', 
                                              justifyContent: 'space-between', 
                                              background: isChecked ? 'rgba(16, 185, 129, 0.04)' : '#0d0d0d', 
                                              padding: '10px 14px', 
                                              borderRadius: '10px', 
                                              border: isChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #1e1e1e',
                                              cursor: boxItem.isPrepared ? 'default' : 'pointer',
                                              transition: 'all 0.15s'
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, marginRight: '10px' }}>
                                              <input 
                                                type="checkbox" 
                                                checked={isChecked}
                                                disabled={boxItem.isPrepared}
                                                onChange={() => {}} 
                                                style={{ accentColor: '#10b981', marginTop: '2px', cursor: boxItem.isPrepared ? 'default' : 'pointer' }}
                                              />
                                              <span style={{ fontSize: '0.76rem', color: isChecked ? '#aaa' : '#888', fontWeight: isChecked ? 700 : 500, lineHeight: '1.3' }}>
                                                {cutter.name}
                                              </span>
                                            </div>
                                            <strong style={{ fontSize: '0.8rem', color: isChecked ? '#10b981' : '#fff', whiteSpace: 'nowrap' }}>
                                              {cutter.qty} шт
                                            </strong>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {!boxItem.isPrepared && (
                                    <button
                                      disabled={isProcessing || !canSubmit}
                                      onClick={() => handlePrepareBox(boxItem, null)}
                                      style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: canSubmit ? '#10b981' : '#1a1a1a',
                                        color: canSubmit ? '#000' : '#444',
                                        border: canSubmit ? 'none' : '1px solid #222',
                                        borderRadius: '12px',
                                        fontWeight: 900,
                                        fontSize: '0.8rem',
                                        textTransform: 'uppercase',
                                        cursor: (isProcessing || !canSubmit) ? 'not-allowed' : 'pointer',
                                        opacity: isProcessing ? 0.7 : 1,
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        marginTop: '10px'
                                      }}
                                    >
                                      <Package size={16} /> 
                                      {!isAllChecked || !isSheetChecked 
                                        ? 'Позначте всі матеріали' 
                                        : `Завершити комплектацію боксу`
                                      }
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
        })
      )}
    </div>
  )
}
