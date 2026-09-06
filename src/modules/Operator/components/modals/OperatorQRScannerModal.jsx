import React from 'react'
import { X } from 'lucide-react'

export const OperatorQRScannerModal = ({ isScanning, setIsScanning }) => {
  if (!isScanning) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: 30, right: 30, color: '#fff', background: '#1a1a1a', border: 'none', padding: '15px', borderRadius: '50%' }}>
        <X size={32} />
      </button>
      <div style={{ width: '90%', maxWidth: '500px', border: '4px solid #3b82f6', borderRadius: '32px', overflow: 'hidden' }} id="reader"></div>
    </div>
  )
}
