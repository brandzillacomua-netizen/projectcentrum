import React from 'react'

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
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary] Unhandled render error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f8fafc' }}>
        <section style={{ width: 'min(560px, 100%)', padding: 28, borderRadius: 16, background: '#fff', boxShadow: '0 16px 45px rgba(15, 23, 42, 0.14)' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 24, color: '#0f172a' }}>Інтерфейс тимчасово зупинився</h1>
          <p style={{ margin: '0 0 20px', lineHeight: 1.5, color: '#475569' }}>
            Дані в базі не втрачено. Перезавантажте застосунок, щоб відновити роботу.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{ border: 0, borderRadius: 10, padding: '11px 18px', color: '#fff', background: '#0f766e', cursor: 'pointer', fontWeight: 700 }}
          >
            Перезавантажити
          </button>
        </section>
      </main>
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
        color: '#fff',
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

export function ServiceWorkerUpdateManager() {
  const [registration, setRegistration] = React.useState(null)
  const [updateReady, setUpdateReady] = React.useState(false)
  const activationRequestedRef = React.useRef(false)

  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    let disposed = false
    let refreshing = false
    const workerListeners = []

    const inspectWorker = (worker) => {
      if (!worker) return
      const handleStateChange = () => {
        if (!disposed && worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateReady(true)
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

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        if (disposed) return
        setRegistration(reg)
        if (reg.waiting) setUpdateReady(true)
        const handleUpdateFound = () => inspectWorker(reg.installing)
        reg.addEventListener('updatefound', handleUpdateFound)
        workerListeners.push(() => reg.removeEventListener('updatefound', handleUpdateFound))
        reg.update().catch(() => {})
      })
      .catch(error => console.error('[SW] Registration failed:', error))

    return () => {
      disposed = true
      workerListeners.forEach(removeListener => removeListener())
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const activateUpdate = () => {
    const waitingWorker = registration?.waiting
    if (!waitingWorker) {
      registration?.update().catch(() => {})
      return
    }
    activationRequestedRef.current = true
    waitingWorker.postMessage('SKIP_WAITING')
  }

  if (!updateReady) return null

  return (
    <div style={{
      position: 'fixed',
      top: 18,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100001,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      maxWidth: 'calc(100vw - 24px)',
      padding: '13px 18px',
      border: '1px solid #ff9000',
      borderRadius: 14,
      color: '#fff',
      background: 'rgba(10, 10, 15, 0.97)',
      boxShadow: '0 10px 30px rgba(0,0,0,.4)'
    }}>
      <div>
        <strong style={{ display: 'block', fontSize: 13 }}>Доступна стабільніша версія</strong>
        <span style={{ color: '#aaa', fontSize: 11 }}>Оновлення доступне також на екрані входу.</span>
      </div>
      <button
        type="button"
        onClick={activateUpdate}
        style={{ border: 0, borderRadius: 9, padding: '8px 14px', background: '#ff9000', color: '#000', cursor: 'pointer', fontWeight: 900 }}
      >
        ОНОВИТИ
      </button>
    </div>
  )
}
