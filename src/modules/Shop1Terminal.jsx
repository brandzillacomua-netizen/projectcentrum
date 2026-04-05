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
  const [isScanning, setIsScanning] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Форма старту (new → in-progress)
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')

  // Модалка завершення етапу (in-progress → at-buffer)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [finalOperator, setFinalOperator] = useState('')
  const [scrapCount, setScrapCount] = useState(0)

  // Деталі по кліку на карточку етапу
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')

  // Скановані картки (локальна черга)
  const [scannedIds, setScannedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shop1_scanned') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('shop1_scanned', JSON.stringify(scannedIds)) }, [scannedIds])
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t) }, [])

  // ── QR-сканер ────────────────────────────────────────────────────────────
  useEffect(() => {
    let qr = null
    if (isScanning && window.Html5Qrcode) {
      qr = new window.Html5Qrcode('shop1-reader')
      const stop = async () => { try { if (qr?.isScanning) await qr.stop() } catch {} ; setIsScanning(false) }
      qr.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 260, height: 260 } },
        async (text) => {
          if (!text.startsWith('CENTRUM_CARD_')) return
          const id = text.replace('CENTRUM_CARD_', '').trim()
          await stop()
          let card = workCards.find(c => String(c.id).trim() === id)
          if (!card) {
            setIsSyncing(true)
            await fetchData().catch(() => {})
            setIsSyncing(false)
            card = workCards.find(c => String(c.id).trim() === id)
          }
          if (!card) { setScanError(`Картку №${id} не знайдено`); return }
          if (!CHAIN.includes(card.operation)) { setScanError(`Картка #${id} — не для Цеху №1 (${card.operation})`); return }
          if (card.status === 'completed') { setScanError(`Картка #${id} вже завершена`); return }
          setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
          setSelectedCardId(card.id)
          setScanError(null)
        }
      ).catch(err => { setScanError('Помилка камери: ' + err); setIsScanning(false) })
    }
    return () => { try { if (qr?.isScanning) qr.stop() } catch {} }
  }, [isScanning, workCards])

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

  // ── ДІЯ 2: Завершити етап → БУФЕР (in-progress → at-buffer, ТА САМА операція!) ──
  const handleCompleteToBuffer = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = Math.max(0, (currentCard.quantity || 0) - scrapCount)
      const op = finalOperator || currentCard.operator_name || 'Не вказано'
      const isFinal = currentCard.operation === CHAIN[CHAIN.length - 1] // Прийомка

      // Записуємо в history
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

      // Оновлюємо картку
      await supabase.from('work_cards').update(
        isFinal
          ? { status: 'completed', quantity: qtyDone, operator_name: op }
          : { status: 'at-buffer', quantity: qtyDone, operator_name: op }
      ).eq('id', currentCard.id)

      // ── При ПРИЙОМЦІ (фінал) → зараховуємо на склад ─────────────────
      if (isFinal && qtyDone > 0) {
        const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
        if (nom) {
          // БЗ: читаємо зі значення картки (якщо є мітка [BZ:X])
          const bzMatch = (currentCard.card_info || '').match(/\[BZ:(\d+)\]/)
          const bzQty = bzMatch ? Number(bzMatch[1]) : 0
          // Чисті напів-фабрикати = все що прийнято
          const netQty = qtyDone

          const invItem = inventory.find(i => i.nomenclature_id === nom.id)
          if (invItem) {
            await supabase.from('inventory').update({
              total_qty: (Number(invItem.total_qty) || 0) + netQty,
              bz_qty: (Number(invItem.bz_qty) || 0) + bzQty
            }).eq('id', invItem.id)
          } else {
            await supabase.from('inventory').upsert([{
              name: nom.name,
              unit: nom.unit || 'шт',
              total_qty: netQty,
              bz_qty: bzQty,
              type: 'semi',
              nomenclature_id: nom.id
            }], { onConflict: 'nomenclature_id' })
          }
        }
      }

      await fetchData()
      setShowCompleteModal(false)
      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setIsProcessing(false) }
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
        machine: selectedMachine || null
      }).eq('id', currentCard.id)
      await fetchData()
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  // ── ПРИЙНЯТИ НА СКЛАД (з буфера Галтовки без in-progress) ─────────────
  const handleAcceptToStock = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = currentCard.quantity || 0
      const op = selectedOperator || currentCard.operator_name || 'Прийомка'

      // Записуємо history запис прийомки
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

      // Картка → completed
      await supabase.from('work_cards').update({
        status: 'completed',
        operation: 'Прийомка'
      }).eq('id', currentCard.id)

      // Оновлюємо склад (напів-фабрикати)
      if (qtyDone > 0) {
        const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
        if (nom) {
          const bzMatch = (currentCard.card_info || '').match(/\[BZ:(\d+)\]/)
          const bzQty = bzMatch ? Number(bzMatch[1]) : 0
          // Шукаємо по nomenclature_id
          const invItem = (inventory || []).find(i => String(i.nomenclature_id) === String(nom.id))
          if (invItem) {
            // Оновлюємо існуючий запис
            await supabase.from('inventory').update({
              total_qty: (Number(invItem.total_qty) || 0) + qtyDone,
              bz_qty: (Number(invItem.bz_qty) || 0) + bzQty
            }).eq('id', invItem.id)
          } else {
            // Створюємо новий запис (insert, без onConflict)
            await supabase.from('inventory').insert([{
              name: nom.name,
              unit: nom.unit || 'шт',
              total_qty: qtyDone,
              bz_qty: bzQty,
              type: 'semi',
              nomenclature_id: nom.id
            }])
          }
        }
      }

      await fetchData()
      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  // ── Статистика по кожному етапу ─────────────────────────────────────────
  const stageStats = stage => {
    const cards = workCards.filter(c => c.operation === stage && CHAIN.includes(c.operation))
    return {
      inWork:   cards.filter(c => c.status === 'in-progress').reduce((a, c) => a + (c.quantity || 0), 0),
      inBuffer: cards.filter(c => c.status === 'at-buffer').reduce((a, c) => a + (c.quantity || 0), 0),
      scrap:    workCardHistory.filter(h => h.stage_name === stage).reduce((a, h) => a + (Number(h.scrap_qty) || 0), 0),
      total:    cards.length
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>
              {nom?.name || 'Деталь'}
            </h2>
            <div style={{ fontSize: '0.68rem', color: '#444', marginTop: '4px' }}>
              Картка #{currentCard.id} · {currentCard.quantity} шт
            </div>
          </div>
          <button onClick={() => setSelectedCardId(null)}
            style={{ background: '#111', border: 'none', color: '#555', padding: '9px', borderRadius: '10px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '22px', border: '1px solid #1a1a1a', padding: '32px' }}>

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
                  <div>
                    <label style={labelStyle}>Верстат / обладнання</label>
                    <input type="text" placeholder="Номер верстата..."
                      value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                      style={{ ...selectStyle, cursor: 'text' }} />
                  </div>
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

                <div style={{ fontSize: '5.5rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.05em' }}>
                  {formatTime(currentCard.started_at)}
                </div>
                
                <div style={{ color: '#333', fontSize: '0.72rem', marginTop: '12px', marginBottom: '32px', fontWeight: 800 }}>
                  ОПЕРАТОР: <span style={{ color: '#666' }}>{currentCard.operator_name || '—'}</span>
                </div>

              {/* Стрілка куди піде картка */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '28px', background: '#f59e0b0d', border: '1px solid #f59e0b22', borderRadius: '12px', padding: '11px 20px' }}>
                <span style={{ fontSize: '0.68rem', color: '#555', fontWeight: 700 }}>{currentCard.operation}</span>
                <ArrowRight size={13} color="#f59e0b" />
                <span style={{ fontSize: '0.62rem', background: '#f59e0b', color: '#000', fontWeight: 900, padding: '2px 8px', borderRadius: '5px' }}>
                  БУФЕР {currentCard.operation?.toUpperCase()}
                </span>
                {!isFinal && (
                  <>
                    <ArrowRight size={13} color="#444" />
                    <span style={{ fontSize: '0.68rem', color: '#444', fontWeight: 700 }}>{next}</span>
                  </>
                )}
              </div>

                <button onClick={() => { setScrapCount(0); setFinalOperator(currentCard.operator_name || ''); setShowCompleteModal(true) }}
                  style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 64px', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 1000, cursor: 'pointer', boxShadow: '0 10px 30px rgba(236,72,153,0.2)' }}>
                  {isFinal ? '✓ ПРИЙНЯТО' : `✓ ЗАВЕРШИТИ ${opName}`}
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
                    <div style={{ marginBottom: '20px' }}>
                      <label style={labelStyle}>Верстат</label>
                      <input type="text" value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                        placeholder="Номер верстата..." style={{ ...selectStyle, cursor: 'text' }} />
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

      {/* Ланцюжок з буферами + сток Прийомки */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: '36px', overflowX: 'auto', paddingBottom: '6px' }}>
        {/* ─── Етапи: Різка та Галтовка ─── */}
        {['Різка', 'Галтовка'].map((stage, idx) => {
          const s = stageStats(stage)
          return (
            <React.Fragment key={stage}>
              <div onClick={() => { setDetailStage(stage); setDetailTab('work') }}
                style={{ 
                  flex: '1 1 180px', minWidth: '160px', background: '#0a0a0a', 
                  border: '1px solid #222', borderTop: `4px solid ${idx === 0 ? '#3b82f6' : '#f59e0b'}`,
                  borderRadius: '20px', padding: '20px 16px', cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                className="s1-stage-card">
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
              {/* Буфер між етапами */}
              {idx === 0 && (() => {
                const bufQty = stageStats('Різка').inBuffer
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '20px', height: '2px', background: bufQty > 0 ? '#f59e0b' : '#222' }} />
                      <ChevronRight size={14} color={bufQty > 0 ? '#f59e0b' : '#222'} />
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '0.46rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                      background: bufQty > 0 ? '#f59e0b20' : '#1a1a1a', color: bufQty > 0 ? '#f59e0b' : '#2a2a2a' }}>
                      {bufQty > 0 ? `${bufQty} шт` : 'БУФЕР'}
                    </div>
                  </div>
                )
              })()}
            </React.Fragment>
          )
        })}

        {/* Стрілка від Галтовки до Прийомки */}
        {(() => {
          const galBuf = stageStats('Галтовка').inBuffer
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '20px', height: '2px', background: galBuf > 0 ? '#10b981' : '#222' }} />
                <ChevronRight size={14} color={galBuf > 0 ? '#10b981' : '#222'} />
              </div>
              <div style={{ marginTop: '5px', fontSize: '0.46rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                background: galBuf > 0 ? '#10b98120' : '#1a1a1a', color: galBuf > 0 ? '#10b981' : '#2a2a2a' }}>
                {galBuf > 0 ? `${galBuf} шт` : 'СКЛАД'}
              </div>
            </div>
          )
        })()}

        {/* ─── ПРИЙОМКА: СТОК НАПІВ-ФАБРИКАТІВ (Преміум-віджет) ─── */}
        {(() => {
          const acceptedNomIds = new Set(workCardHistory.filter(h => h.stage_name === 'Прийомка').map(h => h.nomenclature_id))
          const stockItems = inventory.filter(i => acceptedNomIds.has(i.nomenclature_id))
          const totalStockQty = stockItems.reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

          return (
            <div style={{ 
              flex: '2 1 260px', minWidth: '240px', background: 'linear-gradient(145deg, #0e1a15 0%, #050a08 100%)', 
              border: '1px solid #10b98130', borderRadius: '22px', padding: '20px', 
              boxShadow: '0 15px 35px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' 
            }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: '#10b98108', borderRadius: '50%', filter: 'blur(20px)' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '1px', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 1000, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>СТОК ПРИЙОМКИ</span>
                </div>
                <div style={{ background: '#10b98115', color: '#10b981', fontSize: '0.55rem', fontWeight: 900, padding: '2px 8px', borderRadius: '10px' }}>ГОТОВО ДО ЦЕХУ №2</div>
              </div>

              {stockItems.length === 0 ? (
                <div style={{ color: '#222', fontSize: '0.75rem', textAlign: 'center', padding: '30px 0', fontWeight: 700 }}>ОЧІКУВАННЯ ПЕРШИХ ПАРТІЙ</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto', paddingRight: '4px' }}>
                  {stockItems.map(item => {
                    const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '8px 12px', border: '1px solid rgba(16,185,129,0.05)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 700 }}>{nom?.name || item.name}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>{item.total_qty}</span>
                          <span style={{ fontSize: '0.5rem', color: '#10b981', fontWeight: 900, marginLeft: '4px' }}>ШТ</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {totalStockQty > 0 && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dotted rgba(16,185,129,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>УСЬОГО НА СКЛАДІ НФ</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: '#10b981', letterSpacing: '-0.02em' }}>
                    {totalStockQty} <small style={{ fontSize: '0.6rem', opacity: 0.6 }}>од.</small>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Таблиця активних карток */}
      <div style={{ background: '#111', borderRadius: '18px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            В РОБОТІ ТА БУФЕРІ
          </h3>
          {isSyncing && <div style={{ fontSize: '0.65rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={11} className="spin-s1" /> Оновлення...</div>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0d0d0d', fontSize: '0.58rem', fontWeight: 900, color: '#333', textTransform: 'uppercase' }}>
              <th style={{ padding: '11px 18px' }}>ДЕТАЛЬ</th>
              <th style={{ padding: '11px 18px' }}>ОПЕРАЦІЯ</th>
              <th style={{ padding: '11px 18px' }}>СТАТУС</th>
              <th style={{ padding: '11px 18px' }}>К-СТЬ</th>
              <th style={{ padding: '11px 18px' }}>ОПЕРАТОР</th>
              <th style={{ padding: '11px 18px' }}>ЧАС</th>
              <th style={{ padding: '11px 18px' }}></th>
            </tr>
          </thead>
          <tbody>
            {workCards
              .filter(c => CHAIN.includes(c.operation) && (c.status === 'in-progress' || c.status === 'at-buffer'))
              .map(card => {
                const inBuf = card.status === 'at-buffer'
                return (
                  <tr key={card.id} style={{ borderBottom: '1px solid #161616', fontSize: '0.8rem' }}>
                    <td style={{ padding: '13px 18px', fontWeight: 800 }}>{getNom(card)?.name || '—'}</td>
                    <td style={{ padding: '13px 18px', color: '#777' }}>{card.operation}</td>
                    <td style={{ padding: '13px 18px' }}>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase',
                        background: inBuf ? '#f59e0b18' : '#3b82f618',
                        color: inBuf ? '#f59e0b' : '#3b82f6',
                        padding: '3px 8px', borderRadius: '5px'
                      }}>
                        {inBuf ? '▣ БУФЕР' : '▶ У РОБОТІ'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px', fontWeight: 900 }}>{card.quantity} шт</td>
                    <td style={{ padding: '13px 18px', color: '#555' }}>{card.operator_name || '—'}</td>
                    <td style={{ padding: '13px 18px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>{formatTime(card.started_at)}</td>
                    <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                      <button onClick={() => { setSelectedCardId(card.id); setSelectedOperator('') }}
                        style={{ background: '#1e1e1e', border: 'none', color: '#bbb', padding: '6px 13px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800 }}>
                        ВІДКРИТИ
                      </button>
                    </td>
                  </tr>
                )
              })}
            {workCards.filter(c => CHAIN.includes(c.operation) && (c.status === 'in-progress' || c.status === 'at-buffer')).length === 0 && (
              <tr><td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#222', fontSize: '0.8rem' }}>Немає активних карток</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── ГОЛОВНИЙ РЕНДЕР ──────────────────────────────────────────────────────
  return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>

      {/* Хедер */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '64px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <ArrowLeft size={16} /> Вихід
          </Link>
          <button onClick={() => setIsDrawerOpen(true)}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}
            className="s1-burger-btn">
            <Menu size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.06em' }}>ЦЕХ №1</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: '#eab308' }}>
          {currentTime.toLocaleTimeString()}
        </div>
      </header>

      {/* Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Ліва панель черги */}
        <div style={{ width: '258px', background: '#111', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 14px 10px', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 900, color: '#333', display: 'flex', alignItems: 'center', gap: '7px', borderBottom: '1px solid #1a1a1a' }}>
            <ClipboardList size={13} /> ЧЕРГА ({queueCards.length})
          </div>
          {renderQueue()}
          <div style={{ padding: '12px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#eab30815', border: '1px solid #eab30830', color: '#eab308', padding: '11px', borderRadius: '10px', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={15} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        {/* Мобільний дравер */}
        {isDrawerOpen && (
          <div onClick={() => setIsDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9000 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '260px', height: '100%', background: '#111', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontWeight: 900, fontSize: '0.78rem' }}>ЧЕРГА</span>
                <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              {renderQueue()}
            </div>
          </div>
        )}

        {/* Основний контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
          {scanError && (
            <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', maxWidth: '680px' }}>
              <AlertTriangle size={16} /> {scanError}
              <button onClick={() => setScanError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          )}
          {currentCard ? renderCardView() : renderDashboard()}
        </div>
      </div>

      {/* ── QR-сканер ──────────────────────────────────────────────────────── */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <button onClick={() => setIsScanning(false)}
            style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={26} />
          </button>
          <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#eab308', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ЦЕХ №1 · СКАНЕР</div>
          <div id="shop1-reader" style={{ width: '88%', maxWidth: '440px', border: '3px solid #eab308', borderRadius: '24px', overflow: 'hidden' }} />
          <div style={{ color: '#333', fontSize: '0.7rem' }}>Наведіть на QR-код робочої картки</div>
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

              <button onClick={handleCompleteToBuffer} disabled={isProcessing}
                style={{ ...btnGreen, opacity: isProcessing ? 0.5 : 1 }}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : (
                  currentCard.operation === CHAIN[CHAIN.length - 1]
                    ? '✓ ПРИЙНЯТО · ЗАВЕРШИТИ'
                    : `✓ В БУФЕР ${currentCard.operation?.toUpperCase()}`
                )}
              </button>
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
                  workCardHistory.filter(h => h.stage_name === detailStage && Number(h.scrap_qty) > 0).forEach(h => {
                    const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id))
                    agg[nom?.name || 'Деталь'] = (agg[nom?.name || 'Деталь'] || 0) + Number(h.scrap_qty)
                  })
                } else {
                  workCards.filter(c => c.operation === detailStage && (detailTab === 'work' ? c.status === 'in-progress' : c.status === 'at-buffer')).forEach(c => {
                    const nom = getNom(c)
                    agg[nom?.name || 'Деталь'] = (agg[nom?.name || 'Деталь'] || 0) + (c.quantity || 0)
                  })
                }
                const items = Object.entries(agg)
                if (!items.length) return <div style={{ textAlign: 'center', padding: '46px', color: '#222', fontSize: '0.78rem' }}>Немає даних</div>
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {items.map(([name, qty], i) => (
                      <div key={i} style={{ background: '#0d0d0d', padding: '12px 16px', borderRadius: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{name}</div>
                        <div style={{ fontWeight: 1000, fontSize: '1.05rem', color: detailTab === 'work' ? '#3b82f6' : detailTab === 'buffer' ? '#f59e0b' : '#ef4444' }}>
                          {qty} <small style={{ opacity: 0.3, fontSize: '0.5rem' }}>шт</small>
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

      <style>{`
        .s1-stage-hover:hover { background: #181818!important; transform: translateY(-3px); }
        .s1-stage-hover { transition: all 0.2s cubic-bezier(0.4,0,0.2,1)!important; }
        .spin-s1 { animation: spinS1 1s linear infinite; }
        @keyframes spinS1 { 100% { transform: rotate(360deg); } }
        .s1-burger-btn { display: none; }
        @media (max-width: 768px) { .s1-burger-btn { display: flex!important; } }
      `}</style>
    </div>
  )
}

// Стилі-константи
const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }
const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
const btnGreen   = { background: '#10b981', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
