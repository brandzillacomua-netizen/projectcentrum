import React from 'react'
import { Camera, Search, RefreshCw, AlertTriangle, X } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../hooks/useReceptionTerminalData'

export default function ReceptionTerminalScannerBar({
  setIsScanning,
  manualId,
  setManualId,
  handleManualSubmit,
  scanError,
  setScanError,
  isProcessing
}) {
  return (
    <section style={{ padding: '20px 24px 0 24px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '600px', margin: '0 auto' }}>
        <button
          onClick={() => setIsScanning(true)}
          style={{ background: ACCENT, color: '#000', border: 'none', padding: '14px', borderRadius: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 32px rgba(${ACCENT_RGB},0.2)`, transition: '0.2s' }}
        >
          <Camera size={20} />
        </button>
        <form onSubmit={handleManualSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card-bg, #0e0e12)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', padding: '12px 18px', borderRadius: '18px' }}>
          <Search size={18} color="var(--text-muted, #6b7280)" />
          <input
            type="text"
            placeholder="Скануйте штрих-код або введіть ID..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text, #fff)', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: ACCENT, color: '#000', border: 'none', padding: '6px 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ВВЕСТИ'}
          </button>
        </form>
      </div>
      {scanError && (
        <div style={{ maxWidth: '600px', margin: '12px auto 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{scanError}</span>
          <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
        </div>
      )}
    </section>
  )
}
