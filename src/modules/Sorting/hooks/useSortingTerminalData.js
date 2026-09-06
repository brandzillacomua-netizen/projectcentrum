import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import { recordSortingHistoryGuaranteed } from '../../../services/sortingHistoryService'
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'
import { executeAtomicCardTransition } from '../../../services/atomicCardTransitionService'
import { incrementInventoryStock } from '../../../services/inventoryStockService'



// Map Cyrillic keyboard characters to English QWERTY for barcode scanners
export const cyrillicToLatinMap = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ї': ']',
  'ф': 'a', 'ы': 's', 'і': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'є': '\'',
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', '.': '/',
  'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': '{', 'Ї': '}',
  'Ф': 'A', 'Ы': 'S', 'І': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K', 'Д': 'L', 'Ж': ':', 'Є': '"',
  'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N', 'Ь': 'M', 'Б': '<', 'Ю': '>', ',': '?',
  '?': '/', 'ё': '`', 'Ё': '~', '№': '#'
}

export const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

export function useSortingTerminalData() {
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
  }, [currentUser, getFilteredOperators])

  const getNom = (card) => nomenclatures.find(n => n.id === card?.nomenclature_id)

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

          if (!scannerDebounceGuard.shouldProcessScan(scannedText)) {
            return
          }

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
            triggerHapticAudioFeedback(true)
            await stopAndClose()
            handleCardActionById(id)
          } else {
            triggerHapticAudioFeedback(false)
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

  const startSortingCard = async (card) => {
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const bufferStart = card.completed_at || card.started_at || now

      const cardUpdate = {
        status: 'in-progress',
        operation: 'Сортування',
        started_at: now,
        operator_name: selectedOperator || card.operator_name || 'Команда',
        shift_name: selectedShift
      }

      const historyData = {
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
      }

      const res = await executeAtomicCardTransition({
        cardId: card.id,
        cardUpdate,
        historyData,
        fallbackFn: async () => {
          await supabase.from('work_card_history').insert([{ card_id: card.id, ...historyData }])
          await supabase.from('work_cards').update(cardUpdate).eq('id', card.id)
        }
      })

      if (!res.success) {
        setScanError(res.message || '⚠️ Картку вже взято на сортування іншим оператором')
        fetchData(['work_cards']).catch(() => {})
        return
      }

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
      // Atomic stock increments for Shop 2 buffer and scrap
      const stockIncrements = []
      if (actualNeed > 0) {
        stockIncrements.push(
          incrementInventoryStock({
            nomenclatureId: activeCompletingCard.nomenclature_id,
            qty: actualNeed,
            type: 'semi_shop2',
            nomenclatures
          })
        )
      }
      if (actualBz > 0) {
        stockIncrements.push(
          incrementInventoryStock({
            nomenclatureId: activeCompletingCard.nomenclature_id,
            qty: actualBz,
            type: 'bz_shop2',
            nomenclatures
          })
        )
      }
      if (scrapCount > 0) {
        stockIncrements.push(
          incrementInventoryStock({
            nomenclatureId: activeCompletingCard.nomenclature_id,
            qty: scrapCount,
            type: 'scrap_ready',
            nomenclatures
          })
        )
      }

      // History
      let scrapOperator = op;
      if (scrapCount > 0) {
        try {
          const { data: cuttingHistory } = await supabase
            .from('work_card_history')
            .select('operator_name')
            .eq('card_id', activeCompletingCard.id)
            .eq('stage_name', 'Розкрій')
            .order('completed_at', { ascending: false })
            .limit(1);

          if (String(cuttingHistory?.[0]?.operator_name || '').trim()) {
            scrapOperator = String(cuttingHistory[0].operator_name).trim();
          }
        } catch (err) {
          console.error('Failed to resolve cutting operator:', err);
        }
      }

      // VKYA delivery is recorded before any card/inventory/task mutation.
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
      const results = await Promise.all([...writePromises, ...stockIncrements])
      for (const res of results) { if (res?.error) throw res.error }

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

  return {
    currentTime,
    selectedShift,
    setSelectedShift,
    selectedOperator,
    manualId,
    setManualId,
    scanError,
    setScanError,
    isProcessing,
    isScanning,
    setIsScanning,
    showManualInput,
    setShowManualInput,
    showCompleteModal,
    setShowCompleteModal,
    activeCompletingCard,
    scrapCount,
    setScrapCount,
    reworkCount,
    setReworkCount,
    finishedCount,
    setFinishedCount,
    pendingStartCard,
    setPendingStartCard,
    filterMode,
    setFilterMode,
    getNom,
    handleCardActionById,
    startSortingCard,
    openCompleteModal,
    submitSortingComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards
  }
}
