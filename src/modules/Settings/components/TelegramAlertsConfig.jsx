import React, { useState, useEffect } from 'react'
import { Send, CheckCircle2, AlertTriangle, Bell, ShieldAlert, Key, Hash, RefreshCw } from 'lucide-react'
import { telegramNotifierService } from '../../../services/alerting/telegramNotifierService'

export function TelegramAlertsConfig() {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    const cfg = telegramNotifierService.getConfig()
    setBotToken(cfg.botToken || '')
    setChatId(cfg.chatId || '')
    setIsEnabled(cfg.isEnabled)
  }, [])

  const handleChatIdChange = (val) => {
    // Автоматично очищаємо якщо користувач вставив текст "ID: -5496277042" або "id: 12345"
    let cleaned = val.replace(/^(id|chat_id|chat|id\s*груп[иа]|id\s*чату)\s*[:=-]\s*/i, '')
    cleaned = cleaned.replace(/\s+/g, '')
    setChatId(cleaned)
  }

  const handleSave = () => {
    const cleanId = chatId.replace(/^(id|chat_id|chat|id\s*груп[иа]|id\s*чату)\s*[:=-]\s*/i, '').trim().replace(/\s+/g, '')
    const active = Boolean(isEnabled || (botToken.trim() && cleanId))
    setIsEnabled(active)
    telegramNotifierService.saveConfig({
      botToken: botToken.trim(),
      chatId: cleanId,
      isEnabled: active
    })
    setChatId(cleanId)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleTestAlert = async () => {
    const cleanId = chatId.replace(/^(id|chat_id|chat|id\s*груп[иа]|id\s*чату)\s*[:=-]\s*/i, '').trim().replace(/\s+/g, '')
    setChatId(cleanId)

    if (!botToken.trim() || !cleanId) {
      setTestResult({
        ok: false,
        message: 'Будь ласка, вкажіть Bot Token та Chat ID перед тестуванням.'
      })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await telegramNotifierService.sendTestNotification(
        {
          botToken: botToken.trim(),
          chatId: cleanId,
          isEnabled: true
        },
        'Адміністратор MES Centrum'
      )

      if (result.success) {
        if (result.resolvedChatId && result.resolvedChatId !== cleanId) {
          setChatId(result.resolvedChatId)
        }
        setIsEnabled(true)
        setTestResult({
          ok: true,
          message: 'Тестове сповіщення успішно доставлено в Telegram!'
        })
      } else {
        setTestResult({
          ok: false,
          message: result.error || 'Невідома помилка'
        })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: `Помилка з'єднання: ${err.message}`
      })
    } finally {
      setIsTesting(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: '#000',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 600,
    outline: 'none',
    transition: 'border-color 0.2s'
  }

  return (
    <div style={{
      background: '#0e0e11',
      padding: '26px',
      borderRadius: '24px',
      border: '1px solid rgba(255, 144, 0, 0.15)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      marginTop: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000', margin: 0 }}>
          <ShieldAlert size={20} /> СПОВІЩЕННЯ ПРО ЗБОЇ В TELEGRAM
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: isEnabled ? '#10b981' : '#64748b' }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={e => setIsEnabled(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }}
          />
          {isEnabled ? 'МОНІТОРИНГ АКТИВНИЙ' : 'ВИМКНЕНО'}
        </label>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 20px' }}>
        Миттєве надсилання сповіщень про критичні винятки JavaScript, падіння екранів та збої зв'язку з Supabase у ваш Telegram-чат з автоматичним аналізом <strong>можливої причини</strong> та рекомендацій робітнику.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: '#aaa', marginBottom: '6px' }}>
            <Key size={14} color="#ff9000" /> TELEGRAM BOT TOKEN
          </label>
          <input
            type="password"
            style={inputStyle}
            value={botToken}
            onChange={e => setBotToken(e.target.value)}
            placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
          />
        </div>

        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: '#aaa', marginBottom: '6px' }}>
            <Hash size={14} color="#ff9000" /> CHAT ID АБО ID ГРУПИ
          </label>
          <input
            type="text"
            style={inputStyle}
            value={chatId}
            onChange={e => handleChatIdChange(e.target.value)}
            placeholder="-100123456789 або 987654321"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            background: saveSuccess ? '#10b981' : '#ff9000',
            color: '#000',
            border: 'none',
            padding: '10px 22px',
            borderRadius: '12px',
            fontWeight: 900,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: '0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {saveSuccess ? <CheckCircle2 size={16} /> : null}
          {saveSuccess ? 'ЗБЕРЕЖЕНО!' : 'ЗБЕРЕГТИ НАЛАШТУВАННЯ'}
        </button>

        <button
          type="button"
          onClick={handleTestAlert}
          disabled={isTesting}
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: isTesting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isTesting ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
          {isTesting ? 'ВІДПРАВКА...' : 'ТЕСТОВЕ СПОВІЩЕННЯ'}
        </button>
      </div>

      {testResult && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: testResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${testResult.ok ? '#10b981' : '#ef4444'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.8rem',
          color: testResult.ok ? '#34d399' : '#f87171'
        }}>
          {testResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{testResult.message}</span>
        </div>
      )}

      <div style={{
        marginTop: '18px',
        paddingTop: '14px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: '0.72rem',
        color: '#64748b',
        lineHeight: 1.5
      }}>
        💡 <strong>Як налаштувати:</strong> Створіть бота в Telegram через <code>@BotFather</code> і скопіюйте токен. Додайте створеного бота у вашу групу/чат та надішліть будь-яке повідомлення. Дізнатися Chat ID можна переславши повідомлення боту <code>@userinfobot</code> або <code>@RawDataBot</code>.
      </div>
    </div>
  )
}
export default TelegramAlertsConfig
