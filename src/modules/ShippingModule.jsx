import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Truck, ArrowLeft, ClipboardList, AlertCircle, PackageCheck,
  X, Package, FileText, Printer, Calendar, User, Hash,
  Boxes, CheckSquare, Square, ChevronDown, Palette, Clock,
  CheckCircle2, ArrowRight, Download, Plus, Trash2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { claimNextPackingSlipNumber } from '../services/fulfillmentQueueService'
import { 
  getNpApiKey, searchNpCities, fetchNpWarehouses, 
  fetchSenderDetails, createOrGetRecipient, generateNpTTN 
} from '../services/novaPoshtaService'

// Форматування назви номенклатури спеціально для пакувального листа
const formatPackingSlipName = (nomName, materialType, productNames = '') => {
  const name = (nomName || '').trim().toUpperCase();
  
  // Паттерн 1: ІП-72-F5-В-3-45
  const match1 = name.match(/^(?:ІП|IP)-(\d+)-([A-Z0-9]+)-([ВНХПBHXP])[-_](\d+)-(\d+)$/);
  
  // Паттерн 2: F610-ІП24-Н-3-14
  const match2 = name.match(/^([A-Z0-9]+)-(?:ІП|IP)(\d+)-([ВНХПBHXP])[-_](\d+)-(\d+)$/);

  if (match1 || match2) {
    let projNum = '';
    let frame = '';
    let typeLetter = '';
    let thickness = '';
    let qty = '';
    
    if (match1) {
      projNum = match1[1];
      frame = match1[2];
      typeLetter = match1[3];
      thickness = match1[4];
      qty = match1[5];
    } else {
      frame = match2[1];
      projNum = match2[2];
      typeLetter = match2[3];
      thickness = match2[4];
      qty = match2[5];
    }
    
    const typeMap = {
      'В': 'Верхня пластина',
      'B': 'Верхня пластина',
      'Н': 'Нижня пластина',
      'H': 'Нижня пластина',
      'Х': 'Хрестик',
      'X': 'Хрестик',
      'П': 'Промені',
      'P': 'Промені'
    };
    const typeName = typeMap[typeLetter] || 'Деталь';
    
    let extra = '';
    if (productNames) {
      const parts = productNames.split(',').map(p => p.trim());
      const cityPart = parts.find(p => p.includes('Київ') || p.includes('К'));
      if (cityPart) {
        extra = cityPart;
      } else if (parts.length > 2) {
        extra = parts[parts.length - 1];
      }
    }
    if (!extra) {
      extra = 'Київ К';
    }
    
    return `${typeName}, ${frame}, ІП ${projNum}, ${extra}, ${thickness}мм, ${qty}шт`;
  }

  // Для гвинтів та гайок: якщо є опис в materialType, використовуємо його
  if (materialType && (name.startsWith('ГВИНТ') || name.startsWith('ГАЙКА'))) {
    let prefix = '';
    if (name.startsWith('ГВИНТ')) prefix = 'Гвинт ';
    if (name.startsWith('ГАЙКА')) prefix = 'Гайка ';
    
    let res = materialType;
    if (prefix && !res.toLowerCase().startsWith(prefix.trim().toLowerCase())) {
      res = prefix + res;
    }
    return res;
  }
  
  return nomName;
};


// ─── Кольори маркування палет ─────────────────────────────────────────────────
const PALLET_COLORS = [
  { id: 'red',    label: 'Червоний',   hex: '#ef4444' },
  { id: 'orange', label: 'Помаранчевий', hex: '#f97316' },
  { id: 'yellow', label: 'Жовтий',    hex: '#eab308' },
  { id: 'green',  label: 'Зелений',   hex: '#22c55e' },
  { id: 'blue',   label: 'Синій',     hex: '#3b82f6' },
  { id: 'purple', label: 'Фіолетовий', hex: '#a855f7' },
  { id: 'pink',   label: 'Рожевий',   hex: '#ec4899' },
  { id: 'white',  label: 'Білий',     hex: '#f1f5f9' },
]

// ─── Кастомний Select (щоб уникнути нечитабельного нативного дропдауну на Windows) ─
const CustomSelect = ({ value, onChange, options, placeholder = '— Обрати —', accent = '#ff9000' }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  const selected = options.find(o => o.value === value)

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '12px 40px 12px 14px',
          background: value ? `rgba(${accent === '#ff9000' ? '255,144,0' : '168,85,247'},0.08)` : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${value ? accent + '55' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '12px',
          color: value ? '#fff' : '#555',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s',
        }}
      >
        {selected?.icon && <span>{selected.icon}</span>}
        <span style={{ flex: 1 }}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} color={accent} style={{ position: 'absolute', right: '12px', top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: '0.2s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0, right: 0,
          background: '#111827',
          border: `1px solid ${accent}33`,
          borderRadius: '14px',
          zIndex: 999,
          overflow: 'hidden',
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${accent}22`,
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                background: value === opt.value ? `${accent}18` : 'transparent',
                color: value === opt.value ? '#fff' : '#aaa',
                fontSize: '0.85rem',
                fontWeight: value === opt.value ? 800 : 600,
                borderLeft: value === opt.value ? `3px solid ${accent}` : '3px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (value !== opt.value) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={e => { if (value !== opt.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' } }}
            >
              {opt.icon && <span style={{ fontSize: '1rem' }}>{opt.icon}</span>}
              <span>{opt.label}</span>
              {value === opt.value && <CheckCircle2 size={14} color={accent} style={{ marginLeft: 'auto' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ShippingModule = () => {
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
  const [npSeatsAmount, setNpSeatsAmount] = useState('1')
  const [npWeight, setNpWeight] = useState('1.5')
  const [npCost, setNpCost] = useState('1000')
  const [npDescription, setNpDescription] = useState('Деталі карбонової рами та метизи')
  const [npServiceType, setNpServiceType] = useState('WarehouseWarehouse')
  const [npPayerType, setNpPayerType] = useState('Recipient')
  const [npPaymentMethod, setNpPaymentMethod] = useState('Cash')

  // NP Multi-Seat State (Згідно стандартів Нової Пошти v2.0)
  const [npSeatsList, setNpSeatsList] = useState([
    { id: 1, preset: '30x25x30', length: '30', width: '25', height: '30', weight: '1.5' }
  ])

  const handleAddSeat = () => {
    setNpSeatsList(prev => [
      ...prev,
      { id: Date.now(), preset: '30x25x30', length: '30', width: '25', height: '30', weight: '1.5' }
    ])
  }

  const handleRemoveSeat = (id) => {
    if (npSeatsList.length <= 1) return
    setNpSeatsList(prev => prev.filter(s => s.id !== id))
  }

  const handleUpdateSeat = (id, fields) => {
    setNpSeatsList(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s))
  }

  const totalSeatsWeight = useMemo(() => {
    return npSeatsList.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2)
  }, [npSeatsList])

  // Знайдений клієнт та його збережені адреси
  const matchingCustomer = useMemo(() => {
    if (!workModal?.batch?.customer) return null
    const rawName = String(workModal.batch.customer || '').trim().toLowerCase()
    return (customers || []).find(c => {
      const name = String(c.name || c.company || '').trim().toLowerCase()
      return name === rawName || name.includes(rawName) || rawName.includes(name)
    })
  }, [workModal, customers])

const parseCustomerDeliveryAddresses = (cust) => {
  if (!cust) return []
  let list = []

  if (Array.isArray(cust.deliveryAddresses)) {
    list = cust.deliveryAddresses
  } else if (Array.isArray(cust.delivery_addresses)) {
    list = cust.delivery_addresses
  } else if (cust.notes) {
    if (cust.notes.includes('[DELIVERY_ADDRESSES_B64:')) {
      const match = cust.notes.match(/\[DELIVERY_ADDRESSES_B64:([A-Za-z0-9+/=]+)\]/)
      if (match && match[1]) {
        try {
          const jsonStr = decodeURIComponent(escape(atob(match[1])))
          const parsed = JSON.parse(jsonStr)
          if (Array.isArray(parsed)) list = parsed
        } catch (e) {
          console.warn('[Shipping] B64 decode address error:', e)
        }
      }
    } else if (cust.notes.includes('[DELIVERY_ADDRESSES_JSON:')) {
      try {
        const match = cust.notes.match(/\[DELIVERY_ADDRESSES_JSON:([\s\S]*?)\]/)
        if (match && match[1]) {
          const parsed = JSON.parse(match[1])
          if (Array.isArray(parsed)) list = parsed
        }
      } catch (e) {}
    }
  }

  if (!Array.isArray(list) || list.length === 0) {
    if (cust.delivery_city || cust.delivery_warehouse || cust.city) {
      list = [{
        id: 'addr_def',
        title: 'Основна адреса',
        deliveryMethod: cust.delivery_method || 'np_warehouse',
        city: cust.delivery_city || cust.city || 'Київ',
        warehouse: cust.delivery_warehouse || '',
        address: cust.delivery_address || cust.address || '',
        recipientName: cust.delivery_recipient_name || cust.contact_person || '',
        recipientPhone: cust.delivery_recipient_phone || cust.phone || '',
        isLegalEntity: cust.is_legal_entity || false,
        edrpou: cust.edrpou || cust.tin || '',
        legalEntityName: cust.legal_entity_name || cust.company || '',
        isDefault: true
      }]
    }
  }

  return list
}

  const customerDeliveryAddresses = useMemo(() => {
    return parseCustomerDeliveryAddresses(matchingCustomer)
  }, [matchingCustomer])

  // Стан пакувального листа
  const [packingSlip, setPackingSlip] = useState(null)
  const printRef = useRef(null)

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
        // Знаходимо назву номенклатури
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

      // Ініціалізуємо чекбокси
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

    // Look up customer addresses
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

  const closeWorkModal = () => {
    setWorkModal(null)
    setBoxes([])
    setCheckedBoxes({})
  }

  const handleOpenNpModal = async () => {
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
  }

  const handleCitySearch = async (val) => {
    setNpCitySearch(val)
    if (val.trim().length >= 2) {
      const cities = await searchNpCities(val)
      setNpCityList(cities)
    }
  }

  const handleSelectCity = async (city) => {
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
  }

  const handleGenerateNpTTNSubmit = async () => {
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
  }

  // ─── Перевірка чи можна завершити ─────────────────────────────────────────
  const canFinish = useMemo(() => {
    if (!shippingType || !shippingDate || !ttnNumber.trim() || !selectedWorkerId || !batchColor) return false
    if (boxes.length === 0) return false
    const allChecked = boxes.every(b => checkedBoxes[b.box_number] === true)
    return allChecked
  }, [shippingType, shippingDate, ttnNumber, selectedWorkerId, batchColor, boxes, checkedBoxes])

  // ─── Завершити відвантаження ───────────────────────────────────────────────
  const handleFinishShipping = async () => {
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
  }

  // ─── Друк пакувального листа ───────────────────────────────────────────────
  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML
    if (!printContent) return
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Пакувальний лист</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            color: #111827;
            background: #fff;
            padding: 24px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th { background: #f3f4f6; color: #111827; padding: 8px 12px; text-align: left; font-weight: 700; border: 1px solid #e5e7eb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 7px 12px; border: 1px solid #e5e7eb; font-size: 10px; }
          @media print {
            body {
              padding: 0;
              zoom: 75%; /* Proportional scaling down to guarantee clean fitting */
            }
            .category-block {
              padding: 8px !important;
              margin-bottom: 8px !important;
            }
            .category-grid {
              gap: 6px !important;
            }
            .category-item-card {
              padding: 6px 10px !important;
            }
            .signatures-row {
              margin-top: 20px !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table {
              margin-bottom: 12px !important;
            }
            th {
              padding: 5px 8px !important;
              font-size: 9px !important;
            }
            td {
              padding: 5px 8px !important;
              font-size: 9px !important;
            }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.addEventListener('load', () => {
            const images = document.getElementsByTagName('img');
            let loaded = 0;
            if (images.length === 0) {
              window.print();
              window.close();
            } else {
              Array.from(images).forEach(img => {
                if (img.complete) {
                  loaded++;
                  if (loaded === images.length) {
                    setTimeout(() => { window.print(); window.close(); }, 500);
                  }
                } else {
                  img.addEventListener('load', () => {
                    loaded++;
                    if (loaded === images.length) {
                      setTimeout(() => { window.print(); window.close(); }, 500);
                    }
                  });
                  img.addEventListener('error', () => {
                    loaded++;
                    if (loaded === images.length) {
                      setTimeout(() => { window.print(); window.close(); }, 500);
                    }
                  });
                }
              });
            }
          });
        </script>
      </body>
      </html>
    `)
    win.document.close()
  }

  // ─── Перегляд існуючого пакувального листа ───────────────────────────────
  const handleViewPackingSlip = async (batch) => {
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
  }

  // Підрахунок коробок
  const totalBoxes = boxes.length
  const checkedCount = Object.values(checkedBoxes).filter(Boolean).length

  return (
    <div className="shipping-module-container" style={{ background: 'var(--bg, #050505)', minHeight: '100vh', color: 'var(--text, #e2e8f0)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* HEADER */}
      <header className="shipping-header" style={{ padding: '20px 40px', background: 'var(--header-bg, rgba(10,10,10,0.95))', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border, #1a1a1a)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ background: 'var(--card-bg, #111)', color: 'var(--text-secondary, #555)', width: '44px', height: '44px', borderRadius: '14px', border: '1px solid var(--border, #222)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', textDecoration: 'none' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)', padding: '12px', borderRadius: '16px', boxShadow: '0 8px 20px rgba(255,144,0,0.25)' }}>
              <Truck size={24} color="#000" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: 'var(--text, #fff)' }}>ЛОГІСТИЧНИЙ ЦЕНТР</h1>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #555)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Управління відвантаженням та ТТН</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #fff)' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800 }}>ВІДДІЛ ВІДВАНТАЖЕННЯ</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ff900015', border: '1px solid #ff900030', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} color="#ff9000" />
          </div>
        </div>
      </header>

      {/* MOBILE TABS */}
      <div className="shipping-mobile-tabs">
        <button onClick={() => setActiveMobileSection('ready')} className={`tab-btn ${activeMobileSection === 'ready' ? 'active' : ''}`}>
          ГОТОВО ({readyBatches.length})
        </button>
        <button onClick={() => setActiveMobileSection('shipped')} className={`tab-btn ${activeMobileSection === 'shipped' ? 'active' : ''}`}>
          ВІДПРАВЛЕНО ({shippedBatches.length})
        </button>
      </div>

      <main style={{ padding: '40px', flex: 1, maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
        <div className="shipping-grid">

          {/* КОЛОНКА: ГОТОВО ДО ВІДВАНТАЖЕННЯ */}
          <section className={`dashboard-col ${activeMobileSection !== 'ready' ? 'hide-mobile' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text, #fff)', margin: 0 }}>ГОТОВО ДО ВІДВАНТАЖЕННЯ</h3>
              </div>
              <span style={{ background: '#10b98115', color: '#10b981', fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', borderRadius: '10px', border: '1px solid #10b98130' }}>
                {readyBatches.length} ПАРТІЙ
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {readyBatches.map(batch => (
                <div key={`${batch.orderId}_${batch.batchIndex}`} className="batch-card">
                  {/* Кольорова смуга зліва якщо є колір */}
                  {batch.batchColor && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: PALLET_COLORS.find(c => c.id === batch.batchColor)?.hex || '#888', borderRadius: '28px 0 0 28px' }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="batch-order-num" style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text, #fff)' }}>#{batch.orderNum}</div>
                      <div className="batch-index-lbl" style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-secondary, #555)', marginTop: '2px' }}>ПАРТІЯ {batch.batchIndex}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: '#10b98115', color: '#10b981', fontSize: '0.6rem', fontWeight: 900, padding: '5px 10px', borderRadius: '8px' }}>
                        ✓ ЗАПАКОВАНО
                      </div>
                    </div>
                  </div>

                  <div className="shipping-customer-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-inner-bg, #0a0a0a)', padding: '12px 14px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={14} color="#ff9000" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #fff)' }}>
                          {batch.customer && batch.customer !== '—' ? batch.customer : 'Клієнт не вказаний'}
                        </span>
                      </div>
                      {batch.plannedSets > 0 && (
                        <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 900 }}>
                          {batch.plannedSets} компл.
                        </span>
                      )}
                    </div>

                    {batch.productNames && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary, #888)', fontWeight: 600 }}>
                        <Package size={13} color="#ff9000" style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{batch.productNames}</span>
                      </div>
                    )}
                  </div>

                  {batch.packedBy && (
                    <div className="shipping-packed-by" style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #444)', fontWeight: 600 }}>
                      📦 Запакував: {batch.packedBy}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                    <div className="shipping-deadline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary, #444)', fontWeight: 700 }}>
                      <Calendar size={12} />
                      <span>{batch.deadline ? new Date(batch.deadline).toLocaleDateString('uk-UA') : '—'}</span>
                    </div>
                    <button
                      onClick={() => openWorkModal(batch)}
                      disabled={isProcessing}
                      className="take-work-btn"
                    >
                      <Truck size={16} />
                      <span>ВЗЯТИ В РОБОТУ</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {readyBatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 40px', color: '#222' }}>
                  <PackageCheck size={48} color="#1a1a1a" />
                  <p style={{ fontWeight: 900, color: 'var(--text, #333)', margin: '15px 0 5px' }}>Черга відвантаження порожня</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #555)' }}>Очікуємо завершення пакування в цеху</span>
                </div>
              )}
            </div>
          </section>

          {/* КОЛОНКА: ВІДПРАВЛЕНО */}
          <section className={`dashboard-col ${activeMobileSection !== 'shipped' ? 'hide-mobile' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="#555" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary, #555)', margin: 0 }}>ВІДПРАВЛЕНО</h3>
              </div>
              <span style={{ background: 'var(--card-inner-bg, #111)', color: 'var(--text-secondary, #555)', fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border, #222)' }}>
                {shippedBatches.length} ПАРТІЙ
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shippedBatches.map(batch => {
                const colorObj = PALLET_COLORS.find(c => c.id === batch.batchColor)
                return (
                  <div key={`${batch.orderId}_${batch.batchIndex}`} className="shipped-batch-card" style={{
                    background: 'var(--card-bg, #0d0d0d)', border: '1px solid var(--border, #1a1a1a)', borderRadius: '20px',
                    padding: '18px 20px', position: 'relative', overflow: 'hidden'
                  }}>
                    {colorObj && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: colorObj.hex, borderRadius: '20px 0 0 20px' }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #888)' }}>#{batch.orderNum} · Партія {batch.batchIndex}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #444)', marginTop: '3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{batch.customer && batch.customer !== '—' ? batch.customer : 'Клієнт не вказаний'}</span>
                          {batch.plannedSets > 0 && (
                            <span style={{ color: '#ff9000', fontWeight: 800 }}>({batch.plannedSets} компл.)</span>
                          )}
                        </div>
                        {batch.productNames && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #666)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Package size={12} color="#888" />
                            <span>{batch.productNames}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, background: '#10b98110', padding: '4px 8px', borderRadius: '6px' }}>ВІДПРАВЛЕНО</div>
                        {batch.shippedAt && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #333)', marginTop: '4px' }}>
                            {new Date(batch.shippedAt).toLocaleDateString('uk-UA')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border, #1a1a1a)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {batch.ttn && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #555)', background: 'var(--card-inner-bg, #111)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            ТТН: {batch.ttn}
                          </span>
                        )}
                        {batch.shippingType && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #555)', background: 'var(--card-inner-bg, #111)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            {batch.shippingType}
                          </span>
                        )}
                        {batch.shippedBy && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #555)', background: 'var(--card-inner-bg, #111)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            👤 {batch.shippedBy}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleViewPackingSlip(batch)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', borderRadius: '8px', padding: '5px 10px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ff9000'; e.currentTarget.style.color = '#000' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,144,0,0.1)'; e.currentTarget.style.color = '#ff9000' }}
                      >
                        <Printer size={12} /> Лист {batch.packingSlipNumber ? `№${batch.packingSlipNumber}` : ''}
                      </button>
                    </div>
                  </div>
                )
              })}

              {shippedBatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 40px', color: '#222' }}>
                  <Clock size={40} color="#1a1a1a" />
                  <p style={{ fontWeight: 800, color: '#333', margin: '12px 0 0' }}>Ще нічого не відвантажено</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          МОДАЛЬНЕ ВІКНО "ВЗЯТИ В РОБОТУ"
      ═══════════════════════════════════════════════════════════════════════ */}
      {workModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div className="shipping-modal-card" style={{ background: 'linear-gradient(160deg, #0f1923 0%, #0a0f18 100%)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '32px', width: '100%', maxWidth: '720px', marginTop: '20px', marginBottom: '20px', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(255,144,0,0.05)' }}>

            {/* Modal Header */}
            <div style={{ padding: '28px 32px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,144,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #ff9000, #ff5e00)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(255,144,0,0.4)' }}>
                  <Truck size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Взяти в роботу
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ff9000', fontWeight: 700, marginTop: '2px' }}>
                    #{workModal.batch.orderNum} · Партія {workModal.batch.batchIndex} · {workModal.batch.customer}
                  </div>
                </div>
              </div>
              <button onClick={closeWorkModal} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#888', cursor: 'pointer', padding: '10px', display: 'flex', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* ── АДРЕСИ ДОСТАВКИ КЛІЄНТА ── */}
              {customerDeliveryAddresses.length > 0 && (
                <div className="shipping-address-btn-container" style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '20px', padding: '20px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={14} />
                      <span>Оберіть адресу доставки клієнта ({matchingCustomer?.name || workModal?.batch?.customer})</span>
                    </div>
                    {customerDeliveryAddresses.length > 1 && (
                      <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem' }}>
                        Знайдено адрес: {customerDeliveryAddresses.length}
                      </span>
                    )}
                  </div>

                  {/* Кнопки вибору адрес */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {customerDeliveryAddresses.map(addr => {
                      const isSel = selectedClientAddressId === addr.id
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => {
                            setSelectedClientAddressId(addr.id)
                            setShippingType(addr.deliveryMethod === 'pickup' ? 'Самовивіз' : 'Доставка НП')
                          }}
                          className={`shipping-address-btn ${isSel ? 'active-address' : ''}`}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '12px',
                            border: isSel ? '2px solid #ff9000' : '1px solid var(--border, rgba(255,255,255,0.08))',
                            background: isSel ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #111)',
                            color: isSel ? 'var(--text, #fff)' : 'var(--text-secondary, #aaa)',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            boxShadow: isSel ? '0 4px 15px rgba(255,144,0,0.25)' : 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: isSel ? '#ff9000' : '#888' }}>
                              {addr.deliveryMethod === 'pickup' ? '🏢' : addr.deliveryMethod === 'np_postomat' ? '📮' : '📦'}
                            </span>
                            <span className="address-title">{addr.title || addr.city}</span>
                            {addr.isDefault && (
                              <span style={{ background: '#ff9000', color: '#000', padding: '1px 5px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 950 }}>
                                ★ Основна
                              </span>
                            )}
                          </div>
                          <div className="address-subtitle" style={{ fontSize: '0.7rem', color: isSel ? 'var(--text, #ddd)' : 'var(--text-secondary, #666)', fontWeight: 600 }}>
                            {addr.city}{addr.warehouse ? `, ${addr.warehouse}` : addr.address ? `, ${addr.address}` : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Інформаційна картка обраної / єдиної адреси */}
                  {(() => {
                    const sel = customerDeliveryAddresses.find(a => a.id === selectedClientAddressId) || customerDeliveryAddresses[0]
                    if (!sel) return null
                    return (
                      <div className="shipping-address-summary" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '14px', border: '1px solid rgba(255,144,0,0.15)', fontSize: '0.78rem', color: 'var(--text, #ccc)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Місто:</strong> {sel.city || '—'}</div>
                        <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Спосіб:</strong> {sel.deliveryMethod === 'pickup' ? 'Самовивіз' : sel.deliveryMethod === 'np_postomat' ? 'Поштомат НП' : sel.deliveryMethod === 'np_courier' ? 'Адресна НП' : 'Відділення НП'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary, #888)' }}>Адреса / Відділення:</strong> <span style={{ color: '#ff9000', fontWeight: 800 }}>{sel.warehouse || sel.address || '—'}</span></div>
                        {sel.recipientName && <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Отримувач:</strong> {sel.recipientName}</div>}
                        {sel.recipientPhone && <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Тел. отримувача:</strong> {sel.recipientPhone}</div>}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── СЕКЦІЯ 1: ДЕТАЛІ ВІДВАНТАЖЕННЯ ── */}
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' }}>
                  Деталі відвантаження
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                  {/* Тип відвантаження */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Тип відвантаження</label>
                    <CustomSelect
                      value={shippingType}
                      onChange={setShippingType}
                      options={[
                        { value: 'Самовивіз', label: 'Самовивіз', icon: '🚗' },
                        { value: 'Доставка НП', label: 'Доставка НП', icon: '📦' },
                      ]}
                      placeholder="— Обрати —"
                    />
                  </div>

                  {/* Дата відвантаження */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Дата відвантаження</label>
                    <input
                      type="date"
                      value={shippingDate}
                      onChange={e => setShippingDate(e.target.value)}
                      onClick={e => {
                        try {
                          e.target.showPicker();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      style={{ padding: '12px 14px', background: 'rgba(255,144,0,0.06)', border: `1.5px solid ${shippingDate ? 'rgba(255,144,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: shippingDate ? '#fff' : '#555', fontSize: '0.85rem', fontWeight: 700, outline: 'none', colorScheme: 'dark', cursor: 'pointer', width: '100%' }}
                    />
                  </div>

                  {/* Номер ТТН */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Номер ТТН</label>
                      <button
                        type="button"
                        onClick={handleOpenNpModal}
                        style={{ background: 'linear-gradient(135deg, rgba(255,144,0,0.15), rgba(234,88,12,0.25))', border: '1px solid rgba(255,144,0,0.4)', borderRadius: '8px', color: '#ff9000', fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                      >
                        ⚡ Згенерувати ТТН НП
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="20450000000000"
                      value={ttnNumber}
                      onChange={e => setTtnNumber(e.target.value)}
                      style={{ padding: '12px 14px', background: 'rgba(255,144,0,0.06)', border: `1.5px solid ${ttnNumber.trim() ? 'rgba(255,144,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                    />
                  </div>

                  {/* Відповідальний */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Відповідальний</label>
                    <CustomSelect
                      value={selectedWorkerId}
                      onChange={setSelectedWorkerId}
                      options={shippingWorkers.map(u => ({
                        value: String(u.id),
                        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login,
                        icon: '👤'
                      }))}
                      placeholder="— Обрати —"
                    />
                  </div>
                </div>
              </div>

              {/* ── СЕКЦІЯ 2: КОЛІР ПАРТІЇ ── */}
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Palette size={14} />
                  Колір маркування партії (палет)
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {PALLET_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setBatchColor(c.id)}
                      title={c.label}
                      style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        background: c.hex,
                        border: batchColor === c.id ? '3px solid #fff' : '3px solid transparent',
                        cursor: 'pointer',
                        boxShadow: batchColor === c.id ? `0 0 0 2px ${c.hex}88, 0 4px 12px ${c.hex}66` : 'none',
                        transform: batchColor === c.id ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      {batchColor === c.id && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={18} color={c.id === 'white' || c.id === 'yellow' ? '#333' : '#fff'} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {batchColor && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>
                    Обрано: <span style={{ color: PALLET_COLORS.find(c => c.id === batchColor)?.hex }}>{PALLET_COLORS.find(c => c.id === batchColor)?.label}</span>
                  </div>
                )}
              </div>

              {/* ── СЕКЦІЯ 3: ПЕРЕВІРКА КОРОБОК ── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Boxes size={14} />
                    Перевірка коробок
                  </div>
                  {totalBoxes > 0 && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: checkedCount === totalBoxes ? '#10b981' : '#888' }}>
                      {checkedCount} / {totalBoxes} перевірено
                    </div>
                  )}
                </div>

                {loadingBoxes ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#444', fontSize: '0.8rem' }}>
                    Завантаження коробок…
                  </div>
                ) : boxes.length === 0 ? (
                  <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid #1a1a1a', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
                    ⚠️ Коробки не знайдені в базі. Переконайтесь що пакування було збережено.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '6px' }}>
                    {boxes.map(box => {
                      const isChecked = checkedBoxes[box.box_number] === true
                      return (
                        <div
                          key={box.box_number}
                          onClick={() => setCheckedBoxes(prev => ({ ...prev, [box.box_number]: !prev[box.box_number] }))}
                          style={{
                            padding: '12px 14px',
                            background: isChecked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isChecked ? 'rgba(16,185,129,0.25)' : '#1a1a1a'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                          }}
                        >
                          <div style={{ marginTop: '2px', flexShrink: 0 }}>
                            {isChecked
                              ? <CheckSquare size={18} color="#10b981" />
                              : <Square size={18} color="#333" />
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ background: isChecked ? '#10b98120' : '#ff900015', color: isChecked ? '#10b981' : '#ff9000', fontSize: '0.7rem', fontWeight: 900, padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                                #{box.box_number}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>
                                {box.items.length} позицій
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {box.items.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: isChecked ? '#888' : '#555' }}>
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom_name}</span>
                                  <span style={{ fontWeight: 800, marginLeft: '10px', flexShrink: 0 }}>{item.qty} {item.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Відмітити все */}
                {boxes.length > 0 && (
                  <button
                    onClick={() => {
                      const allChecked = boxes.every(b => checkedBoxes[b.box_number])
                      const newState = {}
                      boxes.forEach(b => { newState[b.box_number] = !allChecked })
                      setCheckedBoxes(newState)
                    }}
                    style={{ marginTop: '10px', background: 'transparent', border: '1px solid #222', borderRadius: '10px', color: '#555', fontSize: '0.75rem', fontWeight: 700, padding: '8px 16px', cursor: 'pointer', transition: '0.2s' }}
                  >
                    {boxes.every(b => checkedBoxes[b.box_number]) ? '✕ Зняти всі' : '✓ Відмітити всі'}
                  </button>
                )}
              </div>

              {/* ── КНОПКА ЗАВЕРШИТИ ── */}
              <button
                onClick={handleFinishShipping}
                disabled={!canFinish || isProcessing}
                style={{
                  padding: '17px',
                  background: canFinish
                    ? 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: 'none',
                  borderRadius: '16px',
                  color: canFinish ? '#fff' : '#333',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  cursor: canFinish ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.3s',
                  boxShadow: canFinish ? '0 8px 24px rgba(255,144,0,0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
                onMouseEnter={e => { if (canFinish) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
              >
                {isProcessing ? (
                  <span>Обробка…</span>
                ) : (
                  <>
                    <Truck size={20} />
                    Завершити відвантаження та згенерувати пакувальний лист
                  </>
                )}
              </button>

              {!canFinish && (
                <div style={{ fontSize: '0.72rem', color: '#555', textAlign: 'center', marginTop: '-16px' }}>
                  {!shippingType && '• Оберіть тип відвантаження  '}
                  {!shippingDate && '• Вкажіть дату  '}
                  {!ttnNumber.trim() && '• Введіть номер ТТН  '}
                  {!selectedWorkerId && '• Оберіть відповідального  '}
                  {!batchColor && '• Оберіть колір партії  '}
                  {boxes.length > 0 && !boxes.every(b => checkedBoxes[b.box_number]) && `• Перевірте всі коробки (${checkedCount}/${totalBoxes})`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ПАКУВАЛЬНИЙ ЛИСТ (МОДАЛКА ПІСЛЯ ВІДВАНТАЖЕННЯ)
      ═══════════════════════════════════════════════════════════════════════ */}
      {packingSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 50px 120px rgba(0,0,0,0.9)' }}>

            {/* Toolbar */}
            <div style={{ padding: '16px 24px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={20} color="#ff9000" />
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>ПАКУВАЛЬНИЙ ЛИСТ</span>
                <span style={{ color: '#555', fontSize: '0.75rem' }}>#{packingSlip.orderNum} / Партія {packingSlip.batchIndex}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ff9000', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, fontSize: '0.8rem', padding: '10px 18px', cursor: 'pointer' }}>
                  <Printer size={16} /> ДРУКУВАТИ
                </button>
                <button onClick={() => setPackingSlip(null)} style={{ background: '#222', border: 'none', borderRadius: '10px', color: '#888', padding: '10px', cursor: 'pointer', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Print Content */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div ref={printRef} style={{ padding: '40px', color: '#111827', fontFamily: "'Inter', sans-serif" }}>

                {/* ─── Шапка ──────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '20px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', color: '#111827' }}>
                      Пакувальний лист {packingSlip.slipNumber ? `№ ${packingSlip.slipNumber}` : ''}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ff9000', marginTop: '4px' }}>
                      Замовлення №{packingSlip.orderNum} / Партія {packingSlip.batchIndex}
                    </div>
                  </div>
                  {/* Logo or Company details */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <img src="https://i.postimg.cc/d3NQkT4G/logo-3.jpg" alt="Ultra Contact" style={{ height: '36px', width: 'auto', marginBottom: '4px', display: 'block' }} />
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>ТОВ "УЛЬТРАКОНТАКТ"</div>
                  </div>
                </div>

                {/* ─── Деталі відвантаження (Таблиця замість сітки) ─── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151', width: '40%' }}>Замовник</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{packingSlip.customer}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Тип відвантаження</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{packingSlip.shippingType}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Дата відвантаження</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                          {packingSlip.shippingDate ? new Date(packingSlip.shippingDate).toLocaleDateString('uk-UA') : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151', width: '40%' }}>Номер ТТН</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 700, fontSize: '13px' }}>{packingSlip.ttn || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Відвантажив</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{packingSlip.workerName || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Дата формування</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 500, color: '#4b5563' }}>
                          {new Date(packingSlip.generatedAt).toLocaleString('uk-UA')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ─── Синє / Колір палети (Готовий виріб) ─────────── */}
                <div style={{
                  background: packingSlip.batchColorHex || '#3b82f6',
                  color: ['#f1f5f9', '#fdf0d5', '#eab308'].includes(packingSlip.batchColorHex?.toLowerCase()) ? '#111827' : '#ffffff',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, display: 'block', fontWeight: 700 }}>Маркування палет</span>
                      <span style={{ fontSize: '15px', fontWeight: 900 }}>
                        {(() => {
                          const rawColor = packingSlip.batchColor?.toLowerCase() || ''
                          const colorMapping = {
                            red: 'Червоний',
                            orange: 'Помаранчевий',
                            yellow: 'Жовтий',
                            green: 'Зелений',
                            blue: 'Синій',
                            purple: 'Фіолетовий',
                            pink: 'Рожевий',
                            white: 'Білий'
                          }
                          return (colorMapping[rawColor] || packingSlip.batchColor || '').toUpperCase()
                        })()}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, display: 'block', fontWeight: 700 }}>Готовий виріб</span>
                      <span style={{ fontSize: '15px', fontWeight: 900 }}>{packingSlip.productNames} — {packingSlip.plannedSets} компл.</span>
                    </div>
                  </div>
                </div>

                {/* ─── Вміст коробок (Розподіл) ───────────────────── */}
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#111827', marginBottom: '10px', letterSpacing: '0.5px' }}>
                  Розподіл по коробках
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '120px', textAlign: 'center' }}>№ коробки</th>
                      <th>Номенклатура</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Одн.Вим.</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>К-сть</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packingSlip.boxes.flatMap((box, boxIdx) =>
                      box.items.map((item, itemIdx) => {
                        const isEvenBox = boxIdx % 2 === 0
                        const isFirstItem = itemIdx === 0
                        return (
                          <tr key={`${boxIdx}-${itemIdx}`} style={{ background: isEvenBox ? '#ffffff' : '#f9fafb' }}>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#111827', fontSize: '12px', border: '1px solid #e5e7eb' }}>
                              {isFirstItem ? `Коробка ${box.box_number}` : ''}
                            </td>
                            <td style={{ color: '#374151', fontWeight: 500, border: '1px solid #e5e7eb' }}>
                              {formatPackingSlipName(item.nom_name, item.material_type, packingSlip.productNames)}
                            </td>
                            <td style={{ textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                              {item.unit}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#111827', fontSize: '12px', border: '1px solid #e5e7eb' }}>
                              {item.qty}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>

                {/* ─── Повний перелік пакування (checklist) ────────── */}
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#111827', marginBottom: '12px', letterSpacing: '0.5px', pageBreakBefore: 'always', breakBefore: 'page' }}>
                  Повний перелік пакування (За категоріями)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                  {Object.entries({
                    sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', color: '#f43f5e', border: '#fda4af', bg: 'rgba(244,63,94,0.03)' },
                    mounts: { title: '2. КРІПЛЕННЯ / 3Д ДРУК', color: '#eab308', border: '#fde047', bg: 'rgba(234,179,8,0.03)' },
                    hardware: { title: '3. МЕТИЗИ (Гвинти/Гайки)', color: '#06b6d4', border: '#67e8f9', bg: 'rgba(6,182,212,0.03)' },
                    spacers: { title: '4. СТІЙКИ', color: '#8b5cf6', border: '#c084fc', bg: 'rgba(139,92,246,0.03)' },
                    other: { title: '5. НАКЛАДКИ / ТРИМАЧІ / УПАКОВКА', color: '#3b82f6', border: '#93c5fd', bg: 'rgba(59,130,246,0.03)' }
                  }).map(([key, cat]) => {
                    const catItems = packingSlip.aggregatedList.filter(item => item.categoryKey === key)
                    if (catItems.length === 0) return null

                    return (
                      <div key={key} className="category-block" style={{ border: `1px solid ${cat.border}`, borderRadius: '10px', background: cat.bg, padding: '14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cat.color }} />
                          {cat.title}
                        </div>
                        <div className="category-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {catItems.map((item, idx) => (
                            <div key={idx} className="category-item-card" style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px' }}>{formatPackingSlipName(item.nom_name, item.material_type, packingSlip.productNames)}</span>
                                <span style={{ fontWeight: 800, color: '#111827', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.qty} {item.unit}</span>
                              </div>
                              <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600, marginTop: '6px' }}>
                                Коробки: {item.boxes.join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ─── Підписи ────────────────────────────────────── */}
                <div className="signatures-row" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #111827', width: '200px', paddingTop: '6px', fontSize: '10px', fontWeight: 700, color: '#4b5563' }}>Підготував</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #111827', width: '250px', paddingTop: '6px', fontSize: '10px', fontWeight: 700, color: '#111827' }}>
                      Відвантажувальник: {packingSlip.workerName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #111827', width: '200px', paddingTop: '6px', fontSize: '10px', fontWeight: 700, color: '#4b5563' }}>Отримав</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');

        .shipping-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .shipping-mobile-tabs {
          display: none;
          gap: 8px;
          padding: 12px 20px;
          background: #080808;
          border-bottom: 1px solid #1a1a1a;
        }

        .tab-btn {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: #555;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          transition: 0.2s;
        }

        .tab-btn.active {
          background: #ff9000;
          color: #000;
        }

        .batch-card {
          background: rgba(15,25,35,0.6);
          border: 1px solid #1a2535;
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .batch-card:hover {
          border-color: rgba(255,144,0,0.25);
          transform: translateY(-3px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(255,144,0,0.04);
        }

        .take-work-btn {
          background: linear-gradient(135deg, #ff9000 0%, #ff5e00 100%);
          color: #000;
          border: none;
          padding: 11px 18px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: 0.2s;
          box-shadow: 0 4px 14px rgba(255,144,0,0.3);
        }

        .take-work-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 6px 20px rgba(255,144,0,0.5);
        }

        .take-work-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        @media (max-width: 1024px) {
          .shipping-grid { grid-template-columns: 1fr; }
          .shipping-mobile-tabs { display: flex; }
          .hide-mobile { display: none !important; }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />

      {/* ── MODAL: NOVA POSHTA TTN GENERATOR ────────────────────────────────────────── */}
      {isNpModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="shipping-modal-card" style={{ background: '#0e0e11', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck size={22} color="#ff9000" />
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', color: '#fff' }}>
                    Генерація ТТН Нова Пошта
                  </h3>
                  <span style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 800 }}>API v2.0 Експрес-накладна</span>
                </div>
              </div>
              <button onClick={() => setIsNpModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {npError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '14px 16px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>❌ {npError}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="password"
                    value={npKeyInput}
                    onChange={e => setNpKeyInput(e.target.value)}
                    placeholder="Введіть API Ключ Нової Пошти..."
                    style={{ flex: 1, minWidth: '220px', background: 'var(--card-inner-bg, #141414)', border: '1px solid #ff9000', borderRadius: '10px', padding: '8px 12px', color: 'var(--text, #fff)', fontSize: '0.82rem', fontWeight: 700 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (npKeyInput.trim()) {
                        saveNpApiKey(npKeyInput.trim())
                        handleOpenNpModal()
                      }
                    }}
                    style={{ background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    💾 Зберегти та завантажити
                  </button>
                </div>
              </div>
            )}

            {npSuccessData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '20px 0', textAlign: 'center' }}>
                <CheckCircle2 size={54} color="#10b981" />
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>ТТН УСПІШНО ЗГЕНЕРОВАНО!</h4>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ff9000', fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {npSuccessData.ttnNumber}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <a 
                    href={npSuccessData.printStickerUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontWeight: 900, textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Printer size={16} /> ДРУК СТІКЕРА (100x100)
                  </a>
                  <a 
                    href={npSuccessData.printDocUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontWeight: 800, textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FileText size={16} /> ДРУК ЕН (А4/А5)
                  </a>
                </div>

                <button 
                  onClick={() => setIsNpModalOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#aaa', padding: '10px 24px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}
                >
                  ЗАКРИТИ ТА ЗБЕРЕГТИ У ВІДВАНТАЖЕННІ
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* 1. Відправник */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', marginBottom: '6px' }}>ВІДПРАВНИК (З ВАШОГО АКАУНТУ НП)</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                    {npSenderDetails?.senderName || 'Завантаження профілю відправника...'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                    Контакт: {npSenderDetails?.contactName} | Тел: {npSenderDetails?.contactPhone}
                  </div>
                </div>

                {/* 2. Отримувач */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>ПІБ Отримувача</label>
                    <input 
                      type="text"
                      value={npRecipientName}
                      onChange={e => setNpRecipientName(e.target.value)}
                      placeholder="напр. Ковальов Олександр Миколайович"
                      style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Телефон Отримувача</label>
                    <input 
                      type="text"
                      value={npRecipientPhone}
                      onChange={e => setNpRecipientPhone(e.target.value)}
                      placeholder="0971234567"
                      style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                </div>

                {/* 3. Місто та Відділення */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Місто Доставки</label>
                    <input 
                      type="text"
                      value={npCitySearch}
                      onChange={e => handleCitySearch(e.target.value)}
                      placeholder="Пошук міста..."
                      style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                    {npCityList.length > 0 && !npSelectedCity && (
                      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', marginTop: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                        {npCityList.map(c => (
                          <div 
                            key={c.ref} 
                            onClick={() => handleSelectCity(c)}
                            style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#eee', cursor: 'pointer', borderBottom: '1px solid #222' }}
                          >
                            {c.fullName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Відділення НП</label>
                    <select
                      value={npSelectedWarehouse?.ref || ''}
                      onChange={e => {
                        const wh = npWarehouseList.find(w => w.ref === e.target.value)
                        if (wh) setNpSelectedWarehouse(wh)
                      }}
                      style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}
                    >
                      {npWarehouseList.map(w => (
                        <option key={w.ref} value={w.ref}>
                          №{w.number} — {w.shortAddress}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Оголошена вартість */}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary, #aaa)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Оголошена вартість (грн)</label>
                  <input 
                    type="number"
                    value={npCost}
                    onChange={e => setNpCost(e.target.value)}
                    placeholder="1000"
                    style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>

                {/* 4.5 МІСЦЯ ВАНТАЖУ ТА ГАБАРИТИ (Згідно стандартів НП v2.0) */}
                <div style={{ background: 'var(--card-inner-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        МІСЦЯ ВАНТАЖУ ТА ГАБАРИТИ ({npSeatsList.length} місц.)
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>
                        Загальна вага вантажу: <strong style={{ color: '#ff9000' }}>{totalSeatsWeight} кг</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSeat}
                      style={{
                        background: 'linear-gradient(135deg, #ff9000, #ea580c)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 10px rgba(255,144,0,0.3)'
                      }}
                    >
                      <Plus size={14} /> ДОДАТИ МІСЦЕ (ЯЩИК)
                    </button>
                  </div>

                  {npSeatsList.map((seat, index) => (
                    <div
                      key={seat.id}
                      className="np-seat-card"
                      style={{
                        background: 'var(--card-bg, rgba(0,0,0,0.25))',
                        border: '1px solid var(--border, rgba(255,255,255,0.08))',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--text, #fff)' }}>
                          📦 Місце №{index + 1}
                        </span>
                        {npSeatsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSeat(seat.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            title="Видалити місце"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Preset buttons for this seat */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateSeat(seat.id, { preset: '30x25x30', length: '30', width: '25', height: '30' })}
                          className={`np-preset-btn ${seat.preset === '30x25x30' ? 'active-preset' : ''}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: seat.preset === '30x25x30' ? '2px solid #ff9000' : '1px solid var(--border, #333)',
                            background: seat.preset === '30x25x30' ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #181818)',
                            color: seat.preset === '30x25x30' ? '#ff9000' : 'var(--text, #eee)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          30 × 25 × 30 см (Компактний)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateSeat(seat.id, { preset: '45x30x40', length: '45', width: '30', height: '40' })}
                          className={`np-preset-btn ${seat.preset === '45x30x40' ? 'active-preset' : ''}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: seat.preset === '45x30x40' ? '2px solid #ff9000' : '1px solid var(--border, #333)',
                            background: seat.preset === '45x30x40' ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #181818)',
                            color: seat.preset === '45x30x40' ? '#ff9000' : 'var(--text, #eee)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          45 × 30 × 40 см (Стандартний)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateSeat(seat.id, { preset: 'custom' })}
                          className={`np-preset-btn ${seat.preset === 'custom' ? 'active-preset' : ''}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: seat.preset === 'custom' ? '2px solid #ff9000' : '1px solid var(--border, #333)',
                            background: seat.preset === 'custom' ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #181818)',
                            color: seat.preset === 'custom' ? '#ff9000' : 'var(--text, #eee)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Свої розміри
                        </button>
                      </div>

                      {/* Grid of L, W, H, Weight for this seat */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #888)', display: 'block', marginBottom: '2px' }}>Довжина (см)</label>
                          <input
                            type="number"
                            value={seat.length}
                            readOnly={seat.preset !== 'custom'}
                            onChange={e => handleUpdateSeat(seat.id, { length: e.target.value })}
                            style={{ width: '100%', background: seat.preset === 'custom' ? 'var(--card-inner-bg, #141414)' : 'var(--bg-muted, #222)', border: '1px solid var(--border, #333)', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #888)', display: 'block', marginBottom: '2px' }}>Ширина (см)</label>
                          <input
                            type="number"
                            value={seat.width}
                            readOnly={seat.preset !== 'custom'}
                            onChange={e => handleUpdateSeat(seat.id, { width: e.target.value })}
                            style={{ width: '100%', background: seat.preset === 'custom' ? 'var(--card-inner-bg, #141414)' : 'var(--bg-muted, #222)', border: '1px solid var(--border, #333)', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #888)', display: 'block', marginBottom: '2px' }}>Висота (см)</label>
                          <input
                            type="number"
                            value={seat.height}
                            readOnly={seat.preset !== 'custom'}
                            onChange={e => handleUpdateSeat(seat.id, { height: e.target.value })}
                            style={{ width: '100%', background: seat.preset === 'custom' ? 'var(--card-inner-bg, #141414)' : 'var(--bg-muted, #222)', border: '1px solid var(--border, #333)', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Вага місця (кг)</label>
                          <input
                            type="text"
                            value={seat.weight}
                            onChange={e => handleUpdateSeat(seat.id, { weight: e.target.value })}
                            placeholder="1.5"
                            style={{ width: '100%', background: 'var(--card-inner-bg, #141414)', border: '1px solid #ff9000', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 800 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 5. Опис вантажу та платник */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Опис вмісту</label>
                    <input 
                      type="text"
                      value={npDescription}
                      onChange={e => setNpDescription(e.target.value)}
                      style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Платник доставки</label>
                    <select
                      value={npPayerType}
                      onChange={e => setNpPayerType(e.target.value)}
                      style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      <option value="Recipient">Отримувач</option>
                      <option value="Sender">Відправник</option>
                    </select>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={handleGenerateNpTTNSubmit}
                  disabled={npLoading}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    background: npLoading ? '#555' : 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    cursor: npLoading ? 'wait' : 'pointer',
                    boxShadow: '0 4px 20px rgba(234, 88, 12, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <Truck size={20} />
                  {npLoading ? 'З\'єднання з Nova Poshta API...' : 'ЗГЕНЕРУВАТИ ТТН У НОВІЙ ПОШТІ'}
                </button>

              </div>
            )}

          </div>
        </div>
      )}
      </div>
  )
}

export default ShippingModule
