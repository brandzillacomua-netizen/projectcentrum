import React, { useEffect, useRef, useState, useCallback } from 'react'
import { QrCode, X, Keyboard, SwitchCamera, Zap, RefreshCw } from 'lucide-react'
import { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'

const PREFERRED_CAM_STORAGE_KEY = 'centrum_preferred_cam_id'

// Helper to ensure html5-qrcode library is available without blocking initial app bundle
const loadScannerLib = async () => {
  if (window.Html5Qrcode) {
    return {
      Html5Qrcode: window.Html5Qrcode,
      formats: window.Html5QrcodeSupportedFormats || {}
    }
  }
  try {
    const mod = await import('html5-qrcode')
    window.Html5Qrcode = mod.Html5Qrcode
    window.Html5QrcodeSupportedFormats = mod.Html5QrcodeSupportedFormats
    return {
      Html5Qrcode: mod.Html5Qrcode,
      formats: mod.Html5QrcodeSupportedFormats || {}
    }
  } catch (err) {
    console.error('[ScannerPanel] Failed to load html5-qrcode dynamically:', err)
    throw new Error('Бібліотека сканування не завантажена. Перевірте зʼєднання.')
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
  const [isInitializing, setIsInitializing] = useState(true)
  const [availableCameras, setAvailableCameras] = useState([])
  const [currentCameraId, setCurrentCameraId] = useState(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const scanHandledRef = useRef(false)
  const html5QrCodeRef = useRef(null)
  const activeTrackRef = useRef(null)

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
      videoEl.setAttribute('playsinline', 'true')
      videoEl.setAttribute('webkit-playsinline', 'true')
      videoEl.setAttribute('muted', 'true')
      videoEl.style.setProperty('width', '100%', 'important')
      videoEl.style.setProperty('height', '100%', 'important')
      videoEl.style.setProperty('min-height', '280px', 'important')
      videoEl.style.setProperty('max-height', '360px', 'important')
      videoEl.style.setProperty('object-fit', 'cover', 'important')
      videoEl.style.setProperty('border-radius', '18px', 'important')
      videoEl.play().catch(() => {})

      // Check track capabilities for torch & deviceId
      try {
        const stream = videoEl.srcObject
        const track = stream?.getVideoTracks?.()[0]
        if (track) {
          activeTrackRef.current = track
          const settings = track.getSettings?.()
          if (settings?.deviceId) {
            localStorage.setItem(PREFERRED_CAM_STORAGE_KEY, settings.deviceId)
            setCurrentCameraId(settings.deviceId)
          }
          const capabilities = track.getCapabilities ? track.getCapabilities() : {}
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

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return
    const currentIdx = availableCameras.findIndex(c => c.id === currentCameraId)
    const nextIdx = (currentIdx + 1) % availableCameras.length
    const nextCam = availableCameras[nextIdx]
    if (nextCam) {
      localStorage.setItem(PREFERRED_CAM_STORAGE_KEY, nextCam.id)
      setCurrentCameraId(nextCam.id)
      await stopScanner()
      initScanner(nextCam.id)
    }
  }

  const initScanner = useCallback(async (forcedCamId = null) => {
    setIsInitializing(true)
    setLocalError(null)
    scanHandledRef.current = false

    const el = document.getElementById('warehouse-reader')
    if (!el) {
      setIsInitializing(false)
      return
    }

    try {
      const { Html5Qrcode, formats } = await loadScannerLib()

      // Stop previous instance if any
      await stopScanner()
      el.innerHTML = ''

      // Focus on QR and Code 128 (work cards, barcodes) to dramatically speed up CPU
      const supportedFormats = []
      if (formats.QR_CODE !== undefined) supportedFormats.push(formats.QR_CODE)
      if (formats.CODE_128 !== undefined) supportedFormats.push(formats.CODE_128)
      if (formats.CODE_39 !== undefined) supportedFormats.push(formats.CODE_39)
      if (formats.EAN_13 !== undefined) supportedFormats.push(formats.EAN_13)

      const qr = new Html5Qrcode('warehouse-reader', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Native hardware acceleration on Android / iOS
        },
        formatsToSupport: supportedFormats.length > 0 ? supportedFormats : undefined,
        verbose: false
      })
      html5QrCodeRef.current = qr

      const onScanSuccess = async (decodedText) => {
        if (scanHandledRef.current) return
        scanHandledRef.current = true

        triggerHapticAudioFeedback(true)

        let cardId = String(decodedText || '').trim()
        if (cardId.startsWith('CENTRUM_CARD_')) {
          cardId = cardId.replace('CENTRUM_CARD_', '').trim()
        }

        try {
          await stopScanner()
          setIsScanning(false)
          await Promise.resolve(handleCardScan(cardId))
        } catch (err) {
          console.error('[ScannerPanel] Card scan handler error:', err)
          triggerHapticAudioFeedback(false)
          setLocalError(err?.message || String(err))
          scanHandledRef.current = false
        }
      }

      // Fast, responsive viewfinder configuration
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth || 300, viewfinderHeight || 300)
          const size = Math.max(180, Math.floor(minEdge * 0.72))
          return { width: size, height: size }
        },
        aspectRatio: 1.0
      }

      // Query enumerated cameras in parallel for instant switching & fallback
      Html5Qrcode.getCameras().then(cams => {
        if (cams && cams.length > 0) {
          setAvailableCameras(cams)
        }
      }).catch(() => {})

      let started = false
      const targetCamId = forcedCamId || localStorage.getItem(PREFERRED_CAM_STORAGE_KEY)

      // Fast Attempt 1: Cached/Forced camera ID (starts in ~200ms)
      if (targetCamId) {
        try {
          await qr.start(targetCamId, config, onScanSuccess)
          started = true
          setCurrentCameraId(targetCamId)
        } catch (e1) {
          console.warn('[ScannerPanel] Cached camera start failed, trying auto-select:', e1)
          localStorage.removeItem(PREFERRED_CAM_STORAGE_KEY)
        }
      }

      // Fast Attempt 2: Soft environment constraint with 720p resolution limit
      if (!started) {
        try {
          await qr.start(
            {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            },
            config,
            onScanSuccess
          )
          started = true
        } catch (e2) {
          console.warn('[ScannerPanel] Environment camera start failed:', e2)
        }
      }

      // Fast Attempt 3: Enumerated cameras, prioritize rear/back
      if (!started) {
        try {
          const cams = await Html5Qrcode.getCameras()
          if (cams && cams.length > 0) {
            setAvailableCameras(cams)
            const rearCam = cams.slice().reverse().find(c => {
              const lbl = (c.label || '').toLowerCase()
              return lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment') || lbl.includes('задн') || lbl.includes('0')
            }) || cams[cams.length - 1]

            await qr.start(rearCam.id, config, onScanSuccess)
            started = true
            setCurrentCameraId(rearCam.id)
            localStorage.setItem(PREFERRED_CAM_STORAGE_KEY, rearCam.id)
          }
        } catch (e3) {
          console.warn('[ScannerPanel] Enumerated camera start failed:', e3)
        }
      }

      // Fast Attempt 4: Fallback to user camera or default
      if (!started) {
        await qr.start({ facingMode: 'user' }, config, onScanSuccess)
        started = true
      }

      setIsInitializing(false)
      fixVideoStyles()
      setTimeout(fixVideoStyles, 80)
      setTimeout(fixVideoStyles, 250)
    } catch (err) {
      console.error('[ScannerPanel] Scanner startup failed:', err)
      setIsInitializing(false)
      setLocalError(err?.message || 'Не вдалося підключити камеру. Перевірте дозволи у браузері.')
    }
  }, [handleCardScan, setIsScanning, stopScanner, fixVideoStyles])

  useEffect(() => {
    if (!isScanning) return

    setShowManual(false)
    if (typeof setManualCardInput === 'function') setManualCardInput('')

    // Start scanner immediately on next tick after modal DOM renders
    const t = setTimeout(() => {
      initScanner()
    }, 20)

    return () => {
      clearTimeout(t)
      stopScanner()
    }
  }, [isScanning, initScanner, setManualCardInput, stopScanner])

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
          0% { top: 12%; opacity: 0.3; }
          50% { top: 88%; opacity: 1; }
          100% { top: 12%; opacity: 0.3; }
        }
        .scanner-laser-line {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${color}, #ffffff, ${color}, transparent);
          box-shadow: 0 0 12px ${color};
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
            {availableCameras.length > 1 && !localError && !showManual && (
              <button
                type="button"
                onClick={switchCamera}
                title="Перемкнути камеру"
                style={{
                  background: 'var(--surface-3, #2d2d32)',
                  color: 'var(--text-strong, #fff)',
                  border: '1px solid var(--border-subtle, #3f3f46)',
                  borderRadius: '10px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SwitchCamera size={16} />
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
                onClick={() => initScanner()}
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
              style={{ padding: '12px', position: 'relative', background: 'var(--surface-black, #09090b)', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {/* Dynamic Laser Reticle */}
              {!isInitializing && <div className="scanner-laser-line" />}

              {/* Viewfinder Target HUD Box */}
              {!isInitializing && (
                <div style={{
                  position: 'absolute',
                  width: '220px',
                  height: '220px',
                  border: `2px solid ${color}60`,
                  borderRadius: '20px',
                  boxShadow: `inset 0 0 15px ${color}20`,
                  pointerEvents: 'none',
                  zIndex: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* Viewfinder corner brackets */}
                  <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: `4px solid ${color}`, borderLeft: `4px solid ${color}`, borderTopLeftRadius: 10 }} />
                  <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: `4px solid ${color}`, borderRight: `4px solid ${color}`, borderTopRightRadius: 10 }} />
                  <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: `4px solid ${color}`, borderLeft: `4px solid ${color}`, borderBottomLeftRadius: 10 }} />
                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: `4px solid ${color}`, borderRight: `4px solid ${color}`, borderBottomRightRadius: 10 }} />
                </div>
              )}

              {/* Instant Loading State */}
              {isInitializing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 10, background: 'var(--surface-black, #09090b)' }}>
                  <RefreshCw size={28} className="scanner-spin" style={{ color }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 800, letterSpacing: '0.03em' }}>
                    Запуск камери...
                  </span>
                </div>
              )}

              <div id="warehouse-reader" style={{ width: '100%', minHeight: '280px', height: '100%', border: 'none', borderRadius: '18px', overflow: 'hidden' }} />
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2, #202023)', borderTop: '1px solid var(--border-subtle, #27272a)' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 700 }}>
                Наведіть камеру на штрихкод або QR
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
