import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { supabase, getCurrentTime } from '../../../supabase'
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'
import { executeAtomicCardTransition } from '../../../services/atomicCardTransitionService'
import { incrementInventoryStock } from '../../../services/inventoryStockService'



// Map Cyrillic keyboard characters to English QWERTY for barcode scanners under Ukrainian/Russian layout
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

export function useTumblingTerminalData() {
  const { workCards, nomenclatures, getFilteredOperators, fetchData, currentUser, bomItems, orders, tasks, workCardHistory } = useMES()

  const [currentTime, setCurrentTime] = useState(getCurrentTime())
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')

  // Barcode search / wedge inputs
  const [manualId, setManualId] = useState('')
  const [scanError, setScanError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // QR Scanner Modal states
  const [isScanning, setIsScanning] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)

  // Completion modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [activeCompletingCard, setActiveCompletingCard] = useState(null)
  const [scrapCount, setScrapCount] = useState(0)
  const [finishedCount, setFinishedCount] = useState(0)

  // Custom confirm modal (replaces window.confirm) for "start card" action
  const [pendingStartCard, setPendingStartCard] = useState(null)
  
  // Tab/filter selection for cards
  const [filterMode, setFilterMode] = useState('all') // 'all', 'waiting', 'in_work'
  const [subStageFilter, setSubStageFilter] = useState('all') // 'all' | 'вибростил' | 'мийка' | 'галтовка' | 'сушка'

  // 1. Tick clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Auto-select user details
  useEffect(() => {
    if (currentUser) {
      setSelectedShift(currentUser.shift || 'Без зміни')

      const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ')
      const displayName = fullName || currentUser.login || ''
      const nameWithPosition = currentUser.position ? `${displayName} (${currentUser.position})` : displayName

      // Filter list to see if user matches Tumbling Operators conditions
      const allowedOps = getFilteredOperators('Цех №1', currentUser.shift || 'Без зміни', 'Галтовка')
      if (allowedOps.includes(nameWithPosition)) {
        setSelectedOperator(nameWithPosition)
      } else {
        setSelectedOperator('')
      }
    }
  }, [currentUser, getFilteredOperators])

  // Get nomenclature details helper
  const getNom = (card) => nomenclatures.find(n => n.id === card?.nomenclature_id)

  // 3. Wedge Barcode Scanner Listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalKeyDown = async (e) => {
      // Ignore scanner input inside input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const nowTime = Date.now()
      if (nowTime - lastKeyTime > 100) {
        buffer = ''
      }
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
        const char = cyrillicToLatinMap[e.key] || e.key
        buffer += char
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [workCards, selectedOperator, selectedShift])

  // 4. QR-сканер (через камеру пристрою)
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }

      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) {
          await html5QrCode.stop().catch(() => { })
        }
        setIsScanning(false)
      }

      html5QrCode.start(
        { facingMode: "environment" },
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
        console.error("Scanner error:", err)
        setScanError(`Помилка камери: ${err}. Перевірте дозволи у браузері.`)
      })
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { })
    }
  }, [isScanning, workCards])

  // Common card action (takes to work or completes)
  const handleCardActionById = async (id) => {
    setIsProcessing(true)
    setScanError(null)
    try {
      let card = workCards.find(c => String(c.id).trim() === id || String(c.id).toUpperCase().endsWith(id.toUpperCase()))
      if (!card) {
        await fetchData('work_cards').catch(() => { })
        card = workCards.find(c => String(c.id).trim() === id || String(c.id).toUpperCase().endsWith(id.toUpperCase()))
      }

      if (!card) {
        setScanError(`Картку №${id} не знайдено в системі`)
        setIsProcessing(false)
        return
      }

      // Check state
      const isWaiting = 
        (card.status === 'at-buffer' && (card.operation === 'Розкрій' || card.operation === 'Галтовка (Вібростіл)' || card.operation === 'Галтовка (Мийка)' || card.operation === 'Галтовка (Галтовка)')) ||
        (card.status === 'new' && (card.operation === 'Галтовка (Вібростіл)' || card.operation === 'Галтовка (Мийка)' || card.operation === 'Галтовка (Галтовка)' || card.operation === 'Галтовка (Сушка)'))
      const isInWork = card.status === 'in-progress' && card.operation?.startsWith('Галтовка')

      if (isWaiting) {
        setPendingStartCard(card)
        setIsProcessing(false)
        return
      } else if (isInWork) {
        openCompleteModal(card)
      } else {
        setScanError(`Картка #${id.slice(-8).toUpperCase()} має невідповідний статус: етап [${card.operation}], статус [${card.status}]`)
      }
    } catch (e) {
      setScanError(`Помилка обробки: ${e.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const getNextTumblingOperation = (currentOp) => {
    if (currentOp === 'Розкрій') return 'Галтовка (Вібростіл)'
    if (currentOp === 'Галтовка (Вібростіл)') return 'Галтовка (Мийка)'
    if (currentOp === 'Галтовка (Мийка)') return 'Галтовка (Галтовка)'
    if (currentOp === 'Галтовка (Галтовка)') return 'Галтовка (Сушка)'
    return 'Галтовка (Вібростіл)'
  }

  // Action: Take card to work
  const startTumblingCard = async (card) => {
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }

    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const bufferStart = card.completed_at || card.started_at || now
      const nextOp = card.status === 'new' ? card.operation : getNextTumblingOperation(card.operation)

      const cardUpdate = {
        status: 'in-progress',
        operation: nextOp,
        started_at: now,
        operator_name: 'Команда',
        shift_name: selectedShift
      }

      const historyData = {
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation === 'Розкрій' ? 'Буфер Розкрій' : `Буфер ${card.operation}`,
        operator_name: 'Команда',
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
        setScanError(res.message || '⚠️ Картку вже взято в роботу іншим оператором')
        fetchData(['work_cards']).catch(() => {})
        return
      }

      setScanError(null)
      setManualId('')
      fetchData(['work_cards', 'work_card_history']).catch(() => { })
    } catch (e) {
      setScanError(`Помилка запуску: ${e.message}`)
    } finally {
      setIsProcessing(false)
      setPendingStartCard(null)
    }
  }

  // Complete Stage modal triggers
  const openCompleteModal = (card) => {
    setActiveCompletingCard(card)
    setFinishedCount(card.quantity || 0)
    setScrapCount(0)
    setShowCompleteModal(true)
  }

  // Register Scrap to DB helper
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

  // Action: Complete card to buffer
  const submitTumblingComplete = async () => {
    if (!activeCompletingCard) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const totalQty = activeCompletingCard.quantity || 0
      const actualScrap = Math.min(totalQty, Math.max(0, Number(scrapCount) || 0))
      const actualFinished = Math.max(0, totalQty - actualScrap)

      const rawTumblingOperator = String(activeCompletingCard.operator_name || '').trim()
      const tumblingOperator = !rawTumblingOperator || rawTumblingOperator === 'Команда'
        ? 'Команда галтовки'
        : rawTumblingOperator
      let scrapOperator = tumblingOperator
      let scrapShift = activeCompletingCard.shift_name || selectedShift || 'Не вказано'

      if (actualScrap > 0) {
        const { data: cuttingHistory, error: cuttingHistoryError } = await supabase
          .from('work_card_history')
          .select('operator_name, shift_name')
          .eq('card_id', activeCompletingCard.id)
          .eq('stage_name', 'Розкрій')
          .order('completed_at', { ascending: false })
          .limit(1)

        if (cuttingHistoryError) {
          console.warn('Не вдалося визначити оператора розкрою:', cuttingHistoryError.message)
        } else {
          const cuttingRow = cuttingHistory?.[0]
          if (String(cuttingRow?.operator_name || '').trim()) {
            scrapOperator = String(cuttingRow.operator_name).trim()
            scrapShift = cuttingRow.shift_name || scrapShift
          }
        }
      }

      // 1. Insert history log for tumbling stage
      const historyBase = {
        card_id: activeCompletingCard.id,
        nomenclature_id: activeCompletingCard.nomenclature_id,
        stage_name: activeCompletingCard.operation,
        started_at: activeCompletingCard.started_at || now,
        completed_at: now,
        shift_name: activeCompletingCard.shift_name || selectedShift || 'Не вказано',
        manager_name: activeCompletingCard.manager_name || 'Не вказано',
        machine_name: activeCompletingCard.machine || 'Не вказано'
      }
      const historyRows = actualScrap > 0 && scrapOperator !== tumblingOperator
        ? [
            ...(actualFinished > 0 ? [{
              ...historyBase,
              operator_name: tumblingOperator,
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
              card_info: `${activeCompletingCard.card_info || ''} [SCRAP_ASSIGNED_FROM_TUMBLING]`.trim()
            }
          ]
        : [{
            ...historyBase,
            operator_name: tumblingOperator,
            qty_at_start: totalQty,
            qty_completed: actualFinished,
            scrap_qty: actualScrap,
            is_archived_scrap: actualScrap > 0
          }]

      const { data: claimedCard, error: cardUpdateError } = await supabase.from('work_cards').update({
        status: 'at-buffer',
        operation: activeCompletingCard.operation === 'Галтовка (Сушка)' ? 'Галтовка' : activeCompletingCard.operation,
        quantity: actualFinished,
        completed_at: now
      })
        .eq('id', activeCompletingCard.id)
        .eq('status', 'in-progress')
        .eq('operation', activeCompletingCard.operation)
        .select('id')
        .maybeSingle()

      if (cardUpdateError) throw new Error(`Не вдалося завершити етап: ${cardUpdateError.message}`)
      if (!claimedCard) {
        setShowCompleteModal(false)
        setActiveCompletingCard(null)
        setManualId('')
        setScanError('Цей етап картки вже завершено. Повторне проведення не виконувалось.')
        fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => { })
        return
      }

      const { error: historyError } = await supabase.from('work_card_history').insert(historyRows)
      if (historyError) throw new Error(`Не вдалося передати брак у ВКЯ: ${historyError.message}`)

      // 3. Register scrap in inventory if any
      if (actualScrap > 0) {
        await updateInventoryStock(activeCompletingCard.nomenclature_id, actualScrap, 'scrap_ready')
      }

      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => { })
    } catch (e) {
      setScanError('Помилка завершення галтовки: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle manual input search
  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualId.trim()) return
    const clean = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()
    handleCardActionById(clean)
  }

  // Helper timers formatting
  const formatDuration = (isoStart) => {
    if (!isoStart) return '00:00:00'
    const diff = Math.max(0, Math.floor((currentTime.getTime() - new Date(isoStart).getTime()) / 1000))
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
  }

  // List of active operators
  const activeOperatorsList = useMemo(() => {
    return getFilteredOperators('Цех №1', selectedShift, 'Галтовка')
  }, [selectedShift, getFilteredOperators])

  // Check if a work card has completed tumbling
  const hasPassedTumbling = (card) => {
    if (!card) return false
    if (card.status === 'completed') return true

    const op = card.operation || ''
    if (op === 'Галтовка' && card.status === 'at-buffer') return true
    if (op === 'Склад БЗ') return true

    const subsequentStages = ['Прийомка', 'completed', 'Пресування', 'Фарбування', 'Паквання', 'Пакування', 'Сортування', 'Склад СГП', 'Доопрацювання']
    return subsequentStages.some(stage => op.includes(stage))
  }

  // 1. Process active orders and compute component kit completion & bottleneck priority
  const orderKits = useMemo(() => {
    const activeOrderIds = new Set(workCards.map(c => c.order_id).filter(Boolean))
    
    return Array.from(activeOrderIds).map(orderId => {
      const order = orders.find(o => String(o.id) === String(orderId))
      if (!order) return null

      const targetQty = Number(order.quantity) || 1000
      const parentNom = nomenclatures.find(n => n.id === order.nomenclature_id)

      const orderBoms = bomItems.filter(b => {
        if (b.parent_id !== order.nomenclature_id) return false
        
        const childNom = nomenclatures.find(n => n.id === b.child_id)
        if (!childNom) return false
        
        const nameLower = (childNom.name || '').toLowerCase()
        const isExcluded = 
          nameLower.includes('гвинт') ||
          nameLower.includes('метиз') ||
          nameLower.includes('накладк') ||
          nameLower.includes('гайка') ||
          nameLower.includes('шайба') ||
          nameLower.includes('заклепк') ||
          nameLower.includes('болт') ||
          nameLower.includes('шпильк') ||
          nameLower.includes('саморіз') ||
          nameLower.includes('стійка') ||
          nameLower.includes('тримач') ||
          nameLower.includes('демпфер') ||
          nameLower.includes('пластик') ||
          nameLower.includes('кабель') ||
          nameLower.includes('хомут') ||
          nameLower.includes('скло') ||
          nameLower.includes('ніжка') ||
          nameLower.includes('резинк') ||
          nameLower.includes('ущільн') ||
          nameLower.includes('прокладк') ||
          nameLower.includes('стріч') ||
          nameLower.includes('скотч') ||
          nameLower.includes('клей') ||
          nameLower.includes('втулк')
        
        const typeLower = (childNom.type || '').toLowerCase()
        const isExcludedType = typeLower && typeLower !== 'part'
        
        if (isExcluded || isExcludedType) return false

        const hasActiveCard = workCards.some(c => c.nomenclature_id === b.child_id && String(c.order_id) === String(orderId))
        const hasHistoryCard = workCardHistory?.some(h => h.nomenclature_id === b.child_id)
        
        return hasActiveCard || hasHistoryCard
      })
      if (orderBoms.length === 0) return null

      const orderCards = workCards.filter(c => String(c.order_id) === String(orderId))

      const components = orderBoms.map(bom => {
        const childNom = nomenclatures.find(n => n.id === bom.child_id)
        const qtyPerParent = Number(bom.quantity_per_parent) || 1
        const totalNeeded = targetQty * qtyPerParent

         const compCards = orderCards.filter(c => c.nomenclature_id === bom.child_id)

         const bzCards = compCards.filter(c => c.operation === 'Склад БЗ')
         const producedCards = compCards.filter(c => c.operation !== 'Склад БЗ' && hasPassedTumbling(c))

         const bzQty = bzCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
         const producedQty = producedCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
         const passedQty = bzQty + producedQty

         const completedKits = passedQty / qtyPerParent
         const kitRatio = targetQty > 0 ? completedKits / targetQty : 0

         return {
           id: bom.child_id,
           name: childNom?.name || 'Компонент',
           qtyPerParent,
           totalNeeded,
           passedQty,
           bzQty,
           producedQty,
           completedKits,
           kitRatio,
           cards: compCards
         }
       })

      let bottleneckId = null
      let minRatio = Infinity
      components.forEach(comp => {
        if (comp.kitRatio < minRatio) {
          minRatio = comp.kitRatio
          bottleneckId = comp.id
        }
      })

      const taskObj = tasks.find(t => String(t.order_id) === String(orderId))
      const deadlineStr = taskObj?.planned_deadline || order.deadline || null
      const deadlineDate = deadlineStr ? new Date(deadlineStr) : null

      return {
        orderId,
        orderNum: order.order_num || `Наряд #${String(orderId).slice(-6)}`,
        productName: parentNom?.name || 'Готовий виріб',
        targetQty,
        components,
        bottleneckId,
        deadlineDate,
        deadlineStr
      }
    }).filter(Boolean)
  }, [workCards, orders, bomItems, tasks, nomenclatures, workCardHistory])

  // Map to easily check if a nomenclature is a bottleneck in its order
  const bottleneckNomenclaturesMap = useMemo(() => {
    const map = {}
    orderKits.forEach(kit => {
      if (kit.bottleneckId) {
        map[kit.bottleneckId] = true
      }
    })
    return map
  }, [orderKits])

  // Get deadline of a card's order helper
  const getCardDeadline = (card) => {
    const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
    return kit?.deadlineDate || null
  }

  // 1. Waiting cards
  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => 
        (c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')) ||
        (c.status === 'new' && (c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)' || c.operation === 'Галтовка (Сушка)'))
      )
      .map(card => {
        const isBottleneck = bottleneckNomenclaturesMap[card.nomenclature_id] || false
        
        const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
        const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
        const kitRatio = comp ? comp.kitRatio : 1.0
        
        const deadline = getCardDeadline(card)
        return {
          ...card,
          isBottleneck,
          kitRatio,
          deadline
        }
      })
      .sort((a, b) => {
        if (a.kitRatio !== b.kitRatio) {
          return a.kitRatio - b.kitRatio
        }
        if (a.deadline && b.deadline) {
          return a.deadline - b.deadline
        }
        if (a.deadline) return -1
        if (b.deadline) return 1

        const dateA = new Date(a.completed_at || a.started_at || 0)
        const dateB = new Date(b.completed_at || b.started_at || 0)
        return dateA - dateB
      })
  }, [workCards, bottleneckNomenclaturesMap, orderKits])

  // 2. In-work cards
  const inWorkCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'in-progress' && c.operation?.startsWith('Галтовка'))
      .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
  }, [workCards])

  // Filtered cards based on current tab selection and sub-stage selection
  const displayedCards = useMemo(() => {
    let list = []
    if (filterMode === 'all' || filterMode === 'waiting') {
      list.push(...waitingCards.map(c => ({ ...c, type: 'waiting' })))
    }
    if (filterMode === 'all' || filterMode === 'in_work') {
      list.push(...inWorkCards.map(c => ({ ...c, type: 'in_work' })))
    }

    // Apply subStageFilter
    if (subStageFilter !== 'all') {
      list = list.filter(c => {
        if (c.type === 'waiting') {
          const targetOp = c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)
          if (subStageFilter === 'вибростил') return targetOp === 'Галтовка (Вібростіл)'
          if (subStageFilter === 'мийка') return targetOp === 'Галтовка (Мийка)'
          if (subStageFilter === 'галтовка') return targetOp === 'Галтовка (Галтовка)'
          if (subStageFilter === 'сушка') return targetOp === 'Галтовка (Сушка)'
        } else {
          if (subStageFilter === 'вибростил') return c.operation === 'Галтовка (Вібростіл)'
          if (subStageFilter === 'мийка') return c.operation === 'Галтовка (Мийка)'
          if (subStageFilter === 'галтовка') return c.operation === 'Галтовка (Галтовка)'
          if (subStageFilter === 'сушка') return c.operation === 'Галтовка (Сушка)'
        }
        return false
      })
    }

    return list.sort((a, b) => {
      if (a.type === 'in_work' && b.type === 'waiting') return -1
      if (a.type === 'waiting' && b.type === 'in_work') return 1

      if (a.type === 'waiting') {
        if (a.kitRatio !== b.kitRatio) {
          return a.kitRatio - b.kitRatio
        }
        if (a.deadline && b.deadline) {
          return a.deadline - b.deadline
        }
        if (a.deadline) return -1
        if (b.deadline) return 1

        const dateA = new Date(a.completed_at || a.started_at || 0)
        const dateB = new Date(b.completed_at || b.started_at || 0)
        return dateA - dateB
      } else {
        return new Date(a.started_at || 0) - new Date(b.started_at || 0)
      }
    })
  }, [filterMode, subStageFilter, waitingCards, inWorkCards])

  // Priority color definitions
  const priorityMap = {
    1: { label: 'Високий', bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
    2: { label: 'Середній', bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' },
    3: { label: 'Низький', bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
  }

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
    subStageFilter,
    setSubStageFilter,
    getNom,
    handleCardActionById,
    getNextTumblingOperation,
    startTumblingCard,
    openCompleteModal,
    submitTumblingComplete,
    handleManualSubmit,
    formatDuration,
    activeOperatorsList,
    orderKits,
    bottleneckNomenclaturesMap,
    waitingCards,
    inWorkCards,
    displayedCards,
    priorityMap
  }
}
