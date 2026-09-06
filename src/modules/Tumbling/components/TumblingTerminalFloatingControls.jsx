import React from 'react'
import { Search, RefreshCw, QrCode } from 'lucide-react'

export default function TumblingTerminalFloatingControls({
  manualId,
  setManualId,
  handleManualSubmit,
  setIsScanning,
  isProcessing
}) {
  return (
    <div className="floating-controls-container">
      {/* Floating Search Form */}
      <form onSubmit={handleManualSubmit} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--card-bg, rgba(10, 10, 10, 0.95))',
        border: '1px solid var(--glass-border, #222)',
        padding: '10px 14px',
        borderRadius: '24px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <Search size={16} color="var(--text-muted, #6b7280)" />
        <input
          type="text"
          placeholder="Введіть системний номер..."
          value={manualId}
          onChange={e => setManualId(e.target.value)}
          disabled={isProcessing}
          style={{ background: 'transparent', border: 'none', color: 'var(--text, #fff)', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
        />
        <button type="submit" disabled={isProcessing} style={{ background: '#06b6d4', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
        </button>
      </form>

      {/* Floating Round QR Scan Button */}
      <button onClick={() => setIsScanning(true)}
        className="hover-lift"
        style={{ 
          background: '#06b6d4', 
          border: 'none', 
          color: '#000', 
          width: '64px',
          height: '64px',
          borderRadius: '50%', 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center', 
          cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(6,182,212,0.4)',
          transition: 'all 0.2s',
          flexShrink: 0
        }}>
        <QrCode size={32} />
      </button>
    </div>
  )
}
