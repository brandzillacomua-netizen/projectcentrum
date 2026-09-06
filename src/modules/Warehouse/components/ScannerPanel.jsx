import React, { useEffect, useRef, useState } from 'react'
import { QrCode, X, Keyboard } from 'lucide-react'
import { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'

export const ScannerPanel = ({
  isScanning,
  setIsScanning,
  manualCardInput,
  setManualCardInput,
  handleCardScan,
  color = '#ff9000'
}) => {
  const [localError, setLocalError] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const scanHandledRef = useRef(false)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    if (!isScanning) return

    let timer = null
    scanHandledRef.current = false

    const fixVideoStyles = () => {
      const videoEl = document.querySelector('#warehouse-reader video')
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true')
        videoEl.setAttribute('webkit-playsinline', 'true')
        videoEl.setAttribute('muted', 'true')
        videoEl.style.setProperty('width', '100%', 'important')
        videoEl.style.setProperty('height', '100%', 'important')
        videoEl.style.setProperty('min-height', '280px', 'important')
        videoEl.style.setProperty('object-fit', 'cover', 'important')
        videoEl.style.setProperty('border-radius', '18px', 'important')
        videoEl.play().catch(() => {})
      }
    }

    const startScanner = async () => {
      if (!window.Html5Qrcode) {
        console.error('Html5Qrcode not loaded')
        setLocalError('Бібліотека сканування не завантажена. Оновіть сторінку.')
        return
      }

      const el = document.getElementById('warehouse-reader')
      if (!el) {
        timer = setTimeout(startScanner, 50)
        return
      }

      // Cleanup any previous instance
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop().catch(() => {})
          }
        } catch (e) {}
        html5QrCodeRef.current = null
      }
      el.innerHTML = ''

      const onScanSuccess = async (decodedText) => {
        if (scanHandledRef.current) return
        scanHandledRef.current = true

        triggerHapticAudioFeedback(true)

        let cardId = decodedText.trim()
        if (cardId.startsWith('CENTRUM_CARD_')) {
          cardId = cardId.replace('CENTRUM_CARD_', '').trim()
        }

        try {
          if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop().catch(() => {})
          }
          setIsScanning(false)
          await Promise.resolve(handleCardScan(cardId))
        } catch (err) {
          console.error('Card scan handler error:', err)
          triggerHapticAudioFeedback(false)
          setLocalError(err?.message || String(err))
          scanHandledRef.current = false
        }
      }

      // Dynamic qrbox to NEVER exceed video dimensions
      const config = { 
        fps: 15, 
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth || 300, viewfinderHeight || 300)
          const size = Math.max(160, Math.floor(minEdge * 0.7))
          return { width: size, height: size }
        },
        aspectRatio: 1.0
      }

      try {
        const qr = new window.Html5Qrcode('warehouse-reader')
        html5QrCodeRef.current = qr

        let started = false

        // Attempt 1: Standard Environment Camera (Back Camera)
        try {
          await qr.start({ facingMode: 'environment' }, config, onScanSuccess)
          started = true
        } catch (e1) {
          console.warn('Attempt 1 (environment) failed:', e1)
        }

        // Attempt 2: User Camera (Front Camera / Webcam)
        if (!started) {
          try {
            await qr.start({ facingMode: 'user' }, config, onScanSuccess)
            started = true
          } catch (e2) {
            console.warn('Attempt 2 (user) failed:', e2)
          }
        }

        // Attempt 3: Enumerated Camera List
        if (!started) {
          try {
            const cameras = await window.Html5Qrcode.getCameras()
            if (cameras && cameras.length > 0) {
              const camId = cameras[cameras.length - 1].id
              await qr.start(camId, config, onScanSuccess)
              started = true
            }
          } catch (e3) {
            console.warn('Attempt 3 (getCameras) failed:', e3)
          }
        }

        if (!started) {
          throw new Error('Не вдалося запустити жодну камеру на пристрої. Перевірте дозволи камери у браузері.')
        }

        setTimeout(fixVideoStyles, 50)
        setTimeout(fixVideoStyles, 200)
        setTimeout(fixVideoStyles, 500)
      } catch (err) {
        console.error('Scanner start error:', err)
        setLocalError(err?.message || String(err))
      }
    }

    setLocalError(null)
    setShowManual(false)
    if (typeof setManualCardInput === 'function') setManualCardInput('')

    timer = setTimeout(startScanner, 100)

    return () => {
      clearTimeout(timer)
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              try {
                const videoEl = document.querySelector('#warehouse-reader video')
                if (videoEl && videoEl.srcObject) {
                  videoEl.srcObject.getTracks().forEach(track => track.stop())
                }
              } catch (e) {}
            }).catch(() => {})
          }
        } catch (e) {}
        html5QrCodeRef.current = null
      }
    }
  }, [isScanning])

  if (!isScanning) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px' }}>
      <style>{`
        #warehouse-reader video {
          width: 100% !important;
          height: 100% !important;
          min-height: 280px !important;
          max-height: 360px !important;
          object-fit: cover !important;
          border-radius: 18px !important;
        }
        #warehouse-reader img[alt="Info icon"] {
          display: none !important;
        }
      `}</style>
      <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '18px 20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: color, fontWeight: 900, fontSize: '0.9rem' }}>
            <QrCode size={18} /> СКАНУВАННЯ РОБОЧОЇ КАРТКИ
          </div>
          <button type="button" onClick={() => setIsScanning(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}><X size={22} /></button>
        </div>

        {/* Body */}
        {localError || showManual ? (
          <div style={{ padding: '30px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>📷</div>
            {localError && (
              <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.4, maxWidth: '320px' }}>
                {localError}
              </div>
            )}
            <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 700, maxWidth: '320px', lineHeight: 1.5 }}>
              Введіть номер або ID картки вручну:
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
                placeholder="Введіть ID або номер картки..."
                style={{ flex: 1, padding: '12px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '12px', fontSize: '0.85rem', outline: 'none', fontWeight: 700 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => { 
                  if (manualCardInput.trim()) { 
                    setIsScanning(false); 
                    triggerHapticAudioFeedback(true);
                    handleCardScan(manualCardInput.trim()) 
                  } 
                }}
                style={{ padding: '12px 18px', background: color, color: '#000', border: 'none', borderRadius: '12px', fontWeight: 1000, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ОК
              </button>
            </div>
            {showManual && localError === null && (
              <button
                type="button"
                onClick={() => setShowManual(false)}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.75rem', cursor: 'pointer', marginTop: '10px', textDecoration: 'underline' }}
              >
                ← Повернутися до камери
              </button>
            )}
          </div>
        ) : (
          <>
            <div 
              onClick={() => {
                const videoEl = document.querySelector('#warehouse-reader video')
                if (videoEl) videoEl.play().catch(() => {})
              }}
              style={{ padding: '12px', position: 'relative', background: '#000', minHeight: '290px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <div id="warehouse-reader" style={{ width: '100%', minHeight: '280px', height: '100%', border: 'none', borderRadius: '18px', overflow: 'hidden' }} />
            </div>
            <div style={{ padding: '14px 20px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161616', borderTop: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>
                Наведіть камеру на QR-код
              </span>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                style={{ background: '#222', border: '1px solid #333', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Keyboard size={14} /> Ввести ID вручну
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
