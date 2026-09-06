import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useScrapReasons } from '../../../hooks/useScrapReasons'
import { useMES } from '../../../MESContext'
import { apiService } from '../../../services/apiDispatcher'
import { supabase } from '../../../supabase'
import { translateCyrillic } from '../utils/shop2Helpers'
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'
import { executeAtomicQcScrap } from '../../../services/atomicQcScrapService'
import { executeAtomicCardTransition } from '../../../services/atomicCardTransitionService'
import { incrementInventoryStock } from '../../../services/inventoryStockService'


export function useShop2TerminalState() {
  const { names: scrapReasons } = useScrapReasons()
  const { workCards, orders, nomenclatures, inventory, startWorkCard, confirmBuffer, fetchData, refreshTable, operators, getFilteredOperators, getFilteredManagers, managers, workCardHistory, handoverToSGP, currentUser, systemUsers, tasks } = useMES()

  const shop2TaskIdsSet = useMemo(() => {
    const set = new Set()
    ;(tasks || []).forEach(t => {
      const step = String(t.step || '').toLowerCase()
      const name = String(t.name || '').toLowerCase()
      if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
          name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')) {
        set.add(String(t.id))
      }
    })
    return set
  }, [tasks])

  const isShop2Card = useCallback((card) => {
    if (!card) return false
    if (shop2TaskIdsSet.has(String(card.task_id))) return true
    const info = String(card.card_info || '')
    if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
    const op = String(card.operation || '')
    if (['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Пакування'].includes(op)) return true
    return false
  }, [shop2TaskIdsSet])

  const [selectedCardId, setSelectedCardId] = useState(null)
  const [manualId, setManualId] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scanError, setScanError] = useState(null)

  const [selectedCallMasterId, setSelectedCallMasterId] = useState('')
  const [selectedCallEngineerId, setSelectedCallEngineerId] = useState('')
  const [selectedCallQCId, setSelectedCallQCId] = useState('')

  const callMasters = (systemUsers || []).filter(u => u.access_rights?.master || u.access_rights?.foreman || (u.position && u.position.toLowerCase().includes('майстер')))
  const callEngineers = (systemUsers || []).filter(u => u.access_rights?.engineer || (u.position && u.position.toLowerCase().includes('інженер')))
  const callQCs = (systemUsers || []).filter(u => u.access_rights?.brak || (u.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост'))))

  const [scannedCardIds, setScannedCardIds] = useState(() => {
    try { const saved = localStorage.getItem('centrum_shop2_scanned'); return saved ? JSON.parse(saved) : [] }
    catch (e) { return [] }
  })

  const [isScanning, setIsScanning] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [showStorageExplorer, setShowStorageExplorer] = useState(false)
  const [activeExplorerTab, setActiveExplorerTab] = useState('semi')
  const [bufferSearchQuery, setBufferSearchQuery] = useState('')

  // Admin Manual Card State
  const isAdmin = currentUser?.position === 'Адмін' || currentUser?.role === 'admin'
  const [showAdminCardModal, setShowAdminCardModal] = useState(false)
  const [adminNomId, setAdminNomId] = useState('')
  const [adminTaskId, setAdminTaskId] = useState('')
  const [adminQty, setAdminQty] = useState('')
  const [adminStage, setAdminStage] = useState('Пресування')
  const [nomSearchText, setNomSearchText] = useState('')
  const [showNomDropdown, setShowNomDropdown] = useState(false)

  // Корекція браку ВКЯ
  const [showQCModal, setShowQCModal] = useState(false)
  const [qcScrapCount, setQcScrapCount] = useState(0)
  const [qcInspector, setQcInspector] = useState('')
  const [qcReason, setQcReason] = useState('Биття цанги')
  const [qcCustomReason, setQcCustomReason] = useState('')

  const shop2Stages = ['Пресування', 'Фарбування', 'Доопрацювання']

  // Emergency Machine Call Modal state
  const [machineCallModal, setMachineCallModal] = useState(null)
  const [machineCallSuccess, setMachineCallSuccess] = useState('')

  const handleMachineQRScan = async (text) => {
    const cleanText = translateCyrillic(text)
    const match = String(cleanText || '').match(/\/machines\/([a-f0-9-]+)\/call/i)
    if (match) {
      const machineId = match[1]
      try {
        const { data: mData, error } = await supabase.from('machines').select('*').eq('id', machineId).maybeSingle()
        if (mData) {
          setMachineCallModal({
            id: mData.id,
            name: mData.name,
            type: mData.type,
            sequence_number: mData.sequence_number,
            floor: mData.floor,
            inventory_no: mData.inventory_no
          })
        } else {
          alert('Верстат з таким ID не знайдено в базі.')
        }
      } catch (err) {
        console.error(err)
      }
      return true
    }
    return false
  }

  const handleManualEntry = async (e) => {
    if (e) e.preventDefault()
    if (!manualId) return

    const cleanInput = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()

    const isMachineQR = await handleMachineQRScan(cleanInput)
    if (isMachineQR) {
      setManualId('')
      setIsScanning(false)
      return
    }

    setIsProcessing(true)

    let card = workCards.find(c => 
      c.card_info?.includes('[ЦЕХ №2]') && (
        String(c.id).trim() === cleanInput || 
        String(c.id).toUpperCase().startsWith(cleanInput.toUpperCase()) ||
        String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())
      )
    )
    
    if (!card) {
      if (typeof fetchData === 'function') {
        try { await fetchData(['work_cards']) } catch (e) { }
      }
      card = workCards.find(c => 
        c.card_info?.includes('[ЦЕХ №2]') && (
          String(c.id).trim() === cleanInput || 
          String(c.id).toUpperCase().startsWith(cleanInput.toUpperCase()) ||
          String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())
        )
      )
    }

    if (!card) {
      setScanError(`Картку №${cleanInput} не знайдено в Цеху №2`)
    } else {
      setScannedCardIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
      setSelectedCardId(card.id)
      setManualId('')
      setIsScanning(false)
      setScanError(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setIsProcessing(false)
  }

  const handleCreateAdminCard = async () => {
    if (!adminNomId) {
      alert('Будь ласка, оберіть номенклатуру!')
      return
    }
    const finalQty = Number(adminQty) || 0
    if (finalQty <= 0) {
      alert('Кількість має бути більшою за 0!')
      return
    }

    setIsProcessing(true)
    try {
      let selectedTask = null
      let selectedOrder = null
      if (adminTaskId) {
        selectedTask = tasks.find(t => String(t.id) === String(adminTaskId))
        if (selectedTask) {
          selectedOrder = orders.find(o => String(o.id) === String(selectedTask.order_id))
        }
      }

      const orderNum = selectedOrder?.order_num || ''
      const batchIndexText = selectedTask?.batch_index ? `/${selectedTask.batch_index}` : ''
      const orderText = orderNum ? ` Наряд №${orderNum}${batchIndexText}` : ''

      const payload = {
        task_id: adminTaskId || null,
        order_id: selectedTask?.order_id || null,
        nomenclature_id: adminNomId,
        quantity: finalQty,
        operation: adminStage,
        status: 'new',
        machine: '—',
        is_rework: false,
        estimated_time: 0,
        card_info: `[ЦЕХ №2] [ADMIN_MANUAL] [NEED:0] [BZ:0] [РУЧНИЙ ЗАПУСК]${orderText}`
      }

      const { data, error } = await supabase.from('work_cards').insert([payload]).select().single()
      if (error) throw error

      alert(`Картку запуску в Цеху №2 на ${finalQty} шт. створено успішно!`)
      setShowAdminCardModal(false)
      setAdminNomId('')
      setAdminTaskId('')
      setAdminQty('')
      setAdminStage('Пресування')
      setNomSearchText('')
      setShowNomDropdown(false)

      if (typeof fetchData === 'function') {
        await fetchData(['work_cards'])
      }
    } catch (err) {
      alert('Помилка створення картки: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateCall = async (role, employeeId = null) => {
    try {
      const operatorName = selectedOperator || 'Оператор терміналу'
      const emp = (systemUsers || []).find(u => u.id === employeeId)
      const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : null
      const { error } = await supabase.from('machine_calls').insert({
        machine_id: machineCallModal.id,
        called_role: role === 'qc' ? 'quality' : role,
        operator_name: operatorName,
        called_employee_id: employeeId || null,
        called_employee_name: empName || null,
        status: 'pending'
      })
      if (error) throw error
      const label = role === 'master' ? 'Майстра' : role === 'engineer' ? 'Інженера' : 'ВКЯ'
      setMachineCallSuccess(`Виклик для ${label} надіслано!`)
      setTimeout(() => {
        setMachineCallSuccess('')
        setMachineCallModal(null)
      }, 2000)
    } catch (err) {
      alert('Помилка надсилання виклику: ' + err.message)
    }
  }

  useEffect(() => {
    if (!machineCallModal) {
      setSelectedCallMasterId('')
      setSelectedCallEngineerId('')
      setSelectedCallQCId('')
    }
  }, [machineCallModal])

  useEffect(() => { localStorage.setItem('centrum_shop2_scanned', JSON.stringify(scannedCardIds)) }, [scannedCardIds])
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])

  useEffect(() => {
    const card = workCards.find(c => String(c.id) === String(selectedCardId))
    if (card) {
      setSelectedStage(card.operation || '')
      const fullName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ')
      const displayName = fullName || currentUser?.login || ''
      const managerName = currentUser?.position ? `${displayName} (${currentUser.position})` : displayName
      if (managerName) setSelectedManager(managerName)
      
      setSelectedShift('')
      setSelectedOperator('')
    } else {
      setSelectedShift('')
      setSelectedOperator('')
    }

    setShowQCModal(false)
    setQcScrapCount(0)
    setQcInspector('')
    setQcReason('Биття цанги')
    setQcCustomReason('')
  }, [selectedCardId, currentUser])

  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        const isMachineQR = await handleMachineQRScan(decodedText)
        if (isMachineQR) {
          triggerHapticAudioFeedback(true)
          await stopAndClose()
          return
        }

        try {
          const qrData = JSON.parse(decodedText)
          if (qrData.type === 'work_card_shop2') {
            const cardIdStr = qrData.id
            await stopAndClose()
            let foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
            if (!foundCard) {
              setIsSyncing(true)
              try { if (typeof fetchData === 'function') await fetchData('work_cards') } catch (e) { }
              setIsSyncing(false)
              triggerHapticAudioFeedback(false)
              setScanError(`Картку №${cardIdStr} не знайдено в базі.`)
            } else {
              triggerHapticAudioFeedback(true)
              setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
              setSelectedCardId(foundCard.id)
              setScanError(null)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          } else {
            triggerHapticAudioFeedback(false)
            setScanError("Це не картка Цеху №2! Скануйте лише картки другого цеху.")
          }
        } catch (e) {
          triggerHapticAudioFeedback(false)
          setScanError("Невірний формат QR. Це точно картка Цеху №2?")
        }
      }).catch(err => { setScanError("Помилка камери: " + err); setIsScanning(false) })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { }) }
  }, [isScanning, workCards])

  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalKeyDown = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 100) {
        buffer = ''
      }
      lastKeyTime = currentTime

      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          const scannedText = buffer.trim()
          buffer = ''

          if (!scannerDebounceGuard.shouldProcessScan(scannedText)) {
            return
          }

          const isMachineQR = await handleMachineQRScan(scannedText)
          if (isMachineQR) {
            e.preventDefault()
            return
          }

          try {
            const qrData = JSON.parse(scannedText)
            if (qrData.type === 'work_card_shop2') {
              const cardIdStr = qrData.id
              let foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
              if (!foundCard) {
                setIsSyncing(true)
                try { if (typeof fetchData === 'function') await fetchData('work_cards') } catch (e) { }
                setIsSyncing(false)
              }
              foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
              if (foundCard) {
                setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
                setSelectedCardId(foundCard.id)
                setScanError(null)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
        buffer = ''
      } else if (e.key.length === 1) {
        const char = cyrillicToLatinMap[e.key] || e.key
        buffer += char
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [workCards])

  const currentCard = workCards.find(c => String(c.id) === String(selectedCardId))

  const getNomFromCard = useCallback((card) => {
    if (!card) return null
    const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
    if (nom) return nom

    const info = card.card_info || ''
    const orderNumMatch = info.match(/Наряд №(\d+)/)
    const orderNum = orderNumMatch ? orderNumMatch[1] : null

    if (orderNum) {
      const order = orders.find(o => String(o.order_num) === String(orderNum) || String(o.id) === String(orderNum))
      if (order?.order_items) {
        const match = order.order_items.find(it => Number(it.quantity) === Number(card.quantity))
        if (match) return nomenclatures.find(n => String(n.id) === String(match.nomenclature_id))
      }
    }

    return null
  }, [nomenclatures, orders])

  const queuedCards = useMemo(() => {
    return workCards.filter(c =>
      c.card_info?.includes('[ЦЕХ №2]') &&
      (c.status === 'new' || c.status === 'at-buffer' || scannedCardIds.some(sid => String(sid) === String(c.id))) &&
      c.status !== 'in-progress' && c.status !== 'waiting-buffer' && c.status !== 'completed'
    )
  }, [workCards, scannedCardIds])

  const handleStartOperation = async () => {
    if (!currentCard || !selectedOperator) return
    const stage = selectedStage || currentCard.operation
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const cardUpdate = {
        status: 'in-progress',
        operation: stage,
        started_at: now,
        operator_name: selectedOperator,
        shift_name: selectedShift || null,
        manager_name: selectedManager || null,
        machine: selectedMachine || null
      }

      const historyData = {
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: stage,
        operator_name: selectedOperator,
        qty_at_start: currentCard.quantity || 0,
        qty_completed: currentCard.quantity || 0,
        scrap_qty: 0,
        started_at: now,
        completed_at: now,
        shift_name: selectedShift || null,
        manager_name: selectedManager || null,
        machine_name: selectedMachine || null,
        card_info: `[ЦЕХ №2] ${currentCard.card_info || ''}`.trim()
      }

      const idempotencyKey = `start_shop2_${currentCard.id}_${Date.now()}`

      const res = await executeAtomicCardTransition({
        cardId: currentCard.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, selectedOperator, {
            stage_name: stage,
            machine_name: selectedMachine,
            manager_name: selectedManager,
            shift_name: selectedShift
          }, startWorkCard)
        }
      })

      if (!res.success) {
        alert(`⚠️ ${res.message || 'Дію відхилено сервером'}`)
        return
      }

      if (!scannedCardIds.includes(currentCard.id)) setScannedCardIds(prev => [...prev, currentCard.id])
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) { alert('Помилка при старті: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const submitCompletion = async () => {
    if (!currentCard) return
    const nom = getNomFromCard(currentCard)
    setScrapCounts({ [nom?.id]: 0 })
    setShowScrapModal(true)
  }

  const handleFinalFinish = async () => {
    if (!currentCard) return
    const totalScrap = Object.values(scrapCounts || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0)
    if (totalScrap < 0 || totalScrap > Number(currentCard.quantity || 0)) {
      alert(`Кількість браку має бути від 0 до ${currentCard.quantity || 0} шт.`)
      return
    }
    setIsProcessing(true)
    try {
      await apiService.submitBufferConfirmation(currentCard.id, scrapCounts, confirmBuffer)
      setSelectedCardId(null)
      setShowScrapModal(false)
      setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
      fetchData(['work_cards', 'work_card_history', 'inventory'])
    } catch (e) { alert('Помилка при завершенні: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const updateInventoryStock = async (nomId, qty, type = 'semi') => {
    if (!nomId || qty <= 0) return { error: null }
    try {
      await incrementInventoryStock({
        nomenclatureId: nomId,
        qty,
        type,
        nomenclatures
      })
      return { error: null }
    } catch (e) {
      console.warn(`Stock update failed for type ${type}:`, e)
      throw e
    }
  }

  const handleQCScrapOverride = async () => {
    if (!currentCard || qcScrapCount <= 0) return
    if (qcScrapCount > currentCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!')
      return
    }
    setIsProcessing(true)
    try {
      const inspectorName = qcInspector || 'відповідальний ВКЯ'
      const operatorName = selectedOperator || currentCard.operator_name || currentCard.card_info?.match(/\[OPERATOR:([^\]]+)\]/)?.[1] || 'Оператор Цеху №2'
      const stageName = currentCard.operation || selectedStage || 'Пресування [ЦЕХ №2]'
      const newQty = Math.max(0, currentCard.quantity - qcScrapCount)

      const historyData = {
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: stageName,
        operator_name: operatorName,
        shift_name: selectedShift || currentCard.shift_name,
        manager_name: selectedManager || currentCard.manager_name,
        machine_name: selectedMachine || currentCard.machine,
        qc_scrap_reason: qcReason,
        qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null,
        card_info: `[ЦЕХ №2] ${currentCard.card_info || ''} [QC_INSPECTOR:${inspectorName}] [VKYA_SOURCE_STATUS:${currentCard.status || ''}] [VKYA_SOURCE_OPERATION:${stageName}]`.trim(),
        started_at: new Date().toISOString()
      }

      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }

      const idempotencyKey = `qc_scrap_shop2_${currentCard.id}_${Date.now()}`

      const res = await executeAtomicQcScrap({
        cardId: currentCard.id,
        scrapQty: qcScrapCount,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const promises = [
            supabase.from('work_card_history').insert([{
              card_id: currentCard.id,
              ...historyData,
              qty_at_start: currentCard.quantity,
              qty_completed: newQty,
              scrap_qty: qcScrapCount,
              completed_at: new Date().toISOString(),
              is_archived_scrap: true
            }]),
            supabase.from('work_cards').update(updatePayload).eq('id', currentCard.id),
            updateInventoryStock(currentCard.nomenclature_id, qcScrapCount, 'scrap_ready')
          ]
          const results = await Promise.all(promises)
          for (const r of results) {
            if (r?.error) throw r.error
          }
        }
      })

      if (!res.success) {
        throw new Error(res.error || res.message || 'Не вдалося списати брак через сервер')
      }

      setShowQCModal(false)
      setQcScrapCount(0)
      setQcInspector('')
      setQcReason('Биття цанги')
      setQcCustomReason('')
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {})
      if (newQty === 0) {
        setSelectedCardId(null)
        setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
      }
      setIsProcessing(false)
      alert(`✅ Успішно списано ${qcScrapCount} шт у брак за рішенням ВКЯ!`)
    } catch (e) {
      console.error('QC error:', e)
      setIsProcessing(false)
      alert('Помилка фіксації браку ВКЯ: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  const calculateTotalBufferParts = useCallback(() => {
    let totalBufferPartsCount = 0
    ;(workCards || []).forEach(card => {
      if (isShop2Card(card)) return
      const status = String(card.status || '')
      const isSortedOrBuffer = status === 'at-shop2-buffer'

      if (isSortedOrBuffer) {
        const qty = Number(card.quantity || 0)
        const used = Number(card.used_in_shop2_qty || 0)
        totalBufferPartsCount += Math.max(0, qty - used)
      }
    })

    return totalBufferPartsCount
  }, [workCards, isShop2Card])

  return {
    scrapReasons,
    workCards,
    orders,
    nomenclatures,
    inventory,
    startWorkCard,
    confirmBuffer,
    fetchData,
    refreshTable,
    operators,
    getFilteredOperators,
    getFilteredManagers,
    managers,
    workCardHistory,
    handoverToSGP,
    currentUser,
    systemUsers,
    tasks,
    shop2TaskIdsSet,
    isShop2Card,
    selectedCardId,
    setSelectedCardId,
    manualId,
    setManualId,
    selectedStage,
    setSelectedStage,
    selectedOperator,
    setSelectedOperator,
    selectedManager,
    setSelectedManager,
    selectedShift,
    setSelectedShift,
    selectedMachine,
    setSelectedMachine,
    currentTime,
    setCurrentTime,
    isProcessing,
    setIsProcessing,
    isDrawerOpen,
    setIsDrawerOpen,
    isSyncing,
    setIsSyncing,
    scanError,
    setScanError,
    selectedCallMasterId,
    setSelectedCallMasterId,
    selectedCallEngineerId,
    setSelectedCallEngineerId,
    selectedCallQCId,
    setSelectedCallQCId,
    callMasters,
    callEngineers,
    callQCs,
    scannedCardIds,
    setScannedCardIds,
    isScanning,
    setIsScanning,
    showScrapModal,
    setShowScrapModal,
    scrapCounts,
    setScrapCounts,
    detailStage,
    setDetailStage,
    detailTab,
    setDetailTab,
    showStorageExplorer,
    setShowStorageExplorer,
    activeExplorerTab,
    setActiveExplorerTab,
    bufferSearchQuery,
    setBufferSearchQuery,
    isAdmin,
    showAdminCardModal,
    setShowAdminCardModal,
    adminNomId,
    setAdminNomId,
    adminTaskId,
    setAdminTaskId,
    adminQty,
    setAdminQty,
    adminStage,
    setAdminStage,
    nomSearchText,
    setNomSearchText,
    showNomDropdown,
    setShowNomDropdown,
    showQCModal,
    setShowQCModal,
    qcScrapCount,
    setQcScrapCount,
    qcInspector,
    setQcInspector,
    qcReason,
    setQcReason,
    qcCustomReason,
    setQcCustomReason,
    shop2Stages,
    machineCallModal,
    setMachineCallModal,
    machineCallSuccess,
    setMachineCallSuccess,
    handleMachineQRScan,
    handleManualEntry,
    handleCreateAdminCard,
    handleCreateCall,
    currentCard,
    getNomFromCard,
    queuedCards,
    handleStartOperation,
    submitCompletion,
    handleFinalFinish,
    updateInventoryStock,
    handleQCScrapOverride,
    calculateTotalBufferParts
  }
}
