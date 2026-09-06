import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  X,
  Bell,
  BellOff,
  User,
  Monitor,
  KanbanSquare,
  ClipboardList,
  Tablet,
  Package
} from 'lucide-react'
import { getAvailableModules } from './config/moduleRegistry'
import { useChatUnreadCount } from './hooks/useChatUnreadCount'
import { PortalDashboard } from './components/app/PortalDashboard'
import { GlobalUserNav } from './components/app/GlobalUserNav'
import { AppSidebar } from './components/app/AppSidebar'
import { ModuleErrorBoundary } from './components/SystemResilience'

// ── Lazy-loaded modules (loaded on demand, not at startup) ─────────────────────
const CrmModule = lazy(() => import('./modules/CrmModule'))
const CrmClientsModule = lazy(() => import('./modules/CRM/ClientsModule'))
const EconomyModule = lazy(() => import('./modules/Economy/EconomyModule'))
const ManagerModule = lazy(() => import('./modules/ManagerModule'))
const WarehouseModule = lazy(() => import('./modules/WarehouseModuleV2'))
const MasterModule = lazy(() => import('./modules/MasterModule'))
const NomenclatureModule = lazy(() => import('./modules/NomenclatureV2'))
const NomenclatureV2 = lazy(() => import('./modules/NomenclatureV2'))
const EngineerModule = lazy(() => import('./modules/EngineerV2Module'))
const EngineerV2Module = lazy(() => import('./modules/EngineerV2Module'))
const DirectorModule = lazy(() => import('./modules/DirectorModule'))
const OperatorTerminal = lazy(() => import('./modules/OperatorTerminalV2'))
const ShippingModule = lazy(() => import('./modules/ShippingModule'))
const SupplyModule = lazy(() => import('./modules/SupplyModuleV2'))
const PreparationTerminal = lazy(() => import('./modules/PreparationTerminal'))
const Foreman2Module = lazy(() => import('./modules/Foreman2/Foreman2Module'))
const PackagingModule = lazy(() => import('./modules/PackagingModule'))
const MachinesModule = lazy(() => import('./modules/MachinesModule'))
const SettingsModule = lazy(() => import('./modules/SettingsModule'))
const UserSettingsPage = lazy(() => import('./modules/UserSettingsPage'))
const NotificationsPage = lazy(() => import('./modules/NotificationsPage'))
const LoginPage = lazy(() => import('./modules/LoginPage'))
const Shop1Terminal = lazy(() => import('./modules/Shop1Terminal'))
const Shop1ForemanModule = lazy(() => import('./modules/Shop1ForemanModule'))
const Shop2Module = lazy(() => import('./modules/Shop2CardGen/Shop2CardGenModule'))
const Shop2Terminal = lazy(() => import('./modules/Shop2Terminal'))
const AnalyticsModule = lazy(() => import('./modules/AnalyticsModule'))
const BrakModule = lazy(() => import('./modules/BrakModule'))
const VKYARestorationTerminal = lazy(() => import('./modules/VKYARestorationTerminal'))
const VKYASettings = lazy(() => import('./modules/VKYASettings'))
const KanbanModule = lazy(() => import('./modules/KanbanModule'))
const TaskProjectsModule = lazy(() => import('./modules/TaskProjectsModule'))
const AccessModule = lazy(() => import('./modules/AccessModule'))
const ReportsModule = lazy(() => import('./modules/ReportsModule'))
const ForemanDashboardModule = lazy(() => import('./modules/ForemanDashboardModule'))
const MachineCallModule = lazy(() => import('./modules/MachineCallModule'))
const TumblingTerminal = lazy(() => import('./modules/TumblingTerminal'))
const TumblingDashboard = lazy(() => import('./modules/TumblingDashboard'))
const ReceptionTerminal = lazy(() => import('./modules/ReceptionTerminal'))
const SortingTerminal = lazy(() => import('./modules/SortingTerminal'))
const PaintingTerminal = lazy(() => import('./modules/PaintingTerminal'))
const PressingTerminal = lazy(() => import('./modules/PressingTerminal'))
const WarehouseBoxesModule = lazy(() => import('./modules/WarehouseBoxesModule'))
const PreparationDashboard = lazy(() => import('./modules/PreparationDashboard'))
const ChatModule = lazy(() => import('./modules/ChatModule'))
const CutterRestorationModule = lazy(() => import('./modules/CutterRestorationModule'))
const WarehouseFGPModule = lazy(() => import('./modules/WarehouseFGPModule'))
const Shop2CardGenModule = lazy(() => import('./modules/Shop2CardGen/Shop2CardGenModule'))

import { MESProvider, useMES } from './MESContext'
import { subscribeToPush } from './services/pushService'

// ── Shared loading fallback ─────────────────────────────────────────────────────
const ModuleLoader = () => (
  <div style={{ background: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid #1a1a1a', borderTop: '3px solid #ff9000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <div style={{ color: '#333', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Завантаження модуля...</div>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
)





// ── Permission Guard for Routes ────────────────────────────────────────────────

// ── Permission Guard for Routes ────────────────────────────────────────────────
const PermissionGuard = ({ id, children }) => {
  const { currentUser, managementTasks } = useMES()
  const location = useLocation()

  if (!currentUser) return <ModuleErrorBoundary moduleName={id}>{children}</ModuleErrorBoundary>

  // Allow public call route
  if (id === 'public_call') return <ModuleErrorBoundary moduleName={id}>{children}</ModuleErrorBoundary>

  const availableModules = getAvailableModules(currentUser, 0)
  const hasAccess = availableModules.some(m => m.id === id)

  if (!hasAccess) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '20px', color: '#fff', textAlign: 'center' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
          <AlertTriangle size={40} />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>У вас немає прав доступу</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', maxWidth: '400px', margin: '0 0 20px' }}>
          Доступ до цього модуля обмежено налаштуваннями вашого облікового запису. Зверніться до адміністратора для отримання дозволу.
        </p>
        <Link to="/" style={{ background: '#ff9000', color: '#000', textDecoration: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', transition: '0.2s' }}>
          Повернутися на головну
        </Link>
      </div>
    )
  }

  return <ModuleErrorBoundary moduleName={id}>{children}</ModuleErrorBoundary>
}

const ScrollToTop = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const SystemAlertHost = () => {
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (value) => {
      setMessage(value === undefined || value === null ? '' : String(value))
    }
    return () => {
      window.alert = originalAlert
    }
  }, [])

  if (message === null) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50000,
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={() => setMessage(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(520px, 100%)',
          background: '#111',
          border: '1px solid rgba(59,130,246,.45)',
          borderRadius: '14px',
          boxShadow: '0 24px 80px rgba(0,0,0,.55)',
          overflow: 'hidden'
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', borderBottom: '1px solid #222' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(59,130,246,.14)', border: '1px solid rgba(59,130,246,.45)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 950, fontSize: '.95rem', letterSpacing: '.02em' }}>Повідомлення системи</div>
            <div style={{ color: '#666', fontWeight: 800, fontSize: '.72rem', marginTop: '3px', textTransform: 'uppercase' }}>Centrum MES</div>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              border: '1px solid #2a2a2a',
              background: '#171717',
              color: '#aaa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '18px 20px 6px', color: '#cbd5e1', fontSize: '.88rem', lineHeight: 1.55, fontWeight: 750, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              background: '#3b82f6',
              border: 'none',
              color: '#fff',
              borderRadius: '9px',
              padding: '10px 18px',
              fontWeight: 950,
              cursor: 'pointer',
              minWidth: 90
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}


// ── User Profile Settings Modal ────────────────────────────────────────────────

// ── User Profile Settings Modal ────────────────────────────────────────────────
const ProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, upsertUser } = useMES()
  const [firstName, setFirstName] = useState(currentUser?.first_name || '')
  const [lastName, setLastName] = useState(currentUser?.last_name || '')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.first_name || '')
      setLastName(currentUser.last_name || '')
    }
  }, [currentUser])

  if (!isOpen || !currentUser) return null

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        ...currentUser,
        first_name: firstName.trim(),
        last_name: lastName.trim()
      }
      if (password.trim()) {
        payload.password = password.trim()
      }
      await upsertUser(payload)
      alert('Профіль успішно оновлено!')
      onClose()
    } catch (err) {
      alert('Помилка оновлення профілю: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', borderRadius: '24px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '28px', color: 'var(--text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #ff9000, #e65100)', color: '#000', fontWeight: 950, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950 }}>Налаштування Профілю</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentUser.login} · {currentUser.position || 'Спеціаліст'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Ім'я</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Введіть ім'я..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Прізвище</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Введіть прізвище..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Змінити Пароль (залиште порожнім, щоб не змінювати)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новий пароль..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', fontWeight: 800, cursor: 'pointer' }}>
              Скасувати
            </button>
            <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #ff9000, #e65100)', color: '#000', fontWeight: 950, cursor: 'pointer' }}>
              {isSaving ? 'Збереження...' : 'Зберегти Профіль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Notification Center Modal Component ───────────────────────────────────────
const NotificationCenterModal = ({ isOpen, onClose, notifications = [], unreadCount = 0, readIds = [], markAsRead, markAllAsRead }) => {
  const navigate = useNavigate()
  if (!isOpen) return null

  const handleNotificationClick = (item) => {
    if (markAsRead) markAsRead(item.id)
    onClose()
    if (item.path) {
      navigate(item.path, { state: item.state })
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffSec = Math.floor((now - date) / 1000)
      if (diffSec < 60) return 'щойно'
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin} хв. тому`
      const diffHours = Math.floor(diffMin / 60)
      if (diffHours < 24) return `${diffHours} год. тому`
      const diffDays = Math.floor(diffHours / 24)
      if (diffDays === 1) return 'вчора'
      return `${diffDays} дн. тому`
    } catch {
      return ''
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(540px, 95vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          background: 'var(--card-bg, #0c0d12)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          color: 'var(--text, #fff)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(255,144,0,0.14)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 950, letterSpacing: '-0.3px' }}>Центр Сповіщень</h2>
                {unreadCount > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 950, padding: '2px 8px', borderRadius: '12px' }}>
                    {unreadCount} нових
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                Активні сповіщення та завдання системи
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{ background: 'rgba(255,144,0,0.12)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', padding: '6px 12px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Прочитати все
              </button>
            )}
            <button
              onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <BellOff size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>Сповіщень немає</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Усі події прочитані та оброблені</div>
              </div>
            </div>
          ) : (
            notifications.map(item => {
              const isUnread = !readIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '16px',
                    background: isUnread ? 'rgba(255,144,0,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isUnread ? 'rgba(255,144,0,0.3)' : 'var(--glass-border, rgba(255,255,255,0.06))'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '11px', background: `${item.color}20`, border: `1px solid ${item.color}40`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ fontWeight: isUnread ? 900 : 700, fontSize: '0.88rem', color: isUnread ? 'var(--text, #fff)' : 'var(--text-muted, #cbd5e1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', flexShrink: 0, fontWeight: 700 }}>
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9000', boxShadow: '0 0 8px #ff9000', marginTop: '6px', flexShrink: 0 }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── App Layout Wrapper ────────────────────────────────────────────────────────
const AppLayout = ({ children, chatUnreadCount }) => {
  const { currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders } = useMES()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 900)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  // Track read notification IDs in localStorage per user
  const [readNotifIds, setReadNotifIds] = useState(() => {
    if (!currentUser) return []
    try {
      const saved = localStorage.getItem(`MES_READ_NOTIF_${currentUser.id}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`MES_READ_NOTIF_${currentUser.id}`, JSON.stringify(readNotifIds))
    }
  }, [readNotifIds, currentUser])

  // Build active notifications list across all 6 system sources
  const notifications = useMemo(() => {
    const list = []
    if (!currentUser) return list
    const availableModules = getAvailableModules(currentUser, 0)
    const hasModule = (id) => availableModules.some(m => m.id === id)

    // 0. New Orders awaiting Batch/Task
    const hasOrderCreationAccess = hasModule('director') || hasModule('master') || hasModule('foreman')
    if (hasOrderCreationAccess && orders) {
      orders.forEach(order => {
        if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return
        const orderTasks = (tasks || []).filter(t => t.order_id === order.id)
        if (orderTasks.length === 0 && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'shipped') {
          let path = '/'
          if (hasModule('master')) path = '/master'
          else if (hasModule('foreman')) path = '/foreman'
          else if (hasModule('director')) path = '/director'

          const productNames = (order.order_items || [])
            .map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name)
            .filter(Boolean)
            .join(', ') || '—'

          list.push({
            id: `order-new-${order.id}`,
            type: 'order_new',
            title: `Нове замовлення № ${order.order_num}`,
            description: `Очікує на створення наряду. Виріб: ${productNames}`,
            createdAt: order.created_at,
            path,
            color: '#3b82f6',
            icon: <Monitor size={16} />
          })
        }
      })
    }

    // 1. Kanban Tasks
    if (hasModule('kanban') && managementTasks) {
      managementTasks.forEach(t => {
        if (t.status !== 'done' && (t.assigned_to === currentUser.login || t.created_by === currentUser.login)) {
          list.push({
            id: `task-${t.id}`,
            type: 'task',
            title: `Задача: ${t.title || 'Без назви'}`,
            description: t.description || 'Немає опису',
            createdAt: t.created_at,
            path: '/tasks',
            color: '#8b5cf6',
            icon: <KanbanSquare size={16} />
          })
        }
      })
    }

    // 2. Material Requests
    const hasWarehouseAccess = hasModule('warehouse') || hasModule('supply') || hasModule('master') || hasModule('foreman') || hasModule('director')
    if (hasWarehouseAccess && requests) {
      const groups = {}
      requests.forEach(r => {
        if (r.status === 'pending') {
          const order = orders?.find(o => o.id === r.order_id)
          const orderNum = order?.order_num || ''
          let batchIndex = ''
          if (r.details) {
            const batchMatch = r.details.match(/\(([^)]+\/\d+)\)/)
            if (batchMatch) {
              const parts = batchMatch[1].split('/')
              batchIndex = parts[parts.length - 1]
            }
          }
          if (!batchIndex && r.task_id && tasks) {
            const task = tasks.find(t => t.id === r.task_id)
            if (task?.batch_index) batchIndex = task.batch_index
          }

          const groupKey = `${r.order_id}_${r.task_id || 'null'}_${batchIndex || 'no-batch'}`
          if (!groups[groupKey]) {
            groups[groupKey] = { orderId: r.order_id, orderNum, batchIndex, taskId: r.task_id, count: 0, items: [], latestCreatedAt: r.created_at }
          }
          groups[groupKey].count += 1
          if (r.created_at > groups[groupKey].latestCreatedAt) groups[groupKey].latestCreatedAt = r.created_at
          let itemName = ''
          if (r.details) {
            const splitCol = r.details.split(': ')
            itemName = splitCol.length > 1 ? splitCol[1].split(' — ')[0] : r.details
          }
          if (itemName) groups[groupKey].items.push(itemName)
        }
      })

      Object.entries(groups).forEach(([key, g]) => {
        let path = '/'
        if (hasModule('supply')) path = '/supply'
        else if (hasModule('warehouse')) path = '/warehouse'
        else if (hasModule('foreman')) path = '/foreman'
        else if (hasModule('master')) path = '/master'
        else if (hasModule('director')) path = '/director'

        const batchStr = g.batchIndex ? `/${g.batchIndex}` : ''
        const orderPart = g.orderNum ? ` (№ ${g.orderNum}${batchStr})` : ''
        const desc = g.count === 1 ? (g.items[0] || 'Новий запит матеріалу') : `Запит на ${g.count} позицій: ${g.items.slice(0, 3).join(', ')}${g.items.length > 3 ? '...' : ''}`

        list.push({
          id: `req-group-${key}`,
          type: 'request',
          title: `Запит матеріалів${orderPart}`,
          description: desc,
          createdAt: g.latestCreatedAt,
          path,
          color: '#10b981',
          icon: <ClipboardList size={16} />,
          state: { highlightTaskId: g.taskId }
        })
      })
    }

    // 3. Work Cards
    if (workCards) {
      workCards.forEach(w => {
        if (w.status === 'new') {
          const op = (w.operation || '').toLowerCase()
          const isShop1 = ['розкрій', 'галтовка', 'прийомка'].some(o => op.includes(o))
          const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання'].some(o => op.includes(o))
          let isRelevant = false
          let path = '/'

          if (isShop1) {
            isRelevant = hasModule('shop1') || hasModule('master') || hasModule('foreman') || hasModule('director')
            if (isRelevant) {
              if (hasModule('shop1')) path = '/shop1'
              else if (hasModule('master')) path = '/master'
              else if (hasModule('foreman')) path = '/foreman'
              else if (hasModule('director')) path = '/director'
            }
          } else if (isShop2) {
            isRelevant = hasModule('shop2_terminal') || hasModule('shop2') || hasModule('master') || hasModule('foreman') || hasModule('director')
            if (isRelevant) {
              if (hasModule('shop2_terminal')) path = '/shop2-terminal'
              else if (hasModule('shop2')) path = '/shop2'
              else if (hasModule('foreman')) path = '/foreman'
              else if (hasModule('master')) path = '/master'
              else if (hasModule('director')) path = '/director'
            }
          } else {
            isRelevant = hasModule('master') || hasModule('foreman') || hasModule('director')
            if (isRelevant) {
              if (hasModule('foreman')) path = '/foreman'
              else if (hasModule('master')) path = '/master'
              else if (hasModule('director')) path = '/director'
            }
          }

          if (isRelevant) {
            list.push({
              id: `wc-${w.id}`,
              type: 'work_card',
              title: `Нова картка: ${w.operation || 'Операція'}`,
              description: w.card_info || `Кількість: ${w.quantity}`,
              createdAt: w.created_at,
              path,
              color: '#eab308',
              icon: <Tablet size={16} />
            })
          }
        }
      })
    }

    // 4. Machine Calls
    if (machineCalls) {
      machineCalls.forEach(c => {
        if (c.status === 'pending') {
          const mach = machines?.find(m => m.id === c.machine_id)
          const machName = mach ? mach.name : 'Верстат'
          let isRelevant = false
          if (c.called_employee_id) {
            isRelevant = currentUser?.id === c.called_employee_id
          } else {
            if (c.called_role === 'master') isRelevant = currentUser?.access_rights?.master || currentUser?.access_rights?.foreman
            else if (c.called_role === 'engineer') isRelevant = currentUser?.access_rights?.engineer
            else if (c.called_role === 'quality' || c.called_role === 'qc') isRelevant = currentUser?.access_rights?.brak || currentUser?.position?.toLowerCase().includes('вкя')
          }

          if (isRelevant) {
            list.push({
              id: `call-${c.id}`,
              type: 'machine_call',
              title: `Виклик до ${machName}`,
              description: c.reason || 'Аварійна зупинка / Наналагодження',
              createdAt: c.created_at,
              path: '/machines',
              color: '#ef4444',
              icon: <AlertTriangle size={16} />
            })
          }
        }
      })
    }

    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders])

  const unreadNotifCount = useMemo(() => {
    return notifications.filter(n => !readNotifIds.includes(n.id)).length
  }, [notifications, readNotifIds])

  const markNotifAsRead = (id) => {
    setReadNotifIds(prev => prev.includes(id) ? prev : [...prev, id])
  }

  const markAllNotifsAsRead = () => {
    setReadNotifIds(notifications.map(n => n.id))
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setIsCollapsed(true)
    }
  }, [location.pathname])

  const isPublicCall = /^\/machines\/[^/]+\/call$/.test(location.pathname)
  if (location.pathname === '/login' || isPublicCall || !currentUser) {
    return <>{children}</>
  }

  const isTvDashboard = ['/preparation-dashboard', '/tumbling-dashboard'].includes(location.pathname)

  return (
    <div className="app-shell">
      {!isTvDashboard && (
        <AppSidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          chatUnreadCount={chatUnreadCount}
          unreadNotifCount={unreadNotifCount}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />
      )}
      <div className="app-main-content">
        {children}
      </div>
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotifCount}
        readIds={readNotifIds}
        markAsRead={markNotifAsRead}
        markAllAsRead={markAllNotifsAsRead}
      />
    </div>
  )
}

const AppContent = () => {
  const { currentUser, sessionLoading, supabase } = useMES()
  const location = useLocation()
  // Own unread tracking once for the lifetime of the authenticated app. This
  // avoids overlapping REST/RPC reads while Portal redirects to a role module.
  const chatUnreadCount = useChatUnreadCount(currentUser, supabase)

  // Поки перевіряємо сесію з Supabase — показуємо спіннер (не редіректимо)
  if (sessionLoading) {
    return (
      <div style={{ background: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <img src="/kulytsya.png" alt="Logo" style={{ height: '60px', filter: 'drop-shadow(0 0 15px rgba(255,144,0,0.4))', animation: 'spin 2s linear infinite' }} />
        <div style={{ color: '#333', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Завантаження...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // РЕДИРЕКТ НА /login ЯКЩО НЕ АВТОРИЗОВАНИЙ (крім публічної сторінки виклику)
  const isPublicCall = /^\/machines\/[^/]+\/call$/.test(location.pathname)
  if (!currentUser && location.pathname !== '/login' && !isPublicCall) {
    if (location.pathname && location.pathname !== '/' && location.pathname !== '/login') {
      sessionStorage.setItem('redirect_to', location.pathname + location.search);
    }
    return <Navigate to="/login" replace />
  }

  // РЕДИРЕКТ З /login НА ГОЛОВНУ ЯКЩО ВЖЕ АВТОРИЗОВАНИЙ (збереження початкового шляху переходу)
  if (currentUser && location.pathname === '/login') {
    const redirectTo = sessionStorage.getItem('redirect_to') || '/';
    sessionStorage.removeItem('redirect_to');
    return <Navigate to={redirectTo} replace />
  }

  return (
    <AppLayout chatUnreadCount={chatUnreadCount}>
      <ScrollToTop />
      <SystemAlertHost />
      <Suspense fallback={<ModuleLoader />}>
        {currentUser && location.pathname !== '/login' && (
          <GlobalUserNav key={currentUser.id} chatUnreadCount={chatUnreadCount} />
        )}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PortalDashboard chatUnreadCount={chatUnreadCount} />} />
          <Route path="/crm" element={<PermissionGuard id="crm"><CrmModule /></PermissionGuard>} />
          <Route path="/crm/clients" element={<PermissionGuard id="crm_clients"><CrmClientsModule /></PermissionGuard>} />
          <Route path="/foreman-dashboard" element={<PermissionGuard id="foreman_dashboard"><ForemanDashboardModule /></PermissionGuard>} />
          <Route path="/manager" element={<PermissionGuard id="manager"><ManagerModule /></PermissionGuard>} />
          <Route path="/warehouse" element={<PermissionGuard id="warehouse"><WarehouseModule /></PermissionGuard>} />
          <Route path="/warehouse-fgp" element={<PermissionGuard id="warehouse_fgp"><WarehouseFGPModule /></PermissionGuard>} />
          <Route path="/warehouse-boxes" element={<PermissionGuard id="warehouse_boxes"><WarehouseBoxesModule /></PermissionGuard>} />
          <Route path="/cutter-restoration" element={<PermissionGuard id="cutter_restoration"><CutterRestorationModule /></PermissionGuard>} />
          <Route path="/master" element={<PermissionGuard id="master"><MasterModule /></PermissionGuard>} />
          <Route path="/foreman" element={<PermissionGuard id="foreman"><Foreman2Module /></PermissionGuard>} />
          <Route path="/foreman2" element={<PermissionGuard id="foreman"><Foreman2Module /></PermissionGuard>} />
          <Route path="/operator" element={<PermissionGuard id="operator"><OperatorTerminal /></PermissionGuard>} />
          <Route path="/prep-terminal" element={<PermissionGuard id="prep_terminal"><PreparationTerminal /></PermissionGuard>} />
          <Route path="/preparation-dashboard" element={<PermissionGuard id="preparation_dashboard"><PreparationDashboard /></PermissionGuard>} />
          <Route path="/shop1" element={<PermissionGuard id="shop1"><Shop1Terminal /></PermissionGuard>} />
          <Route path="/shop1-foreman" element={<PermissionGuard id="shop1_foreman"><Shop1ForemanModule /></PermissionGuard>} />
          <Route path="/tumbling-terminal" element={<PermissionGuard id="tumbling_terminal"><TumblingTerminal /></PermissionGuard>} />
          <Route path="/tumbling-dashboard" element={<PermissionGuard id="tumbling_dashboard"><TumblingDashboard /></PermissionGuard>} />
          <Route path="/reception-terminal" element={<PermissionGuard id="reception_terminal"><ReceptionTerminal /></PermissionGuard>} />
          <Route path="/sorting-terminal" element={<PermissionGuard id="sorting_terminal"><SortingTerminal /></PermissionGuard>} />
          <Route path="/shop2" element={<PermissionGuard id="shop2"><Shop2Module /></PermissionGuard>} />
          <Route path="/shop2-card-gen" element={<PermissionGuard id="shop2_card_gen"><Shop2CardGenModule /></PermissionGuard>} />
          <Route path="/shop2-terminal" element={<PermissionGuard id="shop2_terminal"><Shop2Terminal /></PermissionGuard>} />
          <Route path="/pressing-terminal" element={<PermissionGuard id="pressing_terminal"><PressingTerminal /></PermissionGuard>} />
          <Route path="/painting-terminal" element={<PermissionGuard id="painting_terminal"><PaintingTerminal /></PermissionGuard>} />
          <Route path="/packaging" element={<PermissionGuard id="packaging"><PackagingModule /></PermissionGuard>} />
          <Route path="/engineer" element={<PermissionGuard id="engineer"><EngineerModule /></PermissionGuard>} />
          <Route path="/engineer-v2" element={<PermissionGuard id="engineer_v2"><EngineerV2Module /></PermissionGuard>} />
          <Route path="/director" element={<PermissionGuard id="director"><DirectorModule /></PermissionGuard>} />
          <Route path="/shipping" element={<PermissionGuard id="shipping"><ShippingModule /></PermissionGuard>} />
          <Route path="/supply" element={<PermissionGuard id="supply"><SupplyModule /></PermissionGuard>} />
          <Route path="/nomenclature" element={<PermissionGuard id="nomenclature"><NomenclatureModule /></PermissionGuard>} />
          <Route path="/nomenclature-v2" element={<PermissionGuard id="nomenclature_v2"><NomenclatureV2 /></PermissionGuard>} />
          <Route path="/economy" element={<PermissionGuard id="economy"><EconomyModule /></PermissionGuard>} />
          <Route path="/machines" element={<PermissionGuard id="machines"><MachinesModule /></PermissionGuard>} />
          <Route path="/machines/:id/call" element={<PermissionGuard id="public_call"><MachineCallModule /></PermissionGuard>} />
          <Route path="/analytics" element={<PermissionGuard id="analytics"><AnalyticsModule /></PermissionGuard>} />
          <Route path="/brak" element={<PermissionGuard id="brak"><BrakModule /></PermissionGuard>} />
          <Route path="/brak/restoration" element={<PermissionGuard id="brak"><VKYARestorationTerminal /></PermissionGuard>} />
          <Route path="/brak/settings" element={<PermissionGuard id="brak"><VKYASettings /></PermissionGuard>} />
          <Route path="/tasks" element={<PermissionGuard id="kanban"><KanbanModule /></PermissionGuard>} />
          <Route path="/tasks/projects" element={<PermissionGuard id="kanban"><TaskProjectsModule /></PermissionGuard>} />
          <Route path="/chat" element={<PermissionGuard id="chat"><ChatModule /></PermissionGuard>} />
          <Route path="/access" element={<PermissionGuard id="access"><AccessModule /></PermissionGuard>} />
          <Route path="/procurement" element={<PermissionGuard id="procurement"><SupplyModule isProcurementOnly={true} /></PermissionGuard>} />
          <Route path="/reports" element={<PermissionGuard id="reports"><ReportsModule /></PermissionGuard>} />
          <Route path="/settings" element={<PermissionGuard id="settings"><SettingsModule /></PermissionGuard>} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/user-settings" element={<UserSettingsPage />} />
          <Route path="/profile-settings" element={<UserSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  )
}

function App() {
  return (
    <MESProvider>
      <AppContent />
    </MESProvider>
  )
}

export default App
