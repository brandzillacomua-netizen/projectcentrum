import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Monitor, RefreshCw, Maximize2, Layers, Cpu } from 'lucide-react'

export default function PreparationDashboardHeader({
  staleSeconds,
  toggleFullscreen,
  now,
  viewMode,
  setViewMode
}) {
  return (
    <header className="prep-tv__header">
      <div className="prep-tv__brand">
        <Link to="/" className="prep-tv__back" title="Повернутися до головного меню">
          <ArrowLeft size={20} />
        </Link>
        <div className="prep-tv__logo">
          <Layers size={22} />
        </div>
        <div>
          <strong>ВІДДІЛ ПІДГОТОВКИ</strong>
          <span>ТВ МОДУЛЬ ОПЕРАТИВНОГО МОНІТОРИНГУ · СО ➔ РОЗКРІЙ</span>
        </div>
      </div>

      <div className="prep-tv__tabs">
        <div className="prep-tv__tab-btn is-active" style={{ cursor: 'default' }}>
          <Monitor size={15} />
          <span>Листи & Бокси фрез</span>
        </div>
      </div>

      <div className="prep-tv__header-status">
        <span className={`prep-tv__pulse ${staleSeconds > 120 ? 'is-stale' : 'is-live'}`}>
          <RefreshCw size={14} className="pulse-icon" />
          <span>{staleSeconds > 120 ? 'Дані застаріли' : 'Онлайн'}</span>
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          title="На весь екран (F11)"
          className="prep-tv__icon-btn"
        >
          <Maximize2 size={19} />
        </button>
        <div className="prep-tv__clock">
          <strong>{now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
          <span>{now.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'long' })}</span>
        </div>
      </div>
    </header>
  )
}
