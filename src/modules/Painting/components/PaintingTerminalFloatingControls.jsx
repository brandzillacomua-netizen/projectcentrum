import React from 'react'
import { Search, RefreshCw, QrCode } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../hooks/usePaintingTerminalData'

export default function PaintingTerminalFloatingControls({
  manualId,
  setManualId,
  handleManualSubmit,
  setIsScanning,
  isProcessing
}) {
  return (
    <div className="floating-controls-container">
      <form onSubmit={handleManualSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg, rgba(10, 10, 10, 0.95))', border: '1px solid var(--glass-border, #222)', padding: '8px 12px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
        <Search size={16} color="var(--text-muted, #6b7280)" />
        <input
          type="text"
          placeholder="Номер..."
          value={manualId}
          onChange={e => setManualId(e.target.value)}
          disabled={isProcessing}
          style={{ background: 'transparent', border: 'none', color: 'var(--text, #fff)', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100px' }}
        />
        <button type="submit" disabled={isProcessing} style={{ background: ACCENT, color: '#000', border: 'none', padding: '4px 10px', borderRadius: '16px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>
          {isProcessing ? <RefreshCw size={10} className="anim-spin" /> : 'ЗНАЙТИ'}
        </button>
      </form>

      <button onClick={() => setIsScanning(true)}
        className="hover-lift"
        style={{ background: ACCENT, border: 'none', color: '#000', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: `0 10px 30px rgba(${ACCENT_RGB},0.4)`, transition: 'all 0.2s', flexShrink: 0 }}
      >
        <QrCode size={26} />
      </button>
    </div>
  )
}
