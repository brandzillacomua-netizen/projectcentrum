import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase'
import { isMachineMatch } from '../../../utils/cutterCalculator'
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard'


export const cyrillicToLatinMap = {
  'й':'q', 'ц':'w', 'у':'e', 'к':'r', 'е':'t', 'н':'y', 'г':'u', 'ш':'i', 'щ':'o', 'з':'p', 'х':'[', 'ї':']',
  'ф':'a', 'ы':'s', 'і':'s', 'в':'d', 'а':'f', 'п':'g', 'р':'h', 'о':'j', 'л':'k', 'д':'l', 'ж':';', 'є':'\'',
  'я':'z', 'ч':'x', 'с':'c', 'м':'v', 'и':'b', 'т':'n', 'ь':'m', 'б':',', 'ю':'.', '.':'/',
  'Й':'Q', 'Ц':'W', 'У':'E', 'К':'R', 'Е':'T', 'Н':'Y', 'Г':'U', 'Ш':'I', 'Щ':'O', 'З':'P', 'Х':'{', 'Ї':'}',
  'Ф':'A', 'Ы':'S', 'І':'S', 'В':'D', 'А':'F', 'П':'G', 'Р':'H', 'О':'J', 'Л':'K', 'Д':'L', 'Ж':':', 'Є':'"',
  'Я':'Z', 'Ч':'X', 'С':'C', 'М':'V', 'И':'B', 'Т':'N', 'Ь':'M', 'Б':'<', 'Ю':'>', ',':'?',
  '?':'/', 'ё':'`', 'Ё':'~', '№':'#'
}

export const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

export const useOperatorTerminalData = ({
  workCards,
  orders,
  nomenclatures,
  startWorkCard,
  completeWorkCard,
  confirmBuffer,
  fetchData,
  operators,
  productionStages,
  machines,
  workCardHistory,
  getFilteredOperators,
  getFilteredManagers,
  systemUsers,
  currentUser,
  machineOperations,
  tasks,
  inventory,
  requests
}) => {
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedMaster, setSelectedMaster] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scanError, setScanError] = useState(null)

  const [scannedCardIds, setScannedCardIds] = useState(() => {
    try { const saved = localStorage.getItem('centrum_operator_scanned'); return saved ? JSON.parse(saved) : [] }
    catch (e) { return [] }
  })

  const [isScanning, setIsScanning] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})
  const [cuttersUsed, setCuttersUsed] = useState(0)
  const [cuttersBreakdown, setCuttersBreakdown] = useState({})
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [filterStage, setFilterStage] = useState('all')

  // Emergency Machine Call Modal state
  const [machineCallModal, setMachineCallModal] = useState(null)
  const [machineCallSuccess, setMachineCallSuccess] = useState('')

  const [selectedCallMasterId, setSelectedCallMasterId] = useState('')
  const [selectedCallEngineerId, setSelectedCallEngineerId] = useState('')
  const [selectedCallQCId, setSelectedCallQCId] = useState('')

  const callMasters = (systemUsers || []).filter(u => u.access_rights?.master || u.access_rights?.foreman || (u.position && u.position.toLowerCase().includes('майстер')))
  const callEngineers = (systemUsers || []).filter(u => u.access_rights?.engineer || (u.position && u.position.toLowerCase().includes('інженер')))
  const callQCs = (systemUsers || []).filter(u => u.access_rights?.brak || (u.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост'))))

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

  useEffect(() => { localStorage.setItem('centrum_operator_scanned', JSON.stringify(scannedCardIds)) }, [scannedCardIds])
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])

  // Camera QR Scanner Initialization
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
        if (decodedText.startsWith("CENTRUM_CARD_")) {
          const cardIdStr = decodedText.replace("CENTRUM_CARD_", "").trim()
          await stopAndClose()
          let foundCard = workCards.find(c => String(c.id).trim() === cardIdStr)
          if (!foundCard) {
            setIsSyncing(true)
            try { if (typeof fetchData === 'function') await fetchData('work_cards') } catch (e) { }
            setIsSyncing(false)
            triggerHapticAudioFeedback(false)
            setScanError(`Картку №${cardIdStr} не знайдено. Спробуйте відсканувати ще раз.`)
          } else {
            triggerHapticAudioFeedback(true)
            setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
            setSelectedCardId(foundCard.id)
            setScanError(null)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        } else {
          const isMachineQR = await handleMachineQRScan(decodedText)
          if (isMachineQR) {
            triggerHapticAudioFeedback(true)
            await stopAndClose()
          } else {
            triggerHapticAudioFeedback(false)
          }
        }
      }).catch(err => { 
        triggerHapticAudioFeedback(false)
        setScanError("Помилка камери: " + err); 
        setIsScanning(false) 
      })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { }) }
  }, [isScanning, workCards])

  // Global Scanner Keydown Listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalKeyDown = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const timeNow = Date.now()
      if (timeNow - lastKeyTime > 100) {
        buffer = ''
      }
      lastKeyTime = timeNow

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

          if (scannedText.startsWith('CENTRUM_CARD_')) {
            const cardIdStr = scannedText.replace('CENTRUM_CARD_', '').trim()
            let foundCard = workCards.find(c => String(c.id).trim() === cardIdStr)
            if (!foundCard) {
              setIsSyncing(true)
              try { if (typeof fetchData === 'function') await fetchData('work_cards') } catch (e) { }
              setIsSyncing(false)
            }
            foundCard = workCards.find(c => String(c.id).trim() === cardIdStr)
            if (foundCard) {
              setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
              setSelectedCardId(foundCard.id)
              setScanError(null)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
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

  const currentCard = workCards.find(c => c.id === selectedCardId)

  useEffect(() => {
    const card = workCards.find(c => c.id === selectedCardId)
    const fullName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ')
    const displayName = fullName || currentUser?.login || ''
    const masterName = currentUser?.position ? `${displayName} (${currentUser.position})` : displayName
    if (card) {
      setSelectedStage(card.operation || '')
      setSelectedOperator('')
      setSelectedMaster(masterName)
      setSelectedShift('')
      setSelectedMachine('')
      setCuttersBreakdown({})
    } else {
      setSelectedStage('')
      setSelectedOperator('')
      setSelectedMaster(masterName)
      setSelectedShift('')
      setSelectedMachine('')
      setCuttersBreakdown({})
    }
  }, [selectedCardId, workCards, currentUser])

  const getCuttersForCard = (card) => {
    if (!card) return []
    const task = tasks?.find(t => String(t.id) === String(card.task_id))
    const targetMachine = task?.machine_name || card.machine || ''
    const cardNomId = String(card.nomenclature_id || '')
    
    const configuredCutters = []

    const isGenericCutterName = (name) => {
      if (!name) return true
      const clean = String(name).trim().toLowerCase()
      if (clean === 'фреза') return true
      if (/^фреза\s+ф\d+/i.test(clean)) return true
      const nom = nomenclatures?.find(n => n.name.trim().toLowerCase() === clean)
      if (nom && nom.type === 'cutter_type') return true
      return false
    }

    const addCutter = (name) => {
      if (!name) return
      const cleanName = String(name).trim()
      if (cleanName && !isGenericCutterName(cleanName) && !configuredCutters.includes(cleanName)) {
        configuredCutters.push(cleanName)
      }
    }

    const partSelectedCutters = task?.plan_snapshot?.[cardNomId]?.selected_cutters 
      || task?.plan_snapshot?.selectedCutters

    const resolveCutterName = (cutterNom) => {
      if (!cutterNom) return null
      const genericName = cutterNom.name.trim()

      if (cutterNom.type === 'consumable' && !isGenericCutterName(genericName)) {
        return genericName
      }

      if (partSelectedCutters && typeof partSelectedCutters === 'object') {
        const invId = partSelectedCutters[genericName]
          || partSelectedCutters[genericName.toLowerCase()]
          || partSelectedCutters[String(cutterNom.id)]
        
        if (invId) {
          const inv = (inventory || []).find(i => String(i.id) === String(invId))
          if (inv) {
            const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
            if (nom && !isGenericCutterName(nom.name)) return nom.name.trim()
            if (inv.name && !isGenericCutterName(inv.name)) return inv.name.trim()
          }
          const nom = nomenclatures?.find(n => String(n.id) === String(invId))
          if (nom && !isGenericCutterName(nom.name)) return nom.name.trim()
        }
      }

      const matchingConsumable = nomenclatures?.find(n =>
        n.type === 'consumable' &&
        String(n.characteristic) === String(cutterNom.id) &&
        !isGenericCutterName(n.name)
      )
      if (matchingConsumable) {
        return matchingConsumable.name.trim()
      }

      return null
    }

    const allOpsForCardNom = (machineOperations || []).filter(o => String(o.nomenclature_id) === cardNomId)
    let cardOpData = null
    if (targetMachine) {
      cardOpData = allOpsForCardNom.find(o =>
        isMachineMatch(o.machine_type, targetMachine) ||
        isMachineMatch(o.machine_id, targetMachine)
      )
    }
    if (!cardOpData && allOpsForCardNom.length > 0) {
      cardOpData = allOpsForCardNom[0]
    }
    if (cardOpData && cardOpData.side2_cut_ops) {
      const cutterOps = cardOpData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
      cutterOps.forEach(op => {
        const parts = op.split(':')
        const cutterNomId = parts[1]
        if (cutterNomId) {
          const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
          if (cutterNom) {
            const resolved = resolveCutterName(cutterNom)
            if (resolved) addCutter(resolved)
          }
        }
      })
    }

    if (configuredCutters.length === 0 && partSelectedCutters && typeof partSelectedCutters === 'object') {
      Object.values(partSelectedCutters).forEach(invId => {
        if (invId) {
          const inv = (inventory || []).find(i => String(i.id) === String(invId))
          if (inv) {
            const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
            const name = nom ? nom.name : inv.name
            if (name && name.toLowerCase().includes('фреза')) {
              addCutter(name)
            }
          } else {
            const nom = nomenclatures?.find(n => String(n.id) === String(invId))
            if (nom && nom.name && nom.name.toLowerCase().includes('фреза')) {
              addCutter(nom.name)
            }
          }
        }
      })
    }

    if (configuredCutters.length === 0 && requests && requests.length > 0) {
      const cardTaskReqs = requests.filter(r => 
        (r.card_id && String(r.card_id) === String(card.id)) ||
        (r.task_id && String(r.task_id) === String(card.task_id) && String(r.nomenclature_id) === cardNomId)
      )
      cardTaskReqs.forEach(r => {
        if (r.nomenclature_id) {
          const nom = nomenclatures?.find(n => String(n.id) === String(r.nomenclature_id))
          if (nom && nom.name && nom.name.toLowerCase().includes('фреза')) {
            addCutter(nom.name)
          }
        } else if (r.details && r.details.toLowerCase().includes('фреза')) {
          const match = r.details.match(/фреза[^\d]*\d+[\d\s.,xхXХx×]*/i)
          if (match) addCutter(match[0])
        }
      })
    }

    return configuredCutters
  }

  const getCardDept = (card) => {
    if (!card) return null
    const stage = (selectedStage || card.operation || '').toLowerCase()
    if (['розкрій', 'галтовка', 'прийомка', 'сортування'].includes(stage)) {
      return 'Цех №1'
    }
    return 'Цех №2'
  }
  const getNomFromCard = (card) => {
    if (!card) return null
    if (card.nomenclature_id) return nomenclatures.find(n => n.id === card.nomenclature_id)
    const matchId = card.card_info?.match(/NOM_ID:([^|]+)/)
    const metaId = matchId ? matchId[1].trim() : null
    return nomenclatures.find(n => String(n.id) === String(metaId))
  }
  const getQtyFromCard = (card) => {
    if (!card) return 0
    if (card.quantity) return card.quantity
    const matchQty = card.card_info?.match(/QTY:(\d+)/)
    return matchQty ? parseInt(matchQty[1], 10) : 0
  }
  const getOrderFromCard = (card) => {
    if (!card) return null
    if (card.order_id) return orders.find(o => o.id === card.order_id)
    const matchOrder = card.card_info?.match(/ORDER_NUM:([^|]+)/)
    if (matchOrder) {
      const num = matchOrder[1].trim()
      return orders.find(o => String(o.order_num).trim() === num)
    }
    return null
  }

  return {
    selectedCardId, setSelectedCardId,
    selectedStage, setSelectedStage,
    selectedOperator, setSelectedOperator,
    selectedMaster, setSelectedMaster,
    selectedShift, setSelectedShift,
    selectedMachine, setSelectedMachine,
    currentTime,
    isProcessing, setIsProcessing,
    isDrawerOpen, setIsDrawerOpen,
    isSyncing, setIsSyncing,
    scanError, setScanError,
    scannedCardIds, setScannedCardIds,
    isScanning, setIsScanning,
    showScrapModal, setShowScrapModal,
    scrapCounts, setScrapCounts,
    cuttersUsed, setCuttersUsed,
    cuttersBreakdown, setCuttersBreakdown,
    showPinModal, setShowPinModal,
    pin, setPin,
    pinError, setPinError,
    detailStage, setDetailStage,
    detailTab, setDetailTab,
    filterStage, setFilterStage,
    machineCallModal, setMachineCallModal,
    machineCallSuccess, setMachineCallSuccess,
    selectedCallMasterId, setSelectedCallMasterId,
    selectedCallEngineerId, setSelectedCallEngineerId,
    selectedCallQCId, setSelectedCallQCId,
    callMasters, callEngineers, callQCs,
    currentCard,
    handleCreateCall,
    handleMachineQRScan,
    getCuttersForCard,
    getCardDept,
    getNomFromCard,
    getQtyFromCard,
    getOrderFromCard
  }
}
