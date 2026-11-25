import React from 'react'
import { Search, RefreshCw, QrCode } from 'lucide-react'

export function Shop1FloatingControls({
  manualId,
  setManualId,
  isProcessing,
  setIsScanning,
  handleManualEntry
}) {
  return (
    <>
      <style>{`
        .floating-controls-container {
          position: fixed; bottom: 30px; right: 30px; display: flex; align-items: center; gap: 12px; z-index: 1000; transition: all 0.3s ease;
        }
        @media (max-width: 600px) {
          .floating-controls-container {
            bottom: 0; left: 0; right: 0; width: 100%; background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 14px 20px; justify-content: space-between;
            border-radius: 0; box-shadow: 0 -10px 35px rgba(0,0,0,0.9); backdrop-filter: blur(15px);
          }
          .floating-controls-container form {
            flex: 1; box-shadow: none !important; background: #000 !important; border: 1px solid var(--border-subtle) !important;
          }
        }
        .s1-floating-search {
          background: rgba(10, 10, 10, 0.95);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        body.light-theme .s1-floating-search {
          background: rgba(255, 255, 255, 0.96);
          border-color: #e2e8f0 !important;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        }
        body.light-theme .s1-floating-search input { color: #0f172a !important; }
        body.light-theme .s1-floating-search input::placeholder { color: #94a3b8; }
        @media (max-width: 600px) {
          body.light-theme .floating-controls-container {
            background: rgba(255, 255, 255, 0.96) !important;
            border-top: 1px solid #e2e8f0; box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.1);
          }
          body.light-theme .floating-controls-container form {
            background: #f8fafc !important; border: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      <div className="floating-controls-container">
        <form onSubmit={handleManualEntry} className="s1-floating-search" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          border: '1px solid var(--border-subtle)', padding: '10px 14px', borderRadius: '24px',
          backdropFilter: 'blur(10px)'
        }}>
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
          />
          <button type="submit" disabled={isProcessing} className="floating-search-btn" style={{ background: '#eab308', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        <button onClick={() => setIsScanning(true)}
          className="hover-lift floating-qr-btn"
          title="Сканувати QR-код картки"
          style={{
            background: '#eab308', border: 'none', color: '#000', width: '64px', height: '64px',
            borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center',
            cursor: 'pointer', boxShadow: '0 10px 30px rgba(234,179,8,0.4)', transition: 'all 0.2s', flexShrink: 0
          }}>
          <QrCode size={32} />
        </button>
      </div>
    </>
  )
}
