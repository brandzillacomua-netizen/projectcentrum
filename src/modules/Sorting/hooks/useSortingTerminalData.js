import { confirmedRpc } from '../../../services/confirmedRpc.js'
import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { useStore } from '../../../store/index.js'
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
  const { getFilteredOperators, fetchData, currentUser } = useMES()

  const workCards = useStore(state => state.workCards)
  const nomenclatures = useStore(state => state.nomenclatures)

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
    setScanError(null)
    setShowCompleteModal(true)
  }

  // Full Shop2 handoff — same logic as Shop1Terminal.handleSortToShop2
  const submitSortingComplete = async () => {
    if (!activeCompletingCard || isProcessing) return
    const total = Number(activeCompletingCard.quantity)
    const scrap = Number(scrapCount)
    const rework = Number(reworkCount)
    if (![total, scrap, rework].every(Number.isFinite) || scrap < 0 || rework < 0 || scrap + rework > total) {
      setScanError('Брак і доопрацювання не можуть перевищувати кількість картки.')
      return
    }
    setIsProcessing(true)
    setScanError(null)
    try {
      const goodQty = total - scrap - rework
      await confirmedRpc(supabase, 'rpc_submit_sorting_complete_atomic', {
        p_card_id: activeCompletingCard.id,
        p_good_qty: goodQty,
        p_scrap_qty: scrap,
        p_rework_qty: rework,
        p_operator_name: selectedOperator || activeCompletingCard.operator_name || 'Сортування',
        p_shift_name: selectedShift || activeCompletingCard.shift_name || 'Без зміни'
      })
      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      setScrapCount(0)
      setReworkCount(0)
      alert('✅ ' + goodQty + ' шт відправлено в буфер Цеху №2!')
    } catch (error) {
      console.error('Sorting completion RPC failed, executing fallback transition:', error)
      try {
        const goodQty = total - scrap - rework
        const op = selectedOperator || activeCompletingCard.operator_name || 'Сортування'
        const activeShift = selectedShift || activeCompletingCard.shift_name || 'Без зміни'
        
        await supabase.from('work_cards').update({
          status: 'at-shop2-buffer',
          operation: 'Сортування',
          quantity: goodQty + rework,
          used_in_shop2_qty: rework,
          completed_at: new Date().toISOString()
        }).eq('id', activeCompletingCard.id)

        if (rework > 0) {
          await supabase.from('work_cards').insert([{
            task_id: activeCompletingCard.task_id,
            order_id: activeCompletingCard.order_id,
            nomenclature_id: activeCompletingCard.nomenclature_id,
            operation: 'Доопрацювання',
            quantity: rework,
            status: 'new',
            card_info: `[ЦЕХ №2] Автоматично з Сортування`
          }]).catch(e => console.warn('Rework card fallback insert issue:', e))
        }

        await supabase.from('work_card_history').insert([{
          card_id: activeCompletingCard.id,
          nomenclature_id: activeCompletingCard.nomenclature_id,
          stage_name: 'Сортування',
          operator_name: op,
          qty_at_start: total,
          qty_completed: goodQty,
          scrap_qty: scrap,
          started_at: activeCompletingCard.started_at || new Date().toISOString(),
          completed_at: new Date().toISOString(),
          shift_name: activeShift
        }]).catch(() => {})

        setShowCompleteModal(false)
        setActiveCompletingCard(null)
        setManualId('')
        setScanError(null)
        setScrapCount(0)
        setReworkCount(0)
        alert('✅ ' + goodQty + ' шт відправлено в буфер Цеху №2!')
      } catch (fallbackErr) {
        setScanError('Сортування не підтверджено: ' + (error?.message || fallbackErr?.message || 'Помилка мережі'))
      }
    } finally {
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
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
