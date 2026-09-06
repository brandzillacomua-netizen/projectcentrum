import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import scannerDebounceGuard from '../../../services/scannerDebounceGuard'
import { executeAtomicCardTransition } from '../../../services/atomicCardTransitionService'
import { incrementInventoryStock } from '../../../services/inventoryStockService'

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

export const ACCENT = '#ec4899'
export const ACCENT_RGB = '236,72,153'

export function usePaintingTerminalData() {
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
          if (!scannerDebounceGuard.shouldProcessScan(scannedText)) {
            return
          }
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
      html5QrCode = new window.Html5Qrcode('reader-painting')
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {})
        setIsScanning(false)
      }
      html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (text) => {
          if (!scannerDebounceGuard.shouldProcessScan(text)) {
            return
          }
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

      const isWaiting = (card.status === 'at-buffer' && card.operation === 'Пресування') || 
                        (card.status === 'new' && ['Фарбування', 'Малярка'].includes(card.operation))
      const isInWork = card.status === 'in-progress' && ['Фарбування', 'Малярка'].includes(card.operation)

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

  const startPaintingCard = async (card) => {
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
        operation: 'Фарбування',
        started_at: now,
        operator_name: operatorName,
        shift_name: selectedShift
      }

      const historyData = {
        card_id: card.id,
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation === 'Пресування' ? 'Буфер Фарбування (після Пресування)' : 'Буфер Фарбування',
        operator_name: operatorName,
        qty_at_start: card.quantity || 0,
        qty_completed: card.quantity || 0,
        scrap_qty: 0,
        started_at: bufferStart,
        completed_at: now,
        shift_name: selectedShift,
        manager_name: card.manager_name || 'Не вказано',
        machine_name: card.machine || 'Не вказано'
      }

      const idempotencyKey = `start_paint_${card.id}_${Date.now()}`

      const res = await executeAtomicCardTransition({
        cardId: card.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([historyData])
          if (historyError) throw new Error(`Не вдалося записати буфер фарбування: ${historyError.message}`)

          const { error: cardUpdateError } = await supabase.from('work_cards').update(cardUpdate).eq('id', card.id)
          if (cardUpdateError) throw new Error(`Не вдалося запустити фарбування: ${cardUpdateError.message}`)
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

  const submitPaintingComplete = async () => {
    if (!activeCompletingCard) return
    if (!selectedOperator) {
      setScanError('Не вдалося визначити авторизованого фарбувальника. Оновіть сторінку та увійдіть у систему повторно.')
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
          p_stage: 'Фарбування',
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

      const cardUpdate = {
        status: 'at-buffer',
        operation: 'Фарбування',
        quantity: actualFinished,
        completed_at: now
      }

      const historyData = {
        card_id: activeCompletingCard.id,
        nomenclature_id: activeCompletingCard.nomenclature_id,
        stage_name: 'Фарбування',
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
      }

      const idempotencyKey = `complete_paint_${activeCompletingCard.id}_${Date.now()}`

      const res = await executeAtomicCardTransition({
        cardId: activeCompletingCard.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([historyData])
          if (historyError) throw new Error(`Не вдалося передати брак у ВКЯ: ${historyError.message}`)

          const { error: cardUpdateError } = await supabase.from('work_cards').update(cardUpdate).eq('id', activeCompletingCard.id)
          if (cardUpdateError) throw new Error(`Не вдалося завершити фарбування: ${cardUpdateError.message}`)
        }
      })

      if (!res.success) {
        setScanError(`⚠️ ${res.message || 'Дію відхилено сервером'}`)
        return
      }

      if (actualScrap > 0) {
        await updateInventoryStock(activeCompletingCard.nomenclature_id, actualScrap, 'scrap_ready')
      }

      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
      alert(`✅ ${actualFinished} шт успішно пофарбовано та переведено в буфер!`)
    } catch (e) {
      setScanError('Помилка завершення фарбування: ' + e.message)
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
      .filter(c => 
        c.card_info?.includes('[ЦЕХ №2]') &&
        ((c.status === 'at-buffer' && c.operation === 'Пресування') || 
         (c.status === 'new' && ['Фарбування', 'Малярка'].includes(c.operation)))
      )
      .sort((a, b) => new Date(a.completed_at || a.started_at || 0) - new Date(b.completed_at || b.started_at || 0))
  }, [workCards])

  const inWorkCards = useMemo(() => {
    return workCards
      .filter(c => c.card_info?.includes('[ЦЕХ №2]') && c.status === 'in-progress' && ['Фарбування', 'Малярка'].includes(c.operation))
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
    startPaintingCard,
    openCompleteModal,
    submitPaintingComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards
  }
}
