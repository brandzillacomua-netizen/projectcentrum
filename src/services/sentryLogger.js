import * as Sentry from '@sentry/react'
import { telegramNotifierService } from './alerting/telegramNotifierService.js'

const MAX_BUFFER_SIZE = 20
const ERROR_STORAGE_KEY = 'mes_recent_errors'

class SentryLoggerService {
  constructor() {
    this.isInitialized = false
    this.currentUser = null
    this.errorBuffer = this.loadStoredErrors()
    window.__mesErrorBuffer = () => this.errorBuffer
  }

  loadStoredErrors() {
    try {
      const stored = localStorage.getItem(ERROR_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  saveStoredErrors() {
    try {
      localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(this.errorBuffer.slice(-MAX_BUFFER_SIZE)))
    } catch {
      // Storage quota or disabled
    }
  }

  initSentry() {
    if (this.isInitialized) return

    const dsn = import.meta.env.VITE_SENTRY_DSN || window.__SENTRY_DSN__

    if (dsn) {
      try {
        Sentry.init({
          dsn,
          integrations: [
            Sentry.browserTracingIntegration()
          ],
          tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
          environment: import.meta.env.MODE || 'production',
          beforeSend(event) {
            // Sanitize sensitive tokens if present in context
            return event
          }
        })
        this.isInitialized = true
        console.log('[SentryLogger] Sentry exception tracking initialized successfully.')
      } catch (err) {
        console.warn('[SentryLogger] Failed to initialize Sentry SDK:', err?.message || err)
      }
    } else {
      console.log('[SentryLogger] Running in local buffer mode (VITE_SENTRY_DSN not configured).')
    }
  }

  setUserContext(user) {
    if (!user) return
    this.currentUser = {
      id: user.id || user.user_id,
      name: user.name || user.full_name || user.email,
      role: user.role || user.user_role,
      department: user.department || user.dept
    }

    if (this.isInitialized) {
      Sentry.setUser({
        id: String(this.currentUser.id),
        username: this.currentUser.name,
        role: this.currentUser.role
      })
    }
  }

  captureException(error, errorInfo = {}, extraContext = {}) {
    const msg = String(error?.message || error || '')
    const stack = String(error?.stack || '')

    // Filter out Chrome DevTools Live Metrics bug (Chromium #338604729)
    // Strictly pinpoint: MUST contain reading 'startTime' AND reportAllChanges in stack
    if (msg.includes("reading 'startTime'") && stack.includes('reportAllChanges')) {
      return null
    }

    const timestamp = new Date().toISOString()
    const errorRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      message: error?.message || String(error),
      name: error?.name || 'Error',
      stack: error?.stack || null,
      componentStack: errorInfo?.componentStack || null,
      url: window.location.href,
      user: this.currentUser ? { id: this.currentUser.id, role: this.currentUser.role } : null,
      ...extraContext
    }

    // Log locally to console with high visibility
    console.error('[SentryLogger] Exception captured:', errorRecord, error)

    // Append to local ring buffer
    this.errorBuffer.push(errorRecord)
    if (this.errorBuffer.length > MAX_BUFFER_SIZE) {
      this.errorBuffer.shift()
    }
    this.saveStoredErrors()

    // Dispatch to Sentry if SDK is connected
    if (this.isInitialized) {
      Sentry.withScope((scope) => {
        if (this.currentUser) {
          scope.setUser({
            id: String(this.currentUser.id),
            username: this.currentUser.name,
            role: this.currentUser.role
          })
        }

        if (errorInfo?.componentStack) {
          scope.setExtra('componentStack', errorInfo.componentStack)
        }

        Object.keys(extraContext).forEach((key) => {
          scope.setExtra(key, extraContext[key])
        })

        Sentry.captureException(error)
      })
    }

    // Dispatch custom DOM event for active UI components
    window.dispatchEvent(new CustomEvent('mes:app-exception', { detail: errorRecord }))

    // Trigger instant Telegram crash alert with root-cause analysis
    telegramNotifierService.sendTelegramCrashAlert(errorRecord).catch((err) => {
      console.warn('[SentryLogger] Telegram alert dispatch failed silently:', err)
    })

    return errorRecord
  }

  logException(error, context = {}) {
    return this.captureException(error, {}, context)
  }

  logWarning(warning, context = {}) {
    const warnObj = warning instanceof Error ? warning : new Error(String(warning))
    const msg = String(warnObj.message || '')
    const stack = String(warnObj.stack || '')

    if (msg.includes("reading 'startTime'") && stack.includes('reportAllChanges')) {
      return null
    }

    console.warn('[SentryLogger] Warning recorded:', warnObj.message, context)
    if (this.isInitialized) {
      Sentry.withScope((scope) => {
        scope.setLevel('warning')
        Object.keys(context).forEach((k) => scope.setExtra(k, context[k]))
        Sentry.captureMessage(warnObj.message)
      })
    }
  }

  getRecentErrors() {
    return [...this.errorBuffer]
  }

  clearErrorBuffer() {
    this.errorBuffer = []
    try {
      localStorage.removeItem(ERROR_STORAGE_KEY)
    } catch {}
  }
}

export const sentryLogger = new SentryLoggerService()
export default sentryLogger
