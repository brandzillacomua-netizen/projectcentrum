import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'
import { executeAtomicCardTransition } from '../../../services/atomicCardTransitionService'
import { incrementInventoryStock } from '../../../services/inventoryStockService'


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

export const ACCENT = '#a78bfa'
export const ACCENT_RGB = '167,139,250'

export function useReceptionTerminalData() {
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

  // Auto-select user
  useEffect(() => {
    if (currentUser) {
      setSelectedShift(currentUser.shift || 'Без зміни')
      const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ')
      const displayName = fullName || currentUser.login || ''
      const nameWithPosition = currentUser.position ? `${displayName} (${currentUser.position})` : displayName
      const allowedOps = getFilteredOperators('Цех №1', currentUser.shift || 'Без зміни', 'Прийомка')
      if (allowedOps.includes(nameWithPosition)) {
        setSelectedOperator(nameWithPosition)
      } else {
        setSelectedOperator('')
      }
    }
  }, [currentUser, getFilteredOperators])

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
      html5QrCode = new window.Html5Qrcode('reader-reception')
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

      const isWaiting = card.status === 'at-buffer' && (card.operation?.startsWith('Галтовка') || card.operation === 'Прийомка')
      const isInWork = card.status === 'in-progress' && card.operation === 'Прийомка'

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

  const startReceptionCard = async (card) => {
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const bufferStart = card.completed_at || card.started_at || now
      const operatorName = selectedOperator || card.operator_name || 'Команда'

      const cardUpdate = {
        status: 'in-progress',
        operation: 'Прийомка',
        started_at: now,
        operator_name: operatorName,
        shift_name: selectedShift
      }

      const historyData = {
        card_id: card.id,
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation?.startsWith('Галтовка') ? 'Буфер Галтовки' : 'Буфер Розкрій',
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

      const idempotencyKey = `start_reception_${card.id}_${Date.now()}`

      const res = await executeAtomicCardTransition({
        cardId: card.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([historyData])
          if (historyError) throw new Error(`Не вдалося записати буфер прийомки: ${historyError.message}`)

          const { error: startCardError } = await supabase.from('work_cards').update(cardUpdate).eq('id', card.id)
          if (startCardError) throw new Error(`Не вдалося запустити прийомку: ${startCardError.message}`)
        }
      })

      if (!res.success) {
        setScanError(`⚠️ ${res.message || 'Дію відхилено сервером'}`)
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
    setShowCompleteModal(true)
  }

  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      await incrementInventoryStock({
        nomenclatureId: nomId,
        qty,
        type,
        nomenclatures
      })
    } catch (e) {
      console.warn('Scrap inventory update failed:', e)
      throw e
    }
  }

  const submitReceptionComplete = async () => {
    if (!activeCompletingCard) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const actualFinished = Math.max(0, finishedCount)
      const actualScrap = Math.max(0, scrapCount)

      const receptionOperator = selectedOperator || activeCompletingCard.operator_name || 'Команда'
      let scrapOperator = receptionOperator
      let scrapShift = activeCompletingCard.shift_name || selectedShift || 'Не вказано'

      if (actualScrap > 0) {
        const { data: cuttingHistory, error: cuttingHistoryError } = await supabase
          .from('work_card_history')
          .select('operator_name,shift_name')
          .eq('card_id', activeCompletingCard.id)
          .eq('stage_name', 'Розкрій')
          .order('completed_at', { ascending: false })
          .limit(1)

        if (cuttingHistoryError) {
          throw new Error(`Не вдалося визначити оператора розкрою для браку: ${cuttingHistoryError.message}`)
        }

        const cuttingRow = cuttingHistory?.[0]
        if (String(cuttingRow?.operator_name || '').trim()) {
          scrapOperator = String(cuttingRow.operator_name).trim()
          scrapShift = cuttingRow.shift_name || scrapShift
        }
      }

      const historyBase = {
        card_id: activeCompletingCard.id,
        nomenclature_id: activeCompletingCard.nomenclature_id,
        stage_name: 'Прийомка',
        started_at: activeCompletingCard.started_at || now,
        completed_at: now,
        shift_name: activeCompletingCard.shift_name || selectedShift || 'Не вказано',
        manager_name: activeCompletingCard.manager_name || 'Не вказано',
        machine_name: activeCompletingCard.machine || 'Не вказано'
      }
      const primaryHistory = {
        ...historyBase,
        operator_name: receptionOperator,
        qty_at_start: activeCompletingCard.quantity || 0,
        qty_completed: actualFinished,
        scrap_qty: (actualScrap > 0 && scrapOperator === receptionOperator) ? actualScrap : 0,
        is_archived_scrap: actualScrap > 0 && scrapOperator === receptionOperator
      }

      const historyRows = actualScrap > 0 && scrapOperator !== receptionOperator
        ? [
            ...(actualFinished > 0 ? [{
              ...historyBase,
              operator_name: receptionOperator,
              qty_at_start: actualFinished,
              qty_completed: actualFinished,
              scrap_qty: 0,
              is_archived_scrap: false
            }] : []),
            {
              ...historyBase,
              operator_name: scrapOperator,
              shift_name: scrapShift,
              qty_at_start: actualScrap,
              qty_completed: 0,
              scrap_qty: actualScrap,
              is_archived_scrap: true,
              card_info: `${activeCompletingCard.card_info || ''} [SCRAP_ASSIGNED_FROM_RECEPTION]`.trim()
            }
          ]
        : [primaryHistory]

      const cardUpdate = {
        status: 'at-buffer',
        operation: 'Сортування',
        quantity: actualFinished,
        completed_at: now
      }

      const idempotencyKey = `complete_reception_${activeCompletingCard.id}_${Date.now()}`

      const res = await executeAtomicCardTransition({
        cardId: activeCompletingCard.id,
        cardUpdate,
        historyData: primaryHistory,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert(historyRows)
          if (historyError) throw new Error(`Не вдалося записати історію прийомки: ${historyError.message}`)

          const { error: cardUpdateError } = await supabase.from('work_cards').update(cardUpdate).eq('id', activeCompletingCard.id)
          if (cardUpdateError) throw new Error(`Не вдалося завершити прийомку: ${cardUpdateError.message}`)
        }
      })

      if (!res.success) {
        setScanError(`⚠️ ${res.message || 'Дію відхилено сервером'}`)
        return
      }

      // If scrap was allocated to cutting operator, log the attributed scrap row in history
      if (actualScrap > 0 && scrapOperator !== receptionOperator) {
        await supabase.from('work_card_history').insert([{
          ...historyBase,
          operator_name: scrapOperator,
          shift_name: scrapShift,
          qty_at_start: actualScrap,
          qty_completed: 0,
          scrap_qty: actualScrap,
          is_archived_scrap: true,
          card_info: `${activeCompletingCard.card_info || ''} [SCRAP_ASSIGNED_FROM_RECEPTION]`.trim()
        }])
      }

      if (actualScrap > 0) {
        await updateInventoryStock(activeCompletingCard.nomenclature_id, actualScrap, 'scrap_ready')
      }

      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
    } catch (e) {
      setScanError('Помилка завершення прийомки: ' + e.message)
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

  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'at-buffer' && (c.operation?.startsWith('Галтовка') || c.operation === 'Прийомка'))
      .sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0))
  }, [workCards])

  const inWorkCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'in-progress' && c.operation === 'Прийомка')
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
    setSelectedOperator,
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
    setActiveCompletingCard,
    scrapCount,
    setScrapCount,
    finishedCount,
    setFinishedCount,
    pendingStartCard,
    setPendingStartCard,
    filterMode,
    setFilterMode,
    getNom,
    handleCardActionById,
    startReceptionCard,
    openCompleteModal,
    submitReceptionComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards
  }
}
