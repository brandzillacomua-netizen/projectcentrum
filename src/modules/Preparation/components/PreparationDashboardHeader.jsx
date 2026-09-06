import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Layers3, RefreshCw, Maximize2 } from 'lucide-react'

export default function PreparationDashboardHeader({
  staleSeconds,
  toggleFullscreen,
  now
}) {
  return (
    <header className="prep-tv__header">
      <div className="prep-tv__brand">
        <Link to="/" className="prep-tv__back"><ArrowLeft size={20} /></Link>
        <div className="prep-tv__logo"><Layers3 size={24} /></div>
        <div><strong>ВІДДІЛ ПІДГОТОВКИ</strong><span>оперативний екран зміни</span></div>
      </div>
      <div className="prep-tv__header-status">
        <span className={staleSeconds > 120 ? 'is-stale' : ''}><RefreshCw size={15} /> Дані актуальні</span>
        <button type="button" onClick={toggleFullscreen} title="На весь екран"><Maximize2 size={20} /></button>
        <div className="prep-tv__clock">
          <strong>{now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</strong>
          <span>{now.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' })}</span>
        </div>
      </div>
    </header>
  )
}
