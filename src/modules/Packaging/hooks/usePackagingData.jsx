import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useMES } from '../../../MESContext'
import {
  isFinishedComponent,
  isProductionOnlyMaterial,
  getBestRequestForNomenclature
} from '../utils/packagingHelpers'

export function usePackagingData() {
  const location = useLocation()
  const {
    orders, tasks, nomenclatures, bomItems,
    submitPickingRequest, requests, supabase,
    fetchData, completePackaging, systemUsers,
    inventory
  } = useMES()

  // ─── Локальний стейт черги нарядів (незалежний від глобального tasks) ─────
  const [localTasks, setLocalTasks] = useState([])
  const [localOrders, setLocalOrders] = useState({})
  const localTasksLoadedRef = useRef(false)
  const fetchIntervalRef = useRef(null)

  // Миттєва ініціалізація з контексту
  useEffect(() => {
    if (orders?.length) {
      setLocalOrders(prev => {
        const map = { ...prev }
        orders.forEach(o => { map[o.id] = o })
        return map
      })
    }
  }, [orders])

  useEffect(() => {
    if (tasks?.length && !localTasksLoadedRef.current) {
      const relevant = tasks.filter(t => {
        if (t.plan_snapshot?._metadata?.is_packaged === true) return false
        return t.status === 'in-progress' || t.status === 'completed' || t.status === 'active' || t.status === 'new'
      })
      if (relevant.length > 0) setLocalTasks(relevant)
    }
  }, [tasks])

  const loadPackagingTasks = useCallback(async () => {
    if (!supabase) return
    try {
      const FIELDS = 'id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot'
      
      const [{ data: active }, { data: completed }] = await Promise.all([
        supabase
          .from('tasks')
          .select(FIELDS)
          .in('status', ['in-progress', 'active', 'new'])
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('tasks')
          .select(FIELDS)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(300)
      ])

      const all = [...(active || []), ...(completed || [])]
      const unique = Array.from(new Map(all.map(t => [t.id, t])).values())
      setLocalTasks(unique)
      localTasksLoadedRef.current = true

      const orderIds = [...new Set(unique.map(t => t.order_id).filter(Boolean))]
      if (orderIds.length > 0) {
        const chunkSize = 50
        const chunks = []
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          chunks.push(orderIds.slice(i, i + chunkSize))
        }

        const results = await Promise.all(
          chunks.map(chunk =>
            supabase
              .from('orders')
              .select('*, order_items(*)')
              .in('id', chunk)
          )
        )

        setLocalOrders(prev => {
          const map = { ...prev }
          results.forEach(res => {
            ;(res.data || []).forEach(o => { map[o.id] = o })
          })
          return map
        })
      }
    } catch (e) {
      console.error('[Packaging] loadPackagingTasks error:', e)
    }
  }, [supabase])

  useEffect(() => {
    loadPackagingTasks()
  }, [loadPackagingTasks])

  useEffect(() => {
    if (!localTasksLoadedRef.current) return
    setLocalTasks(prev => {
      const map = new Map(prev.map(t => [t.id, t]))
      tasks.forEach(t => {
        if (map.has(t.id)) {
          const existing = map.get(t.id)
          map.set(t.id, { ...existing, ...t, plan_snapshot: t.plan_snapshot ?? existing.plan_snapshot })
        }
      })
      return Array.from(map.values())
    })
  }, [tasks])

  const [selectedBatch, setSelectedBatch] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [excludedNomIds, setExcludedNomIds] = useState(new Set())
  const [customQty, setCustomQty] = useState({})
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [customItems, setCustomItems] = useState([])

  // Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [addItemCategoryKey, setAddItemCategoryKey] = useState('hardware')

  const [boxNumbers, setBoxNumbers] = useState({})
  const [savedBoxes, setSavedBoxes] = useState([])
  const [isSavingBoxes, setIsSavingBoxes] = useState(false)
  const [showBoxSummary, setShowBoxSummary] = useState(false)
  const [showPackerModal, setShowPackerModal] = useState(false)

  const packersList = useMemo(() => {
    return (systemUsers || []).filter(u => {
      const pos = (u.position || '').toLowerCase()
      return pos.includes('пакув')
    })
  }, [systemUsers])

  useEffect(() => { 
    document.title = 'Відділ Пакування | Centrum'
    if (typeof fetchData === 'function') {
      fetchData([
        'orders',
        'tasks',
        'nomenclatures',
        'bom_items',
        'material_requests',
        'inventory',
        'system_users'
      ])
    }
  }, [])

  useEffect(() => {
    setExcludedNomIds(new Set())
    setBoxNumbers({})
    setSavedBoxes([])
    setShowBoxSummary(false)
    setCustomQty({})
    setCustomItems([])
    if (selectedBatch) loadSavedBoxes(selectedBatch)
  }, [selectedBatch?.key])

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

  const batchList = useMemo(() => {
    const relevantTasks = localTasks.filter(t => {
      if (t.plan_snapshot?._metadata?.is_packaged === true) return false
      return t.status === 'in-progress' || t.status === 'completed' || t.status === 'active' || t.status === 'new'
    })
    const batchGroups = {}
    relevantTasks.forEach(task => {
      const order = localOrders[task.order_id] || orders.find(o => o.id === task.order_id)
      if (!order || order.status === 'deleted' || order.status === 'cancelled' || order.status === 'shipped') return
      if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return
      
      let schedule = []
      try {
        const parsed = typeof order.report === 'string' ? JSON.parse(order.report) : (order.report || {})
        schedule = Array.isArray(parsed.batch_schedule) ? parsed.batch_schedule : []
      } catch (e) {}

      if (schedule.length > 0) {
        schedule.forEach(sb => {
          if (sb.packaged === true) return
          const key = `${task.order_id}_sched_${sb.batch_num}`
          if (!batchGroups[key]) {
            const productNames = order.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'
            batchGroups[key] = {
              key,
              orderId: task.order_id,
              orderNum: order.order_num,
              customer: order.customer,
              productNames,
              batchIndex: `П${sb.batch_num}`,
              batchNum: sb.batch_num,
              plannedSets: sb.quantity || 0,
              deadline: sb.deadline || order.deadline,
              isPackaged: false,
              isScheduledBatch: true,
              tasks: []
            }
          }
          if (!batchGroups[key].tasks.some(t => t.id === task.id)) {
            batchGroups[key].tasks.push(task)
          }
        })
      } else {
        const bIdx = task.batch_index || ''
        const key = bIdx ? `${task.order_id}_${bIdx}` : `${task.order_id}_whole`
        if (!batchGroups[key]) {
          const productNames = order.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'
          batchGroups[key] = { key, orderId: task.order_id, orderNum: order.order_num, customer: order.customer, productNames, batchIndex: bIdx, plannedSets: task.planned_sets || 0, isPackaged: task.plan_snapshot?._metadata?.is_packaged === true, tasks: [] }
        }
        if (!batchGroups[key].tasks.some(t => t.id === task.id)) {
          batchGroups[key].tasks.push(task)
        }
      }
    })

    return Object.values(batchGroups).map(batch => {
      const batchBOM = []
      const order = localOrders[batch.orderId] || orders.find(o => o.id === batch.orderId)
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
        const allTasksForOrder = localTasks.filter(t => String(t.order_id) === String(batch.orderId))
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
  }, [localTasks, localOrders, orders, requests, bomItems, nomenclatures])

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

    const order = localOrders[activeBatchData.orderId] || orders.find(o => o.id === activeBatchData.orderId)
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
      mounts: { title: '2. КРІПЛЕННЯ / 3Д ДРУК', items: [], color: '#eab308', icon: <Package size={18} /> },
      hardware: { title: '3. МЕТИЗИ (Гвинти/Гайки)', items: [], color: '#06b6d4', icon: <Package size={18} /> },
      spacers: { title: '4. СТІЙКИ', items: [], color: '#8b5cf6', icon: <Package size={18} /> },
      other: { title: '5. НАКЛАДКИ / ТРИМАЧІ / УПАКОВКА', items: [], color: '#3b82f6', icon: <Package size={18} /> }
    }

    Object.values(map).forEach(item => {
      const type = (item.nom.type || '').toLowerCase()
      const name = (item.nom.name || '').toLowerCase()
      if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categories.mounts.items.push(item)
      else if (name.includes('стійка') || type.includes('стійк')) categories.spacers.items.push(item)
      else if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) categories.other.items.push(item)
      else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка') || type.includes('hardware') || type.includes('fastener')) categories.hardware.items.push(item)
      else if (isFinishedComponent(item.nom)) categories.sgp.items.push(item)
      else categories.other.items.push(item)
    })

    customItems.forEach(ci => {
      const catKey = ci.categoryKey
      if (categories[catKey]) {
        categories[catKey].items.push({ nom: ci.nom, qty: ci.qty, isCustom: true, uid: ci.uid })
      }
    })

    return { categorizedBOM: categories, hasBOM: foundAnyBom }
  }, [activeBatchData, localOrders, orders, bomItems, nomenclatures, customItems, requests])

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
    const activeRequests = relevant.filter(r => r.status === 'pending' || r.status === 'processing')
    return { orderRequests: relevant, completedRequestsCount: relevant.filter(r => r.status === 'completed' || r.status === 'issued').length, isReadyToFinalize: is100PercentCovered, hasAnyRequests: activeRequests.length > 0 }
  }, [activeBatchData, requests, allBOMItems, excludedNomIds, nomenclatures])

  const isWarehouseConfirmed = isReadyToFinalize

  const pickedItemsWithoutBox = useMemo(() => {
    if (!isWarehouseConfirmed) return []
    return allBOMItems.filter(item => {
      const reqRequest = getBestRequestForNomenclature(orderRequests, item.nom.id)
      const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
      const isExcluded = excludedNomIds.has(item.nom.id)
      if (!isPicked || isExcluded) return false
      const boxNum = boxNumbers[String(item.nom.id)]
      return !boxNum || !boxNum.trim()
    })
  }, [isWarehouseConfirmed, allBOMItems, orderRequests, excludedNomIds, boxNumbers])

  const allBoxesFilled = isWarehouseConfirmed && pickedItemsWithoutBox.length === 0

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

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
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

      await loadSavedBoxes(activeBatchData)
      alert(`✅ Збережено! ${upsertRows.length} позицій розподілено по коробках`)
    } catch (e) {
      console.error('[Packaging] handleSaveBoxes catch:', e)
      alert('Помилка збереження')
    } finally {
      setIsSavingBoxes(false)
    }
  }

  const handleCreateRequest = async () => {
    setIsProcessing(true)
    try {
      await fetchData('material_requests')

      const activeBOMItems = allBOMItems.filter(item => {
        const isExcluded = excludedNomIds.has(item.nom.id)
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
    try {
      setIsProcessing(true)

      const savedOk = await saveBoxesToDB()
      if (!savedOk) {
        alert('Помилка автоматичного збереження коробок в базу. Спробуйте ще раз.')
        return
      }

      const packerName = `${packer.first_name || ''} ${packer.last_name || ''}`.trim() || packer.login

      if (activeBatchData.isScheduledBatch && activeBatchData.batchNum) {
        const orderRow = orders.find(o => o.id === activeBatchData.orderId)
        if (orderRow) {
          let currentReport = {}
          try {
            currentReport = typeof orderRow.report === 'string' ? JSON.parse(orderRow.report) : (orderRow.report || {})
          } catch (e) {}
          
          const schedule = Array.isArray(currentReport.batch_schedule) ? currentReport.batch_schedule : []
          const updatedSchedule = schedule.map(sb => {
            if (sb.batch_num === activeBatchData.batchNum) {
              return { ...sb, packaged: true, packaged_at: new Date().toISOString(), packaged_by: packerName }
            }
            return sb
          })
          
          await supabase
            .from('orders')
            .update({ report: JSON.stringify({ ...currentReport, batch_schedule: updatedSchedule }) })
            .eq('id', activeBatchData.orderId)

          const allScheduledDone = updatedSchedule.every(sb => sb.packaged === true)
          if (allScheduledDone) {
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
          }
        }
      } else {
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

  const handleConfirmAddItem = async (addItemSelectedNom, addItemQty, addItemCategoryKey) => {
    if (!addItemSelectedNom || !addItemQty || !activeBatchData) return
    const firstTask = activeBatchData.tasks[0]
    if (!firstTask) return

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

  const handleOpenAddItemModal = (catKey) => {
    setAddItemCategoryKey(catKey || 'hardware')
    setShowAddItemModal(true)
  }

  return {
    nomenclatures,
    inventory,
    batchList,
    selectedBatch,
    setSelectedBatch,
    isDrawerOpen,
    setIsDrawerOpen,
    activeQueueCount,
    activeBatchData,
    categorizedBOM,
    allBOMItems,
    orderRequests,
    isWarehouseConfirmed,
    showBoxSummary,
    setShowBoxSummary,
    excludedNomIds,
    setExcludedNomIds,
    boxNumbers,
    setBoxNumbers,
    customQty,
    setCustomQty,
    setCustomItems,
    isProcessing,
    hasAnyRequests,
    isSavingBoxes,
    allBoxesFilled,
    boxSummary,
    handleCreateRequest,
    handleSaveBoxes,
    handleCompleteClick,
    handleCompletePackaging,
    handleConfirmAddItem,
    handleOpenAddItemModal,
    showAddItemModal,
    setShowAddItemModal,
    addItemCategoryKey,
    showPackerModal,
    setShowPackerModal,
    packersList
  }
}
