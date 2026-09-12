import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import App from './App'
import { AppErrorBoundary, ConnectionStatus, ServiceWorkerUpdateManager } from './components/SystemResilience'
import { sentryLogger } from './services/sentryLogger'
import './index.css'
import './light.css'

if (typeof window !== 'undefined') {
  window.Html5Qrcode = Html5Qrcode
  if (!localStorage.getItem('theme-reset-light-v1')) {
    localStorage.setItem('app-theme', 'light')
    localStorage.setItem('theme-reset-light-v1', 'true')
  }
  document.body.classList.toggle('light-theme', localStorage.getItem('app-theme') !== 'dark')
}

// Initialize Sentry passive/active tracking engine
sentryLogger.initSentry()

// Handle dynamic import / chunk load errors automatically.
window.addEventListener('vite:preloadError', () => {
  const lastReload = sessionStorage.getItem('last-chunk-reload')
  const now = Date.now()
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('last-chunk-reload', String(now))
    window.location.reload()
  }
})

window.addEventListener('error', (event) => {
  const msg = String(event.error?.message || event.message || '')
  const stack = String(event.error?.stack || '')

  // Ignore strictly the known Chrome DevTools Live Metrics bug (Chromium #338604729 / #543499029)
  // Pinpoint filter: MUST contain reading 'startTime' AND (reportAllChanges in stack OR VM script)
  if (msg.includes("reading 'startTime'") && (stack.includes('reportAllChanges') || msg.includes('reportAllChanges') || !event.filename || String(event.filename).includes('VM'))) {
    event.preventDefault?.()
    event.stopImmediatePropagation?.()
    return true
  }

  if (event.message && (event.message.includes('Failed to fetch dynamically imported module') || event.message.includes('Importing a module script failed'))) {
    const lastReload = sessionStorage.getItem('last-chunk-reload')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('last-chunk-reload', String(now))
      window.location.reload()
    }
  } else if (event.error) {
    sentryLogger.captureException(event.error, {}, { source: 'window.onerror' })
  }
}, true)

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (
    event.reason.message?.includes('Failed to fetch dynamically imported module') ||
    event.reason.message?.includes('Importing a module script failed')
  )) {
    const lastReload = sessionStorage.getItem('last-chunk-reload')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('last-chunk-reload', String(now))
      window.location.reload()
    }
  } else if (event.reason) {
    const errorObj = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    sentryLogger.captureException(errorObj, {}, { source: 'unhandledrejection' })
  }
})

const isTestPath = typeof window !== 'undefined' && (
  window.location.pathname === '/test' ||
  window.location.pathname.startsWith('/test/')
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter basename={isTestPath ? '/test' : ''}>
        <App />
        <ConnectionStatus />
        <ServiceWorkerUpdateManager />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
)
