import React, { useState, useEffect, useRef, useMemo } from 'react'
import { QrCode, X, Camera, Search, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { triggerHapticAudioFeedback } from '../../../../services/scannerDebounceGuard.js'
import { resolveMachineFromScannedText } from '../../../../utils/machineQrUtils.js'

async function loadScannerLib() {
  if (typeof window !== 'undefined' && window.Html5Qrcode) {
    return window.Html5Qrcode
  }
  try {
    const mod = await import('html5-qrcode')
    const Lib = mod.Html5Qrcode || mod.default?.Html5Qrcode || mod.default
    if (typeof window !== 'undefined') {
      window.Html5Qrcode = Lib
    }
    return Lib
  } catch (err) {
    console.warn('[MachinesQrScanModal] Failed to load html5-qrcode:', err)
    return null
  }
}

export function MachinesQrScanModal({
  isOpen,
  onClose,
  isScanning,
  setIsScanning,
  scanError: externalScanError,
  setScanError: setExternalScanError,
  machines = [],
  onSelectMachine
}) {
  const active = isOpen !== undefined ? isOpen : Boolean(isScanning)

  const [cameraError, setCameraError] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [manualInput, setManualInput] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)
  const scannerRef = useRef(null)
  const inputRef = useRef(null)

  const handleClose = () => {
    if (setIsScanning) setIsScanning(false)
    if (onClose) onClose()
    if (setExternalScanError) setExternalScanError(null)
    setLocalError(null)
    setCameraError(null)
    setManualInput('')
  }

  // Quick suggestions based on manual input
  const suggestions = useMemo(() => {
    const query = manualInput.trim().toLowerCase()
    if (!query || query.length < 1 || !Array.isArray(machines)) return []
    return machines.filter(m => {
      const name = String(m.name || '').toLowerCase()
      const seq = String(m.sequence_number || '')
      const inv = String(m.inventory_no || '').toLowerCase()
      return name.includes(query) || seq === query || inv.includes(query)
    }).slice(0, 4)
  }, [manualInput, machines])

  // Handle successful machine resolution
  const handleResolveMachine = (foundMachine) => {
    triggerHapticAudioFeedback(true)
    handleClose()
    if (typeof onSelectMachine === 'function') {
      onSelectMachine(foundMachine.id)
    }
  }

  // Scanner lifecycle
  useEffect(() => {
    if (!active) {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {})
        }
        scannerRef.current = null
      }
      return
    }

    let isMounted = true
    let timer = null

    setCameraError(null)
    setLocalError(null)
    setManualInput('')
    setIsInitializing(true)

    const startScanner = async () => {
      try {
        const Html5Qrcode = await loadScannerLib()
        if (!isMounted) return

        if (!Html5Qrcode) {
          setCameraError('Бібліотека сканера недоступна. Скористайтеся ручним введенням.')
          setIsInitializing(false)
          return
        }

        const containerEl = document.getElementById('machine-qr-reader')
        if (!containerEl) {
          console.warn('[MachinesQrScanModal] #machine-qr-reader container not found in DOM')
          setIsInitializing(false)
          return
        }

        const scanner = new Html5Qrcode('machine-qr-reader', {
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false
        })
        scannerRef.current = scanner

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          async (decodedText) => {
            const trimmed = String(decodedText || '').trim()
            if (!trimmed) return

            const found = resolveMachineFromScannedText(trimmed, machines)
            if (found) {
              if (scanner.isScanning) {
                await scanner.stop().catch(() => {})
              }
              scannerRef.current = null
              handleResolveMachine(found)
            } else {
              triggerHapticAudioFeedback(false)
              setLocalError(`Верстат за кодом «${trimmed.slice(0, 24)}...» не знайдено. Перевірте QR-код.`)
            }
          }
        )

        if (isMounted) {
          setIsInitializing(false)
        }
      } catch (err) {
        console.warn('[MachinesQrScanModal] Camera init error:', err)
        if (isMounted) {
          setIsInitializing(false)
          const msg = err?.message || String(err)
          if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
            setCameraError('Доступ до камери заблоковано в браузері. Надайте дозвіл або введіть номер верстата.')
          } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
            setCameraError('Камеру не знайдено на пристрої. Скористайтеся ручним введенням або USB-сканером.')
          } else {
            setCameraError('Не вдалося запустити камеру. Введіть номер верстата вручну.')
          }
          // Focus manual input field
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }
    }

    timer = setTimeout(startScanner, 150)

    // Keyboard Escape listener
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      isMounted = false
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {})
        }
        scannerRef.current = null
      }
    }
  }, [active, machines])

  // Handle manual input submit (or Enter key from barcode scanner)
  const handleManualSubmit = (e) => {
    if (e) e.preventDefault()
    const query = manualInput.trim()
    if (!query) return

    const found = resolveMachineFromScannedText(query, machines)
    if (found) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
      handleResolveMachine(found)
    } else {
      triggerHapticAudioFeedback(false)
      setLocalError(`Верстат за запитом «${query}» не знайдено в списку (${machines.length} верстатів).`)
    }
  }

  if (!active) return null

  const displayError = localError || externalScanError

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '20px'
      }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-1, #181920)',
          width: '100%',
          maxWidth: '440px',
          borderRadius: '24px',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            background: 'var(--surface-2, #1f2029)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 144, 0, 0.15)',
                color: '#ff9000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 950, color: '#fff', letterSpacing: '-0.3px' }}>
                СКАНУВАННЯ QR ВЕРСТАТА
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>
                {machines.length} верстатів у системі
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: '0.2s'
            }}
            title="Закрити"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {cameraError ? (
            <div
              style={{
                padding: '24px 16px',
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>
                  Камера недоступна
                </div>
                <div style={{ color: '#aaa', fontSize: '0.78rem', lineHeight: 1.4, maxWidth: '280px' }}>
                  {cameraError}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000', minHeight: '260px' }}>
              <div
                id="machine-qr-reader"
                style={{
                  width: '100%',
                  minHeight: '260px'
                }}
              />
              {isInitializing && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#ff9000',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    gap: '10px'
                  }}
                >
                  <Camera size={28} className="scanner-spin" />
                  <span>Ініціалізація камери...</span>
                </div>
              )}
            </div>
          )}

          {/* Error Notice */}
          {displayError && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: '#f87171',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{displayError}</span>
            </div>
          )}

          {/* Manual / USB Scanner Input */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ввести код / № верстата або USB-сканер:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#666',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={e => {
                    setManualInput(e.target.value)
                    if (localError) setLocalError(null)
                  }}
                  placeholder="№ верстата, назва або скануйте штрих-код..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 12px 11px 36px',
                    background: 'var(--surface-black, #0f1015)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    fontWeight: 600
                  }}
                  autoFocus={Boolean(cameraError)}
                />
              </div>
              <button
                type="submit"
                style={{
                  background: '#ff9000',
                  color: '#000',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0 18px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: '0.2s',
                  boxShadow: '0 4px 12px rgba(255, 144, 0, 0.25)'
                }}
              >
                <span>ОК</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Quick Match Chips */}
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {suggestions.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleResolveMachine(m)}
                    style={{
                      background: 'rgba(255, 144, 0, 0.12)',
                      border: '1px solid rgba(255, 144, 0, 0.3)',
                      color: '#ff9000',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>№{m.sequence_number || '—'} {m.name}</span>
                    <CheckCircle2 size={12} />
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--surface-2, #1f2029)',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            fontSize: '0.72rem',
            color: '#777',
            textAlign: 'center',
            lineHeight: 1.4
          }}
        >
          Підтримуються QR-коди з етикеток верстатів, мобільних посилань або інвентарні номери.
        </div>
      </div>
    </div>
  )
}
