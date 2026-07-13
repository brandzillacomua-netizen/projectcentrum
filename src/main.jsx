import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './light.css'

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
  if (event.message && (event.message.includes('Failed to fetch dynamically imported module') || event.message.includes('Importing a module script failed'))) {
    const lastReload = sessionStorage.getItem('last-chunk-reload')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('last-chunk-reload', String(now))
      window.location.reload()
    }
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
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
