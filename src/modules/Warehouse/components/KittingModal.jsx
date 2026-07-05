import React, { useState, useEffect, useRef } from 'react'
import { X, Package, RotateCcw, QrCode } from 'lucide-react'

export const KittingModal = ({
  kittingBoxItem,
  setKittingBoxItem,
  checkedCutters,
  handleToggleCutterCheck,
  handlePrepareBox,
  isProcessing
}) => {
  if (!kittingBoxItem) return null

  const { card, cutters, activeMaterialName, cardSheets } = kittingBoxItem
  const cardId = card.id
  const cardNum = card.card_info?.split(' ')[0] || `№${cardId.substring(0, 8)}`

  const [step, setStep] = useState(1) // Step 1: Scan box, Step 2: Checklist
  const [boxNum, setBoxNum] = useState('')
  const [sheetChecked, setSheetChecked] = useState(false)
  
  // Camera scanner states
  const [isScanningBox, setIsScanningBox] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  
  const inputRef = useRef(null)
  const scannerRef = useRef(null) // holds html5QrCode instance

  // Reset modal state on card change
  useEffect(() => {
    setStep(1)
    setBoxNum('')
    setSheetChecked(false)
    setIsScanningBox(false)
    setCameraError(null)
  }, [cardId])

  // Focus input automatically on Step 1 if camera is not running
  useEffect(() => {
    if (step === 1 && !isScanningBox && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus()
      }, 100)
    }
  }, [step, isScanningBox, kittingBoxItem])

  // Camera initialization and lifecycle via Html5Qrcode
  useEffect(() => {
    if (!isScanningBox) return

    let timer = null
    const startBoxScanner = () => {
      if (!window.Html5Qrcode) {
        setCameraError('Бібліотека сканування не завантажена')
        setIsScanningBox(false)
        return
      }
      
      const el = document.getElementById('kitting-box-reader')
      if (!el) {
        console.error('kitting-box-reader element not found')
        setIsScanningBox(false)
        return
      }

      try {
        const html5QrCode = new window.Html5Qrcode('kitting-box-reader')
        scannerRef.current = html5QrCode
        
        const config = { 
          fps: 25, 
          qrbox: { width: 220, height: 220 }
        }
        
        html5QrCode.start(
          { facingMode: 'environment' }, 
          config, 
          async (decodedText) => {
            const val = decodedText.trim()
            
            // If it is a work card barcode (usually starts with CENTRUM_CARD_ or is a UUID), reject it
            if (val.startsWith('CENTRUM_CARD_') || (val.length > 10 && val.includes('-') && !val.includes('BOX-'))) {
              setCameraError('Зчитано код КАРТКИ наряду! Будь ласка, скануйте QR-код БОКСУ.')
              return
            }

            const cleanBox = val.replace(/BOX-/gi, '').replace(/^0+/, '')
            const boxNumInt = parseInt(cleanBox, 10)

            if (isNaN(boxNumInt) || boxNumInt < 1 || boxNumInt > 1000) {
              setCameraError(`Зчитано некоректний бокс: "${cleanBox}". Номер має бути від 1 до 1000.`)
              return
            }

            setBoxNum(cleanBox)
            setCameraError(null)
            
            // Stop camera on success
            if (html5QrCode && html5QrCode.isScanning) {
              await html5QrCode.stop().catch(() => {})
            }
            scannerRef.current = null
            setIsScanningBox(false)
            setStep(2) // proceed to Step 2
          }
        ).catch(err => {
          console.error('Kitting scanner start error:', err)
          setCameraError(err?.message || String(err))
        })
      } catch (err) {
        console.error('Kitting Html5Qrcode init error:', err)
        setIsScanningBox(false)
      }
    }

    timer = setTimeout(startBoxScanner, 150)

    return () => {
      clearTimeout(timer)
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [isScanningBox])

  // Verify all cutters are checked
  const isAllCuttersChecked = cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])
  const canSubmit = boxNum.trim().length > 0 && isAllCuttersChecked

  const handleBoxSubmit = (e) => {
    if (e) e.preventDefault()
    if (boxNum.trim().length > 0) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
        setIsScanningBox(false)
      }
      setStep(2)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    await handlePrepareBox(kittingBoxItem, boxNum)
    setKittingBoxItem(null)
  }

  const handleCloseModal = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
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
            <div>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>ВЕРСТАТ</div>
              <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 700 }}>{card.machine || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>К-СТЬ ДЕТАЛЕЙ</div>
              <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 700 }}>{card.quantity} шт</div>
            </div>
          </div>

          {/* STEP 1: Scan physical Box barcode */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, letterSpacing: '0.03em', textAlign: 'center', marginBottom: '8px' }}>
                КРОК 1: ЗЧИТАЙТЕ ШТРИХ-КОД БОКСУ КАМЕРОЮ
              </div>

              {/* Camera Scanner Viewport */}
              {isScanningBox ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  <div 
                    id="kitting-box-reader" 
                    style={{ 
                      width: '100%', 
                      maxWidth: '320px', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      border: '2px solid #ff9000',
                      boxShadow: '0 0 20px rgba(255, 144, 0, 0.3)'
                    }} 
                  />
                  {cameraError && (
                    <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700 }}>
                      Помилка камери: {cameraError}
                    </div>
                  )}
                  <button
                    onClick={() => setIsScanningBox(false)}
                    style={{
                      padding: '8px 16px',
                      background: '#222',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ВИМКНУТИ КАМЕРУ
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCameraError(null)
                    setIsScanningBox(true)
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '24px',
                    background: 'rgba(255, 144, 0, 0.08)',
                    border: '2px dashed #ff9000',
                    borderRadius: '16px',
                    color: '#ff9000',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 144, 0, 0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 144, 0, 0.08)'}
                >
                  <QrCode size={40} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 900 }}>ВВІМКНУТИ КАМЕРУ ДЛЯ СКАНУВАННЯ</span>
                </button>
              )}

              {/* Text Fallback input */}
              {!isScanningBox && (
                <form onSubmit={handleBoxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', paddingTop: '15px', borderTop: '1px dashed #222' }}>
                  <label style={{ fontSize: '0.62rem', color: '#666', fontWeight: 800 }}>РЕЗЕРВНИЙ ВАРІАНТ (РУЧНЕ ВВЕДЕННЯ):</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      ref={inputRef}
                      type="text"
                      placeholder="Введіть номер боксу..."
                      value={boxNum}
                      onChange={e => setBoxNum(e.target.value)}
                      style={{ 
                        flex: 1,
                        background: '#000', 
                        border: '1px solid #333', 
                        borderRadius: '10px', 
                        padding: '12px 14px', 
                        color: '#fff', 
                        fontSize: '0.85rem', 
                        outline: 'none',
                        fontWeight: 900
                      }}
                    />
                    <button
                      type="submit"
                      disabled={boxNum.trim().length === 0}
                      style={{
                        padding: '0 20px',
                        background: boxNum.trim().length > 0 ? '#ff9000' : '#222',
                        color: boxNum.trim().length > 0 ? '#000' : '#555',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 900,
                        fontSize: '0.78rem',
                        cursor: boxNum.trim().length > 0 ? 'pointer' : 'not-allowed'
                      }}
                    >
                      ДАЛІ
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STEP 2: Checklist of materials */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Linked Box Indicator */}
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.08)', 
                border: '1px solid rgba(59, 130, 246, 0.2)', 
                padding: '12px 18px', 
                borderRadius: '14px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <div>
                  <div style={{ fontSize: '0.62rem', color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase' }}>ПРИКРІПЛЕНИЙ ФІЗИЧНИЙ БОКС:</div>
                  <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 950, marginTop: '2px' }}>№{boxNum.replace(/BOX-/gi, '')}</div>
                </div>
                <button 
                  onClick={() => setStep(1)} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    padding: '8px 12px', 
                    color: '#aaa', 
                    fontSize: '0.7rem', 
                    fontWeight: 800, 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <RotateCcw size={12} /> Змінити
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.68rem', color: '#888', fontWeight: 800 }}>
                  КРОК 2: СПИСОК НАПОВНЕННЯ БОКСУ (ПОЗНАЧТЕ ВСЕ)
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* (Sheets are taken directly from operational racks, only cutters are packed in the box) */}

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
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ padding: '20px 25px', background: '#1a1a1a', display: 'flex', gap: '15px' }}>
          <button
            onClick={handleCloseModal}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', fontWeight: 900, cursor: 'pointer' }}
          >
            Скасувати
          </button>
          {step === 2 && (
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
          )}
        </div>

      </div>
    </div>
  )
}
