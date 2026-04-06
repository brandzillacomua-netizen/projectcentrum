import React, { useState, useEffect } from 'react'
import { ArrowLeft, Camera, X, ChevronRight, Package, AlertTriangle, ClipboardList, Menu, ArrowRight, Layers, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

// Ланцюжок Цеху №1
const CHAIN = ['Різка', 'Галтовка', 'Прийомка']

// ─────────────────────────────────────────────────────────────────────────────
// Правильний статусний потік картки:
//
//  new (Різка)
//    ↓ [Взяти в роботу]
//  in-progress (Різка)
//    ↓ [Завершити + брак + оператор]
//  at-buffer (Різка)          ← БУФЕР РІЗКИ
//    ↓ [Взяти в Галтовку]
//  in-progress (Галтовка)
//    ↓ [Завершити + брак + оператор]
//  at-buffer (Галтовка)       ← БУФЕР ГАЛТОВКИ
//    ↓ [Взяти в Прийомку]
//  in-progress (Прийомка)
//    ↓ [Прийнято]
//  completed                  ← зникає з дашборду
// ─────────────────────────────────────────────────────────────────────────────

export default function Shop1Terminal() {
  const { workCards, nomenclatures, operators, workCardHistory, inventory, fetchData } = useMES()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedCardId, setSelectedCardId] = useState(null)
  
  // Сканування та ручний ввід
  const [isScanning, setIsScanning] = useState(false)
  const [manualId, setManualId] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [scanError, setScanError] = useState(null)
  
  // Процеси та UI
  const [isSyncing, setIsSyncing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  // Форми та модалки
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [finalOperator, setFinalOperator] = useState('')
  const [scrapCount, setScrapCount] = useState(0)
  
  // Детальна статистика етапу
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [showStorageExplorer, setShowStorageExplorer] = useState(false)
  const [activeExplorerTab, setActiveExplorerTab] = useState('semi')

  // Локальна черга сканованого
  const [scannedIds, setScannedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shop1_scanned') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('shop1_scanned', JSON.stringify(scannedIds)) }, [scannedIds])
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t) }, [])

  // ── QR-сканер (Зроблено "таким самим", як в інших терміналах) ──────────
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {})
        setIsScanning(false)
      }

      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        async (text) => {
          if (!text.startsWith('CENTRUM_CARD_')) return
          const id = text.replace('CENTRUM_CARD_', '').trim()
          
          await stopAndClose()
          
          let card = workCards.find(c => String(c.id).trim() === id)
          
          if (!card) {
            setIsSyncing(true)
            // Direct DB lookup for instant discovery of newly created cards
            const { data: freshCard, error: fetchError } = await supabase
              .from('work_cards')
              .select('*')
              .eq('id', id)
              .single()
            
            setIsSyncing(false)
            
            if (fetchError || !freshCard) {
              setScanError(`Картку №${id} не знайдено.`)
              return
            }
            card = freshCard
          }

          // Дозволяємо картки "Нова" або ті, що вже в ланцюжку Цеху №1
          const isNew = card.status === 'new' || !card.operation || card.operation === 'Нова'
          const isInChain = CHAIN.includes(card.operation)
          
          if (!isNew && !isInChain) { 
            setScanError(`Картка #${id} — не для Цеху №1 (${card.operation})`)
            return 
          }

          if (card.status === 'completed') { 
            setScanError(`Картка #${id} вже завершена`); 
            return 
          }

          // Додаємо в локальну чергу та активуємо
          setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
          setSelectedCardId(card.id)
          setScanError(null)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      ).catch(err => { 
        console.error("Scanner error:", err)
        setScanError(`Помилка камери: ${err}. Перевірте дозволи у браузері.`)
        // Не закриваємо setIsScanning(false) одразу, щоб користувач бачив помилку в самому інтерфейсі
      })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {}) }
  }, [isScanning, workCards])

  const handleManualEntry = async (e) => {
    if (e) e.preventDefault()
    if (!manualId) return
    setIsProcessing(true)
    
    let card = workCards.find(c => String(c.id).trim() === manualId.trim())
    if (!card) {
      await fetchData().catch(() => {})
      card = workCards.find(c => String(c.id).trim() === manualId.trim())
    }

    if (!card) {
      setScanError(`Картку №${manualId} не знайдено`)
    } else {
      setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
      setSelectedCardId(card.id)
      setManualId('')
      setShowManualInput(false)
      setIsScanning(false)
      setScanError(null)
    }
    setIsProcessing(false)
  }

  // ── Хелпери ──────────────────────────────────────────────────────────────
  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getNom = card => nomenclatures.find(n => n.id === card?.nomenclature_id)
  const formatTime = iso => {
    if (!iso) return '00:00:00'
    const d = Math.max(0, Math.floor((currentTime - new Date(iso)) / 1000))
    return [Math.floor(d/3600), Math.floor((d%3600)/60), d%60].map(v => String(v).padStart(2,'0')).join(':')
  }
  const nextStageFor = card => {
    const i = CHAIN.indexOf(card?.operation || '')
    return i >= 0 && i < CHAIN.length - 1 ? CHAIN[i + 1] : null
  }

  // Уніфікована функція запису в інвентар (без bz_qty колонки)
  const updateInventoryStock = async (nomId, qty, type = 'semi') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)
        .eq('type', type)
        .single()

      if (existing) {
        await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
      } else {
        const nom = nomenclatures.find(n => n.id === nomId)
        await supabase.from('inventory').insert([{
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: Number(qty),
          type: type,
          nomenclature_id: nomId
        }])
      }
    } catch (e) { console.warn(`Stock update failed for type ${type}:`, e) }
  }

  // Картки для черги зліва:
  // - нові картки (ще не взяті в роботу) — показуємо ВСІХ нових незалежно від operation
  //   бо оператор сам призначить першу операцію (Різка)
  // - картки в буфері будь-якого CHAIN етапу (чекають переміщення)
  // - картки що були вже відскановані в цьому сеансі
  const queueCards = workCards.filter(c =>
    c.status !== 'completed' &&
    c.status !== 'in-progress' &&
    (
      c.status === 'new' ||                          // будь-яка нова картка
      (c.status === 'at-buffer' && CHAIN.includes(c.operation)) || // буфер Цеху №1
      scannedIds.includes(c.id)                     // відскановані в цьому сеансі
    )
  )

  // ── ДІЯ 1: Взяти в роботу (new → in-progress) ──────────────────────────
  // Якщо operation не в ланцюжку (наприклад 'Нова') — стартуємо з 'Різка'
  const handleStart = async () => {
    if (!currentCard || !selectedOperator) return
    setIsProcessing(true)
    try {
      const startOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
      await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: startOp,
        started_at: new Date().toISOString(),
        operator_name: selectedOperator,
        machine: selectedMachine || currentCard.machine,
        card_info: ((currentCard.card_info || '').replace('[SHOP:1]', '').trim() + ' [SHOP:1]').trim()
      }).eq('id', currentCard.id)
      await fetchData()
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  // ── ДІЯ 2: Завершити етап → БУФЕР (in-progress → at-buffer) ──────────
  const handleCompleteToBuffer = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = Math.max(0, (currentCard.quantity || 0) - scrapCount)
      const op = finalOperator || currentCard.operator_name || 'Не вказано'

      // 1. Записуємо в history
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: currentCard.operation,
        operator_name: op,
        qty_at_start: currentCard.quantity,
        qty_completed: qtyDone,
        scrap_qty: scrapCount,
        started_at: currentCard.started_at,
        completed_at: new Date().toISOString()
      }])

      // 2. Оновлюємо картку (тільки перехід у буфер, фінальна прийомка далі)
      await supabase.from('work_cards').update({ 
        status: 'at-buffer', 
        quantity: qtyDone, 
        operator_name: op 
      }).eq('id', currentCard.id)

      // 3. Якщо є брак — записуємо його в інвентар окремим типом
      if (scrapCount > 0) {
        await updateInventoryStock(currentCard.nomenclature_id, scrapCount, 'scrap')
      }

      await fetchData()
      setShowCompleteModal(false)
      setSelectedCardId(null)
    } catch (e) { 
      console.error('Buffer error:', e)
      alert('Помилка буфера: ' + e.message) 
    } finally { setIsProcessing(false) }
  }

  // ── ДІЯ 3: ПРИЙНЯТИ (з буфера Галтовки або інших етапів не Прийомка) ─
  // Якщо next == 'Прийомка' — одним кліком приймаємо на склад (без in-progress Прийомки)
  // Якщо next != 'Прийомка' — переходимо до наступного етапу (in-progress)
  const handleStartNext = async () => {
    if (!currentCard) return
    const next = nextStageFor(currentCard)
    if (!next) return

    // Прийомка — це однокрокове прийняття на склад
    if (next === 'Прийомка') {
      await handleAcceptToStock()
      return
    }

    if (!selectedOperator) return
    setIsProcessing(true)
    try {
      await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: next,
        started_at: new Date().toISOString(),
        operator_name: selectedOperator,
        machine: currentCard.machine || null
      }).eq('id', currentCard.id)
      await fetchData()
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  // ── ДІЯ 4: ЗАМОВИТИ ДОВИПУСК (якщо 100% брак) ─────────────────────────
  const handleRequestRework = async () => {
    if (!currentCard || !createWorkCard) return
    setIsProcessing(true)
    try {
      const op = finalOperator || currentCard.operator_name || 'Брак'
      
      // 1. Записуємо в history
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: currentCard.operation,
        operator_name: op,
        qty_at_start: currentCard.quantity,
        qty_completed: 0,
        scrap_qty: currentCard.quantity,
        started_at: currentCard.started_at,
        completed_at: new Date().toISOString()
      }])

      // 2. Оновлюємо поточну картку → completed (з 0 qty)
      await supabase.from('work_cards').update({ 
        status: 'completed', 
        quantity: 0, 
        operator_name: op 
      }).eq('id', currentCard.id)

      // 3. Записуємо брак на склад
      await updateInventoryStock(currentCard.nomenclature_id, currentCard.quantity, 'scrap')

      // 4. Створюємо НОВУ картку (Різка) для перевипуску
      const nom = getNom(currentCard)
      await createWorkCard(
        currentCard.task_id,
        currentCard.order_id,
        currentCard.nomenclature_id,
        CHAIN[0], // Різка
        null,     // Машину обере заново
        0,        // Естімейт
        `[REDO] після ${currentCard.operation}`,
        currentCard.quantity,
        0,
        true      // isRework = true
      )

      await fetchData()
      setShowCompleteModal(false)
      setSelectedCardId(null)
      alert('Запит на перевипуск створено успішно!')
    } catch (e) { 
      console.error('Rework error:', e)
      alert('Помилка перевипуску: ' + e.message) 
    } finally { setIsProcessing(false) }
  }

  // ── ПРИЙНЯТИ НА СКЛАД (з буфера Галтовки без in-progress) ─────────────
  const handleAcceptToStock = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = currentCard.quantity || 0
      const op = selectedOperator || currentCard.operator_name || 'Прийомка'
      const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)

      // 1. Записуємо history запис прийомки
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Прийомка',
        operator_name: op,
        qty_at_start: qtyDone,
        qty_completed: qtyDone,
        scrap_qty: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }])

      // 2. Картка → completed (фініш процесу)
      // 2. Картка → completed (фініш процесу)
      const { error: cardErr } = await supabase.from('work_cards').update({
        status: 'completed',
        operation: 'Прийомка'
      }).eq('id', currentCard.id)
      
      if (cardErr) throw cardErr

      // Одразу закриваємо інтерфейс картки, щоб не "зависати", навіть якщо далі буде помилка складу
      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))

      // 3. Оновлюємо склад (напів-фабрикати та БЗ)
      if (qtyDone > 0 && nom) {
        const bzMatch = (currentCard.card_info || '').match(/\[BZ:(\d+)\]/)
        const bzQty = bzMatch ? Number(bzMatch[1]) : 0
        const semiQty = Math.max(0, qtyDone - bzQty)

        // Записуємо чисту кількість як semi
        if (semiQty > 0) await updateInventoryStock(nom.id, semiQty, 'semi')
        // Записуємо БЗ окремим типом bz
        if (bzQty > 0) await updateInventoryStock(nom.id, bzQty, 'bz')
      }

      await fetchData()
    } catch (e) { 
      console.error('Acceptance error:', e)
      alert('Помилка прийомки: ' + (e.message || 'Невідома помилка')) 
    } finally { setIsProcessing(false) }
  }

  // ── Статистика по кожному етапу ─────────────────────────────────────────
  const stageStats = stage => {
    const cards = workCards.filter(c => c.operation === stage && CHAIN.includes(c.operation))
    return {
      inWork:   cards.filter(c => c.status === 'in-progress').reduce((a, c) => a + (c.quantity || 0), 0),
      inBuffer: cards.filter(c => c.status === 'at-buffer').reduce((a, c) => a + (c.quantity || 0), 0),
      scrap:    workCardHistory.filter(h => h.stage_name === stage && !h.is_archived_scrap).reduce((a, h) => a + (Number(h.scrap_qty) || 0), 0),
      total:    cards.length
    }
  }

  // ── ПЕРЕМІЩЕННЯ БРАКУ НА СКЛАД (Архівування з етапу) ────────────────────
  const handleArchiveStageScrap = async (stage, nomId) => {
    const unarchivedScrap = workCardHistory.filter(h => h.stage_name === stage && String(h.nomenclature_id) === String(nomId) && !h.is_archived_scrap && Number(h.scrap_qty) > 0)
    const totalQty = unarchivedScrap.reduce((acc, h) => acc + Number(h.scrap_qty), 0)
    
    if (totalQty === 0) return
    setIsProcessing(true)
    
    try {
      // 1. Оновлюємо інвентар типу 'scrap'
      await updateInventoryStock(nomId, totalQty, 'scrap')

      // 2. Помічаємо history як архівоване
      const idsToMark = unarchivedScrap.map(h => h.id)
      const { error } = await supabase.from('work_card_history').update({ is_archived_scrap: true }).in('id', idsToMark)
      if (error) throw error

      await fetchData()
    } catch (err) {
      console.error('Archive scrap error:', err)
      alert('Помилка архівації браку: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Рендер: ліва черга (Преміум-вигляд) ──────────────────────────────────
  const renderQueue = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px', scrollbarWidth: 'none' }}>
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      {queueCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#222', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Layers size={24} style={{ marginBottom: '10px', opacity: 0.2 }} /><br />
          Черга порожня
        </div>
      )}
      {queueCards.map(card => {
        const nom = getNom(card)
        const active = selectedCardId === card.id
        const isBuffer = card.status === 'at-buffer'
        const statusColor = isBuffer ? '#f59e0b' : '#3b82f6'
        const statusLabel = isBuffer ? `БУФЕР · ${card.operation}` : `НОВА · ${CHAIN.includes(card.operation) ? card.operation : 'РІЗКА'}`
        
        return (
          <div key={card.id}
            onClick={() => { setSelectedCardId(card.id); setSelectedOperator(''); setIsDrawerOpen(false) }}
            style={{
              background: active ? '#eab308' : '#111', 
              color: active ? '#000' : '#fff',
              borderRadius: '16px', padding: '16px', marginBottom: '10px', cursor: 'pointer',
              border: `1px solid ${active ? '#eab308' : '#1a1a1a'}`, 
              boxShadow: active ? '0 10px 20px rgba(234,179,8,0.15)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: active ? 'scale(1.02)' : 'scale(1)'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <strong style={{ fontSize: '0.9rem', fontWeight: 950, letterSpacing: '-0.01em' }}>
                {nom?.name || 'Деталь'}
              </strong>
              <div style={{ fontSize: '0.75rem', fontWeight: 1000, opacity: active ? 1 : 0.4 }}>
                {card.quantity}<small style={{ fontSize: '0.5rem' }}> шт</small>
              </div>
            </div>
            <div style={{ fontSize: '0.6rem', opacity: active ? 0.7 : 0.4, marginBottom: '10px', fontWeight: 600 }}>
              #{card.id.slice(-8).toUpperCase()}
            </div>
            <span style={{
              fontSize: '0.55rem', fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: active ? 'rgba(0,0,0,0.1)' : `${statusColor}15`,
              color: active ? '#000' : statusColor,
              padding: '3px 8px', borderRadius: '6px', border: active ? '1px solid rgba(0,0,0,0.1)' : 'none'
            }}>{statusLabel}</span>
          </div>
        )
      })}
    </div>
  )

  // ── Рендер: вигляд картки (головна область) ──────────────────────────────
  const renderCardView = () => {
    if (!currentCard) return null
    const nom = getNom(currentCard)
    const chainIdx = CHAIN.indexOf(currentCard.operation)
    const next = nextStageFor(currentCard)
    const isFinal = currentCard.operation === CHAIN[CHAIN.length - 1]
    const { status } = currentCard

    return (
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        {/* Хлібні крихти ланцюжка */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {CHAIN.map((s, i) => {
            const isCurrent = s === currentCard.operation
            const isDone = i < chainIdx
            return (
              <React.Fragment key={s}>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase',
                  padding: '3px 9px', borderRadius: '5px',
                  background: isCurrent ? '#eab308' : isDone ? '#10b98120' : '#1a1a1a',
                  color: isCurrent ? '#000' : isDone ? '#10b981' : '#333'
                }}>{s}</span>
                {i < CHAIN.length - 1 && <ChevronRight size={10} color="#2a2a2a" />}
              </React.Fragment>
            )
          })}
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {nom?.name || 'Деталь'}
            </h2>
            <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, marginTop: '6px', textTransform: 'uppercase' }}>
              Картка #{currentCard.id.slice(-8).toUpperCase()} · {currentCard.quantity} шт
            </div>
          </div>
          <button onClick={() => setSelectedCardId(null)}
            style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer', marginLeft: '10px' }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid #1a1a1a', padding: '25px 20px' }}>

          {/* ── СТАН: NEW → Форма старту ──────────────────────────────────── */}
          {(status === 'new' || (status === 'in-progress' && !CHAIN.includes(currentCard.operation))) && (() => {
            const displayOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
            return (
              <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Акцентована планова кількість */}
                <div style={{ background: '#eab30810', border: '1px solid #eab30830', borderRadius: '18px', padding: '20px', textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>ПЛАНОВА КІЛЬКІСТЬ</div>
                  <div style={{ fontSize: '3rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                    {currentCard.quantity} <small style={{ fontSize: '1rem', opacity: 0.3 }}>шт</small>
                  </div>
                </div>

                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  СТАРТ · {displayOp?.toUpperCase()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={labelStyle}>Відповідальний оператор</label>
                    <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} style={selectStyle}>
                      <option value="">— Оберіть оператора —</option>
                      {operators.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  {displayOp === 'Різка' && (
                    <div>
                      <label style={labelStyle}>Верстат / обладнання</label>
                      <input type="text" placeholder="Номер верстата..."
                        value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                        style={{ ...selectStyle, cursor: 'text' }} />
                    </div>
                  )}
                  <button onClick={handleStart} disabled={!selectedOperator || isProcessing}
                    style={{ ...btnPrimary, marginTop: '10px', height: '64px', fontSize: '1.2rem', opacity: (!selectedOperator || isProcessing) ? 0.45 : 1 }}>
                    ▶ ВЗЯТИ В РОБОТУ · {displayOp?.toUpperCase()}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* ── СТАН: IN-PROGRESS (якщо вже в CHAIN) → Таймер + завершити ── */}
          {status === 'in-progress' && CHAIN.includes(currentCard.operation) && (() => {
            const opName = currentCard.operation?.toUpperCase()
            return (
              <div style={{ textAlign: 'center' }}>
                {/* Плашка з кількістю в роботі */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: '#3b82f610', border: '1px solid #3b82f630', padding: '10px 24px', borderRadius: '14px', marginBottom: '24px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.55rem', color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase' }}>У РОБОТІ</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 1000 }}>{currentCard.quantity} <small style={{ fontSize: '0.6rem', opacity: 0.4 }}>шт</small></div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: '#3b82f620' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ЕТАП</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#3b82f6' }}>{opName}</div>
                  </div>
                </div>

                <div style={{ fontSize: '4.5rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.05em' }}>
                  {formatTime(currentCard.started_at)}
                </div>
                
                <div style={{ color: '#444', fontSize: '0.7rem', marginTop: '15px', marginBottom: '30px', fontWeight: 800, textTransform: 'uppercase' }}>
                  ОПЕРАТОР: <span style={{ color: '#888' }}>{currentCard.operator_name || '—'}</span>
                </div>

              {/* Стрілка куди піде картка */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '25px', background: '#f59e0b0d', border: '1px solid #f59e0b22', borderRadius: '14px', padding: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700 }}>{currentCard.operation}</span>
                <ArrowRight size={12} color="#f59e0b" />
                <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: '#000', fontWeight: 900, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                  БУФЕР {currentCard.operation?.toUpperCase()}
                </span>
                {!isFinal && (
                  <>
                    <ArrowRight size={12} color="#444" />
                    <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>{next}</span>
                  </>
                )}
              </div>

                <button onClick={() => { setScrapCount(0); setFinalOperator(currentCard.operator_name || ''); setShowCompleteModal(true) }}
                  style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px', width: '100%', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 1000, cursor: 'pointer', boxShadow: '0 10px 30px rgba(236,72,153,0.3)' }}>
                  {isFinal ? '✓ ПРИЙНЯТО' : `ЗАВЕРШИТИ ${opName}`}
                </button>
              </div>
            )
          })()}

          {/* ── СТАН: AT-BUFFER → Прийняти або взяти в наступний етап ──────── */}
          {status === 'at-buffer' && (() => {
            const isLastBeforeReception = nextStageFor(currentCard) === 'Прийомка'
            const nextOp = nextStageFor(currentCard)
            return (
              <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

                {/* Великий бейдж кількості в буфері */}
                <div style={{ background: isLastBeforeReception ? '#10b98110' : '#f59e0b10', border: `1px solid ${isLastBeforeReception ? '#10b98130' : '#f59e0b30'}`, borderRadius: '24px', padding: '24px', textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 950, color: isLastBeforeReception ? '#10b981' : '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                    {isLastBeforeReception ? 'ГОТОВО ДО ПЕРЕДАЧІ' : `В БУФЕРІ: ${currentCard.operation?.toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                    {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                  </div>
                </div>

                {/* Прийомка: одним кліком на склад */}
                {isLastBeforeReception ? (
                  <div style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #10b98122' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={labelStyle}>Відповідальний за прийомку</label>
                      <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} style={selectStyle}>
                        <option value="">— Оберіть оператора —</option>
                        {operators.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <button onClick={handleAcceptToStock} disabled={!selectedOperator || isProcessing}
                      style={{ 
                        background: '#10b981', color: '#fff', border: 'none', width: '100%',
                        height: '64px', borderRadius: '16px', fontSize: '1.3rem', fontWeight: 1000, 
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 10px 30px rgba(16,185,129,0.2)',
                        opacity: (!selectedOperator || isProcessing) ? 0.5 : 1 
                      }}>
                      ✅ ПРИЙНЯТИ НА СКЛАД НФ
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.65rem', color: '#444', fontWeight: 600 }}>
                      Фінальний крок: деталь отримає статус "Виконано" та з'явиться в стоку Цеху №2
                    </div>
                  </div>
                ) : (
                  /* Попередні етапи (Різка → Галтовка) — звичайний перехід */
                  <div style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #222' }}>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, marginBottom: '20px', textTransform: 'uppercase', textAlign: 'center' }}>
                      НАСТУПНИЙ ЕТАП: <span style={{ color: '#f59e0b' }}>{nextOp}</span>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={labelStyle}>Оператор</label>
                      <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} style={selectStyle}>
                        <option value="">— Оберіть оператора —</option>
                        {operators.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <button onClick={handleStartNext} disabled={!selectedOperator || isProcessing} 
                      style={{ 
                        ...btnGreen, width: '100%', height: '64px', fontSize: '1.2rem',
                        opacity: (!selectedOperator || isProcessing) ? 0.5 : 1 
                      }}>
                      ▶ ВЗЯТИ В {nextOp?.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

        </div>
      </div>
    )
  }

  // ── Рендер: Експорер складу (СЕНСОРНИЙ РЕЖИМ) ───────────────────────────
  const renderStorageExplorer = () => {
    const explorerTabs = [
      { id: 'semi', label: 'НАПІВФАБРИКАТИ', icon: <Layers size={16} />, color: '#10b981' },
      { id: 'bz', label: 'БЗ (СТАНДАРТ)', icon: <ClipboardList size={16} />, color: '#eab308' },
      { id: 'scrap', label: 'БРАК / ВІДХОДИ', icon: <AlertTriangle size={16} />, color: '#ef4444' },
    ]
    const filteredItems = (inventory || []).filter(i => i.type === activeExplorerTab)

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#10b98120', padding: '8px', borderRadius: '10px' }}><Package size={20} color="#10b981" /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 1000 }}>КВІТ-СКЛАД ЦЕХУ №1</h2>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Моніторинг запасів та браку</div>
            </div>
          </div>
          <button onClick={() => setShowStorageExplorer(false)} style={{ background: '#1a1a1a', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '15px 20px', background: '#0d0d0d' }}>
          {explorerTabs.map(t => (
            <button key={t.id} onClick={() => setActiveExplorerTab(t.id)}
              style={{
                flex: 1, background: activeExplorerTab === t.id ? t.color : '#0a0a0a',
                color: activeExplorerTab === t.id ? '#000' : '#444', border: 'none',
                padding: '12px', borderRadius: '12px', fontWeight: 900, fontSize: '0.65rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s', cursor: 'pointer'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {filteredItems.map(item => {
              const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
              return (
                <div key={item.id} style={{ background: '#111', borderRadius: '18px', padding: '18px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '2px' }}>{nom?.name || item.name}</div>
                    <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900 }}>{item.unit || 'од'} | {new Date(item.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: explorerTabs.find(t=>t.id===activeExplorerTab).color }}>{item.total_qty}</div>
                    <div style={{ fontSize: '0.5rem', color: '#333', fontWeight: 900 }}>ЗАЛИШОК</div>
                  </div>
                </div>
              )
            })}
            {filteredItems.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#222' }}>
                <Package size={48} style={{ marginBottom: '15px', opacity: 0.1 }} />
                <div style={{ fontWeight: 800 }}>ПОЗИЦІЙ НЕ ЗНАЙДЕНО</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Рендер: дашборд (без вибраної картки) ───────────────────────────────
  const renderDashboard = () => (
    <div style={{ maxWidth: '1050px', margin: '0 auto' }}>

      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>ЦЕХ №1</h2>
          <p style={{ margin: '3px 0 0', color: '#333', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Різка → Буфер → Галтовка → Буфер → Прийомка
          </p>
        </div>
        <button onClick={() => setIsScanning(true)}
          style={{ background: '#eab308', border: 'none', color: '#000', padding: '13px 26px', borderRadius: '13px', fontWeight: 900, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Camera size={17} /> ВІДКРИТИ СКАНЕР
        </button>
      </div>

      {/* Ланцюжок з буферами + сток Прийомки (GRID LAYOUT) */}
      <div className="stages-grid-responsive" style={{ 
        display: 'grid', 
        gap: '12px', 
        marginBottom: '36px',
        alignItems: 'stretch'
      }}>
        {['Різка', 'Галтовка'].map((stage, idx) => {
          const s = stageStats(stage)
          return (
            <React.Fragment key={stage}>
              <div onClick={() => { setDetailStage(stage); setDetailTab('work') }}
                style={{ 
                  background: '#0a0a0a', 
                  border: '1px solid #222', 
                  borderTop: `4px solid ${idx === 0 ? '#3b82f6' : '#f59e0b'}`,
                  borderRadius: '20px', padding: '20px 16px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  gridArea: `stage${idx + 1}`
                }}
                className="s1-stage-card s1-stage-hover">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 1000, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{stage}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.inWork > 0 ? '#10b981' : '#222', boxShadow: s.inWork > 0 ? '0 0 8px #10b981' : 'none' }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                  {[
                    { label: 'РОБОТА', val: s.inWork,   color: '#3b82f6' },
                    { label: 'БУФЕР',  val: s.inBuffer, color: '#f59e0b' },
                    { label: 'БРАК',   val: s.scrap,    color: '#ef4444' },
                  ].map(({ label, val, color }, li) => (
                    <div key={label} style={li > 0 ? { borderLeft: '1px solid #111', paddingLeft: '8px' } : {}}>
                      <div style={{ fontSize: '0.55rem', color: '#333', fontWeight: 1000, marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ 
                        fontSize: '1.4rem', fontWeight: 1000, letterSpacing: '-0.02em',
                        color: val > 0 ? color : '#1a1a1a' 
                      }}>
                        {val}<small style={{ fontSize: '0.45rem', opacity: 0.2, marginLeft: '1px' }}>шт</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Буфер між етапами або перехід до складу (Arrow) */}
              <div 
                className={`hide-mobile`}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '0 6px',
                  gridArea: `arrow${idx + 1}`
                }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '2px', background: s.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#222' }} />
                  <ChevronRight size={14} color={s.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#222'} />
                </div>
                <div style={{ marginTop: '5px', fontSize: '0.46rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                  background: s.inBuffer > 0 ? `${idx === 0 ? '#f59e0b20' : '#10b98120'}` : '#1a1a1a', color: s.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#2a2a2a' }}>
                  {s.inBuffer > 0 ? `${s.inBuffer} шт` : (idx === 0 ? 'БУФЕР' : 'СКЛАД')}
                </div>
              </div>
            </React.Fragment>
          )
        })}

        {/* ─── ПРИЙОМКА / СКЛАД (Фінальна стадія) ─── */}
        {(() => {
          const semiQty = (inventory || []).filter(i => i.type === 'semi' && (i.nomenclature_id || '').length > 0).reduce((a, i) => a + (Number(i.total_qty) || 0), 0)
          const bzQty = (inventory || []).filter(i => i.type === 'bz').reduce((a, i) => a + (Number(i.total_qty) || 0), 0)
          const scrapQty = (inventory || []).filter(i => i.type === 'scrap').reduce((a, i) => a + (Number(i.total_qty) || 0), 0)
          
          return (
            <div onClick={() => setShowStorageExplorer(true)}
              style={{ 
                background: 'linear-gradient(145deg, #0d1a15 0%, #050a08 100%)', 
                border: '1px solid #10b98130', borderTop: '4px solid #10b981',
                borderRadius: '22px', padding: '20px 16px', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                gridArea: 'storage'
              }}
              className="s1-stage-card-storage s1-stage-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 1000, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.12em' }}>ПРИЙОМКА / СКЛАД</span>
                <ClipboardList size={14} color="#10b981" style={{ opacity: 0.5 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                {[
                  { label: 'СКЛАД НФ', val: semiQty, color: '#10b981' },
                  { label: 'БЗ (СТ)', val: bzQty, color: '#eab308' },
                  { label: 'БРАК', val: scrapQty, color: '#ef4444' },
                ].map(({ label, val, color }, i) => (
                  <div key={label} style={i > 0 ? { borderLeft: '1px solid #111', paddingLeft: '6px' } : {}}>
                    <div style={{ fontSize: '0.5rem', color: '#333', fontWeight: 1000, marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ 
                      fontSize: '1.3rem', fontWeight: 1000, letterSpacing: '-0.02em',
                      color: val > 0 ? color : '#1a1a1a' 
                    }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Таблиця активних карток */}
      <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
        <div style={{ padding: '25px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
          {isSyncing && <div style={{ fontSize: '0.7rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw className="spin-s1" size={12} /> Оновлення...</div>}
        </div>
        <div className="table-responsive-container" style={{ border: 'none', borderRadius: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
                <th style={{ padding: '15px 25px' }}>ДЕТАЛЬ</th>
                <th style={{ padding: '15px 25px' }}>ЕТАП</th>
                <th style={{ padding: '15px 25px' }}>СТАТУС</th>
                <th style={{ padding: '15px 25px' }}>К-СТЬ</th>
                <th style={{ padding: '15px 25px' }}>ОПЕРАТОР</th>
                <th style={{ padding: '15px 25px' }}>ВЕРСТАТ</th>
                <th style={{ padding: '15px 25px' }}>ЧАС</th>
                <th style={{ padding: '15px 25px' }}></th>
              </tr>
            </thead>
            <tbody>
              {workCards
                .filter(c => CHAIN.includes(c.operation) && (c.status === 'in-progress' || c.status === 'at-buffer'))
                .map(card => {
                  const inBuf = card.status === 'at-buffer'
                  return (
                    <tr key={card.id} style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem' }}>
                      <td style={{ padding: '15px 25px', fontWeight: 800 }}>{getNom(card)?.name || '—'}</td>
                      <td style={{ padding: '15px 25px' }}>{card.operation}</td>
                      <td style={{ padding: '15px 25px' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase',
                          background: inBuf ? '#f59e0b18' : '#3b82f618',
                          color: inBuf ? '#f59e0b' : '#3b82f6',
                          padding: '4px 10px', borderRadius: '6px'
                        }}>
                          {inBuf ? '▣ БУФЕР' : '▶ РОБОТА'}
                        </span>
                      </td>
                      <td style={{ padding: '15px 25px', fontWeight: 900 }}>{card.quantity} шт</td>
                      <td style={{ padding: '15px 25px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                      <td style={{ padding: '15px 25px', color: '#eab308', fontWeight: 800 }}>{card.machine || '—'}</td>
                      <td style={{ padding: '15px 25px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>{formatTime(card.started_at)}</td>
                      <td style={{ padding: '15px 25px', textAlign: 'right' }}>
                        <button onClick={() => { setSelectedCardId(card.id); setSelectedOperator('') }}
                          style={{ background: '#222', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>
                          ВІДКРИТИ
                        </button>
                      </td>
                    </tr>
                  )
                })}
              {workCards.filter(c => CHAIN.includes(c.operation) && (c.status === 'in-progress' || c.status === 'at-buffer')).length === 0 && (
                <tr><td colSpan={8} style={{ padding: '50px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>Немає активних карток</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ── ГОЛОВНИЙ РЕНДЕР ──────────────────────────────────────────────────────
  return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>

      {/* Хедер */}
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only"><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308' }} />
          <span style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ЦЕХ №1: ТЕРМІНАЛ</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem', color: '#eab308' }}>
          {currentTime.toLocaleTimeString()}
        </div>
      </header>

      {/* Layout */}
      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Ліва панель черги (Десктоп) */}
        <div className="side-panel hide-mobile" style={{ width: '280px', background: '#111', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 15px 15px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1a1a1a' }}>
            <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
          </div>
          {renderQueue()}
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#eab30815', border: '1px solid #eab30830', color: '#eab308', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        {/* Мобільний дравер */}
        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
            <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
          </div>
          {renderQueue()}
        </div>

        {/* Основний контент */}
        <div className="content-panel" style={{ flex: 1, overflowY: 'auto', padding: '25px 15px', background: '#0a0a0a' }}>
          {scanError && (
            <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', maxWidth: '680px' }}>
              <AlertTriangle size={16} /> {scanError}
              <button onClick={() => setScanError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          )}
          {currentCard ? renderCardView() : renderDashboard()}
        </div>
      </div>

      {/* ── QR-сканер (Класичний вигляд з Ручним Вводом) ────────────────── */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
          <button onClick={() => { setIsScanning(false); setShowManualInput(false); setScanError(null); }}
            style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={26} />
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 1000, color: '#eab308', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>ЦЕХ №1 · ТЕРМІНАЛ</div>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 700 }}>{showManualInput ? 'ВВЕДІТЬ НОМЕР КАРТКИ ВРУЧНУ' : 'ВІДСКАНУЙТЕ КАРТКУ ТЕХНОЛОГІЧНОГО ПРОЦЕСУ'}</div>
          </div>

          {!showManualInput ? (
            <>
              {/* Чистий контейнер для сканера */}
              <div style={{ width: '100%', maxWidth: '480px', background: '#0a0a0a', borderRadius: '32px', border: '2px solid #eab30830', overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
                <div id="reader" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
                {scanError && (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 900, textAlign: 'center', background: '#ef444415', padding: '12px 24px', borderRadius: '16px', border: '1px solid #ef444430', maxWidth: '380px' }}>
                    ⚠️ {scanError}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowManualInput(true)} 
                    style={{ background: '#1a1a1a', border: '1px solid #333', color: '#eab308', padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
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
               <form onSubmit={handleManualEntry} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Приклад: 12345"
                    value={manualId}
                    onChange={e => setManualId(e.target.value)}
                    style={{ width: '100%', background: '#000', border: '2px solid #eab30850', color: '#fff', fontSize: '2.5rem', textAlign: 'center', padding: '15px', borderRadius: '16px', fontWeight: 900, fontFamily: 'monospace' }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" disabled={!manualId || isProcessing}
                      style={{ flex: 2, background: '#eab308', color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer' }}>
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

      {/* ── Модалка завершення етапу ──────────────────────────────────────── */}
      {showCompleteModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #252525', overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900 }}>
                  ЗАВЕРШИТИ · {currentCard.operation?.toUpperCase()}
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '2px' }}>
                  {currentCard.operation === CHAIN[CHAIN.length - 1]
                    ? '→ ГОТОВО (деталь прийнята)'
                    : `→ БУФЕР ${currentCard.operation?.toUpperCase()}`}
                </div>
              </div>
              <button onClick={() => setShowCompleteModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNom(currentCard)?.name}</h3>

              {/* Фінальний оператор */}
              <div>
                <label style={labelStyle}>Фінальний оператор (якщо змінився)</label>
                <select value={finalOperator} onChange={e => setFinalOperator(e.target.value)} style={selectStyle}>
                  <option value="">— Залишити поточного ({currentCard.operator_name}) —</option>
                  {operators.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Лічильник браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ БРАКУ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity} value={scrapCount}
                    onChange={e => setScrapCount(Math.max(0, Math.min(currentCard.quantity, parseInt(e.target.value) || 0)))}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
                  Добре: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - scrapCount)} шт</strong>
                  {' · '}Брак: <strong style={{ color: '#ef4444' }}>{scrapCount} шт</strong>
                </div>
              </div>

               {Math.max(0, (currentCard.quantity || 0) - scrapCount) === 0 ? (
                <button onClick={handleRequestRework} disabled={isProcessing}
                  style={{ ...btnPrimary, background: '#ef4444', boxShadow: '0 10px 30px rgba(239,68,68,0.3)', opacity: isProcessing ? 0.5 : 1 }}>
                  {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '♻ ЗАМОВИТИ ДОВИПУСК'}
                </button>
              ) : (
                <button onClick={handleCompleteToBuffer} disabled={isProcessing}
                  style={{ ...btnGreen, opacity: isProcessing ? 0.5 : 1 }}>
                  {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : (
                    currentCard.operation === CHAIN[CHAIN.length - 1]
                      ? '✓ ПРИЙНЯТО · ЗАВЕРШИТИ'
                      : `✓ В БУФЕР ${currentCard.operation?.toUpperCase()}`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка деталей по кліку на картку етапу ─────────────────────── */}
      {detailStage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '620px', background: '#111', borderRadius: '24px', border: '1px solid #1e1e1e', overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#eab308', fontWeight: 950 }}>{detailStage.toUpperCase()}</h2>
              <button onClick={() => setDetailStage(null)} style={{ background: '#1e1e1e', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><X size={17} /></button>
            </div>
            <div style={{ display: 'flex', padding: '12px', gap: '7px' }}>
              {[{ key: 'work', label: 'У РОБОТІ', color: '#3b82f6' }, { key: 'buffer', label: 'БУФЕР', color: '#f59e0b' }, { key: 'scrap', label: 'БРАК', color: '#ef4444' }].map(t => (
                <button key={t.key} onClick={() => setDetailTab(t.key)}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '0.72rem', background: detailTab === t.key ? t.color : '#1e1e1e', color: detailTab === t.key ? '#fff' : '#444' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: '0 12px 12px', maxHeight: '400px', overflowY: 'auto' }}>
              {(() => {
                const agg = {}
                if (detailTab === 'scrap') {
                  const scraps = workCardHistory.filter(h => h.stage_name === detailStage && !h.is_archived_scrap && Number(h.scrap_qty) > 0)
                  scraps.forEach(h => {
                    const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id))
                    const nomId = h.nomenclature_id
                    const name = nom?.name || 'Деталь'
                    if (!agg[nomId]) agg[nomId] = { name, qty: 0, nomId }
                    agg[nomId].qty += Number(h.scrap_qty)
                  })
                } else {
                  workCards.filter(c => c.operation === detailStage && (detailTab === 'work' ? c.status === 'in-progress' : c.status === 'at-buffer')).forEach(c => {
                    const nom = getNom(c)
                    const name = nom?.name || 'Деталь'
                    if (!agg[name]) agg[name] = { name, qty: 0 }
                    agg[name].qty += (c.quantity || 0)
                  })
                }
                const items = Object.values(agg)
                if (!items.length) return <div style={{ textAlign: 'center', padding: '46px', color: '#222', fontSize: '0.78rem' }}>Немає даних</div>
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ background: '#0d0d0d', padding: '12px 16px', borderRadius: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                           <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.name}</div>
                           {detailTab === 'scrap' && (
                             <button onClick={() => handleArchiveStageScrap(detailStage, item.nomId)} disabled={isProcessing}
                               style={{ marginTop: '5px', background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', fontSize: '0.55rem', fontWeight: 900, padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', textTransform: 'uppercase' }}>
                               {isProcessing ? 'Збереження...' : 'Здати на склад'}
                             </button>
                           )}
                        </div>
                        <div style={{ fontWeight: 1000, fontSize: '1.05rem', color: detailTab === 'work' ? '#3b82f6' : detailTab === 'buffer' ? '#f59e0b' : '#ef4444' }}>
                          {item.qty} <small style={{ opacity: 0.3, fontSize: '0.5rem' }}>шт</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {showStorageExplorer && renderStorageExplorer()}

      <style>{`
        .s1-stage-hover:hover { background: #181818!important; transform: translateY(-3px); }
        .s1-stage-hover { transition: all 0.2s cubic-bezier(0.4,0,0.2,1)!important; }
        .spin-s1 { animation: spinS1 1s linear infinite; }
        @keyframes spinS1 { 100% { transform: rotate(360deg); } }
        .s1-burger-btn { display: none; }
        @media (max-width: 768px) { .s1-burger-btn { display: flex!important; } }

        /* Hover effect for cards */
        .s1-stage-hover {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .s1-stage-hover:hover {
          background: #111 !important;
          border-color: #333 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.4) !important;
        }

        .stages-grid-responsive {
          grid-template-columns: 1fr auto 1fr auto 1.5fr;
          grid-template-areas: "stage1 arrow1 stage2 arrow2 storage";
        }

        @media (max-width: 768px) {
          .stages-grid-responsive {
            grid-template-columns: 1fr 1fr;
            grid-template-areas: 
              "stage1 stage2"
              "storage storage";
          }
        }
      `}</style>
    </div>
  )
}

// Стилі-константи
const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }
const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
const btnGreen   = { background: '#10b981', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
