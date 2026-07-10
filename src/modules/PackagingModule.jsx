import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Package, ArrowLeft, ClipboardList, CheckCircle2, Box, Send, AlertCircle, Wrench, FileArchive, Layers, Clock, Scan, Loader2, Hash, Save, Eye, X, Menu, Plus, Search, Trash2, Sun, Moon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useMES } from '../MESContext'

// ─── Колір для номера коробки (щоб однакові коробки виділялись однаково) ───────
const BOX_COLORS = [
  '#a855f7','#f97316','#eab308','#22c55e','#06b6d4',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b',
  '#10b981','#6366f1','#d946ef','#84cc16','#0ea5e9'
]
function getBoxColor(boxNum) {
  if (!boxNum) return '#333'
  let hash = 0
  for (let i = 0; i < boxNum.length; i++) hash = boxNum.charCodeAt(i) + ((hash << 5) - hash)
  return BOX_COLORS[Math.abs(hash) % BOX_COLORS.length]
}

// ─── Detect category key from nomenclature ────────────────────────────────────
function detectCategoryKey(nom) {
  const name = (nom.name || '').toLowerCase()
  const type = (nom.type || '').toLowerCase()
  if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) return 'mounts'
  if (name.includes('стійка') || type.includes('стійк')) return 'spacers'
  if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) return 'other'
  if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка') || type.includes('hardware') || type.includes('fastener')) return 'hardware'
  if (name.includes('-іп') || name.includes(' іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) return 'sgp'
  return 'other'
}

function isFinishedComponent(nom) {
  const name = (nom?.name || '').toLowerCase()
  const code = (nom?.nomenclature_code || '').toLowerCase()
  const type = (nom?.type || '').toLowerCase()
  return name.includes('-іп') || name.includes(' іп') || code.includes('іп') ||
    type.includes('part') || type.includes('деталь') || type.includes('виріб') ||
    type.includes('product') || type.includes('сгп')
}

function isProductionOnlyMaterial(nom) {
  const name = (nom?.name || '').toLowerCase()
  const type = (nom?.type || '').toLowerCase()
  return name.includes('лист') || name.includes('sheet') || name.includes('фрез') ||
    type.includes('sheet') || type.includes('cutter')
}

const PackagingModule = () => {
  const location = useLocation()
  const {
    orders, tasks, nomenclatures, bomItems,
    submitPickingRequest, requests, supabase,
    fetchData, completePackaging, systemUsers,
    inventory, theme, toggleTheme
  } = useMES()

  const [selectedBatch, setSelectedBatch] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [excludedNomIds, setExcludedNomIds] = useState(new Set())
  // Кастомні кількості пакувальника: { [nomId]: number }
  const [customQty, setCustomQty] = useState({})
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // ─── Додаткові позиції (кастомні) ────────────────────────────────────────
  // [ { nom: NomObject, qty: number, categoryKey: string, uid: string } ]
  const [customItems, setCustomItems] = useState([])

  // ─── Модал додавання позиції ──────────────────────────────────────────────
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [addItemSearch, setAddItemSearch] = useState('')
  const [addItemQty, setAddItemQty] = useState(1)
  const [addItemSelectedNom, setAddItemSelectedNom] = useState(null)
  const [addItemCategoryKey, setAddItemCategoryKey] = useState('hardware')

  // Номери коробок: { [nomId]: boxNumber }
  const [boxNumbers, setBoxNumbers] = useState({})
  // Збережені коробки з БД: [ { nomenclature_id, box_number, quantity } ]
  const [savedBoxes, setSavedBoxes] = useState([])
  const [isSavingBoxes, setIsSavingBoxes] = useState(false)
  const [showBoxSummary, setShowBoxSummary] = useState(false)
  const [showPackerModal, setShowPackerModal] = useState(false)
  const [selectedPackerId, setSelectedPackerId] = useState('')

  const packersList = useMemo(() => {
    return (systemUsers || []).filter(u => {
      const pos = (u.position || '').toLowerCase()
      return pos.includes('пакув')
    })
  }, [systemUsers])

  useEffect(() => { 
    document.title = 'Відділ Пакування | Centrum'
    if (typeof fetchData === 'function') {
      fetchData()
    }
  }, [])

  // Скидаємо при зміні наряду
  useEffect(() => {
    setExcludedNomIds(new Set())
    setBoxNumbers({})
    setSavedBoxes([])
    setShowBoxSummary(false)
    setCustomQty({})
    setCustomItems([])
    if (selectedBatch) loadSavedBoxes(selectedBatch)
  }, [selectedBatch?.key])

  // Автовибір з пуш-навігації
  useEffect(() => {
    const tid = location.state?.highlightTaskId || location.state?.taskId
    if (tid && tasks && tasks.length > 0) {
      const task = tasks.find(t => String(t.id) === String(tid))
      if (task) {
        const bIdx = task.batch_index || ''
        const key = bIdx ? `${task.order_id}_${bIdx}` : `${task.order_id}_whole`
        setSelectedBatch({ key, orderId: task.order_id, batchIndex: bIdx })
      }
    }
  }, [location.state, tasks])

  // ─── ЗАВАНТАЖЕННЯ ЗБЕРЕЖЕНИХ КОРОБОК З БД ─────────────────────────────────
  const loadSavedBoxes = useCallback(async (batch) => {
    if (!batch) return
    try {
      let query = supabase
        .from('packaging_boxes')
        .select('*')
        .eq('order_id', batch.orderId);

      if (batch.batchIndex) {
        query = query.eq('batch_index', batch.batchIndex);
      } else {
        query = query.or('batch_index.is.null,batch_index.eq.,batch_index.eq.1');
      }

      const { data, error } = await query;

      if (error) { console.error('[Packaging] loadSavedBoxes error:', error); return }

      if (data && data.length > 0) {
        setSavedBoxes(data)
        const nums = {}
        data.forEach(b => { nums[String(b.nomenclature_id)] = b.box_number })
        setBoxNumbers(nums)
      }
    } catch (e) { console.error('[Packaging] loadSavedBoxes catch:', e) }
  }, [supabase])

  // ─── ЗБЕРЕЖЕННЯ КОРОБОК У БД ───────────────────────────────────────────────
  const handleSaveBoxes = async () => {
    if (!activeBatchData) return
    const hasAnyBoxNumber = Object.values(boxNumbers).some(v => v && v.trim())
    if (!hasAnyBoxNumber) {
      alert('Введіть хоча б один номер коробки')
      return
    }

    setIsSavingBoxes(true)
    try {
      const taskId = activeBatchData.tasks[0]?.id || null
      const batchIndex = activeBatchData.batchIndex || '1'

      const upsertRows = allBOMItems
        .filter(item => boxNumbers[String(item.nom.id)] && boxNumbers[String(item.nom.id)].trim())
        .map(item => ({
          order_id: activeBatchData.orderId,
          task_id: taskId,
          batch_index: batchIndex,
          box_number: boxNumbers[String(item.nom.id)].trim().toUpperCase(),
          nomenclature_id: item.nom.id,
          quantity: item.qty,
          updated_at: new Date().toISOString()
        }))

      if (upsertRows.length === 0) return

      const { error } = await supabase
        .from('packaging_boxes')
        .upsert(upsertRows, { onConflict: 'order_id,batch_index,nomenclature_id' })

      if (error) { console.error('[Packaging] upsert error:', error); alert('Помилка збереження: ' + error.message); return }

      // Перезавантажуємо
      await loadSavedBoxes(activeBatchData)
      alert(`✅ Збережено! ${upsertRows.length} позицій розподілено по коробках`)
    } catch (e) {
      console.error('[Packaging] handleSaveBoxes catch:', e)
      alert('Помилка збереження')
    } finally {
      setIsSavingBoxes(false)
    }
  }

  // ─── ГРУПУВАННЯ НАРЯДІВ ────────────────────────────────────────────────────
  const batchList = useMemo(() => {
    const relevantTasks = tasks.filter(t => t.status === 'completed' || t.plan_snapshot?._metadata?.is_packaged === true)
    const batchGroups = {}
    relevantTasks.forEach(task => {
      const order = orders.find(o => o.id === task.order_id)
      if (!order) return
      if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return
      const bIdx = task.batch_index || ''
      const key = bIdx ? `${task.order_id}_${bIdx}` : `${task.order_id}_whole`
      if (!batchGroups[key]) {
        const productNames = order.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'
        batchGroups[key] = { key, orderId: task.order_id, orderNum: order.order_num, customer: order.customer, productNames, batchIndex: bIdx, plannedSets: task.planned_sets || 0, isPackaged: task.plan_snapshot?._metadata?.is_packaged === true, tasks: [] }
      }
      batchGroups[key].tasks.push(task)
    })

    return Object.values(batchGroups).map(batch => {
      const batchBOM = []
      
      // 1. Add standard BOM items from order_items
      const order = orders.find(o => o.id === batch.orderId)
      const hasSnapshot = batch.tasks.some(t => t.plan_snapshot)
      order?.order_items?.forEach(item => {
        const children = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        if (children.length > 0) {
          children.forEach(b => {
            const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            const nameLower = nom?.name?.toLowerCase() || ''
            if (nom && !(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
              let snapFound = false
              batch.tasks.forEach(t => {
                if (t.plan_snapshot && t.plan_snapshot[nom.id]) snapFound = true
              })
              const isSgp = isFinishedComponent(nom)
              if (isSgp && hasSnapshot && !snapFound) return

              if (!batchBOM.includes(nom.id)) {
                batchBOM.push(nom.id)
              }
            }
          })
        } else {
          const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
          if (nom) {
            const nameLower = nom.name?.toLowerCase() || ''
            if (!(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
              if (!batchBOM.includes(nom.id)) {
                batchBOM.push(nom.id)
              }
            }
          }
        }
      })

      // 2. Add extra items from plan_snapshot of tasks
      const ignoreSnapshotKeys = ['materialSummary', 'selectedCutters', 'consumables', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'];
      batch.tasks.forEach(t => {
        if (t.plan_snapshot) {
          Object.keys(t.plan_snapshot).forEach(key => {
            if (!key.startsWith('_') && !ignoreSnapshotKeys.includes(key)) {
              const nom = nomenclatures.find(n => String(n.id) === String(key))
              if (nom) {
                const nameLower = nom.name?.toLowerCase() || ''
                if (!(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
                  const snapItem = t.plan_snapshot[key]
                  const belongsToPackaging = snapItem?.is_custom_packaging || isFinishedComponent(nom)
                  if (belongsToPackaging && !isProductionOnlyMaterial(nom) && !batchBOM.includes(nom.id)) {
                    batchBOM.push(nom.id)
                  }
                }
              }
            }
          })
        }
      })

      const batchReqs = (requests || []).filter(r => {
        if (String(r.order_id) !== String(batch.orderId)) return false
        if (!r.details?.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ')) return false
        const reqNom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id))
        if (reqNom && isProductionOnlyMaterial(reqNom)) return false
        const taskIdMatch = r.task_id && batch.tasks.some(t => String(t.id) === String(r.task_id))
        const detailsMatch = batch.batchIndex ? r.details?.includes(`/${batch.batchIndex}`) : false
        if (taskIdMatch || detailsMatch) return true
        const allTasksForOrder = tasks.filter(t => String(t.order_id) === String(batch.orderId))
        if (allTasksForOrder.length <= 1 && r.details?.includes('КОМПЛЕКТУВАННЯ')) return true
        return false
      })

      let packStatus = 'waiting'
      if (batch.isPackaged) packStatus = 'completed'
      else if (batchReqs.length === 0) packStatus = 'waiting'
      else {
        const confirmedNoms = new Set(batchReqs.filter(r => r.status === 'completed' || r.status === 'issued').map(r => String(r.nomenclature_id)))
        const allCovered = batchBOM.length > 0 && batchBOM.every(id => confirmedNoms.has(String(id)))
        
        if (allCovered) {
          packStatus = 'ready'
        } else {
          // Check if we actually have sent the kitting request (it would show up as pending or processing)
          const hasPendingKitting = batchReqs.some(r => r.details?.includes('КОМПЛЕКТУВАННЯ') && (r.status === 'pending' || r.status === 'processing'))
          packStatus = hasPendingKitting ? 'processing' : 'waiting'
        }
      }
      return { ...batch, packStatus }
    }).sort((a, b) => {
      const w = { ready: 0, processing: 1, waiting: 2, completed: 3 }
      if (w[a.packStatus] !== w[b.packStatus]) return w[a.packStatus] - w[b.packStatus]
      return b.orderNum.localeCompare(a.orderNum)
    })
  }, [tasks, orders, requests, bomItems, nomenclatures])

  const activeQueueCount = useMemo(() => {
    return batchList.filter(b => b.packStatus !== 'completed').length
  }, [batchList])

  const activeBatchData = useMemo(() => {
    if (!selectedBatch) return null
    return batchList.find(b => b.key === selectedBatch.key)
  }, [selectedBatch, batchList])

  // ─── BOM ──────────────────────────────────────────────────────────────────
  const { categorizedBOM } = useMemo(() => {
    if (!activeBatchData) return { categorizedBOM: {}, hasBOM: false }
    const map = {}
    let foundAnyBom = false
    const hasSnapshot = activeBatchData.tasks.some(t => t.plan_snapshot)

    const order = orders.find(o => o.id === activeBatchData.orderId)
    if (order && order.order_items) {
      order.order_items.forEach(item => {
        const parentBOM = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        
        if (parentBOM.length > 0) {
          foundAnyBom = true
          parentBOM.forEach(b => {
            const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            if (nom) {
              const nameLower = nom.name?.toLowerCase() || ''
              if (nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка'))) return
              
              // Find quantity
              let qty = 0
              let snapFound = false
              activeBatchData.tasks.forEach(t => {
                if (t.plan_snapshot && t.plan_snapshot[nom.id]) {
                  const snapItem = t.plan_snapshot[nom.id]
                  if (snapItem && typeof snapItem === 'object') {
                    qty = Math.max(qty, Number(snapItem.need) || 0)
                    snapFound = true
                  }
                }
              })
              
              // Для деталей фінальний список диктує snapshot з /master:
              // видалені не повертаються з BOM, замінені приходять новим ключем,
              // додані позиції додаються нижче з plan_snapshot.
              const isSgp = isFinishedComponent(nom)
              if (isSgp && hasSnapshot && !snapFound) return

              if (!snapFound) {
                qty = Number(b.quantity_per_parent) * Number(activeBatchData.plannedSets)
              }
              
              if (!map[nom.id]) map[nom.id] = { nom, qty: 0, sourceKind: isSgp ? 'sgp' : 'operational' }
              map[nom.id].qty = Math.max(map[nom.id].qty, qty)
            }
          })
        } else {
          // If no BOM, show the order item itself
          const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
          if (nom) {
            let qty = 0
            let snapFound = false
            let isCustomPkg = false
            activeBatchData.tasks.forEach(t => {
              if (t.plan_snapshot && t.plan_snapshot[nom.id]) {
                const snapItem = t.plan_snapshot[nom.id]
                if (snapItem && typeof snapItem === 'object') {
                  qty = Math.max(qty, Number(snapItem.need) || 0)
                  snapFound = true
                  if (snapItem.is_custom_packaging) isCustomPkg = true
                }
              }
            })
            if (!snapFound) {
              qty = Number(item.quantity)
            }
            if (!map[nom.id]) map[nom.id] = { nom, qty: 0, sourceKind: isFinishedComponent(nom) ? 'sgp' : 'operational' }
            map[nom.id].qty = Math.max(map[nom.id].qty, qty)
            if (isCustomPkg) map[nom.id].isCustom = true
          }
        }
      })
    }

    // Now, also check if there is anything in plan_snapshot that was NOT in the BOM (e.g. custom parts added during launch)
    const ignoreSnapshotKeys = ['materialSummary', 'selectedCutters', 'consumables', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'];
    activeBatchData.tasks.forEach(t => {
      if (t.plan_snapshot) {
        Object.keys(t.plan_snapshot).forEach(key => {
          if (!key.startsWith('_') && !ignoreSnapshotKeys.includes(key)) {
            const snapItem = t.plan_snapshot[key]
            if (!snapItem || typeof snapItem !== 'object') return
            if (!map[key]) {
              const nom = nomenclatures.find(n => String(n.id) === String(key)) || {
                id: snapItem.id,
                name: snapItem.name,
                nomenclature_code: snapItem.code,
                material_type: snapItem.material,
                type: 'part'
              }
              const nameLower = nom.name?.toLowerCase() || ''
              if (nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка'))) return
              const isCustomPackaging = snapItem.is_custom_packaging === true
              if (isProductionOnlyMaterial(nom)) return
              if (!isCustomPackaging && !isFinishedComponent(nom)) return
              const qty = Number(snapItem.need) || 0
              map[key] = {
                nom,
                qty,
                isCustom: isCustomPackaging,
                sourceKind: isCustomPackaging && isFinishedComponent(nom) ? 'bz' : (isFinishedComponent(nom) ? 'sgp' : 'operational')
              }
            }
          }
        })
      }
    })

    // Add any items from requests that are not in the BOM or snapshots (sync across terminals)
    if (activeBatchData) {
      const relevant = (requests || []).filter(r =>
        String(r.order_id) === String(activeBatchData.orderId) &&
        r.details?.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') &&
        ((activeBatchData.batchIndex && r.details?.includes(`/${activeBatchData.batchIndex}`)) || activeBatchData.tasks.some(t => String(t.id) === String(r.task_id)))
      )
      relevant.forEach(r => {
        const nomIdStr = String(r.nomenclature_id)
        if (!map[nomIdStr]) {
          const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
          if (nom && !isProductionOnlyMaterial(nom)) {
            if (hasSnapshot && isFinishedComponent(nom)) return
            const sourceMatch = r.details?.match(/\[PACKAGING_SOURCE:(SGP|BZ|SO)\]/)
            const sourceKind = sourceMatch?.[1] === 'BZ' ? 'bz' : sourceMatch?.[1] === 'SO' ? 'operational' : (isFinishedComponent(nom) ? 'sgp' : 'operational')
            map[nomIdStr] = { nom, qty: Number(r.quantity) || 0, isCustom: r.details?.includes('[PACKAGING_CUSTOM]'), sourceKind }
          }
        }
      })
    }

    const categories = {
      sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', items: [], color: '#f43f5e', icon: <Package size={18} /> },
      mounts: { title: '2. КРІПЛЕННЯ / 3Д ДРУК', items: [], color: '#eab308', icon: <Layers size={18} /> },
      hardware: { title: '3. МЕТИЗИ (Гвинти/Гайки)', items: [], color: '#06b6d4', icon: <Wrench size={18} /> },
      spacers: { title: '4. СТІЙКИ', items: [], color: '#8b5cf6', icon: <Layers size={18} /> },
      other: { title: '5. НАКЛАДКИ / ТРИМАЧІ / УПАКОВКА', items: [], color: '#3b82f6', icon: <FileArchive size={18} /> }
    }

    Object.values(map).forEach(item => {
      const type = (item.nom.type || '').toLowerCase()
      const name = (item.nom.name || '').toLowerCase()
      const code = (item.nom.nomenclature_code || '').toLowerCase()
      if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categories.mounts.items.push(item)
      else if (name.includes('стійка') || type.includes('стійк')) categories.spacers.items.push(item)
      else if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) categories.other.items.push(item)
      else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка') || type.includes('hardware') || type.includes('fastener')) categories.hardware.items.push(item)
      else if (isFinishedComponent(item.nom)) categories.sgp.items.push(item)
      else categories.other.items.push(item)
    })

    // Inject custom items added by packer
    customItems.forEach(ci => {
      const catKey = ci.categoryKey
      if (categories[catKey]) {
        categories[catKey].items.push({ nom: ci.nom, qty: ci.qty, isCustom: true, uid: ci.uid })
      }
    })

    return { categorizedBOM: categories, hasBOM: foundAnyBom }
  }, [activeBatchData, orders, bomItems, nomenclatures, customItems, requests])

  const allBOMItems = useMemo(() => Object.values(categorizedBOM).flatMap(c => c.items), [categorizedBOM])

  const { orderRequests, isReadyToFinalize, hasAnyRequests } = useMemo(() => {
    if (!activeBatchData) return { orderRequests: [], completedRequestsCount: 0, isReadyToFinalize: false, hasAnyRequests: false }
    const relevant = (requests || []).filter(r =>
      String(r.order_id) === String(activeBatchData.orderId) &&
      r.details?.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') &&
      !isProductionOnlyMaterial(nomenclatures.find(n => String(n.id) === String(r.nomenclature_id))) &&
      ((activeBatchData.batchIndex && r.details?.includes(`/${activeBatchData.batchIndex}`)) || activeBatchData.tasks.some(t => String(t.id) === String(r.task_id)))
    )
    const confirmedNoms = new Set(relevant.filter(r => r.status === 'completed' || r.status === 'issued').map(r => String(r.nomenclature_id)))
    const activeBOMItems = allBOMItems.filter(item => !excludedNomIds.has(item.nom.id))
    const is100PercentCovered = activeBOMItems.length > 0 && activeBOMItems.every(req => confirmedNoms.has(String(req.nom.id)))
    // hasAnyRequests: тільки активні запити (pending/processing), не завершені
    const activeRequests = relevant.filter(r => r.status === 'pending' || r.status === 'processing')
    return { orderRequests: relevant, completedRequestsCount: relevant.filter(r => r.status === 'completed' || r.status === 'issued').length, isReadyToFinalize: is100PercentCovered, hasAnyRequests: activeRequests.length > 0 }
  }, [activeBatchData, requests, allBOMItems, excludedNomIds, nomenclatures])

  // Чи підтверджено склад (всі позиції issued/completed)
  const isWarehouseConfirmed = isReadyToFinalize

  // Підтверджені складом позиції які ще не мають номера коробки
  const pickedItemsWithoutBox = useMemo(() => {
    if (!isWarehouseConfirmed) return []
    return allBOMItems.filter(item => {
      const reqRequest = orderRequests.find(r => String(r.nomenclature_id) === String(item.nom.id))
      const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
      const isExcluded = excludedNomIds.has(item.nom.id)
      if (!isPicked || isExcluded) return false
      const boxNum = boxNumbers[String(item.nom.id)]
      return !boxNum || !boxNum.trim()
    })
  }, [isWarehouseConfirmed, allBOMItems, orderRequests, excludedNomIds, boxNumbers])

  const allBoxesFilled = isWarehouseConfirmed && pickedItemsWithoutBox.length === 0

  // Зведення по коробках
  const boxSummary = useMemo(() => {
    const map = {}
    allBOMItems.forEach(item => {
      const boxNum = boxNumbers[String(item.nom.id)]
      if (!boxNum || !boxNum.trim()) return
      const key = boxNum.trim().toUpperCase()
      if (!map[key]) map[key] = { boxNumber: key, items: [] }
      map[key].items.push({ nom: item.nom, qty: item.qty })
    })
    return Object.values(map).sort((a, b) => a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true }))
  }, [boxNumbers, allBOMItems])

  // ─── Пошук для модалу додавання ─────────────────────────────────────────
  const addItemSearchResults = useMemo(() => {
    const trimmed = addItemSearch.trim()
    if (!trimmed) return []
    const q = trimmed.toLowerCase()
    return (nomenclatures || [])
      .filter(n => {
        const name = (n.name || '').toLowerCase()
        const aliases = (n.aliases || '').toLowerCase()
        const code = (n.nomenclature_code || '').toLowerCase()
        const desc = (n.description || '').toLowerCase()
        return name.includes(q) || aliases.includes(q) || code.includes(q) || desc.includes(q)
      })
      .slice(0, 15)
  }, [nomenclatures, addItemSearch])

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleCreateRequest = async () => {
    setIsProcessing(true)
    try {
      // Спочатку підтягуємо найсвіжіші запити
      await fetchData('material_requests')

      const activeBOMItems = allBOMItems.filter(item => {
        const isExcluded = excludedNomIds.has(item.nom.id)
        // Шукаємо будь-який активний чи завершений запит по цьому виробу в межах наряду
        const hasReq = (requests || []).some(r =>
          String(r.order_id) === String(activeBatchData.orderId) &&
          String(r.nomenclature_id) === String(item.nom.id) &&
          r.details?.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') &&
          activeBatchData.tasks.some(t => String(t.id) === String(r.task_id)) &&
          ['pending', 'processing', 'completed', 'issued'].includes(r.status)
        )
        return !isExcluded && !hasReq
      })

      if (activeBOMItems.length === 0) {
        alert('Немає нових деталей для комплектування (всі інші позиції вже були надіслані раніше або підтверджені)');
        return
      }

      const itemsToRequest = activeBOMItems.map(r => {
        const effectiveQty = customQty[String(r.nom.id)] !== undefined ? Number(customQty[String(r.nom.id)]) : r.qty
        return {
          nomId: r.nom.id,
          name: r.nom.material_type ? `${r.nom.name} (${r.nom.material_type})` : r.nom.name,
          qty: effectiveQty,
          packagingSource: r.sourceKind || (isFinishedComponent(r.nom) ? 'sgp' : 'operational'),
          isCustomPackaging: r.isCustom === true
        }
      })

      await submitPickingRequest(activeBatchData.orderId, itemsToRequest, activeBatchData.tasks[0]?.id)
      alert('Запит успішно відправлено!')
      await fetchData('material_requests')
    } catch (e) {
      console.error(e)
      alert('Помилка створення запиту')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCompleteClick = () => {
    if (!activeBatchData) return
    if (!allBoxesFilled) {
      alert('Будь ласка, вкажіть номери коробок для всіх позицій.')
      return
    }
    setShowPackerModal(true)
  }

  const saveBoxesToDB = async () => {
    if (!activeBatchData) return true
    const taskId = activeBatchData.tasks[0]?.id || null
    const batchIndex = activeBatchData.batchIndex || '1'
    const upsertRows = allBOMItems
      .filter(item => boxNumbers[String(item.nom.id)] && boxNumbers[String(item.nom.id)].trim())
      .map(item => ({
        order_id: activeBatchData.orderId,
        task_id: taskId,
        batch_index: batchIndex,
        box_number: boxNumbers[String(item.nom.id)].trim().toUpperCase(),
        nomenclature_id: item.nom.id,
        quantity: item.qty,
        updated_at: new Date().toISOString()
      }))

    if (upsertRows.length === 0) return true
    const { error } = await supabase
      .from('packaging_boxes')
      .upsert(upsertRows, { onConflict: 'order_id,batch_index,nomenclature_id' })
    if (error) {
      console.error('[Packaging] auto-save boxes error:', error)
      return false
    }
    return true
  }

  const handleCompletePackaging = async (packer) => {
    if (!packer) return
    setShowPackerModal(false)
    setSelectedPackerId('')
    try {
      setIsProcessing(true)

      // 1. Спочатку автоматично зберігаємо коробки в базу
      const savedOk = await saveBoxesToDB()
      if (!savedOk) {
        alert('Помилка автоматичного збереження коробок в базу. Спробуйте ще раз.')
        return
      }

      // 2. Закриваємо наряд і записуємо пакувальника в метадані
      const packerName = `${packer.first_name || ''} ${packer.last_name || ''}`.trim() || packer.login

      for (const task of activeBatchData.tasks) {
        const newSnapshot = { 
          ...(task.plan_snapshot || {}), 
          _metadata: { 
            ...(task.plan_snapshot?._metadata || {}), 
            is_packaged: true, 
            packaged_at: new Date().toISOString(),
            packaged_by: packerName,
            packaged_by_id: packer.id
          } 
        }
        await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', task.id)
      }

      alert('Наряд успішно запаковано!')
      setSelectedBatch(null)
      await fetchData(['tasks', 'orders'])
      
      const { data: freshTasks } = await supabase.from('tasks').select('id, status, plan_snapshot, planned_sets').eq('order_id', activeBatchData.orderId)
      const allTasksPackaged = (freshTasks || []).every(t => t.plan_snapshot?._metadata?.is_packaged === true)
      const totalPlanned = (freshTasks || []).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0)
      const totalOrderQty = orders.find(o => o.id === activeBatchData.orderId)?.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0
      
      if (allTasksPackaged && totalPlanned >= totalOrderQty) {
        await completePackaging(activeBatchData.orderId)
      } else {
        await supabase.from('orders').update({ status: 'in-progress' }).eq('id', activeBatchData.orderId)
      }
    } catch (e) { 
      console.error(e)
      alert('Помилка при закритті пакування') 
    } finally { 
      setIsProcessing(false) 
    }
  }

  // ─── Додавання кастомної позиції ─────────────────────────────────────────
  const handleOpenAddItemModal = () => {
    setAddItemSearch('')
    setAddItemQty(1)
    setAddItemSelectedNom(null)
    setAddItemCategoryKey('hardware')
    setShowAddItemModal(true)
  }

  const handleConfirmAddItem = async () => {
    if (!addItemSelectedNom || !addItemQty || !activeBatchData) return
    const firstTask = activeBatchData.tasks[0]
    if (!firstTask) return

    // Don't add if already in BOM from spec
    const existsInBOM = allBOMItems.some(item => String(item.nom.id) === String(addItemSelectedNom.id) && !item.isCustom)
    if (existsInBOM) {
      alert(`"${addItemSelectedNom.name}" вже є в специфікації. Щоб змінити кількість — відредагуйте поле кількості напроти цієї позиції.`)
      return
    }

    setIsProcessing(true)
    try {
      const snap = { ...(firstTask.plan_snapshot || {}) }
      snap[addItemSelectedNom.id] = {
        need: Number(addItemQty),
        is_custom_packaging: true
      }

      const { error } = await supabase
        .from('tasks')
        .update({ plan_snapshot: snap })
        .eq('id', firstTask.id)

      if (error) throw error

      const requestName = addItemSelectedNom.material_type
        ? `${addItemSelectedNom.name} (${addItemSelectedNom.material_type})`
        : addItemSelectedNom.name

      // A custom packaging position is an actual picking need, not only a
      // plan-snapshot decoration. Send it to the warehouse immediately.
      await submitPickingRequest(activeBatchData.orderId, [{
        nomId: addItemSelectedNom.id,
        name: requestName,
        qty: Number(addItemQty),
        packagingSource: isFinishedComponent(addItemSelectedNom) ? 'bz' : 'operational',
        isCustomPackaging: true
      }], firstTask.id)

      await Promise.all([
        fetchData('tasks'),
        fetchData('material_requests')
      ])
      setShowAddItemModal(false)
    } catch (e) {
      console.error(e)
      alert('Помилка додавання позиції: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveCustomItem = (uid) => {
    setCustomItems(prev => prev.filter(ci => ci.uid !== uid))
  }

  const getIconForType = (nom) => {
    const name = (nom.name || '').toLowerCase()
    const type = (nom.type || '').toLowerCase()
    if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) return <Layers size={16} color="#eab308" />
    if (name.includes('стійка')) return <Layers size={16} color="#8b5cf6" />
    if (name.includes('гвинт') || name.includes('гайка') || type.includes('метиз') || type.includes('hardware') || type.includes('fastener')) return <Wrench size={16} color="#06b6d4" />
    if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) return <FileArchive size={16} color="#3b82f6" />
    if (name.includes('-іп') || name.includes(' іп') || type.includes('part') || type.includes('деталь')) return <Package size={16} color="#f43f5e" />
    return <Box size={16} color="#444" />
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="packaging-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>

      <nav className="module-nav module-nav-container" style={{ flexShrink: 0, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800 }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">НА ГОЛОВНУ</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled mobile-only">
            <Menu size={20} />
            <span>Черга</span>
            {activeQueueCount > 0 && (
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
                {activeQueueCount}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#f43f5e', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={18} color="#fff" />
          </div>
          <div>
            <h1 className="nav-title" style={{ fontSize: '0.95rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px', lineHeight: 1.1 }}>ВІДДІЛ ПАКУВАННЯ</h1>
            <div className="nav-subtitle" style={{ fontSize: '0.58rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.3px', lineHeight: 1 }}>Контроль комплектування партій</div>
          </div>
        </div>
      </nav>

      <div className="module-content module-content-container" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="master-grid" style={{ maxWidth: '1600px', margin: '0 auto', height: 'calc(100vh - 140px)' }}>

          {isDrawerOpen && (
            <div 
              className="drawer-backdrop" 
              onClick={() => setIsDrawerOpen(false)} 
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, backdropFilter: 'blur(4px)' }}
            />
          )}

          {/* SIDEBAR */}
          <div className={`side-panel glass-panel ${isDrawerOpen ? 'drawer-open' : ''}`} style={{ background: '#0a0a0a', padding: '25px', borderRadius: '28px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <ClipboardList size={22} color="#f43f5e" />
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase' }}>Черга нарядів</h3>
              <span style={{ background: '#f43f5e22', color: '#f43f5e', padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950 }}>{batchList.length}</span>
              {isDrawerOpen && (
                <button onClick={() => setIsDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
              {batchList.map(batch => {
                const isSelected = selectedBatch?.key === batch.key
                const isCompleted = batch.packStatus === 'completed'
                const isReady = batch.packStatus === 'ready'
                const isProc = batch.packStatus === 'processing'
                let statusColor = '#eab308', statusBg = '#eab30815', statusLabel = 'ОЧІКУЄ ЗАПИТУ'
                if (isCompleted) { statusColor = '#666'; statusBg = '#111'; statusLabel = 'ЗАПАКОВАНО' }
                else if (isReady) { statusColor = '#10b981'; statusBg = '#10b98115'; statusLabel = 'ГОТОВО ДО ПАКУВАННЯ' }
                else if (isProc) { statusColor = '#3b82f6'; statusBg = '#3b82f615'; statusLabel = 'ЗАПИТ В ОБРОБЦІ' }
                return (
                  <div key={batch.key} onClick={() => { setSelectedBatch(batch); setIsDrawerOpen(false); }} className={`pack-order-card ${isReady ? 'ready-pulse' : ''}`}
                    style={{ flexShrink: 0, padding: '14px 16px 14px 20px', background: isSelected ? `${statusColor}12` : (isCompleted ? '#060608' : '#0e0e10'), border: `1px solid ${isSelected ? statusColor : '#18181b'}`, borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', opacity: isCompleted ? 0.4 : 1, filter: isCompleted ? 'grayscale(1)' : 'none', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: statusColor, boxShadow: isSelected ? `2px 0 10px ${statusColor}44` : 'none' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: isSelected ? '#fff' : '#e4e4e7' }}>№ {batch.orderNum}{batch.batchIndex ? `/${batch.batchIndex}` : ''}</div>
                      <div style={{ background: statusBg, padding: '3px 6px', borderRadius: '6px', fontSize: '0.52rem', color: statusColor, fontWeight: 950, display: 'flex', alignItems: 'center', gap: '3px', border: `1px solid ${statusColor}22` }}>
                        {isCompleted ? <CheckCircle2 size={8} /> : (isReady ? <Scan size={8} /> : <Clock size={8} />)} {statusLabel}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: isSelected ? '#fff' : '#a1a1aa', fontWeight: 700, marginBottom: '2px' }}>{batch.customer}</div>
                    <div style={{ fontSize: '0.92rem', color: '#ff9000', fontWeight: 900, marginBottom: '10px', lineHeight: 1.2 }}>{batch.productNames}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #18181b', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#52525b', fontWeight: 800 }}>ОБСЯГ:</span>
                      <span style={{ fontSize: '0.88rem', color: '#10b981', fontWeight: 900 }}>{batch.plannedSets} шт</span>
                    </div>
                  </div>
                )
              })}
              {batchList.length === 0 && (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#333', border: '2px dashed #151515', borderRadius: '24px' }}>
                  <Package size={48} style={{ opacity: 0.1, margin: '0 auto 20px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>Черга порожня</div>
                </div>
              )}
            </div>
          </div>

          {/* MAIN AREA */}
          <div className="order-details-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {activeBatchData ? (
              <div className="glass-panel details-panel" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* HEADER */}
                <div className="detail-header-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                      <h2 className="order-detail-title" style={{ margin: 0, fontWeight: 1000, color: '#fff', letterSpacing: '-1px' }}>Наряд № {activeBatchData.orderNum}{activeBatchData.batchIndex ? `/${activeBatchData.batchIndex}` : ''}</h2>
                      <span style={{ background: '#f43f5e', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 950 }}>ПАКУВАННЯ</span>
                      {isWarehouseConfirmed && (
                        <span style={{ background: '#10b98122', color: '#10b981', padding: '4px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #10b98133', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={14} /> СКЛАД ПІДТВЕРДИВ
                        </span>
                      )}
                    </div>
                    <p className="detail-customer-text" style={{ margin: 0, color: '#555', fontSize: '1rem', fontWeight: 600 }}>Замовник: <strong style={{ color: '#888' }}>{activeBatchData.customer}</strong></p>
                    <p className="detail-product-text" style={{ margin: '4px 0 0 0', color: '#555', fontSize: '1rem', fontWeight: 600 }}>Виріб: <strong style={{ color: '#ff9000' }}>{activeBatchData.productNames}</strong></p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                    <div className="volume-box" style={{ border: '1px solid #1a1a1a' }}>
                      <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>Обсяг пакування</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#10b981' }}>{activeBatchData.plannedSets} <span style={{ fontSize: '0.85rem', color: '#444' }}>шт.</span></div>
                    </div>
                    {/* Кнопка перегляду зведення по коробках */}
                    {boxSummary.length > 0 && (
                      <button
                        onClick={() => setShowBoxSummary(v => !v)}
                        style={{ padding: '10px 16px', background: showBoxSummary ? '#f43f5e22' : '#111', border: `1px solid ${showBoxSummary ? '#f43f5e' : '#222'}`, borderRadius: '12px', color: showBoxSummary ? '#f43f5e' : '#888', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
                        <Eye size={16} /> {showBoxSummary ? 'СПИСОК BOM' : `ЗМІСТ КОРОБОК (${boxSummary.length})`}
                      </button>
                    )}
                  </div>
                </div>

                {/* BOM / BOX SUMMARY */}
                <div className="bom-container" style={{ background: '#070707', borderRadius: '28px', padding: '25px', flex: 1, border: '1px solid #151515', marginBottom: '20px', overflowY: 'auto' }}>

                  {/* ─── РЕЖИМ ПЕРЕГЛЯДУ КОРОБОК ─── */}
                  {showBoxSummary ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                        <Hash size={20} color="#f43f5e" />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Зміст коробок</h3>
                        <span style={{ marginLeft: 'auto', color: '#444', fontSize: '0.8rem', fontWeight: 800 }}>{boxSummary.length} КОРОБОК</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                        {boxSummary.map(box => {
                          const color = getBoxColor(box.boxNumber)
                          return (
                            <div key={box.boxNumber} style={{ background: '#0d0d0d', border: `2px solid ${color}44`, borderRadius: '20px', overflow: 'hidden' }}>
                              <div style={{ background: `${color}18`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${color}33` }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Package size={16} color="#fff" />
                                </div>
                                <span style={{ fontSize: '1rem', fontWeight: 1000, color: '#fff' }}>Коробка {box.boxNumber}</span>
                                <span style={{ marginLeft: 'auto', background: '#111', color: color, padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 950 }}>{box.items.length} поз.</span>
                              </div>
                              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {box.items.map((it, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#bbb', fontWeight: 600, lineHeight: 1.3 }}>{it.nom.name}</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 1000, color: color, marginLeft: '10px', flexShrink: 0 }}>{it.qty} <span style={{ fontSize: '0.65rem', color: '#555' }}>{it.nom.unit || 'шт'}</span></span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    /* ─── СПИСОК BOM З ПОЛЯМИ НОМЕРІВ КОРОБОК ─── */
                    <>
                      {Object.entries(categorizedBOM).map(([key, cat]) => {
                        if (cat.items.length === 0 && hasAnyRequests) return null
                        return (
                          <div key={key} style={{ marginBottom: '35px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: `1px solid ${cat.color}22`, paddingBottom: '10px' }}>
                              <div style={{ color: cat.color }}>{cat.icon}</div>
                              <h4 style={{ margin: 0, fontSize: '0.85rem', color: cat.color, fontWeight: 900, letterSpacing: '1px' }}>{cat.title}</h4>
                              <span style={{ marginLeft: 'auto', color: '#333', fontSize: '0.75rem', fontWeight: 800 }}>{cat.items.length} ПОЗИЦІЙ</span>
                              {/* ─── Кнопка + Додати позицію ─── */}
                              {!activeBatchData.isPackaged && (
                                <button
                                  onClick={() => {
                                    setAddItemCategoryKey(key)
                                    setAddItemSearch('')
                                    setAddItemQty(1)
                                    setAddItemSelectedNom(null)
                                    setShowAddItemModal(true)
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    background: `${cat.color}14`,
                                    border: `1px solid ${cat.color}33`,
                                    borderRadius: '8px',
                                    color: cat.color,
                                    fontSize: '0.7rem',
                                    fontWeight: 900,
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    letterSpacing: '0.3px'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = `${cat.color}25`; e.currentTarget.style.borderColor = `${cat.color}66` }}
                                  onMouseLeave={e => { e.currentTarget.style.background = `${cat.color}14`; e.currentTarget.style.borderColor = `${cat.color}33` }}
                                >
                                  <Plus size={12} /> ДОДАТИ
                                </button>
                              )}
                            </div>

                            {cat.items.length === 0 ? (
                              <div style={{ padding: '16px', textAlign: 'center', color: '#333', border: '1px dashed #1a1a1a', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                Немає позицій у цій категорії
                              </div>
                            ) : (
                              <div className="bom-required-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                                {cat.items.map((item, idx) => {
                                  const reqRequest = orderRequests.find(r => String(r.nomenclature_id) === String(item.nom.id))
                                  const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
                                  const isPending = reqRequest?.status === 'pending'
                                  const isExcluded = excludedNomIds.has(item.nom.id)
                                  const canToggle = !hasAnyRequests && !activeBatchData.isPackaged && !isPicked
                                  const boxNum = boxNumbers[String(item.nom.id)] || ''
                                  const boxColor = getBoxColor(boxNum)
                                  const hasBox = boxNum.trim() !== ''

                                  return (
                                    <div key={item.uid || idx} style={{
                                      background: isExcluded ? 'rgba(26,26,26,0.3)' : (isPicked ? '#10b98108' : (isPending ? '#eab30805' : (item.isCustom ? '#06b6d408' : '#0d0d0d'))),
                                      borderRadius: '16px',
                                      border: `1px solid ${isExcluded ? '#222' : (hasBox && isPicked ? boxColor + '55' : (isPicked ? '#10b98144' : (isPending ? '#eab30833' : (item.isCustom ? '#06b6d433' : '#1a1a1a'))))}`,
                                      transition: '0.25s',
                                      overflow: 'hidden',
                                      opacity: isExcluded ? 0.35 : 1,
                                      position: 'relative'
                                    }}>
                                      {/* Custom badge */}
                                      {item.isCustom && (
                                        <div style={{
                                          position: 'absolute', top: '6px', right: '6px',
                                          background: '#06b6d422',
                                          border: '1px solid #06b6d444',
                                          borderRadius: '6px',
                                          color: '#06b6d4',
                                          fontSize: '0.55rem',
                                          fontWeight: 900,
                                          padding: '2px 6px',
                                          letterSpacing: '0.5px'
                                        }}>ДОДАНО</div>
                                      )}

                                      {/* Верхня частина — назва + кількість */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 14px 10px' }}>
                                        {/* Чекбокс або статус */}
                                        {!isPicked ? (
                                          <div onClick={() => {
                                            if (!canToggle) return
                                            const ns = new Set(excludedNomIds)
                                            ns.has(item.nom.id) ? ns.delete(item.nom.id) : ns.add(item.nom.id)
                                            setExcludedNomIds(ns)
                                          }} style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${isExcluded ? '#444' : '#f43f5e'}`, background: isExcluded ? 'transparent' : '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canToggle ? 'pointer' : 'not-allowed', flexShrink: 0, transition: '0.2s' }}>
                                            {!isExcluded && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                          </div>
                                        ) : (
                                          <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
                                        )}

                                        <div style={{ background: '#1a1a1a', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          {getIconForType(item.nom)}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.nom.name}
                                            {item.nom.material_type && <span style={{ fontSize: '0.7rem', color: '#666', marginLeft: '5px', fontWeight: 500 }}>{item.nom.material_type}</span>}
                                          </div>
                                          {item.nom.description && (
                                            <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nom.description}>
                                              {item.nom.description}
                                            </div>
                                          )}
                                          <div style={{ fontSize: '0.6rem', color: isExcluded ? '#555' : (isPicked ? '#10b981' : (isPending ? '#eab308' : (item.isCustom ? '#06b6d4' : '#444'))), fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>
                                            {isExcluded ? 'Виключено' : (isPicked ? 'Підтверджено складом' : (isPending ? 'В обробці' : (item.isCustom ? 'Додано пакувальником' : 'Очікує')))}
                                          </div>
                                        </div>

                                        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                          {/* Редаговане поле кількості — тільки до відправки запиту */}
                                          {!hasAnyRequests && !isPicked && !activeBatchData.isPackaged && !isExcluded ? (
                                            <>
                                              <input
                                                type="number"
                                                min="0"
                                                value={
                                                  item.isCustom
                                                    ? (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)
                                                    : (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)
                                                }
                                                onChange={e => {
                                                  const val = e.target.value === '' ? '' : Number(e.target.value)
                                                  setCustomQty(prev => ({ ...prev, [String(item.nom.id)]: val }))
                                                  // Also update customItems qty if it's custom
                                                  if (item.isCustom) {
                                                    setCustomItems(prev => prev.map(ci =>
                                                      ci.uid === item.uid ? { ...ci, qty: Number(val) || 1 } : ci
                                                    ))
                                                  }
                                                }}
                                                onClick={e => e.stopPropagation()}
                                                style={{
                                                  width: '120px',
                                                  background: customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#eab30818' : '#111',
                                                  border: `1.5px solid ${customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#eab30866' : '#2a2a2a'}`,
                                                  borderRadius: '8px',
                                                  color: customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#eab308' : '#fff',
                                                  fontSize: '1.1rem',
                                                  fontWeight: 1000,
                                                  padding: '4px 8px',
                                                  textAlign: 'right',
                                                  outline: 'none',
                                                }}
                                              />
                                              <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 800 }}>{item.nom.unit || 'шт'}</div>
                                              {customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty && (
                                                <div style={{ fontSize: '0.55rem', color: '#eab308', fontWeight: 900 }}>план: {item.qty}</div>
                                              )}
                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && !isPicked && !activeBatchData.isPackaged && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.nom.id) }}
                                                  title="Видалити позицію"
                                                  style={{
                                                    marginTop: '4px',
                                                    background: '#f43f5e14',
                                                    border: '1px solid #f43f5e33',
                                                    borderRadius: '6px',
                                                    color: '#f43f5e',
                                                    cursor: 'pointer',
                                                    padding: '3px 6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    fontSize: '0.6rem',
                                                    fontWeight: 900
                                                  }}
                                                >
                                                  <Trash2 size={10} /> ВИДАЛИТИ
                                                </button>
                                              )}
                                            </>
                                          ) : (
                                            <div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 1000, color: isExcluded ? '#444' : (isPicked ? '#10b981' : (isPending ? '#eab308' : '#fff')) }}>
                                                {isPicked && orderRequests.find(r => String(r.nomenclature_id) === String(item.nom.id))?.quantity
                                                  ? orderRequests.find(r => String(r.nomenclature_id) === String(item.nom.id)).quantity
                                                  : (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)}
                                              </div>
                                              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>{item.nom.unit || 'шт'}</div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Нижня частина — поле номера коробки (тільки якщо склад підтвердив) */}
                                      {isPicked && !isExcluded && !activeBatchData.isPackaged && (
                                        <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <Hash size={13} color="#555" style={{ flexShrink: 0 }} />
                                          <input
                                            type="text"
                                            value={boxNum}
                                            onChange={e => setBoxNumbers(prev => ({ ...prev, [String(item.nom.id)]: e.target.value }))}
                                            placeholder="Номер коробки..."
                                            maxLength={20}
                                            className="box-number-input"
                                            style={{
                                              flex: 1,
                                              background: hasBox ? `${boxColor}18` : '#111',
                                              border: `1.5px solid ${hasBox ? boxColor + '66' : '#222'}`,
                                              borderRadius: '10px',
                                              color: hasBox ? boxColor : '#888',
                                              fontWeight: 900,
                                              fontSize: '0.85rem',
                                              padding: '8px 12px',
                                              outline: 'none',
                                              transition: '0.2s',
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.5px'
                                            }}
                                          />
                                          {hasBox && (
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: boxColor, flexShrink: 0, boxShadow: `0 0 8px ${boxColor}88` }} />
                                          )}
                                        </div>
                                      )}

                                      {/* Якщо вже запаковано — показуємо збережений номер */}
                                      {isPicked && !isExcluded && activeBatchData.isPackaged && hasBox && (
                                        <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <Hash size={13} color={boxColor} style={{ flexShrink: 0 }} />
                                          <span style={{ fontSize: '0.85rem', fontWeight: 900, color: boxColor, letterSpacing: '0.5px' }}>Коробка {boxNum.toUpperCase()}</span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {Object.values(categorizedBOM).every(c => c.items.length === 0) && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#444', border: '2px dashed #151515', borderRadius: '20px' }}>
                          <AlertCircle size={40} style={{ margin: '0 auto 15px', opacity: 0.3 }} />
                          <div style={{ fontWeight: 800 }}>Специфікація порожня</div>
                          <p style={{ fontSize: '0.75rem', marginTop: '10px' }}>Перевірте налаштування BOM для цього виробу</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* КНОПКИ ДІЙ */}
                <div className="action-buttons-row">

                  {/* ЗАПИТ ТМЦ */}
                  <button
                    onClick={handleCreateRequest}
                    disabled={allBOMItems.length === 0 || isProcessing || hasAnyRequests || activeBatchData.isPackaged || isWarehouseConfirmed}
                    style={{ flex: 1, padding: '20px', background: '#111', color: (hasAnyRequests || activeBatchData.isPackaged || isWarehouseConfirmed) ? '#444' : '#fff', border: '1px solid #222', borderRadius: '18px', fontWeight: 950, cursor: (allBOMItems.length > 0 && !isProcessing && !hasAnyRequests && !activeBatchData.isPackaged && !isWarehouseConfirmed) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem', opacity: (allBOMItems.length > 0 && !isProcessing && !hasAnyRequests && !activeBatchData.isPackaged && !isWarehouseConfirmed) ? 1 : 0.5, transition: '0.3s' }}>
                    {isWarehouseConfirmed ? (
                      <><CheckCircle2 size={20} color="#10b981" /> ТМЦ ОТРИМАНО (СКЛАД ПІДТВЕРДИВ)</>
                    ) : hasAnyRequests ? (
                      <><CheckCircle2 size={20} color="#10b981" /> ЗАПИТ ТМЦ ВІДПРАВЛЕНО</>
                    ) : (
                      <><Send size={20} color="#3b82f6" /> СФОРМУВАТИ ЗАПИТ ТМЦ</>
                    )}
                  </button>

                  {/* ЗБЕРЕГТИ КОРОБКИ */}
                  {isWarehouseConfirmed && !activeBatchData.isPackaged && (
                    <button
                      onClick={handleSaveBoxes}
                      disabled={isSavingBoxes || !Object.values(boxNumbers).some(v => v?.trim())}
                      style={{ flex: 1, padding: '20px', background: Object.values(boxNumbers).some(v => v?.trim()) ? '#f43f5e18' : '#111', color: Object.values(boxNumbers).some(v => v?.trim()) ? '#f43f5e' : '#555', border: `1px solid ${Object.values(boxNumbers).some(v => v?.trim()) ? '#f43f5e44' : '#222'}`, borderRadius: '18px', fontWeight: 950, cursor: Object.values(boxNumbers).some(v => v?.trim()) && !isSavingBoxes ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem', transition: '0.3s' }}>
                      {isSavingBoxes ? <><Loader2 size={20} className="anim-spin" /> ЗБЕРЕЖЕННЯ...</> : <><Save size={20} /> ЗБЕРЕГТИ КОРОБКИ</>}
                    </button>
                  )}

                  {/* ЗАВЕРШИТИ ПАКУВАННЯ */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Підказка якщо не всі коробки заповнені */}
                    {isWarehouseConfirmed && !allBoxesFilled && !activeBatchData.isPackaged && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eab30812', border: '1px solid #eab30833', borderRadius: '12px', padding: '8px 14px' }}>
                        <AlertCircle size={14} color="#eab308" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: '#eab308', fontWeight: 800 }}>
                          Вкажіть номери коробок для {pickedItemsWithoutBox.length} позиц{pickedItemsWithoutBox.length === 1 ? 'ії' : 'ій'} перед завершенням
                        </span>
                      </div>
                    )}
                    <button
                      onClick={handleCompleteClick}
                      disabled={!isReadyToFinalize || !allBoxesFilled || isProcessing || activeBatchData.isPackaged}
                      style={{
                        width: '100%',
                        padding: '20px',
                        background: activeBatchData.isPackaged
                          ? '#1a1a1a'
                          : (isReadyToFinalize && allBoxesFilled ? '#10b981' : '#111'),
                        color: activeBatchData.isPackaged
                          ? '#555'
                          : (isReadyToFinalize && allBoxesFilled ? '#000' : '#444'),
                        border: activeBatchData.isPackaged
                          ? '1px solid #333'
                          : (isReadyToFinalize && !allBoxesFilled ? '1px solid #eab30833' : 'none'),
                        borderRadius: '18px',
                        fontWeight: 1000,
                        cursor: (isReadyToFinalize && allBoxesFilled && !isProcessing && !activeBatchData.isPackaged) ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontSize: '0.9rem',
                        boxShadow: (isReadyToFinalize && allBoxesFilled && !activeBatchData.isPackaged) ? '0 15px 35px rgba(16,185,129,0.25)' : 'none',
                        transition: '0.3s',
                        opacity: (isReadyToFinalize && !allBoxesFilled && !activeBatchData.isPackaged) ? 0.5 : 1
                      }}>
                      {activeBatchData.isPackaged
                        ? <><CheckCircle2 size={22} color="#10b981" /> ЗАПАКОВАНО</>
                        : isProcessing
                          ? <><Loader2 size={22} className="anim-spin" /> ОБРОБКА...</>
                          : <><Package size={22} /> ЗАВЕРШИТИ ПАКУВАННЯ</>}
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #222', borderRadius: '32px', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 30px' }}>
                    <Package size={120} style={{ color: '#f43f5e', opacity: 0.25 }} />
                    <div className="anim-pulse" style={{ position: 'absolute', inset: 0, border: '2px solid #f43f5e', borderRadius: '30%', opacity: 0.35 }}></div>
                  </div>
                  <h3 style={{ margin: 0, fontWeight: 900, color: '#aaa', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>Оберіть наряд для комплектування</h3>
                  <p style={{ margin: '15px 0 0 0', fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>Система відображає лише ті партії, виробництво яких повністю завершено</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PACKER SELECTION MODAL */}
      {showPackerModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #18072a 0%, #0d1a2e 60%, #0a0f1e 100%)',
            border: '1px solid rgba(168,85,247,0.25)',
            borderRadius: '28px',
            width: '100%',
            maxWidth: '460px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(168,85,247,0.08), inset 0 1px 0 rgba(255,255,255,0.06)'
          }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(168,85,247,0.4)'
                }}>
                  <Package size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Хто завершує пакування?
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#7c6a9a', lineHeight: '1.4' }}>
                    Оберіть пакувальника зі списку
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowPackerModal(false); setSelectedPackerId('') }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Select dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Пакувальник
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedPackerId}
                  onChange={e => setSelectedPackerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 44px 14px 16px',
                    background: 'rgba(168,85,247,0.08)',
                    border: '1.5px solid rgba(168,85,247,0.3)',
                    borderRadius: '14px',
                    color: selectedPackerId ? '#fff' : '#6b5a80',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    transition: 'all 0.2s'
                  }}
                  className="packer-select"
                >
                  <option value="" disabled style={{ background: '#1a0d2e', color: '#888' }}>— Оберіть пакувальника —</option>
                  {packersList.map(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login
                    return (
                      <option key={u.id} value={u.id} style={{ background: '#1a0d2e', color: '#fff', fontWeight: 700 }}>
                        {fullName}
                      </option>
                    )
                  })}
                </select>
                <div style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', color: '#a855f7'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
              {packersList.length === 0 && (
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#f43f5e', fontWeight: 600 }}>
                  ⚠️ Немає пакувальників у системі
                </p>
              )}
            </div>

            {/* Confirm button */}
            <button
              disabled={!selectedPackerId}
              onClick={() => {
                const packer = packersList.find(u => String(u.id) === String(selectedPackerId))
                if (packer) handleCompletePackaging(packer)
              }}
              style={{
                padding: '15px',
                background: selectedPackerId
                  ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '14px',
                color: selectedPackerId ? '#fff' : '#444',
                fontSize: '0.9rem',
                fontWeight: 900,
                cursor: selectedPackerId ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.3s',
                boxShadow: selectedPackerId ? '0 8px 24px rgba(168,85,247,0.4)' : 'none'
              }}
              onMouseEnter={e => { if (selectedPackerId) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
            >
              ✓ Підтвердити та завершити пакування
            </button>
          </div>
        </div>
      )}

      {/* ─── МОДАЛ ДОДАВАННЯ ПОЗИЦІЇ ─── */}
      {showAddItemModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #0a1628 0%, #060d1a 60%, #050a14 100%)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: '28px',
            width: '100%',
            maxWidth: '540px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(6,182,212,0.06), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px', height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(6,182,212,0.35)'
                }}>
                  <Plus size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Додати позицію
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#4a7a8a', lineHeight: '1.4' }}>
                    Пошук по назві, коду або синоніму
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddItemModal(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#888', cursor: 'pointer', padding: '8px', display: 'flex', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Category selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px' }}>Категорія</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'sgp', label: 'СГП / ДЕТАЛІ', color: '#f43f5e' },
                  { key: 'mounts', label: 'КРІПЛЕННЯ', color: '#eab308' },
                  { key: 'hardware', label: 'МЕТИЗИ', color: '#06b6d4' },
                  { key: 'spacers', label: 'СТІЙКИ', color: '#8b5cf6' },
                  { key: 'other', label: 'НАКЛАДКИ / ІНШЕ', color: '#3b82f6' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setAddItemCategoryKey(cat.key)}
                    style={{
                      padding: '6px 12px',
                      background: addItemCategoryKey === cat.key ? `${cat.color}22` : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${addItemCategoryKey === cat.key ? cat.color + '66' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '10px',
                      color: addItemCategoryKey === cat.key ? cat.color : '#555',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      letterSpacing: '0.5px'
                    }}
                  >{cat.label}</button>
                ))}
              </div>
            </div>

            {/* Search field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px' }}>Пошук номенклатури</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#555" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  autoFocus
                  type="text"
                  value={addItemSearch}
                  onChange={e => { setAddItemSearch(e.target.value); setAddItemSelectedNom(null) }}
                  placeholder="Введіть назву, код або синонім..."
                  style={{
                    width: '100%',
                    padding: '13px 14px 13px 42px',
                    background: 'rgba(6,182,212,0.06)',
                    border: '1.5px solid rgba(6,182,212,0.2)',
                    borderRadius: '14px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.5)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(6,182,212,0.2)' }}
                />
              </div>

              {/* Search results */}
              {addItemSearch.trim() && addItemSearchResults.length > 0 && !addItemSelectedNom && (
                <div style={{
                  background: '#080e18',
                  border: '1px solid rgba(6,182,212,0.15)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}>
                  {addItemSearchResults.map(nom => (
                    <div
                      key={nom.id}
                      onClick={() => {
                        setAddItemSelectedNom(nom)
                        setAddItemSearch(nom.name)
                        // Auto-detect category if not already set by user explicitly
                        const detectedCat = detectCategoryKey(nom)
                        setAddItemCategoryKey(prev => prev || detectedCat)
                      }}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ background: '#111', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                        {getIconForType(nom)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#3a5a6a', fontWeight: 600, marginTop: '2px' }}>
                          {nom.nomenclature_code && <span style={{ marginRight: '8px', color: '#4a8a9a' }}>Код: {nom.nomenclature_code}</span>}
                          {nom.description && <span style={{ color: '#06b6d4', marginRight: '8px' }}>{nom.description}</span>}
                          {nom.aliases && <span style={{ color: '#2a5a6a', marginLeft: '6px', fontStyle: 'italic' }}>{nom.aliases}</span>}
                        </div>
                      </div>
                      <div style={{
                        marginLeft: 'auto',
                        background: 'rgba(236,72,153,0.12)',
                        border: '1px solid rgba(236,72,153,0.3)',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        color: '#ec4899',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        Вільний залишок: {(() => {
                          const items = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id));
                          const total = items.reduce((acc, cur) => acc + (Number(cur.total_qty) || 0), 0);
                          const reserved = items.reduce((acc, cur) => acc + (Number(cur.reserved_qty) || 0), 0);
                          return total - reserved;
                        })()} шт.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addItemSearch.trim() && addItemSearchResults.length === 0 && !addItemSelectedNom && (
                <div style={{ padding: '12px 16px', textAlign: 'center', color: '#3a5a6a', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(6,182,212,0.04)', borderRadius: '10px', border: '1px solid rgba(6,182,212,0.1)' }}>
                  Нічого не знайдено
                </div>
              )}

              {addItemSelectedNom && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'rgba(6,182,212,0.1)',
                  border: '1.5px solid rgba(6,182,212,0.35)',
                  borderRadius: '12px'
                }}>
                  <CheckCircle2 size={16} color="#06b6d4" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addItemSelectedNom.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: 700, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {addItemSelectedNom.nomenclature_code && <span>Код: {addItemSelectedNom.nomenclature_code}</span>}
                      {addItemSelectedNom.description && <span style={{ color: '#a0aec0' }}>{addItemSelectedNom.description}</span>}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(236,72,153,0.12)',
                    border: '1px solid rgba(236,72,153,0.3)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    color: '#ec4899',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    Вільний залишок: {(() => {
                      const items = (inventory || []).filter(i => String(i.nomenclature_id) === String(addItemSelectedNom.id));
                      const total = items.reduce((acc, cur) => acc + (Number(cur.total_qty) || 0), 0);
                      const reserved = items.reduce((acc, cur) => acc + (Number(cur.reserved_qty) || 0), 0);
                      return total - reserved;
                    })()} шт.
                  </div>
                  <button onClick={() => { setAddItemSelectedNom(null); setAddItemSearch('') }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '2px' }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px' }}>Кількість</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setAddItemQty(q => Math.max(1, Number(q) - 1))}
                  style={{ width: '40px', height: '40px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '10px', color: '#06b6d4', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.18)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.08)'}
                >−</button>
                <input
                  type="number"
                  min="1"
                  value={addItemQty}
                  onChange={e => setAddItemQty(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(6,182,212,0.06)',
                    border: '1.5px solid rgba(6,182,212,0.2)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '1.2rem',
                    fontWeight: 1000,
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => setAddItemQty(q => Number(q) + 1)}
                  style={{ width: '40px', height: '40px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '10px', color: '#06b6d4', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.18)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.08)'}
                >+</button>
                {addItemSelectedNom?.unit && (
                  <span style={{ fontSize: '0.75rem', color: '#3a6a7a', fontWeight: 800 }}>{addItemSelectedNom.unit}</span>
                )}
              </div>
            </div>

            {/* Confirm */}
            <button
              disabled={!addItemSelectedNom || !addItemQty || Number(addItemQty) <= 0}
              onClick={handleConfirmAddItem}
              style={{
                padding: '15px',
                background: addItemSelectedNom
                  ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
                  : 'rgba(255,255,255,0.04)',
                border: 'none',
                borderRadius: '14px',
                color: addItemSelectedNom ? '#fff' : '#333',
                fontSize: '0.9rem',
                fontWeight: 900,
                cursor: addItemSelectedNom ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.3s',
                boxShadow: addItemSelectedNom ? '0 8px 24px rgba(6,182,212,0.35)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
              onMouseEnter={e => { if (addItemSelectedNom) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
            >
              <Plus size={18} /> Додати до списку комплектування
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .module-nav-container {
          padding: 0 25px !important;
          height: 80px !important;
        }
        .module-content-container {
          padding: 30px !important;
        }
        .details-panel {
          padding: 40px !important;
          border-radius: 32px !important;
        }
        .detail-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          flex-shrink: 0;
        }
        @media screen and (max-width: 768px) {
          .module-nav-container {
            padding: 0 12px !important;
            height: 54px !important;
          }
          .nav-title {
            font-size: 0.8rem !important;
          }
          .nav-subtitle {
            display: none !important;
          }
          .module-nav-container svg {
            width: 14px !important;
            height: 14px !important;
          }
          .burger-btn-labeled {
            padding: 4px 8px !important;
            font-size: 0.7rem !important;
          }
          .burger-btn-labeled span {
            font-size: 0.7rem !important;
          }
        }
        .order-detail-title {
          font-size: 2.2rem !important;
        }
        .volume-box {
          text-align: right;
          background: #111;
          padding: 12px 20px;
          border-radius: 16px;
        }
        .action-buttons-row {
          display: flex;
          gap: 15px;
          flex-shrink: 0;
        }
        
        @media screen and (max-width: 768px) {
          .module-content-container {
            padding: 8px !important;
          }
          .master-grid {
            height: auto !important;
          }
          .order-details-area {
            height: auto !important;
          }
          .details-panel {
            padding: 12px !important;
            border-radius: 16px !important;
            gap: 10px !important; /* Decrease gap inside main container */
            height: auto !important;
            overflow: visible !important;
          }
          .bom-container {
            overflow-y: visible !important;
            padding: 15px !important;
            border-radius: 16px !important;
          }
          .detail-header-row {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 8px !important;
          }
          .order-detail-title {
            font-size: 1.2rem !important; /* Make title much smaller */
          }
          .detail-customer-text, .detail-product-text {
            font-size: 0.8rem !important;
          }
          .volume-box {
            padding: 4px 8px !important;
            border-radius: 8px !important;
          }
          .volume-box div:first-child {
            font-size: 0.5rem !important;
          }
          .volume-box div:last-child {
            font-size: 1rem !important;
          }
          
          /* Make buttons compact and smaller */
          .action-buttons-row {
            gap: 8px !important;
            margin-top: 5px !important;
            flex-direction: column !important;
          }
          .action-buttons-row button, .action-buttons-row div button {
            padding: 14px 10px !important; /* Much smaller button height */
            border-radius: 10px !important;
            font-size: 0.8rem !important;
          }
          .action-buttons-row svg, .action-buttons-row div svg {
            width: 16px !important;
            height: 16px !important;
          }
          .bom-required-list {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
            gap: 8px !important;
          }
          .bom-required-list > div {
            padding: 10px !important;
            border-radius: 12px !important;
          }
        }
        .master-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 30px;
        }
        .side-panel {
          display: flex;
          flex-direction: column;
        }
        .mobile-only { display: none; }

        @media screen and (max-width: 480px) {
          .bom-required-list {
            grid-template-columns: 1fr !important;
          }
        }
        @media screen and (max-width: 1024px) {
          .hide-mobile { display: none !important; }
          .mobile-only { display: block !important; }
          .master-grid { display: block !important; }
          .side-panel { 
            position: fixed; 
            left: 0; 
            top: 0; 
            bottom: 0; 
            z-index: 100000; 
            transform: translateX(-100%); 
            width: 320px !important; 
            height: 100% !important;
            background: #0a0a0a !important;
            border-right: 1px solid #1a1a1a !important;
            border-radius: 0 !important;
            box-shadow: 20px 0 50px rgba(0,0,0,0.5);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .side-panel.drawer-open { transform: translateX(0) !important; }
        }

        .pack-order-card:hover { transform: translateY(-2px); border-color: #333 !important; }
        .pack-order-card:active { transform: scale(0.99); }
        .ready-pulse { animation: readyPulse 2s infinite; border-color: #10b981 !important; background: #10b98108 !important; }
        @keyframes readyPulse { 0%{box-shadow:0 0 0 0 rgba(16,185,129,0.2);} 70%{box-shadow:0 0 0 10px rgba(16,185,129,0);} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0);} }
        .anim-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%{transform:scale(1);opacity:0.1;} 50%{transform:scale(1.1);opacity:0.2;} 100%{transform:scale(1);opacity:0.1;} }
        .anim-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        .box-number-input:focus { border-color: #10b98188 !important; box-shadow: 0 0 0 3px #10b98118; background: #10b98108 !important; }
        .box-number-input::placeholder { color: #333 !important; font-weight: 500; text-transform: none; }
        .packer-select:focus { border-color: rgba(168,85,247,0.6) !important; box-shadow: 0 0 0 3px rgba(168,85,247,0.15) !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />
    </div>
  )
}

export default PackagingModule
