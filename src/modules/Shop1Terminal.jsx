import React, { useState, useEffect } from 'react'
import { ArrowLeft, Camera, X, ChevronRight, Package, AlertTriangle, ClipboardList, Menu, ArrowRight, Layers, RefreshCw, Eye, Search, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase, getCurrentTime } from '../supabase'

// Map Cyrillic keyboard characters to English QWERTY for barcode scanners under Ukrainian/Russian layout
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

// Ланцюжок Цеху №1
const CHAIN = [
  'Розкрій',
  'Галтовка (Вібростіл)',
  'Галтовка (Мийка)',
  'Галтовка (Галтовка)',
  'Галтовка (Сушка)',
  'Прийомка',
  'Сортування'
]

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

// ─────────────────────────────────────────────────────────────────────────────
// Статусний потік картки:
//
//  new (Розкрій) → in-progress → at-buffer (Розкрій)
//    ↓ [Взяти в Галтовку]
//  in-progress (Галтовка) → at-buffer (Галтовка)
//    ↓ [Прийняти на склад НФ → тепер: перевести в Прийомку]
//  in-progress (Прийомка)
//    ↓ [Прийнято → at-buffer (Сортування)]
//  at-buffer (Сортування)     ← фізично в прийомці, чекає сканування
//    ↓ [Скановано на Сортуванні]
//  at-shop2-buffer             ← видно начальнику Цеху №2, генерує картки
// ─────────────────────────────────────────────────────────────────────────────

export default function Shop1Terminal() {
  const { workCards, nomenclatures, operators, getFilteredOperators, getFilteredManagers, managers, workCardHistory, inventory, fetchData, createWorkCard, orders, bomItems, tasks, currentUser, machines, systemUsers, machineOperations, formatUserName, requests } = useMES()

  const [currentTime, setCurrentTime] = useState(getCurrentTime())
  const [selectedCardId, setSelectedCardId] = useState(null)
  const prevCardIdRef = React.useRef(null)

  // Сканування та ручний ввід
  const [isScanning, setIsScanning] = useState(false)
  const [manualId, setManualId] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [scanError, setScanError] = useState(null)

  // Процеси та UI
  const [isSyncing, setIsSyncing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [movingScrapIds, setMovingScrapIds] = useState(new Set()) // Per-item loading for scrap transfers
  const [isBulkMoving, setIsBulkMoving] = useState(false) // Bulk scrap move loading
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Форми та модалки
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [machineNumber, setMachineNumber] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showSortingModal, setShowSortingModal] = useState(false)
  const [queueSectionFilter, setQueueSectionFilter] = useState('all') // 'all' | 'Розкрій' | 'Галтовка' | 'Прийомка' | 'Сортування'
  const [finalOperator, setFinalOperator] = useState('')
  const [scrapCount, setScrapCount] = useState(0)
  const [reworkCount, setReworkCount] = useState(0)
  const [cuttersUsed, setCuttersUsed] = useState(0)
  const [cuttersBreakdown, setCuttersBreakdown] = useState({})
  const [galtPriority, setGaltPriority] = useState(2)

  // Перезмінка (тільки Розкрій)
  const [showShiftChangeModal, setShowShiftChangeModal] = useState(false)
  const [shiftChangeOperator, setShiftChangeOperator] = useState('')
  const [shiftChangeShift, setShiftChangeShift] = useState('')

  // Auto-detect role filter when operator is selected
  useEffect(() => {
    if (!selectedOperator) return
    const lower = selectedOperator.toLowerCase()
    if (lower.includes('розкрій') || lower.includes('різальн')) {
      setQueueSectionFilter('Розкрій')
    } else if (lower.includes('галтовка') || lower.includes('галтовщ')) {
      setQueueSectionFilter('Галтовка')
    } else if (lower.includes('прийомка') || lower.includes('приймальн')) {
      setQueueSectionFilter('Прийомка')
    } else if (lower.includes('сортування') || lower.includes('сортувал')) {
      setQueueSectionFilter('Сортування')
    }
  }, [selectedOperator])

  // Auto-detect role filter when currentUser is loaded
  useEffect(() => {
    if (!currentUser) return
    const pos = String(currentUser.position || '').toLowerCase()
    const name = (String(currentUser.first_name || '') + ' ' + String(currentUser.last_name || '')).toLowerCase()
    const login = String(currentUser.login || '').toLowerCase()

    if (pos.includes('сортув') || name.includes('сортув') || login.includes('sort')) {
      setQueueSectionFilter('Сортування')
    } else if (pos.includes('прийом') || name.includes('прийом') || login.includes('recept')) {
      setQueueSectionFilter('Прийомка')
    } else if (pos.includes('галтов') || name.includes('галтов') || login.includes('tumb')) {
      setQueueSectionFilter('Галтовка')
    } else if (pos.includes('розкрій') || pos.includes('різальн') || name.includes('розкрій') || login.includes('cut')) {
      setQueueSectionFilter('Розкрій')
    }
  }, [currentUser])
  const [scrapOperator, setScrapOperator] = useState('')

  // Пауза / Зупинка (тільки для Розкрою)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pauseReason, setPauseReason] = useState('Поломка верстата')
  const [customPauseReason, setCustomPauseReason] = useState('')

  // Фільтр таблиці "В роботі та буфері"
  const [activeTableFilter, setActiveTableFilter] = useState('all') // 'all' | 'in-progress' | 'at-buffer'
  const [queueFilter, setQueueFilter] = useState('all') // 'all' | 'new' | 'at-buffer'

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
      const operatorName = selectedOperator || currentUser?.name || currentUser?.login || 'Оператор терміналу'
      const emp = (systemUsers || []).find(u => u.id === employeeId)
      const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : null
      const { error } = await supabase.from('machine_calls').insert({
        machine_id: machineCallModal.id,
        called_role: role === 'qc' ? 'quality' : role, // Map 'qc' to 'quality' for DB consistency
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

  // Корекція браку ВКЯ
  const [showQCModal, setShowQCModal] = useState(false)
  const [qcScrapCount, setQcScrapCount] = useState(0)
  const [qcInspector, setQcInspector] = useState('')
  const [qcReason, setQcReason] = useState('Биття цанги')
  const [qcCustomReason, setQcCustomReason] = useState('')

  // Кастомне сповіщення для iOS (заміна стандартного window.alert)
  const [customAlert, setCustomAlert] = useState(null) // { title, message }
  const showAlert = (message, title = 'Сповіщення') => {
    setCustomAlert({ title, message })
  }

  // Детальна статистика етапу
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [showStorageExplorer, setShowStorageExplorer] = useState(false)
  const [activeExplorerTab, setActiveExplorerTab] = useState('reception')

  // Локальна черга сканованого
  const [scannedIds, setScannedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shop1_scanned') || '[]') } catch { return [] }
  })
  const [collapsedGroups, setCollapsedGroups] = useState({})

  useEffect(() => { localStorage.setItem('shop1_scanned', JSON.stringify(scannedIds)) }, [scannedIds])
  useEffect(() => { const t = setInterval(() => setCurrentTime(getCurrentTime()), 1000); return () => clearInterval(t) }, [])

  const checkCardMaterials = (card) => {
    if (!card) return false
    // Попередження лише якщо картка дійсно очікує матеріали
    if (card.status !== 'waiting_material') return false

    const pendingReqs = (requests || []).filter(r => 
      (String(r.card_id) === String(card.id) || String(r.task_id) === String(card.task_id)) && 
      r.status === 'pending'
    )
    if (pendingReqs.length > 0) {
      const materialList = pendingReqs.map((r, idx) => {
        return `${idx + 1}. ${r.details || 'Матеріали'}`
      }).join('\n')
      showAlert(
        `Дана картка очікує забезпечення матеріалами від складу:\n\n${materialList}\n\nБудь ласка, зверніться до працівника складу для підтвердження видачі перед початком роботи.`,
        `⏳ Очікування забезпечення матеріалів`
      )
      return true
    }
    return false
  }

  // ── QR-сканер (Зроблено "таким самим", як в інших терміналах) ──────────
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }

      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        async (text) => {
          if (text.startsWith('CENTRUM_CARD_')) {
            const id = text.replace('CENTRUM_CARD_', '').trim()

            await stopAndClose()

            let card = workCards.find(c => String(c.id).trim() === id)

            if (!card) {
              setIsSyncing(true)
              // Direct DB lookup for instant discovery of newly created cards
              const { data: freshCard, error: fetchError } = await supabase
                .from('work_cards')
                .select('*')
                .eq('id', id)
                .single()

              setIsSyncing(false)

              if (fetchError || !freshCard) {
                setScanError(`Картку №${id} не знайдено.`)
                return
              }
              card = freshCard
            }

            // Дозволяємо картки "Нова", ті що в ланцюжку Цеху №1, або в буфері Сортування
            const isNew = card.status === 'new' || !card.operation || card.operation === 'Нова'
            const isInChain = CHAIN.includes(card.operation)
            const isSortування = card.status === 'at-buffer' && card.operation === 'Сортування'

            if (!isNew && !isInChain && !isSortування) {
              setScanError(`Картка #${id} — не для Цеху №1 (${card.operation})`)
              return
            }

            if (card.status === 'completed') {
              setScanError(`Картка #${id} вже завершена`);
              return
            }

            // Додаємо в локальну чергу та активуємо
            setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
            setSelectedCardId(card.id)
            setScanError(null)
            checkCardMaterials(card)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          } else {
            // Check if it's a machine call QR code URL
            const isMachineQR = await handleMachineQRScan(text)
            if (isMachineQR) {
              await stopAndClose()
            }
          }
        }
      ).catch(err => {
        console.error("Scanner error:", err)
        setScanError(`Помилка камери: ${err}. Перевірте дозволи у браузері.`)
        // Не закриваємо setIsScanning(false) одразу, щоб користувач бачим помилку в самому інтерфейсі
      })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { }) }
  }, [isScanning, workCards])

  // ── Global Scanner Keydown Listener ───────────────────────────────────────
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
          
          const isMachineQR = await handleMachineQRScan(scannedText)
          if (isMachineQR) {
            e.preventDefault()
            return
          }

          if (scannedText.startsWith('CENTRUM_CARD_')) {
            const id = scannedText.replace('CENTRUM_CARD_', '').trim()
            let card = workCards.find(c => String(c.id).trim() === id)

            if (!card) {
              setIsSyncing(true)
              const { data: freshCard } = await supabase
                .from('work_cards')
                .select('*')
                .eq('id', id)
                .single()
              setIsSyncing(false)
              if (freshCard) card = freshCard
            }

            if (card) {
              const isNew = card.status === 'new' || !card.operation || card.operation === 'Нова'
              const isInChain = CHAIN.includes(card.operation)
              const isSortування = card.status === 'at-buffer' && card.operation === 'Сортування'

              if ((isNew || isInChain || isSortування) && card.status !== 'completed') {
                setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
                setSelectedCardId(card.id)
                setScanError(null)
                checkCardMaterials(card)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
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

  const handleManualEntry = async (e) => {
    if (e) e.preventDefault()
    if (!manualId) return

    const cleanInput = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()

    // Check if it's a machine call QR code URL
    const isMachineQR = await handleMachineQRScan(cleanInput)
    if (isMachineQR) {
      setManualId('')
      setShowManualInput(false)
      setIsScanning(false)
      return
    }

    setIsProcessing(true)

    let card = workCards.find(c => String(c.id).trim() === cleanInput || String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase()))
    if (!card) {
      await fetchData('work_cards').catch(() => { })
      card = workCards.find(c => String(c.id).trim() === cleanInput || String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase()))
    }

    if (!card) {
      setScanError(`Картку №${cleanInput} не знайдено`)
    } else {
      setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
      setSelectedCardId(card.id)
      setManualId('')
      setShowManualInput(false)
      setIsScanning(false)
      setScanError(null)
      checkCardMaterials(card)
    }
    setIsProcessing(false)
  }

  // ── Хелпери ──────────────────────────────────────────────────────────────
  const currentCard = workCards.find(c => c.id === selectedCardId)
  const cardOperators = React.useMemo(() => {
    if (!currentCard) return []
    const ops = new Set()
    if (currentCard.operator_name) {
      ops.add(currentCard.operator_name)
    }
    if (workCardHistory && workCardHistory.length > 0) {
      const history = workCardHistory.filter(h => String(h.card_id) === String(currentCard.id))
      history.forEach(h => {
        if (h.operator_name) {
          ops.add(h.operator_name)
        }
      })
    }
    return Array.from(ops)
  }, [currentCard, workCardHistory])

  const getNom = card => nomenclatures.find(n => n.id === card?.nomenclature_id)
  const formatSec = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':')
  }
  // Компенсація зсуву видалена — всі timestamps в БД коректні UTC
  const parseDBTime = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  const getCardTimeMetrics = (card) => {
    if (!card) return { totalSec: 0, currentSec: 0 }
    const nowMs = currentTime.getTime()
    const isGaltCurrent = card.operation?.startsWith('Галтовка')

    // 1) Загальний час за всю історію картки (всі етапи та буфери)
    let totalHistorySec = 0
    if (workCardHistory && workCardHistory.length > 0) {
      const cardHistory = workCardHistory.filter(h => {
        if (String(h.card_id) !== String(card.id)) return false
        if (isGaltCurrent) {
          return h.stage_name?.startsWith('Галтовка') || (h.stage_name?.startsWith('Буфер') && h.stage_name !== 'Буфер Розкрою')
        } else {
          return h.stage_name === 'Розкрій' || h.stage_name === 'Буфер Розкрою' || h.stage_name === 'Розкрій (перезмінка)'
        }
      })
      cardHistory.forEach(h => {
        if (h.started_at && h.completed_at) {
          if (String(h.stage_name).includes('пауза') || String(h.stage_name).includes('зупинка')) return;
          const s = parseDBTime(h.started_at)?.getTime() || 0;
          const c = parseDBTime(h.completed_at)?.getTime() || 0;
          if (s && c) {
            totalHistorySec += Math.max(0, Math.floor((c - s) / 1000))
          }
        }
      })
    }

    // 2) Час на поточному етапі / буфері
    let currentSec = 0
    if (card.status === 'in-progress') {
      const s = parseDBTime(card.started_at)?.getTime() || 0;
      currentSec = s 
        ? Math.max(0, Math.floor((nowMs - s) / 1000)) 
        : 0
    } else if (card.status === 'at-buffer') {
      const bufferStart = card.completed_at || card.started_at
      const s = parseDBTime(bufferStart)?.getTime() || 0;
      currentSec = s 
        ? Math.max(0, Math.floor((nowMs - s) / 1000)) 
        : 0
    }

    return { totalSec: totalHistorySec + currentSec, currentSec }
  }

  const getCardStartDate = (card) => {
    const history = (workCardHistory || []).filter(h => String(h.card_id) === String(card.id) && h.started_at);
    if (history.length > 0) {
      return new Date(Math.min(...history.map(h => parseDBTime(h.started_at).getTime())));
    }
    return parseDBTime(card.started_at ? card.started_at : card.created_at);
  }

  const formatDateTimeParts = (date) => {
    if (!date) return { date: '—', time: '' };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { date: '—', time: '' };
    const datePart = d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    return { date: datePart, time: timePart };
  }
  const formatTime = iso => {
    if (!iso) return '00:00:00'
    const s = parseDBTime(iso)?.getTime() || 0;
    if (!s) return '00:00:00';
    const d = Math.max(0, Math.floor((currentTime.getTime() - s) / 1000))
    return formatSec(d)
  }
  const formatPlanned = (mins) => {
    if (!mins || mins <= 0) return '—'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h > 0) return `${h}год ${m}хв`
    return `${m}хв`
  }
  const getPlannedTime = (card) => {
    if (!card) return 0
    // Priority 1: Direct estimated time (if in minutes)
    if (card.estimated_time) return Number(card.estimated_time)
    // Priority 2: estimated_seconds (from machine module logic)
    if (card.estimated_seconds) return Number(card.estimated_seconds) / 60
    // Priority 3: Calculation from nomenclature
    const nom = getNom(card)
    if (nom?.time_per_unit) return (Number(nom.time_per_unit) * Number(card.quantity))
    return 0
  }
  const nextStageFor = card => {
    const i = CHAIN.indexOf(card?.operation || '')
    return i >= 0 && i < CHAIN.length - 1 ? CHAIN[i + 1] : null
  }
  const formatMachine = (name) => {
    if (!name) return '—'
    const match = name.match(/№\s*(\S+)/)
    return match ? `№${match[1]}` : name
  }

  // Автоматичне скидання полів при зміні обраної картки
  useEffect(() => {
    if (!selectedCardId) {
      prevCardIdRef.current = null
      return
    }
    
    const cardChanged = selectedCardId !== prevCardIdRef.current
    if (cardChanged) {
      prevCardIdRef.current = selectedCardId
      setSelectedOperator('')
      
      const combined = currentCard?.machine || ''
      const match = combined.match(/^(.*?) ?№ ?(\S+)$/)
      if (match) {
        setSelectedMachine(match[1].trim())
        setMachineNumber(match[2].trim())
      } else {
        setSelectedMachine(combined)
        setMachineNumber('')
      }
      
      setFinalOperator('')
      setScrapOperator('')
      setScrapCount(0)
      setReworkCount(0)
      setQcScrapCount(0)
      setQcInspector('')
      setCuttersUsed(0)
      if (currentCard?.operation === 'Розкрій') {
        const initCutters = getCuttersForCard(currentCard)
        const initBreakdown = {}
        initCutters.forEach(name => { initBreakdown[name] = 0 })
        setCuttersBreakdown(initBreakdown)
      } else {
        setCuttersBreakdown({})
      }
      setGaltPriority(currentCard?.galt_priority || 2)
    }

    // Auto-select manager and shift when card is loaded or currentUser info changes
    const autoManagerName = currentUser ? formatUserName(currentUser) : ''
    if (autoManagerName && !selectedManager) {
      setSelectedManager(autoManagerName)
    }
    if (cardChanged) {
      setSelectedShift(currentCard?.shift_name || currentUser?.shift || '')
    } else if (!selectedShift && (currentCard?.shift_name || currentUser?.shift)) {
      setSelectedShift(currentCard?.shift_name || currentUser?.shift || '')
    }
  }, [selectedCardId, currentCard, currentUser, systemUsers, selectedManager, selectedShift])

  useEffect(() => {
    if (scrapCount > 0 && !scrapOperator && currentCard) {
      setScrapOperator(currentCard.operator_name || '')
    }
  }, [scrapCount, currentCard, scrapOperator])

  const getCuttersForCard = (card) => {
    if (!card) return []
    const task = tasks?.find(t => String(t.id) === String(card.task_id))
    const targetMachine = task?.machine_name || card.machine || ''
    
    const configuredCutters = []

    // 1. Get the cutters defined in machineOperations for all parts (details) produced in this task
    if (task && task.plan_snapshot) {
      Object.entries(task.plan_snapshot).forEach(([key, val]) => {
        // Ensure key is a numeric nomenclature ID (referring to a detail)
        if (!isNaN(key) && val && typeof val === 'object' && val.id) {
          const partNomId = val.id
          const partMachine = val.selected_machine || targetMachine
          
          const opData = machineOperations?.find(o => {
            const nomIdMatch = String(o.nomenclature_id) === String(partNomId)
            if (!nomIdMatch) return false
            
            // Check machine name matches (robust string containment or short name comparison)
            const cleanPartMachine = String(partMachine || '').split(' - ')[0].trim().toLowerCase()
            const cleanOpMachineType = String(o.machine_type || '').split(' - ')[0].trim().toLowerCase()
            const cleanOpMachineId = String(o.machine_id || '').split(' - ')[0].trim().toLowerCase()
            
            return (
              cleanOpMachineType === cleanPartMachine ||
              cleanOpMachineId === cleanPartMachine ||
              (o.machine_type && cleanPartMachine.startsWith(cleanOpMachineType)) ||
              (o.machine_id && cleanPartMachine.startsWith(cleanOpMachineId))
            )
          })
          
          if (opData && opData.side2_cut_ops) {
            const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
            cutterOps.forEach(op => {
              const parts = op.split(':')
              const cutterNomId = parts[1]
              if (cutterNomId) {
                const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
                if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
                  const genericName = cutterNom.name.trim()
                  
                  // Check if there is a specific selected cutter for this generic cutter name in plan_snapshot
                  let resolvedName = genericName
                  if (task.plan_snapshot.selectedCutters) {
                    const invId = task.plan_snapshot.selectedCutters[genericName] || task.plan_snapshot.selectedCutters[genericName.toLowerCase()]
                    if (invId) {
                      const inv = (inventory || []).find(i => String(i.id) === String(invId))
                      if (inv) {
                        const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
                        if (nom) resolvedName = nom.name.trim()
                        else if (inv.name) resolvedName = inv.name.trim()
                      }
                    }
                  }
                  
                  if (!configuredCutters.includes(resolvedName)) {
                    configuredCutters.push(resolvedName)
                  }
                }
              }
            })
          }
        }
      })
    }

    // 1b. If configuredCutters is empty, also check machine operations of the card nomenclature itself
    if (configuredCutters.length === 0) {
      const opData = machineOperations?.find(o => {
        const nomIdMatch = String(o.nomenclature_id) === String(card.nomenclature_id)
        if (!nomIdMatch) return false
        
        const cleanTargetMachine = String(targetMachine || '').split(' - ')[0].trim().toLowerCase()
        const cleanOpMachineType = String(o.machine_type || '').split(' - ')[0].trim().toLowerCase()
        const cleanOpMachineId = String(o.machine_id || '').split(' - ')[0].trim().toLowerCase()
        
        return (
          cleanOpMachineType === cleanTargetMachine ||
          cleanOpMachineId === cleanTargetMachine ||
          (o.machine_type && cleanTargetMachine.startsWith(cleanOpMachineType)) ||
          (o.machine_id && cleanTargetMachine.startsWith(cleanOpMachineId))
        )
      })
      if (opData && opData.side2_cut_ops) {
        const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
        cutterOps.forEach(op => {
          const parts = op.split(':')
          const cutterNomId = parts[1]
          if (cutterNomId) {
            const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
            if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
              const genericName = cutterNom.name.trim()
              let resolvedName = genericName
              if (task?.plan_snapshot?.selectedCutters) {
                const invId = task.plan_snapshot.selectedCutters[genericName] || task.plan_snapshot.selectedCutters[genericName.toLowerCase()]
                if (invId) {
                  const inv = (inventory || []).find(i => String(i.id) === String(invId))
                  if (inv) {
                    const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
                    if (nom) resolvedName = nom.name.trim()
                    else if (inv.name) resolvedName = inv.name.trim()
                  }
                }
              }
              if (!configuredCutters.includes(resolvedName)) {
                configuredCutters.push(resolvedName)
              }
            }
          }
        })
      }
    }

    if (configuredCutters.length > 0) {
      return configuredCutters
    }
    
    // Fallback 2: If no machine operations defined, check plan_snapshot.consumables & selectedCutters directly
    if (task && task.plan_snapshot) {
      const snapshotCutters = []
      const replacedGenericNames = []
      
      if (task.plan_snapshot.selectedCutters && typeof task.plan_snapshot.selectedCutters === 'object') {
        Object.entries(task.plan_snapshot.selectedCutters).forEach(([genericName, invId]) => {
          if (invId) {
            replacedGenericNames.push(genericName.trim().toLowerCase())
          }
        })
      }

      if (Array.isArray(task.plan_snapshot.consumables)) {
        task.plan_snapshot.consumables.forEach(c => {
          if (c.name && c.name.toLowerCase().includes('фреза')) {
            const cleanName = c.name.trim()
            if (cleanName.toLowerCase() !== 'фреза') {
              if (replacedGenericNames.includes(cleanName.toLowerCase())) {
                return
              }
              if (!snapshotCutters.includes(cleanName)) {
                snapshotCutters.push(cleanName)
              }
            }
          }
        })
      }
      
      if (task.plan_snapshot.selectedCutters && typeof task.plan_snapshot.selectedCutters === 'object') {
        Object.values(task.plan_snapshot.selectedCutters).forEach(invId => {
          if (invId) {
            const inv = (inventory || []).find(i => String(i.id) === String(invId))
            if (inv) {
              const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
              const name = nom ? nom.name : inv.name
              if (name && name.toLowerCase().includes('фреза') && name.toLowerCase() !== 'фреза') {
                const cleanName = name.trim()
                if (!snapshotCutters.includes(cleanName)) {
                  snapshotCutters.push(cleanName)
                }
              }
            }
          }
        })
      }
      
      if (snapshotCutters.length > 0) {
        return snapshotCutters
      }
    }
    
    // Fallback 3: Return all cutters in nomenclatures
    const fallbackCutters = []
    if (nomenclatures) {
      nomenclatures
        .filter(n => n.type === 'consumable' && n.name.trim().toLowerCase() !== 'фреза' && n.name.toLowerCase().includes('фреза'))
        .forEach(n => {
          const cleanName = n.name.trim()
          if (!fallbackCutters.includes(cleanName)) {
            fallbackCutters.push(cleanName)
          }
        })
    }
    return fallbackCutters
  }


  // Уніфікована функція запису в інвентар (без bz_qty колонки)
  const updateInventoryStock = async (nomId, qty, type = 'semi') => {
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
    } catch (e) { console.warn(`Stock update failed for type ${type}:`, e) }
  }

  // Картки для черги зліва:
  // - нові картки (ще не взяті в роботу) — показуємо ВСІХ нових незалежно від operation
  //   бо оператор сам призначить першу операцію (Розкрій)
  // - картки в буфері будь-якого CHAIN етапу (чекають переміщення)
  // - картки що були вже відскановані в цьому сеансі
  const queueCards = workCards.filter(c => {
    // 1. Обов'язкові виключення
    if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return false
    
    // 2. Виключення за маркерами Shop 2
    const info = String(c.card_info || '')
    if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false

    // 2.5. Фільтрація тільки для деталей (type === 'part')
    const nom = getNom(c)
    if (nom && nom.type && nom.type !== 'part') return false

    // 3. Перевірка батьківського наряду
    const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
    if (parentTask) {
      // Якщо наряд уже завершений (переданий в інший цех або закритий) — ховаємо його картки
      if (parentTask.status === 'completed') return false
      // Якщо наряд явно належить Цеху №2
      if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false
    }

    // 4. Дозволені статуси та операції для Цеху №1
    const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій')
    const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation)
    const isScanned = scannedIds.includes(c.id)

    let matchesSection = true
    if (queueSectionFilter === 'Розкрій') {
      matchesSection = c.status === 'new' && (c.operation === 'Розкрій' || !c.operation || c.operation === 'Нова')
    } else if (queueSectionFilter === 'Галтовка') {
      matchesSection = c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation?.startsWith('Галтовка'))
    } else if (queueSectionFilter === 'Прийомка') {
      matchesSection = c.status === 'at-buffer' && c.operation === 'Прийомка'
    } else if (queueSectionFilter === 'Сортування') {
      matchesSection = c.status === 'at-buffer' && (c.operation === 'Сортування' || c.operation === 'Прийомка')
    }

    return (isNewForShop1 || isInBufferForShop1 || isScanned) && matchesSection
  }).sort((a, b) => {
    const aIsGaltBuf = a.status === 'at-buffer' && a.operation === 'Розкрій'
    const bIsGaltBuf = b.status === 'at-buffer' && b.operation === 'Розкрій'

    if (aIsGaltBuf && bIsGaltBuf) {
      const aPri = a.galt_priority || 2
      const bPri = b.galt_priority || 2
      if (aPri !== bPri) return aPri - bPri
    } else if (aIsGaltBuf) {
      return -1
    } else if (bIsGaltBuf) {
      return 1
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  // ── ДІЯ 1: Взяти в роботу (new → in-progress) ──────────────────────────
  // Якщо operation не в ланцюжку (наприклад 'Нова') — стартуємо з 'Розкрій'
  const handleStart = async () => {
    if (!currentCard || !selectedOperator || !selectedShift) return
    setIsProcessing(true)
    try {
      const startOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
      const targetMachine = machineNumber ? `${selectedMachine} №${machineNumber}`.trim() : (selectedMachine?.trim() || 'Не вказано')

      // ⚠️ Check if machine exists in the system (if operation is Cutting / "Розкрій")
      if (startOp === 'Розкрій' && targetMachine && targetMachine !== 'Не вказано') {
        const cleanName = (selectedMachine || '').trim().toLowerCase()
        const cleanNum = (machineNumber || '').trim().toLowerCase()

        const machineExists = (machines || []).some(m => {
          const mName = String(m.name || '').trim().toLowerCase()
          const mInv = String(m.inventory_no || '').trim().toLowerCase()
          const mSeq = String(m.sequence_number || '').trim().toLowerCase()
          const mType = String(m.type || '').trim().toLowerCase()

          // If both name (type) and number are specified
          if (cleanName && cleanNum) {
            return (mName === cleanName || mType === cleanName || mName.includes(cleanName) || mType.includes(cleanName)) && (mInv === cleanNum || mSeq === cleanNum)
          }
          // If only name (type) is specified
          if (cleanName) {
            return mName === cleanName || mType === cleanName || mInv === cleanName || mSeq === cleanName || mName.includes(cleanName) || mType.includes(cleanName)
          }
          // If only number is specified
          if (cleanNum) {
            return mInv === cleanNum || mSeq === cleanNum
          }
          return false
        })

        if (!machineExists) {
          setIsProcessing(false)
          showAlert(
            `Вказаного верстата "${targetMachine}" немає в списку обладнання.\n\nБудь ласка, введіть коректну назву або інвентарний номер верстата з наявних у системі.`,
            `❌ Помилка: верстат не знайдено`
          )
          return
        }

        // ⚠️ Check if machine is already busy
        const targetNorm = targetMachine.trim().toLowerCase()
        const targetNumMatch = targetNorm.match(/№\s*(\S+)/)

        const runningCard = (workCards || []).find(c => {
          if (c.status !== 'in-progress') return false
          if (c.id === currentCard.id) return false
          if (String(c.operation || '').trim().toLowerCase() !== 'розкрій') return false

          const cMachine = String(c.machine || '').trim().toLowerCase()
          if (!cMachine || cMachine === 'не вказано') return false

          // Exact string match
          if (cMachine === targetNorm) return true

          // Match by machine number if both have numbers
          const cNumMatch = cMachine.match(/№\s*(\S+)/)
          if (cNumMatch && targetNumMatch && cNumMatch[1] === targetNumMatch[1]) return true

          return false
        })

        if (runningCard) {
          const nom = nomenclatures.find(n => n.id === runningCard.nomenclature_id)
          setIsProcessing(false)
          showAlert(
            `На ньому зараз виконується робота:\n\n` +
            `• Картка: #${runningCard.id.slice(-8).toUpperCase()} (${nom?.name || 'Деталь'})\n` +
            `• Оператор: ${runningCard.operator_name || 'Не вказано'}\n\n` +
            `Будь ласка, оберіть інший вільний верстат або завершіть поточну картку на цьому верстаті.`,
            `⚠️ Помилка: Верстат "${targetMachine}" вже зайнятий!`
          )
          return
        }
      }

      await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: startOp,
        started_at: new Date().toISOString(),
        operator_name: selectedOperator,
        manager_name: selectedManager || 'Не вказано',
        shift_name: selectedShift,
        machine: targetMachine,
        card_info: ((currentCard.card_info || '').replace('[SHOP:1]', '').trim() + ' [SHOP:1]').trim()
      }).eq('id', currentCard.id)
      fetchData(['work_cards', 'tasks']).catch(() => {})
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) {
      setIsProcessing(false)
      alert('Помилка: ' + e.message)
    }
    finally { setIsProcessing(false) }
  }

  // ── ДІЯ 1.5: ПЕРЕЗМІНКА (тільки Розкрій) — фіксує оператора без зупинки ─
  const handleShiftChange = async () => {
    if (!currentCard || !shiftChangeOperator || !shiftChangeShift) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const shiftChangeInfo = `[REPLACED_BY:${shiftChangeOperator} (${shiftChangeShift})]`
      const historyCardInfo = ((currentCard.card_info || '') + ' ' + shiftChangeInfo).trim()

      // Записуємо проміжного оператора в history (того, хто працював до цього моменту)
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій (перезмінка)',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity,
        qty_completed: currentCard.quantity,
        scrap_qty: 0,
        started_at: currentCard.started_at || now,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine,
        card_info: historyCardInfo
      }])
      // Зберігаємо первинний час запуску етапу в card_info, якщо його там немає
      const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at || now;
      const updatedCardInfo = ((currentCard.card_info || '').replace(/\[ORIGINAL_START:[^\]]+\]/g, '').trim() + ` [ORIGINAL_START:${originalStart}]`).trim();

      // Оновлюємо оператора на картці (залишаємо початковий started_at для загального часу, або записуємо новий started_at для поточного оператора)
      await supabase.from('work_cards').update({
        operator_name: shiftChangeOperator,
        shift_name: shiftChangeShift,
        started_at: now, // поточний оператор починає зараз
        card_info: updatedCardInfo // зберігаємо оригінальний старт в метаданих
      }).eq('id', currentCard.id)
      setShowShiftChangeModal(false)
      setShiftChangeOperator('')
      setShiftChangeShift('')
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      setIsProcessing(false)
      alert('Помилка перезмінки: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  // ── ДІЯ 1.7: ПАУЗА / ЗУПИНКА (тільки Розкрій) ───────────────────────────
  const handlePauseCard = async () => {
    if (!currentCard || isProcessing) return
    const reasonText = (pauseReason === 'Інша причина (введіть нижче)' ? customPauseReason : pauseReason) || 'Без причини'
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      
      // 1. Записуємо робочий інтервал в історію
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity || 0,
        qty_completed: currentCard.quantity || 0,
        scrap_qty: 0,
        started_at: currentCard.started_at || now,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name || 'Не вказано',
        machine_name: currentCard.machine || 'Не вказано',
        card_info: `[PAUSED_WORK_LOG][REASON:${reasonText}]`
      }])

      // Збережемо початковий ORIGINAL_START, якщо його немає
      const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at || now;
      let cleanCardInfo = (currentCard.card_info || '').replace(/\[ORIGINAL_START:[^\]]+\]/g, '').trim()
      cleanCardInfo = cleanCardInfo.replace(/\[PAUSED:[^\]]+\]/g, '').replace(/\[PAUSED_AT:[^\]]+\]/g, '').trim()

      const updatedCardInfo = `[PAUSED:${reasonText}][PAUSED_AT:${now}][ORIGINAL_START:${originalStart}] ${cleanCardInfo}`.trim()

      // 2. Оновлюємо статус на paused
      await supabase.from('work_cards').update({
        status: 'paused',
        card_info: updatedCardInfo
      }).eq('id', currentCard.id)

      setShowPauseModal(false)
      setCustomPauseReason('')
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      alert('Помилка призупинення: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResumeCard = async () => {
    if (!currentCard || isProcessing) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const pausedAtStr = currentCard.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
      const reasonText = currentCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Без причини'
      const pausedAt = pausedAtStr ? new Date(pausedAtStr).toISOString() : now

      // 1. Записуємо паузу в історію
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій (зупинка)',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity || 0,
        qty_completed: currentCard.quantity || 0,
        scrap_qty: 0,
        started_at: pausedAt,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name || 'Не вказано',
        machine_name: currentCard.machine || 'Не вказано',
        card_info: `Причина зупинки: ${reasonText}`
      }])

      // 2. Оновлюємо статус на in-progress
      let cleanCardInfo = (currentCard.card_info || '')
        .replace(/\[PAUSED:[^\]]+\]/g, '')
        .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
        .trim()

      await supabase.from('work_cards').update({
        status: 'in-progress',
        started_at: now,
        card_info: cleanCardInfo
      }).eq('id', currentCard.id)

      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      alert('Помилка відновлення роботи: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCuttersInventoryDeduction = async (card, breakdown) => {
    if (card.operation !== 'Розкрій' || !breakdown || Object.keys(breakdown).length === 0) return

    for (const [cutterName, actualQtyVal] of Object.entries(breakdown)) {
      const actualQty = Number(actualQtyVal) || 0
      if (actualQty <= 0) continue

      const nom = nomenclatures?.find(n => n.name?.trim().toLowerCase() === cutterName.trim().toLowerCase() && n.type === 'consumable')
      if (!nom) continue

      try {
        const query = supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', nom.id)
          .eq('warehouse', 'pocket')

        if (card.manager_name && card.manager_name !== 'Не вказано') {
          query.eq('pocket_owner', card.manager_name)
        } else {
          query.is('pocket_owner', null)
        }

        const { data: pocketItem } = await query.limit(1).maybeSingle()

        if (pocketItem) {
          await supabase.from('inventory').update({
            total_qty: (Number(pocketItem.total_qty) || 0) - actualQty,
            updated_at: new Date().toISOString()
          }).eq('id', pocketItem.id)
        } else {
          await supabase.from('inventory').insert([{
            nomenclature_id: nom.id,
            name: nom.name,
            unit: nom.unit || 'шт',
            total_qty: -actualQty,
            warehouse: 'pocket',
            type: 'consumable',
            pocket_owner: card.manager_name && card.manager_name !== 'Не вказано' ? card.manager_name : null,
            updated_at: new Date().toISOString()
          }])
        }
      } catch (e) {
        console.warn('Failed to update Pocket inventory for cutter:', e)
      }
    }
  }

  // ── ДІЯ 2: Завершити етап → БУФЕР (in-progress → at-buffer) ──────────
  const handleCompleteToBuffer = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = Math.max(0, (currentCard.quantity || 0) - scrapCount)
      const op = finalOperator || currentCard.operator_name || 'Не вказано'
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни'
      const cuttersQty = currentCard.operation === 'Розкрій' ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : null
      const priorityVal = currentCard.operation === 'Розкрій' ? galtPriority : (currentCard.galt_priority || 2)

      let breakdownStr = ''
      if (currentCard.operation === 'Розкрій' && Object.keys(cuttersBreakdown).length > 0) {
        breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(cuttersBreakdown)}]`
      }
      const historyCardInfo = ((currentCard.card_info || '') + breakdownStr).trim()

      const promises = []

      // 1. Записуємо в history (galt_priority не існує в work_card_history!)
      if (scrapCount > 0 && scrapOperator && scrapOperator !== op) {
        // Запис для виконаних деталей (під фінальним оператором)
        if (qtyDone > 0) {
          promises.push(
            supabase.from('work_card_history').insert([{
              card_id: currentCard.id,
              nomenclature_id: currentCard.nomenclature_id,
              stage_name: currentCard.operation,
              operator_name: op,
              qty_at_start: currentCard.quantity - scrapCount,
              qty_completed: qtyDone,
              scrap_qty: 0,
              started_at: currentCard.started_at,
              completed_at: new Date().toISOString(),
              is_archived_scrap: false,
              shift_name: activeShift,
              manager_name: currentCard.manager_name,
              machine_name: currentCard.machine,
              cutters_used: cuttersQty,
              card_info: historyCardInfo
            }])
          )
        }
        // Запис для браку (під обраним оператором)
        let scrapShift = activeShift
        const scrapOpUser = systemUsers?.find(u => formatUserName(u) === scrapOperator)
        if (scrapOpUser?.shift) {
          scrapShift = scrapOpUser.shift
        }
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: currentCard.operation,
            operator_name: scrapOperator,
            qty_at_start: scrapCount,
            qty_completed: 0,
            scrap_qty: scrapCount,
            started_at: currentCard.started_at,
            completed_at: new Date().toISOString(),
            is_archived_scrap: true,
            shift_name: scrapShift,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine,
            cutters_used: cuttersQty,
            card_info: (historyCardInfo + ' [SCRAP_ASSIGNED]').trim()
          }])
        )
      } else {
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: currentCard.operation,
            operator_name: op,
            qty_at_start: currentCard.quantity,
            qty_completed: qtyDone,
            scrap_qty: scrapCount,
            started_at: currentCard.started_at,
            completed_at: new Date().toISOString(),
            is_archived_scrap: scrapCount > 0,
            shift_name: activeShift,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine,
            cutters_used: cuttersQty,
            card_info: historyCardInfo
          }])
        )
      }

      // 2. Оновлюємо картку (тільки перехід у буфер, фінальна прийомка далі)
      promises.push(
        supabase.from('work_cards').update({
          status: 'at-buffer',
          quantity: qtyDone,
          operator_name: op,
          shift_name: activeShift,
          cutters_used: cuttersQty,
          card_info: historyCardInfo,
          galt_priority: priorityVal,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      )

      // 3. Якщо є брак — записуємо його в інвентар окремим типом
      if (scrapCount > 0) {
        promises.push(updateInventoryStock(currentCard.nomenclature_id, scrapCount, 'scrap_ready'))
      }

      if (currentCard.operation === 'Розкрій') {
        promises.push(handleCuttersInventoryDeduction(currentCard, cuttersBreakdown))
      }

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res && res.error) throw res.error
      }

      setShowCompleteModal(false)
      setScrapCount(0)
      setSelectedCardId(null)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
    } catch (e) {
      console.error('Buffer error:', e)
      setIsProcessing(false)
      alert('Помилка буфера: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  // ── ДІЯ 3: ПРИЙНЯТИ (з буфера Галтовки або інших етапів не Прийомка) ─
  // Якщо next == 'Прийомка' — одним кліком приймаємо на склад (без in-progress Прийомки)
  // Якщо next != 'Прийомка' — переходимо до наступного етапу (in-progress)
  const handleStartNext = async () => {
    if (!currentCard) return
    const next = nextStageFor(currentCard)
    if (!next) return

    // Прийомка — це однокрокове прийняття на склад
    if (next === 'Прийомка') {
      if (currentCard.status === 'at-buffer') {
        try {
          const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
          const op = selectedOperator || currentCard.operator_name || 'Прийомка'
          await supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: `Буфер ${currentCard.operation}`,
            operator_name: op,
            qty_at_start: currentCard.quantity || 0,
            qty_completed: currentCard.quantity || 0,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: selectedShift || currentCard.shift_name || 'Без зміни',
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        } catch (err) {
          console.error('Error writing Tumbling Buffer history:', err)
        }
      }
      await handleAcceptToStock()
      return
    }

    if (!next?.startsWith('Галтовка') && !selectedOperator) return
    setIsProcessing(true)
    try {
      const op = next?.startsWith('Галтовка') ? 'Команда' : selectedOperator
      const writes = []

      if (currentCard.status === 'at-buffer') {
        const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
        writes.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: `Буфер ${currentCard.operation}`,
            operator_name: op || currentCard.operator_name || 'Не вказано',
            qty_at_start: currentCard.quantity || 0,
            qty_completed: currentCard.quantity || 0,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: selectedShift || currentCard.shift_name || 'Без зміни',
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        )
      }

      writes.push(
        supabase.from('work_cards').update({
          status: 'in-progress',
          operation: next,
          started_at: new Date().toISOString(),
          operator_name: op,
          shift_name: selectedShift,
          machine: currentCard.machine || 'Не вказано'
        }).eq('id', currentCard.id)
      )

      const results = await Promise.all(writes)
      for (const res of results) {
        if (res.error) throw res.error
      }

      fetchData(['work_cards', 'work_card_history']).catch(() => {})
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) {
      setIsProcessing(false)
      alert('Помилка: ' + e.message)
    }
    finally { setIsProcessing(false) }
  }

  // ── ДІЯ 4: ЗАМОВИТИ ДОВИПУСК (якщо 100% брак) ─────────────────────────
  const handleRequestRework = async () => {
    if (!currentCard || !createWorkCard) return
    setIsProcessing(true)
    try {
      const op = finalOperator || currentCard.operator_name || 'Брак'
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни'
      const cuttersQty = currentCard.operation === 'Розкрій' ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : null

      let breakdownStr = ''
      if (currentCard.operation === 'Розкрій' && Object.keys(cuttersBreakdown).length > 0) {
        breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(cuttersBreakdown)}]`
      }
      const historyCardInfo = ((currentCard.card_info || '') + breakdownStr).trim()

      const promises = []

      // 1. Записуємо в history
      let scrapOpToUse = op
      let scrapShiftToUse = activeShift
      if (scrapOperator) {
        scrapOpToUse = scrapOperator
        const scrapOpUser = systemUsers?.find(u => formatUserName(u) === scrapOperator)
        if (scrapOpUser?.shift) {
          scrapShiftToUse = scrapOpUser.shift
        }
      }

      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: currentCard.operation,
          operator_name: scrapOpToUse,
          qty_at_start: currentCard.quantity,
          qty_completed: 0,
          scrap_qty: currentCard.quantity,
          started_at: currentCard.started_at,
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: scrapShiftToUse,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine,
          card_info: scrapOperator && scrapOperator !== op ? (historyCardInfo + ' [SCRAP_ASSIGNED]').trim() : historyCardInfo,
          cutters_used: cuttersQty
        }])
      )

      // 2. Оновлюємо поточну картку → completed (з 0 qty)
      promises.push(
        supabase.from('work_cards').update({
          status: 'completed',
          quantity: 0,
          operator_name: op,
          shift_name: activeShift,
          card_info: historyCardInfo,
          cutters_used: cuttersQty
        }).eq('id', currentCard.id)
      )

      // 3. Записуємо брак на склад
      promises.push(updateInventoryStock(currentCard.nomenclature_id, currentCard.quantity, 'scrap_ready'))

      if (currentCard.operation === 'Розкрій') {
        promises.push(handleCuttersInventoryDeduction(currentCard, cuttersBreakdown))
      }

      // 4. Створюємо НОВУ картку (Розкрій) для перевипуску
      promises.push(
        createWorkCard(
          currentCard.task_id,
          currentCard.order_id,
          currentCard.nomenclature_id,
          CHAIN[0], // Розкрій
          null,     // Машину обере заново
          0,        // Естімейт
          `[REDO] після ${currentCard.operation}`,
          currentCard.quantity,
          0,
          true      // isRework = true
        )
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res && res.error) throw res.error
      }

      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {})
      setShowCompleteModal(false)
      setSelectedCardId(null)
      setIsProcessing(false)
      alert('Запит на перевипуск створено успішно!')
    } catch (e) {
      console.error('Rework error:', e)
      setIsProcessing(false)
      alert('Помилка перевипуску: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  const handleFinishSortingActive = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      await supabase.from('work_cards').update({
        status: 'at-buffer',
        completed_at: new Date().toISOString()
      }).eq('id', currentCard.id)

      fetchData(['work_cards', 'tasks']).catch(() => {})
    } catch (e) {
      console.error('Error completing sorting to buffer:', e)
      setIsProcessing(false)
      alert('Помилка завершення сортування: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── СОРТУВАННЯ → at-shop2-buffer ────────────────────────────────────────
  // Викликається при скануванні картки at-buffer(Сортування) — переводить в буфер Цеху №2
  const handleSortToShop2 = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const goodQty = Math.max(0, (currentCard.quantity || 0) - scrapCount - reworkCount)
      const op = selectedOperator || currentCard.operator_name || 'Сортування'
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни'

      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID()
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      }

      // Parallel Read: fetch existing inventory, Shop 2 tasks, s1TaskData, and BZ cards in parallel
      const [existingInvResult, shop2TasksResult, s1TaskResult, bzCardsResult] = await Promise.all([
        supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', currentCard.nomenclature_id)
          .in('type', ['semi', 'wip_bz', 'bz', 'semi_shop2', 'bz_shop2', 'scrap_ready']),
        supabase.from('tasks')
          .select('*')
          .eq('order_id', currentCard.order_id)
          .ilike('step', '%ЦЕХ №2%')
          .neq('status', 'completed'),
        supabase.from('tasks')
          .select('*')
          .eq('id', currentCard.task_id)
          .maybeSingle(),
        supabase.from('work_cards')
          .select('nomenclature_id, quantity')
          .eq('task_id', currentCard.task_id)
          .eq('operation', 'Склад БЗ')
      ])

      const existingItems = existingInvResult.data || []
      const shop2Tasks = shop2TasksResult.data || []
      const s1TaskData = s1TaskResult.data
      const bzCards = bzCardsResult.data || []

      // Calculations for inventory transfers
      const cardBz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
      const cardNeed = Number(currentCard.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, Number(currentCard.quantity) - cardBz))
      const actualNeed = Math.min(goodQty, cardNeed)
      const actualBz = Math.max(0, goodQty - actualNeed)

      const invUpdates = []
      const invInserts = []
      const findItem = (type) => existingItems.find(i => i.type === type)

      // 3.5.1. Зменшити semi (NEED) в Цеху 1
      if (actualNeed > 0) {
        const s1Semi = findItem('semi')
        if (s1Semi) {
          invUpdates.push({ ...s1Semi, total_qty: Math.max(0, (Number(s1Semi.total_qty) || 0) - actualNeed) })
        }
      }

      // 3.5.2. Зменшити wip_bz / bz (BZ) в Цеху 1
      if (actualBz > 0) {
        let remainingBz = actualBz
        const s1Wip = findItem('wip_bz')
        if (s1Wip) {
          const take = Math.min(Number(s1Wip.total_qty) || 0, remainingBz)
          invUpdates.push({ ...s1Wip, total_qty: Math.max(0, (Number(s1Wip.total_qty) || 0) - take) })
          remainingBz -= take
        }
        if (remainingBz > 0) {
          const s1Bz = findItem('bz')
          if (s1Bz) {
            const take = Math.min(Number(s1Bz.total_qty) || 0, remainingBz)
            invUpdates.push({ ...s1Bz, total_qty: Math.max(0, (Number(s1Bz.total_qty) || 0) - take) })
          }
        }
      }

      // 3.5.3. Збільшити semi_shop2 в Цеху 2
      if (actualNeed > 0) {
        const s2Semi = findItem('semi_shop2')
        if (s2Semi) {
          invUpdates.push({ ...s2Semi, total_qty: (Number(s2Semi.total_qty) || 0) + actualNeed })
        } else {
          const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
          invInserts.push({
            nomenclature_id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            total_qty: actualNeed,
            reserved_qty: 0,
            type: 'semi_shop2',
            unit: nom?.unit || 'шт'
          })
        }
      }

      // 3.5.4. Збільшити bz_shop2 в Цеху 2
      if (actualBz > 0) {
        const s2Bz = findItem('bz_shop2')
        if (s2Bz) {
          invUpdates.push({ ...s2Bz, total_qty: (Number(s2Bz.total_qty) || 0) + actualBz })
        } else {
          const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
          invInserts.push({
            nomenclature_id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            total_qty: actualBz,
            reserved_qty: 0,
            type: 'bz_shop2',
            unit: nom?.unit || 'шт'
          })
        }
      }

      // 3. Якщо є брак при сортуванні — записуємо його в інвентар
      if (scrapCount > 0) {
        const scrapItem = findItem('scrap_ready')
        if (scrapItem) {
          invUpdates.push({ ...scrapItem, total_qty: (Number(scrapItem.total_qty) || 0) + scrapCount, updated_at: new Date().toISOString() })
        } else {
          const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
          invInserts.push({
            name: nom?.name || 'Деталь',
            unit: nom?.unit || 'шт',
            total_qty: scrapCount,
            type: 'scrap_ready',
            nomenclature_id: currentCard.nomenclature_id
          })
        }
      }

      // History entries to write
      const historyToInsert = []
      historyToInsert.push({
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Сортування',
        operator_name: op,
        qty_at_start: currentCard.quantity,
        qty_completed: goodQty,
        scrap_qty: scrapCount,
        started_at: currentCard.started_at || new Date().toISOString(),
        completed_at: currentCard.completed_at || new Date().toISOString(),
        is_archived_scrap: scrapCount > 0,
        shift_name: activeShift,
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine
      })

      const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
      historyToInsert.push({
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Буфер Сортування',
        operator_name: op,
        qty_at_start: goodQty,
        qty_completed: goodQty,
        scrap_qty: 0,
        started_at: bufferStart,
        completed_at: new Date().toISOString(),
        shift_name: activeShift,
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine
      })

      // Task & Card writes
      let shop2TaskId = null
      const writePromises = []

      // Work card update
      writePromises.push(
        supabase.from('work_cards').update({
          status: 'at-shop2-buffer',
          operation: 'Сортування',
          quantity: goodQty + reworkCount,
          used_in_shop2_qty: reworkCount,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      )

      // Task preparation
      let updatedArrivals = []
      const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)

      if (!shop2Tasks || shop2Tasks.length === 0) {
        if (s1TaskData) {
          shop2TaskId = generateUUID()
          updatedArrivals = [{
            id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            semi: actualNeed,
            bz: actualBz
          }]
          
          writePromises.push(
            supabase.from('tasks').insert([{
              id: shop2TaskId,
              order_id: currentCard.order_id,
              step: 'Пресування [ЦЕХ №2]',
              status: 'in-progress',
              planned_sets: s1TaskData.planned_sets || 0,
              estimated_time: s1TaskData.estimated_time || 0,
              engineer_conf: true,
              warehouse_conf: true,
              director_conf: true,
              batch_index: s1TaskData.batch_index || null,
              plan_snapshot: { ...(s1TaskData.plan_snapshot || {}), arrivals: updatedArrivals }
            }])
          )
        }
      } else {
        shop2TaskId = shop2Tasks[0].id
        const existingArrivals = shop2Tasks[0]?.plan_snapshot?.arrivals || []
        updatedArrivals = [...existingArrivals]
        const matchIdx = updatedArrivals.findIndex(a => String(a.id) === String(currentCard.nomenclature_id))
        if (matchIdx >= 0) {
          updatedArrivals[matchIdx] = {
            ...updatedArrivals[matchIdx],
            semi: (Number(updatedArrivals[matchIdx].semi) || 0) + actualNeed,
            bz: (Number(updatedArrivals[matchIdx].bz) || 0) + actualBz
          }
        } else {
          updatedArrivals.push({
            id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            semi: actualNeed,
            bz: actualBz
          })
        }


        writePromises.push(
          supabase.from('tasks').update({
            status: 'in-progress',
            plan_snapshot: {
              ...(shop2Tasks[0].plan_snapshot || {}),
              arrivals: updatedArrivals
            }
          }).eq('id', shop2Tasks[0].id)
        )
      }

      // Rework Card
      if (reworkCount > 0) {
        writePromises.push(
          supabase.from('work_cards').insert([{
            task_id: shop2TaskId || currentCard.task_id,
            order_id: currentCard.order_id,
            nomenclature_id: currentCard.nomenclature_id,
            operation: 'Доопрацювання',
            quantity: reworkCount,
            status: 'new',
            card_info: `[ЦЕХ №2] Автоматично з Сортування`
          }])
        )
      }

      // Inventory writes
      if (invUpdates.length > 0) writePromises.push(supabase.from('inventory').upsert(invUpdates))
      if (invInserts.length > 0) writePromises.push(supabase.from('inventory').insert(invInserts))

      // History writes
      writePromises.push(supabase.from('work_card_history').insert(historyToInsert))

      // Execute all writes in parallel!
      const results = await Promise.all(writePromises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setScrapCount(0)
      setReworkCount(0)
      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
      setIsProcessing(false)
      alert(`✅ ${goodQty} шт відправлено в буфер Цеху №2!`)
    } catch (e) {
      console.error('Sort to shop2 error:', e)
      setIsProcessing(false)
      alert('Помилка сортування: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  // ── ПРИЙНЯТИ НА СКЛАД (з буфера Галтовки → тепер переводить в Прийомку) ─
  const handleAcceptToStock = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = currentCard.quantity || 0
      const op = selectedOperator || currentCard.operator_name || 'Прийомка'
      const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)

      const promises = []

      // 1. Записуємо history запис для Буфера Галтовки (якщо картка в буфері)
      if (currentCard.status === 'at-buffer') {
        const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: 'Буфер Галтовки',
            operator_name: op,
            qty_at_start: qtyDone,
            qty_completed: qtyDone,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: currentCard.shift_name,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        )
      }

      // 2. Записуємо history запис прийомки
      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: 'Прийомка',
          operator_name: op,
          qty_at_start: qtyDone,
          qty_completed: qtyDone,
          scrap_qty: 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: currentCard.shift_name,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine
        }])
      )

      // 3. Картка → at-buffer(Прийомка) — чекає фінального сортування
      promises.push(
        supabase.from('work_cards').update({
          status: 'at-buffer',
          operation: 'Прийомка',
          operator_name: op,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      // Картка тепер у буфері Прийомки — закриваємо її та повертаємось на головний екран
      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      console.error('Acceptance error:', e)
      setIsProcessing(false)
      alert('Помилка прийомки: ' + (e.message || 'Невідома помилка'))
    } finally { setIsProcessing(false) }
  }

  // ── КОРЕКЦІЯ БРАКУ ВІД ВІДДІЛУ ВКЯ ──────────────────────────────────────
  const handleQCScrapOverride = async () => {
    if (!currentCard || qcScrapCount <= 0) return
    if (qcScrapCount > currentCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!')
      return
    }
    setIsProcessing(true)
    try {
      const reasonText = qcReason === 'Інше (коментар)'
        ? `Інше (${qcCustomReason || 'без коментаря'})`
        : qcReason
      const op = `ВКЯ (${qcInspector || 'відповідальний'}) — Причина: ${reasonText}`
      const newQty = Math.max(0, currentCard.quantity - qcScrapCount)

      const promises = []

      // 1. Запис у work_card_history
      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: 'Контроль ВКЯ',
          operator_name: op,
          qty_at_start: currentCard.quantity,
          qty_completed: newQty,
          scrap_qty: qcScrapCount,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_archived_scrap: true, // Одразу переводимо в архівний стан на склад браку
          shift_name: currentCard.shift_name,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine,
          qc_scrap_reason: qcReason,
          qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null
        }])
      )

      // 2. Оновлюємо кількість картки (якщо залишилося 0, закриваємо її)
      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }
      promises.push(
        supabase.from('work_cards').update(updatePayload).eq('id', currentCard.id)
      )

      // 3. Записуємо виявлений брак на склад для класифікації
      promises.push(
        updateInventoryStock(currentCard.nomenclature_id, qcScrapCount, 'scrap_ready')
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setShowQCModal(false)
      setQcScrapCount(0)
      setQcInspector('')
      setQcReason('Биття цанги')
      setQcCustomReason('')
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {})
      if (newQty === 0) {
        setSelectedCardId(null)
        setScannedIds(prev => prev.filter(id => id !== currentCard.id))
      }
      setIsProcessing(false)
      alert(`✅ Успішно списано ${qcScrapCount} шт у брак за рішенням ВКЯ!`)
    } catch (e) {
      console.error('QC error:', e)
      setIsProcessing(false)
      alert('Помилка фіксації браку ВКЯ: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  // ── Статистика по кожному етапу ─────────────────────────────────────────
  const stageStats = stage => {
    const cards = workCards.filter(c => {
      if (c.operation !== stage || !CHAIN.includes(c.operation)) return false
      const nom = getNom(c)
      return !nom || nom.type === 'part'
    })
    return {
      inWork: cards.filter(c => c.status === 'in-progress').reduce((a, c) => a + (c.quantity || 0), 0),
      inBuffer: cards.filter(c => c.status === 'at-buffer').reduce((a, c) => a + (c.quantity || 0), 0),
      scrap: workCardHistory.filter(h => {
        const matchStage = stage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === stage
        if (!matchStage || h.is_archived_scrap) return false
        const nom = nomenclatures.find(n => n.id === h.nomenclature_id)
        return !nom || nom.type === 'part'
      }).reduce((a, h) => a + (Number(h.scrap_qty) || 0), 0),
      total: cards.length
    }
  }

  // ── ПЕРЕМІЩЕННЯ БРАКУ НА СКЛАД (Архівування з етапу) ────────────────────
  const handleArchiveStageScrap = async (stage, nomId) => {
    const unarchivedScrap = workCardHistory.filter(h => (stage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === stage) && String(h.nomenclature_id) === String(nomId) && !h.is_archived_scrap && Number(h.scrap_qty) > 0)
    const totalQty = unarchivedScrap.reduce((acc, h) => acc + Number(h.scrap_qty), 0)

    if (totalQty === 0) return
    setIsProcessing(true)

    try {
      // 1. Оновлюємо інвентар типу 'scrap_ready'
      await updateInventoryStock(nomId, totalQty, 'scrap_ready')

      // 2. Помічаємо history як архівоване
      const idsToMark = unarchivedScrap.map(h => h.id)
      const { error } = await supabase.from('work_card_history').update({ is_archived_scrap: true }).in('id', idsToMark)
      if (error) throw error

      fetchData(['inventory', 'work_card_history']).catch(() => {})
    } catch (err) {
      console.error('Archive scrap error:', err)
      alert('Помилка архівації браку: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Рендер: ліва черга (Преміум-вигляд) ──────────────────────────────────
  const renderQueue = () => {
    const filteredQueueCards = queueCards.filter(card => {
      if (queueFilter === 'all') return true
      if (queueFilter === 'new') return card.status === 'new'
      if (queueFilter === 'at-buffer') return card.status === 'at-buffer'
      return true
    })

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px', scrollbarWidth: 'none' }}>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {filteredQueueCards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Layers size={24} style={{ marginBottom: '10px', opacity: 0.2 }} /><br />
            {queueFilter === 'new' ? 'Немає нових карт' : queueFilter === 'at-buffer' ? 'Немає карт в буфері' : 'Черга порожня'}
          </div>
        )}
        {filteredQueueCards.map(card => {
          const nom = getNom(card)
          const active = selectedCardId === card.id
        const isBuffer = card.status === 'at-buffer'
        const statusColor = isBuffer ? '#f59e0b' : '#3b82f6'
        const statusLabel = isBuffer ? `БУФЕР · ${card.operation}` : `НОВА · ${CHAIN.includes(card.operation) ? card.operation : 'Розкрій'}`

        return (
          <div key={card.id}
            onClick={() => { setSelectedCardId(card.id); setSelectedOperator(''); setIsDrawerOpen(false) }}
            style={{
              background: active ? '#eab308' : '#111',
              color: active ? '#000' : '#fff',
              borderRadius: '16px', padding: '16px', marginBottom: '10px', cursor: 'pointer',
              border: `1px solid ${active ? '#eab308' : '#1a1a1a'}`,
              boxShadow: active ? '0 10px 20px rgba(234,179,8,0.15)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: active ? 'scale(1.02)' : 'scale(1)'
            }}>
            {/* Верхній рядок: Порядковий номер (Зліва) та Номер замовлення (Справа) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              {(() => {
                const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                return seqMatch ? (
                  <span style={{
                    background: active ? 'rgba(0,0,0,0.15)' : '#eab30820',
                    color: active ? '#000' : '#eab308',
                    border: active ? '1px solid rgba(0,0,0,0.15)' : '1px solid #eab30840',
                    padding: '2px 8px', borderRadius: '6px',
                    fontSize: '0.65rem', fontWeight: 950
                  }}>
                    {seqMatch[1]}
                  </span>
                ) : <div />
              })()}
              <div style={{ fontSize: '0.6rem', opacity: active ? 0.7 : 0.4, fontWeight: 600 }}>
                №{orders?.find(o => o.id === card.order_id)?.order_num || ''} · #{card.id.slice(-8).toUpperCase()}
              </div>
            </div>

            {/* Назва деталі (Середина) */}
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '-0.01em', lineHeight: '1.2' }}>
                {nom?.name || 'Деталь'}
              </strong>
            </div>

            {/* Нижня частина: Кількість (Зліва) та Статус/Пріоритет (Справа) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
              {/* Кількість великим шрифтом (Знизу зліва) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 1000, color: active ? '#000' : '#fff', lineHeight: 1 }}>
                  {card.quantity}
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, marginLeft: '3px', opacity: 0.7 }}>шт</span>
                </div>
              </div>

              {/* Статус та пріоритет (Знизу справа) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                <span style={{
                  fontSize: '0.55rem', fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: active ? 'rgba(0,0,0,0.1)' : `${statusColor}15`,
                  color: active ? '#000' : statusColor,
                  padding: '3px 8px', borderRadius: '6px', border: active ? '1px solid rgba(0,0,0,0.1)' : 'none',
                  display: 'inline-block'
                }}>{statusLabel}</span>
                {card.status === 'at-buffer' && card.operation === 'Розкрій' && (() => {
                  const pColors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                  const pNames = { 1: 'ВИСОКИЙ', 2: 'СЕРЕДНІЙ', 3: 'НИЗЬКИЙ' }
                  const pVal = card.galt_priority || 2
                  return (
                    <span style={{
                      fontSize: '0.55rem', fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: active ? 'rgba(0,0,0,0.15)' : `${pColors[pVal]}15`,
                      color: active ? '#000' : pColors[pVal],
                      padding: '3px 8px', borderRadius: '6px',
                      border: active ? '1px solid rgba(0,0,0,0.1)' : `1px solid ${pColors[pVal]}30`,
                      display: 'inline-block'
                    }}>
                      ⚠️ ПРІОР: {pVal}
                    </span>
                  )
                })()}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

  // ── Рендер: вигляд картки (головна область) ──────────────────────────────
  const renderCardView = () => {
    if (!currentCard) return null
    const nom = getNom(currentCard)
    const chainIdx = CHAIN.indexOf(currentCard.operation)
    const next = nextStageFor(currentCard)
    const isFinal = currentCard.operation === CHAIN[CHAIN.length - 1]
    const { status } = currentCard

    const labelStyle = { fontSize: '0.6rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }
    const selectStyle = { width: '100%', background: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }
    const btnPrimary = { background: '#eab308', color: '#000', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '1rem', fontWeight: 1000, cursor: 'pointer' }
    const btnGreen = { background: '#10b981', color: '#fff', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '1rem', fontWeight: 1000, cursor: 'pointer' }

    return (
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        {/* Хлібні крихти ланцюжка */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {CHAIN.map((s, i) => {
            const isCurrent = s === currentCard.operation
            const isDone = i < chainIdx
            return (
              <React.Fragment key={s}>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase',
                  padding: '3px 9px', borderRadius: '5px',
                  background: isCurrent ? '#eab308' : isDone ? '#10b98120' : '#1a1a1a',
                  color: isCurrent ? '#000' : isDone ? '#10b981' : '#333'
                }}>{s}</span>
                {i < CHAIN.length - 1 && <ChevronRight size={10} color="#2a2a2a" />}
              </React.Fragment>
            )
          })}
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {nom?.name || 'Деталь'}
            </h2>
            <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, marginTop: '6px', textTransform: 'uppercase' }}>
              ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} · Картка #{currentCard.id.slice(-8).toUpperCase()} · {(() => {
                const bz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
                const need = Number(currentCard.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(currentCard.quantity) - bz)
                if (bz > 0) return `${currentCard.quantity} шт (${need} + ${bz} БЗ)`
                return `${currentCard.quantity} шт`
              })()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentCard.task_id && (
              <Link
                to="/foreman"
                state={{ taskId: currentCard.task_id }}
                style={{ background: '#3b82f615', border: '1px solid #3b82f640', color: '#3b82f6', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                title="Перейти до батьківського наряду">
                📋 <span className="hide-mobile">НАРЯД</span>
              </Link>
            )}
            <button onClick={() => setShowQCModal(true)}
              style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Внести додатковий брак ВКЯ">
              🛡️ <span className="hide-mobile">БРАК ВКЯ</span>
            </button>
            <button onClick={() => setSelectedCardId(null)}
              style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid #1a1a1a', padding: '25px 20px' }}>

          {/* ── СТАН: NEW → Форма старту ──────────────────────────────────── */}
          {(status === 'new' || (status === 'in-progress' && !CHAIN.includes(currentCard.operation))) && (() => {
            const displayOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
            return (
              <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Акцентована планова кількість */}
                <div style={{ background: '#eab30810', border: '1px solid #eab30830', borderRadius: '18px', padding: '20px', textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>ПЛАНОВА КІЛЬКІСТЬ</div>
                  <div style={{ fontSize: '3rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                    {currentCard.quantity} <small style={{ fontSize: '1rem', opacity: 0.3 }}>шт</small>
                  </div>
                </div>

                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  СТАРТ · {displayOp?.toUpperCase()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={labelStyle}>Майстер (хто пускає в роботу)</label>
                    <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} style={selectStyle}>
                      <option value="">— Оберіть майстра —</option>
                      {getFilteredManagers('Цех №1').map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Зміна</label>
                    <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                      <option value="">— Оберіть зміну —</option>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                      <option value="Зміна 3">Зміна 3</option>
                      <option value="Зміна 4">Зміна 4</option>
                      <option value="Без зміни">Без зміни</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Відповідальний оператор</label>
                    <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                      <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                      {getFilteredOperators('Цех №1', selectedShift, displayOp).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  {displayOp === 'Розкрій' && (
                    <div>
                      <label style={labelStyle}>Верстат / обладнання</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="text" placeholder="Оберіть або введіть тип верстата..."
                          value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                          list="machine-types-list"
                          style={{ ...selectStyle, cursor: 'text', flex: 1 }} />
                        <datalist id="machine-types-list">
                          {MACHINE_TYPES.map(t => <option key={t} value={t} />)}
                        </datalist>
                        <div style={{ position: 'relative', width: '90px' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontWeight: 1000, fontSize: '1.1rem' }}>№</span>
                          <input type="text" placeholder="1-88"
                            value={machineNumber} onChange={e => setMachineNumber(e.target.value)}
                            style={{
                              ...selectStyle, fontSize: '1.2rem', fontWeight: 1000, color: '#eab308',
                              paddingLeft: '32px', width: '100%', cursor: 'text',
                              borderColor: machineNumber ? '#eab308' : '#333'
                            }}
                            onKeyDown={e => {
                              // Якщо натиснуто Enter — це як клік на кнопку START
                              if (e.key === 'Enter' && selectedOperator && selectedShift && !isProcessing && selectedMachine?.trim() && machineNumber?.trim()) {
                                handleStart()
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {(() => {
                    const isStartDisabled = !selectedOperator || !selectedShift || isProcessing || 
                      (displayOp === 'Розкрій' && (!selectedMachine?.trim() || !machineNumber?.trim()))
                    return (
                      <button onClick={handleStart} disabled={isStartDisabled}
                        style={{ ...btnPrimary, marginTop: '10px', height: '64px', fontSize: '1.2rem', opacity: isStartDisabled ? 0.45 : 1 }}>
                        ▶ ВЗЯТИ В РОБОТУ · {displayOp?.toUpperCase()}
                      </button>
                    )
                  })()}
                </div>
              </div>
            )
          })()}

          {/* ── СТАН: IN-PROGRESS або PAUSED (якщо вже в CHAIN) → Таймер + завершити ── */}
          {((status === 'in-progress' || status === 'paused') && CHAIN.includes(currentCard.operation)) && (() => {
            const opName = currentCard.operation?.toUpperCase()
            const isPaused = status === 'paused'
            const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at
            
            const pausedAtStr = currentCard.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
            const pauseReasonStr = currentCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Невідома причина'

            return (
              <div style={{ textAlign: 'center' }}>
                {/* Єдина інфо-плашка: Кількість | Етап | Верстат */}
                <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', background: '#0f0f0f', border: '1px solid #222', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  {/* К-сть */}
                  <div style={{ padding: '10px 20px', textAlign: 'left', borderRight: '1px solid #222' }}>
                    <div style={{ fontSize: '0.5rem', color: isPaused ? '#ef4444' : '#3b82f6', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {isPaused ? 'ЗУПИНЕНО' : 'У РОБОТІ'}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 1000, lineHeight: 1.2 }}>{currentCard.quantity} <small style={{ fontSize: '0.6rem', opacity: 0.35 }}>шт</small></div>
                  </div>
                  {/* Етап */}
                  <div style={{ padding: '10px 20px', textAlign: 'left', borderRight: currentCard.machine ? '1px solid #222' : 'none' }}>
                    <div style={{ fontSize: '0.5rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ЕТАП</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: isPaused ? '#ef4444' : '#3b82f6', lineHeight: 1.2, marginTop: '2px' }}>{opName}</div>
                  </div>
                  {/* Верстат — тільки якщо є */}
                  {currentCard.machine && (
                    <div style={{ padding: '10px 14px', textAlign: 'left', background: isPaused ? 'rgba(239,68,68,0.03)' : '#eab30808', flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.5rem', color: isPaused ? '#ef4444' : '#eab308', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>⚙ ВЕРСТАТ</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isPaused ? '#ef4444' : '#eab308', lineHeight: 1.3, marginTop: '2px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{currentCard.machine}</div>
                    </div>
                  )}
                </div>

                {isPaused ? (
                  // Пауза активна
                  <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '20px', padding: '20px 24px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ⚠️ ВЕРСТАТ ЗУПИНЕНО (ПАУЗА)
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700, marginTop: '6px' }}>
                      Причина: <span style={{ color: '#ef4444' }}>{pauseReasonStr}</span>
                    </div>
                    <div style={{ fontSize: '3rem', fontWeight: 1000, color: '#ef4444', fontFamily: 'monospace', marginTop: '10px', lineHeight: 1 }}>
                      {formatTime(pausedAtStr)}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px' }}>
                      ТРИВАЛІСТЬ ЗУПИНКИ
                    </div>
                  </div>
                ) : (
                  // Робочий хід
                  <div>
                    <div style={{ fontSize: '4.5rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.05em' }}>
                      {formatSec(getCardTimeMetrics(currentCard).totalSec)}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', opacity: 0.8 }}>
                      ЗАГАЛЬНИЙ ЧАС НА ЕТАПІ
                    </div>
                  </div>
                )}

                {/* Поточний оператор та його особистий таймер */}
                <div style={{ 
                  margin: '20px auto 10px', 
                  padding: '12px 20px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid #222', 
                  borderRadius: '16px', 
                  maxWidth: '380px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ color: '#555', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>ПОТОЧНИЙ ОПЕРАТОР</div>
                    <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 900, marginTop: '2px' }}>{currentCard.operator_name || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#555', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      {isPaused ? 'АКТИВНИЙ ЧАС' : 'ЧАС ЗМІНИ'}
                    </div>
                    <div style={{ color: isPaused ? '#666' : '#eab308', fontSize: '1.1rem', fontWeight: 900, fontFamily: 'monospace', marginTop: '2px' }}>
                      {isPaused ? formatSec(getCardTimeMetrics(currentCard).totalSec) : formatTime(currentCard.started_at)}
                    </div>
                  </div>
                </div>

                {/* Список усіх попередніх операторів перезмінки та їх часу роботи */}
                {currentCard.operation === 'Розкрій' && (() => {
                  // Визначаємо початок поточного запуску етапу
                  const stageRunStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1]
                    || currentCard.started_at
                  const stageRunStartMs = stageRunStart ? new Date(stageRunStart).getTime() : 0

                  const shiftHistory = (workCardHistory || []).filter(h =>
                    String(h.card_id) === String(currentCard.id) &&
                    h.stage_name === 'Розкрій (перезмінка)' &&
                    // Тільки перезмінки поточного запуску (не старі з попередніх запусків)
                    h.completed_at && new Date(h.completed_at).getTime() >= stageRunStartMs
                  ).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
                  if (shiftHistory.length === 0) return null

                  const formatMsToDuration = (start, end) => {
                    const diffSec = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000))
                    const hrs = Math.floor(diffSec / 3600)
                    const mins = Math.floor((diffSec % 3600) / 60)
                    const secs = diffSec % 60
                    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':')
                  }

                  return (
                    <div style={{ margin: '15px auto 0', maxWidth: '380px', background: '#09090b', border: '1px solid #18181b', borderRadius: '16px', padding: '14px 18px' }}>
                      <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em', textAlign: 'left' }}>
                        ⏱️ ЧАС ПОПЕРЕДНІХ ЗМІН
                      </div>
                      {shiftHistory.map((h, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < shiftHistory.length - 1 ? '1px solid #18181b' : 'none' }}>
                          <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 700 }}>#{i + 1} {h.operator_name}</span>
                            <span style={{ fontSize: '0.6rem', color: '#52525b', fontWeight: 700, marginLeft: '8px' }}>{h.shift_name}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 800, fontFamily: 'monospace' }}>
                            {formatMsToDuration(h.started_at, h.completed_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div style={{ marginBottom: '25px' }} />

                {/* Стрілка куди піде картка */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '25px', background: '#f59e0b0d', border: '1px solid #f59e0b22', borderRadius: '14px', padding: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700 }}>{currentCard.operation}</span>
                  <ArrowRight size={12} color="#f59e0b" />
                  <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: '#000', fontWeight: 900, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                    БУФЕР {currentCard.operation?.toUpperCase()}
                  </span>
                  {!isFinal && (
                    <>
                      <ArrowRight size={12} color="#444" />
                      <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>{next}</span>
                    </>
                  )}
                </div>

                {isPaused ? (
                  // Якщо верстат на паузі: тільки кнопка запуску
                  <button
                    onClick={handleResumeCard}
                    disabled={isProcessing}
                    style={{
                      background: '#10b981',
                      color: '#000',
                      border: 'none',
                      padding: '20px',
                      width: '100%',
                      borderRadius: '18px',
                      fontSize: '1.25rem',
                      fontWeight: 1000,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(16,185,129,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    ▶️ ЗАПУСТИТИ ВЕРСТАТ (ПРОДОВЖИТИ)
                  </button>
                ) : (
                  // Якщо верстат у роботі: Перезмінка, Зупинити верстат, Завершити розкрій
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {currentCard.operation === 'Розкрій' && (
                        <button
                          onClick={() => {
                            setShiftChangeOperator('')
                            setShiftChangeShift('')
                            setShowShiftChangeModal(true)
                          }}
                          style={{
                            background: 'transparent',
                            color: '#f59e0b',
                            border: '2px solid #f59e0b40',
                            padding: '14px',
                            borderRadius: '14px',
                            fontSize: '0.9rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          🔄 ПЕРЕЗМІНКА
                        </button>
                      )}
                      {currentCard.operation === 'Розкрій' && (
                        <button
                          onClick={() => {
                            setPauseReason('Поломка верстата')
                            setCustomPauseReason('')
                            setShowPauseModal(true)
                          }}
                          style={{
                            background: 'transparent',
                            color: '#ef4444',
                            border: '2px solid #ef444440',
                            padding: '14px',
                            borderRadius: '14px',
                            fontSize: '0.9rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          🛑 ЗУПИНИТИ ВЕРСТАТ (ПАУЗА)
                        </button>
                      )}
                    </div>

                    <button onClick={() => {
                      if (currentCard.operation === 'Сортування') {
                        setScrapCount(0);
                        setReworkCount(0);
                        setShowSortingModal(true);
                      } else {
                        setScrapCount(0);
                        setFinalOperator('');
                        setCuttersUsed(0);
                        setShowCompleteModal(true);
                      }
                    }}
                      style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '22px', width: '100%', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 1000, cursor: 'pointer', boxShadow: '0 10px 30px rgba(139,92,246,0.3)' }}>
                      {currentCard.operation === 'Сортування' ? '🚀 ЗАВЕРШИТИ СОРТУВАННЯ → ЦЕХ №2' : isFinal ? '✓ ПРИЙНЯТО' : `ЗАВЕРШИТИ ${opName}`}
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── СТАН: AT-BUFFER(Сортування) → Відправити в Цех №2 ─────────── */}
          {status === 'at-buffer' && currentCard.operation === 'Сортування' && (() => {
            return (
              <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div style={{ background: '#8b5cf610', border: '1px solid #8b5cf630', borderRadius: '24px', padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                    🔵 СОРТУВАННЯ — ГОТОВО ДО ВІДПРАВКИ В ЦЕХ №2
                  </div>
                  <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                    {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '8px', fontWeight: 700 }}>
                    Відскануйте картку для підтвердження сортування
                  </div>
                </div>

                {/* Лічильник браку при сортуванні */}
                <div style={{ background: '#0d0d0d', borderRadius: '20px', padding: '20px', textAlign: 'center', border: '1px solid #ef444422' }}>
                  <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                    КІЛЬКІСТЬ БРАКУ ПРИ СОРТУВАННІ
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                    <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                      style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                    <input type="number" min={0} max={currentCard.quantity - reworkCount} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                      onChange={e => {
                        const val = e.target.value;
                        setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - reworkCount, parseInt(val) || 0)))
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                    <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity - reworkCount, v + 1))}
                      style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                  </div>
                </div>

                {/* Лічильник доопрацювання при сортуванні */}
                <div style={{ background: '#0d0d0d', borderRadius: '20px', padding: '20px', textAlign: 'center', border: '1px solid #f59e0b22' }}>
                  <label style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                    КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                    <button onClick={() => setReworkCount(v => Math.max(0, v - 1))}
                      style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                    <input type="number" min={0} max={currentCard.quantity - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                      onChange={e => {
                        const val = e.target.value;
                        setReworkCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - scrapCount, parseInt(val) || 0)))
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                    <button onClick={() => setReworkCount(v => Math.min(currentCard.quantity - scrapCount, v + 1))}
                      style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                  </div>
                </div>

                <div style={{ background: '#0d0d0d', borderRadius: '20px', padding: '15px', textAlign: 'center', border: '1px solid #10b98122' }}>
                  <div style={{ fontSize: '0.72rem', color: '#555' }}>
                    Добре (в буфер): <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - scrapCount - reworkCount)} шт</strong>
                    {' · '}Доопрацювання: <strong style={{ color: '#f59e0b' }}>{reworkCount} шт</strong>
                    {' · '}Брак: <strong style={{ color: '#ef4444' }}>{scrapCount} шт</strong>
                  </div>
                </div>

                <div style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #8b5cf622' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={labelStyle}>Зміна</label>
                    <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                      <option value="">— Оберіть зміну —</option>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                      <option value="Зміна 3">Зміна 3</option>
                      <option value="Зміна 4">Зміна 4</option>
                      <option value="Без зміни">Без зміни</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Відповідальний за сортування</label>
                    <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                      <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                      {getFilteredOperators('Сортування', selectedShift, 'Сортування').map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <button onClick={handleSortToShop2} disabled={!selectedOperator || !selectedShift || isProcessing}
                    style={{
                      background: '#8b5cf6', color: '#fff', border: 'none', width: '100%',
                      height: '64px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 1000,
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: '0 10px 30px rgba(139,92,246,0.3)',
                      opacity: (!selectedOperator || isProcessing) ? 0.5 : 1
                    }}>
                    🚀 {isProcessing ? 'ВІДПРАВКА...' : 'ВІДПРАВИТИ В БУФЕР ЦЕХУ №2'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.65rem', color: '#444', fontWeight: 600 }}>
                    Картка зникне з черги Цеху №1 і з'явиться у начальника Цеху №2
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── СТАН: AT-BUFFER (інші) → Прийняти або взяти в наступний етап ── */}
          {status === 'at-buffer' && currentCard.operation !== 'Сортування' && (() => {
            const isLastBeforeReception = nextStageFor(currentCard) === 'Прийомка'
            const nextOp = nextStageFor(currentCard)
            return (
              <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

                {/* Великий бейдж кількості в буфері */}
                <div style={{ background: (isLastBeforeReception || currentCard.operation === 'Прийомка') ? '#10b98110' : '#f59e0b10', border: `1px solid ${(isLastBeforeReception || currentCard.operation === 'Прийомка') ? '#10b98130' : '#f59e0b30'}`, borderRadius: '24px', padding: '24px', textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 950, color: (isLastBeforeReception || currentCard.operation === 'Прийомка') ? '#10b981' : '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                    {currentCard.operation === 'Прийомка' ? 'В ПРИЙОМЦІ (ОЧІКУЄ СОРТУВАННЯ)' : isLastBeforeReception ? 'ГОТОВО ДО ПРИЙОМКИ' : `В БУФЕРІ: ${currentCard.operation?.toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                    {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                  </div>
                  <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: (isLastBeforeReception || currentCard.operation === 'Прийомка') ? '#10b981' : '#f59e0b', fontFamily: 'monospace', lineHeight: 1 }}>
                      {formatTime(currentCard.completed_at || currentCard.started_at)}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.05em' }}>
                      ЧАС У БУФЕРІ
                    </div>
                  </div>
                </div>

                {/* Відображення пріоритету галтовки для карток у буфері розкрою */}
                {currentCard.operation === 'Розкрій' && (() => {
                  const pColors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                  const pNames = { 1: 'ВИСОКИЙ ПРІОРИТЕТ', 2: 'СЕРЕДНІЙ ПРІОРИТЕТ', 3: 'НИЗЬКИЙ ПРІОРИТЕТ' }
                  const pVal = currentCard.galt_priority || 2
                  return (
                    <div style={{
                      background: `${pColors[pVal]}10`,
                      border: `1px solid ${pColors[pVal]}30`,
                      borderRadius: '16px',
                      padding: '16px',
                      textAlign: 'center',
                      color: pColors[pVal],
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      letterSpacing: '0.5px'
                    }}>
                      ⚠️ ПРІОРИТЕТ ГАЛТОВКИ: {pVal} — {pNames[pVal]}
                    </div>
                  )
                })()}

                {/* Прийомка: кнопка переводить в at-buffer(Прийомка) */}
                {isLastBeforeReception ? (
                  <div style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #10b98122' }}>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={labelStyle}>Зміна</label>
                      <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                        <option value="">— Оберіть зміну —</option>
                        <option value="Зміна 1">Зміна 1</option>
                        <option value="Зміна 2">Зміна 2</option>
                        <option value="Зміна 3">Зміна 3</option>
                        <option value="Зміна 4">Зміна 4</option>
                        <option value="Без зміни">Без зміни</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={labelStyle}>Відповідальний за прийомку</label>
                      <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                        <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                        {getFilteredOperators('Прийомка', selectedShift, 'Прийомка').map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <button onClick={handleAcceptToStock} disabled={!selectedOperator || !selectedShift || isProcessing}
                      style={{
                        background: '#10b981', color: '#fff', border: 'none', width: '100%',
                        height: '64px', borderRadius: '16px', fontSize: '1.3rem', fontWeight: 1000,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 10px 30px rgba(16,185,129,0.2)',
                        opacity: (!selectedOperator || isProcessing) ? 0.5 : 1
                      }}>
                      ✅ ВІДПРАВИТИ В ПРИЙОМКУ
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.65rem', color: '#444', fontWeight: 600 }}>
                      Картка перейде в Прийомку, де її відсканують для взяття в роботу на Сортування
                    </div>
                  </div>
                ) : (
                  /* Попередні етапи (Розкрій → Галтовка) — звичайний перехід */
                  <div style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #222' }}>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, marginBottom: '20px', textTransform: 'uppercase', textAlign: 'center' }}>
                      НАСТУПНИЙ ЕТАП: <span style={{ color: '#f59e0b' }}>{nextOp}</span>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                      <label style={labelStyle}>Зміна</label>
                      <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                        <option value="">— Оберіть зміну —</option>
                        <option value="Зміна 1">Зміна 1</option>
                        <option value="Зміна 2">Зміна 2</option>
                        <option value="Зміна 3">Зміна 3</option>
                        <option value="Зміна 4">Зміна 4</option>
                        <option value="Без зміни">Без зміни</option>
                      </select>
                    </div>

                     {!nextOp?.startsWith('Галтовка') && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Відповідальний за {nextOp}</label>
                        <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                          <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                          {getFilteredOperators('Цех №1', selectedShift, nextOp).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )}

                    <button onClick={handleStartNext} disabled={((nextOp?.startsWith('Галтовка') ? !selectedShift : !selectedOperator) || isProcessing)}
                      style={{
                        ...btnGreen, width: '100%', height: '64px', fontSize: '1.2rem',
                        opacity: ((nextOp?.startsWith('Галтовка') ? !selectedShift : !selectedOperator) || isProcessing) ? 0.5 : 1
                      }}>
                      ▶ ВЗЯТИ В {nextOp?.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            )
          })()}


        </div>
      </div>
    )
  }

  // ── Рендер: Експорер складу (СЕНСОРНИЙ РЕЖИМ) ───────────────────────────
  const renderStorageExplorer = () => {
    const explorerTabs = [
      { id: 'reception', label: 'ПРИЙОМКА', icon: <Package size={16} />, color: '#3b82f6' },
      { id: 'sorting', label: 'СОРТУВАННЯ', icon: <ClipboardList size={16} />, color: '#8b5cf6' },
      { id: 'scrap', label: 'БРАК / ВІДХОДИ', icon: <AlertTriangle size={16} />, color: '#ef4444' },
    ]

    let filteredItems = []

    if (activeExplorerTab === 'reception') {
      // Get cards at operation 'Прийомка' in status 'at-buffer' or 'in-progress'
      const receptionCards = (workCards || []).filter(c => {
        const nom = getNom(c)
        if (nom && nom.type && nom.type !== 'part') return false
        return c.operation === 'Прийомка' && (c.status === 'at-buffer' || c.status === 'in-progress')
      })
      // Group by nomenclature
      const grouped = receptionCards.reduce((acc, card) => {
        const nomId = card.nomenclature_id
        if (!acc[nomId]) {
          const nom = nomenclatures.find(n => n.id === nomId)
          acc[nomId] = {
            id: `reception-${nomId}`,
            nomenclature_id: nomId,
            name: nom?.name || '—',
            unit: nom?.unit || 'од',
            total_qty: 0,
            updated_at: card.updated_at || card.created_at || new Date().toISOString(),
            type: 'reception'
          }
        }
        acc[nomId].total_qty += Number(card.quantity) || 0
        const cardTime = new Date(card.updated_at || card.created_at || 0)
        if (cardTime > new Date(acc[nomId].updated_at)) {
          acc[nomId].updated_at = card.updated_at || card.created_at
        }
        return acc
      }, {})
      filteredItems = Object.values(grouped)
    } else if (activeExplorerTab === 'sorting') {
      // Get cards at operation 'Сортування' in status 'at-buffer' or 'in-progress'
      const sortingCards = (workCards || []).filter(c => {
        const nom = getNom(c)
        if (nom && nom.type && nom.type !== 'part') return false
        return c.operation === 'Сортування' && (c.status === 'at-buffer' || c.status === 'in-progress')
      })
      // Group by nomenclature
      const grouped = sortingCards.reduce((acc, card) => {
        const nomId = card.nomenclature_id
        if (!acc[nomId]) {
          const nom = nomenclatures.find(n => n.id === nomId)
          acc[nomId] = {
            id: `sorting-${nomId}`,
            nomenclature_id: nomId,
            name: nom?.name || '—',
            unit: nom?.unit || 'од',
            total_qty: 0,
            updated_at: card.updated_at || card.created_at || new Date().toISOString(),
            type: 'sorting'
          }
        }
        acc[nomId].total_qty += Number(card.quantity) || 0
        const cardTime = new Date(card.updated_at || card.created_at || 0)
        if (cardTime > new Date(acc[nomId].updated_at)) {
          acc[nomId].updated_at = card.updated_at || card.created_at
        }
        return acc
      }, {})
      filteredItems = Object.values(grouped)
    } else {
      filteredItems = (inventory || []).filter(i => {
        const nom = nomenclatures.find(n => n.id === i.nomenclature_id)
        if (nom && nom.type && nom.type !== 'part') return false
        return i.type === activeExplorerTab
      })
    }

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0a', display: 'flex', flexDirection: 'column', paddingHeight: '100%', paddingTop: '75px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#3b82f620', padding: '8px', borderRadius: '10px' }}><Package size={20} color="#3b82f6" /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 1000 }}>ХАБ-СКЛАД ЦЕХУ 1</h2>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Моніторинг деталей на прийомці, сортуванні та складі</div>
            </div>
          </div>
          <button onClick={() => setShowStorageExplorer(false)} style={{ background: '#1a1a1a', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '15px 20px', background: '#0d0d0d', overflowX: 'auto' }}>
          {explorerTabs.map(t => (
            <button key={t.id} onClick={() => setActiveExplorerTab(t.id)}
              style={{
                flex: 1, minWidth: '110px', background: activeExplorerTab === t.id ? t.color : '#0a0a0a',
                color: activeExplorerTab === t.id ? '#000' : '#444', border: 'none',
                padding: '12px', borderRadius: '12px', fontWeight: 900, fontSize: '0.65rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s', cursor: 'pointer'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeExplorerTab === 'scrap' && filteredItems.filter(i => Number(i.total_qty) > 0).length > 0 && (
          <div style={{ padding: '0 20px 20px' }}>
            <button
              onClick={async () => {
                const scrapItemsToMove = filteredItems.filter(i => Number(i.total_qty) > 0)
                if (!window.confirm(`Перенести всі позиції (${scrapItemsToMove.length}) у розділ БРАК?`)) return
                setIsBulkMoving(true)
                try {
                  await Promise.all(scrapItemsToMove.map(async (item) => {
                    // Find matching unarchived history rows for this nomenclature
                    const { data: historyToArchive } = await supabase.from('work_card_history')
                      .select('id')
                      .eq('nomenclature_id', item.nomenclature_id)
                      .eq('is_archived_scrap', false)
                      .gt('scrap_qty', 0);
                      
                    if (historyToArchive && historyToArchive.length > 0) {
                      await supabase.from('work_card_history')
                        .update({ is_archived_scrap: true })
                        .in('id', historyToArchive.map(h => h.id));
                    }
                    
                    // Delete the local shop inventory record since it's now in Isolator
                    await supabase.from('inventory').delete().eq('id', item.id);
                  }))
                  fetchData('inventory').catch(() => {})
                } catch (e) { alert('Помилка: ' + e.message) }
                finally { setIsBulkMoving(false) }
              }}
              disabled={isBulkMoving}
              style={{
                width: '100%', background: '#ef4444', color: '#000', border: 'none',
                padding: '16px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 1000,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '10px', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.2)'
              }}>
              <AlertTriangle size={18} /> {isBulkMoving ? 'ПЕРЕНЕСЕННЯ...' : `ПЕРЕНЕСТИ ВСІ ПОЗИЦІЇ (${filteredItems.filter(i => Number(i.total_qty) > 0).length}) В РОЗДІЛ БРАК`}
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {Object.values(filteredItems.reduce((acc, item) => {
              if (!acc[item.nomenclature_id]) {
                acc[item.nomenclature_id] = { ...item }
              } else {
                acc[item.nomenclature_id].total_qty = (Number(acc[item.nomenclature_id].total_qty) || 0) + (Number(item.total_qty) || 0)
                if (new Date(item.updated_at) > new Date(acc[item.nomenclature_id].updated_at)) {
                  acc[item.nomenclature_id].updated_at = item.updated_at
                }
              }
              return acc
            }, {})).filter(item => Number(item.total_qty) > 0).map(item => {
              const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
              return (
                <div key={item.id} style={{ background: '#111', borderRadius: '18px', padding: '18px', border: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '2px' }}>{nom?.name || item.name}</div>
                      <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900 }}>{item.unit || 'од'} | {new Date(item.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: explorerTabs.find(t => t.id === activeExplorerTab).color }}>{item.total_qty}</div>
                      <div style={{ fontSize: '0.5rem', color: '#333', fontWeight: 900 }}>
                        {activeExplorerTab === 'reception' ? 'В ПРИЙОМЦІ' : activeExplorerTab === 'sorting' ? 'СОРТУВАННЯ' : 'ЗАЛИШОК'}
                      </div>
                    </div>
                  </div>

                  {item.type === 'scrap' && (
                    <button
                      onClick={async () => {
                        setMovingScrapIds(prev => new Set([...prev, item.id]))
                        try {
                          // Find matching unarchived history rows for this nomenclature
                          const { data: historyToArchive } = await supabase.from('work_card_history')
                            .select('id')
                            .eq('nomenclature_id', item.nomenclature_id)
                            .eq('is_archived_scrap', false)
                            .gt('scrap_qty', 0);
                            
                          if (historyToArchive && historyToArchive.length > 0) {
                            await supabase.from('work_card_history')
                              .update({ is_archived_scrap: true })
                              .in('id', historyToArchive.map(h => h.id));
                          }
                          
                          // Delete local inventory record
                          await supabase.from('inventory').delete().eq('id', item.id);
                          fetchData('inventory').catch(() => {})
                        } catch (e) { alert('Помилка: ' + e.message) }
                        finally { setMovingScrapIds(prev => { const next = new Set(prev); next.delete(item.id); return next }) }
                      }}
                      disabled={movingScrapIds.has(item.id) || isBulkMoving}
                      style={{
                        width: '100%', background: '#ef444415', border: '1px solid #ef444430',
                        color: '#ef4444', padding: '10px', borderRadius: '10px',
                        fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        opacity: (movingScrapIds.has(item.id) || isBulkMoving) ? 0.5 : 1
                      }}>
                      {movingScrapIds.has(item.id) ? 'Перенесення...' : '⚡ ПЕРЕНЕСТИ В РОЗДІЛ БРАК'}
                    </button>
                  )}
                </div>
              )
            })}
            {filteredItems.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#222' }}>
                <Package size={48} style={{ marginBottom: '15px', opacity: 0.1 }} />
                <div style={{ fontWeight: 800 }}>ПОЗИЦІЙ НЕ ЗНАЙДЕНО</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Рендер: дашборд (без вибраної картки) ───────────────────────────────
  const renderDashboard = () => (
    <div style={{ maxWidth: '1050px', margin: '0 auto' }}>

      {/* Шапка */}
      <style>{`
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
        }
      `}</style>

      {/* Floating Controls (Search and Scan QR) */}
      <div className="floating-controls-container">
        {/* Floating Search Form */}
        <form onSubmit={handleManualEntry} style={{
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
          <button type="submit" disabled={isProcessing} style={{ background: '#eab308', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        {/* Floating Round QR Scan Button */}
        <button onClick={() => setIsScanning(true)}
          className="hover-lift"
          style={{ 
            background: '#eab308', 
            border: 'none', 
            color: '#000', 
            width: '64px',
            height: '64px',
            borderRadius: '50%', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(234,179,8,0.4)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}>
          <QrCode size={32} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>ЦЕХ №1</h2>
          <p style={{ margin: '3px 0 0', color: '#333', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Розкрій → Буфер → Галтовка → Буфер → Прийомка
          </p>
        </div>
      </div>

      {/* Ланцюжок з буферами + сток Прийомки (GRID LAYOUT) */}
      <div className="stages-grid-responsive" style={{
        display: 'grid',
        gap: '12px',
        marginBottom: '36px',
        alignItems: 'stretch'
      }}>
        {['Розкрій', 'Галтовка'].map((stage, idx) => {
          const s = stageStats(stage)
          return (
            <React.Fragment key={stage}>
              <div onClick={() => { setDetailStage(stage); setDetailTab('work') }}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #222',
                  borderTop: `4px solid ${idx === 0 ? '#3b82f6' : '#f59e0b'}`,
                  borderRadius: '20px', padding: '20px 16px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  gridArea: `stage${idx + 1}`
                }}
                className="s1-stage-card s1-stage-hover">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 1000, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{stage}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.inWork > 0 ? '#10b981' : '#222', boxShadow: s.inWork > 0 ? '0 0 8px #10b981' : 'none' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                  {[
                    { label: 'РОБОТА', val: s.inWork, color: '#3b82f6' },
                    { label: 'БУФЕР', val: s.inBuffer, color: '#f59e0b' },
                  ].map(({ label, val, color }, li) => (
                    <div key={label} style={li > 0 ? { borderLeft: '1px solid #111', paddingLeft: '8px' } : {}}>
                      <div style={{ fontSize: '0.55rem', color: '#333', fontWeight: 1000, marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{
                        fontSize: '1.4rem', fontWeight: 1000, letterSpacing: '-0.02em',
                        color: val > 0 ? color : '#1a1a1a'
                      }}>
                        {val}<small style={{ fontSize: '0.45rem', opacity: 0.2, marginLeft: '1px' }}>шт</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Буфер між етапами або перехід до складу (Arrow) */}
              <div
                className={`hide-mobile`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  gridArea: `arrow${idx + 1}`
                }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '2px', background: s.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#222' }} />
                  <ChevronRight size={14} color={s.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#222'} />
                </div>
                <div style={{
                  marginTop: '5px', fontSize: '0.46rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                  background: s.inBuffer > 0 ? `${idx === 0 ? '#f59e0b20' : '#10b98120'}` : '#1a1a1a', color: s.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#2a2a2a'
                }}>
                  {s.inBuffer > 0 ? `${s.inBuffer} шт` : (idx === 0 ? 'БУФЕР' : 'СКЛАД')}
                </div>
              </div>
            </React.Fragment>
          )
        })}

        {/* ─── ПРИЙОМКА / СКЛАД (Фінальна стадія) ─── */}
        {(() => {
          // Картки на Сортуванні / Прийомці = фізично знаходяться в Прийомці
          const sortingCards = (workCards || []).filter(c => {
            const nom = getNom(c)
            if (nom && nom.type && nom.type !== 'part') return false
            return (c.status === 'at-buffer' && (c.operation === 'Прийомка' || c.operation === 'Сортування')) ||
                   (c.status === 'in-progress' && c.operation === 'Сортування')
          })
          const sortingQty = sortingCards.reduce((a, c) => a + (Number(c.quantity) || 0), 0)

          const receptionCards = sortingCards.filter(c => c.operation === 'Прийомка')
          const realSortingCards = sortingCards.filter(c => c.operation === 'Сортування')
          const receptionQty = receptionCards.reduce((a, c) => a + (Number(c.quantity) || 0), 0)
          const realSortingQty = realSortingCards.reduce((a, c) => a + (Number(c.quantity) || 0), 0)

          // Інвентар складу НФ (вже прийняті на склад)
          const semiQty = (inventory || []).filter(i => {
            if (i.type !== 'semi' || i.nomenclature_id === null || i.nomenclature_id === undefined) return false
            const nom = nomenclatures.find(n => n.id === i.nomenclature_id)
            return !nom || nom.type === 'part'
          }).reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

          const bzQty = (inventory || []).filter(i => {
            if (i.type !== 'bz' && i.type !== 'wip_bz') return false
            const nom = nomenclatures.find(n => n.id === i.nomenclature_id)
            return !nom || nom.type === 'part'
          }).reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

          const scrapQty = (inventory || []).filter(i => {
            if (i.type !== 'scrap') return false
            const nom = nomenclatures.find(n => n.id === i.nomenclature_id)
            return !nom || nom.type === 'part'
          }).reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

          const isActive = sortingQty > 0
          const cardColor = '#10b981'

          return (
            <div onClick={() => setShowStorageExplorer(true)}
              style={{
                background: 'linear-gradient(145deg, #0d1a15 0%, #050a08 100%)',
                border: '1px solid #10b98130',
                borderTop: '4px solid #10b981',
                borderRadius: '20px', padding: '20px 16px', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                gridArea: 'storage'
              }}
              className="s1-stage-card-storage s1-stage-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 1000, color: cardColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>ХАБ-СКЛАД ЦЕХУ 1</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isActive && (
                    <div style={{
                      background: cardColor, color: '#000',
                      padding: '2.5px 8px', borderRadius: '6px',
                      fontSize: '0.52rem', fontWeight: 950, letterSpacing: '0.5px'
                    }}>
                      АКТИВНО
                    </div>
                  )}
                  <ClipboardList size={14} color={cardColor} style={{ opacity: 0.5 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                {[
                  { label: 'ПРИЙОМКА', val: receptionQty, color: '#3b82f6' },
                  { label: 'СОРТУВАННЯ', val: realSortingQty, color: '#8b5cf6' },
                ].map(({ label, val, color }, i) => (
                  <div key={label} style={i > 0 ? { borderLeft: '1px solid #111', paddingLeft: '6px' } : {}}>
                    <div style={{ fontSize: '0.45rem', color: '#333', fontWeight: 1000, marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{
                      fontSize: '1.2rem', fontWeight: 1000, letterSpacing: '-0.02em',
                      color: val > 0 ? color : '#1a1a1a'
                    }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

      </div>

      {/* Таблиця активних карток */}
      <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
        <div style={{ padding: '20px 25px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSyncing && <div style={{ fontSize: '0.7rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}><RefreshCw className="spin-s1" size={12} /> Оновлення...</div>}
            {/* Кнопки фільтру */}
            {[['all', 'ВСІ'], ['in-progress', '▶ РОБОТА'], ['at-buffer', '■ БУФЕР']].map(([val, label]) => (
              <button key={val} onClick={() => setActiveTableFilter(val)} style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.04em',
                transition: 'all 0.15s',
                background: activeTableFilter === val
                  ? (val === 'in-progress' ? '#3b82f6' : val === 'at-buffer' ? '#f59e0b' : '#fff')
                  : '#1a1a1a',
                color: activeTableFilter === val
                  ? (val === 'all' ? '#000' : '#fff')
                  : '#555',
                boxShadow: activeTableFilter === val ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxWidth: '100%', border: 'none', borderRadius: 0, width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 14px' }}>ДАТА І ЧАС</th>
                <th style={{ padding: '12px 14px' }}>ДЕТАЛЬ</th>
                <th style={{ padding: '12px 14px' }}>ЕТАП</th>
                <th style={{ padding: '12px 14px' }}>СТАТУС</th>
                <th style={{ padding: '12px 14px' }}>К-СТЬ</th>
                <th style={{ padding: '12px 14px' }}>ЗМІНА</th>
                <th style={{ padding: '12px 14px' }}>ОПЕРАТОР</th>
                <th style={{ padding: '12px 14px' }}>ВЕРСТАТ</th>
                <th style={{ padding: '12px 14px', color: '#10b981' }}>ЗАГАЛЬНИЙ ЧАС</th>
                <th style={{ padding: '12px 14px', color: '#eab308' }}>ЧАС ЗМІНИ</th>
                <th style={{ padding: '12px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const activeCards = workCards.filter(c => {
                  const nom = getNom(c)
                  if (nom && nom.type && nom.type !== 'part') return false

                  const info = String(c.card_info || '')
                  if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false

                  const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
                  if (parentTask) {
                    if (parentTask.status === 'completed') return false
                    if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false
                  }

                  if (!CHAIN.includes(c.operation)) return false
                  if (c.status !== 'in-progress' && c.status !== 'at-buffer') return false
                  if (activeTableFilter === 'in-progress' && c.status !== 'in-progress') return false
                  if (activeTableFilter === 'at-buffer' && c.status !== 'at-buffer') return false
                  return true
                }).sort((a, b) => getCardStartDate(b).getTime() - getCardStartDate(a).getTime())

                if (activeCards.length === 0) {
                  return (
                    <tr><td colSpan={12} style={{ padding: '50px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>Немає активних карток</td></tr>
                  )
                }

                const grouped = { 'Розкрій': [], 'Галтовка': [], 'Прийомка': [], 'Сортування': [] }
                activeCards.forEach(card => {
                  const groupKey = card.operation?.startsWith('Галтовка') ? 'Галтовка' : card.operation
                  if (grouped[groupKey]) grouped[groupKey].push(card)
                })

                const rows = []
                const renderCardRow = (card) => {
                  const inBuf = card.status === 'at-buffer'
                  const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                  const cardSeq = seqMatch ? seqMatch[1] : ''
                  return (
                    <tr key={card.id} 
                      onClick={() => { setSelectedCardId(card.id); setSelectedOperator('') }}
                      style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const parts = formatDateTimeParts(getCardStartDate(card));
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#aaa' }}>{parts.date}</span>
                              {parts.time && <span style={{ fontSize: '0.65rem', color: '#777' }}>{parts.time}</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {cardSeq && (
                            <span style={{ 
                              background: '#eab30815', 
                              color: '#eab308', 
                              padding: '2px 6px', 
                              borderRadius: '6px', 
                              fontSize: '0.65rem', 
                              fontWeight: 900,
                              border: '1px solid #eab30830'
                            }}>
                              {cardSeq}
                            </span>
                          )}
                          <span>{getNom(card)?.name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>{card.operation}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase',
                            background: (inBuf && card.operation === 'Сортування') ? '#8b5cf618' : inBuf ? '#f59e0b18' : '#3b82f618',
                            color: (inBuf && card.operation === 'Сортування') ? '#8b5cf6' : inBuf ? '#f59e0b' : '#3b82f6',
                            padding: '4px 10px', borderRadius: '6px',
                            whiteSpace: 'nowrap'
                          }}>
                            {(inBuf && card.operation === 'Сортування') ? '🟣 БУФЕР' : inBuf ? '▣ БУФЕР' : '▶ РОБОТА'}
                          </span>
                          {inBuf && card.operation === 'Розкрій' && (() => {
                            const pColors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                            const pVal = card.galt_priority || 2
                            return (
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 900,
                                background: `${pColors[pVal]}15`,
                                color: pColors[pVal],
                                padding: '4px 8px', borderRadius: '6px',
                                border: `1px solid ${pColors[pVal]}30`,
                                whiteSpace: 'nowrap'
                              }}>
                                Пр. {pVal}
                              </span>
                            )
                          })()}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 900 }}>{card.quantity} шт</td>
                      <td style={{ padding: '10px 14px', color: '#888' }}>{card.shift_name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#eab308', fontWeight: 800 }}>{formatMachine(card.machine)}</td>
                      <td style={{ padding: '10px 14px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>
                        {formatSec(getCardTimeMetrics(card).totalSec)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#eab308', fontFamily: 'monospace', fontWeight: 700 }}>
                        {formatSec(getCardTimeMetrics(card).currentSec)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); setSelectedOperator('') }}
                          style={{ background: '#eab308', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Відкрити">
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                }

                const DISPLAY_GROUPS = ['Розкрій', 'Галтовка', 'Прийомка', 'Сортування']
                DISPLAY_GROUPS.forEach(op => {
                  if (grouped[op] && grouped[op].length > 0) {
                    const isCollapsed = collapsedGroups[op]
                    rows.push(
                      <tr key={`header-${op}`} 
                          onClick={() => setCollapsedGroups(prev => ({ ...prev, [op]: !prev[op] }))}
                          style={{ background: '#0a0a0a', cursor: 'pointer', userSelect: 'none' }}>
                        <td colSpan={11} style={{ padding: '12px 14px', fontSize: '0.7rem', fontWeight: 950, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid #1a1a1a', borderTop: '1px solid #1a1a1a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '0', height: '0', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: isCollapsed ? 'none' : '5px solid #eab308', borderBottom: isCollapsed ? '5px solid #eab308' : 'none', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                            {op} <span style={{ color: '#555' }}>({grouped[op].length})</span>
                          </div>
                        </td>
                      </tr>
                    )
                    if (!isCollapsed) {
                      grouped[op].forEach(card => rows.push(renderCardRow(card)))
                    }
                  }
                })

                return rows
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ── ГОЛОВНИЙ РЕНДЕР ──────────────────────────────────────────────────────
  return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>

      {/* Хедер */}
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled mobile-only">
            <Menu size={20} />
            <span>ЧЕРГА</span>
            {queueCards.length > 0 && (
              <span className="queue-badge" style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 900,
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {queueCards.length}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308' }} />
          <span style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ЦЕХ №1: ТЕРМІНАЛ</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem', color: '#eab308', textAlign: 'right' }}>
          {currentTime.toLocaleDateString('uk-UA')} {currentTime.toLocaleTimeString()}
        </div>
      </header>

      {/* Layout */}
      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Ліва панель черги (Десктоп) */}
        <div className="side-panel hide-mobile" style={{ width: '280px', background: '#111', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 15px 15px', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
            </div>
            
            {/* Вибір дільниці черги */}
            <div>
              <select
                value={queueSectionFilter}
                onChange={e => setQueueSectionFilter(e.target.value)}
                style={{
                  width: '100%', background: '#18181f', border: '1px solid #2a2a35', color: '#fff',
                  padding: '8px 10px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800,
                  outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="all">🌐 УСІ ДІЛЬНИЦІ</option>
                <option value="Розкрій">📐 РОЗКРІЙ (НОВІ)</option>
                <option value="Галтовка">🌀 ГАЛТОВКА (БУФЕР)</option>
                <option value="Прийомка">📦 ПРИЙОМКА (БУФЕР)</option>
                <option value="Сортування">🔍 СОРТУВАННЯ (БУФЕР)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {[['all', 'ВСІ'], ['new', 'НОВІ'], ['at-buffer', 'БУФЕР']].map(([val, label]) => (
                <button key={val} onClick={() => setQueueFilter(val)} style={{
                  flex: 1, padding: '5px 0', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.02em',
                  transition: 'all 0.15s',
                  background: queueFilter === val
                    ? (val === 'new' ? '#3b82f6' : val === 'at-buffer' ? '#f59e0b' : '#fff')
                    : '#1a1a1a',
                  color: queueFilter === val
                    ? (val === 'all' ? '#000' : '#fff')
                    : '#555',
                  boxShadow: queueFilter === val ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                }}>{label}</button>
              ))}
            </div>
          </div>
          {renderQueue()}
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#eab30815', border: '1px solid #eab30830', color: '#eab308', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        {/* Мобільний дравер */}
        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
          <div className="drawer-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '15px 20px', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
              <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
            </div>
            
            {/* Вибір дільниці черги (Мобільний) */}
            <div>
              <select
                value={queueSectionFilter}
                onChange={e => setQueueSectionFilter(e.target.value)}
                style={{
                  width: '100%', background: '#18181f', border: '1px solid #2a2a35', color: '#fff',
                  padding: '8px 10px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800,
                  outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="all">🌐 УСІ ДІЛЬНИЦІ</option>
                <option value="Розкрій">📐 РОЗКРІЙ (НОВІ)</option>
                <option value="Галтовка">🌀 ГАЛТОВКА (БУФЕР)</option>
                <option value="Прийомка">📦 ПРИЙОМКА (БУФЕР)</option>
                <option value="Сортування">🔍 СОРТУВАННЯ (БУФЕР)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {[['all', 'ВСІ'], ['new', 'НОВІ'], ['at-buffer', 'БУФЕР']].map(([val, label]) => (
                <button key={val} onClick={() => setQueueFilter(val)} style={{
                  flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.02em',
                  transition: 'all 0.15s',
                  background: queueFilter === val
                    ? (val === 'new' ? '#3b82f6' : val === 'at-buffer' ? '#f59e0b' : '#fff')
                    : '#1a1a1a',
                  color: queueFilter === val
                    ? (val === 'all' ? '#000' : '#fff')
                    : '#555',
                  boxShadow: queueFilter === val ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                }}>{label}</button>
              ))}
            </div>
          </div>
          {renderQueue()}
        </div>

        {/* Основний контент */}
        <div className="content-panel" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '25px 15px', background: '#0a0a0a' }}>
          {scanError && (
            <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', maxWidth: '680px' }}>
              <AlertTriangle size={16} /> {scanError}
              <button onClick={() => setScanError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          )}
          {currentCard ? renderCardView() : renderDashboard()}
        </div>
      </div>

      {/* ── QR-сканер (Класичний вигляд з Ручним Вводом) ────────────────── */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
          <button onClick={() => { setIsScanning(false); setShowManualInput(false); setScanError(null); }}
            style={{ position: 'absolute', top: 24, right: 24, background: '#1a1a1a', border: 'none', color: '#fff', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={26} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 1000, color: '#eab308', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>ЦЕХ №1 · ТЕРМІНАЛ</div>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 700 }}>{showManualInput ? 'ВВЕДІТЬ НОМЕР КАРТКИ ВРУЧНУ' : 'ВІДСКАНУЙТЕ КАРТКУ ТЕХНОЛОГІЧНОГО ПРОЦЕСУ'}</div>
          </div>

          {!showManualInput ? (
            <>
              {/* Чистий контейнер для сканера */}
              <div style={{ width: '100%', maxWidth: '480px', background: '#0a0a0a', borderRadius: '32px', border: '2px solid #eab30830', overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
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
                    style={{ background: '#1a1a1a', border: '1px solid #333', color: '#eab308', padding: '12px 24px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
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
              <form onSubmit={handleManualEntry} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Приклад: 12345"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  style={{ width: '100%', background: '#000', border: '2px solid #eab30850', color: '#fff', fontSize: '2.5rem', textAlign: 'center', padding: '15px', borderRadius: '16px', fontWeight: 900, fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={!manualId || isProcessing}
                    style={{ flex: 2, background: '#eab308', color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer' }}>
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

      {/* ── Модалка СОРТУВАННЯ → Цех №2 (з активної картки або буфера) ──────── */}
      {showSortingModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10021, padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #8b5cf640', display: 'flex', flexDirection: 'column', margin: 'auto 0' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #8b5cf620', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#8b5cf6' }}>🚀 ЗАВЕРШИТИ СОРТУВАННЯ</h3>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '2px' }}>→ ВІДПРАВИТИ В БУФЕР ЦЕХУ №2</div>
              </div>
              <button onClick={() => setShowSortingModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNom(currentCard)?.name}</h3>
              <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '14px 18px', border: '1px solid #8b5cf620', textAlign: 'center' }}>
                <div style={{ fontSize: '0.62rem', color: '#8b5cf6', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Кількість по картці</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{currentCard.quantity} <small style={{ fontSize: '1rem', opacity: 0.4 }}>шт</small></div>
              </div>

              {/* Лічильник браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>КІЛЬКІСТЬ БРАКУ ПРИ СОРТУВАННІ</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity - reworkCount} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - reworkCount, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity - reworkCount, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              {/* Лічильник доопрацювання */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #f59e0b22' }}>
                <label style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ (Цех №2)</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setReworkCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setReworkCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - scrapCount, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setReworkCount(v => Math.min(currentCard.quantity - scrapCount, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              {/* Підсумок */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '14px 18px', border: '1px solid #10b98122', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#555' }}>
                  В Цех №2: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - scrapCount - reworkCount)} шт</strong>
                  {' · '}Доопрацювання: <strong style={{ color: '#f59e0b' }}>{reworkCount} шт</strong>
                  {' · '}Брак: <strong style={{ color: '#ef4444' }}>{scrapCount} шт</strong>
                </div>
              </div>

              {/* Зміна та оператор */}
              <div>
                <label style={labelStyle}>Зміна</label>
                <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                  <option value="">— Оберіть зміну —</option>
                  <option value="Зміна 1">Зміна 1</option>
                  <option value="Зміна 2">Зміна 2</option>
                  <option value="Зміна 3">Зміна 3</option>
                  <option value="Зміна 4">Зміна 4</option>
                  <option value="Без зміни">Без зміни</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Відповідальний за сортування</label>
                <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                  <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                  {getFilteredOperators('Сортування', selectedShift, 'Сортування').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <button
                onClick={async () => {
                  // If card is in-progress/Сортування, first mark it complete (at-buffer) then run sort
                  if (currentCard.status === 'in-progress' && currentCard.operation === 'Сортування') {
                    setIsProcessing(true)
                    try {
                      await supabase.from('work_cards').update({
                        status: 'at-buffer',
                        completed_at: new Date().toISOString()
                      }).eq('id', currentCard.id)
                      // Small wait for data to settle then run full sort logic
                      await new Promise(r => setTimeout(r, 300))
                      await fetchData(['work_cards']).catch(() => {})
                    } catch(e) { console.error(e) } finally { setIsProcessing(false) }
                  }
                  setShowSortingModal(false)
                  await handleSortToShop2()
                }}
                disabled={!selectedOperator || !selectedShift || isProcessing}
                style={{
                  background: '#8b5cf6', color: '#fff', border: 'none', width: '100%',
                  height: '64px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 1000,
                  cursor: (!selectedOperator || !selectedShift || isProcessing) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 10px 30px rgba(139,92,246,0.3)',
                  opacity: (!selectedOperator || !selectedShift || isProcessing) ? 0.5 : 1
                }}>
                🚀 {isProcessing ? 'ВІДПРАВКА...' : 'ВІДПРАВИТИ В БУФЕР ЦЕХУ №2'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка завершення етапу ──────────────────────────────────────── */}
      {showCompleteModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10020, padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #252525', display: 'flex', flexDirection: 'column', margin: 'auto 0' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900 }}>
                  ЗАВЕРШИТИ · {currentCard.operation?.toUpperCase()}
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '2px' }}>
                  {currentCard.operation === CHAIN[CHAIN.length - 1]
                    ? '→ ГОТОВО (деталь прийнята)'
                    : `→ БУФЕР ${currentCard.operation?.toUpperCase()}`}
                </div>
              </div>
              <button onClick={() => setShowCompleteModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNom(currentCard)?.name}</h3>

              {/* Пріоритет галтовки (Тільки для Розкрою) */}
              {currentCard.operation === 'Розкрій' && (
                <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', border: '1px solid #eab30822' }}>
                  <label style={{ color: '#eab308', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px', textAlign: 'center' }}>
                    ПРІОРИТЕТ ДЛЯ ГАЛТОВКИ
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { val: 1, label: '1 - ВИСОКИЙ', color: '#ef4444' },
                      { val: 2, label: '2 - СЕРЕДНІЙ', color: '#3b82f6' },
                      { val: 3, label: '3 - НИЗЬКИЙ', color: '#10b981' }
                    ].map(p => {
                      const active = galtPriority === p.val
                      return (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setGaltPriority(p.val)}
                          style={{
                            flex: 1,
                            padding: '12px 6px',
                            borderRadius: '10px',
                            border: `1px solid ${active ? p.color : '#222'}`,
                            background: active ? p.color : 'transparent',
                            color: active ? '#000' : p.color,
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Зміна */}
              <div>
                <label style={labelStyle}>Зміна (якщо змінилася)</label>
                <select value={selectedShift} onChange={e => { setSelectedShift(e.target.value); setFinalOperator(''); }} style={selectStyle}>
                  <option value="">— Оберіть зміну —</option>
                  <option value="Зміна 1">Зміна 1</option>
                  <option value="Зміна 2">Зміна 2</option>
                  <option value="Зміна 3">Зміна 3</option>
                  <option value="Зміна 4">Зміна 4</option>
                  <option value="Без зміни">Без зміни</option>
                </select>
              </div>

              {/* Фінальний оператор */}
              <div>
                <label style={labelStyle}>Фінальний оператор (якщо змінився)</label>
                <select value={finalOperator} onChange={e => setFinalOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                  <option value="">{selectedShift ? `— Залишити поточного (${currentCard.operator_name}) —` : '— Спочатку оберіть зміну —'}</option>
                  {getFilteredOperators('Цех №1', selectedShift, currentCard.operation).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Фактична кількість фрез (Тільки для Розкрою) */}
              {currentCard.operation === 'Розкрій' && (() => {
                const cardCutters = [...getCuttersForCard(currentCard)].sort((a, b) => {
                  const getDiam = (str) => {
                    const m = str.match(/(\d+(?:[.,]\d+)?)[xх]/i)
                    return m ? parseFloat(m[1].replace(',', '.')) : 999
                  }
                  return getDiam(a) - getDiam(b)
                })
                return (
                  <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', border: '1px solid #eab30822', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <label style={{ color: '#eab308', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', textAlign: 'center' }}>
                      ФАКТИЧНА КІЛЬКІСТЬ ФРЕЗ
                    </label>
                    {cardCutters.map(cutterName => {
                      const currentVal = cuttersBreakdown[cutterName] || 0
                      return (
                        <div key={cutterName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121212', padding: '10px 15px', borderRadius: '10px', border: '1px solid #222' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#aaa', maxWidth: '60%', textAlign: 'left' }}>{cutterName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => setCuttersBreakdown(p => ({ ...p, [cutterName]: Math.max(0, currentVal - 1) }))}
                              type="button"
                              style={{ width: '32px', height: '32px', background: '#1c1c1c', border: '1px solid #333', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <input type="number" min={0} value={currentVal === 0 ? '' : currentVal} placeholder="0"
                              onChange={e => {
                                const val = e.target.value
                                setCuttersBreakdown(p => ({ ...p, [cutterName]: val === '' ? 0 : Math.max(0, parseInt(val) || 0) }))
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#eab308', fontSize: '1.2rem', width: '50px', textAlign: 'center', fontWeight: 900 }} />
                            <button onClick={() => setCuttersBreakdown(p => ({ ...p, [cutterName]: currentVal + 1 }))}
                              type="button"
                              style={{ width: '32px', height: '32px', background: '#1c1c1c', border: '1px solid #333', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ borderTop: '1px solid #222', paddingTop: '10px', textAlign: 'center', fontSize: '0.72rem', color: '#555' }}>
                      Всього використано: <strong style={{ color: '#eab308' }}>{Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0)} шт</strong>
                    </div>
                  </div>
                )
              })()}

              {/* Лічильник браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ БРАКУ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
                  Добре: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - scrapCount)} шт</strong>
                  {' · '}Брак: <strong style={{ color: '#ef4444' }}>{scrapCount} шт</strong>
                </div>
              </div>

              {scrapCount > 0 && cardOperators.length > 0 && (
                <div style={{ background: '#1c1212', borderRadius: '14px', padding: '15px 18px', border: '1px solid #ef444425' }}>
                  <label style={{ color: '#f87171', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Кому присвоїти брак?
                  </label>
                  <select
                    value={scrapOperator}
                    onChange={e => setScrapOperator(e.target.value)}
                    style={{ ...selectStyle, background: '#000', borderColor: '#ef444430', color: '#fca5a5' }}
                  >
                    <option value="">— Оберіть оператора —</option>
                    {cardOperators.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}

              {Math.max(0, (currentCard.quantity || 0) - scrapCount) === 0 ? (
                <button onClick={handleRequestRework} disabled={isProcessing}
                  style={{ ...btnPrimary, background: '#ef4444', boxShadow: '0 10px 30px rgba(239,68,68,0.3)', opacity: isProcessing ? 0.5 : 1 }}>
                  {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '♻ ЗАМОВИТИ ДОВИПУСК'}
                </button>
              ) : (
                <button onClick={handleCompleteToBuffer} disabled={isProcessing}
                  style={{ ...btnGreen, opacity: isProcessing ? 0.5 : 1 }}>
                  {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : (
                    currentCard.operation === CHAIN[CHAIN.length - 1]
                      ? '✓ ПРИЙНЯТО · ЗАВЕРШИТИ'
                      : `✓ В БУФЕР ${currentCard.operation?.toUpperCase()}`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка ПЕРЕЗМІНКА (тільки Розкрій) ─────────────────────────────── */}
      {showShiftChangeModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10030, padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid #f59e0b40', overflow: 'hidden', boxShadow: '0 20px 60px rgba(245,158,11,0.15)', margin: 'auto 0' }}>
            {/* Header */}
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f59e0b20' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 950, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔄 ПЕРЕЗМІНКА · РОЗКРІЙ
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '3px', fontWeight: 700 }}>
                  Картка продовжує роботу — змінюється виконавець
                </div>
              </div>
              <button onClick={() => setShowShiftChangeModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>

            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Поточний оператор */}
              <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Поточний виконавець</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#888' }}>{currentCard.operator_name || '—'}</div>
                <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '2px' }}>{currentCard.shift_name || '—'}</div>
              </div>

              {/* Нова зміна */}
              <div>
                <label style={labelStyle}>Нова зміна</label>
                <select value={shiftChangeShift} onChange={e => setShiftChangeShift(e.target.value)} style={selectStyle}>
                  <option value="">— Оберіть зміну —</option>
                  <option value="Зміна 1">Зміна 1</option>
                  <option value="Зміна 2">Зміна 2</option>
                  <option value="Зміна 3">Зміна 3</option>
                  <option value="Зміна 4">Зміна 4</option>
                  <option value="Без зміни">Без зміни</option>
                </select>
              </div>

              {/* Новий оператор */}
              <div>
                <label style={labelStyle}>Новий виконавець</label>
                <select
                  value={shiftChangeOperator}
                  onChange={e => setShiftChangeOperator(e.target.value)}
                  disabled={!shiftChangeShift}
                  style={{ ...selectStyle, opacity: shiftChangeShift ? 1 : 0.5, cursor: shiftChangeShift ? 'pointer' : 'not-allowed' }}
                >
                  <option value="">{shiftChangeShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                  {getFilteredOperators('Цех №1', shiftChangeShift, 'Розкрій').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Кнопка підтвердження */}
              <button
                onClick={handleShiftChange}
                disabled={!shiftChangeOperator || !shiftChangeShift || isProcessing}
                style={{
                  background: shiftChangeOperator && shiftChangeShift ? '#f59e0b' : '#222',
                  color: shiftChangeOperator && shiftChangeShift ? '#000' : '#444',
                  border: 'none',
                  padding: '18px',
                  borderRadius: '16px',
                  fontSize: '1rem',
                  fontWeight: 950,
                  cursor: shiftChangeOperator && shiftChangeShift ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s'
                }}
              >
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '🔄 ПІДТВЕРДИТИ ПЕРЕЗМІНКУ'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#333', fontWeight: 700 }}>
                Картка залишається в роботі · Таймер скинеться на нового оператора
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка ПАУЗА / ЗУПИНИТИ ВЕРСТАТ (тільки Розкрій) ──────────────── */}
      {showPauseModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10030, padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)', margin: 'auto 0' }}>
            {/* Header */}
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🛑 ЗУПИНИТИ ВЕРСТАТ (ПАУЗА)
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '3px', fontWeight: 700 }}>
                  Призупинити виконання картки розкрою
                </div>
              </div>
              <button onClick={() => setShowPauseModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>

            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Деталь */}
              <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Поточна картка</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#888' }}>{getNom(currentCard)?.name || 'Деталь'}</div>
                <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '2px' }}>{currentCard.machine || 'Верстат не вказано'}</div>
              </div>

              {/* Причина зупинки */}
              <div>
                <label style={labelStyle}>Причина зупинки верстата</label>
                <select 
                  value={pauseReason} 
                  onChange={e => {
                    setPauseReason(e.target.value)
                    if (e.target.value !== 'Інша причина (введіть нижче)') {
                      setCustomPauseReason('')
                    }
                  }} 
                  style={selectStyle}
                >
                  <option value="Поломка верстата">Поломка верстата</option>
                  <option value="Технічне обслуговування">Технічне обслуговування</option>
                  <option value="Відсутність матеріалу">Відсутність матеріалу</option>
                  <option value="Перерва / Обід">Перерва / Обід</option>
                  <option value="Немає файлу розкрою / Програми">Немає файлу розкрою / Програми</option>
                  <option value="Інша причина (введіть нижче)">Інша причина (введіть нижче)</option>
                </select>
              </div>

              {/* Інша причина (текстове поле) */}
              {pauseReason === 'Інша причина (введіть нижче)' && (
                <div>
                  <label style={labelStyle}>Опишіть іншу причину зупинки</label>
                  <input
                    type="text"
                    placeholder="Введіть коментар..."
                    value={customPauseReason}
                    onChange={e => setCustomPauseReason(e.target.value)}
                    style={{ ...selectStyle, background: '#000' }}
                  />
                </div>
              )}

              {/* Кнопка підтвердження */}
              <button
                onClick={handlePauseCard}
                disabled={isProcessing || (pauseReason === 'Інша причина (введіть нижче)' && !customPauseReason.trim())}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '18px',
                  borderRadius: '16px',
                  fontSize: '1rem',
                  fontWeight: 950,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
                  transition: 'all 0.2s',
                  opacity: (isProcessing || (pauseReason === 'Інша причина (введіть нижче)' && !customPauseReason.trim())) ? 0.5 : 1
                }}
              >
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '🛑 ПІДТВЕРДИТИ ЗУПИНКУ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка корекції браку від ВКЯ ─────────────────────────────────── */}
      {showQCModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10025, padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)', margin: 'auto 0' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🛡️ ВІДДІЛ ВКЯ · ФІКСАЦІЯ БРАКУ
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
                  Виявлено додатковий дефект на етапі
                </div>
              </div>
              <button onClick={() => setShowQCModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNom(currentCard)?.name}</h3>

              {/* Інспектор ВКЯ */}
              <div>
                <label style={labelStyle}>ПІБ Інспектора ВКЯ (або відповідального)</label>
                <input
                  type="text"
                  placeholder="Введіть ваше прізвище..."
                  value={qcInspector}
                  onChange={e => setQcInspector(e.target.value)}
                  style={{ ...selectStyle, background: '#000' }}
                />
              </div>

              {/* Причина браку */}
              <div>
                <label style={labelStyle}>Причина браку</label>
                <select
                  value={qcReason}
                  onChange={e => {
                    setQcReason(e.target.value)
                    if (e.target.value !== 'Інше (коментар)') {
                      setQcCustomReason('')
                    }
                  }}
                  style={{ ...selectStyle, background: '#000' }}
                >
                  <option value="Биття цанги">Биття цанги</option>
                  <option value="Помилка програми">Помилка програми</option>
                  <option value="Збій станка">Збій станка</option>
                  <option value="Кривизна листа">Кривизна листа</option>
                  <option value="Поломка флешки">Поломка флешки</option>
                  <option value="Прив'язка">Прив'язка</option>
                  <option value="Помилка оператора">Помилка оператора</option>
                  <option value="Інше (коментар)">Інше (коментар)</option>
                </select>
              </div>

              {/* Коментар до причини браку */}
              {qcReason === 'Інше (коментар)' && (
                <div>
                  <label style={labelStyle}>Опишіть іншу причину браку</label>
                  <input
                    type="text"
                    placeholder="Введіть коментар..."
                    value={qcCustomReason}
                    onChange={e => setQcCustomReason(e.target.value)}
                    style={{ ...selectStyle, background: '#000' }}
                  />
                </div>
              )}

              {/* Лічильник додаткового браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity} value={qcScrapCount === 0 ? '' : qcScrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setQcScrapCount(v => Math.min(currentCard.quantity, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
                  Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - qcScrapCount)} шт</strong>
                </div>
              </div>

              <button onClick={handleQCScrapOverride} disabled={isProcessing || qcScrapCount <= 0}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px',
                  fontSize: '1.05rem', fontWeight: 1000, cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(239,68,68,0.3)',
                  opacity: (isProcessing || qcScrapCount <= 0) ? 0.5 : 1
                }}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ СПИСАТИ У БРАК ВКЯ'}
              </button>
            </div>
          </div>        </div>
      )}

      {/* ── Модалка деталей по кліку на картку етапу ─────────────────────── */}
      {detailStage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10030, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '620px', background: '#111', borderRadius: '24px', border: '1px solid #1e1e1e', overflow: 'hidden', margin: 'auto 0' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#eab308', fontWeight: 950 }}>{detailStage.toUpperCase()}</h2>
              <button onClick={() => setDetailStage(null)} style={{ background: '#1e1e1e', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><X size={17} /></button>
            </div>
            <div style={{ display: 'flex', padding: '12px', gap: '7px' }}>
              {[{ key: 'work', label: 'У РОБОТІ', color: '#3b82f6' }, { key: 'buffer', label: 'БУФЕР', color: '#f59e0b' }, { key: 'scrap', label: 'БРАК', color: '#ef4444' }].map(t => (
                <button key={t.key} onClick={() => setDetailTab(t.key)}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '0.72rem', background: detailTab === t.key ? t.color : '#1e1e1e', color: detailTab === t.key ? '#fff' : '#444' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: '0 12px 12px', maxHeight: '400px', overflowY: 'auto' }}>
              {(() => {
                const agg = {}
                if (detailTab === 'scrap') {
                  const scraps = workCardHistory.filter(h => {
                    const matchStage = detailStage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === detailStage
                    if (!matchStage || h.is_archived_scrap || Number(h.scrap_qty) <= 0) return false
                    const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id))
                    return !nom || nom.type === 'part'
                  })
                  scraps.forEach(h => {
                    const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id))
                    const nomId = h.nomenclature_id
                    const name = nom?.name || 'Деталь'
                    if (!agg[nomId]) agg[nomId] = { name, qty: 0, nomId }
                    agg[nomId].qty += Number(h.scrap_qty)
                  })
                } else {
                  workCards.filter(c => {
                    const matchOp = detailStage === 'Галтовка' ? c.operation?.startsWith('Галтовка') : c.operation === detailStage
                    if (!matchOp) return false
                    if (detailTab === 'work' ? c.status !== 'in-progress' : c.status !== 'at-buffer') return false
                    const nom = getNom(c)
                    return !nom || nom.type === 'part'
                  }).forEach(c => {
                    const nom = getNom(c)
                    const name = nom?.name || 'Деталь'
                    const op = c.operation || ''
                    const key = `${name}_${op}`
                    if (!agg[key]) agg[key] = { name, op, qty: 0 }
                    agg[key].qty += (c.quantity || 0)
                  })
                }
                const items = Object.values(agg)
                if (!items.length) return <div style={{ textAlign: 'center', padding: '46px', color: '#222', fontSize: '0.78rem' }}>Немає даних</div>
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ background: '#0d0d0d', padding: '12px 16px', borderRadius: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.name}</div>
                          {item.op && (
                            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '3px', fontWeight: 700 }}>
                              {item.op}
                            </div>
                          )}
                          {detailTab === 'scrap' && (
                            <button onClick={() => handleArchiveStageScrap(detailStage, item.nomId)} disabled={isProcessing}
                              style={{ marginTop: '5px', background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', fontSize: '0.55rem', fontWeight: 900, padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', textTransform: 'uppercase' }}>
                              {isProcessing ? 'Збереження...' : 'Здати на склад'}
                            </button>
                          )}
                        </div>
                        <div style={{ fontWeight: 1000, fontSize: '1.05rem', color: detailTab === 'work' ? '#3b82f6' : detailTab === 'buffer' ? '#f59e0b' : '#ef4444' }}>
                          {item.qty} <small style={{ opacity: 0.3, fontSize: '0.5rem' }}>шт</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {showStorageExplorer && renderStorageExplorer()}

      {machineCallModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid #333',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '450px',
            padding: '30px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setMachineCallModal(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              <X size={24} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
              <div style={{ background: '#ef444415', padding: '12px', borderRadius: '16px', color: '#ef4444' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                  {machineCallModal.type}
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#f59e0b', fontWeight: 800, fontSize: '0.95rem' }}>
                  Пор. №{machineCallModal.sequence_number || '—'} 
                  {machineCallModal.inventory_no ? ` | Інв. ${machineCallModal.inventory_no}` : ''}
                  {machineCallModal.floor ? ` | Поверх ${machineCallModal.floor}` : ''}
                </p>
              </div>
            </div>

            {machineCallSuccess ? (
              <div style={{
                background: '#10b98115',
                border: '1px solid #10b98130',
                color: '#10b981',
                padding: '20px',
                borderRadius: '16px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '1.1rem',
                margin: '20px 0'
              }}>
                {machineCallSuccess}
              </div>
            ) : (
              <>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                  Оберіть кого саме викликати до верстату. Виклик з'явиться на дашборді майстра та інженерів в реальному часі.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Master Call */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleCreateCall('master', selectedCallMasterId)}
                      style={{
                        background: '#f59e0b',
                        color: '#000',
                        border: 'none',
                        padding: '16px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.2)',
                        width: '100%'
                      }}
                    >
                      <span>ВИКЛИКАТИ МАЙСТРА</span>
                    </button>
                    <select
                      value={selectedCallMasterId}
                      onChange={e => setSelectedCallMasterId(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        color: '#fff',
                        padding: '10px',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Всі майстри (Загальний виклик) --</option>
                      {callMasters.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Engineer Call */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleCreateCall('engineer', selectedCallEngineerId)}
                      style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        padding: '16px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(59,130,246,0.2)',
                        width: '100%'
                      }}
                    >
                      <span>ВИКЛИКАТИ ІНЖЕНЕРА</span>
                    </button>
                    <select
                      value={selectedCallEngineerId}
                      onChange={e => setSelectedCallEngineerId(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        color: '#fff',
                        padding: '10px',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Всі інженери (Загальний виклик) --</option>
                      {callEngineers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* QC Call */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleCreateCall('qc', selectedCallQCId)}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        padding: '16px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
                        width: '100%'
                      }}
                    >
                      <span>ВИКЛИКАТИ ВКЯ</span>
                    </button>
                    <select
                      value={selectedCallQCId}
                      onChange={e => setSelectedCallQCId(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        color: '#fff',
                        padding: '10px',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Всі фахівці ВКЯ (Загальний виклик) --</option>
                      {callQCs.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── КАСТОМНЕ СПОВІЩЕННЯ (IOS-сумісний alert) ────────────────── */}
      {customAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#18181b', border: '1px solid #27272a',
            borderRadius: '24px', padding: '30px 24px', width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>
              {customAlert.title.includes('Помилка') || customAlert.title.includes('❌') || customAlert.title.includes('⚠️') ? '⚠️' : 'ℹ️'}
            </div>
            <h3 style={{ margin: '0 0 14px', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
              {customAlert.title}
            </h3>
            <p style={{
              margin: '0 0 24px', fontSize: '0.9rem', color: '#a1a1aa',
              lineHeight: 1.5, whiteSpace: 'pre-line', textAlign: 'left'
            }}>
              {customAlert.message}
            </p>
            <button
              onClick={() => setCustomAlert(null)}
              style={{
                width: '100%', background: '#eab308', color: '#000',
                border: 'none', padding: '14px', borderRadius: '14px',
                fontSize: '1rem', fontWeight: 1000, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(234,179,8,0.2)'
              }}
            >
              ЗРОЗУМІЛО
            </button>
          </div>
        </div>
      )}

      <style>{`
        .s1-stage-hover:hover { background: #181818!important; transform: translateY(-3px); }
        .s1-stage-hover { transition: all 0.2s cubic-bezier(0.4,0,0.2,1)!important; }
        .spin-s1 { animation: spinS1 1s linear infinite; }
        @keyframes spinS1 { 100% { transform: rotate(360deg); } }
        .s1-burger-btn { display: none; }
        @media (max-width: 768px) { .s1-burger-btn { display: flex!important; } }

        /* Hover effect for cards */
        .s1-stage-hover {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .s1-stage-hover:hover {
          background: #111 !important;
          border-color: #333 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.4) !important;
        }

        .stages-grid-responsive {
          grid-template-columns: 1fr auto 1fr auto 1.5fr;
          grid-template-areas: "stage1 arrow1 stage2 arrow2 storage";
        }

        @media (max-width: 768px) {
          .stages-grid-responsive {
            grid-template-columns: 1fr 1fr;
            grid-template-areas: 
              "stage1 stage2"
              "storage storage";
          }
        }
      `}</style>
    </div>
  )
}

// Стилі-константи
const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }
const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
const btnGreen = { background: '#10b981', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
