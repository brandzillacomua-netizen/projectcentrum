import React from 'react'
import { Search, QrCode } from 'lucide-react'

export const WarehouseFloatingControls = ({
  manualSearchInput,
  setManualSearchInput,
  isProcessing,
  handleWarehouseScan,
  setIsScanning,
  setShowReception
}) => {
  return (
    <div className="warehouse-floating-controls">
      {/* Floating Search Form */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          if (manualSearchInput.trim()) {
            handleWarehouseScan(manualSearchInput.trim())
            setManualSearchInput('')
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(10, 10, 10, 0.95)',
          border: '1px solid #222',
          padding: '5px 6px 5px 18px',
          borderRadius: '28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          height: '56px',
          boxSizing: 'border-box',
          width: window.innerWidth < 768 ? '100%' : '380px'
        }}
      >
        <Search size={18} color="#6b7280" style={{ marginRight: '10px' }} />
        <input
          type="text"
          placeholder="Введіть системний номер..."
          value={manualSearchInput}
          onChange={e => setManualSearchInput(e.target.value)}
          disabled={isProcessing}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#fff', 
            fontSize: '0.88rem', 
            fontWeight: 900, 
            outline: 'none', 
            width: '100%',
            fontFamily: 'inherit'
          }}
        />
        <button 
          type="submit" 
          disabled={isProcessing} 
          style={{ 
            background: '#ff9000', 
            color: '#000', 
            border: 'none', 
            padding: '0 20px', 
            borderRadius: '22px', 
            fontSize: '0.82rem', 
            fontWeight: 950, 
            cursor: 'pointer', 
            height: '42px',
            display: 'flex', 
            alignItems: 'center', 
            flexShrink: 0 
          }}
        >
          ЗНАЙТИ
        </button>
      </form>

      {/* Floating Round QR Scan Button */}
      <button 
        onClick={() => {
          setIsScanning(true)
          setShowReception(false)
        }}
        className="hover-lift"
        style={{ 
          background: '#ff9000', 
          border: 'none', 
          color: '#000', 
          width: '56px',
          height: '56px',
          borderRadius: '50%', 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center', 
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(255, 144, 0, 0.4)',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 144, 0, 0.55)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 10px 25px rgba(255, 144, 0, 0.4)'
        }}
      >
        <QrCode size={26} />
      </button>
    </div>
  )
}
