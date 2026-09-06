import React from 'react'
import { X } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../../hooks/usePressingTerminalData'

export default function PressingQRScannerModal({
  isScanning,
  setIsScanning,
  showManualInput,
  setShowManualInput,
  manualId,
  setManualId,
  handleManualSubmit,
  scanError,
  setScanError,
  isProcessing
}) {
  if (!isScanning) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
      <button onClick={() => { setIsScanning(false); setShowManualInput(false); setScanError(null); }}
        style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
        <X size={26} />
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 1000, color: ACCENT, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>ЕКРАН ПРЕСУВАННЯ · СКАНЕР</div>
        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 700 }}>{showManualInput ? 'ВВЕДІТЬ НОМЕР КАРТКИ ВРУЧНУ' : 'ВІДСКАНУЙТЕ КАРТКУ ЦЕХУ №2'}</div>
      </div>

      {!showManualInput ? (
        <>
          <div style={{ width: '100%', maxWidth: '480px', background: '#0a0a0a', borderRadius: '32px', border: `2px solid rgba(${ACCENT_RGB},0.3)`, overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
            <div id="reader-pressing" style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
            {scanError && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 900, textAlign: 'center', background: '#ef444415', padding: '12px 24px', borderRadius: '16px', border: '1px solid #ef444430', maxWidth: '380px' }}>
                ⚠️ {scanError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowManualInput(true)}
                style={{ background: '#1a1a1a', border: '1px solid #333', color: ACCENT, padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                ⌨️ ВВЕСТИ НОМЕР ВРУЧНУ
              </button>
              <button onClick={() => { setIsScanning(false); setScanError(null); }}
                style={{ background: 'transparent', border: '1px solid #222', color: '#555', padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                ПОВЕРНУТИСЬ
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: '#111', width: '100%', maxWidth: '400px', padding: '30px', borderRadius: '24px', border: '1px solid #222' }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            setIsScanning(false);
            setShowManualInput(false);
            handleManualSubmit(e);
          }}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input
              type="text"
              autoFocus
              placeholder="Приклад: 12345"
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              style={{ width: '100%', background: '#000', border: `2px solid rgba(${ACCENT_RGB},0.5)`, color: '#fff', fontSize: '2.5rem', textAlign: 'center', padding: '15px', borderRadius: '16px', fontWeight: 900, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={!manualId || isProcessing}
                style={{ flex: 2, background: ACCENT, color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer' }}>
                ВІДКРИТИ КАРТКУ
              </button>
              <button type="button" onClick={() => { setShowManualInput(false); setManualId(''); }}
                style={{ flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                НАЗАД
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
