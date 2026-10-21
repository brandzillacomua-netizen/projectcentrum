import { confirmedRpc } from '../../../services/confirmedRpc.js'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useMES } from '../../../MESContext'
import { useStore } from '../../../store/index.js'
import { supabase } from '../../../supabase'
import { recordSortingHistoryGuaranteed } from '../../../services/sortingHistoryService'
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'
import { executeAtomicCardTransition } from '../../../services/atomicCardTransitionService'
import { incrementInventoryStock } from '../../../services/inventoryStockService'
import {
  applySortingCompletionToCards,
  buildSortingStatusReconciliation,
  canCompleteSortingCard
} from '../utils/sortingTerminalState.js'



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
  const { getFilteredOperators, fetchData, currentUser, formatUserName } = useMES()

  const workCards = useStore(state => state.workCards)
  const nomenclatures = useStore(state => state.nomenclatures)
  const orders = useStore(state => state.orders)

  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')

  const operators = useMemo(() => {
    return getFilteredOperators('Цех №1', selectedShift, 'Сортування')
  }, [getFilteredOperators, selectedShift])

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
  const [completedCardIds, setCompletedCardIds] = useState(() => new Set())
  const completionInFlightRef = useRef(new Set())

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-select user
  useEffect(() => {
    if (currentUser) {
      const shift = currentUser.shift || 'Без зміни'
      setSelectedShift(shift)
      const displayName = formatUserName ? formatUserName(currentUser) : [currentUser.last_name, currentUser.first_name].filter(Boolean).join(' ')
      const allowedOps = getFilteredOperators('Цех №1', shift, 'Сортування')
      if (allowedOps.includes(displayName)) {
        setSelectedOperator(displayName)
      } else if (allowedOps.length === 1) {
        setSelectedOperator(allowedOps[0])
      }
    }
  }, [currentUser, getFilteredOperators, formatUserName])

  const getNom = (card) => nomenclatures.find(n => n.id === card?.nomenclature_id)
  const getOrder = (card) => (orders || []).find(o => String(o.id) === String(card?.order_id))

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

      // СОРТУВАННЯ очікує картки виключно з at-buffer/Сортування (після завершення прийомки)
      const isWaiting = card.status === 'at-buffer' && card.operation === 'Сортування'
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

  const startSortingCard = async (card, overrideOperator = null) => {
    const operatorToUse = (overrideOperator || selectedOperator || '').trim()
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }
    if (!operatorToUse) {
      setScanError('⚠️ Оберіть оператора сортування перед початком роботи.')
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
        operator_name: operatorToUse,
        shift_name: selectedShift
      }

      const historyData = {
        nomenclature_id: card.nomenclature_id,
        stage_name: 'Буфер Сортування',
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
    if (!canCompleteSortingCard(card) || completionInFlightRef.current.has(String(card?.id))) {
      setScanError('Цю картку вже передано або її стан змінився. Оновлюю список…')
      fetchData(['work_cards']).catch(() => {})
      return
    }
    setActiveCompletingCard(card)
    setFinishedCount(card.quantity || 0)
    setScrapCount(0)
    setReworkCount(0)
    setScanError(null)
    setShowCompleteModal(true)
  }

  const submitSortingComplete = async (overrideOperator = null) => {
    if (!activeCompletingCard || isProcessing) return
    const cardId = String(activeCompletingCard.id)
    if (completionInFlightRef.current.has(cardId)) return
    if (!canCompleteSortingCard(activeCompletingCard)) {
      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setScanError('Цю картку вже передано в буфер Цеху №2.')
      fetchData(['work_cards']).catch(() => {})
      return
    }
    const responsibleOperator = String(overrideOperator || activeCompletingCard.operator_name || selectedOperator || '').trim()
    if (!responsibleOperator || responsibleOperator === 'Команда' || responsibleOperator === 'Сортування') {
      setScanError('Не визначено оператора сортування. Будь ласка, оберіть оператора.')
      return
    }
    const total = Number(activeCompletingCard.quantity)
    const scrap = Number(scrapCount)
    const rework = Number(reworkCount)
    if (![total, scrap, rework].every(Number.isFinite) || scrap < 0 || rework < 0 || scrap + rework > total) {
      setScanError('Брак і доопрацювання не можуть перевищувати кількість картки.')
      return
    }
    completionInFlightRef.current.add(cardId)
    setIsProcessing(true)
    setScanError(null)
    try {
      const goodQty = total - scrap - rework
      const result = await confirmedRpc(supabase, 'rpc_submit_sorting_complete_atomic', {
        p_card_id: activeCompletingCard.id,
        p_good_qty: goodQty,
        p_scrap_qty: scrap,
        p_rework_qty: rework,
        p_operator_name: responsibleOperator,
        p_shift_name: selectedShift || activeCompletingCard.shift_name || 'Без зміни'
      })
      let { data: confirmedCard, error: confirmationError } = await supabase
        .from('work_cards')
        .select('id, status, operation, quantity, used_in_shop2_qty, completed_at')
        .eq('id', activeCompletingCard.id)
        .maybeSingle()
      if (confirmationError) throw confirmationError

      // An idempotent RPC replay can return an older accounting receipt while a
      // legacy/stale card row still says "in-progress". Accounting must NOT run
      // twice; reconcile only the card state from the already confirmed result.
      if (confirmedCard?.status === 'in-progress' && confirmedCard?.operation === 'Сортування') {
        const reconciliation = buildSortingStatusReconciliation({
          result,
          fallbackGoodQty: goodQty,
          fallbackReworkQty: rework,
          completedAt: new Date().toISOString()
        })
        const { data: repairedCard, error: repairError } = await supabase
          .from('work_cards')
          .update(reconciliation)
          .eq('id', activeCompletingCard.id)
          .eq('status', 'in-progress')
          .eq('operation', 'Сортування')
          .select('id, status, operation, quantity, used_in_shop2_qty, completed_at')
          .maybeSingle()
        if (repairError) throw repairError
        if (repairedCard) confirmedCard = repairedCard
      }

      if (!confirmedCard || confirmedCard.status !== 'at-shop2-buffer') {
        throw new Error('Облік підтверджено, але не вдалося відновити статус картки. Повторне списання заблоковано; зверніться до адміністратора.')
      }

      const completedAt = new Date().toISOString()
      setCompletedCardIds(previous => {
        const next = new Set(previous)
        next.add(cardId)
        return next
      })
      useStore.setState(state => ({
        workCards: applySortingCompletionToCards(state.workCards, {
          cardId,
          goodQty: Math.max(0, Number(confirmedCard.quantity) - Number(confirmedCard.used_in_shop2_qty || 0)),
          reworkQty: Number(confirmedCard.used_in_shop2_qty) || 0,
          completedAt: confirmedCard.completed_at || completedAt
        })
      }))
      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      setScrapCount(0)
      setReworkCount(0)
      try {
        await fetchData(['work_cards', 'work_card_history', 'inventory'], { force: true })
      } catch (refreshError) {
        console.warn('Sorting completed, but background refresh failed:', refreshError)
      }
      alert(result?.already_sorted
        ? 'ℹ️ Цю картку вже було передано в буфер Цеху №2.'
        : '✅ ' + goodQty + ' шт відправлено в буфер Цеху №2!')
    } catch (error) {
      console.error('Sorting completion RPC failed:', error)
      setScanError('Сортування не підтверджено: ' + (error?.message || 'Помилка мережі'))
    } finally {
      completionInFlightRef.current.delete(cardId)
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

  // Картки в очікуванні: виключно at-buffer/Сортування
  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => !completedCardIds.has(String(c.id)) && c.status === 'at-buffer' && c.operation === 'Сортування')
      .sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0))
  }, [workCards, completedCardIds])

  // Картки в роботі: in-progress/Сортування
  const inWorkCards = useMemo(() => {
    return workCards
      .filter(c => !completedCardIds.has(String(c.id)) && c.status === 'in-progress' && c.operation === 'Сортування')
      .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
  }, [workCards, completedCardIds])

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
    setSelectedOperator,
    operators,
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
    getOrder,
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
