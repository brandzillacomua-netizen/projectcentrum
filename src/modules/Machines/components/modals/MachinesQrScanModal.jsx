import React from 'react'
import { X } from 'lucide-react'

export function MachinesQrScanModal({ isScanning, setIsScanning, scanError, setScanError }) {
  if (!isScanning) return null

  return (
    <div className="modal-overlay" onClick={() => { setIsScanning(false); setScanError(null); }}>
      <div className="modal-content" style={{ maxWidth: '400px', padding: '30px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>Сканувати QR верстата</h3>
          <button className="btn-close" onClick={() => { setIsScanning(false); setScanError(null); }}><X size={20} /></button>
        </div>
        <div id="machine-qr-reader" style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', background: '#000' }} />
        {scanError && (
          <div style={{ marginTop: '15px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>
            {scanError}
          </div>
        )}
      </div>
    </div>
  )
}
