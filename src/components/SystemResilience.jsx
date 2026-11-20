import React from 'react'
import { sentryLogger } from '../services/sentryLogger'

const STATUS_META = {
  offline: {
    label: 'OFFLINE',
    description: 'Немає мережі. Показано останні збережені дані.',
    background: '#991b1b'
  },
  reconnecting: {
    label: 'ВІДНОВЛЕННЯ',
    description: 'Відновлюємо живе з’єднання з системою…',
    background: '#92400e'
  }
}

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    sentryLogger.captureException(error, errorInfo, { source: 'AppErrorBoundary' })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleSoftReset = () => {
    this.setState({ error: null, errorInfo: null })
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <section style={{ width: 'min(620px, 100%)', padding: 32, borderRadius: 20, background: '#111827', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239, 68, 68, 0.15)', display: 'grid', placeItems: 'center', color: '#ef4444', fontSize: 24 }}>
              ⚠️
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>Інтерфейс терміналу зупинився</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Зафіксовано необроблену виняткову ситуацію JavaScript</p>
            </div>
          </div>

          <p style={{ margin: '0 0 20px', lineHeight: 1.6, color: '#cbd5e1', fontSize: 14 }}>
            Дані цеху та збережені операції в базі Supabase <strong>не втрачено</strong>. Ви можете відновити робочий екран або перезавантажити сторінку терміналу.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              type="button"
              onClick={this.handleSoftReset}
              style={{ border: 0, borderRadius: 10, padding: '12px 22px', color: '#fff', background: '#2563eb', cursor: 'pointer', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }}
            >
              Відновити робоче місце
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{ border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: 10, padding: '12px 22px', color: '#e2e8f0', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
            >
              Перезавантажити термінал
            </button>
            <button
              type="button"
              onClick={this.toggleDetails}
              style={{ border: 0, borderRadius: 10, padding: '12px 16px', color: '#94a3b8', background: 'var(--fill-subtle)', cursor: 'pointer', fontWeight: 600, fontSize: 13, marginLeft: 'auto' }}
            >
              {this.state.showDetails ? 'Сховати деталі' : 'Технічні деталі'}
            </button>
          </div>

          {this.state.showDetails && (
            <div style={{ padding: 16, borderRadius: 12, background: '#030712', border: '1px solid #1f2937', fontSize: 12, color: '#f87171', fontFamily: 'monospace', overflowX: 'auto', maxHeight: 200 }}>
              <strong>{this.state.error?.name}: {this.state.error?.message}</strong>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: '#94a3b8', fontSize: 11 }}>
                {this.state.error?.stack}
              </pre>
            </div>
          )}
        </section>
      </main>
    )
  }
}

export class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    sentryLogger.captureException(error, errorInfo, { source: 'ModuleErrorBoundary', moduleName: this.props.moduleName })
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        padding: '24px',
        margin: '24px auto',
        maxWidth: '680px',
        borderRadius: '16px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'rgba(17, 24, 39, 0.95)',
        color: '#f8fafc',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', color: '#ef4444', fontWeight: 800 }}>
          Виникла помилка у модулі {this.props.moduleName ? `«${this.props.moduleName}»` : ''}
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5 }}>
          {this.state.error?.message || 'Помилка виконання JavaScript у цьому компоненті.'}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              border: 0,
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#fff',
              background: '#2563eb',
              cursor: 'pointer',
              fontWeight: 800
            }}
          >
            Спробувати знову
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#94a3b8',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Перезавантажити сторінку
          </button>
        </div>
      </div>
    )
  }
}

export function ConnectionStatus() {
  const [status, setStatus] = React.useState(() => navigator.onLine ? 'live' : 'offline')
  const recoveryTimerRef = React.useRef(null)

  React.useEffect(() => {
    const clearRecoveryTimer = () => {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current)
        recoveryTimerRef.current = null
      }
    }

    const hasUnhealthyChannel = () => Object.values(window.__mesRealtimeChannels || {})
      .some(channelStatus => channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT')

    const hasRecentApiFailure = () => {
      const lastErrorAt = Number(window.__mesApiHealth?.lastErrorAt) || 0
      return lastErrorAt > 0 && Date.now() - lastErrorAt < 15000
    }

    const settleFromCurrentHealth = () => {
      if (!navigator.onLine) {
        setStatus('offline')
      } else if (hasUnhealthyChannel() || hasRecentApiFailure()) {
        setStatus('reconnecting')
      } else {
        setStatus('live')
      }
    }

    const handleOffline = () => {
      clearRecoveryTimer()
      setStatus('offline')
    }

    const handleOnline = () => {
      setStatus('reconnecting')
      clearRecoveryTimer()
      recoveryTimerRef.current = setTimeout(settleFromCurrentHealth, 15000)
    }

    const handleHeartbeat = (event) => {
      const heartbeatStatus = event.detail?.status
      if (heartbeatStatus === 'ok') {
        if (hasUnhealthyChannel() || hasRecentApiFailure()) {
          clearRecoveryTimer()
          setStatus(navigator.onLine ? 'reconnecting' : 'offline')
          recoveryTimerRef.current = setTimeout(settleFromCurrentHealth, 15000)
          return
        }
        clearRecoveryTimer()
        setStatus('live')
      } else if (['timeout', 'error', 'disconnected'].includes(heartbeatStatus)) {
        clearRecoveryTimer()
        setStatus(navigator.onLine ? 'reconnecting' : 'offline')
      }
    }

    const handleChannelStatus = (event) => {
      if (event.detail?.unhealthy) {
        clearRecoveryTimer()
        setStatus(navigator.onLine ? 'reconnecting' : 'offline')
      } else if (event.detail?.status === 'SUBSCRIBED') {
        clearRecoveryTimer()
        settleFromCurrentHealth()
      }
    }

    const handleApiHealth = (event) => {
      if (!event.detail?.lastErrorAt) return
      if (!hasRecentApiFailure()) return
      clearRecoveryTimer()
      setStatus(navigator.onLine ? 'reconnecting' : 'offline')
      recoveryTimerRef.current = setTimeout(settleFromCurrentHealth, 15000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('mes:realtime-health', handleHeartbeat)
    window.addEventListener('mes:realtime-channel', handleChannelStatus)
    window.addEventListener('mes:api-health', handleApiHealth)

    const initialHeartbeat = window.__mesRealtimeHealth?.status
    if (['timeout', 'error', 'disconnected'].includes(initialHeartbeat)) {
      setStatus(navigator.onLine ? 'reconnecting' : 'offline')
    }

    return () => {
      clearRecoveryTimer()
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('mes:realtime-health', handleHeartbeat)
      window.removeEventListener('mes:realtime-channel', handleChannelStatus)
      window.removeEventListener('mes:api-health', handleApiHealth)
    }
  }, [])

  const meta = STATUS_META[status]
  if (!meta) return null

  return (
    <div
      className="no-print"
      role="status"
      aria-live="polite"
      title={meta.description}
      style={{
        position: 'fixed',
        right: 14,
        bottom: 14,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 360,
        padding: '9px 12px',
        borderRadius: 999,
        color: 'var(--text-strong)',
        background: meta.background,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.24)',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.03em'
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', opacity: 0.9 }} />
      {meta.label}
    </div>
  )
}

const APP_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : ''
const VERSION_CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 min on active tab
const VERSION_CHECK_MIN_GAP_MS = 60 * 1000 // throttle visibility/focus checks
const TV_AUTO_RELOAD_ROUTES = new Set([
  '/preparation-dashboard',
  '/tumbling-dashboard',
  '/dashboard'
])

const isUserEditingField = () => {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!el) return false
  const tag = String(el.tagName || '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function ServiceWorkerUpdateManager() {
  const [registration, setRegistration] = React.useState(null)
  const [updateReady, setUpdateReady] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [countdownSec, setCountdownSec] = React.useState(null)
  const [isDismissed, setIsDismissed] = React.useState(false)
  const activationRequestedRef = React.useRef(false)
  const lastVersionCheckRef = React.useRef(0)
  const postponedUntilRef = React.useRef(0)

  const activateUpdate = React.useCallback(async (e) => {
    if (e) {
      e.preventDefault?.()
      e.stopPropagation?.()
    }
    if (isUpdating) return
    setIsUpdating(true)
    activationRequestedRef.current = true

    let reloaded = false
    const triggerReload = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }

    try {
      const regs = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistrations().catch(() => [])
        : []
      regs.forEach(reg => {
        reg.waiting?.postMessage('SKIP_WAITING')
        reg.installing?.postMessage('SKIP_WAITING')
      })

      if (registration?.waiting) registration.waiting.postMessage('SKIP_WAITING')
      if (registration?.installing) registration.installing.postMessage('SKIP_WAITING')
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('SKIP_WAITING')
      }

      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await window.caches.keys().catch(() => [])
        await Promise.all(cacheKeys.map(k => window.caches.delete(k))).catch(() => {})
      }
    } catch (err) {
      console.warn('[SW] Error during activateUpdate:', err)
    }

    setTimeout(triggerReload, 350)
  }, [isUpdating, registration])

  React.useEffect(() => {
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.localhost')
    )

    if (import.meta.env.DEV || isLocalhost) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister())
        }).catch(() => {})
      }
      return undefined
    }

    let disposed = false
    let refreshing = false
    const workerListeners = []

    const markUpdateAvailable = () => {
      if (disposed) return
      if (Date.now() < postponedUntilRef.current) return
      setIsDismissed(false)
      setUpdateReady(true)

      const isTvRoute = TV_AUTO_RELOAD_ROUTES.has(window.location.pathname)
      if (isTvRoute) {
        activateUpdate()
      } else if (!isUserEditingField()) {
        setCountdownSec(prev => (prev === null ? 5 : prev))
      }
    }

    const checkServerVersion = async (force = false) => {
      if (disposed || !APP_BUILD_ID) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const now = Date.now()
      if (!force && now - lastVersionCheckRef.current < VERSION_CHECK_MIN_GAP_MS) return
      lastVersionCheckRef.current = now

      try {
        const res = await fetch(`/version.json?t=${now}`, { cache: 'no-store' })
        if (!res.ok) return
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) return
        const data = await res.json()
        if (data?.buildId && String(data.buildId) !== APP_BUILD_ID) {
          markUpdateAvailable()
        }
      } catch {
        // Ignore transient offline errors
      }
    }

    const inspectWorker = (worker) => {
      if (!worker) return
      const handleStateChange = () => {
        if (!disposed && worker.state === 'installed' && navigator.serviceWorker?.controller) {
          markUpdateAvailable()
        }
      }
      worker.addEventListener('statechange', handleStateChange)
      workerListeners.push(() => worker.removeEventListener('statechange', handleStateChange))
    }

    const handleControllerChange = () => {
      if (!activationRequestedRef.current || refreshing) return
      refreshing = true
      window.location.reload()
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          if (disposed) return
          setRegistration(reg)
          if (reg.waiting) markUpdateAvailable()
          const handleUpdateFound = () => inspectWorker(reg.installing)
          reg.addEventListener('updatefound', handleUpdateFound)
          workerListeners.push(() => reg.removeEventListener('updatefound', handleUpdateFound))
          reg.update().catch(() => {})
        })
        .catch(error => {
          if (error?.name === 'SecurityError' || String(error?.message || '').includes('SSL') || String(error || '').includes('SecurityError')) {
            return
          }
          console.warn('[SW] Registration skipped:', error?.message || error)
        })
    }

    const initialTimer = setTimeout(() => { checkServerVersion(true) }, 5000)
    const intervalId = setInterval(() => {
      checkServerVersion(false)
    }, VERSION_CHECK_INTERVAL_MS)

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkServerVersion(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)

    return () => {
      disposed = true
      clearTimeout(initialTimer)
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
      workerListeners.forEach(removeListener => removeListener())
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      }
    }
  }, [activateUpdate])

  React.useEffect(() => {
    if (!updateReady || isDismissed || isUpdating || countdownSec === null) return undefined
    if (countdownSec <= 0) {
      if (isUserEditingField()) {
        // Pause auto-reload while user is typing; retry in 5s
        const deferTimer = setTimeout(() => setCountdownSec(5), 5000)
        return () => clearTimeout(deferTimer)
      }
      activateUpdate()
      return undefined
    }
    const tick = setTimeout(() => setCountdownSec(c => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(tick)
  }, [updateReady, isDismissed, isUpdating, countdownSec, activateUpdate])

  const handleDismiss = (e) => {
    if (e) {
      e.preventDefault?.()
      e.stopPropagation?.()
    }
    postponedUntilRef.current = Date.now() + 5 * 60 * 1000
    setCountdownSec(null)
    setIsDismissed(true)
  }

  if (!updateReady || isDismissed) return null

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100050,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        maxWidth: 'calc(100vw - 24px)',
        padding: '10px 16px',
        border: '1px solid #ff9000',
        borderRadius: 14,
        color: '#fff',
        background: 'rgba(10, 10, 15, 0.98)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 12px 36px rgba(0,0,0,.6)',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 13, fontWeight: 900, color: '#ff9000' }}>
          Доступна нова версія системи
        </strong>
        <span style={{ color: '#aaa', fontSize: 11 }}>
          {countdownSec !== null && !isUpdating
            ? `Автоматичне оновлення через ${countdownSec} с...`
            : 'Натисніть «Оновити» для застосування останніх змін.'}
        </span>
      </div>
      <button
        type="button"
        disabled={isUpdating}
        onClick={activateUpdate}
        onTouchEnd={activateUpdate}
        style={{
          border: 0,
          borderRadius: 10,
          padding: '8px 16px',
          background: isUpdating ? '#666' : '#ff9000',
          color: '#000',
          cursor: isUpdating ? 'wait' : 'pointer',
          fontWeight: 900,
          fontSize: 12,
          flexShrink: 0,
          touchAction: 'manipulation',
          transition: 'all 0.2s ease',
          boxShadow: isUpdating ? 'none' : '0 4px 12px rgba(255, 144, 0, 0.35)'
        }}
      >
        {isUpdating ? 'ОНОВЛЕННЯ...' : 'ОНОВИТИ'}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        onTouchEnd={handleDismiss}
        title="Відкласти на 5 хв"
        style={{
          border: 0,
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#aaa',
          cursor: 'pointer',
          borderRadius: 8,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          fontSize: 14,
          fontWeight: 700,
          touchAction: 'manipulation'
        }}
      >
        ✕
      </button>
    </div>
  )
}
