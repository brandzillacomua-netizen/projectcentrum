import React from 'react'
import { Camera, Search, X, BarChart2, Wrench, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export const BrakActionBar = React.memo(({
  setIsScanning,
  manualCardNumber,
  setManualCardNumber,
  scanError,
  setScanError,
  openQcCardByNumber,
  setShowReportPage
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
      <button
        onClick={() => setIsScanning(true)}
        className="vkya-btn vkya-btn-scan"
        style={{
          padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
          transition: 'all 0.2s'
        }}
      >
        <Camera size={18} /> СКАНУВАТИ КАРТКУ
      </button>

      <div className="vkya-search-box" style={{ display: 'flex', alignItems: 'center', borderRadius: '14px', overflow: 'hidden' }}>
        <input
          value={manualCardNumber}
          onChange={event => {
            setManualCardNumber(event.target.value)
            if (scanError && typeof setScanError === 'function') setScanError(null)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') openQcCardByNumber()
          }}
          placeholder="№ картки, наряд або деталь..."
          aria-label="Системний номер картки"
          style={{ width: '240px', minWidth: 0, padding: '0 14px', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', fontWeight: 750, color: 'var(--text-color, inherit)' }}
        />
        {manualCardNumber && (
          <button
            onClick={() => setManualCardNumber('')}
            style={{ background: 'transparent', border: 0, color: 'var(--text-muted, #666)', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
            title="Очистити пошук"
          >
            <X size={15} />
          </button>
        )}
        <button
          onClick={openQcCardByNumber}
          style={{ padding: '12px 16px', background: '#ef444418', border: 'none', borderLeft: '1px solid var(--border-color, #333)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 900 }}
        >
          <Search size={17} /> ЗНАЙТИ
        </button>
      </div>

      <button
        onClick={() => setShowReportPage(true)}
        className="vkya-btn vkya-btn-reports"
        style={{
          padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
          transition: 'all 0.2s'
        }}
      >
        <BarChart2 size={18} /> ЗВІТИ ВКЯ
      </button>

      <Link
        to="/brak/restoration"
        className="vkya-btn vkya-btn-restoration"
        style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
      >
        <Wrench size={18} /> ТЕРМІНАЛ ВІДНОВЛЕННЯ
      </Link>

      <Link
        to="/brak/settings"
        className="vkya-btn vkya-btn-settings"
        style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
      >
        <Settings size={18}/> НАЛАШТУВАННЯ ВКЯ
      </Link>
    </div>
  )
})
