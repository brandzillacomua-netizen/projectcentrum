import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './light.css'

// Handle dynamic import / chunk load errors automatically
window.addEventListener('vite:preloadError', (event) => {
  const lastReload = sessionStorage.getItem('last-chunk-reload')
  const now = Date.now()
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('last-chunk-reload', String(now))
    window.location.reload()
  }
})

window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Failed to fetch dynamically imported module') || e.message.includes('Importing a module script failed'))) {
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
  </React.StrictMode>,
)

// TEMPORARY FIX SCRIPT TO DELETE 164th CARD FOR П-7-46
setTimeout(async () => {
  try {
    const { supabase } = await import('./supabase.js');
    
    // FIX FOR П-7-46
    const { data } = await supabase.from('work_cards').select('id, card_info').ilike('card_info', '%164/218%').limit(1);
    if (data && data[0]) {
      await supabase.from('work_cards').delete().eq('id', data[0].id);
      console.log('DELETED CARD 164/218 SUCCESSFULLY!');
    }

    // FIX FOR 42nd card of К-ІП9...
    const { data: noms } = await supabase.from('nomenclatures').select('id').ilike('name', '%Київ К-ІП9/10/31/36/37-9-10-11-В-3-30%').limit(1);
    if (noms && noms.length) {
      const { data: cardsToFix } = await supabase.from('work_cards').select('id, quantity, card_info').eq('nomenclature_id', noms[0].id).eq('quantity', 60);
      if (cardsToFix && cardsToFix.length > 0) {
        for (const c of cardsToFix) {
          await supabase.from('work_cards').update({ quantity: 90, card_info: c.card_info.replace('REQ:60', 'REQ:90').replace(/42\/\d+/, '42/42') }).eq('id', c.id);
          console.log('Fixed card:', c.id);
          alert('Знайшов і виправив дефектну 42-гу картку (в ній було 60 шт замість 90 шт)! Тепер має бути 42/42!');
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}, 3000);
