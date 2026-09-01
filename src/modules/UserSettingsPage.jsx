import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  Check,
  Package,
  ClipboardList,
  Truck,
  ShoppingCart,
  AlertTriangle,
  Flame,
  CheckSquare,
  Box
} from 'lucide-react'
import { useMES } from '../MESContext'

const DEFAULT_NOTIF_SETTINGS = {
  new_orders: true,
  material_requests: true,
  kitting_packaging: true,
  ready_shipping: true,
  procurement_requests: true,
  staff_calls: true,
  shortages_reissue: true,
  kanban_tasks: true,
  order_completion: true
}

const COLOR_PALETTE = ['#ff9000', '#818cf8', '#38bdf8', '#10b981', '#e11d48']

const UserSettingsPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentUser, upsertUser } = useMES()

  const initialTab = searchParams.get('tab') === 'profile' ? 'profile' : 'notifications'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Profile Form States
  const [firstName, setFirstName] = useState(currentUser?.first_name || '')
  const [lastName, setLastName] = useState(currentUser?.last_name || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [avatarColor, setAvatarColor] = useState(currentUser?.avatar_color || '#ff9000')
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Notification Toggle States
  const [notifSettings, setNotifSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_user_notif_types')
      return saved ? { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(saved) } : DEFAULT_NOTIF_SETTINGS
    } catch (e) {
      return DEFAULT_NOTIF_SETTINGS
    }
  })

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.first_name || '')
      setLastName(currentUser.last_name || '')
      if (currentUser.avatar && (currentUser.avatar.startsWith('data:image/') || currentUser.avatar.startsWith('http'))) {
        setAvatarUrl(currentUser.avatar)
      } else if (currentUser.avatar && currentUser.avatar.startsWith('#')) {
        setAvatarColor(currentUser.avatar)
        setAvatarUrl('')
      }
    }
  }, [currentUser])

  const toggleNotif = (key) => {
    setNotifSettings(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('centrum_user_notif_types', JSON.stringify(next))
      return next
    })
  }

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarUrl(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const payload = {
        id: currentUser.id,
        login: currentUser.login,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        position: currentUser.position,
        department: currentUser.department,
        shift: currentUser.shift,
        access_rights: currentUser.access_rights,
        avatar: avatarUrl || avatarColor,
        notification_settings: currentUser.notification_settings
      }
      if (password.trim()) {
        payload.password = password.trim()
      }
      await upsertUser(payload)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      alert('Помилка збереження профілю: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="user-settings-root" style={{ background: 'var(--bg, #090a0f)', minHeight: '100vh', color: 'var(--text, #fff)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar Header */}
      <header className="user-settings-header" style={{
        padding: '18px 24px',
        borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--card-bg, #0b0d14)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ff9000',
            fontWeight: 800,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} /> Назад
        </button>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.3px', color: 'var(--text)' }}>
          Налаштування
        </h1>
        <div style={{ width: '80px' }} />
      </header>

      {/* Tabs Bar */}
      <div className="user-settings-tabs-bar" style={{
        display: 'flex',
        borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
        background: 'var(--card-bg, #0b0d14)'
      }}>
        <button
          onClick={() => { setActiveTab('notifications'); setSearchParams({ tab: 'notifications' }); }}
          style={{
            flex: 1,
            padding: '16px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'notifications' ? '3px solid #ff9000' : '3px solid transparent',
            color: activeTab === 'notifications' ? 'var(--text)' : 'var(--text-muted, #64748b)',
            fontWeight: 900,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Сповіщення
        </button>
        <button
          onClick={() => { setActiveTab('profile'); setSearchParams({ tab: 'profile' }); }}
          style={{
            flex: 1,
            padding: '16px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #ff9000' : '3px solid transparent',
            color: activeTab === 'profile' ? 'var(--text)' : 'var(--text-muted, #64748b)',
            fontWeight: 900,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Профіль
        </button>
      </div>

      {/* Content Body */}
      <div style={{ flex: 1, maxWidth: '640px', width: '100%', margin: '0 auto', padding: '24px 20px 60px' }}>
        {/* TAB 1: СПОВІЩЕННЯ */}
        {activeTab === 'notifications' && (
          <div>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 900,
              color: 'var(--text-muted, #64748b)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '16px'
            }}>
              КЕРУВАННЯ ТИПАМИ СПОВІЩЕНЬ
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { key: 'new_orders', icon: '📦', title: 'Нові замовлення', desc: 'Надсилати при створенні менеджером нового замовлення (очікує на створення наряду)' },
                { key: 'material_requests', icon: '📋', title: 'Запити матеріалів (ТМЦ)', desc: 'Надсилати при створенні майстром запиту на сировину чи матеріали зі складу' },
                { key: 'kitting_packaging', icon: '📦', title: 'Комплектування та Пакування', desc: 'Надсилати при появі нових запитів на комплектування деталей для пакування замовлень' },
                { key: 'ready_shipping', icon: '🚚', title: 'Готовність до відвантаження', desc: 'Надсилати, коли партія повністю запакована і очікує логістичного відвантаження' },
                { key: 'procurement_requests', icon: '🛒', title: 'Запити на закупівлю (Постачання)', desc: 'Надсилати при потребі закупівлі відсутніх матеріалів постачальниками' },
                { key: 'staff_calls', icon: '⚠️', title: 'Виклики персоналу', desc: 'Надсилати при терміновому виклику оператором допомоги (майстра, інженера, ВКЯ) до верстату' },
                { key: 'shortages_reissue', icon: '🚨', title: 'Нестачі та довипуски', desc: 'Надсилати при виявленні браку та необхідності довипуску деталей для замовлення' },
                { key: 'kanban_tasks', icon: '📋', title: 'Задачі Kanban', desc: 'Надсилати при призначенні вам нових завдань або оновленні задач на дошці Kanban' },
                { key: 'order_completion', icon: '✅', title: 'Виконання нарядів та етапів', desc: 'Надсилати, коли всі карти розкрою завершені та наряд готовий до закриття у цеху' }
              ].map(card => (
                <div
                  key={card.key}
                  className="user-settings-card"
                  style={{
                    background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.07))',
                    borderRadius: '18px',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {card.icon} {card.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '4px', lineHeight: 1.35 }}>
                      {card.desc}
                    </div>
                  </div>
                  <ToggleSwitch checked={notifSettings[card.key]} onChange={() => toggleNotif(card.key)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ПРОФІЛЬ */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
            {/* Avatar Circle with Upload Icon */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    style={{ width: '100px', height: '100px', borderRadius: '24px', objectFit: 'cover', border: `3px solid ${avatarColor}` }}
                  />
                ) : (
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '24px',
                    background: `linear-gradient(135deg, ${avatarColor}, #e65100)`,
                    color: '#fff',
                    fontWeight: 950,
                    fontSize: '2.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 10px 25px ${avatarColor}44`
                  }}>
                    {(firstName || currentUser?.login || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                <label style={{
                  position: 'absolute',
                  bottom: '-6px',
                  right: '-6px',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#ff9000',
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  border: '2px solid #090a0f'
                }}>
                  <Camera size={18} />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                Натисніть на іконку для завантаження фото
              </div>

              {/* Color Palette Selector */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                {COLOR_PALETTE.map(color => {
                  const isSelected = avatarColor === color && !avatarUrl
                  return (
                    <div
                      key={color}
                      onClick={() => {
                        setAvatarColor(color)
                        setAvatarUrl('')
                      }}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '9px',
                        background: color,
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--text, #fff)' : '2px solid transparent',
                        transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                        boxShadow: isSelected ? `0 0 10px ${color}` : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  )
                })}
              </div>
            </div>

            {/* Profile Form Fields */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  ІМ'Я
                </label>
                <input
                  type="text"
                  className="user-settings-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Введіть ім'я..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                    background: 'var(--card-bg, rgba(22, 24, 34, 0.85))',
                    color: 'var(--text, #fff)',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  ПРІЗВИЩЕ
                </label>
                <input
                  type="text"
                  className="user-settings-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Введіть прізвище..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                    background: 'var(--card-bg, rgba(22, 24, 34, 0.85))',
                    color: 'var(--text, #fff)',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  НОВИЙ ПАРОЛЬ
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="user-settings-input"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введіть новий пароль..."
                    style={{
                      width: '100%',
                      padding: '12px 42px 12px 16px',
                      borderRadius: '14px',
                      border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                      background: 'var(--card-bg, rgba(22, 24, 34, 0.85))',
                      color: 'var(--text, #fff)',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Save Button */}
              <button
                type="submit"
                disabled={isSaving}
                className="user-settings-btn-primary"
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ff9000, #e65100)',
                  color: '#000000',
                  fontWeight: 950,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 25px rgba(255, 144, 0, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                {saveSuccess ? (
                  <>
                    <Check size={20} /> Збережено!
                  </>
                ) : (
                  <>
                    <Check size={20} /> {isSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Toggle Switch Component
const ToggleSwitch = ({ checked, onChange }) => {
  return (
    <div
      onClick={onChange}
      style={{
        width: '52px',
        height: '28px',
        borderRadius: '20px',
        background: checked ? '#ff9000' : 'rgba(255,255,255,0.12)',
        padding: '3px',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        boxShadow: checked ? '0 0 14px rgba(255, 144, 0, 0.4)' : 'none',
        flexShrink: 0
      }}
    >
      <div style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }} />
    </div>
  )
}

export default UserSettingsPage
