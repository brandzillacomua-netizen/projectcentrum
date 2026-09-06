import React, { useEffect } from 'react'
import { QrCode, X } from 'lucide-react'
import { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'

export function WarehouseScannerModal({
  isScanning, setIsScanning,
  cameraError, setCameraError,
  manualCardInput, setManualCardInput,
  handleCardScan
}) {
  useEffect(() => {
    if (!isScanning) return
    let html5QrCode = null
    let timer = null
    const startScanner = () => {
      if (!window.Html5Qrcode) {
        console.error('Html5Qrcode not loaded')
        setIsScanning(false)
        return
      }
      const el = document.getElementById('warehouse-reader')
      if (!el) {
        console.error('warehouse-reader element not found in DOM')
        setIsScanning(false)
        return
      }
      try {
        html5QrCode = new window.Html5Qrcode('warehouse-reader')
        const config = { fps: 15, qrbox: { width: 260, height: 260 } }
        html5QrCode.start(
          { facingMode: 'environment' }, config, async (decodedText) => {
            let cardId = decodedText.trim()
            if (cardId.startsWith('CENTRUM_CARD_')) {
              cardId = cardId.replace('CENTRUM_CARD_', '').trim()
            }
            triggerHapticAudioFeedback(true)
            if (html5QrCode && html5QrCode.isScanning) {
              await html5QrCode.stop().catch(() => {})
              html5QrCode = null
            }
            setIsScanning(false)
            handleCardScan(cardId)
          }
        ).catch(err => {
          console.error('Scanner start error:', err)
          setCameraError(err?.message || String(err))
        })
      } catch (err) {
        console.error('Html5Qrcode init error:', err)
        setIsScanning(false)
      }
    }
    setCameraError(null)
    setManualCardInput('')
    timer = setTimeout(startScanner, 150)
    return () => {
      clearTimeout(timer)
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {})
      }
    }
  }, [isScanning])

  if (!isScanning) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifycontent: 'center', zIndex: 10050, padding: '20px' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 'auto' }}>
        <div style={{ padding: '20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff9000', fontWeight: 900, fontSize: '0.9rem' }}>
            <QrCode size={18} /> СКАНУВАННЯ РОБОЧОЇ КАРТКИ
          </div>
          <button onClick={() => setIsScanning(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        {cameraError ? (
          <div style={{ padding: '30px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem' }}>📷</div>
            <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.85rem' }}>Камера недоступна</div>
            <div style={{ color: '#555', fontSize: '0.75rem', maxWidth: '320px', lineHeight: 1.5 }}>
              Браузер заблокував доступ до камери. Введіть ID картки вручну:
            </div>
            <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '340px' }}>
              <input
                type="text"
                value={manualCardInput}
                onChange={e => setManualCardInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualCardInput.trim()) {
                    setIsScanning(false)
                    triggerHapticAudioFeedback(true)
                    handleCardScan(manualCardInput.trim())
                  }
                }}
                placeholder="Введіть UUID картки..."
                style={{ flex: 1, padding: '10px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
                autoFocus
              />
              <button
                onClick={() => { 
                  if (manualCardInput.trim()) { 
                    setIsScanning(false); 
                    triggerHapticAudioFeedback(true);
                    handleCardScan(manualCardInput.trim()) 
                  } 
                }}
                style={{ padding: '10px 16px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: 0, position: 'relative', background: '#000', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div id="warehouse-reader" style={{ width: '100%', border: 'none' }} />
            </div>
            <div style={{ padding: '18px', textAlign: 'center', fontSize: '0.75rem', color: '#555' }}>
              Наведіть камеру на QR-код виробничої картки
            </div>
          </>
        )}
      </div>
    </div>
  )
}
