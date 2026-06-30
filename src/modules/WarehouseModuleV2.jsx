import React, { useState, useMemo, useEffect } from 'react'
import {
  Warehouse as WarehouseIcon,
  ArrowLeft,
  Package,
  CheckCircle2,
  Bell,
  Plus,
  Truck,
  Layers,
  Archive,
  AlertTriangle,
  Search,
  History,
  Pencil,
  Check,
  X,
  FolderOpen,
  QrCode
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase as supabaseClient } from '../supabase'

const WarehouseModuleV2 = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    inventory, requests, issueMaterials, issueMaterialsBatch,
    nomenclatures, receptionDocs, confirmReception,
    orders, tasks, approveWarehouse, createPurchaseRequest,
    purchaseRequests, receiveInventory, currentUser, fetchModuleData,
    fetchData, managers, refreshTable, machineOperations
  } = useMES()

  // Load warehouse-specific data on mount
  useEffect(() => { 
    if (typeof fetchData === 'function') {
      fetchData(['inventory', 'material_requests', 'reception_docs', 'purchase_requests', 'tasks', 'work_cards', 'orders', 'machine_operations'])
    }
  }, [])

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x')
    .replace(/[іi]/g, 'i')
    .replace(/[уy]/g, 'y')
    .replace(/[кk]/g, 'k')
    .replace(/[мm]/g, 'm')
    .replace(/[нn]/g, 'n')
    .replace(/[вv]/g, 'v')
    .replace(/[и]/g, 'y')
    .replace(/[зz]/g, 'z')
    .replace(/\s/g, '')

  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  const isPrepRequest = (r) => {
    if (r.details && (r.details.includes('ПІДГОТОВ') || r.details.includes('ЗАПИТ НА ПІДГОТОВКУ'))) return true
    if (r.task_id) {
      const task = (tasks || []).find(t => t.id === r.task_id)
      if (task && task.step === 'Підготовка') return true
    }
    return false
  }

  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'raw'
  })

  // Sync tab back from search params if it changes externally or on load
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams])
  const [showAdd, setShowAdd] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [shortages, setShortages] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw', pocket_owner: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPocketOwner, setSelectedPocketOwner] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [processingTasks, setProcessingTasks] = useState(new Set())
  const [expandedDoc, setExpandedDoc] = useState(null)
  // editingQty: { [requestId]: inputValue }
  const [editingQty, setEditingQty] = useState({})
  const [savingQty, setSavingQty] = useState(new Set())

  // Super admin inventory editing state
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)

  const [isScanning, setIsScanning] = useState(false)
  const [scannedCard, setScannedCard] = useState(null)
  const [scannedRequests, setScannedRequests] = useState([])
  const [isIssuingCard, setIsIssuingCard] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualCardInput, setManualCardInput] = useState('')

  // Scanner effect for working cards
  useEffect(() => {
    if (!isScanning) return
    let html5QrCode = null
    let timer = null
    const startScanner = () => {
      if (!window.Html5Qrcode) {
        console.error('Html5Qrcode not loaded')
        setIsScanning(false)
        return
      }
      const el = document.getElementById('warehouse-reader')
      if (!el) {
        console.error('warehouse-reader element not found in DOM')
        setIsScanning(false)
        return
      }
      try {
        html5QrCode = new window.Html5Qrcode('warehouse-reader')
        const config = { fps: 15, qrbox: { width: 260, height: 260 } }
        html5QrCode.start(
          { facingMode: 'environment' }, config, async (decodedText) => {
            let cardId = decodedText.trim()
            if (cardId.startsWith('CENTRUM_CARD_')) {
              cardId = cardId.replace('CENTRUM_CARD_', '').trim()
            }
            if (html5QrCode && html5QrCode.isScanning) {
              await html5QrCode.stop().catch(() => {})
              html5QrCode = null
            }
            setIsScanning(false)
            handleCardScan(cardId)
          }
        ).catch(err => {
          console.error('Scanner start error:', err)
          setCameraError(err?.message || String(err))
        })
      } catch (err) {
        console.error('Html5Qrcode init error:', err)
        setIsScanning(false)
      }
    }
    setCameraError(null)
    setManualCardInput('')
    // Wait 150ms for DOM to render before starting scanner
    timer = setTimeout(startScanner, 150)
    return () => {
      clearTimeout(timer)
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {})
      }
    }
  }, [isScanning])

  const handleCardScan = async (cardId) => {
    try {
      const { data: card, error: cardErr } = await supabaseClient
        .from('work_cards')
        .select('*')
        .eq('id', cardId)
        .single()
      
      if (cardErr || !card) {
        alert('Картку не знайдено!')
        return
      }

      const { data: reqs, error: reqsErr } = await supabaseClient
        .from('material_requests')
        .select('*')
        .or(`card_id.eq.${cardId},and(task_id.eq.${card.task_id},card_id.is.null)`)

      if (reqsErr) {
        alert('Помилка завантаження матеріалів: ' + reqsErr.message)
        return
      }

      if (!reqs || reqs.length === 0) {
        alert('Для цієї картки немає зареєстрованих запитів на матеріали.')
        return
      }

      // Calculate sheets in this card
      const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
      const unitsPerSheet = Number(nom?.units_per_sheet) || 1
      const cardSheets = Math.ceil(Number(card.quantity) / unitsPerSheet)

      const normStr = str => str ? str.toLowerCase().replace(/[^a-z0-9а-яєіїґ]/g, '') : ''

      const resolveMachineType = (machineName) => {
        if (!machineName) return null
        const normMac = machineName.toLowerCase()
        if (normMac.includes('3050(16)x1600') || normMac.includes('3050(16)х1600') || normMac.includes('3050(16)') || normMac.includes('16x16') || normMac.includes('16х16') || normMac.includes('3050x1600') || normMac.includes('3050х1600') || normMac.includes('3050')) {
          return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
        } else if (normMac.includes('дракон') || normMac.includes('60x20') || normMac.includes('6000x2000') || normMac.includes('6000х2000')) {
          return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
        } else if (normMac.includes('малий') || normMac.includes('12x8') || normMac.includes('1200x800') || normMac.includes('12х8') || normMac.includes('1200х800')) {
          return 'CNC 1200x800 - 4 листи (Малий)'
        } else if (normMac.includes('три головий') || normMac.includes('триголовий') || normMac.includes('3060') || normMac.includes('30x16') || normMac.includes('30х16')) {
          return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
        } else if (normMac.includes('фея') || normMac.includes('ke xin')) {
          return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
        }
        return machineName
      }

      const cardMac = card.machine || card.machine_name
      const opType = resolveMachineType(cardMac)
      const ops = (machineOperations || []).find(o => 
        String(o.nomenclature_id) === String(card.nomenclature_id) && 
        (normStr(o.machine_type) === normStr(opType) || String(o.machine_id) === String(cardMac))
      )

      const cuttersRates = {}
      if (ops && Array.isArray(ops.side2_cut_ops)) {
        ops.side2_cut_ops.forEach(op => {
          if (op.startsWith('__CUTTER__Reference:')) return
          if (op.startsWith('__CUTTER__:')) {
            const parts = op.split(':')
            const cNomId = parts[1]
            const cQty = parseFloat(parts[2]) || 0
            if (cNomId && cQty > 0) {
              cuttersRates[cNomId] = cQty
            }
          }
        })
      }

      const findCutterRate = (reqNomId, reqDetails) => {
        const reqNom = nomenclatures.find(n => n.id === reqNomId)
        const reqName = reqNom ? reqNom.name : (reqDetails || '')
        
        // Try strict ID match first
        if (cuttersRates[reqNomId] !== undefined) {
          return cuttersRates[reqNomId]
        }
        
        // Otherwise try diameter matching to bypass generic vs stock duplicates
        const getDiameter = (name) => {
          const clean = name.toLowerCase().replace(/,/g, '.')
          // Matches e.g. "ф2" -> "2", "3x3" -> "3", "1.5x" -> "1.5"
          const match = clean.match(/(?:фреза|ф|d|d=|діаметр|діаметром)?\s*([0-9]+(?:[.,][0-9]+)?)/)
          return match ? parseFloat(match[1]) : null
        }
        
        const reqD = getDiameter(reqName)
        if (reqD === null) return undefined
        
        for (const [rateNomId, rateQty] of Object.entries(cuttersRates)) {
          const rateNom = nomenclatures.find(n => n.id === rateNomId)
          if (!rateNom) continue
          const rateD = getDiameter(rateNom.name)
          if (rateD !== null && rateD === reqD) {
            return rateQty
          }
        }
        return undefined
      }

      const getDisplayMaterial = (partNom, snapshot) => {
        const baseMat = partNom?.material_type || '—'
        if (!snapshot) return baseMat
        const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
        const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0

        if (snapshot.sheets_t300 !== undefined || snapshot.sheets_t700 !== undefined) {
          if (s700 > 0 && s300 === 0) {
            return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
          }
          if (s300 > 0 && s700 > 0) {
            return baseMat.replace(/т300/gi, 'Т300+Т700').replace(/t300/gi, 'Т300+Т700')
          }
          if (s300 > 0 && s700 === 0) {
            return baseMat.replace(/т700/gi, 'Т300').replace(/t700/gi, 'Т300')
          }
        }
        return baseMat
      }

      const task = (tasks || []).find(t => t.id === card.task_id)
      const snapshotPart = task?.plan_snapshot?.[card.nomenclature_id]
      const activeMaterial = getDisplayMaterial(nom, snapshotPart)

      const isSheetMatchingPart = (req, activeMaterial, partNom) => {
        if (!activeMaterial) return false
        
        // 1. Check material_type match
        const reqNom = nomenclatures.find(n => n.id === req.nomenclature_id)
        const reqName = reqNom?.name || req.details || ''
        const reqMatNorm = normStr(reqName)
        const activeMaterials = activeMaterial.split('+').map(m => normStr(m.trim()))

        if (activeMaterials.some(act => reqMatNorm.includes(act) || act.includes(reqMatNorm))) {
          return true
        }
        
        // 2. Fallback: check if the request details explicitly mention the part name
        const reqDetails = req.details || ''
        if (partNom && normStr(reqDetails).includes(normStr(partNom.name))) {
          return true
        }
        
        return false
      }

      const isSheetRequest = (req) => {
        const reqNom = nomenclatures.find(n => n.id === req.nomenclature_id)
        const name = reqNom?.name || req.details || ''
        const lowerName = name.toLowerCase()
        return lowerName.includes('лист') || lowerName.includes('sheet')
      }

      const matchedSheets = reqs.filter(req => !req.card_id && isSheetRequest(req) && isSheetMatchingPart(req, activeMaterial, nom)).map(req => ({
        ...req,
        displayQty: cardSheets,
        isSheet: true
      }))

      let matchedCutters = []
      if (ops && Object.keys(cuttersRates).length > 0) {
        // Build cutter list strictly from tech operations
        for (const [rateNomId, rateQty] of Object.entries(cuttersRates)) {
          // Find if there is an existing DB request for this cutter
          const existingCutterReq = reqs.find(req => {
            if (!req.card_id) return false
            
            // strict or diameter matching
            if (req.nomenclature_id === rateNomId) return true
            
            const reqNom = nomenclatures.find(n => n.id === req.nomenclature_id)
            const reqName = reqNom ? reqNom.name : (req.details || '')
            const rateNom = nomenclatures.find(n => n.id === rateNomId)
            if (!rateNom) return false
            
            const getDiameter = (name) => {
              const clean = name.toLowerCase().replace(/,/g, '.')
              const match = clean.match(/(?:фреза|ф|d|d=|діаметр|діаметром)?\s*([0-9]+(?:[.,][0-9]+)?)/)
              return match ? parseFloat(match[1]) : null
            }
            const reqD = getDiameter(reqName)
            const rateD = getDiameter(rateNom.name)
            return reqD !== null && rateD !== null && reqD === rateD
          })

          if (existingCutterReq) {
            matchedCutters.push({
              ...existingCutterReq,
              displayQty: Math.ceil(rateQty * cardSheets),
              isSheet: false,
              isSynthetic: false
            })
          } else {
            const rateNom = nomenclatures.find(n => n.id === rateNomId)
            const cardLabel = card.card_info?.split(' ')[0] || `№${card.id.substring(0, 8)}`
            matchedCutters.push({
              id: `synthetic-${rateNomId}-${cardId}`,
              nomenclature_id: rateNomId,
              quantity: Math.ceil(rateQty * cardSheets),
              displayQty: Math.ceil(rateQty * cardSheets),
              status: 'pending',
              details: `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ): ${rateNom?.name || ''} — ${Math.ceil(rateQty * cardSheets)} шт.`,
              card_id: cardId,
              task_id: card.task_id,
              order_id: card.order_id,
              isSheet: false,
              isSynthetic: true
            })
          }
        }
      } else {
        // Fallback: use whatever cutter requests are in the database
        matchedCutters = reqs.filter(req => req.card_id).map(req => ({
          ...req,
          displayQty: Number(req.quantity),
          isSheet: false
        }))
      }

      const processedReqs = [...matchedSheets, ...matchedCutters]

      setScannedCard(card)
      setScannedRequests(processedReqs)
    } catch (e) {
      alert('Помилка: ' + e.message)
    }
  }

  const handleIssueCardMaterials = async () => {
    setIsIssuingCard(true)
    try {
      const pendingReqs = scannedRequests.filter(r => r.status === 'pending' || r.status === 'issued')
      
      for (const req of pendingReqs) {
        // 1. Find matching inventory item on the database
        const { data: matchedInventory, error: invErr } = await supabaseClient
          .from('inventory')
          .select('*')
          .or(`id.eq.${req.inventory_id || 0},nomenclature_id.eq.${req.nomenclature_id || 0}`)
        
        if (invErr) throw invErr

        const invItem = (matchedInventory || []).find(i => i.warehouse === 'operational' || !i.warehouse) 
          || (matchedInventory || [])[0]

        const qtyToDeduct = req.displayQty ?? Number(req.quantity) ?? 0

        if (invItem) {
          // Decrement total_qty
          const nextTotal = Math.max(0, (Number(invItem.total_qty) || 0) - qtyToDeduct)
          // Decrement reserved_qty ONLY if request was already 'issued' (reserved)
          const wasReserved = req.status === 'issued'
          const nextReserved = wasReserved 
            ? Math.max(0, (Number(invItem.reserved_qty) || 0) - qtyToDeduct)
            : (Number(invItem.reserved_qty) || 0)

          await supabaseClient.from('inventory')
            .update({ 
              total_qty: nextTotal, 
              reserved_qty: nextReserved, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', invItem.id)
        }

        // 2. Update the request in the database
        if (req.isSheet) {
          // Subtract the issued sheets from the task-level request
          const nextQty = Math.max(0, (Number(req.quantity) || 0) - qtyToDeduct)
          const nextStatus = nextQty === 0 ? 'completed' : req.status
          await supabaseClient.from('material_requests')
            .update({ quantity: nextQty, status: nextStatus })
            .eq('id', req.id)
        } else {
          // For cutters, update quantity to displayQty (which is the actual issued count) and complete it
          if (req.isSynthetic) {
            await supabaseClient.from('material_requests').insert({
              order_id: req.order_id,
              task_id: req.task_id,
              card_id: req.card_id,
              nomenclature_id: req.nomenclature_id,
              quantity: qtyToDeduct,
              status: 'completed',
              details: req.details
            })
          } else {
            await supabaseClient.from('material_requests')
              .update({ quantity: qtyToDeduct, status: 'completed' })
              .eq('id', req.id)
          }
        }
      }

      alert('Матеріали успішно списано та видано!')
      setScannedCard(null)
      setScannedRequests([])
      setIsScanning(false)
      if (typeof fetchData === 'function') fetchData(['inventory', 'material_requests'])
    } catch (err) {
      alert('Помилка видачі: ' + err.message)
    } finally {
      setIsIssuingCard(false)
    }
  }

  const getMaterialType = (r) => {
    if (r.details && (r.details.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') || r.details.includes('ПАКУВАННЯ'))) {
      return 'finished'
    }

    const parsedName = parseMaterialName(r.details)
    const nameLower = parsedName.toLowerCase()
    const nom = r.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(r.nomenclature_id)) : null
    
    if (nom?.type === 'part') return 'finished'
    if (nom?.type === 'product') return 'finished'

    const isSgp = (
      nameLower.startsWith('іп-') || 
      nameLower.startsWith('ip-') || 
      nameLower.startsWith('kr-') || 
      nameLower.startsWith('kh-') || 
      (nameLower.includes('іп') && !nameLower.includes('кріплення') && !nameLower.includes('друк') && !nameLower.includes('3д')) ||
      nameLower.includes('ip')
    )
    if (isSgp) {
      return 'finished'
    }
    
    return 'raw'
  }

  const tabs = useMemo(() => {
    const getCount = (tabId) => {
      const filtered = (requests || []).filter(r => {
        if (r.status !== 'pending' && r.status !== 'issued') return false
        if (r.status === 'issued') {
          const task = tasks.find(t => t.id === r.task_id)
          if (!task || task.warehouse_conf) return false
        }
        if (isPrepRequest(r)) return false
        return getMaterialType(r) === tabId
      })
      const uniqueDocs = new Set(filtered.map(r => r.task_id || `order-${r.order_id}`))
      let receptionCount = 0
      if (tabId === 'raw') {
        receptionCount = (receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && d.target_warehouse === 'operational').length
      }
      if (tabId === 'pocket') {
        receptionCount = (receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && d.target_warehouse === 'pocket').length
      }
      return uniqueDocs.size + receptionCount
    }
    return [
      { id: 'raw', label: 'Оперативний', icon: <Package size={18} />, count: getCount('raw') },
      { id: 'pocket', label: 'Кишеня майстра', icon: <FolderOpen size={18} />, count: getCount('pocket') },
      { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} />, count: getCount('semi') },
      { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} />, count: getCount('finished') },
      { id: 'scrap', label: 'Брак', icon: <AlertTriangle size={18} />, count: getCount('scrap') },
      { id: 'bz', label: 'БЗ', icon: <CheckCircle2 size={18} />, count: getCount('bz') },
      { id: 'registry', label: 'Реєстр', icon: <History size={18} /> }
    ]
  }, [requests, inventory, tasks, receptionDocs, nomenclatures])

  const filteredInventory = (inventory || []).filter(i => {
    const normName = (i.name || '').toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '')
    const normSearch = searchQuery.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '')
    const matchesSearch = normName.includes(normSearch)
    
    if (activeTab === 'pocket') {
      const matchesOwner = !selectedPocketOwner || i.pocket_owner === selectedPocketOwner
      return i.warehouse === 'pocket' && matchesSearch && matchesOwner
    }

    const isOperational = i.warehouse === 'operational' || !i.warehouse
    if (!isOperational) return false

    // Only show items with positive stock
    if ((Number(i.total_qty) || 0) <= 0) return false

    const itemType = i.type || 'raw'

    if (activeTab === 'bz') return itemType === 'bz' && matchesSearch
    if (activeTab === 'scrap') return itemType.startsWith('scrap') && matchesSearch
    
    if (activeTab === 'raw') {
      return (itemType === 'raw' || itemType === 'consumable' || itemType === 'hardware') && matchesSearch
    }
    if (activeTab === 'semi') {
      return (itemType === 'semi' || itemType === 'part') && matchesSearch
    }
    if (activeTab === 'finished') {
      return (itemType === 'finished' || itemType === 'product') && matchesSearch
    }

    return itemType === activeTab && matchesSearch
  })

  const groupedPocketInventory = useMemo(() => {
    if (activeTab !== 'pocket') return {}
    return filteredInventory.reduce((acc, item) => {
      const owner = item.pocket_owner || 'Не визначено'
      if (!acc[owner]) acc[owner] = []
      acc[owner].push(item)
      return acc
    }, {})
  }, [filteredInventory, activeTab])

  const pendingDocs = receptionDocs
    ? receptionDocs.filter(d => (d.status === 'shipped' || d.status === 'ordered') && d.target_warehouse === (activeTab === 'pocket' ? 'pocket' : 'operational'))
    : []

  const pendingRequests = (requests || []).filter(r => {
    if (r.status !== 'pending' && r.status !== 'issued') return false
    if (r.status === 'issued') {
      const task = tasks.find(t => t.id === r.task_id)
      if (!task || task.warehouse_conf) return false
    }
    if (isPrepRequest(r)) return false
    return getMaterialType(r) === activeTab
  })

  const groupedRequests = pendingRequests.reduce((acc, req) => {
    const key = req.task_id || `order-${req.order_id}`
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleReserveOrder = (taskId, orderId, orderNum, reqList) => {
    const hasActivePR = (purchaseRequests || []).some(
      pr => (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && 
            ['pending', 'accepted', 'ordered'].includes(pr.status)
    )
    if (hasActivePR) return

    const missingItems = []
    reqList.forEach(req => {
      const parsedName = parseMaterialName(req.details)
      
      // EXCLUSION: If it's a finished product (IP- prefix or type 'finished'), 
      // the Operational Warehouse doesn't handle its kitting.
      const nameLower = parsedName.toLowerCase()
      const matching = (inventory || []).filter(i => {
        if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
        if (i.id === req.inventory_id) return true
        if (parsedName) {
          const normName = normalize(i.name)
          const normParsed = normalize(parsedName)
          if (normName === normParsed) return true
          if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
          const normNameNoParens = normalize(i.name.replace(/\s*\([^)]*\)$/, ''))
          if (normNameNoParens === normParsed) return true
        }
        return false
      })
      
      const nom = req.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(req.nomenclature_id)) : null
      const isSgp = (
        nom?.type === 'part' || 
        nom?.type === 'product' || 
        nameLower.startsWith('іп-') || 
        nameLower.startsWith('ip-') || 
        nameLower.startsWith('kr-') || 
        nameLower.startsWith('kh-') || 
        (nameLower.includes('іп') && !nameLower.includes('кріплення') && !nameLower.includes('друк') && !nameLower.includes('3д')) ||
        nameLower.includes('ip') ||
        matching.some(i => i.type === 'finished' || i.type === 'semi' || i.type === 'part')
      )
      if (isSgp) return

      const operationalItems = matching.filter(i => i.warehouse === 'operational' || !i.warehouse)
      const available = operationalItems.reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
      const invItem = operationalItems[0] || matching[0]
      
      // Calculate Global Availability for context
      const globalAvailable = (inventory || []).filter(i => {
        if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
        if (parsedName) {
          const normName = normalize(i.name)
          const normParsed = normalize(parsedName)
          if (normName === normParsed) return true
          if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
        }
        return false
      }).reduce((acc, i) => acc + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)

      const needed = Number(req.quantity)
      if (available < needed) {
        const missingAmount = needed - available
        const nomenclature_id = invItem?.nomenclature_id ||
          (nomenclatures || []).find(n => normalize(n.name) === normalize(parsedName))?.id || 
          req.nomenclature_id || null
        
        const itemKey = nomenclature_id || normalize(parsedName)
        const existing = missingItems.find(it => (it.nomenclature_id && it.nomenclature_id === nomenclature_id) || normalize(it.name) === normalize(parsedName))
        
        if (existing) {
          existing.missingAmount += missingAmount
          existing.needed += needed
        } else {
          missingItems.push({
            reqDetails: parsedName,
            missingAmount,
            globalAvailable,
            inventory_id: invItem?.id || req.inventory_id,
            nomenclature_id,
            needed,
            name: parsedName
          })
        }
      }
    })

    if (missingItems.length > 0) {
      setShortages({ orderId, orderNum, taskId, items: missingItems, reqList })
    } else {
      setProcessingTasks(prev => new Set(prev).add(taskId))
      apiService.submitReserveBatch(orderId, reqList, taskId, issueMaterialsBatch).then(() => {
        setProcessingTasks(prev => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
      })
    }
  }

  const sendPurchaseRequest = async () => {
    if (!shortages || isProcessing) return
    
    // Safety check: don't send if a PR for this order/task was created while modal was open
    const alreadySent = (purchaseRequests || []).some(
      pr => (shortages.taskId ? String(pr.task_id) === String(shortages.taskId) : String(pr.order_id) === String(shortages.orderId)) && 
            ['pending', 'accepted', 'ordered'].includes(pr.status)
    )
    if (alreadySent) {
      alert('Запит для цього наряду вже був надісланий раніше.')
      setShortages(null)
      return
    }

    setIsProcessing(true)
    try {
      // 2. Надсилаємо запит тільки на різницю (дефіцит)
      
      const itemsToRequest = shortages.items.filter(item => {
         const nom = nomenclatures.find(n => n.id === item.nomenclature_id);
         return !(nom && nom.name.includes('[Підготовлений]'));
      });
      
      if (itemsToRequest.length === 0) {
         alert('Усі дефіцитні позиції — це підготовлені листи. Створіть наряд на підготовку замість запиту на СВ.');
         setShortages(null);
         return;
      }
      
      await apiService.submitPurchaseRequest(
          shortages.orderId,
          shortages.orderNum,
          itemsToRequest, // filtered

        shortages.taskId,
        createPurchaseRequest
      )
      
      alert('Запит на дефіцит відправлено до СВ! Ви зможете видати наряд, коли матеріали надійдуть на склад.')
      setShortages(null)
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Save edited consumable quantity to material_requests
  const handleSaveConsumableQty = async (reqId) => {
    const newVal = parseFloat(editingQty[reqId])
    if (isNaN(newVal) || newVal < 0) return
    setSavingQty(prev => new Set(prev).add(reqId))
    try {
      await supabaseClient.from('material_requests').update({ quantity: newVal }).eq('id', reqId)
      if (typeof fetchData === 'function') fetchData(['material_requests'])
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSavingQty(prev => { const n = new Set(prev); n.delete(reqId); return n })
      setEditingQty(prev => { const n = { ...prev }; delete n[reqId]; return n })
    }
  }

  const handleSaveInventoryQty = async (itemId) => {
    const totalVal = parseFloat(editingInvTotal)
    const reservedVal = parseFloat(editingInvReserved)
    if (isNaN(totalVal) || totalVal < 0 || isNaN(reservedVal) || reservedVal < 0) {
      alert('Будь ласка, введіть коректні числа (>= 0)')
      return
    }
    setSavingInv(true)
    try {
      await supabaseClient.from('inventory').update({
        total_qty: totalVal,
        reserved_qty: reservedVal,
        updated_at: new Date().toISOString()
      }).eq('id', itemId)
      if (typeof fetchData === 'function') fetchData(['inventory'])
      setEditingInvId(null)
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSavingInv(false)
    }
  }

  // Handle adding new inventory item (hybrid: log + save)
  const handleAddInventory = async (e) => {
    e.preventDefault()
    if (isProcessing) return
    if (activeTab === 'pocket' && !newItem.pocket_owner) {
      alert('Будь ласка, оберіть майстра для кишені!')
      return
    }
    setIsProcessing(true)
    try {
      await apiService.submitInventory(newItem, async (data) => {
        const { supabase } = await import('../supabase')
        
        const normInput = normalize(data.name)
        const matchedNom = nomenclatures.find(n => {
          const fullName = `${n.name}${n.material_type ? ` (${n.material_type})` : ''}`
          return normalize(fullName) === normInput || normalize(n.name) === normInput
        })

        const itemType = matchedNom ? (matchedNom.type || 'raw') : (data.type || 'raw')
        const targetNomId = matchedNom ? matchedNom.id : null
        const targetName = matchedNom ? `${matchedNom.name}${matchedNom.material_type ? ` (${matchedNom.material_type})` : ''}` : data.name

        // Check if item already exists in the target warehouse
        const targetWh = activeTab === 'pocket' ? 'pocket' : 'operational'
        const existing = (inventory || []).find(i => 
          i.warehouse === targetWh &&
          i.type === itemType &&
          (targetWh !== 'pocket' || i.pocket_owner === data.pocket_owner) &&
          (
            (targetNomId && i.nomenclature_id === targetNomId) ||
            (!targetNomId && normalize(i.name) === normInput)
          )
        )

        if (existing) {
          await supabase.from('inventory')
            .update({
              total_qty: (Number(existing.total_qty) || 0) + (Number(data.total_qty) || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('inventory').insert([{
            nomenclature_id: targetNomId,
            name: targetName,
            unit: data.unit || matchedNom?.unit || 'шт',
            total_qty: Number(data.total_qty) || 0,
            reserved_qty: 0,
            type: itemType,
            warehouse: targetWh,
            pocket_owner: targetWh === 'pocket' ? data.pocket_owner : null
          }])
        }
      })
      setShowAdd(false)
      setNewItem({ name: '', unit: 'шт', total_qty: '', type: activeTab, pocket_owner: '' })
      if (typeof fetchData === 'function') fetchData(['inventory'])
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="warehouse-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0, padding: '15px 25px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" className="back-link" style={{ color: '#555', transition: '0.3s' }}><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
          <div className="module-title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <WarehouseIcon className="text-secondary" size={24} style={{ color: '#ff9000' }} />
            <h1 className="hide-mobile" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>СКЛАД ОПЕРАТИВНИЙ</h1>
            <h1 className="mobile-only" style={{ margin: 0, fontSize: '1rem', fontWeight: 950 }}>СКЛАД ОПЕРАТИВНИЙ</h1>
            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.delete('tab')
                url.searchParams.set('tab', activeTab)
                navigator.clipboard.writeText(url.toString())
                alert('Посилання скопійовано!')
              }}
              style={{
                background: 'rgba(255, 144, 0, 0.1)',
                border: '1px solid rgba(255, 144, 0, 0.3)',
                color: '#ff9000',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer',
                marginLeft: '10px'
              }}
            >
              Копіювати посилання
            </button>
          </div>
          <button
            onClick={() => setShowReception(!showReception)}
            style={{
              background: showReception 
                ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' 
                : (pendingDocs.length > 0 ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.08)'),
              color: showReception ? '#000' : '#0ea5e9',
              border: showReception ? 'none' : '1px solid rgba(14, 165, 233, 0.4)',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              position: 'relative',
              boxShadow: pendingDocs.length > 0 ? '0 0 15px rgba(14, 165, 233, 0.4)' : 'none',
              animation: pendingDocs.length > 0 ? 'pulse-blue 2s infinite' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Truck size={16} /> <span>ПРИЙОМКА</span>
            {pendingDocs.length > 0 && (
              <span className="badge-count anim-pulse">
                {pendingDocs.length}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="hide-mobile" style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>
            {currentUser?.first_name} {currentUser?.last_name}
          </div>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

        {/* SCAN BUTTON ACTION */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <button
            onClick={() => {
              setIsScanning(!isScanning)
              setShowReception(false)
            }}
            style={{
              background: isScanning 
                ? 'linear-gradient(135deg, #ff9000, #d97706)' 
                : 'rgba(255, 144, 0, 0.08)',
              color: isScanning ? '#000' : '#ff9000',
              border: isScanning ? 'none' : '1px solid rgba(255, 144, 0, 0.4)',
              padding: '12px 24px',
              borderRadius: '14px',
              fontSize: '0.85rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isScanning ? '0 0 15px rgba(255, 144, 0, 0.3)' : 'none'
            }}
          >
            <QrCode size={18} /> <span>СКАНУВАТИ РОБОЧУ КАРТКУ</span>
          </button>
        </div>

        {/* RECEPTION ALERT BANNER */}
        {pendingDocs.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(2, 132, 199, 0.05))',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: '20px',
            padding: '15px 25px',
            marginBottom: '25px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(14, 165, 233, 0.15)',
            animation: 'pulse-blue 2s infinite',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: '#0ea5e9', padding: '12px', borderRadius: '14px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  У ВАС Є НОВІ ПОСТАВКИ ДЛЯ ПРИЙОМКИ!
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#888' }}>
                  Очікує підтвердження: <strong style={{ color: '#0ea5e9' }}>{pendingDocs.length}</strong> документ(ів)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReception(true)}
              style={{
                background: '#0ea5e9',
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                transition: '0.2s',
                letterSpacing: '0.05em'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              Відкрити прийомку
            </button>
          </div>
        )}

        {/* SCANNER PANEL - fixed overlay */}
        {isScanning && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px' }}>
            <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff9000', fontWeight: 900, fontSize: '0.9rem' }}>
                  <QrCode size={18} /> СКАНУВАННЯ РОБОЧОЇ КАРТКИ
                </div>
                <button onClick={() => setIsScanning(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={22} /></button>
              </div>
              {cameraError ? (
                <div style={{ padding: '30px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>📷</div>
                  <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.85rem' }}>Камера недоступна</div>
                  <div style={{ color: '#555', fontSize: '0.75rem', maxWidth: '320px', lineHeight: 1.5 }}>
                    Браузер заблокував доступ до камери (потрібен HTTPS). Введіть ID картки вручну:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '340px' }}>
                    <input
                      type="text"
                      value={manualCardInput}
                      onChange={e => setManualCardInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && manualCardInput.trim()) {
                          setIsScanning(false)
                          handleCardScan(manualCardInput.trim())
                        }
                      }}
                      placeholder="Введіть UUID картки..."
                      style={{ flex: 1, padding: '10px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
                      autoFocus
                    />
                    <button
                      onClick={() => { if (manualCardInput.trim()) { setIsScanning(false); handleCardScan(manualCardInput.trim()) } }}
                      style={{ padding: '10px 16px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      OK
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: 0, position: 'relative', background: '#000', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div id="warehouse-reader" style={{ width: '100%', border: 'none' }} />
                  </div>
                  <div style={{ padding: '18px', textAlign: 'center', fontSize: '0.75rem', color: '#555' }}>
                    Наведіть камеру на QR-код виробничої картки
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* RECEPTION PANEL */}
        {showReception && (
          <div className="content-card glass-panel" style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#0ea5e9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={18} /> ОЧІКУЮТЬ ПРИЙОМКИ НА СО
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingDocs.map(doc => (
                <div key={doc.id} style={{ padding: '15px 20px', background: '#000', borderRadius: '18px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                      ДОКУМЕНТ #{String(doc.id).substring(0, 8)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                        const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                        const itemName = nom
                          ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : ''))
                          : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
                        const itemQty = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity ?? '?'
                        return (
                          <div key={idx} style={{ background: '#0a0a0a', padding: '5px 10px', borderRadius: '8px', border: '1px solid #222', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>
                              {itemName}
                            </span>
                            <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{itemQty}</strong>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Перенаправити прийомку на Склад Виробництва (СВ)?')) {
                            const { error } = await supabase.from('reception_docs').update({ target_warehouse: 'production' }).eq('id', doc.id)
                            if (!error) refreshTable('reception_docs')
                          }
                        }}
                        style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                      >
                        Перенаправити на СВ
                      </button>
                    </div>
                  </div>
                  <button
                    disabled={processingDocs.has(doc.id)}
                    onClick={async () => {
                      setProcessingDocs(prev => new Set(prev).add(doc.id))
                      try {
                        await confirmReception(doc.id)
                      } finally {
                        setProcessingDocs(prev => {
                          const next = new Set(prev)
                          next.delete(doc.id)
                          return next
                        })
                      }
                    }}
                    style={{ marginLeft: '15px', background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 1000, cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: processingDocs.has(doc.id) ? 0.5 : 1 }}
                  >
                    {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ'}
                  </button>
                </div>
              ))}
              {pendingDocs.length === 0 && (
                <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center' }}>Немає активних документів на прийомку</p>
              )}
            </div>
          </div>
        )}

        {/* ЗАЯВКИ НА КОМПЛЕКТАЦІЮ (Тільки для відповідного складу) */}
        {pendingRequests.length > 0 && (
          <div className="content-card glass-panel" style={{ borderLeft: '4px solid #ff9000', marginBottom: '30px', padding: '20px' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#ff9000', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} /> ЗАЯВКИ НА КОМПЛЕКТАЦІЮ
            </h3>
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
              {Object.entries(groupedRequests).map(([key, reqList]) => {
                const firstReq = reqList[0]
                const orderId = firstReq.order_id
                const taskId = firstReq.task_id
                
                const task = (tasks || []).find(t => t.id === taskId)
                const order = (orders || []).find(o => String(o.id) === String(orderId))
                const orderNum = order?.order_num || '???'
                const displayNum = task?.batch_index ? `${orderNum}/${task.batch_index}` : orderNum

                const activePR = (purchaseRequests || []).find(pr =>
                  (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'pending'
                )
                const acceptedPR = (purchaseRequests || []).find(pr =>
                  (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'accepted'
                )
                const orderedPR = (purchaseRequests || []).find(pr =>
                  (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'ordered'
                )
                const orderedReception = (receptionDocs || []).find(rd =>
                  (rd.task_id ? String(rd.task_id) === String(taskId) : String(rd.order_id) === String(orderId)) && rd.status === 'ordered'
                )
                const pendingReception = (receptionDocs || []).find(rd =>
                  (rd.task_id ? String(rd.task_id) === String(taskId) : String(rd.order_id) === String(orderId)) && (rd.status === 'pending' || rd.status === 'shipped')
                )

                const missingItems = []
                reqList.forEach(req => {
                  const parsedName = parseMaterialName(req.details)
                  const nameLower = parsedName.toLowerCase()
                  
                  const matchingInv = (inventory || []).filter(i => {
                    if (i.warehouse !== 'operational' && i.warehouse) return false
                    if (i.id === req.inventory_id) return true
                    if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
                    if (parsedName) {
                      const normName = normalize(i.name)
                      const normParsed = normalize(parsedName)
                      if (normName === normParsed) return true
                      if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
                      const normNameNoParens = normalize(i.name.replace(/\s*\([^)]*\)$/, ''))
                      if (normNameNoParens === normParsed) return true
                    }
                    return false
                  })
                  
                  const totalOnWh = matchingInv.reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
                  
                  const nom = req.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(req.nomenclature_id)) : null
                  const isSgp = (
                    nom?.type === 'part' || 
                    nom?.type === 'product' || 
                    nameLower.startsWith('іп-') || 
                    nameLower.startsWith('ip-') || 
                    nameLower.startsWith('kr-') || 
                    nameLower.startsWith('kh-') || 
                    (nameLower.includes('іп') && !nameLower.includes('кріплення') && !nameLower.includes('друк') && !nameLower.includes('3д')) ||
                    nameLower.includes('ip') ||
                    matchingInv.some(i => i.type === 'finished' || i.type === 'semi' || i.type === 'part')
                  )
                  if (isSgp) return
                  
                  // Додаємо те, що вже видано (зарезервовано) саме для цього наряду
                  const alreadyIssuedForThis = (reqList || []).filter(r => r.id === req.id && r.status === 'issued')
                    .reduce((sum, r) => sum + Number(r.quantity), 0)
                  
                  const effectiveAvailable = totalOnWh + alreadyIssuedForThis

                  if (effectiveAvailable < Number(req.quantity)) missingItems.push(req)
                })

                const isAllIssued = reqList.every(r => r.status === 'issued')

                const hasMissingSheets = missingItems.some(req => {
                  const nameLower = parseMaterialName(req.details).toLowerCase()
                  return nameLower.includes('лист') && nameLower.includes('підготовлений')
                })

                // Пріоритетність статусів
                let btnLabel = ''
                let isAwaiting = false

                if (hasMissingSheets) {
                  btnLabel = 'ОЧІКУЄМ ЛИСТИ'
                  isAwaiting = true
                } else if (missingItems.length === 0) {
                  // Якщо товару достатньо - завжди показуємо кнопку видачі
                  btnLabel = isAllIssued ? 'ПІДТВЕРДИТИ ВИДАЧУ' : 'ВИДАТИ'
                  isAwaiting = false 
                } else if (activePR) {
                  btnLabel = 'ЗАПИТ НАДІСЛАНО'
                  isAwaiting = true
                } else if (acceptedPR) {
                  btnLabel = 'ЗАПИТ ПРИЙНЯТО'
                  isAwaiting = true
                } else if (orderedPR || orderedReception) {
                  btnLabel = 'ОЧІКУЄ ПРИЙОМКИ'
                  isAwaiting = true
                } else if (pendingReception) {
                  btnLabel = 'ПРИЙОМКА'
                  isAwaiting = false // Дозволяємо натиснути, щоб відкрити панель
                } else {
                  btnLabel = 'ЗІБРАТИ ТА ЗАБРОНЮВАТИ'
                  isAwaiting = false
                }

                const btnColor = isAwaiting ? '#1a1a1a' : (btnLabel === 'ПРИЙОМКА' ? '#0ea5e9' : '#ff9000')
                const textColor = isAwaiting ? '#444' : '#000'

                return (
                  <div key={key} style={{ minWidth: '300px', background: '#111', padding: '15px', borderRadius: '15px', border: '1px solid #222' }}>
                    <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '10px' }}>НАРЯД #{displayNum}</strong>
                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: '15px' }}>
                      {(() => {
                        const displayedRequests = []
                        reqList.forEach(r => {
                          const parsedName = parseMaterialName(r.details)
                          const key = r.nomenclature_id || parsedName
                          const existing = displayedRequests.find(dr => 
                            (dr.nomenclature_id && dr.nomenclature_id === r.nomenclature_id) || 
                            parseMaterialName(dr.details) === parsedName
                          )
                          if (existing) {
                            existing.quantity = (Number(existing.quantity) || 0) + (Number(r.quantity) || 0)
                          } else {
                            displayedRequests.push({ ...r })
                          }
                        })
                        
                        return displayedRequests.map(r => {
                          const parsedName = parseMaterialName(r.details)
                          const nom = r.nomenclature_id ? (nomenclatures || []).find(n => String(n.id) === String(r.nomenclature_id)) : null
                          const isConsumable = nom?.type === 'consumable' || (parsedName || '').toLowerCase().includes('фреза')
                          const isEditing = editingQty.hasOwnProperty(r.id)
                          const isSaving = savingQty.has(r.id)
                          return (
                            <li key={r.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              fontSize: '0.78rem', color: '#888', padding: '4px 0',
                              borderBottom: '1px solid #1a1a1a'
                            }}>
                              <span style={{ flex: 1, marginRight: '8px' }}>
                                {parsedName || r.details}
                                {nom?.description && (
                                  <span style={{ color: '#06b6d4', fontSize: '0.72rem', marginLeft: '6px', fontWeight: 'bold' }}>
                                    ({nom.description})
                                  </span>
                                )}
                              </span>
                              {isEditing ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingQty[r.id]}
                                    onChange={e => setEditingQty(prev => ({ ...prev, [r.id]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveConsumableQty(r.id); if (e.key === 'Escape') setEditingQty(prev => { const n={...prev}; delete n[r.id]; return n }) }}
                                    autoFocus
                                    style={{
                                      width: '60px', background: '#000', border: '1px solid #ff9000',
                                      color: '#fff', borderRadius: '5px', padding: '3px 6px',
                                      fontSize: '0.78rem', outline: 'none'
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSaveConsumableQty(r.id)}
                                    disabled={isSaving}
                                    style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center' }}
                                    title="Зберегти"
                                  >
                                    {isSaving ? '...' : <Check size={12} />}
                                  </button>
                                </span>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                                  <strong style={{ color: isConsumable ? '#f59e0b' : '#aaa' }}>{r.quantity} од.</strong>
                                  {isConsumable && currentUser?.position === 'Адмін' && (
                                    <button
                                      onClick={() => setEditingQty(prev => ({ ...prev, [r.id]: String(r.quantity) }))}
                                      style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', transition: '0.15s' }}
                                      title="Редагувати кількість"
                                      onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                                      onMouseLeave={e => e.currentTarget.style.color = '#555'}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                </span>
                              )}
                            </li>
                          )
                        })
                      })()}
                    </ul>
                    <button
                      disabled={isAwaiting || processingTasks.has(taskId)}
                      onClick={async () => {
                        if (isAwaiting || processingTasks.has(taskId)) return
                        
                        if (btnLabel === 'ПРИЙОМКА') {
                          setShowReception(true)
                          return
                        }

                        if (isAllIssued && missingItems.length === 0) {
                          setProcessingTasks(prev => new Set(prev).add(taskId))
                          try {
                            await approveWarehouse(taskId)
                          } finally {
                            setProcessingTasks(prev => {
                              const next = new Set(prev)
                              next.delete(taskId)
                              return next
                            })
                          }
                        } else {
                          handleReserveOrder(taskId, orderId, displayNum, reqList)
                        }
                      }}
                      style={{
                        width: '100%', padding: '12px',
                        background: btnColor, color: textColor,
                        border: isAwaiting ? '1px solid #222' : 'none',
                        borderRadius: '10px', fontWeight: 900,
                        cursor: (isAwaiting || processingTasks.has(taskId)) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem', textTransform: 'uppercase',
                        opacity: processingTasks.has(taskId) ? 0.5 : 1
                      }}
                    >
                      {processingTasks.has(taskId) ? 'ОБРОБКА...' : btnLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}



        {/* TABS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setNewItem({ ...newItem, type: tab.id, pocket_owner: '' })
                setSearchParams({ tab: tab.id })
                setSelectedPocketOwner('')
              }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: activeTab === tab.id ? '#ff9000' : '#111',
                color: activeTab === tab.id ? '#000' : '#555',
                border: '1px solid #222',
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: '0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  marginLeft: '5px',
                  background: activeTab === tab.id ? '#000' : '#ff9000',
                  color: activeTab === tab.id ? '#ff9000' : '#000',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  minWidth: '20px',
                  textAlign: 'center',
                  fontWeight: 1000,
                  boxShadow: activeTab === tab.id ? 'none' : '0 2px 5px rgba(255,144,0,0.3)'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* MAIN CARD */}
        <div className="content-card glass-panel" style={{ padding: '25px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
              {tabs.find(t => t.id === activeTab).label.toUpperCase()}
            </h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {activeTab === 'pocket' && (
                <select
                  value={selectedPocketOwner}
                  onChange={e => setSelectedPocketOwner(e.target.value)}
                  style={{ background: '#000', border: '1px solid #222', padding: '8px 12px', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="">Усі майстри</option>
                  {(managers || []).filter(m => m.toLowerCase().includes('майстер')).map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              )}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
                <input
                  style={{ background: '#000', border: '1px solid #222', padding: '8px 12px 8px 35px', borderRadius: '10px', color: '#fff', width: '180px' }}
                  placeholder="Пошук..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{ background: '#222', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer' }}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>



          {/* ADD ITEM FORM */}
          {showAdd && (
            <form
              onSubmit={handleAddInventory}
              className="stack-mobile"
              style={{ display: 'flex', gap: '10px', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}
            >
              <input
                style={{ flex: 2, minWidth: '200px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                placeholder="Назва товару..." value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })} required
              />
              <input
                style={{ flex: 1, minWidth: '100px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                type="number" placeholder="Кількість" value={newItem.total_qty}
                onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })} required
              />
              {activeTab === 'pocket' && (
                <select
                  value={newItem.pocket_owner || ''}
                  onChange={e => setNewItem({ ...newItem, pocket_owner: e.target.value })}
                  style={{ flex: 1, minWidth: '150px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                  required
                >
                  <option value="">-- Оберіть майстра --</option>
                  {(managers || []).filter(m => m.toLowerCase().includes('майстер')).map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              )}
              <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>
                ДОДАТИ
              </button>
            </form>
          )}

          {/* REGISTRY VIEW */}
          {activeTab === 'registry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {(receptionDocs || [])
                .filter(d => 
                  d.target_warehouse === 'operational' || 
                  d.source_warehouse === 'operational' || 
                  d.target_warehouse === 'pocket' || 
                  d.source_warehouse === 'pocket'
                )
                .map(doc => (
                <div key={doc.id} style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                    style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '12px', color: doc.status === 'completed' ? '#10b981' : '#ff9000' }}>
                        <Package size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{String(doc.id).substring(0, 8)}</div>
                        <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', 
                      padding: '5px 12px', borderRadius: '20px', 
                      background: doc.status === 'completed' ? '#10b98122' : '#ff900022',
                      color: doc.status === 'completed' ? '#10b981' : '#ff9000'
                    }}>
                      {doc.status === 'completed' ? 'ВИКОНАНО' : 'В ДОРОЗІ'}
                    </div>
                  </div>
                  
                  {expandedDoc === doc.id && (
                    <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #222' }}>
                      <div style={{ marginBottom: '15px' }}>
                        {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                          const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                          const itemName = nom ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : '')) : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
                          const itemQty = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity ?? '?'
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                              <span style={{ fontSize: '0.8rem', color: '#888' }}>{itemName}</span>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{itemQty}</strong>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(receptionDocs || []).filter(d => 
                d.target_warehouse === 'operational' || 
                d.source_warehouse === 'operational' || 
                d.target_warehouse === 'pocket' || 
                d.source_warehouse === 'pocket'
              ).length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Історія порожня</div>
              )}
            </div>
          )}

          {/* DESKTOP TABLE */}
          {activeTab !== 'registry' && (
            <>
              <div className="table-responsive-container hide-mobile">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                      <th className="sticky-col" style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>ВІЛЬНО</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'right' }}>ОСТАННЄ ОНОВЛЕННЯ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.85rem' }}>
                          Позицій не знайдено
                        </td>
                      </tr>
                    ) : activeTab === 'pocket' ? (
                      Object.entries(groupedPocketInventory).map(([owner, items]) => (
                        <React.Fragment key={owner}>
                          <tr style={{ background: 'rgba(255, 144, 0, 0.04)', borderBottom: '1px solid #222' }}>
                            <td colSpan={5} style={{ padding: '12px 15px', fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', letterSpacing: '0.03em' }}>
                              👤 МАЙСТЕР: {owner.toUpperCase()}
                            </td>
                          </tr>
                          {items.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                              <td className="sticky-col" style={{ padding: '15px 15px 15px 30px', fontWeight: 800 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{item.name}</span>
                                  {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingInvId(item.id)
                                        setEditingInvTotal(String(item.total_qty || 0))
                                        setEditingInvReserved(String(item.reserved_qty || 0))
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'inline-flex', padding: '4px' }}
                                      title="Редагувати запаси"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '15px', textAlign: 'center', color: '#ff9000', fontWeight: 900 }}>
                                {editingInvId === item.id ? (
                                  <input
                                    type="number"
                                    value={editingInvTotal}
                                    onChange={e => setEditingInvTotal(e.target.value)}
                                    style={{ width: '80px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                  />
                                ) : (
                                  <>
                                    {item.total_qty || 0}{' '}
                                    <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small>
                                  </>
                                )}
                              </td>
                              <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>
                                {editingInvId === item.id ? (Number(editingInvTotal) || 0) - (Number(editingInvReserved) || 0) : (item.total_qty || 0) - (item.reserved_qty || 0)}
                              </td>
                              <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
                                {editingInvId === item.id ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <input
                                      type="number"
                                      value={editingInvReserved}
                                      onChange={e => setEditingInvReserved(e.target.value)}
                                      style={{ width: '80px', background: '#000', border: '1px solid #3b82f6', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInventoryQty(item.id)}
                                      disabled={savingInv}
                                      style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#000', fontWeight: 900, cursor: 'pointer' }}
                                    >
                                      {savingInv ? '...' : <Check size={14} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingInvId(null)}
                                      style={{ background: '#222', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', cursor: 'pointer' }}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  item.reserved_qty || 0
                                )}
                              </td>
                              <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>
                                {item.updated_at
                                  ? `${new Date(item.updated_at).toLocaleDateString()} ${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredInventory.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                          <td className="sticky-col" style={{ padding: '15px', fontWeight: 800 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{item.name}</span>
                              {item.type?.startsWith('scrap') && (() => {
                                const types = {
                                  'scrap': { label: 'Прийомка', color: '#555' },
                                  'scrap_ready': { label: 'До обробки', color: '#ef4444' },
                                  'scrap_cat_1': { label: 'Кат. 1', color: '#10b981' },
                                  'scrap_cat_2': { label: 'Кат. 2', color: '#eab308' },
                                  'scrap_cat_3': { label: 'Кат. 3', color: '#f97316' },
                                  'scrap_cat_4': { label: 'Кат. 4', color: '#ef4444' },
                                }
                                const t = types[item.type] || { label: item.type, color: '#333' }
                                return (
                                  <span style={{ 
                                    fontSize: '0.6rem', color: t.color, 
                                    border: `1px solid ${t.color}40`, padding: '2px 6px', 
                                    borderRadius: '4px', textTransform: 'uppercase', fontWeight: 900
                                  }}>
                                    {t.label}
                                  </span>
                                )
                              })()}
                              {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingInvId(item.id)
                                    setEditingInvTotal(String(item.total_qty || 0))
                                    setEditingInvReserved(String(item.reserved_qty || 0))
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'inline-flex', padding: '4px' }}
                                  title="Редагувати запаси"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: activeTab === 'scrap' ? '#ef4444' : '#ff9000', fontWeight: 900 }}>
                            {editingInvId === item.id ? (
                              <input
                                type="number"
                                value={editingInvTotal}
                                onChange={e => setEditingInvTotal(e.target.value)}
                                style={{ width: '80px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                              />
                            ) : (
                              <>
                                {item.total_qty || 0}{' '}
                                <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small>
                              </>
                            )}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>
                            {editingInvId === item.id ? (Number(editingInvTotal) || 0) - (Number(editingInvReserved) || 0) : (item.total_qty || 0) - (item.reserved_qty || 0)}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
                            {editingInvId === item.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  value={editingInvReserved}
                                  onChange={e => setEditingInvReserved(e.target.value)}
                                  style={{ width: '80px', background: '#000', border: '1px solid #3b82f6', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInventoryQty(item.id)}
                                  disabled={savingInv}
                                  style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#000', fontWeight: 900, cursor: 'pointer' }}
                                >
                                  {savingInv ? '...' : <Check size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingInvId(null)}
                                  style={{ background: '#222', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', cursor: 'pointer' }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              item.reserved_qty || 0
                            )}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>
                            {item.updated_at
                              ? `${new Date(item.updated_at).toLocaleDateString()} ${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="mobile-only">
                {activeTab === 'pocket' ? (
                  Object.entries(groupedPocketInventory).map(([owner, items]) => (
                    <div key={owner} style={{ marginBottom: '20px' }}>
                      <div style={{ fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', marginBottom: '10px', padding: '8px 12px', background: 'rgba(255, 144, 0, 0.04)', borderRadius: '10px', letterSpacing: '0.03em' }}>
                        👤 МАЙСТЕР: {owner.toUpperCase()}
                      </div>
                      {items.map(item => (
                        <div key={item.id} style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                            <strong>{item.name}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
                              {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingInvId(item.id)
                                    setEditingInvTotal(String(item.total_qty || 0))
                                    setEditingInvReserved(String(item.reserved_qty || 0))
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '20px', flexDirection: editingInvId === item.id ? 'column' : 'row' }}>
                            {editingInvId === item.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                <div>
                                  <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>НАЯВНІСТЬ</label>
                                  <input
                                    type="number"
                                    value={editingInvTotal}
                                    onChange={e => setEditingInvTotal(e.target.value)}
                                    style={{ width: '100%', background: '#000', border: '1px solid #ff9000', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>РЕЗЕРВ</label>
                                  <input
                                    type="number"
                                    value={editingInvReserved}
                                    onChange={e => setEditingInvReserved(e.target.value)}
                                    style={{ width: '100%', background: '#000', border: '1px solid #3b82f6', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInventoryQty(item.id)}
                                    disabled={savingInv}
                                    style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                                  >
                                    {savingInv ? '...' : 'ЗБЕРЕГТИ'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingInvId(null)}
                                    style={{ flex: 1, background: '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    СКАСУВАТИ
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>
                                    {item.total_qty || 0}
                                  </div>
                                </div>
                                {activeTab !== 'bz' && (
                                  <div>
                                    <div style={{ fontSize: '0.6rem', color: '#555' }}>ВІЛЬНО</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                                      {(item.total_qty || 0) - (item.reserved_qty || 0)}
                                    </div>
                                  </div>
                                )}
                                {activeTab !== 'bz' && (
                                  <div>
                                    <div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{item.reserved_qty || 0}</div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  filteredInventory.map(item => (
                    <div key={item.id} style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <strong>{item.name}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
                          {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
                            <button
                              type="button"
                              onClick={() => {
                                  setEditingInvId(item.id)
                                  setEditingInvTotal(String(item.total_qty || 0))
                                  setEditingInvReserved(String(item.reserved_qty || 0))
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexDirection: editingInvId === item.id ? 'column' : 'row' }}>
                        {editingInvId === item.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>НАЯВНІСТЬ</label>
                              <input
                                type="number"
                                value={editingInvTotal}
                                onChange={e => setEditingInvTotal(e.target.value)}
                                style={{ width: '100%', background: '#000', border: '1px solid #ff9000', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>РЕЗЕРВ</label>
                              <input
                                type="number"
                                value={editingInvReserved}
                                onChange={e => setEditingInvReserved(e.target.value)}
                                style={{ width: '100%', background: '#000', border: '1px solid #3b82f6', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                              <button
                                type="button"
                                onClick={() => handleSaveInventoryQty(item.id)}
                                disabled={savingInv}
                                style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                              >
                                {savingInv ? '...' : 'ЗБЕРЕГТИ'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInvId(null)}
                                style={{ flex: 1, background: '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}
                              >
                                СКАСУВАТИ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>
                                {item.total_qty || 0}
                              </div>
                            </div>
                            {activeTab !== 'bz' && (
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#555' }}>ВІЛЬНО</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                                  {(item.total_qty || 0) - (item.reserved_qty || 0)}
                                </div>
                              </div>
                            )}
                            {activeTab !== 'bz' && (
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{item.reserved_qty || 0}</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SHORTAGE MODAL */}
      {shortages && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} /> ДЕФІЦИТ МАТЕРІАЛІВ
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '20px' }}>
              Для замовлення #{shortages.orderNum} не вистачає наступних позицій:
            </p>
            <div style={{ background: '#000', padding: '15px', borderRadius: '12px', marginBottom: '25px', maxHeight: '200px', overflowY: 'auto' }}>
              {shortages.items.map((i, idx) => (
                <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '12px', borderBottom: '1px solid #111', paddingBottom: '8px' }}>
                  <div style={{ fontWeight: 800, color: '#aaa', marginBottom: '5px' }}>{i.reqDetails}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', opacity: 0.8 }}>
                    <div style={{ fontSize: '0.65rem', color: '#555' }}>Потрібно: <strong style={{ color: '#888' }}>{Number(i.needed || 0)}</strong></div>
                    <div style={{ fontSize: '0.65rem', color: '#555' }}>На СО: <strong style={{ color: '#10b981' }}>{Number(i.needed - i.missingAmount)}</strong></div>
                    <div style={{ fontSize: '0.65rem', color: '#555' }}>На СВ (вільно): <strong style={{ color: '#3b82f6' }}>{Number(i.globalAvailable || 0)}</strong></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '5px', borderTop: '1px dashed #222' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#666' }}>ДЕФІЦИТ (ЗАПИТ НА СВ):</span>
                    <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>{Number(i.missingAmount || 0)} од.</strong>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShortages(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                НАЗАД
              </button>
              <button
                disabled={isProcessing}
                onClick={sendPurchaseRequest}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.5 : 1 }}
              >
                {isProcessing ? 'ОБРОБКА...' : 'НАДІСЛАТИ ЗАПИТ НА СВ'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SCANNED CARD MODAL */}
      {scannedCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '450px' }}>
            <h3 style={{ color: '#ff9000', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <QrCode size={24} /> ВИДАЧА ЗА КАРТКОЮ
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '15px' }}>
              Картка: <strong style={{ color: '#fff' }}>{scannedCard.card_info || `№${scannedCard.id}`}</strong>
            </p>
            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '20px' }}>
              Операція: <strong style={{ color: '#fff' }}>{scannedCard.operation}</strong> | Кількість: <strong style={{ color: '#fff' }}>{scannedCard.quantity} шт.</strong>
            </p>

            <div style={{ background: '#000', padding: '15px', borderRadius: '12px', marginBottom: '25px', maxHeight: '250px', overflowY: 'auto' }}>
              {scannedRequests.map((req, idx) => {
                const nom = (nomenclatures || []).find(n => n.id === req.nomenclature_id)
                const itemName = nom
                  ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : ''))
                  : (req.details || `Матеріал #${idx + 1}`)
                return (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111' }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#aaa' }}>{itemName}</div>
                      <div style={{ fontSize: '0.65rem', color: '#555' }}>Потреба: {req.displayQty || req.quantity} шт.</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: '0.65rem', fontWeight: 900, padding: '3px 8px', borderRadius: '4px',
                        background: req.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : (req.status === 'issued' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 144, 0, 0.15)'),
                        color: req.status === 'completed' ? '#10b981' : (req.status === 'issued' ? '#3b82f6' : '#ff9000')
                      }}>
                        {req.status === 'completed' ? 'ВИДАНО' : (req.status === 'issued' ? 'ЗАРЕЗЕРВОВАНО' : 'ОЧІКУЄ')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setScannedCard(null)
                  setScannedRequests([])
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                Закрити
              </button>
              {scannedRequests.some(r => r.status === 'pending' || r.status === 'issued') && (
                <button
                  disabled={isIssuingCard}
                  onClick={handleIssueCardMaterials}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ff9000', color: '#000', border: 'none', fontWeight: 900, cursor: isIssuingCard ? 'not-allowed' : 'pointer', opacity: isIssuingCard ? 0.5 : 1 }}
                >
                  {isIssuingCard ? 'ОБРОБКА...' : 'ВИДАТИ МАТЕРІАЛИ'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WarehouseModuleV2
