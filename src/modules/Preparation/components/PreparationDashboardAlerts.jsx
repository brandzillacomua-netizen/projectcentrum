import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function PreparationDashboardAlerts({ alerts }) {
  return (
    <footer className={`prep-tv__alerts ${alerts.some(a => a.level === 'danger') ? 'has-danger' : ''}`}>
      <div><AlertTriangle size={22} /><strong>ПОТРЕБУЄ УВАГИ</strong></div>
      <div className="prep-tv__alerts-list">
        {alerts.length ? (
          alerts.map((alert, index) => <span key={`${alert.text}_${index}`}>{alert.text}</span>)
        ) : (
          <span className="is-clear">Критичних затримок немає — відділ працює за планом</span>
        )}
      </div>
    </footer>
  )
}
