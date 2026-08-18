import React, { useState, useEffect } from 'react'
import { X, Package } from 'lucide-react'

export const KittingModal = ({
  kittingBoxItem,
  setKittingBoxItem,
  checkedCutters,
  handleToggleCutterCheck,
  handlePrepareBox,
  isProcessing
}) => {
  if (!kittingBoxItem) return null

  const { card, cutters, activeMaterialName, cardSheets, nom } = kittingBoxItem
  const cardId = card.id
  const cardNum = card.card_info?.split(' ')[0] || `№${cardId.substring(0, 8)}`
  const cardNomName = nom?.name || card.name || 'Номенклатура не вказана'

  // Verify all cutters are checked
  const isAllCuttersChecked = cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])
  const canSubmit = isAllCuttersChecked

  const handleSubmit = async () => {
    if (!canSubmit) return
    await handlePrepareBox(kittingBoxItem, null)
    setKittingBoxItem(null)
  }

  const handleCloseModal = () => {
    setKittingBoxItem(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Modal Header */}
        <div style={{ padding: '20px 25px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff9000', fontWeight: 900, fontSize: '0.95rem' }}>
              📦 КОМПЛЕКТУВАННЯ НОВОГО БОКСУ
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px', fontWeight: 700 }}>
              Для Картки {cardNum}
            </div>
          </div>
          <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '450px', overflowY: 'auto' }}>
          
          {/* Machine Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#090909', padding: '12px 15px', borderRadius: '14px', border: '1px solid #151515' }}>
            <div style={{ gridColumn: '1 / -1', paddingBottom: '10px', borderBottom: '1px solid #181818' }}>
              <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>ВИКОНУЄТЬСЯ В КАРТЦІ</div>
              <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, marginTop: '4px', lineHeight: 1.25, wordBreak: 'break-word' }}>
                {cardNomName}
              </div>
              <div style={{ fontSize: '0.66rem', color: '#666', fontWeight: 800, marginTop: '6px', textTransform: 'uppercase' }}>
                Матеріали: Склад оперативний
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>ВЕРСТАТ</div>
              <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 700 }}>{card.machine || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>К-СТЬ ДЕТАЛЕЙ</div>
              <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 700 }}>{card.quantity} шт</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.68rem', color: '#888', fontWeight: 800 }}>
              СПИСОК НАПОВНЕННЯ БОКСУ (ПОЗНАЧТЕ ВСЕ)
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Cutters checklist */}
              {cutters.map(cutter => {
                const isChecked = !!checkedCutters[cardId]?.[cutter.nomenclature_id]
                return (
                  <div 
                    key={cutter.nomenclature_id}
                    onClick={() => handleToggleCutterCheck(cardId, cutter.nomenclature_id)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      background: isChecked ? 'rgba(16, 185, 129, 0.04)' : '#0d0d0d', 
                      padding: '10px 14px', 
                      borderRadius: '10px', 
                      border: isChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #1e1e1e',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {}} 
                        style={{ accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.78rem', color: isChecked ? '#aaa' : '#888', fontWeight: isChecked ? 700 : 500 }}>
                        {cutter.name}
                      </span>
                    </div>
                    <strong style={{ fontSize: '0.8rem', color: isChecked ? '#10b981' : '#fff' }}>
                      {cutter.qty} шт
                    </strong>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ padding: '20px 25px', background: '#1a1a1a', display: 'flex', gap: '15px' }}>
          <button
            onClick={handleCloseModal}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', fontWeight: 900, cursor: 'pointer' }}
          >
            Скасувати
          </button>
          <button
            disabled={isProcessing || !canSubmit}
            onClick={handleSubmit}
            style={{ 
              flex: 2, 
              padding: '12px', 
              borderRadius: '10px', 
              background: canSubmit ? '#10b981' : '#1a1a1a', 
              color: canSubmit ? '#000' : '#444', 
              border: 'none', 
              fontWeight: 900, 
              cursor: canSubmit ? 'pointer' : 'not-allowed', 
              opacity: isProcessing ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Package size={16} /> 
            {isProcessing ? 'ОБРОБКА...' : 'ЗАВЕРШИТИ ЗБІРКУ'}
          </button>
        </div>

      </div>
    </div>
  )
}
