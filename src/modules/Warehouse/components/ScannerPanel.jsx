import React, { useEffect, useRef, useState, useCallback } from 'react'
import { QrCode, X, Keyboard, Zap, RefreshCw } from 'lucide-react'
import { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'

// Helper to ensure html5-qrcode library is available
const loadScannerLib = async () => {
  if (window.Html5Qrcode) {
    return window.Html5Qrcode
  }
  try {
    const mod = await import('html5-qrcode')
    window.Html5Qrcode = mod.Html5Qrcode
    return mod.Html5Qrcode
  } catch (err) {
    console.error('[ScannerPanel] Failed to load html5-qrcode dynamically:', err)
    throw new Error('Бібліотека сканування не завантажена. Перевірте підключення до інтернету.')
  }
}

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
  const [isCameraLoading, setIsCameraLoading] = useState(true)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const scanHandledRef = useRef(false)
  const html5QrCodeRef = useRef(null)
  const activeTrackRef = useRef(null)
  const handleCardScanRef = useRef(handleCardScan)
  handleCardScanRef.current = handleCardScan

  const setIsScanningRef = useRef(setIsScanning)
  setIsScanningRef.current = setIsScanning

  const setManualCardInputRef = useRef(setManualCardInput)
  setManualCardInputRef.current = setManualCardInput

  const stopScanner = useCallback(async () => {
    try {
      if (activeTrackRef.current) {
        activeTrackRef.current.stop()
        activeTrackRef.current = null
      }
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop().catch(() => {})
        }
        html5QrCodeRef.current = null
      }
      const videoEl = document.querySelector('#warehouse-reader video')
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject
        stream.getTracks().forEach(t => t.stop())
        videoEl.srcObject = null
      }
    } catch (e) {
      console.warn('[ScannerPanel] Cleanup error:', e)
    }
  }, [])

  const fixVideoStyles = useCallback(() => {
    const videoEl = document.querySelector('#warehouse-reader video')
    if (videoEl) {
      videoEl.setAttribute('autoplay', 'true')
      videoEl.setAttribute('playsinline', 'true')
      videoEl.setAttribute('webkit-playsinline', 'true')
      videoEl.setAttribute('muted', 'true')
      videoEl.muted = true
      videoEl.style.setProperty('width', '100%', 'important')
      videoEl.style.setProperty('height', '100%', 'important')
      videoEl.style.setProperty('min-height', '280px', 'important')
      videoEl.style.setProperty('max-height', '360px', 'important')
      videoEl.style.setProperty('object-fit', 'cover', 'important')
      videoEl.style.setProperty('border-radius', '18px', 'important')
      videoEl.play().catch(() => {})

      try {
        const stream = videoEl.srcObject
        const track = stream?.getVideoTracks?.()[0]
        if (track) {
          activeTrackRef.current = track
          const capabilities = track.getCapabilities ? track.getCapabilities() : {}
          if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
          }
          setTorchAvailable(Boolean(capabilities.torch))
        }
      } catch (e) {}
    }
  }, [])

  const toggleTorch = async () => {
    if (!activeTrackRef.current || !torchAvailable) return
    try {
      const nextState = !torchOn
      await activeTrackRef.current.applyConstraints({
        advanced: [{ torch: nextState }]
      })
      setTorchOn(nextState)
    } catch (err) {
      console.warn('[ScannerPanel] Torch toggle failed:', err)
    }
  }

  const startCamera = useCallback(async () => {
    setIsCameraLoading(true)
    setLocalError(null)
    scanHandledRef.current = false

    const el = document.getElementById('warehouse-reader')
    if (!el) {
      setTimeout(startCamera, 50)
      return
    }

    try {
      const Html5Qrcode = await loadScannerLib()

      await stopScanner()
      el.innerHTML = ''

      const qr = new Html5Qrcode('warehouse-reader', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Native hardware acceleration on Android
        },
        verbose: false
      })
      html5QrCodeRef.current = qr

      const onScanSuccess = async (decodedText) => {
        if (scanHandledRef.current) return
        scanHandledRef.current = true

        try {
          triggerHapticAudioFeedback(true)
        } catch (audioErr) {
          console.warn('[ScannerPanel] Audio/haptic feedback error:', audioErr)
        }

        let cardId = String(decodedText || '').trim()
        if (cardId.startsWith('CENTRUM_CARD_')) {
          cardId = cardId.replace('CENTRUM_CARD_', '').trim()
        }

        try {
          await stopScanner()
          if (typeof setIsScanningRef.current === 'function') {
            setIsScanningRef.current(false)
          }
          if (typeof handleCardScanRef.current === 'function') {
            await Promise.resolve(handleCardScanRef.current(cardId))
          }
        } catch (err) {
          console.error('[ScannerPanel] Card scan handler error:', err)
          try {
            triggerHapticAudioFeedback(false)
          } catch {}
          setLocalError(err?.message || String(err))
          scanHandledRef.current = false
        }
      }

      // Optimized for mobile iOS Safari & Android:
      // - 12 fps: eliminates iOS Safari JS CPU lockup while maintaining instant detection
      // - Native portrait videoConstraints: eliminates 90-degree frame rotation on iOS Safari
      // - Full frame decode without qrbox crop: immune to object-fit: cover coordinate mismatch
      const config = {
        fps: 12,
        videoConstraints: {
          facingMode: { ideal: 'environment' }
        }
      }

      let started = false

      // Priority 1: Request rear camera via facingMode: 'environment'
      try {
        await qr.start({ facingMode: 'environment' }, config, onScanSuccess)
        started = true
      } catch (e1) {
        console.warn('[ScannerPanel] { facingMode: "environment" } failed, trying rear camera by device ID:', e1)
      }

      // Priority 2: Direct rear camera ID from device list
      if (!started) {
        try {
          const cams = await Html5Qrcode.getCameras()
          if (cams && cams.length > 0) {
            const rearCams = cams.filter(c => {
              const lbl = (c.label || '').toLowerCase()
              if (lbl.includes('front') || lbl.includes('user') || lbl.includes('передн') || lbl.includes('selfie') || lbl.includes('face')) {
                return false
              }
              return true
            })

            const targetCam = rearCams.find(c => {
              const lbl = (c.label || '').toLowerCase()
              return lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment') || lbl.includes('задн') || lbl.includes('0') || lbl.includes('main')
            }) || rearCams[rearCams.length - 1] || cams[cams.length - 1]

            if (targetCam) {
              await qr.start(targetCam.id, config, onScanSuccess)
              started = true
            }
          }
        } catch (e2) {
          console.warn('[ScannerPanel] Enumerated camera start failed:', e2)
        }
      }

      if (!started) {
        throw new Error('Не вдалося відкрити задню камеру. Перевірте дозволи на доступ до камери у налаштуваннях браузера.')
      }

      setIsCameraLoading(false)
      fixVideoStyles()
      setTimeout(fixVideoStyles, 80)
      setTimeout(fixVideoStyles, 250)
      setTimeout(fixVideoStyles, 600)
    } catch (err) {
      console.error('[ScannerPanel] Scanner startup failed:', err)
      setIsCameraLoading(false)
      setLocalError(err?.message || 'Не вдалося підключити задню камеру. Перевірте дозволи у браузері.')
    }
  }, [stopScanner, fixVideoStyles])

  // Camera runs STRICTLY while isScanning is true, immune to parent re-renders
  useEffect(() => {
    if (!isScanning) return

    setShowManual(false)
    if (typeof setManualCardInputRef.current === 'function') {
      setManualCardInputRef.current('')
    }

    const t = setTimeout(() => {
      startCamera()
    }, 20)

    return () => {
      clearTimeout(t)
      stopScanner()
    }
  }, [isScanning]) // MUST ONLY DEPEND ON isScanning!

  if (!isScanning) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '16px' }}>
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
        @keyframes scanLaser {
          0% { top: 15%; opacity: 0.3; }
          50% { top: 85%; opacity: 1; }
          100% { top: 15%; opacity: 0.3; }
        }
        .scanner-laser-line {
          position: absolute;
          left: 12%;
          right: 12%;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${color}, #ffffff, ${color}, transparent);
          box-shadow: 0 0 10px ${color};
          animation: scanLaser 2s ease-in-out infinite;
          pointer-events: none;
          z-index: 5;
        }
        @keyframes spinFast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .scanner-spin {
          animation: spinFast 1s linear infinite;
        }
      `}</style>
      <div style={{ background: 'var(--surface-1, #18181b)', width: '100%', maxWidth: '440px', borderRadius: '24px', border: '1px solid var(--border-subtle, #27272a)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: 'var(--surface-2, #202023)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle, #27272a)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: color, fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.02em' }}>
            <QrCode size={19} /> СКАНУВАННЯ РОБОЧОЇ КАРТКИ
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {torchAvailable && !localError && !showManual && (
              <button
                type="button"
                onClick={toggleTorch}
                title={torchOn ? 'Вимкнути ліхтарик' : 'Увімкнути ліхтарик'}
                style={{
                  background: torchOn ? color : 'var(--surface-3, #2d2d32)',
                  color: torchOn ? '#000' : 'var(--text-strong, #fff)',
                  border: '1px solid var(--border-subtle, #3f3f46)',
                  borderRadius: '10px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Zap size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScanning(false)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Body */}
        {localError || showManual ? (
          <div style={{ padding: '30px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>📷</div>
            {localError && (
              <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.4, maxWidth: '320px', background: '#ef444415', padding: '10px 14px', borderRadius: '12px', border: '1px solid #ef444430' }}>
                {localError}
              </div>
            )}
            <div style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.82rem', fontWeight: 700, maxWidth: '320px', lineHeight: 1.5 }}>
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
                style={{ flex: 1, padding: '12px 14px', background: 'var(--surface-black, #09090b)', border: '1px solid var(--border-subtle, #27272a)', color: 'var(--text-strong, #fff)', borderRadius: '12px', fontSize: '0.88rem', outline: 'none', fontWeight: 700 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCardInput.trim()) {
                    setIsScanning(false)
                    triggerHapticAudioFeedback(true)
                    handleCardScan(manualCardInput.trim())
                  }
                }}
                style={{ padding: '12px 18px', background: color, color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                ОК
              </button>
            </div>
            {localError && (
              <button
                type="button"
                onClick={() => startCamera()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-3, #2d2d32)', border: '1px solid var(--border-subtle, #3f3f46)', color: 'var(--text-strong, #fff)', padding: '8px 16px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}
              >
                <RefreshCw size={14} /> Спробувати камеру ще раз
              </button>
            )}
            {showManual && localError === null && (
              <button
                type="button"
                onClick={() => setShowManual(false)}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.78rem', cursor: 'pointer', marginTop: '6px', textDecoration: 'underline' }}
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
              style={{ padding: '12px', position: 'relative', background: '#000', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {/* Laser Line */}
              <div className="scanner-laser-line" />

              {/* Viewfinder Target Reticle */}
              <div style={{
                position: 'absolute',
                width: '240px',
                height: '240px',
                border: `2px solid ${color}50`,
                borderRadius: '20px',
                boxShadow: `inset 0 0 15px ${color}15`,
                pointerEvents: 'none',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ position: 'absolute', top: -2, left: -2, width: 22, height: 22, borderTop: `4px solid ${color}`, borderLeft: `4px solid ${color}`, borderTopLeftRadius: 12 }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderTop: `4px solid ${color}`, borderRight: `4px solid ${color}`, borderTopRightRadius: 12 }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: 22, height: 22, borderBottom: `4px solid ${color}`, borderLeft: `4px solid ${color}`, borderBottomLeftRadius: 12 }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderBottom: `4px solid ${color}`, borderRight: `4px solid ${color}`, borderBottomRightRadius: 12 }} />
              </div>

              {/* Behind-video Loading Indicator (never blocks video) */}
              {isCameraLoading && (
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#888', pointerEvents: 'none' }}>
                  <RefreshCw size={24} className="scanner-spin" style={{ color }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>Підключення камери...</span>
                </div>
              )}

              <div id="warehouse-reader" style={{ width: '100%', minHeight: '280px', height: '100%', border: 'none', borderRadius: '18px', overflow: 'hidden' }} />
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2, #202023)', borderTop: '1px solid var(--border-subtle, #27272a)' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 700 }}>
                Наведіть задню камеру на QR або штрихкод
              </span>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                style={{ background: 'var(--surface-3, #2d2d32)', border: '1px solid var(--border-subtle, #3f3f46)', color: 'var(--text-strong, #fff)', padding: '7px 14px', borderRadius: '10px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Keyboard size={14} /> Ввести вручну
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
