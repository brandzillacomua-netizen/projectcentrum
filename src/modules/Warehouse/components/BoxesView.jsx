import React, { useState } from 'react'
import { Package, Printer, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

// Simple and robust Code 128 barcode renderer as an inline SVG component.
const Barcode128 = ({ value, width = 2.0, height = 28 }) => {
  const patterns = [
    "11011001100", "11001101100", "11001100110", "10010011000", "10010001100", 
    "10001001100", "10011000100", "10001100100", "11001001000", "11001000100", 
    "11000100100", "10110011100", "10011011100", "10011001110", "10111001100", 
    "10011100110", "10011100100", "11100110100", "11100100110", "11100100100", 
    "11011011100", "11011001110", "11001101110", "11101111010", "11101101110", 
    "11101100110", "11100110110", "11100110010", "11011011000", "11011000110", 
    "11000110110", "11000110010", "10110111100", "10011011110", "10011001111", 
    "10111100110", "10011110110", "10011110011", "11110110100", "11110110010", 
    "11110011010", "11000111010", "11000111001", "11011111010", "11011111001", 
    "11110111010", "11110111001", "11011011110", "11011001111", "11100111110", 
    "11110011110", "11110110110", "11110110011", "11110011011", "11011111011", 
    "11110111011", "11011111010", "11011111001", "11011011110", "11011001111", 
    "11101111110", "11111011110", "11111011011", "11011001100", "11011001111", 
    "11011111011", "11110110110", "11110110011", "11110011011", "11011111011", 
    "11110111011", "11110111001", "11011011110", "11011001111", "11011111011", 
    "11110110110", "11110110011", "11110011011", "11101101111", "11101111011", 
    "11111011010", "11111011001", "11000111010", "11000111001", "11011111010", 
    "11011111001", "11110110100", "11110110010", "11110011010", "11110011001", 
    "11011011000", "11011000110", "11000110110", "11000110010", "11011001000", 
    "11011000100", "11011000100", "11110110100", "11110110010", "11011011000", 
    "11011000110", "11000110110", "11000110010", "11011110100", "11011110010", 
    "11011110110", "11101111010"
  ];
  
  const charSet = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  const startCodeB = "11010010000";
  const stopCode = "1100011101011";

  try {
    let checksum = 104;
    let barcodeString = startCodeB;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      const codeIndex = charSet.indexOf(char);
      if (codeIndex === -1) throw new Error("Invalid character for Code 128");
      
      checksum += codeIndex * (i + 1);
      barcodeString += patterns[codeIndex];
    }

    const checksumModulo = checksum % 103;
    barcodeString += patterns[checksumModulo];
    barcodeString += stopCode;

    const totalBars = barcodeString.length;
    const svgWidth = totalBars * width + 30; // 15px margin left & right for quiet zone

    return (
      <svg width={svgWidth} height={height} viewBox={`0 0 ${svgWidth} ${height}`} style={{ display: 'block', background: '#fff' }}>
        {barcodeString.split('').map((char, index) => {
          if (char === '1') {
            return (
              <rect
                key={index}
                x={index * width + 15}
                y={0}
                width={width}
                height={height}
                fill="#000000"
              />
            )
          }
          return null
        })}
      </svg>
    )
  } catch (err) {
    return <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>Err</span>
  }
}

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
  const [boxNumberState, setBoxNumberState] = useState({}) 
  const [checkedSheets, setCheckedSheets] = useState({}) 
  
  const [maxGeneratedBox, setMaxGeneratedBox] = useState(() => {
    const saved = localStorage.getItem('centrum_max_box_number')
    return saved ? parseInt(saved, 10) : 10
  })
  
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printFrom, setPrintFrom] = useState(1)
  const [printTo, setPrintTo] = useState(() => {
    const saved = localStorage.getItem('centrum_max_box_number')
    return saved ? parseInt(saved, 10) : 10
  })
  const [isPrintingMode, setIsPrintingMode] = useState(false)
  const [activePrintTab, setActivePrintTab] = useState('reprint') // 'reprint' or 'generate'
  const [newBoxesQty, setNewBoxesQty] = useState(10)

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
                      orderNum.toLowerCase().includes(search) ||
                      (box.card.box_number && box.card.box_number.toLowerCase().includes(search))
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

  const printItems = []
  if (isPrintingMode) {
    const fromVal = Math.max(1, Number(printFrom) || 1)
    const toVal = Math.min(1000, Number(printTo) || 1000)
    for (let i = fromVal; i <= toVal; i++) {
      const formattedNum = String(i).padStart(4, '0')
      printItems.push({
        box_number: i,
        barcode: formattedNum // only code the number (e.g. '0005') for thicker, high-readability bars
      })
    }
  }

  const triggerPrint = () => {
    setTimeout(() => {
      window.print()
      setIsPrintingMode(false)
    }, 500)
  }

  if (isPrintingMode) {
    return (
      <div className="barcode-only-print-page" style={{ background: '#fff', color: '#000', minHeight: '100vh', padding: '0px' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            .barcode-only-print-page, .barcode-only-print-page * {
              visibility: visible !important;
            }
            .barcode-only-print-page {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: #fff !important;
            }
            .no-print, .no-print * {
              visibility: hidden !important;
              display: none !important;
              height: 0 !important;
            }
          }
        `}} />

        <div className="no-print" style={{ marginBottom: '15px', display: 'flex', gap: '10px', padding: '10px' }}>
          <button 
            onClick={triggerPrint}
            style={{ padding: '8px 16px', background: '#10b981', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ДРУКУВАТИ ЗАРАЗ
          </button>
          <button 
            onClick={() => setIsPrintingMode(false)}
            style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem' }}
          >
            СКАСУВАТИ
          </button>
        </div>

        {/* Barcode labels grid optimized for scanner readability */}
        <div className="print-area" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: '10px',
          background: '#fff',
          padding: '0px'
        }}>
          {printItems.map(item => (
            <div key={item.box_number} style={{ 
              border: '1px dashed #ccc',
              borderRadius: '4px',
              padding: '2px 8px', 
              textAlign: 'center', 
              display: 'flex', 
              flexDirection: 'row', 
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fff',
              color: '#000',
              pageBreakInside: 'avoid',
              height: '10mm',
              maxHeight: '10mm',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 1000, whiteSpace: 'nowrap', marginRight: '8px' }}>
                №{item.box_number}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#fff', overflow: 'hidden', padding: '2px 6px' }}>
                <QRCodeSVG value={`BOX-${String(item.box_number).padStart(4, '0')}`} size={32} />
              </div>
              <div style={{ fontSize: '0.55rem', fontWeight: 900, whiteSpace: 'nowrap', marginLeft: '8px', letterSpacing: '0.05em' }}>
                BOX-{String(item.box_number).padStart(4, '0')}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          onClick={() => setShowPrintModal(true)}
          style={{
            background: 'rgba(255, 144, 0, 0.1)',
            border: '1px solid rgba(255, 144, 0, 0.3)',
            color: '#ff9000',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Printer size={16} /> ДРУК ШТРИХ-КОДІВ БОКСІВ
        </button>
      </div>

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
                              
                              const currentBoxNumber = boxNumberState[cardId] !== undefined 
                                ? boxNumberState[cardId] 
                                : (boxItem.card.box_number || '')

                              const canSubmit = currentBoxNumber.trim().length > 0 && isAllChecked && isSheetChecked

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
                                      {boxItem.card.box_number && (
                                        <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 900, marginTop: '4px' }}>
                                          📍 БОКС №{boxItem.card.box_number}
                                        </div>
                                      )}
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

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.68rem', color: '#888', fontWeight: 800 }}>ПРИСВОЇТИ БОКС (ШТРИХ-КОД / НОМЕР):</label>
                                    <input 
                                      type="text"
                                      placeholder="Введіть або зчитайте штрих-код боксу..."
                                      value={currentBoxNumber}
                                      disabled={boxItem.isPrepared}
                                      onChange={e => setBoxNumberState(prev => ({ ...prev, [cardId]: e.target.value }))}
                                      style={{ 
                                        background: '#000', 
                                        border: currentBoxNumber ? '1px solid #3b82f6' : '1px solid #222', 
                                        borderRadius: '10px', 
                                        padding: '10px 14px', 
                                        color: '#fff', 
                                        fontSize: '0.8rem', 
                                        outline: 'none',
                                        fontWeight: 900
                                      }}
                                    />
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
                                      onClick={() => handlePrepareBox(boxItem, currentBoxNumber)}
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
                                      {!currentBoxNumber.trim() 
                                        ? 'Введіть номер боксу' 
                                        : !isAllChecked || !isSheetChecked 
                                          ? 'Позначте всі матеріали' 
                                          : `Завершити комплектацію боксу №${currentBoxNumber}`
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

      {/* Barcodes Printing Modal Dialog */}
      {showPrintModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#ff9000', margin: 0 }}>ДРУК ЕТИКЕТОК БОКСІВ</h3>
              <button onClick={() => setShowPrintModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Tabs selector */}
            <div style={{ display: 'flex', gap: '5px', background: '#000', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => setActivePrintTab('reprint')}
                style={{
                  flex: 1,
                  padding: '10px 5px',
                  background: activePrintTab === 'reprint' ? '#111' : 'transparent',
                  color: activePrintTab === 'reprint' ? '#ff9000' : '#888',
                  border: activePrintTab === 'reprint' ? '1px solid #222' : 'none',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ПЕРЕДРУК
              </button>
              <button
                onClick={() => setActivePrintTab('generate')}
                style={{
                  flex: 1,
                  padding: '10px 5px',
                  background: activePrintTab === 'generate' ? '#111' : 'transparent',
                  color: activePrintTab === 'generate' ? '#ff9000' : '#888',
                  border: activePrintTab === 'generate' ? '1px solid #222' : 'none',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                СТВОРИТИ НОВІ
              </button>
            </div>
            
            {activePrintTab === 'reprint' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.65rem', color: '#888', fontWeight: 800 }}>ДІАПАЗОН БОКСІВ ВІД:</label>
                  <input 
                    type="number"
                    min="1"
                    max={maxGeneratedBox}
                    value={printFrom}
                    onChange={e => setPrintFrom(Math.max(1, Math.min(maxGeneratedBox, Number(e.target.value) || 1)))}
                    style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.65rem', color: '#888', fontWeight: 800 }}>ДІАПАЗОН БОКСІВ ДО (макс. {maxGeneratedBox}):</label>
                  <input 
                    type="number"
                    min="1"
                    max={maxGeneratedBox}
                    value={printTo}
                    onChange={e => setPrintTo(Math.max(1, Math.min(maxGeneratedBox, Number(e.target.value) || 1)))}
                    style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>

                <button
                  onClick={() => {
                    setShowPrintModal(false)
                    setIsPrintingMode(true)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#ff9000',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    marginTop: '5px'
                  }}
                >
                  ПЕРЕДРУКУВАТИ БОКСИ {printFrom}-{printTo}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
                <div style={{ background: '#080808', padding: '12px', borderRadius: '10px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 800 }}>ВЖЕ СТВОРЕНО БОКСІВ:</div>
                  <div style={{ fontSize: '1.4rem', color: '#10b981', fontWeight: 950, marginTop: '2px' }}>{maxGeneratedBox} шт</div>
                  <div style={{ fontSize: '0.62rem', color: '#555', marginTop: '4px', fontWeight: 700 }}>Наступний бокс буде мати номер {maxGeneratedBox + 1}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.65rem', color: '#888', fontWeight: 800 }}>СКІЛЬКИ НОВИХ БОКСІВ СТВОРИТИ?</label>
                  <input 
                    type="number"
                    min="1"
                    max="100"
                    value={newBoxesQty}
                    onChange={e => setNewBoxesQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>

                <button
                  onClick={() => {
                    const qty = Math.max(1, Number(newBoxesQty) || 1)
                    const startNum = maxGeneratedBox + 1
                    const endNum = maxGeneratedBox + qty
                    localStorage.setItem('centrum_max_box_number', endNum)
                    setMaxGeneratedBox(endNum)
                    
                    setPrintFrom(startNum)
                    setPrintTo(endNum)
                    
                    setShowPrintModal(false)
                    setIsPrintingMode(true)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#10b981',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    marginTop: '5px'
                  }}
                >
                  ЗГЕНЕРУВАТИ ТА НАДРУКУВАТИ БОКСИ {maxGeneratedBox + 1}-{maxGeneratedBox + Number(newBoxesQty)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
