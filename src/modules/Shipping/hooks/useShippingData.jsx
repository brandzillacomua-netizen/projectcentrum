import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useMES } from '../../../MESContext'
import { claimNextPackingSlipNumber } from '../../../services/fulfillmentQueueService'
import { 
  getNpApiKey, searchNpCities, fetchNpWarehouses, 
  fetchSenderDetails, createOrGetRecipient, generateNpTTN,
  saveNpApiKey
} from '../../../services/novaPoshtaService'
import { PALLET_COLORS, parseCustomerDeliveryAddresses } from '../utils/shippingHelpers'

export function useShippingData() {
  const {
    orders, tasks, nomenclatures, supabase,
    fetchData, currentUser, systemUsers, customers,
    deductIssuedMaterialsForTask
  } = useMES()

  const [activeMobileSection, setActiveMobileSection] = useState('ready')
  const [isProcessing, setIsProcessing] = useState(false)

  // Стан модального вікна "Взяти в роботу"
  const [workModal, setWorkModal] = useState(null) // { batch }
  const [shippingType, setShippingType] = useState('')
  const [shippingDate, setShippingDate] = useState('')
  const [ttnNumber, setTtnNumber] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [batchColor, setBatchColor] = useState('')
  const [boxes, setBoxes] = useState([])    // [ { box_number, items: [{nom_name, qty, unit}] } ]
  const [checkedBoxes, setCheckedBoxes] = useState({}) // { box_number: bool }
  const [loadingBoxes, setLoadingBoxes] = useState(false)
  const [selectedClientAddressId, setSelectedClientAddressId] = useState('')

  // Nova Poshta Generator State
  const [isNpModalOpen, setIsNpModalOpen] = useState(false)
  const [npLoading, setNpLoading] = useState(false)
  const [npError, setNpError] = useState('')
  const [npSuccessData, setNpSuccessData] = useState(null) // { ttnNumber, printStickerUrl, printDocUrl }

  // NP Form Inputs
  const [npRecipientName, setNpRecipientName] = useState('')
  const [npRecipientPhone, setNpRecipientPhone] = useState('')
  const [npCitySearch, setNpCitySearch] = useState('Київ')
  const [npCityList, setNpCityList] = useState([])
  const [npSelectedCity, setNpSelectedCity] = useState(null)
  const [npWarehouseList, setNpWarehouseList] = useState([])
  const [npSelectedWarehouse, setNpSelectedWarehouse] = useState(null)

  const [npKeyInput, setNpKeyInput] = useState('')
  const [npSenderDetails, setNpSenderDetails] = useState(null)
  const [npCost, setNpCost] = useState('1000')
  const [npDescription, setNpDescription] = useState('Деталі карбонової рами та метизи')
  const [npServiceType, setNpServiceType] = useState('WarehouseWarehouse')
  const [npPayerType, setNpPayerType] = useState('Recipient')
  const [npPaymentMethod, setNpPaymentMethod] = useState('Cash')

  // NP Multi-Seat State (Згідно стандартів Нової Пошти v2.0)
  const [npSeatsList, setNpSeatsList] = useState([
    { id: 1, preset: '30x25x30', length: '30', width: '25', height: '30', weight: '1.5' }
  ])

  // Packing slip state
  const [packingSlip, setPackingSlip] = useState(null)

  // Persistent order cache to prevent any UI flickering during background context re-fetches
  const ordersCacheRef = useRef({})
  const [cacheVer, setCacheVer] = useState(0)

  // 1. Sync orders from MESContext into persistent cache
  useEffect(() => {
    if (orders && orders.length > 0) {
      let updated = false
      orders.forEach(ord => {
        if (ord?.id && !ordersCacheRef.current[ord.id]) {
          ordersCacheRef.current[ord.id] = ord
          updated = true
        }
        if (ord?.order_num && !ordersCacheRef.current[ord.order_num]) {
          ordersCacheRef.current[ord.order_num] = ord
          updated = true
        }
      })
      if (updated) setCacheVer(v => v + 1)
    }
  }, [orders])

  // 2. Fetch missing orders from Supabase into persistent cache
  useEffect(() => {
    if (!tasks || tasks.length === 0 || !supabase) return
    const orderIds = Array.from(new Set(tasks.map(t => t.order_id).filter(Boolean)))
    const missingIds = orderIds.filter(id => !ordersCacheRef.current[id])

    if (missingIds.length > 0) {
      const fetchMissing = async () => {
        try {
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .in('id', missingIds)

          if (data && data.length > 0) {
            data.forEach(ord => {
              if (ord?.id) ordersCacheRef.current[ord.id] = ord
              if (ord?.order_num) ordersCacheRef.current[ord.order_num] = ord
            })
            setCacheVer(v => v + 1)
          }
        } catch (err) {
          console.warn('[Shipping] fetch missing orders error:', err)
        }
      }
      fetchMissing()
    }
  }, [tasks, supabase])

  // 3. Stable list of all known orders
  const allKnownOrders = useMemo(() => {
    return Object.values(ordersCacheRef.current)
  }, [cacheVer])

  // Список відвантажувальників
  const shippingWorkers = useMemo(() =>
    (systemUsers || []).filter(u => u?.access_rights?.shipping === true),
    [systemUsers]
  )

  // Знайдений клієнт та його збережені адреси
  const matchingCustomer = useMemo(() => {
    if (!workModal?.batch?.customer) return null
    const rawName = String(workModal.batch.customer || '').trim().toLowerCase()
    return (customers || []).find(c => {
      const name = String(c.name || c.company || '').trim().toLowerCase()
      return name === rawName || name.includes(rawName) || rawName.includes(name)
    })
  }, [workModal, customers])

  const customerDeliveryAddresses = useMemo(() => {
    return parseCustomerDeliveryAddresses(matchingCustomer)
  }, [matchingCustomer])

  // Партії готові до відвантаження
  const readyBatches = useMemo(() => {
    const allReady = (tasks || []).filter(t =>
      t.status === 'completed' &&
      t.plan_snapshot?._metadata?.is_packaged === true &&
      t.plan_snapshot?._metadata?.is_shipped !== true
    )
    const batchMap = {}
    allReady.forEach(t => {
      const key = `${t.order_id}_${t.batch_index ?? '0'}`
      if (!batchMap[key]) batchMap[key] = []
      batchMap[key].push(t)
    })
    return Object.values(batchMap).map(taskList => {
      const t = taskList[0]
      const meta = t.plan_snapshot?._metadata || {}
      const order = allKnownOrders.find(o =>
        String(o.id) === String(t.order_id) ||
        String(o.order_num) === String(t.order_id) ||
        (meta.order_num && String(o.order_num) === String(meta.order_num))
      )
      
      let resolvedOrderNum = order?.order_num || meta.order_num || meta.order_number || t.order_num || t.order_number
      if (!resolvedOrderNum) {
        if (t.order_id && typeof t.order_id === 'string' && t.order_id.length > 20 && !t.order_id.includes('-')) {
          resolvedOrderNum = `Наряд #${t.order_id.slice(-6)}`
        } else if (t.order_id) {
          resolvedOrderNum = String(t.order_id)
        } else {
          resolvedOrderNum = '—'
        }
      }

      const resolvedCustomer =
        order?.customer ||
        order?.customer_name ||
        order?.client ||
        order?.client_name ||
        meta.customer ||
        meta.customer_name ||
        meta.client ||
        t.customer ||
        '—'

      // Calculate Product Names
      let productNames = ''
      if (order && Array.isArray(order.order_items) && order.order_items.length > 0) {
        productNames = order.order_items.map(it => {
          const nom = (nomenclatures || []).find(n => String(n.id) === String(it.nomenclature_id))
          return nom?.name || it.nomenclature_name || it.name || ''
        }).filter(Boolean).join(', ')
      }
      if (!productNames && meta.product_name) {
        productNames = meta.product_name
      }
      if (!productNames && meta.product_names) {
        productNames = meta.product_names
      }
      if (!productNames) {
        const names = taskList.map(tk => {
          const nom = (nomenclatures || []).find(n => String(n.id) === String(tk.nomenclature_id))
          return nom?.name || tk.name || tk.title || ''
        }).filter(Boolean)
        productNames = Array.from(new Set(names)).slice(0, 3).join(', ')
      }

      // Calculate Planned Sets
      const plannedSets = 
        order?.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) ||
        meta.planned_sets ||
        taskList.reduce((max, cur) => Math.max(max, Number(cur.planned_sets) || Number(cur.plan_snapshot?._metadata?.planned_sets) || 0), 0) ||
        taskList[0]?.planned_sets ||
        0

      return {
        id: t.id,
        orderId: t.order_id,
        orderNum: resolvedOrderNum,
        customer: resolvedCustomer,
        productNames,
        plannedSets,
        deadline: order?.deadline,
        batchIndex: t.batch_index ?? '1',
        batchTasks: taskList,
        packedBy: meta.packaged_by || '',
        packedAt: meta.packaged_at || '',
        batchColor: meta.batch_color || '',
      }
    })
  }, [tasks, allKnownOrders, nomenclatures])

  // Відвантажені партії (для архіву)
  const shippedBatches = useMemo(() => {
    const shipped = (tasks || []).filter(t =>
      t.plan_snapshot?._metadata?.is_shipped === true
    )
    const batchMap = {}
    shipped.forEach(t => {
      const key = `${t.order_id}_${t.batch_index ?? '0'}`
      if (!batchMap[key]) batchMap[key] = []
      batchMap[key].push(t)
    })
    return Object.values(batchMap).map(taskList => {
      const t = taskList[0]
      const meta = t.plan_snapshot?._metadata || {}
      const order = allKnownOrders.find(o =>
        String(o.id) === String(t.order_id) ||
        String(o.order_num) === String(t.order_id) ||
        (meta.order_num && String(o.order_num) === String(meta.order_num))
      )
      
      let resolvedOrderNum = order?.order_num || meta.order_num || meta.order_number || t.order_num || t.order_number
      if (!resolvedOrderNum) {
        if (t.order_id && typeof t.order_id === 'string' && t.order_id.length > 20 && !t.order_id.includes('-')) {
          resolvedOrderNum = `Наряд #${t.order_id.slice(-6)}`
        } else if (t.order_id) {
          resolvedOrderNum = String(t.order_id)
        } else {
          resolvedOrderNum = '—'
        }
      }

      const resolvedCustomer =
        order?.customer ||
        order?.customer_name ||
        order?.client ||
        order?.client_name ||
        meta.customer ||
        meta.customer_name ||
        meta.client ||
        t.customer ||
        '—'

      // Calculate Product Names
      let productNames = ''
      if (order && Array.isArray(order.order_items) && order.order_items.length > 0) {
        productNames = order.order_items.map(it => {
          const nom = (nomenclatures || []).find(n => String(n.id) === String(it.nomenclature_id))
          return nom?.name || it.nomenclature_name || it.name || ''
        }).filter(Boolean).join(', ')
      }
      if (!productNames && meta.product_name) {
        productNames = meta.product_name
      }
      if (!productNames && meta.product_names) {
        productNames = meta.product_names
      }
      if (!productNames) {
        const names = taskList.map(tk => {
          const nom = (nomenclatures || []).find(n => String(n.id) === String(tk.nomenclature_id))
          return nom?.name || tk.name || tk.title || ''
        }).filter(Boolean)
        productNames = Array.from(new Set(names)).slice(0, 3).join(', ')
      }

      // Calculate Planned Sets
      const plannedSets = 
        order?.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) ||
        meta.planned_sets ||
        taskList.reduce((max, cur) => Math.max(max, Number(cur.planned_sets) || Number(cur.plan_snapshot?._metadata?.planned_sets) || 0), 0) ||
        taskList[0]?.planned_sets ||
        0

      return {
        id: t.id,
        orderId: t.order_id,
        orderNum: resolvedOrderNum,
        customer: resolvedCustomer,
        productNames,
        plannedSets,
        batchIndex: t.batch_index ?? '1',
        shippedAt: meta.shipped_at || '',
        shippedBy: meta.shipped_by || '',
        ttn: meta.ttn_number || '',
        shippingType: meta.shipping_type || '',
        batchColor: meta.batch_color || '',
        packingSlipNumber: meta.packing_slip_number || null,
      }
    }).sort((a, b) => (b.shippedAt || '').localeCompare(a.shippedAt || ''))
      .slice(0, 20)
  }, [tasks, allKnownOrders, nomenclatures])

  // ─── Завантаження коробок з БД ────────────────────────────────────────────
  const loadBoxes = useCallback(async (batch) => {
    setLoadingBoxes(true)
    setBoxes([])
    setCheckedBoxes({})
    try {
      const { data, error } = await supabase
        .from('packaging_boxes')
        .select('*')
        .eq('order_id', batch.orderId)
        .eq('batch_index', String(batch.batchIndex))
        .order('box_number')

      if (error) { console.error('[Shipping] loadBoxes error:', error); return }

      // Групуємо по коробках
      const map = {}
      ;(data || []).forEach(row => {
        const key = row.box_number
        if (!map[key]) map[key] = { box_number: key, items: [] }
        const nom = (nomenclatures || []).find(n => String(n.id) === String(row.nomenclature_id))
        map[key].items.push({
          nom_id: row.nomenclature_id,
          nom_name: nom?.name || `ID:${row.nomenclature_id}`,
          material_type: nom?.material_type || '',
          qty: row.quantity,
          unit: nom?.unit || 'шт'
        })
      })

      const boxList = Object.values(map).sort((a, b) =>
        a.box_number.localeCompare(b.box_number, undefined, { numeric: true })
      )
      setBoxes(boxList)

      const initialChecked = {}
      boxList.forEach(b => { initialChecked[b.box_number] = false })
      setCheckedBoxes(initialChecked)
    } catch (e) {
      console.error('[Shipping] loadBoxes catch:', e)
    } finally {
      setLoadingBoxes(false)
    }
  }, [supabase, nomenclatures])

  // ─── Відкрити модалку "Взяти в роботу" ────────────────────────────────────
  const openWorkModal = useCallback((batch) => {
    setWorkModal({ batch })
    setShippingDate(new Date().toISOString().split('T')[0])
    setTtnNumber('')
    setSelectedWorkerId('')
    setBatchColor('')

    const rawName = String(batch.customer || '').trim().toLowerCase()
    const cust = (customers || []).find(c => {
      const name = String(c.name || c.company || '').trim().toLowerCase()
      return name === rawName || name.includes(rawName) || rawName.includes(name)
    })

    let addrs = parseCustomerDeliveryAddresses(cust)
    const defAddr = addrs.find(a => a.isDefault) || addrs[0]
    if (defAddr) {
      setSelectedClientAddressId(defAddr.id)
      setShippingType(defAddr.deliveryMethod === 'pickup' ? 'Самовивіз' : 'Доставка НП')
    } else {
      setSelectedClientAddressId('')
      setShippingType('Доставка НП')
    }

    loadBoxes(batch)
  }, [loadBoxes, customers])

  const closeWorkModal = useCallback(() => {
    setWorkModal(null)
    setBoxes([])
    setCheckedBoxes({})
  }, [])

  // Nova Poshta handlers
  const handleOpenNpModal = useCallback(async () => {
    setIsNpModalOpen(true)
    setNpError('')
    setNpSuccessData(null)
    setNpLoading(true)

    try {
      setNpKeyInput(getNpApiKey())
      const addr = customerDeliveryAddresses.find(a => a.id === selectedClientAddressId) || customerDeliveryAddresses[0]
      const recName = addr?.recipientName || matchingCustomer?.contact_person || matchingCustomer?.name || workModal?.batch?.customer || ''
      const recPhone = addr?.recipientPhone || matchingCustomer?.phone || ''
      const recCity = addr?.city || matchingCustomer?.city || 'Київ'
      const recWh = addr?.warehouse || addr?.address || ''

      setNpRecipientName(recName)
      setNpRecipientPhone(recPhone)
      setNpCitySearch(recCity)
      
      const initialCount = Math.max(1, boxes.length || 1)
      const initialSeats = Array.from({ length: initialCount }, (_, idx) => ({
        id: idx + 1,
        preset: '30x25x30',
        length: '30',
        width: '25',
        height: '30',
        weight: '1.5'
      }))
      setNpSeatsList(initialSeats)

      const sender = await fetchSenderDetails()
      setNpSenderDetails(sender)

      const cleanCityQuery = recCity.split(',')[0].replace(/^(м\.|смт\.|с\.|м|смт|с)\s*/i, '').trim()
      const cities = await searchNpCities(cleanCityQuery || recCity)
      setNpCityList(cities)

      if (cities && cities.length > 0) {
        const matchedCity = cities.find(c => {
          const main = (c.mainDescription || '').toLowerCase()
          const search = cleanCityQuery.toLowerCase()
          return main === search || main.includes(search) || search.includes(main)
        }) || cities[0]

        setNpSelectedCity(matchedCity)

        const warehouses = await fetchNpWarehouses(matchedCity.ref, matchedCity.mainDescription || cleanCityQuery)
        setNpWarehouseList(warehouses)

        if (warehouses && warehouses.length > 0) {
          const whNumMatch = recWh.match(/№\s*(\d+)/) || recWh.match(/відділення\s*№?\s*(\d+)/i) || recWh.match(/(\d+)/)
          const targetNum = whNumMatch ? whNumMatch[1] : null

          let matchedWh = null
          if (targetNum) {
            matchedWh = warehouses.find(w => String(w.number) === String(targetNum))
          }
          if (!matchedWh && recWh) {
            const cleanSearch = recWh.toLowerCase().replace(/[^a-z0-9а-щьюяєіїґ]/g, '')
            matchedWh = warehouses.find(w => {
              const desc = (w.description || '').toLowerCase().replace(/[^a-z0-9а-щьюяєіїґ]/g, '')
              return desc.includes(cleanSearch) || cleanSearch.includes(desc)
            })
          }

          setNpSelectedWarehouse(matchedWh || warehouses[0])
        }
      }
    } catch (err) {
      setNpError('Помилка завантаження даних НП: ' + err.message)
    } finally {
      setNpLoading(false)
    }
  }, [customerDeliveryAddresses, selectedClientAddressId, matchingCustomer, workModal, boxes])

  const handleCitySearch = useCallback(async (val) => {
    setNpCitySearch(val)
    if (val.trim().length >= 2) {
      const cities = await searchNpCities(val)
      setNpCityList(cities)
    }
  }, [])

  const handleSelectCity = useCallback(async (city) => {
    setNpSelectedCity(city)
    setNpCitySearch(city.mainDescription)
    setNpLoading(true)
    try {
      const warehouses = await fetchNpWarehouses(city.ref)
      setNpWarehouseList(warehouses)
      if (warehouses && warehouses.length > 0) {
        setNpSelectedWarehouse(warehouses[0])
      }
    } catch (err) {
      console.warn(err)
    } finally {
      setNpLoading(false)
    }
  }, [])

  const handleGenerateNpTTNSubmit = useCallback(async () => {
    setNpError('')
    setNpLoading(true)
    try {
      if (!npSelectedCity) throw new Error('Будь ласка, оберіть місто доставки')
      if (!npSelectedWarehouse) throw new Error('Будь ласка, оберіть відділення відправки / отримання')
      if (!npRecipientName.trim()) throw new Error('Вкажіть ПІБ отримувача')
      if (!npRecipientPhone.trim()) throw new Error('Вкажіть телефон отримувача')

      const senderRef = npSenderDetails?.senderRef
      if (!senderRef) {
        throw new Error('Не вдалося завантажити профіль відправника. Перевірте API Key Нової Пошти у Налаштуваннях.')
      }

      const recipient = await createOrGetRecipient({
        recipientName: npRecipientName,
        phone: npRecipientPhone,
        edrpou: matchingCustomer?.edrpou || '',
        cityName: npSelectedCity.mainDescription
      })

      const result = await generateNpTTN({
        senderRef,
        senderAddressRef: npSenderDetails.addressRef,
        senderContactRef: npSenderDetails.contactRef,
        senderPhone: npSenderDetails.contactPhone,
        recipientRef: recipient.recipientRef,
        recipientAddressRef: npSelectedWarehouse.ref,
        recipientContactRef: recipient.contactRef,
        recipientPhone: npRecipientPhone,
        serviceType: npServiceType,
        payerType: npPayerType,
        paymentMethod: npPaymentMethod,
        cost: npCost,
        cargoDescription: npDescription,
        seatsList: npSeatsList
      })

      setNpSuccessData(result)
      setTtnNumber(result.ttnNumber)
    } catch (err) {
      setNpError(err.message)
    } finally {
      setNpLoading(false)
    }
  }, [npSelectedCity, npSelectedWarehouse, npRecipientName, npRecipientPhone, npSenderDetails, matchingCustomer, npServiceType, npPayerType, npPaymentMethod, npCost, npDescription, npSeatsList])

  // NP Multi-seat helpers
  const handleAddSeat = useCallback(() => {
    setNpSeatsList(prev => [
      ...prev,
      { id: Date.now(), preset: '30x25x30', length: '30', width: '25', height: '30', weight: '1.5' }
    ])
  }, [])

  const handleRemoveSeat = useCallback((id) => {
    if (npSeatsList.length <= 1) return
    setNpSeatsList(prev => prev.filter(s => s.id !== id))
  }, [npSeatsList.length])

  const handleUpdateSeat = useCallback((id, fields) => {
    setNpSeatsList(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s))
  }, [])

  const totalSeatsWeight = useMemo(() => {
    return npSeatsList.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0)
  }, [npSeatsList])

  const canFinish = useMemo(() => {
    if (!shippingType || !shippingDate || !ttnNumber.trim() || !selectedWorkerId || !batchColor) return false
    if (boxes.length === 0) return false
    const allChecked = boxes.every(b => checkedBoxes[b.box_number] === true)
    return allChecked
  }, [shippingType, shippingDate, ttnNumber, selectedWorkerId, batchColor, boxes, checkedBoxes])

  // ─── Завершити відвантаження ───────────────────────────────────────────────
  const handleFinishShipping = useCallback(async () => {
    if (!workModal || !canFinish) return
    const { batch } = workModal
    const worker = shippingWorkers.find(u => String(u.id) === String(selectedWorkerId))
    const workerName = worker ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim() : ''
    const colorObj = PALLET_COLORS.find(c => c.id === batchColor)

    try {
      setIsProcessing(true)

      // 1. Списуємо матеріали зі складу
      for (const t of batch.batchTasks) {
        await deductIssuedMaterialsForTask(t.id, { packagingOnly: true })
      }

      // 1.5. Визначаємо наступний номер пакувального листа
      const slipNumberResult = await claimNextPackingSlipNumber(supabase)
      if (slipNumberResult.error || !slipNumberResult.data) {
        throw slipNumberResult.error || new Error('Failed to reserve the next packing-slip number')
      }
      const nextSlipNumber = slipNumberResult.data

      // 2. Оновлюємо метадані в завданнях
      for (const t of batch.batchTasks) {
        const newSnapshot = {
          ...(t.plan_snapshot || {}),
          _metadata: {
            ...(t.plan_snapshot?._metadata || {}),
            is_shipped: true,
            shipped_at: new Date().toISOString(),
            shipped_by: workerName,
            shipped_by_id: worker?.id,
            shipping_type: shippingType,
            shipping_date: shippingDate,
            ttn_number: ttnNumber.trim().toUpperCase(),
            batch_color: batchColor,
            batch_color_label: colorObj?.label || batchColor,
            batch_color_hex: colorObj?.hex || '#888',
            packing_slip_number: nextSlipNumber,
          }
        }
        await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', t.id)
      }

      // 3. Якщо всі партії відвантажені → статус замовлення = shipped
      const { data: siblingTasks } = await supabase
        .from('tasks').select('plan_snapshot').eq('order_id', batch.orderId)
      const allShipped = (siblingTasks || []).every(st => st.plan_snapshot?._metadata?.is_shipped === true)
      if (allShipped) {
        await supabase.from('orders').update({ status: 'shipped' }).eq('id', batch.orderId)
      }

      await fetchData(['tasks', 'orders'])

      // 4. Генеруємо пакувальний лист
      const order = (orders || []).find(o => String(o.id) === String(batch.orderId))
      const plannedSets = batch.batchTasks[0]?.planned_sets || 0
      const productNames = order?.order_items?.map(it => (nomenclatures || []).find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'

      // Агрегуємо вміст коробок
      const aggregatedMap = {}
      boxes.forEach(box => {
        box.items.forEach(item => {
          const key = item.nom_id || item.nom_name
          if (!aggregatedMap[key]) {
            const nom = (nomenclatures || []).find(n => String(n.id) === String(item.nom_id))
            aggregatedMap[key] = {
              nom_id: item.nom_id,
              nom_name: item.nom_name,
              material_type: item.material_type || nom?.material_type || '',
              qty: 0,
              unit: item.unit,
              nom: nom || null,
              boxes: []
            }
          }
          aggregatedMap[key].qty += Number(item.qty) || 0
          if (!aggregatedMap[key].boxes.includes(box.box_number)) {
            aggregatedMap[key].boxes.push(box.box_number)
          }
        })
      })

      const aggregatedList = Object.values(aggregatedMap).map(item => {
        let categoryKey = 'other'
        if (item.nom) {
          const type = (item.nom.type || '').toLowerCase()
          const name = (item.nom.name || '').toLowerCase()
          const code = (item.nom.nomenclature_code || '').toLowerCase()
          if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categoryKey = 'mounts'
          else if (name.includes('іп') || code.includes('іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) categoryKey = 'sgp'
          else if (name.includes('стійка') || type.includes('стійк')) categoryKey = 'spacers'
          else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка')) categoryKey = 'hardware'
        }
        return {
          nom_id: item.nom_id,
          nom_name: item.nom_name,
          material_type: item.material_type,
          qty: item.qty,
          unit: item.unit,
          boxes: item.boxes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          categoryKey
        }
      })

      setPackingSlip({
        orderNum: batch.orderNum,
        customer: batch.customer,
        batchIndex: batch.batchIndex,
        shippingDate,
        shippingType,
        ttn: ttnNumber.trim().toUpperCase(),
        workerName,
        batchColor: colorObj?.label || batchColor,
        batchColorHex: colorObj?.hex || '#888',
        boxes: [...boxes],
        plannedSets,
        productNames,
        aggregatedList,
        slipNumber: nextSlipNumber,
        generatedAt: new Date().toISOString(),
      })

      setWorkModal(null)
    } catch (e) {
      console.error('[Shipping] finish error:', e)
      alert('Помилка при відвантаженні: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }, [workModal, canFinish, selectedWorkerId, batchColor, deductIssuedMaterialsForTask, supabase, shippingType, shippingDate, ttnNumber, fetchData, orders, nomenclatures, boxes])

  // ─── Перегляд існуючого пакувального листа ───────────────────────────────
  const handleViewPackingSlip = useCallback(async (batch) => {
    setLoadingBoxes(true)
    try {
      const { data, error } = await supabase
        .from('packaging_boxes')
        .select('*')
        .eq('order_id', batch.orderId)
        .eq('batch_index', String(batch.batchIndex))
        .order('box_number')

      if (error) { console.error('[Shipping] loadBoxes error:', error); return }

      const map = {}
      ;(data || []).forEach(row => {
        const key = row.box_number
        if (!map[key]) map[key] = { box_number: key, items: [] }
        const nom = (nomenclatures || []).find(n => String(n.id) === String(row.nomenclature_id))
        map[key].items.push({
          nom_id: row.nomenclature_id,
          nom_name: nom?.name || `ID:${row.nomenclature_id}`,
          material_type: nom?.material_type || '',
          qty: row.quantity,
          unit: nom?.unit || 'шт'
        })
      })

      const boxList = Object.values(map).sort((a, b) =>
        a.box_number.localeCompare(b.box_number, undefined, { numeric: true })
      )

      // Отримуємо planned_sets з бази даних
      const { data: dbTasks } = await supabase
        .from('tasks')
        .select('planned_sets, plan_snapshot')
        .eq('order_id', batch.orderId)
        .eq('batch_index', String(batch.batchIndex))
      
      const firstTask = dbTasks?.[0]
      const plannedSets = firstTask?.planned_sets || 0
      const meta = firstTask?.plan_snapshot?._metadata || {}

      const order = (orders || []).find(o => String(o.id) === String(batch.orderId))
      const productNames = order?.order_items?.map(it => (nomenclatures || []).find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'

      // Агрегуємо
      const aggregatedMap = {}
      boxList.forEach(box => {
        box.items.forEach(item => {
          const key = item.nom_id || item.nom_name
          if (!aggregatedMap[key]) {
            const nom = (nomenclatures || []).find(n => String(n.id) === String(item.nom_id))
            aggregatedMap[key] = {
              nom_id: item.nom_id,
              nom_name: item.nom_name,
              material_type: item.material_type || nom?.material_type || '',
              qty: 0,
              unit: item.unit,
              nom: nom || null,
              boxes: []
            }
          }
          aggregatedMap[key].qty += Number(item.qty) || 0
          if (!aggregatedMap[key].boxes.includes(box.box_number)) {
            aggregatedMap[key].boxes.push(box.box_number)
          }
        })
      })

      const aggregatedList = Object.values(aggregatedMap).map(item => {
        let categoryKey = 'other'
        if (item.nom) {
          const type = (item.nom.type || '').toLowerCase()
          const name = (item.nom.name || '').toLowerCase()
          const code = (item.nom.nomenclature_code || '').toLowerCase()
          if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categoryKey = 'mounts'
          else if (name.includes('іп') || code.includes('іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) categoryKey = 'sgp'
          else if (name.includes('стійка') || type.includes('стійк')) categoryKey = 'spacers'
          else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка')) categoryKey = 'hardware'
        }
        return {
          nom_id: item.nom_id,
          nom_name: item.nom_name,
          material_type: item.material_type,
          qty: item.qty,
          unit: item.unit,
          boxes: item.boxes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          categoryKey
        }
      })

      setPackingSlip({
        orderNum: batch.orderNum,
        customer: batch.customer,
        batchIndex: batch.batchIndex,
        shippingDate: batch.shippingDate || meta.shipping_date,
        shippingType: batch.shippingType || meta.shipping_type,
        ttn: batch.ttn || meta.ttn_number,
        workerName: batch.shippedBy || meta.shipped_by,
        batchColor: batch.batchColor || meta.batch_color,
        batchColorHex: meta.batch_color_hex || '#888',
        boxes: boxList,
        plannedSets,
        productNames,
        aggregatedList,
        slipNumber: batch.packingSlipNumber || meta.packing_slip_number,
        generatedAt: meta.shipped_at || new Date().toISOString(),
      })
    } catch (err) {
      console.error('[Shipping] load packing slip error:', err)
    } finally {
      setLoadingBoxes(false)
    }
  }, [supabase, nomenclatures, orders])

  return {
    currentUser,
    activeMobileSection,
    setActiveMobileSection,
    isProcessing,
    readyBatches,
    shippedBatches,
    workModal,
    openWorkModal,
    closeWorkModal,
    customerDeliveryAddresses,
    matchingCustomer,
    selectedClientAddressId,
    setSelectedClientAddressId,
    shippingType,
    setShippingType,
    shippingDate,
    setShippingDate,
    ttnNumber,
    setTtnNumber,
    selectedWorkerId,
    setSelectedWorkerId,
    batchColor,
    setBatchColor,
    boxes,
    checkedBoxes,
    setCheckedBoxes,
    loadingBoxes,
    shippingWorkers,
    handleOpenNpModal,
    handleFinishShipping,
    canFinish,
    isNpModalOpen,
    setIsNpModalOpen,
    npError,
    npKeyInput,
    setNpKeyInput,
    saveNpApiKey,
    npSuccessData,
    npSenderDetails,
    npRecipientName,
    setNpRecipientName,
    npRecipientPhone,
    setNpRecipientPhone,
    npCitySearch,
    handleCitySearch,
    npCityList,
    npSelectedCity,
    handleSelectCity,
    npWarehouseList,
    npSelectedWarehouse,
    setNpSelectedWarehouse,
    npCost,
    setNpCost,
    npSeatsList,
    totalSeatsWeight,
    handleAddSeat,
    handleRemoveSeat,
    handleUpdateSeat,
    npDescription,
    setNpDescription,
    npPayerType,
    setNpPayerType,
    npLoading,
    handleGenerateNpTTNSubmit,
    packingSlip,
    setPackingSlip,
    handleViewPackingSlip
  }
}
