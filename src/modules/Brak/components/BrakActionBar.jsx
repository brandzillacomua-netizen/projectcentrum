import React from 'react'
import { Camera, Search, X, BarChart2, Wrench, Settings, Stamp, Flame } from 'lucide-react'
import { Link } from 'react-router-dom'

export const BrakActionBar = React.memo(({
  setIsScanning,
  manualCardNumber,
  setManualCardNumber,
  scanError,
  setScanError,
  openQcCardByNumber,
  setShowReportPage,
  setShowStampsJournal,
  stampedCardsCount = 0,
  setShowCuttingCardsModal,
  activeCuttingCardsCount = 0
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
          style={{ padding: '12px 16px', background: '#ef444418', border: 'none', borderLeft: '1px solid var(--border-color, var(--border-subtle))', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 900 }}
        >
          <Search size={17} /> ЗНАЙТИ
        </button>
      </div>

      {typeof setShowCuttingCardsModal === 'function' && (
        <button
          onClick={() => setShowCuttingCardsModal(true)}
          style={{
            padding: '12px 22px',
            borderRadius: '14px',
            fontSize: '0.85rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            color: '#f59e0b',
            transition: 'all 0.2s',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.15)'
          }}
        >
          <Flame size={18} />
          <span>⚡ КАРТКИ В РОЗКРОЇ</span>
          {activeCuttingCardsCount > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#f59e0b',
                color: '#000',
                fontSize: '0.72rem',
                fontWeight: 950
              }}
            >
              {activeCuttingCardsCount}
            </span>
          )}
        </button>
      )}

      {typeof setShowStampsJournal === 'function' && (
        <button
          onClick={() => setShowStampsJournal(true)}
          style={{
            padding: '12px 22px',
            borderRadius: '14px',
            fontSize: '0.85rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            color: '#10b981',
            transition: 'all 0.2s'
          }}
        >
          <Stamp size={18} />
          <span>💮 ЖУРНАЛ ПЕЧАТОК ВКЯ</span>
          {stampedCardsCount > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#10b981',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 950
              }}
            >
              {stampedCardsCount}
            </span>
          )}
        </button>
      )}

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
