import React from 'react'
import { Camera, Search, RefreshCw } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../hooks/usePressingTerminalData'

export default function PressingTerminalScannerBar({
  setIsScanning,
  manualId,
  setManualId,
  handleManualSubmit,
  isProcessing
}) {
  return (
    <section style={{ padding: '16px 20px 0 20px', flexShrink: 0 }} className="scanner-section-desktop">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '600px', margin: '0 auto' }}>
        <button
          onClick={() => setIsScanning(true)}
          style={{ background: ACCENT, color: '#000', border: 'none', padding: '12px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 32px rgba(${ACCENT_RGB},0.2)`, transition: '0.2s', flexShrink: 0 }}
        >
          <Camera size={18} />
        </button>
        <form onSubmit={handleManualSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card-bg, #0e0e12)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', padding: '10px 16px', borderRadius: '16px' }}>
          <Search size={16} color="var(--text-muted, #6b7280)" />
          <input
            type="text"
            placeholder="Системний номер картки..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text, #fff)', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: ACCENT, color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ВВЕСТИ'}
          </button>
        </form>
      </div>
    </section>
  )
}
