import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { telegramNotifierService } from '../../../services/alerting/telegramNotifierService'

export function TelegramAlertsConfig() {
  const [isEnabled, setIsEnabled] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => setIsEnabled(telegramNotifierService.getConfig().isEnabled), [])

  const handleToggle = (enabled) => {
    setIsEnabled(enabled)
    telegramNotifierService.saveConfig({ isEnabled: enabled })
  }

  const handleTestAlert = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await telegramNotifierService.sendTestNotification(null, 'Адміністратор MES Centrum')
      setTestResult({
        ok: result.success,
        message: result.success ? 'Тестове сповіщення успішно доставлено в Telegram.' : (result.error || 'Невідома помилка')
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div style={{ background: '#0e0e11', padding: 26, borderRadius: 24, border: '1px solid rgba(255,144,0,.15)', marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h3 style={{ margin: 0, color: '#ff9000', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={20} /> СПОВІЩЕННЯ ПРО ЗБОЇ В TELEGRAM
        </h3>
        <label style={{ color: isEnabled ? '#10b981' : '#64748b', fontWeight: 700 }}>
          <input type="checkbox" checked={isEnabled} onChange={event => handleToggle(event.target.checked)} />{' '}
          {isEnabled ? 'МОНІТОРИНГ АКТИВНИЙ' : 'ВИМКНЕНО'}
        </label>
      </div>
      <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
        Bot Token і Chat ID зберігаються тільки в захищених змінних сервера. У браузері секретів немає.
      </p>
      <button type="button" onClick={handleTestAlert} disabled={isTesting} style={{ background: '#ff9000', border: 0, borderRadius: 12, padding: '10px 18px', fontWeight: 900, cursor: isTesting ? 'wait' : 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
        {isTesting ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
        {isTesting ? 'ВІДПРАВКА...' : 'ПЕРЕВІРИТИ СЕРВЕРНУ ІНТЕГРАЦІЮ'}
      </button>
      {testResult && (
        <div style={{ marginTop: 16, color: testResult.ok ? '#34d399' : '#f87171', display: 'flex', gap: 8, alignItems: 'center' }}>
          {testResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {testResult.message}
        </div>
      )}
    </div>
  )
}

export default TelegramAlertsConfig
