import React from 'react'
import { Scan, X } from 'lucide-react'

export const BrakScanModal = React.memo(({
  isScanning,
  setIsScanning
}) => {
  React.useEffect(() => {
    if (!isScanning) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [isScanning])

  if (!isScanning) return null

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100060, padding: '16px', boxSizing: 'border-box', overflow: 'hidden', overscrollBehavior: 'contain' }}>
      <div style={{ background: 'var(--modal-bg, #111)', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid var(--modal-border, var(--border-subtle))', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', background: 'var(--card-inner-bg, #1a1a1a)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 900, fontSize: '0.9rem' }}>
            <Scan size={18} /> СКАНУВАННЯ КАРТКИ
          </div>
          <button onClick={() => setIsScanning(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: 0, position: 'relative', background: 'var(--surface-black)', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div id="qc-reader" style={{ width: '100%', border: 'none' }} />
        </div>
        <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>
          Наведіть камеру на QR-код виробничої картки
        </div>
      </div>
    </div>
  )
})
