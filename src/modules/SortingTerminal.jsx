import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Tablet, Search, RefreshCw, Play, CheckCircle, AlertTriangle, X, Clock, Layers, Camera } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { recordSortingHistoryGuaranteed } from '../services/sortingHistoryService'

// Map Cyrillic keyboard characters to English QWERTY for barcode scanners
const cyrillicToLatinMap = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ї': ']',
  'ф': 'a', 'ы': 's', 'і': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'є': '\'',
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', '.': '/',
  'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': '{', 'Ї': '}',
  'Ф': 'A', 'Ы': 'S', 'І': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K', 'Д': 'L', 'Ж': ':', 'Є': '"',
  'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N', 'Ь': 'M', 'Б': '<', 'Ю': '>', ',': '?',
  '?': '/', 'ё': '`', 'Ё': '~', '№': '#'
}

const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

// Кольори модуля (зелено-смарагдові для Сортування)
const ACCENT = '#34d399'
const ACCENT_RGB = '52,211,153'

export default function SortingTerminal() {
  const { workCards, nomenclatures, getFilteredOperators, fetchData, currentUser, tasks, orders } = useMES()

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
  const [reworkCount, setReworkCount] = useState(0)
  const [finishedCount, setFinishedCount] = useState(0)

  const [pendingStartCard, setPendingStartCard] = useState(null)
  const [filterMode, setFilterMode] = useState('all')

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-select user
  useEffect(() => {
    if (currentUser) {
      setSelectedShift(currentUser.shift || 'Без зміни')
      const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ')
      const displayName = fullName || currentUser.login || ''
      const nameWithPosition = currentUser.position ? `${displayName} (${currentUser.position})` : displayName
      const allowedOps = getFilteredOperators('Цех №1', currentUser.shift || 'Без зміни', 'Сортування')
      if (allowedOps.includes(nameWithPosition)) {
        setSelectedOperator(nameWithPosition)
      } else {
        setSelectedOperator('')
      }
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
      html5QrCode = new window.Html5Qrcode('reader-sorting')
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {})
        setIsScanning(false)
      }
      html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (text) => {
          if (text.startsWith('CENTRUM_CARD_')) {
            const id = text.replace('CENTRUM_CARD_', '').trim()
            await stopAndClose()
            handleCardActionById(id)
          } else {
            setScanError('Невірний формат QR-коду. Очікується картка процесу.')
          }
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
      let card = workCards.find(c => String(c.id).trim() === id || String(c.id).toUpperCase().endsWith(id.toUpperCase()))
      if (!card) {
        await fetchData('work_cards').catch(() => {})
        card = workCards.find(c => String(c.id).trim() === id || String(c.id).toUpperCase().endsWith(id.toUpperCase()))
      }
      if (!card) {
        setScanError(`Картку №${id} не знайдено в системі`)
        setIsProcessing(false)
        return
      }

      // СОРТУВАННЯ очікує картки з at-buffer/Сортування або at-buffer/Прийомка
      const isWaiting = card.status === 'at-buffer' && (card.operation === 'Сортування' || card.operation === 'Прийомка')
      const isInWork = card.status === 'in-progress' && card.operation === 'Сортування'

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

  const startSortingCard = async (card) => {
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const bufferStart = card.completed_at || card.started_at || now

      // Запис в historical log про буфер
      await supabase.from('work_card_history').insert([{
        card_id: card.id,
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation === 'Прийомка' ? 'Буфер Галтовки' : 'Буфер Сортування',
        operator_name: card.operator_name || 'Команда',
        qty_at_start: card.quantity || 0,
        qty_completed: card.quantity || 0,
        scrap_qty: 0,
        started_at: bufferStart,
        completed_at: now,
        shift_name: selectedShift,
        manager_name: card.manager_name || 'Не вказано',
        machine_name: card.machine || 'Не вказано'
      }])

      await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: 'Сортування',
        started_at: now,
        operator_name: selectedOperator || card.operator_name || 'Команда',
        shift_name: selectedShift
      }).eq('id', card.id)

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
    setReworkCount(0)
    setShowCompleteModal(true)
  }

  // Full Shop2 handoff — same logic as Shop1Terminal.handleSortToShop2
  const submitSortingComplete = async () => {
    if (!activeCompletingCard) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const goodQty = Math.max(0, (activeCompletingCard.quantity || 0) - scrapCount - reworkCount)
      const op = selectedOperator || activeCompletingCard.operator_name || 'Сортування'
      const activeShift = selectedShift || activeCompletingCard.shift_name || 'Без зміни'

      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      }

      // Parallel read: inventory, shop2 tasks, s1 task
      const [existingInvResult, shop2TasksResult, s1TaskResult] = await Promise.all([
        supabase.from('inventory').select('*').eq('nomenclature_id', activeCompletingCard.nomenclature_id).in('type', ['semi', 'wip_bz', 'bz', 'semi_shop2', 'bz_shop2', 'scrap_ready']),
        supabase.from('tasks').select('*').eq('order_id', activeCompletingCard.order_id).ilike('step', '%ЦЕХ №2%').neq('status', 'completed'),
        supabase.from('tasks').select('*').eq('id', activeCompletingCard.task_id).maybeSingle()
      ])

      const existingItems = existingInvResult.data || []
      const shop2Tasks = shop2TasksResult.data || []
      const s1TaskData = s1TaskResult.data
      const findItem = (type) => existingItems.find(i => i.type === type)

      const cardBz = Number(activeCompletingCard.buffer_qty) || Number((activeCompletingCard.card_info || '').match(/\[BZ:(\d+)\]/)?.[1]) || 0
      const cardNeed = Number((activeCompletingCard.card_info || '').match(/\[REQ:(\d+)\]/)?.[1]) || Number((activeCompletingCard.card_info || '').match(/\[NEED:(\d+)\]/)?.[1]) || Math.max(0, Number(activeCompletingCard.quantity) - cardBz)
      const actualNeed = Math.min(goodQty, cardNeed)
      const actualBz = Math.max(0, goodQty - actualNeed)

      const invUpdates = []
      const invInserts = []
      const nom = nomenclatures.find(n => n.id === activeCompletingCard.nomenclature_id)

      // Decrease semi in shop1
      if (actualNeed > 0) {
        const s1Semi = findItem('semi')
        if (s1Semi) invUpdates.push({ ...s1Semi, total_qty: Math.max(0, (Number(s1Semi.total_qty) || 0) - actualNeed) })
      }
      // Decrease wip_bz/bz in shop1
      if (actualBz > 0) {
        let rem = actualBz
        const s1Wip = findItem('wip_bz')
        if (s1Wip) { const take = Math.min(Number(s1Wip.total_qty) || 0, rem); invUpdates.push({ ...s1Wip, total_qty: Math.max(0, (Number(s1Wip.total_qty) || 0) - take) }); rem -= take }
        if (rem > 0) { const s1Bz = findItem('bz'); if (s1Bz) { const take = Math.min(Number(s1Bz.total_qty) || 0, rem); invUpdates.push({ ...s1Bz, total_qty: Math.max(0, (Number(s1Bz.total_qty) || 0) - take) }) } }
      }
      // Increase semi_shop2
      if (actualNeed > 0) {
        const s2Semi = findItem('semi_shop2')
        if (s2Semi) invUpdates.push({ ...s2Semi, total_qty: (Number(s2Semi.total_qty) || 0) + actualNeed })
        else invInserts.push({ nomenclature_id: activeCompletingCard.nomenclature_id, name: nom?.name || 'Деталь', total_qty: actualNeed, reserved_qty: 0, type: 'semi_shop2', unit: nom?.unit || 'шт' })
      }
      // Increase bz_shop2
      if (actualBz > 0) {
        const s2Bz = findItem('bz_shop2')
        if (s2Bz) invUpdates.push({ ...s2Bz, total_qty: (Number(s2Bz.total_qty) || 0) + actualBz })
        else invInserts.push({ nomenclature_id: activeCompletingCard.nomenclature_id, name: nom?.name || 'Деталь', total_qty: actualBz, reserved_qty: 0, type: 'bz_shop2', unit: nom?.unit || 'шт' })
      }
      // Scrap
      if (scrapCount > 0) {
        const scrapItem = findItem('scrap_ready')
        if (scrapItem) invUpdates.push({ ...scrapItem, total_qty: (Number(scrapItem.total_qty) || 0) + scrapCount, updated_at: now })
        else invInserts.push({ name: nom?.name || 'Деталь', unit: nom?.unit || 'шт', total_qty: scrapCount, type: 'scrap_ready', nomenclature_id: activeCompletingCard.nomenclature_id })
      }

      // History
      let scrapOperator = op;
      if (scrapCount > 0) {
        try {
          const { data: cuttingHistory } = await supabase
            .from('work_card_history')
            .select('operator_name')
            .eq('card_id', activeCompletingCard.id)
            .eq('stage_name', 'Розкрій');

          if (cuttingHistory && cuttingHistory.length > 0) {
            const cuttingOperators = [...new Set(cuttingHistory.map(h => h.operator_name).filter(Boolean))];
            if (cuttingOperators.length === 1) {
              scrapOperator = cuttingOperators[0];
            }
          }
        } catch (err) {
          console.error('Failed to resolve cutting operator:', err);
        }
      }

      // VKYA delivery is recorded before any card/inventory/task mutation.
      // The RPC is atomic and idempotent, so a timeout or retry cannot lose
      // or duplicate the scrap history for this card.
      const historyDelivery = await recordSortingHistoryGuaranteed(supabase, {
        card: activeCompletingCard,
        operatorName: scrapOperator,
        bufferOperatorName: op,
        shiftName: activeShift,
        qtyCompleted: goodQty,
        scrapQty: scrapCount,
        recordedAt: now
      })
      if (historyDelivery.error) throw historyDelivery.error

      // Task arrivals
      let shop2TaskId = null
      const writePromises = []

      writePromises.push(
        supabase.from('work_cards').update({
          status: 'at-shop2-buffer',
          operation: 'Сортування',
          quantity: goodQty + reworkCount,
          used_in_shop2_qty: reworkCount,
          completed_at: now
        }).eq('id', activeCompletingCard.id)
      )

      if (!shop2Tasks || shop2Tasks.length === 0) {
        if (s1TaskData) {
          shop2TaskId = generateUUID()
          writePromises.push(
            supabase.from('tasks').insert([{
              id: shop2TaskId,
              order_id: activeCompletingCard.order_id,
              step: 'Пресування [ЦЕХ №2]',
              status: 'in-progress',
              planned_sets: s1TaskData.planned_sets || 0,
              estimated_time: s1TaskData.estimated_time || 0,
              engineer_conf: true,
              warehouse_conf: 'true',
              director_conf: true,
              batch_index: s1TaskData.batch_index || null,
              plan_snapshot: { ...(s1TaskData.plan_snapshot || {}), arrivals: [{ id: activeCompletingCard.nomenclature_id, name: nom?.name || 'Деталь', semi: actualNeed, bz: actualBz }] }
            }])
          )
        }
      } else {
        shop2TaskId = shop2Tasks[0].id
        const existingArrivals = shop2Tasks[0]?.plan_snapshot?.arrivals || []
        const updatedArrivals = [...existingArrivals]
        const matchIdx = updatedArrivals.findIndex(a => String(a.id) === String(activeCompletingCard.nomenclature_id))
        if (matchIdx >= 0) {
          updatedArrivals[matchIdx] = { ...updatedArrivals[matchIdx], semi: (Number(updatedArrivals[matchIdx].semi) || 0) + actualNeed, bz: (Number(updatedArrivals[matchIdx].bz) || 0) + actualBz }
        } else {
          updatedArrivals.push({ id: activeCompletingCard.nomenclature_id, name: nom?.name || 'Деталь', semi: actualNeed, bz: actualBz })
        }
        writePromises.push(
          supabase.from('tasks').update({ status: 'in-progress', plan_snapshot: { ...(shop2Tasks[0].plan_snapshot || {}), arrivals: updatedArrivals } }).eq('id', shop2Tasks[0].id)
        )
      }

      // Rework card
      if (reworkCount > 0) {
        writePromises.push(
          supabase.from('work_cards').insert([{
            task_id: shop2TaskId || activeCompletingCard.task_id,
            order_id: activeCompletingCard.order_id,
            nomenclature_id: activeCompletingCard.nomenclature_id,
            operation: 'Доопрацювання',
            quantity: reworkCount,
            status: 'new',
            card_info: '[ЦЕХ №2] Автоматично з Сортування'
          }])
        )
      }

      if (invUpdates.length > 0) writePromises.push(supabase.from('inventory').upsert(invUpdates))
      if (invInserts.length > 0) writePromises.push(supabase.from('inventory').insert(invInserts))
      const results = await Promise.all(writePromises)
      for (const res of results) { if (res.error) throw res.error }

      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      setScrapCount(0)
      setReworkCount(0)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
      alert(`✅ ${goodQty} шт відправлено в буфер Цеху №2!`)
    } catch (e) {
      setScanError('Помилка завершення сортування: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing } = await supabase.from('inventory')
        .select('*').eq('nomenclature_id', nomId).eq('type', type).limit(1).maybeSingle()
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
    } catch (e) {
      console.warn('Scrap inventory update failed:', e)
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

  // Картки в очікуванні: at-buffer/Сортування або at-buffer/Прийомка
  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'at-buffer' && (c.operation === 'Сортування' || c.operation === 'Прийомка'))
      .sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0))
  }, [workCards])

  // Картки в роботі: in-progress/Сортування
  const inWorkCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'in-progress' && c.operation === 'Сортування')
      .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
  }, [workCards])

  const displayedCards = useMemo(() => {
    const list = []
    if (filterMode === 'all' || filterMode === 'waiting') list.push(...waitingCards.map(c => ({ ...c, type: 'waiting' })))
    if (filterMode === 'all' || filterMode === 'in_work') list.push(...inWorkCards.map(c => ({ ...c, type: 'in_work' })))
    return list.sort((a, b) => {
      if (a.type === 'in_work' && b.type === 'waiting') return -1
      if (a.type === 'waiting' && b.type === 'in_work') return 1
      return new Date(a.type === 'in_work' ? a.started_at : a.completed_at || 0) - new Date(b.type === 'in_work' ? b.started_at : b.completed_at || 0)
    })
  }, [filterMode, waitingCards, inWorkCards])

  return (
    <div style={{ background: '#070709', minHeight: '100vh', color: '#fff', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <header style={{ flexShrink: 0, background: 'rgba(12,12,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '0 24px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
            <ArrowLeft size={16} /> На головну
          </Link>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: `rgba(${ACCENT_RGB},0.1)`, padding: '8px', borderRadius: '12px' }}>
              <Tablet size={20} color={ACCENT} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 950, letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0 }}>ЕКРАН СОРТУВАННЯ</h1>
              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px', fontWeight: 700 }}>ТЕРМІНАЛ ФІНАЛЬНОЇ ПЕРЕВІРКИ</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Зміна</span>
            <select
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '8px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', outline: 'none', width: '120px' }}
            >
              <option value="">— Оберіть —</option>
              <option value="Зміна 1">Зміна 1</option>
              <option value="Зміна 2">Зміна 2</option>
              <option value="Зміна 3">Зміна 3</option>
              <option value="Зміна 4">Зміна 4</option>
              <option value="Без зміни">Без зміни</option>
            </select>
          </div>
          <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ textAlign: 'right', minWidth: '80px' }}>
            <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 900, fontFamily: 'monospace' }}>
              {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ color: '#444', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
              {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </div>
      </header>

      {/* SCANNER BAR */}
      <section style={{ padding: '20px 24px 0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '600px', margin: '0 auto' }}>
          <button
            onClick={() => setIsScanning(true)}
            style={{ background: ACCENT, color: '#000', border: 'none', padding: '14px', borderRadius: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 32px rgba(${ACCENT_RGB},0.2)`, transition: '0.2s' }}
          >
            <Camera size={20} />
          </button>
          <form onSubmit={handleManualSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#0e0e12', border: '1px solid rgba(255,255,255,0.03)', padding: '12px 18px', borderRadius: '18px' }}>
            <Search size={18} color="#6b7280" />
            <input
              type="text"
              placeholder="Скануйте штрих-код або введіть ID..."
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              disabled={isProcessing}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
            />
            <button type="submit" disabled={isProcessing} style={{ background: ACCENT, color: '#000', border: 'none', padding: '6px 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
              {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ВВЕСТИ'}
            </button>
          </form>
        </div>
        {scanError && (
          <div style={{ maxWidth: '600px', margin: '12px auto 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{scanError}</span>
            <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
          </div>
        )}
      </section>

      {/* MAIN */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <section style={{ flex: 1, background: '#0c0c10', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filter tabs */}
          <div style={{ padding: '18px 24px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '6px', scrollbarWidth: 'none' }} className="hide-scrollbar">
              {[
                { mode: 'all', label: 'Усі картки', count: waitingCards.length + inWorkCards.length, color: ACCENT },
                { mode: 'waiting', label: 'Очікують на сортування', count: waitingCards.length, color: '#f59e0b' },
                { mode: 'in_work', label: 'На Сортуванні', count: inWorkCards.length, color: '#10b981' }
              ].map(tab => (
                <button
                  key={tab.mode}
                  type="button"
                  onClick={() => setFilterMode(tab.mode)}
                  style={{
                    background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : ACCENT_RGB}, 0.12)` : '#121216',
                    color: filterMode === tab.mode ? tab.color : '#888',
                    border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'rgba(255,255,255,0.04)'}`,
                    padding: '8px 16px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0
                  }}
                >
                  {tab.label}
                  <span style={{
                    background: filterMode === tab.mode ? tab.color : '#222',
                    color: filterMode === tab.mode ? '#000' : '#888',
                    borderRadius: '6px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 900
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Буфер Сортування → Цех №2</div>
          </div>

          {/* Cards List */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scroll">
            {displayedCards.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, padding: '50px 0' }}>
                <Layers size={64} />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '12px' }}>Немає карток для Сортування</h3>
              </div>
            ) : (
              displayedCards.map(card => {
                const nom = getNom(card)
                const isWaiting = card.type === 'waiting'
                const timeStr = isWaiting
                  ? (card.completed_at ? formatDuration(card.completed_at) : '—')
                  : formatDuration(card.started_at)

                return (
                  <div key={card.id} style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', position: 'relative' }} className="hover-lift">
                    <div style={{ position: 'absolute', left: 0, top: '15px', bottom: '15px', width: '3px', background: isWaiting ? '#f59e0b' : ACCENT, borderRadius: '0 3px 3px 0' }} />
                    <div style={{ flex: '1 1 300px', paddingLeft: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>
                          Картка #{card.id.slice(-8).toUpperCase()}
                        </span>
                        {(() => {
                          const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                          return seqMatch ? (
                            <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 950 }}>{seqMatch[1]}</span>
                          ) : null
                        })()}
                        {isWaiting ? (
                          <span style={{ fontSize: '0.55rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                            Буфер Сортування
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.55rem', background: `rgba(${ACCENT_RGB},0.12)`, color: ACCENT, border: `1px solid rgba(${ACCENT_RGB},0.25)`, padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                            Сортування
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                        {nom?.name || 'Невказана деталь'}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                          К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                          Оператор: <span style={{ color: '#aaa' }}>{(card.operator_name || 'Не вказано').split(' (')[0]}</span>
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                          Зміна: <span style={{ color: '#aaa' }}>{card.shift_name || '—'}</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isWaiting ? '#6b7280' : ACCENT, fontSize: '0.68rem', fontWeight: 900, fontFamily: 'monospace' }}>
                        <Clock size={12} /> {timeStr}
                      </div>
                      {isWaiting ? (
                        <button
                          onClick={() => setPendingStartCard(card)}
                          disabled={isProcessing}
                          style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Play size={11} fill="currentColor" /> СОРТУВАТИ
                        </button>
                      ) : (
                        <button
                          onClick={() => openCompleteModal(card)}
                          disabled={isProcessing}
                          style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <CheckCircle size={11} /> ЗАВЕРШИТИ
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#0e0e12', width: '100%', maxWidth: '420px', borderRadius: '28px', border: `1px solid rgba(${ACCENT_RGB},0.25)`, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '20px 24px', background: `rgba(${ACCENT_RGB},0.06)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${ACCENT_RGB},0.1)` }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                <Play size={16} fill="currentColor" /> Взяти на Сортування
              </h3>
              <button onClick={() => setPendingStartCard(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 18px' }}>
                <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900 }}>#{pendingStartCard.id.slice(-8).toUpperCase()}</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', marginTop: '6px' }}>{getNom(pendingStartCard)?.name || 'Деталь'}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, marginTop: '4px' }}>К-сть: <strong style={{ color: '#fff' }}>{pendingStartCard.quantity} шт</strong></div>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>
                Підтвердіть що картка переходить у <strong style={{ color: '#fff' }}>Сортування</strong>.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPendingStartCard(null)} disabled={isProcessing} style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.05)', color: '#aaa', padding: '14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}>
                  СКАСУВАТИ
                </button>
                <button onClick={() => startSortingCard(pendingStartCard)} disabled={isProcessing} style={{ flex: 2, background: ACCENT, border: 'none', color: '#000', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {isProcessing ? <RefreshCw size={15} className="anim-spin" /> : <><Play size={15} fill="currentColor" /> СОРТУВАТИ</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && activeCompletingCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0e0e11', width: '100%', maxWidth: '420px', borderRadius: '28px', border: `1px solid rgba(${ACCENT_RGB},0.2)`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                  <CheckCircle size={16} /> Завершити Сортування
                </h3>
                <div style={{ fontSize: '0.62rem', color: '#555', marginTop: '2px', fontWeight: 800 }}>Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}</div>
              </div>
              <button onClick={() => setShowCompleteModal(false)} disabled={isProcessing} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Деталь</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{getNom(activeCompletingCard)?.name || 'Невказана деталь'}</div>
              </div>
              {/* Rework counter */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>В Цех №2 (OK)</label>
                  <input
                    type="number" min="0" max={(activeCompletingCard.quantity || 0) - reworkCount}
                    value={finishedCount}
                    onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setFinishedCount(val); setScrapCount(Math.max(0, (activeCompletingCard.quantity || 0) - reworkCount - val)) }}
                    style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Брак (шт)</label>
                  <input
                    type="number" min="0" max={(activeCompletingCard.quantity || 0) - reworkCount}
                    value={scrapCount}
                    onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setScrapCount(val); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - reworkCount - val)) }}
                    style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                </div>
              </div>
              {/* Rework counter */}
              <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '14px', border: '1px solid #f59e0b22' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>НА ДООПРАЦЮВАННЯ (Цех №2)</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <button onClick={() => { const n = Math.max(0, reworkCount - 1); setReworkCount(n); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - scrapCount - n)) }}
                    style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={(activeCompletingCard.quantity || 0) - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                    onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setReworkCount(val); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - scrapCount - val)) }}
                    style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '2.5rem', width: '80px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => { const n = Math.min((activeCompletingCard.quantity || 0) - scrapCount, reworkCount + 1); setReworkCount(n); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - scrapCount - n)) }}
                    style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>
              <div style={{ background: `rgba(${ACCENT_RGB},0.06)`, border: `1px solid rgba(${ACCENT_RGB},0.15)`, borderRadius: '10px', padding: '10px 14px', fontSize: '0.72rem', color: ACCENT, fontWeight: 800, textAlign: 'center' }}>
                ✅ В Цех №2: <strong>{finishedCount}</strong> · Доопр: <strong style={{color:'#f59e0b'}}>{reworkCount}</strong> · Брак: <strong style={{color:'#ef4444'}}>{scrapCount}</strong> / {activeCompletingCard.quantity || 0} шт
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#6b7280', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '12px' }}>
                <span>Разом по картці:</span>
                <span style={{ color: '#fff' }}>{activeCompletingCard.quantity || 0} шт</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowCompleteModal(false)} disabled={isProcessing} style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.03)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>СКАСУВАТИ</button>
                <button onClick={submitSortingComplete} disabled={isProcessing} style={{ flex: 1, background: ACCENT, border: 'none', color: '#000', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {isProcessing ? <RefreshCw size={14} className="anim-spin" /> : <><CheckCircle size={14} /> ПЕРЕДАТИ В ЦЕХ №2</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
          <button onClick={() => { setIsScanning(false); setShowManualInput(false); setScanError(null) }}
            style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={26} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 1000, color: ACCENT, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>ЕКРАН СОРТУВАННЯ · СКАНЕР</div>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 700 }}>ВІДСКАНУЙТЕ КАРТКУ ТЕХНОЛОГІЧНОГО ПРОЦЕСУ</div>
          </div>
          {!showManualInput ? (
            <>
              <div style={{ width: '100%', maxWidth: '480px', background: '#0a0a0a', borderRadius: '32px', border: `2px solid rgba(${ACCENT_RGB},0.3)`, overflow: 'hidden', minHeight: '300px' }}>
                <div id="reader-sorting" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowManualInput(true)} style={{ background: '#1a1a1a', border: '1px solid #333', color: ACCENT, padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                  ⌨️ ВВЕСТИ НОМЕР ВРУЧНУ
                </button>
                <button onClick={() => { setIsScanning(false); setScanError(null) }} style={{ background: 'transparent', border: '1px solid #222', color: '#555', padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                  ПОВЕРНУТИСЬ
                </button>
              </div>
            </>
          ) : (
            <div style={{ background: '#111', width: '100%', maxWidth: '400px', padding: '30px', borderRadius: '24px', border: '1px solid #222' }}>
              <form onSubmit={(e) => { e.preventDefault(); setIsScanning(false); setShowManualInput(false); handleManualSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <input autoFocus type="text" placeholder="Приклад: 12345" value={manualId} onChange={e => setManualId(e.target.value)}
                  style={{ width: '100%', background: '#000', border: `2px solid rgba(${ACCENT_RGB},0.5)`, color: '#fff', fontSize: '2.5rem', textAlign: 'center', padding: '15px', borderRadius: '16px', fontWeight: 900, fontFamily: 'monospace' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={!manualId || isProcessing} style={{ flex: 2, background: ACCENT, color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer' }}>ВІДКРИТИ КАРТКУ</button>
                  <button type="button" onClick={() => { setShowManualInput(false); setManualId('') }} style={{ flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>НАЗАД</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-lift:hover { transform: translateY(-2px); border-color: rgba(${ACCENT_RGB}, 0.2); box-shadow: 0 12px 30px rgba(0,0,0,0.3); }
        .anim-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      ` }} />
    </div>
  )
}
