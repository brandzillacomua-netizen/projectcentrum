import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Tablet, Search, Users, RefreshCw, Play, CheckCircle, AlertTriangle, X, Clock, Layers, Camera, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase, getCurrentTime } from '../supabase'

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

export default function TumblingTerminal() {
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
        // Fallback to first available operator if exact match not found or select manually
        setSelectedOperator('')
      }
    }
  }, [currentUser])

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
            await stopAndClose()
            handleCardActionById(id)
          } else {
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
      const isWaiting = card.status === 'at-buffer' && (card.operation === 'Розкрій' || card.operation === 'Галтовка (Вібростіл)' || card.operation === 'Галтовка (Мийка)' || card.operation === 'Галтовка (Галтовка)')
      const isInWork = card.status === 'in-progress' && card.operation?.startsWith('Галтовка')

      if (isWaiting) {
        // Instead of window.confirm, show custom modal
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

  // Action: Take card to work — called after custom confirm modal is accepted
  const startTumblingCard = async (card) => {
    if (!selectedShift) {
      setScanError('⚠️ Будь ласка, спочатку оберіть зміну вгорі екрану!')
      return
    }

    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const bufferStart = card.completed_at || card.started_at || now
      const nextOp = getNextTumblingOperation(card.operation)

      // 1. Insert history log for waiting buffer
      await supabase.from('work_card_history').insert([{
        card_id: card.id,
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
      }])

      // 2. Update card state in DB
      await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: nextOp,
        started_at: now,
        operator_name: 'Команда',
        shift_name: selectedShift
      }).eq('id', card.id)

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

  // Action: Complete card to buffer
  const submitTumblingComplete = async () => {
    if (!activeCompletingCard) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const totalQty = activeCompletingCard.quantity || 0
      const actualFinished = Math.max(0, finishedCount)
      const actualScrap = Math.max(0, scrapCount)

      // 1. Insert history log for tumbling stage
      await supabase.from('work_card_history').insert([{
        card_id: activeCompletingCard.id,
        nomenclature_id: activeCompletingCard.nomenclature_id,
        stage_name: activeCompletingCard.operation,
        operator_name: activeCompletingCard.operator_name || 'Команда',
        qty_at_start: totalQty,
        qty_completed: actualFinished,
        scrap_qty: actualScrap,
        started_at: activeCompletingCard.started_at || now,
        completed_at: now,
        is_archived_scrap: true,
        shift_name: activeCompletingCard.shift_name || selectedShift || 'Не вказано',
        manager_name: activeCompletingCard.manager_name || 'Не вказано',
        machine_name: activeCompletingCard.machine || 'Не вказано'
      }])

      // 2. Update card to buffer of the current stage
      await supabase.from('work_cards').update({
        status: 'at-buffer',
        operation: activeCompletingCard.operation === 'Галтовка (Сушка)' ? 'Галтовка' : activeCompletingCard.operation,
        quantity: actualFinished,
        completed_at: now
      }).eq('id', activeCompletingCard.id)

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

  // Register Scrap to DB helper
  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)
        .eq('type', type)
        .limit(1).maybeSingle()

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

  // Handle manual input search
  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualId.trim()) return
    const clean = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()
    handleCardActionById(clean)
  }

  // Helper timers formatting — використовує реальний поточний час без жодних корекцій
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
  }, [workCards, orders, bomItems, tasks, nomenclatures])

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

  // 1. Waiting cards: cards at buffer waiting for next tumbling sub-stage (sorted by kitRatio -> deadline -> FIFO)
  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)'))
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
        // Tier 1: Kit completion ratio (lowest first)
        if (a.kitRatio !== b.kitRatio) {
          return a.kitRatio - b.kitRatio
        }
        // Tier 2: Deadline (earlier first)
        if (a.deadline && b.deadline) {
          return a.deadline - b.deadline
        }
        if (a.deadline) return -1
        if (b.deadline) return 1

        // Tier 3: FIFO (completion date of previous stage)
        const dateA = new Date(a.completed_at || a.started_at || 0)
        const dateB = new Date(b.completed_at || b.started_at || 0)
        return dateA - dateB
      })
  }, [workCards, bottleneckNomenclaturesMap, orderKits])

  // 2. In-work cards: cards in progress on any tumbling sub-stage
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
          // Waiting cards: operation indicates the PREVIOUS stage
          if (subStageFilter === 'вибростил') return c.operation === 'Розкрій'
          if (subStageFilter === 'мийка') return c.operation === 'Галтовка (Вібростіл)'
          if (subStageFilter === 'галтовка') return c.operation === 'Галтовка (Мийка)'
          if (subStageFilter === 'сушка') return c.operation === 'Галтовка (Галтовка)'
        } else {
          // In-work cards: operation indicates the ACTIVE stage
          if (subStageFilter === 'вибростил') return c.operation === 'Галтовка (Вібростіл)'
          if (subStageFilter === 'мийка') return c.operation === 'Галтовка (Мийка)'
          if (subStageFilter === 'галтовка') return c.operation === 'Галтовка (Галтовка)'
          if (subStageFilter === 'сушка') return c.operation === 'Галтовка (Сушка)'
        }
        return false
      })
    }

    return list.sort((a, b) => {
      // Show active running cards above queued ones
      if (a.type === 'in_work' && b.type === 'waiting') return -1
      if (a.type === 'waiting' && b.type === 'in_work') return 1

      if (a.type === 'waiting') {
        // Tier 1: Kit completion ratio (lowest first)
        if (a.kitRatio !== b.kitRatio) {
          return a.kitRatio - b.kitRatio
        }
        // Tier 2: Deadline (earlier first)
        if (a.deadline && b.deadline) {
          return a.deadline - b.deadline
        }
        if (a.deadline) return -1
        if (b.deadline) return 1

        // Tier 3: FIFO (completion date of previous stage)
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

  return (
    <div style={{ background: '#070709', minHeight: '100vh', color: '#fff', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER SECTION */}
      <header style={{ flexShrink: 0, background: 'rgba(12,12,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)', zIndex: 10 }}>

        {/* Row 1: Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
              <ArrowLeft size={15} /> На головну
            </Link>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{ background: 'rgba(6,182,212,0.1)', padding: '6px', borderRadius: '10px', flexShrink: 0 }}>
                <Tablet size={18} color="#06b6d4" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '0.3px', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap' }}>ЕКРАН ГАЛТОВКИ</h1>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '1px', fontWeight: 700 }}>ТЕРМІНАЛ ОБРОБКИ ДЕТАЛЕЙ</div>
              </div>
            </div>
          </div>

          {/* Live Clock — always top-right */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 900, fontFamily: 'monospace' }}>
              {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ color: '#444', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
              {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </div>

        {/* Row 2: Shift selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px 12px 20px' }}>
          <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>ЗМІНА</span>
          <select
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value)}
            style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', padding: '7px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', outline: 'none', flex: '0 0 auto' }}
          >
            <option value="">— Оберіть —</option>
            <option value="Зміна 1">Зміна 1</option>
            <option value="Зміна 2">Зміна 2</option>
            <option value="Зміна 3">Зміна 3</option>
            <option value="Зміна 4">Зміна 4</option>
            <option value="Без зміни">Без зміни</option>
          </select>
        </div>
      </header>

      {scanError && (
        <div style={{ padding: '0 24px' }}>
          <div style={{ maxWidth: '600px', margin: '20px auto 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(239,68,68,0.1)' }}>
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{scanError}</span>
            <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* DASHBOARD GRID */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <section style={{ flex: 1, background: '#0c0c10', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>

          {/* Filter tabs */}
          <div style={{ padding: '18px 24px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '6px', scrollbarWidth: 'none' }} className="hide-scrollbar">
                {[
                  { mode: 'all', label: 'Усі картки', count: waitingCards.length + inWorkCards.length, color: '#06b6d4' },
                  { mode: 'waiting', label: 'В очікуванні', count: waitingCards.length, color: '#f59e0b' },
                  { mode: 'in_work', label: 'У роботі', count: inWorkCards.length, color: '#10b981' }
                ].map(tab => (
                  <button
                    key={tab.mode}
                    type="button"
                    onClick={() => setFilterMode(tab.mode)}
                    style={{
                      background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : '6,182,214'}, 0.12)` : '#121216',
                      color: filterMode === tab.mode ? tab.color : '#888',
                      border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'rgba(255,255,255,0.04)'}`,
                      padding: '8px 16px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0
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

              <div style={{ fontSize: '0.72rem', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Картки на терміналі
              </div>
            </div>

            {/* Sub-stages filters */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }} className="hide-scrollbar">
              {[
                { id: 'all', label: 'Усі під-етапи', count: waitingCards.length + inWorkCards.length },
                { id: 'вибростил', label: '1 - Вібростіл', count: waitingCards.filter(c => c.operation === 'Розкрій').length + inWorkCards.filter(c => c.operation === 'Галтовка (Вібростіл)').length },
                { id: 'мийка', label: '2 - Мийка', count: waitingCards.filter(c => c.operation === 'Галтовка (Вібростіл)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Мийка)').length },
                { id: 'галтовка', label: '3 - Галтовка', count: waitingCards.filter(c => c.operation === 'Галтовка (Мийка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Галтовка)').length },
                { id: 'сушка', label: '4 - Сушка', count: waitingCards.filter(c => c.operation === 'Галтовка (Галтовка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Сушка)').length }
              ].map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSubStageFilter(sub.id)}
                  style={{
                    background: subStageFilter === sub.id ? 'rgba(6,182,212,0.12)' : '#121216',
                    color: subStageFilter === sub.id ? '#06b6d4' : '#888',
                    border: `1px solid ${subStageFilter === sub.id ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.04)'}`,
                    padding: '6px 14px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', flexShrink: 0
                  }}
                >
                  {sub.label}
                  <span style={{
                    background: subStageFilter === sub.id ? '#06b6d4' : '#222',
                    color: subStageFilter === sub.id ? '#000' : '#888',
                    borderRadius: '5px', padding: '1px 5px', fontSize: '0.62rem', fontWeight: 900
                  }}>
                    {sub.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scroll">
            {displayedCards.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, padding: '50px 0' }}>
                <Layers size={64} />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '12px' }}>Картки відсутні</h3>
              </div>
            ) : (
              displayedCards.map(card => {
                const nom = getNom(card)
                const isWaiting = card.type === 'waiting'
                const isBottleneck = card.isBottleneck || (isWaiting && bottleneckNomenclaturesMap[card.nomenclature_id])
                const pInfo = isBottleneck 
                  ? { label: 'КРИТИЧНО', bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                  : priorityMap[card.galt_priority || 2]

                // Waiting/Work time
                const timeStr = isWaiting
                  ? (card.completed_at ? formatDuration(card.completed_at) : '—')
                  : formatDuration(card.started_at)

                return (
                  <div key={card.id} style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', transition: '0.2s', position: 'relative' }} className="hover-lift tumbling-card">

                    {/* Strip color */}
                    <div style={{ position: 'absolute', left: 0, top: '15px', bottom: '15px', width: '3px', background: isWaiting ? pInfo.text : '#10b981', borderRadius: '0 3px 3px 0' }} />

                    {/* Card main info */}
                    <div style={{ flex: '1 1 300px', paddingLeft: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span className="card-code" style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Картка #{card.id.slice(-8).toUpperCase()}
                        </span>
                        
                        {(() => {
                          const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                          return seqMatch ? (
                            <span className="card-seq-badge" style={{
                              background: 'rgba(255, 144, 0, 0.15)',
                              color: '#ff9000',
                              border: '1px solid rgba(255, 144, 0, 0.3)',
                              padding: '2px 6px', borderRadius: '6px',
                              fontSize: '0.6rem', fontWeight: 950,
                              zIndex: 1
                            }}>
                              {seqMatch[1]}
                            </span>
                          ) : null
                        })()}
                        
                        {isWaiting ? (
                          <>
                            <span className="card-stage" style={{ fontSize: '0.8rem', background: pInfo.bg, color: pInfo.text, border: pInfo.border, padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                              Очікує: {getNextTumblingOperation(card.operation)}
                            </span>
                            {(() => {
                              const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
                              const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
                              const ratio = comp ? comp.kitRatio : 1.0
                              const percent = Math.min(100, Math.round(ratio * 100))

                              if (isBottleneck) {
                                return (
                                  <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.25)', color: '#ff4444', border: '2px solid #ef4444', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' }}>
                                    🔥 КРИТИЧНИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                  </span>
                                )
                              }
                              if (ratio < 0.5) {
                                return (
                                  <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b', border: '2px solid #f59e0b', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                                    ⚡ ВИСОКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                  </span>
                                )
                              }
                              if (ratio < 0.8) {
                                return (
                                  <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.25)', color: '#3b82f6', border: '2px solid #3b82f6', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                                    ✨ СЕРЕДНІЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                  </span>
                                )
                              }
                              return (
                                <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '2px solid #10b981', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                                  ✅ НИЗЬКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                </span>
                              )
                            })()}
                          </>
                        ) : (
                          <>
                            <span className="card-stage" style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                              У роботі: {card.operation}
                            </span>
                            {(() => {
                              const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
                              const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
                              const ratio = comp ? comp.kitRatio : 1.0
                              const percent = Math.min(100, Math.round(ratio * 100))
                              const isB = bottleneckNomenclaturesMap[card.nomenclature_id] || false

                              if (isB) {
                                return (
                                  <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.25)', color: '#ff4444', border: '2px solid #ef4444', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' }}>
                                    🔥 КРИТИЧНИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                  </span>
                                )
                              }
                              if (ratio < 0.5) {
                                return (
                                  <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b', border: '2px solid #f59e0b', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                                    ⚡ ВИСОКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                  </span>
                                )
                              }
                              if (ratio < 0.8) {
                                return (
                                  <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.25)', color: '#3b82f6', border: '2px solid #3b82f6', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                                    ✨ СЕРЕДНІЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                  </span>
                                )
                              }
                              return (
                                <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '2px solid #10b981', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                                  ✅ НИЗЬКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                                </span>
                              )
                            })()}
                          </>
                        )}
                      </div>

                      <h4 className="card-title" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                        {nom?.name || 'Невказана деталь'}
                      </h4>

                      <div className="card-details" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                          К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                        </span>
                        {isWaiting ? (
                          <>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                              Майстер: <span style={{ color: '#aaa' }}>{(card.manager_name || 'Не вказано').split(' (')[0]}</span>
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                              Верстат розкрою: <span style={{ color: '#aaa' }}>{card.machine || '—'}</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                              Виконавець: <span style={{ color: '#aaa' }}>{(card.operator_name || 'Не вказано').split(' (')[0]}</span>
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                              Зміна: <span style={{ color: '#aaa' }}>{card.shift_name || '—'}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Timer & Action */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '120px' }} className="card-action-container">
                      <div className="card-timer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isWaiting ? '#6b7280' : '#10b981', fontSize: '0.68rem', fontWeight: 900, fontFamily: 'monospace' }}>
                        <Clock size={12} /> {timeStr}
                      </div>
                      {isWaiting ? (
                        <button
                          onClick={() => setPendingStartCard(card)}
                          disabled={isProcessing}
                          style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4', padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s' }}
                          className="btn-cyan card-action-btn"
                        >
                          <Play size={11} fill="currentColor" /> В РОБОТУ
                        </button>
                      ) : (
                        <button
                          onClick={() => openCompleteModal(card)}
                          disabled={isProcessing}
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s' }}
                          className="btn-green card-action-btn"
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

      {/* ── КАСТОМНА МОДАЛКА ПІДТВЕРДЖЕННЯ ЗАПУСКУ ГАЛТОВКИ ────────────────── */}
      {pendingStartCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#0e0e12', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid rgba(6,182,212,0.25)', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'rgba(6,182,212,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(6,182,212,0.1)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                <Play size={16} fill="currentColor" /> Взяти в {getNextTumblingOperation(pendingStartCard.operation)}
              </h3>
              <button
                onClick={() => setPendingStartCard(null)}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Card info block */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>
                    #{pendingStartCard.id.slice(-8).toUpperCase()}
                  </span>
                  {(() => {
                    const seqMatch = (pendingStartCard.card_info || '').match(/(\d+\/\d+)/)
                    return seqMatch ? (
                      <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '2px 6px', borderRadius: '5px', fontSize: '0.58rem', fontWeight: 950 }}>
                        {seqMatch[1]}
                      </span>
                    ) : null
                  })()}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>
                  {getNom(pendingStartCard)?.name || 'Деталь'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>
                  К-сть: <strong style={{ color: '#fff' }}>{pendingStartCard.quantity} шт</strong>
                  {pendingStartCard.machine ? <> · Верстат: <span style={{ color: '#aaa' }}>{pendingStartCard.machine}</span></> : null}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
                Підтвердіть що картка переходить у роботу на <strong style={{ color: '#fff' }}>{getNextTumblingOperation(pendingStartCard.operation)}</strong>.
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setPendingStartCard(null)}
                  disabled={isProcessing}
                  style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.05)', color: '#aaa', padding: '14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  СКАСУВАТИ
                </button>
                <button
                  onClick={() => startTumblingCard(pendingStartCard)}
                  disabled={isProcessing}
                  style={{ flex: 2, background: '#06b6d4', border: 'none', color: '#000', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(6,182,212,0.25)' }}
                >
                  {isProcessing ? <RefreshCw size={15} className="anim-spin" /> : <><Play size={15} fill="currentColor" /> В РОБОТУ</>}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* COMPLETE WORK MODAL */}
      {showCompleteModal && activeCompletingCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0e0e11', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid rgba(16,185,129,0.2)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                  <CheckCircle size={16} /> Завершити: {activeCompletingCard.operation}
                </h3>
                <div style={{ fontSize: '0.62rem', color: '#555', marginTop: '2px', fontWeight: 800 }}>
                  Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={isProcessing}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', transition: '0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Form */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Nomenclature Detail Info */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Деталь</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                  {getNom(activeCompletingCard)?.name || 'Невказана деталь'}
                </div>
              </div>

              {/* Counts Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Finished count input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Готових деталей</label>
                  <input
                    type="number"
                    min="0"
                    max={activeCompletingCard.quantity || 0}
                    value={finishedCount}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value) || 0)
                      setFinishedCount(val)
                      setScrapCount(Math.max(0, (activeCompletingCard.quantity || 0) - val))
                    }}
                    style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                </div>

                {/* Scrap/brak count input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Брак (шт)</label>
                  <input
                    type="number"
                    min="0"
                    max={activeCompletingCard.quantity || 0}
                    value={scrapCount}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value) || 0)
                      setScrapCount(val)
                      setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - val))
                    }}
                    style={{ background: '#121216', border: '1px solid rgba(255,255,255,0.05)', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                </div>

              </div>

              {/* Total checking info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#6b7280', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '12px' }}>
                <span>Разом по картці:</span>
                <span style={{ color: '#fff' }}>{activeCompletingCard.quantity || 0} шт</span>
              </div>

              {/* Buttons actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  disabled={isProcessing}
                  style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.03)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}
                >
                  СКАСУВАТИ
                </button>
                <button
                  onClick={submitTumblingComplete}
                  disabled={isProcessing}
                  style={{ flex: 1, background: '#10b981', border: 'none', color: '#000', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' }}
                >
                  {isProcessing ? <RefreshCw size={14} className="anim-spin" /> : <><CheckCircle size={14} /> ПІДТВЕРДИТИ</>}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── QR-сканер (Модальне вікно) ────────────────── */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
          <button onClick={() => { setIsScanning(false); setShowManualInput(false); setScanError(null); }}
            style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={26} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 1000, color: '#06b6d4', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>ЕКРАН ГАЛТОВКИ · СКАНЕР</div>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 700 }}>{showManualInput ? 'ВВЕДІТЬ НОМЕР КАРТКИ ВРУЧНУ' : 'ВІДСКАНУЙТЕ КАРТКУ ТЕХНОЛОГІЧНОГО ПРОЦЕСУ'}</div>
          </div>

          {!showManualInput ? (
            <>
              {/* Чистий контейнер для сканера */}
              <div style={{ width: '100%', maxWidth: '480px', background: '#0a0a0a', borderRadius: '32px', border: '2px solid rgba(6,182,212,0.3)', overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
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
                    style={{ background: '#1a1a1a', border: '1px solid #333', color: '#06b6d4', padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
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
                  style={{ width: '100%', background: '#000', border: '2px solid rgba(6,182,212,0.5)', color: '#fff', fontSize: '2.5rem', textAlign: 'center', padding: '15px', borderRadius: '16px', fontWeight: 900, fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={!manualId || isProcessing}
                    style={{ flex: 2, background: '#06b6d4', color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer' }}>
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

      {/* Visual Animation & Lift styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hover-lift:hover {
          transform: translateY(-2px);
          border-color: rgba(6, 182, 212, 0.2);
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
        .btn-cyan:hover {
          background: rgba(6,182,212,0.2) !important;
        }
        .btn-green:hover {
          background: rgba(16,185,129,0.2) !important;
        }
        .floating-controls-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        @media (max-width: 600px) {
          .floating-controls-container {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 14px 20px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0,0,0,0.9);
            backdrop-filter: blur(15px);
          }
          .floating-controls-container form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
          }
          /* Larger fonts for tumbling cards on mobile devices */
          .tumbling-card .card-code {
            font-size: 0.85rem !important;
          }
          .tumbling-card .card-stage {
            font-size: 0.8rem !important;
            padding: 4px 10px !important;
          }
          .tumbling-card .card-title {
            font-size: 1.15rem !important;
            font-weight: 900 !important;
            margin: 10px 0 !important;
            line-height: 1.4 !important;
          }
          .tumbling-card .card-details span {
            font-size: 0.9rem !important;
            font-weight: 800 !important;
          }
          .tumbling-card .card-details span strong {
            font-weight: 1000 !important;
          }
          .tumbling-card .card-timer {
            font-size: 0.95rem !important;
            font-weight: 1000 !important;
          }
          .tumbling-card .card-action-btn {
            font-size: 0.85rem !important;
            padding: 10px 18px !important;
            border-radius: 12px !important;
          }
          .tumbling-card .card-seq-badge {
            top: 14px !important;
            right: 14px !important;
            background: #ff9000 !important;
            color: #000 !important;
            border: none !important;
            padding: 6px 14px !important;
            border-radius: 10px !important;
            font-size: 1.15rem !important;
            box-shadow: 0 4px 12px rgba(255, 144, 0, 0.3) !important;
          }
          .tumbling-card .card-action-container {
            margin-top: 36px !important;
          }
        }
      ` }} />

      {/* Floating Controls (Search and Scan QR) */}
      <div className="floating-controls-container">
        {/* Floating Search Form */}
        <form onSubmit={handleManualSubmit} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 10, 10, 0.95)',
          border: '1px solid #222',
          padding: '10px 14px',
          borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: '#06b6d4', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        {/* Floating Round QR Scan Button */}
        <button onClick={() => setIsScanning(true)}
          className="hover-lift"
          style={{ 
            background: '#06b6d4', 
            border: 'none', 
            color: '#000', 
            width: '64px',
            height: '64px',
            borderRadius: '50%', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(6,182,212,0.4)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}>
          <QrCode size={32} />
        </button>
      </div>

    </div>
  )
}