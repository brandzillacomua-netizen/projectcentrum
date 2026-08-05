import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Tablet, Search, RefreshCw, Play, CheckCircle, AlertTriangle, X, Clock, Layers, Camera, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

// Map Cyrillic keyboard characters to English QWERTY for barcode scanners
const cyrillicToLatinMap = {
  'й':'q', 'ц':'w', 'у':'e', 'к':'r', 'е':'t', 'н':'y', 'г':'u', 'ш':'i', 'щ':'o', 'з':'p', 'х':'[', 'ї':']',
  'ф':'a', 'ы':'s', 'і':'s', 'в':'d', 'а':'f', 'п':'g', 'р':'h', 'о':'j', 'л':'k', 'д':'l', 'ж':';', 'є':'\'',
  'я':'z', 'ч':'x', 'с':'c', 'м':'v', 'и':'b', 'т':'n', 'ь':'m', 'б':',', 'ю':'.', '.':'/',
  'Й':'Q', 'Ц':'W', 'У':'E', 'К':'R', 'Е':'T', 'Н':'Y', 'Г':'U', 'Ш':'I', 'Щ':'O', 'З':'P', 'Х':'{', 'Ї':'}',
  'Ф':'A', 'Ы':'S', 'І':'S', 'В':'D', 'А':'F', 'П':'G', 'Р':'H', 'О':'J', 'Л':'K', 'Д':'L', 'Ж':':', 'Є':'"',
  'Я':'Z', 'Ч':'X', 'С':'C', 'М':'V', 'И':'B', 'Т':'N', 'Ь':'M', 'Б':'<', 'Ю':'>', ',':'?',
  '?':'/', 'ё':'`', 'Ё':'~', '№':'#'
}

const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

const ACCENT = '#8b5cf6'
const ACCENT_RGB = '139,92,246'

export default function PressingTerminal() {
  const { workCards, nomenclatures, getFilteredOperators, fetchData, currentUser } = useMES()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')

  const [manualId, setManualId] = useState('')
  const [scanError, setScanError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [isScanning, setIsScanning] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [activeCompletingCard, setActiveCompletingCard] = useState(null)
  const [scrapCount, setScrapCount] = useState(0)
  const [finishedCount, setFinishedCount] = useState(0)

  const [pendingStartCard, setPendingStartCard] = useState(null)
  const [filterMode, setFilterMode] = useState('all')

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-select user details and shift from the account
  useEffect(() => {
    if (currentUser) {
      setSelectedShift(currentUser.shift || 'Без зміни')
      const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ')
      const displayName = fullName || currentUser.login || ''
      const nameWithPosition = currentUser.position ? `${displayName} (${currentUser.position})` : displayName
      setSelectedOperator(nameWithPosition)
    }
  }, [currentUser])

  const getNom = (card) => nomenclatures.find(n => n.id === card?.nomenclature_id)

  // Wedge Barcode Scanner
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()
    const handleGlobalKeyDown = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const nowTime = Date.now()
      if (nowTime - lastKeyTime > 100) buffer = ''
      lastKeyTime = nowTime
      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          const scannedText = buffer.trim()
          buffer = ''
          if (scannedText.startsWith('CENTRUM_CARD_')) {
            const id = scannedText.replace('CENTRUM_CARD_', '').trim()
            handleCardActionById(id)
          } else {
            try {
              const qrData = JSON.parse(scannedText)
              if (qrData.type === 'work_card_shop2') {
                handleCardActionById(qrData.id)
              }
            } catch (err) {
              handleCardActionById(scannedText)
            }
          }
        }
      } else if (e.key.length === 1) {
        buffer += (cyrillicToLatinMap[e.key] || e.key)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [workCards, selectedOperator, selectedShift])

  // QR-сканер
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode('reader-pressing')
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {})
        setIsScanning(false)
      }
      html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (text) => {
          let cardId = text
          if (text.startsWith('CENTRUM_CARD_')) {
            cardId = text.replace('CENTRUM_CARD_', '').trim()
          } else {
            try {
              const qrData = JSON.parse(text)
              if (qrData.type === 'work_card_shop2') {
                cardId = qrData.id
              }
            } catch (e) {}
          }
          await stopAndClose()
          handleCardActionById(cardId)
        }
      ).catch(err => {
        console.error('Scanner error:', err)
        setScanError(`Помилка камери: ${err}. Перевірте дозволи у браузері.`)
      })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {}) }
  }, [isScanning, workCards])

  const handleCardActionById = async (id) => {
    setIsProcessing(true)
    setScanError(null)
    try {
      let card = workCards.find(c => 
        c.card_info?.includes('[ЦЕХ №2]') && 
        (String(c.id).trim() === id || String(c.id).toUpperCase().endsWith(id.toUpperCase()))
      )
      if (!card) {
        await fetchData('work_cards').catch(() => {})
        card = workCards.find(c => 
          c.card_info?.includes('[ЦЕХ №2]') && 
          (String(c.id).trim() === id || String(c.id).toUpperCase().endsWith(id.toUpperCase()))
        )
      }
      if (!card) {
        setScanError(`Картку №${id} не знайдено в Цеху №2`)
        setIsProcessing(false)
        return
      }

      const isWaiting = (card.status === 'at-shop2-buffer' && card.operation === 'Сортування') || 
                        (card.status === 'new' && card.operation === 'Пресування')
      const isInWork = card.status === 'in-progress' && card.operation === 'Пресування'

      if (isWaiting) {
        setPendingStartCard(card)
        setIsProcessing(false)
        return
      } else if (isInWork) {
        openCompleteModal(card)
      } else {
        setScanError(`Картка #${id.slice(-8).toUpperCase()} — невідповідний статус: [${card.operation}] / [${card.status}]`)
      }
    } catch (e) {
      setScanError(`Помилка обробки: ${e.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const startPressingCard = async (card) => {
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const bufferStart = card.completed_at || card.started_at || now

      const { error: historyError } = await supabase.from('work_card_history').insert([{
        card_id: card.id,
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation === 'Сортування' ? 'Буфер Пресування (після Сортування)' : 'Буфер Пресування',
        operator_name: selectedOperator || card.operator_name || 'Команда',
        qty_at_start: card.quantity || 0,
        qty_completed: card.quantity || 0,
        scrap_qty: 0,
        started_at: bufferStart,
        completed_at: now,
        shift_name: selectedShift,
        manager_name: card.manager_name || 'Не вказано',
        machine_name: card.machine || 'Не вказано'
      }])
      if (historyError) throw new Error(`Не вдалося записати буфер пресування: ${historyError.message}`)

      const { error: cardUpdateError } = await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: 'Пресування',
        started_at: now,
        operator_name: selectedOperator || card.operator_name || 'Команда',
        shift_name: selectedShift
      }).eq('id', card.id)
      if (cardUpdateError) throw new Error(`Не вдалося запустити пресування: ${cardUpdateError.message}`)

      setScanError(null)
      setManualId('')
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      setScanError(`Помилка запуску: ${e.message}`)
    } finally {
      setIsProcessing(false)
      setPendingStartCard(null)
    }
  }

  const openCompleteModal = (card) => {
    setActiveCompletingCard(card)
    setFinishedCount(card.quantity || 0)
    setScrapCount(0)
    setShowCompleteModal(true)
  }

  const submitPressingComplete = async () => {
    if (!activeCompletingCard) return
    if (!selectedOperator) {
      setScanError('Не вдалося визначити авторизованого пресувальника. Оновіть сторінку та увійдіть у систему повторно.')
      return
    }
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const actualFinished = Math.max(0, finishedCount)
      const actualScrap = Math.max(0, scrapCount)
      const op = selectedOperator
      const activeShift = selectedShift || activeCompletingCard.shift_name || 'Без зміни'
      const isVkyaRestoration = String(activeCompletingCard.card_info || '').includes('[VKYA_RESTORATION]')

      if (isVkyaRestoration) {
        const returnsToSourceRoute = String(activeCompletingCard.card_info || '').includes('[VKYA_SOURCE_ROUTE]')
        const { error: completionError } = await supabase.rpc('complete_vkya_shop2_card_to_bz', {
          p_card_id: activeCompletingCard.id,
          p_stage: 'Пресування',
          p_operator_name: op,
          p_shift_name: activeShift,
          p_finished_quantity: actualFinished,
          p_scrap_quantity: actualScrap
        })
        if (completionError) throw completionError
        setShowCompleteModal(false)
        setActiveCompletingCard(null)
        setManualId('')
        setScanError(null)
        await fetchData(['work_cards', 'work_card_history', 'inventory'])
        alert(`✅ ${actualFinished} шт ${returnsToSourceRoute ? 'повернено у маршрут початкового наряду' : 'передано в базовий залишок'}.${actualScrap > 0 ? ` ${actualScrap} шт передано у ВКЯ.` : ''}`)
        return
      }

      const { error: historyError } = await supabase.from('work_card_history').insert([{
        card_id: activeCompletingCard.id,
        nomenclature_id: activeCompletingCard.nomenclature_id,
        stage_name: 'Пресування',
        operator_name: op,
        qty_at_start: activeCompletingCard.quantity,
        qty_completed: actualFinished,
        scrap_qty: actualScrap,
        started_at: activeCompletingCard.started_at || now,
        completed_at: now,
        is_archived_scrap: actualScrap > 0,
        shift_name: activeShift,
        manager_name: activeCompletingCard.manager_name,
        machine_name: activeCompletingCard.machine
      }])
      if (historyError) throw new Error(`Не вдалося передати брак у ВКЯ: ${historyError.message}`)

      const { error: cardUpdateError } = await supabase.from('work_cards').update({
        status: 'at-buffer',
        operation: 'Пресування',
        quantity: actualFinished,
        completed_at: now
      }).eq('id', activeCompletingCard.id)
      if (cardUpdateError) throw new Error(`Не вдалося завершити пресування: ${cardUpdateError.message}`)

      if (actualScrap > 0) {
        await updateInventoryStock(activeCompletingCard.nomenclature_id, actualScrap, 'scrap_ready')
      }

      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
      alert(`✅ ${actualFinished} шт успішно спресовано та переведено в буфер!`)
    } catch (e) {
      setScanError('Помилка завершення пресування: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing, error: lookupError } = await supabase.from('inventory')
        .select('*').eq('nomenclature_id', nomId).eq('type', type).limit(1).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) {
        const { error } = await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
        if (error) throw error
      } else {
        const nom = nomenclatures.find(n => n.id === nomId)
        const { error } = await supabase.from('inventory').insert([{
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: Number(qty),
          type: type,
          nomenclature_id: nomId
        }])
        if (error) throw error
      }
    } catch (e) {
      console.warn('Scrap inventory update failed:', e)
      throw e
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualId.trim()) return
    const clean = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()
    handleCardActionById(clean)
  }

  const formatDuration = (isoStart) => {
    if (!isoStart) return '00:00:00'
    const diff = Math.max(0, Math.floor((currentTime.getTime() - new Date(isoStart).getTime()) / 1000))
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
  }

  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => 
        c.card_info?.includes('[ЦЕХ №2]') &&
        ((c.status === 'at-shop2-buffer' && c.operation === 'Сортування') || 
         (c.status === 'new' && c.operation === 'Пресування'))
      )
      .sort((a, b) => new Date(a.completed_at || a.started_at || 0) - new Date(b.completed_at || b.started_at || 0))
  }, [workCards])

  const inWorkCards = useMemo(() => {
    return workCards
      .filter(c => c.card_info?.includes('[ЦЕХ №2]') && c.status === 'in-progress' && c.operation === 'Пресування')
      .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
  }, [workCards])

  const displayedCards = useMemo(() => {
    const list = []
    if (filterMode === 'all' || filterMode === 'waiting') list.push(...waitingCards.map(c => ({ ...c, type: 'waiting' })))
    if (filterMode === 'all' || filterMode === 'in_work') list.push(...inWorkCards.map(c => ({ ...c, type: 'in_work' })))
    return list.sort((a, b) => {
      if (a.type === 'in_work' && b.type === 'waiting') return -1
      if (a.type === 'waiting' && b.type === 'in_work') return 1
      return new Date(a.type === 'in_work' ? a.started_at : a.completed_at || a.started_at || 0) - new Date(b.type === 'in_work' ? b.started_at : b.completed_at || b.started_at || 0)
    })
  }, [filterMode, waitingCards, inWorkCards])

  return (
    <div style={{ background: '#070709', minHeight: '100vh', color: '#fff', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <header className="terminal-header" style={{ flexShrink: 0, background: 'rgba(12,12,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
            <ArrowLeft size={15} /> <span className="back-text">На головну</span>
          </Link>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ background: `rgba(${ACCENT_RGB},0.1)`, padding: '6px', borderRadius: '10px', flexShrink: 0 }}>
              <Tablet size={18} color={ACCENT} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '0.3px', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ЕКРАН ПРЕСУВАННЯ</h1>
              <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '1px', fontWeight: 700, whiteSpace: 'nowrap' }}>ЦЕХ №2</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Зміна</span>
            <select
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '6px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', outline: 'none' }}
            >
              <option value="">— Оберіть —</option>
              <option value="Зміна 1">Зміна 1</option>
              <option value="Зміна 2">Зміна 2</option>
              <option value="Зміна 3">Зміна 3</option>
              <option value="Зміна 4">Зміна 4</option>
              <option value="Без зміни">Без зміни</option>
            </select>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)', display: 'block' }} className="header-divider" />
          <div style={{ textAlign: 'right', flexShrink: 0 }} className="live-clock-container">
            <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 900, fontFamily: 'monospace' }}>
              {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ color: '#444', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
              {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </div>
      </header>

      {/* SCANNER BAR */}
      <section style={{ padding: '16px 20px 0 20px', flexShrink: 0 }} className="scanner-section-desktop">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '600px', margin: '0 auto' }}>
          <button
            onClick={() => setIsScanning(true)}
            style={{ background: ACCENT, color: '#000', border: 'none', padding: '12px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 32px rgba(${ACCENT_RGB},0.2)`, transition: '0.2s', flexShrink: 0 }}
          >
            <Camera size={18} />
          </button>
          <form onSubmit={handleManualSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#0e0e12', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '16px' }}>
            <Search size={16} color="#6b7280" />
            <input
              type="text"
              placeholder="Системний номер картки..."
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              disabled={isProcessing}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
            />
            <button type="submit" disabled={isProcessing} style={{ background: ACCENT, color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
              {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ВВЕСТИ'}
            </button>
          </form>
        </div>
      </section>

      {scanError && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ maxWidth: '600px', margin: '12px auto 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{scanError}</span>
            <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <section style={{ flex: 1, background: '#0c0c10', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Filter tabs */}
          <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px', scrollbarWidth: 'none' }} className="hide-scrollbar">
              {[
                { mode: 'all', label: 'Усі', count: waitingCards.length + inWorkCards.length, color: ACCENT },
                { mode: 'waiting', label: 'Очікують', count: waitingCards.length, color: '#f59e0b' },
                { mode: 'in_work', label: 'У роботі', count: inWorkCards.length, color: '#10b981' }
              ].map(tab => (
                <button
                  key={tab.mode}
                  type="button"
                  onClick={() => setFilterMode(tab.mode)}
                  style={{
                    background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : ACCENT_RGB}, 0.12)` : '#121216',
                    color: filterMode === tab.mode ? tab.color : '#888',
                    border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'rgba(255,255,255,0.04)'}`,
                    padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', flexShrink: 0
                  }}
                >
                  {tab.label}
                  <span style={{
                    background: filterMode === tab.mode ? tab.color : '#222',
                    color: filterMode === tab.mode ? '#000' : '#888',
                    borderRadius: '5px', padding: '1px 5px', fontSize: '0.65rem', fontWeight: 900
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700, textTransform: 'uppercase' }} className="stage-label-title">Черга Пресування</div>
          </div>

          {/* Cards List */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }} className="custom-scroll cards-container">
            {displayedCards.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, padding: '50px 0' }}>
                <Layers size={48} />
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginTop: '10px' }}>Картки відсутні</h3>
              </div>
            ) : (
              displayedCards.map(card => {
                const nom = getNom(card)
                const isWaiting = card.type === 'waiting'
                const timeStr = isWaiting
                  ? (card.completed_at ? formatDuration(card.completed_at) : '—')
                  : formatDuration(card.started_at)

                return (
                  <div key={card.id} style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', position: 'relative' }} className="hover-lift painting-card">
                    <div style={{ position: 'absolute', left: 0, top: '12px', bottom: '12px', width: '3px', background: isWaiting ? '#f59e0b' : ACCENT, borderRadius: '0 3px 3px 0' }} />
                    <div style={{ flex: '1 1 200px', paddingLeft: '6px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }} className="card-code">
                          Картка #{card.id.slice(-8).toUpperCase()}
                        </span>
                        {(() => {
                          const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                          return seqMatch ? (
                            <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '1px 4px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 950 }} className="card-seq">{seqMatch[1]}</span>
                          ) : null
                        })()}
                        {isWaiting ? (
                          <span style={{ fontSize: '0.55rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '1px 6px', borderRadius: '4px', fontWeight: 900 }}>
                            Буфер
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.55rem', background: `rgba(${ACCENT_RGB},0.12)`, color: ACCENT, border: `1px solid rgba(${ACCENT_RGB},0.25)`, padding: '1px 6px', borderRadius: '4px', fontWeight: 900 }}>
                            У роботі
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', margin: '0 0 6px 0', lineHeight: 1.3, wordBreak: 'break-word' }} className="card-title">
                        {nom?.name || 'Невказана деталь'}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} className="card-details">
                        <span style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 700 }}>
                          К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 700 }}>
                          Виконавець: <span style={{ color: '#aaa' }}>{(card.operator_name || 'Не вказано').split(' (')[0]}</span>
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 700 }}>
                          Зміна: <span style={{ color: '#aaa' }}>{card.shift_name || '—'}</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '8px', marginTop: '4px' }} className="card-mobile-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isWaiting ? '#6b7280' : ACCENT, fontSize: '0.68rem', fontWeight: 900, fontFamily: 'monospace' }} className="card-timer">
                        <Clock size={12} /> {timeStr}
                      </div>
                      {isWaiting ? (
                        <button
                          onClick={() => setPendingStartCard(card)}
                          disabled={isProcessing}
                          style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          className="action-btn"
                        >
                          <Play size={10} fill="currentColor" /> В РОБОТУ
                        </button>
                      ) : (
                        <button
                          onClick={() => openCompleteModal(card)}
                          disabled={isProcessing}
                          style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          className="action-btn"
                        >
                          <CheckCircle size={10} /> ЗАВЕРШИТИ
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>

      {/* CONFIRM START MODAL */}
      {pendingStartCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#0e0e12', width: '100%', maxWidth: '400px', borderRadius: '24px', border: `1px solid rgba(${ACCENT_RGB},0.25)`, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '16px 20px', background: `rgba(${ACCENT_RGB},0.06)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${ACCENT_RGB},0.1)` }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                <Play size={14} fill="currentColor" /> Взяти на Пресування
              </h3>
              <button onClick={() => setPendingStartCard(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900 }}>#{pendingStartCard.id.slice(-8).toUpperCase()}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff', marginTop: '4px' }}>{getNom(pendingStartCard)?.name || 'Деталь'}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, marginTop: '2px' }}>К-сть: <strong style={{ color: '#fff' }}>{pendingStartCard.quantity} шт</strong></div>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
                Підтвердіть що картка переходить у <strong style={{ color: '#fff' }}>Пресування</strong>.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPendingStartCard(null)} disabled={isProcessing} style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.05)', color: '#aaa', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                  СКАСУВАТИ
                </button>
                <button onClick={() => startPressingCard(pendingStartCard)} disabled={isProcessing} style={{ flex: 2, background: ACCENT, border: 'none', color: '#000', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {isProcessing ? <RefreshCw size={14} className="anim-spin" /> : <><Play size={14} fill="currentColor" /> ПРЕСУВАТИ</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && activeCompletingCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0e0e11', width: '100%', maxWidth: '400px', borderRadius: '24px', border: `1px solid rgba(${ACCENT_RGB},0.2)`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  <CheckCircle size={14} /> Завершити Пресування
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '2px', fontWeight: 800 }}>Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}</div>
              </div>
              <button onClick={() => setShowCompleteModal(false)} disabled={isProcessing} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '2px' }}>Деталь</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{getNom(activeCompletingCard)?.name || 'Невказана деталь'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Готових (шт)</label>
                  <input
                    type="number" min="0" max={activeCompletingCard.quantity || 0}
                    value={finishedCount}
                    onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setFinishedCount(val); setScrapCount(Math.max(0, (activeCompletingCard.quantity || 0) - val)) }}
                    style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Брак (шт)</label>
                  <input
                    type="number" min="0" max={activeCompletingCard.quantity || 0}
                    value={scrapCount}
                    onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setScrapCount(val); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - val)) }}
                    style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#ef4444', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#6b7280', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '10px' }}>
                <span>Разом по картці:</span>
                <span style={{ color: '#fff' }}>{activeCompletingCard.quantity || 0} шт</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={() => setShowCompleteModal(false)} disabled={isProcessing} style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.03)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                  СКАСУВАТИ
                </button>
                <button onClick={submitPressingComplete} disabled={isProcessing} style={{ flex: 1, background: ACCENT, border: 'none', color: '#000', padding: '10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : <><CheckCircle size={12} /> ПІДТВЕРДИТИ</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR-сканер (Модальне вікно) */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
          <button onClick={() => { setIsScanning(false); setShowManualInput(false); setScanError(null); }}
            style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={26} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 1000, color: ACCENT, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>ЕКРАН ПРЕСУВАННЯ · СКАНЕР</div>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 700 }}>{showManualInput ? 'ВВЕДІТЬ НОМЕР КАРТКИ ВРУЧНУ' : 'ВІДСКАНУЙТЕ КАРТКУ ЦЕХУ №2'}</div>
          </div>

          {!showManualInput ? (
            <>
              <div style={{ width: '100%', maxWidth: '480px', background: '#0a0a0a', borderRadius: '32px', border: `2px solid rgba(${ACCENT_RGB},0.3)`, overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
                <div id="reader-pressing" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
                {scanError && (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 900, textAlign: 'center', background: '#ef444415', padding: '12px 24px', borderRadius: '16px', border: '1px solid #ef444430', maxWidth: '380px' }}>
                    ⚠️ {scanError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowManualInput(true)}
                    style={{ background: '#1a1a1a', border: '1px solid #333', color: ACCENT, padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                    ⌨️ ВВЕСТИ НОМЕР ВРУЧНУ
                  </button>
                  <button onClick={() => { setIsScanning(false); setScanError(null); }}
                    style={{ background: 'transparent', border: '1px solid #222', color: '#555', padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                    ПОВЕРНУТИСЬ
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ background: '#111', width: '100%', maxWidth: '400px', padding: '30px', borderRadius: '24px', border: '1px solid #222' }}>
              <form onSubmit={(e) => {
                e.preventDefault();
                setIsScanning(false);
                setShowManualInput(false);
                handleManualSubmit(e);
              }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Приклад: 12345"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  style={{ width: '100%', background: '#000', border: `2px solid rgba(${ACCENT_RGB},0.5)`, color: '#fff', fontSize: '2.5rem', textAlign: 'center', padding: '15px', borderRadius: '16px', fontWeight: 900, fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={!manualId || isProcessing}
                    style={{ flex: 2, background: ACCENT, color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer' }}>
                    ВІДКРИТИ КАРТКУ
                  </button>
                  <button type="button" onClick={() => { setShowManualInput(false); setManualId(''); }}
                    style={{ flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                    НАЗАД
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Floating Controls (Search and QR) */}
      <div className="floating-controls-container">
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(10, 10, 10, 0.95)', border: '1px solid #222', padding: '8px 12px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Номер..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100px' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: ACCENT, color: '#000', border: 'none', padding: '4px 10px', borderRadius: '16px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>
            {isProcessing ? <RefreshCw size={10} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        <button onClick={() => setIsScanning(true)}
          className="hover-lift"
          style={{ background: ACCENT, border: 'none', color: '#000', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: `0 10px 30px rgba(${ACCENT_RGB},0.4)`, transition: 'all 0.2s', flexShrink: 0 }}
        >
          <QrCode size={26} />
        </button>
      </div>

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.3);
        }
        .anim-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.06);
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.12);
        }

        /* Default heights and layout rules */
        .terminal-header {
          height: 80px;
        }

        .floating-controls-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
        }

        /* MOBILE RESPONSIVE STYLES */
        @media (max-width: 600px) {
          .terminal-header {
            height: auto !important;
            padding: 10px 16px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .terminal-header > div {
            width: 100% !important;
            justify-content: space-between !important;
          }
          .back-text {
            display: none !important;
          }
          .header-divider {
            display: none !important;
          }
          .live-clock-container {
            text-align: right !important;
          }
          .scanner-section-desktop {
            display: none !important;
          }
          .stage-label-title {
            display: none !important;
          }
          .cards-container {
            padding: 10px !important;
          }

          /* Card optimizations */
          .painting-card {
            padding: 12px !important;
          }
          .painting-card .card-code {
            font-size: 0.78rem !important;
          }
          .painting-card .card-seq {
            font-size: 0.72rem !important;
          }
          .painting-card .card-title {
            font-size: 0.95rem !important;
            margin: 6px 0 !important;
            font-weight: 900 !important;
          }
          .painting-card .card-details span {
            font-size: 0.78rem !important;
          }
          .painting-card .card-details span strong {
            font-weight: 900 !important;
          }
          .painting-card .card-timer {
            font-size: 0.85rem !important;
            font-weight: 1000 !important;
          }
          .painting-card .action-btn {
            font-size: 0.8rem !important;
            padding: 8px 16px !important;
            border-radius: 10px !important;
          }

          .floating-controls-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 12px 16px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0,0,0,0.9);
            backdrop-filter: blur(15px);
            gap: 12px;
          }
          .floating-controls-container form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
          }
          .floating-controls-container form input {
            width: 100% !important;
          }
        }
      ` }} />

    </div>
  )
}
