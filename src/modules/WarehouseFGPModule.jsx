import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Archive,
  ArrowLeft,
  Package,
  Layers,
  AlertTriangle,
  CheckCircle2,
  History,
  Search,
  Plus,
  Trash2,
  Pencil,
  Truck,
  ExternalLink,
  ShieldCheck,
  Eye,
  Wrench,
  Check,
  Box,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  RefreshCw,
  ClipboardList
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { IconSO, IconSGP } from '../components/WarehouseIcons'
import { ReserveAnalysisModal } from './Warehouse/components/ReserveAnalysisModal.jsx'

export default function WarehouseFGPModule() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    inventory,
    requests,
    nomenclatures,
    orders,
    tasks,
    workCards,
    workCardHistory,
    currentUser,
    refreshTable,
    fetchData,
    theme
  } = useMES()

  const [isDark, setIsDark] = useState(() => {
    if (theme) return theme === 'dark'
    if (typeof document !== 'undefined') return !document.body.classList.contains('light-theme')
    return false
  })

  useEffect(() => {
    if (theme) {
      setIsDark(theme === 'dark')
    } else if (typeof document !== 'undefined') {
      setIsDark(!document.body.classList.contains('light-theme'))
    }
  }, [theme])

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const check = () => {
      if (theme) {
        setIsDark(theme === 'dark')
      } else {
        setIsDark(!document.body.classList.contains('light-theme'))
      }
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [theme])

  const t = useMemo(() => {
    if (isDark) {
      return {
        bg: '#090a0f',
        navBg: '#12141c',
        navBorder: '#1f2430',
        cardBg: '#12141c',
        cardHeaderBg: '#161924',
        cardBorder: '#232938',
        subtleBg: '#181b26',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
        inputBg: '#161924',
        inputBorder: '#2a3245',
        inputText: '#f8fafc',
        tableHeadBg: '#161924',
        tableBorder: '#1f2430',
        tableRowHover: '#181b26',
        tableRowBorder: '#1a1e2a',
        buttonSecondaryBg: '#1a1e2b',
        buttonSecondaryBorder: '#2d3748',
        buttonSecondaryText: '#cbd5e1',
        kpiBoxBg: '#12141c',
        kpiBoxBorder: '#1f2430',
        kpiBlueIconBg: '#082f49',
        kpiBlueIconBorder: '#0369a1',
        kpiAmberIconBg: '#451a03',
        kpiAmberIconBorder: '#b45309',
        kpiGreenIconBg: '#022c22',
        kpiGreenIconBorder: '#047857',
        queueTabsBg: '#12141c',
        queueTabsBorder: '#1f2430',
        orderBadgeBg: '#1e3a8a',
        orderBadgeBorder: '#3b82f6',
        orderBadgeText: '#bfdbfe',
        customerBadgeBg: '#1a1e2b',
        customerBadgeBorder: '#2d3748',
        customerBadgeText: '#e2e8f0',
        readyBadgeBg: '#022c22',
        readyBadgeBorder: '#059669',
        readyBadgeText: '#34d399',
        shortageBadgeBg: '#451a03',
        shortageBadgeBorder: '#b45309',
        shortageBadgeText: '#fbbf24',
        issuedRowBadgeBg: '#022c22',
        issuedRowBadgeBorder: '#047857',
        issuedRowBadgeText: '#34d399',
        issueBtnBg: '#064e3b',
        issueBtnBorder: '#10b981',
        issueBtnText: '#6ee7b7',
        viewInventoryBtnBg: '#161924',
        viewInventoryBtnBorder: '#10b981',
        viewInventoryBtnText: '#34d399',
        footerBg: '#161924',
        footerBorder: '#1f2430',
        activeFilterBg: '#0284c7',
        activeFilterText: '#ffffff'
      }
    }
    return {
      bg: '#f8fafc',
      navBg: '#ffffff',
      navBorder: '#e2e8f0',
      cardBg: '#ffffff',
      cardHeaderBg: '#f8fafc',
      cardBorder: '#cbd5e1',
      subtleBg: '#f1f5f9',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
      inputBg: '#ffffff',
      inputBorder: '#cbd5e1',
      inputText: '#0f172a',
      tableHeadBg: '#f1f5f9',
      tableBorder: '#e2e8f0',
      tableRowHover: '#f8fafc',
      tableRowBorder: '#f1f5f9',
      buttonSecondaryBg: '#ffffff',
      buttonSecondaryBorder: '#cbd5e1',
      buttonSecondaryText: '#475569',
      kpiBoxBg: '#ffffff',
      kpiBoxBorder: '#e2e8f0',
      kpiBlueIconBg: '#f0f9ff',
      kpiBlueIconBorder: '#bae6fd',
      kpiAmberIconBg: '#fffbeb',
      kpiAmberIconBorder: '#fde68a',
      kpiGreenIconBg: '#ecfdf5',
      kpiGreenIconBorder: '#a7f3d0',
      queueTabsBg: '#ffffff',
      queueTabsBorder: '#e2e8f0',
      orderBadgeBg: '#eff6ff',
      orderBadgeBorder: '#bfdbfe',
      orderBadgeText: '#1d4ed8',
      customerBadgeBg: '#ffffff',
      customerBadgeBorder: '#cbd5e1',
      customerBadgeText: '#1e293b',
      readyBadgeBg: '#ecfdf5',
      readyBadgeBorder: '#a7f3d0',
      readyBadgeText: '#047857',
      shortageBadgeBg: '#fffbeb',
      shortageBadgeBorder: '#fde68a',
      shortageBadgeText: '#b45309',
      issuedRowBadgeBg: '#ecfdf5',
      issuedRowBadgeBorder: '#a7f3d0',
      issuedRowBadgeText: '#059669',
      issueBtnBg: '#ecfdf5',
      issueBtnBorder: '#10b981',
      issueBtnText: '#047857',
      viewInventoryBtnBg: '#ffffff',
      viewInventoryBtnBorder: '#10b981',
      viewInventoryBtnText: '#065f46',
      footerBg: '#f8fafc',
      footerBorder: '#e2e8f0',
      activeFilterBg: '#0284c7',
      activeFilterText: '#ffffff'
    }
  }, [isDark])

  // Live direct query state for bulletproof queue synchronization
  const [liveRequests, setLiveRequests] = useState(null)
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false)
  const [requestQueueTab, setRequestQueueTab] = useState('active') // 'active' | 'all' | 'history'

  const fetchQueueFromDb = useCallback(async () => {
    setIsRefreshingQueue(true)
    try {
      if (typeof fetchData === 'function') {
        fetchData(['material_requests', 'inventory', 'orders', 'tasks', 'nomenclatures', 'work_cards'])
      }
      const { data, error } = await supabase
        .from('material_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)
      if (!error && Array.isArray(data)) {
        setLiveRequests(data)
      }
    } catch (err) {
      console.warn('[WarehouseFGP] fetchQueueFromDb error:', err)
    } finally {
      setIsRefreshingQueue(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchQueueFromDb()
    const interval = setInterval(fetchQueueFromDb, 15000)
    return () => clearInterval(interval)
  }, [fetchQueueFromDb])

  useEffect(() => {
    const channel = supabase.channel('sgp-mat-req-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests' }, () => {
        fetchQueueFromDb()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, () => {
        if (typeof fetchData === 'function') fetchData(['work_cards'])
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchQueueFromDb, fetchData])

  const [viewMode, setViewMode] = useState(() => searchParams.get('mode') || 'requests') // 'requests' | 'inventory'
  const [requestSearchQuery, setRequestSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'bz') return 'finished'
    if (tabParam === 'semi') return 'shop2_buffer'
    return tabParam || 'finished'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', total_qty: '', unit: 'шт', type: 'finished' })

  // Shop 2 Buffer view mode & toggle state (default to 'table' as requested)
  const [bufferViewMode, setBufferViewMode] = useState(() => {
    return localStorage.getItem('sgp_buffer_view_mode') || 'table'
  })
  const [collapsedBufferGroups, setCollapsedBufferGroups] = useState(() => new Set())

  // Packaging request issuing state
  const [isIssuingReq, setIsIssuingReq] = useState(false)
  const [collapsedOrders, setCollapsedOrders] = useState(() => new Set())
  const [orderStatusFilter, setOrderStatusFilter] = useState('all') // 'all' | 'ready' | 'shortage'
  const [reserveAnalysisItem, setReserveAnalysisItem] = useState(null)

  const toggleOrderCollapse = (orderKey) => {
    setCollapsedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderKey)) next.delete(orderKey)
      else next.add(orderKey)
      return next
    })
  }

  const collapseAll = () => {
    setCollapsedOrders(new Set(groupedPackagingRequests.map(g => g.key)))
  }

  const expandAll = () => {
    setCollapsedOrders(new Set())
  }

  // Admin edit item state
  const [editingInvKey, setEditingInvKey] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [isSavingInv, setIsSavingInv] = useState(false)

  const isAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.role === 'admin' || currentUser?.role === 'director' || (currentUser?.position || '').toLowerCase().includes('адмін')

  const tabs = [
    { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} /> },
    { id: 'hardware', label: 'Метизи & Комплектуючі', icon: <Wrench size={18} /> },
    { id: 'shop2_buffer', label: 'Склад буфер Цеху 2', icon: <Layers size={18} /> },
    { id: 'scrap', label: 'Брак & Карантин', icon: <AlertTriangle size={18} /> },
    { id: 'registry', label: 'Реєстр випуску', icon: <History size={18} /> }
  ]

  // ── РОЗРАХУНОК ДАНИХ БУФЕРА ЦЕХУ №2 НА ОСНОВІ РОБОЧИХ КАРТОК ──
  const shop2TaskIdsSet = useMemo(() => {
    const set = new Set()
    ;(tasks || []).forEach(t => {
      const step = String(t.step || '').toLowerCase()
      const name = String(t.name || '').toLowerCase()
      if (
        step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
        name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')
      ) {
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

  // Картки, які очікують у буфері Цеху №2
  const shop2BufferCards = useMemo(() => {
    return (workCards || []).filter(c => {
      if (isShop2Card(c)) return false
      const status = String(c.status || '')
      return status === 'at-shop2-buffer'
    })
  }, [workCards, isShop2Card])

  // Загальна кількість вільних деталей у буфері Цеху 2
  const totalShop2BufferParts = useMemo(() => {
    let sum = 0
    shop2BufferCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const used = Number(card.used_in_shop2_qty || 0)
      sum += Math.max(0, qty - used)
    })
    return sum
  }, [shop2BufferCards])

  // Групування буфера за нарядами (як на моніторі Цеху 2)
  const shop2BufferTaskGroups = useMemo(() => {
    const groups = {}
    shop2BufferCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const used = Number(card.used_in_shop2_qty || 0)
      const avail = Math.max(0, qty - used)
      if (avail <= 0) return

      const taskId = card.task_id || 'unassigned'
      if (!groups[taskId]) {
        const taskObj = (tasks || []).find(t => String(t.id) === String(taskId))
        const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
        const rawNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Вільний запас'
        const orderNumStr = String(rawNum)
        const displayNum = orderNumStr.startsWith('№') || orderNumStr.includes('Вільний') || orderNumStr.includes('Загальний')
          ? orderNumStr
          : `Наряд №${orderNumStr}`

        groups[taskId] = {
          taskId,
          orderNum: displayNum,
          orderId: card.order_id || taskObj?.order_id,
          items: {},
          totalQty: 0,
          totalCards: 0
        }
      }

      const nomId = card.nomenclature_id || card.card_info || 'unknown'
      if (!groups[taskId].items[nomId]) {
        const nom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
        groups[taskId].items[nomId] = {
          nomId,
          name: nom?.name || card.nomenclature_name || card.card_info || 'Деталь',
          unit: nom?.unit || 'шт',
          material: nom?.material_type || nom?.material || card.material || '—',
          thickness: nom?.thickness || card.thickness || '',
          total_qty: 0,
          cardCount: 0
        }
      }
      groups[taskId].items[nomId].total_qty += avail
      groups[taskId].items[nomId].cardCount += 1
      groups[taskId].totalQty += avail
      groups[taskId].totalCards += 1
    })

    return Object.values(groups).filter(g => g.totalQty > 0)
  }, [shop2BufferCards, tasks, orders, nomenclatures])

  const toggleBufferGroup = (key) => {
    setCollapsedBufferGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const collapseAllBufferGroups = () => {
    setCollapsedBufferGroups(new Set(shop2BufferTaskGroups.map(g => g.taskId)))
  }

  const expandAllBufferGroups = () => {
    setCollapsedBufferGroups(new Set())
  }

  // Фільтрація груп за пошуковим запитом
  const filteredShop2BufferTaskGroups = useMemo(() => {
    if (!searchQuery.trim()) return shop2BufferTaskGroups
    const q = searchQuery.toLowerCase().trim()
    return shop2BufferTaskGroups.map(group => {
      const matchOrder = (group.orderNum || '').toLowerCase().includes(q)
      if (matchOrder) return group
      const filteredItems = {}
      Object.entries(group.items).forEach(([k, item]) => {
        if (
          (item.name || '').toLowerCase().includes(q) ||
          (item.material || '').toLowerCase().includes(q)
        ) {
          filteredItems[k] = item
        }
      })
      if (Object.keys(filteredItems).length === 0) return null
      const totalFilteredQty = Object.values(filteredItems).reduce((sum, it) => sum + it.total_qty, 0)
      const totalFilteredCards = Object.values(filteredItems).reduce((sum, it) => sum + it.cardCount, 0)
      return {
        ...group,
        items: filteredItems,
        totalQty: totalFilteredQty,
        totalCards: totalFilteredCards
      }
    }).filter(Boolean)
  }, [shop2BufferTaskGroups, searchQuery])

  // Зведений список деталей буфера для табличного перегляду
  const shop2BufferConsolidatedItems = useMemo(() => {
    const map = new Map()
    shop2BufferCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const used = Number(card.used_in_shop2_qty || 0)
      const avail = Math.max(0, qty - used)
      if (avail <= 0) return

      const nom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
      const name = nom?.name || card.nomenclature_name || card.card_info || 'Деталь'
      const key = (nom?.id ? `nom-${nom.id}` : name).toLowerCase()

      const taskObj = (tasks || []).find(t => String(t.id) === String(card.task_id))
      const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
      const rawNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Вільний'
      const naryadBadge = String(rawNum).startsWith('№') ? rawNum : `№${rawNum}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          nomId: nom?.id || card.nomenclature_id,
          name,
          unit: nom?.unit || 'шт',
          material: nom?.material_type || nom?.material || card.material || '—',
          thickness: nom?.thickness || card.thickness || '',
          total_qty: 0,
          cardCount: 0,
          naryads: new Set()
        })
      }

      const item = map.get(key)
      item.total_qty += avail
      item.cardCount += 1
      item.naryads.add(naryadBadge)
    })

    const list = Array.from(map.values()).map(item => ({
      ...item,
      naryadList: Array.from(item.naryads)
    })).sort((a, b) => b.total_qty - a.total_qty)

    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(item =>
      (item.name || '').toLowerCase().includes(q) ||
      (item.material || '').toLowerCase().includes(q) ||
      item.naryadList.some(nr => nr.toLowerCase().includes(q))
    )
  }, [shop2BufferCards, nomenclatures, tasks, orders, searchQuery])

  // Key normalization for homoglyphs (Cyrillic vs Latin) and whitespaces
  const normalizeKey = (str) => {
    return (str || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_\-]+/g, '-')
      .replace(/[аa]/g, 'a')
      .replace(/[вb]/g, 'b')
      .replace(/[еe]/g, 'e')
      .replace(/[кk]/g, 'k')
      .replace(/[мm]/g, 'm')
      .replace(/[нh]/g, 'h')
      .replace(/[оo]/g, 'o')
      .replace(/[рp]/g, 'p')
      .replace(/[сc]/g, 'c')
      .replace(/[тt]/g, 't')
      .replace(/[хx]/g, 'x')
  }

  // Helper to identify hardware and packaging components
  const isHardware = (item) => {
    const type = (item.type || '').toLowerCase()
    const nameLower = (item.name || '').toLowerCase()
    return (
      type === 'hardware' || type === 'fastener' || type === 'mount' ||
      nameLower.includes('гвинт') || nameLower.includes('гайка') || nameLower.includes('болт') ||
      nameLower.includes('шайба') || nameLower.includes('стійка') || nameLower.includes('накладка') ||
      nameLower.includes('тримач') || nameLower.includes('метиз') || nameLower.includes('кріплення') ||
      nameLower.includes('саморіз') || nameLower.includes('втулка') || nameLower.includes('фіксатор')
    )
  }

  // Filter inventory by SGP types without cross-contamination
  const rawTabItems = useMemo(() => {
    if (activeTab === 'shop2_buffer') return []
    return (inventory || []).filter(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()

      if (activeTab === 'hardware') {
        return isHardware(item)
      }
      if (activeTab === 'finished') {
        return !isHardware(item) && (
          type === 'finished' || type === 'part' || type === 'product' ||
          type === 'bz' || type === 'bz_shop2' || type === 'wip_bz' ||
          type === 'semi' || type === 'semi_shop2' ||
          nameLower.includes('бз') || nameLower.includes('буфер')
        )
      }
      if (activeTab === 'scrap') {
        return !isHardware(item) && (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_') || (type !== 'finished' && (nameLower.includes('брак') || nameLower.includes('карантин'))))
      }
      return false
    })
  }, [inventory, activeTab])

  // Group items by unique product identity and aggregate quantities
  const groupedItems = useMemo(() => {
    const map = new Map()

    rawTabItems.forEach(item => {
      const cleanName = (item.name || '').trim()
      const key = item.nomenclature_id ? String(item.nomenclature_id) : normalizeKey(cleanName)

      if (!map.has(key)) {
        map.set(key, {
          key,
          nomenclature_id: item.nomenclature_id,
          name: cleanName,
          unit: item.unit || 'шт',
          total_qty: 0,
          reserved_qty: 0,
          rawItems: []
        })
      }

      const grp = map.get(key)
      const tQty = Number(item.total_qty) || 0
      const rQty = Number(item.reserved_qty) || 0
      grp.total_qty += tQty
      grp.reserved_qty += rQty
      grp.rawItems.push(item)
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  }, [rawTabItems])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return groupedItems
    const q = searchQuery.toLowerCase().trim()
    return groupedItems.filter(item => (item.name || '').toLowerCase().includes(q))
  }, [groupedItems, searchQuery])

  // Compute accurate tab counts
  const tabCounts = useMemo(() => {
    const counts = { finished: 0, hardware: 0, shop2_buffer: 0, scrap: 0, registry: 0 }
    ;(inventory || []).forEach(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()
      const q = Number(item.total_qty) || 0
      if (isHardware(item)) {
        counts.hardware += q
      } else if (
        type === 'finished' || type === 'part' || type === 'product' ||
        type === 'bz' || type === 'bz_shop2' || type === 'wip_bz' ||
        type === 'semi' || type === 'semi_shop2' ||
        nameLower.includes('бз') || nameLower.includes('буфер')
      ) {
        counts.finished += q
      } else if (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_')) {
        counts.scrap += q
      }
    })
    counts.shop2_buffer = totalShop2BufferParts
    counts.registry = (workCardHistory || []).filter(h => h.status === 'completed').length
    return counts
  }, [inventory, workCardHistory, totalShop2BufferParts])

  // ── ЧЕРГА ЗАПИТІВ НА КОМПЛЕКТУВАННЯ З ВІДДІЛУ ПАКУВАННЯ ──
  // Merge live requests with context requests
  const effectiveRequests = useMemo(() => {
    if (liveRequests && Array.isArray(liveRequests) && liveRequests.length > 0) {
      const map = new Map()
      liveRequests.forEach(r => { if (r && r.id) map.set(String(r.id), r) })
      ;(requests || []).forEach(r => { if (r && r.id && !map.has(String(r.id))) map.set(String(r.id), r) })
      return Array.from(map.values())
    }
    return requests || []
  }, [liveRequests, requests])

  const isPackagingRequest = (r) => {
    if (!r || !r.details) return false
    const d = r.details.toUpperCase()
    return (
      d.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') ||
      d.includes('КОМПЛЕКТУВАННЯ') ||
      d.includes('ПАКУВАННЯ') ||
      d.includes('PACKAGING_SOURCE')
    )
  }

  const allPackagingRequests = useMemo(() => {
    return effectiveRequests.filter(isPackagingRequest)
  }, [effectiveRequests])

  const activePackagingRequests = useMemo(() => {
    return allPackagingRequests.filter(r => r.status !== 'completed' && r.status !== 'issued' && r.status !== 'cancelled')
  }, [allPackagingRequests])

  const completedPackagingRequests = useMemo(() => {
    return allPackagingRequests.filter(r => r.status === 'completed' || r.status === 'issued')
  }, [allPackagingRequests])

  const pendingPackagingRequests = useMemo(() => {
    if (requestQueueTab === 'history') return completedPackagingRequests
    if (requestQueueTab === 'all') return allPackagingRequests
    return activePackagingRequests
  }, [requestQueueTab, completedPackagingRequests, allPackagingRequests, activePackagingRequests])

  const groupedPackagingRequests = useMemo(() => {
    const groups = {}
    pendingPackagingRequests.forEach(req => {
      const order = (orders || []).find(o => String(o.id) === String(req.order_id))
      const task = (tasks || []).find(t => String(t.id) === String(req.task_id))
      const key = req.task_id ? `task-${req.task_id}` : `order-${req.order_id}`
      if (!groups[key]) {
        groups[key] = {
          key,
          orderId: req.order_id,
          taskId: req.task_id,
          orderNum: order?.order_num || (req.details?.match(/ЗАПИТ НА КОМПЛЕКТУВАННЯ\s*\(([^)]+)\)/i)?.[1] || '???'),
          batchIndex: task?.batch_index || '',
          customer: order?.customer || '',
          items: []
        }
      }
      groups[key].items.push(req)
    })
    return Object.values(groups)
  }, [pendingPackagingRequests, orders, tasks])

  const getItemDisplayName = (req) => {
    if (req.nomenclature_id) {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(req.nomenclature_id))
      if (nom?.name) return nom.name
    }
    const details = req.details || ''
    const matchWithSource = details.match(/\[PACKAGING_SOURCE:[^\]]+\]\s*(?:\[[^\]]+\]\s*)*:\s*([^—\n\r]+)/i)
    if (matchWithSource?.[1]) {
      return matchWithSource[1].trim()
    }
    const colonParts = details.split(':')
    if (colonParts.length > 1) {
      const lastPart = colonParts[colonParts.length - 1]
      return lastPart.split('—')[0].trim()
    }
    return details.split('—')[0].trim() || 'Комплектуюче'
  }

  const getItemCategoryBadge = (req, displayName) => {
    const nom = (nomenclatures || []).find(n => String(n.id) === String(req.nomenclature_id))
    const nameLower = (nom?.name || displayName || '').toLowerCase()
    const type = (nom?.type || '').toLowerCase()
    if (nameLower.includes('гвинт') || nameLower.includes('гайка') || nameLower.includes('болт') || nameLower.includes('шайба') || type.includes('hardware')) {
      return isDark
        ? { label: 'МЕТИЗ', color: '#7dd3fc', bg: '#0c4a6e', border: '#0284c7' }
        : { label: 'МЕТИЗ', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' }
    }
    if (nameLower.includes('стійка') || type.includes('стійк')) {
      return isDark
        ? { label: 'СТІЙКА', color: '#c4b5fd', bg: '#4c1d95', border: '#7c3aed' }
        : { label: 'СТІЙКА', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' }
    }
    if (nameLower.includes('кріплення') || nameLower.includes('друк') || nameLower.includes('3д')) {
      return isDark
        ? { label: 'КРІПЛЕННЯ', color: '#fde047', bg: '#713f12', border: '#ca8a04' }
        : { label: 'КРІПЛЕННЯ', color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
    }
    if (nameLower.includes('накладка') || nameLower.includes('тримач') || nameLower.includes('упаковка') || nameLower.includes('пакет') || nameLower.includes('гума')) {
      return isDark
        ? { label: 'АКСЕСУАР', color: '#5eead4', bg: '#134e4a', border: '#0d9488' }
        : { label: 'АКСЕСУАР', color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' }
    }
    return isDark
      ? { label: 'ДЕТАЛЬ СГП', color: '#a5b4fc', bg: '#312e81', border: '#4f46e5' }
      : { label: 'ДЕТАЛЬ СГП', color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe' }
  }

  const getSgpStock = (req, displayName) => {
    if (req.nomenclature_id) {
      const byNom = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(req.nomenclature_id))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
      if (byNom > 0) return byNom
    }
    const cleanDisplayName = normalizeKey(displayName)
    return (inventory || [])
      .filter(i => normalizeKey(i.name) === cleanDisplayName)
      .reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
  }

  const handleIssueRequest = async (req) => {
    if (!req || isIssuingReq) return
    setIsIssuingReq(true)
    try {
      const issuerName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.login || 'Комірник СГП'
      
      let rpcSuccess = false
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('issue_packaging_request_from_sgp', {
          p_request_id: req.id,
          p_issuer_name: issuerName
        })
        if (!rpcErr && rpcRes?.success) {
          rpcSuccess = true
        }
      } catch (e) {}

      if (!rpcSuccess) {
        const neededQty = Number(req.quantity) || 0
        const displayName = getItemDisplayName(req)
        const matchingSgpItem = (inventory || []).find(i => {
          if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) {
            return i.warehouse === 'sgp' || i.type === 'finished' || i.type === 'bz' || i.type === 'part' || i.type === 'hardware' || isHardware(i)
          }
          return false
        }) || (inventory || []).find(i => normalizeKey(i.name) === normalizeKey(displayName))

        if (matchingSgpItem) {
          const currentQty = Number(matchingSgpItem.total_qty) || 0
          const newQty = Math.max(0, currentQty - neededQty)
          await supabase.from('inventory').update({
            total_qty: newQty,
            updated_at: new Date().toISOString()
          }).eq('id', matchingSgpItem.id)
        }

        const dateStr = new Date().toLocaleDateString('uk-UA') + ' ' + new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
        await supabase.from('material_requests').update({
          status: 'completed',
          inventory_id: matchingSgpItem?.id || req.inventory_id || null,
          details: `${req.details || ''} [ВИДАНО СГП: ${issuerName} ${dateStr}]`
        }).eq('id', req.id)
      }

      if (typeof refreshTable === 'function') {
        refreshTable('material_requests')
        refreshTable('inventory')
      }
      if (typeof fetchData === 'function') {
        fetchData(['material_requests', 'inventory', 'orders'])
      }
      fetchQueueFromDb()
    } catch (err) {
      alert(`Помилка видачі: ${err.message || err}`)
    } finally {
      setIsIssuingReq(false)
    }
  }

  const handleIssueAllForOrder = async (orderGroup) => {
    if (!orderGroup || !orderGroup.items?.length || isIssuingReq) return
    setIsIssuingReq(true)
    try {
      for (const req of orderGroup.items) {
        await handleIssueRequest(req)
      }
      alert(`✅ Всі комплектуючі для наряду №${orderGroup.orderNum} успішно видано з СГП!`)
    } catch (err) {
      alert(`Помилка при видачі: ${err.message || err}`)
    } finally {
      setIsIssuingReq(false)
    }
  }

  const handleSaveInventoryQty = async (item) => {
    if (!item || isSavingInv) return
    setIsSavingInv(true)
    try {
      const primaryRaw = item.rawItems?.[0]
      if (!primaryRaw?.id) throw new Error('Запис інвентарю не знайдено')

      const newTotal = Number(editingInvTotal) || 0
      const newReserved = Number(editingInvReserved) || 0

      // Update primary inventory record
      const { error } = await supabase.from('inventory').update({
        total_qty: newTotal,
        reserved_qty: newReserved
      }).eq('id', primaryRaw.id)

      if (error) throw error

      // If duplicate records exist in the database (e.g. bz_shop2 vs bz), zero them out
      if (item.rawItems && item.rawItems.length > 1) {
        const otherIds = item.rawItems.slice(1).map(r => r.id).filter(Boolean)
        if (otherIds.length > 0) {
          await supabase.from('inventory').update({ total_qty: 0, reserved_qty: 0 }).in('id', otherIds)
        }
      }

      if (typeof refreshTable === 'function') refreshTable('inventory')
      if (typeof fetchData === 'function') fetchData(['inventory'])
      setEditingInvKey(null)
    } catch (err) {
      alert(`Помилка оновлення: ${err.message}`)
    } finally {
      setIsSavingInv(false)
    }
  }

  const handleAddInventoryItem = async (e) => {
    e.preventDefault()
    if (!newItem.name.trim() || !newItem.total_qty) return
    try {
      const { error } = await supabase.from('inventory').insert([{
        name: newItem.name.trim(),
        total_qty: Number(newItem.total_qty) || 0,
        reserved_qty: 0,
        unit: newItem.unit || 'шт',
        type: activeTab === 'hardware' ? 'hardware' : activeTab === 'semi' ? 'semi' : activeTab === 'scrap' ? 'scrap' : activeTab === 'bz' ? 'bz' : 'finished',
        warehouse: 'sgp'
      }])
      if (error) throw error
      if (typeof refreshTable === 'function') refreshTable('inventory')
      setNewItem({ name: '', total_qty: '', unit: 'шт', type: 'finished' })
      setShowAdd(false)
    } catch (err) {
      alert(`Помилка створення: ${err.message}`)
    }
  }

  const orderStats = useMemo(() => {
    let ready = 0
    let shortage = 0
    groupedPackagingRequests.forEach(group => {
      const isAllReady = group.items.every(req => {
        const dName = getItemDisplayName(req)
        const stock = getSgpStock(req, dName)
        return stock >= (Number(req.quantity) || 0)
      })
      if (isAllReady) ready++
      else shortage++
    })
    return { total: groupedPackagingRequests.length, ready, shortage }
  }, [groupedPackagingRequests, inventory, nomenclatures])

  const filteredOrderGroups = useMemo(() => {
    return groupedPackagingRequests.filter(group => {
      if (requestSearchQuery.trim()) {
        const q = requestSearchQuery.toLowerCase()
        const matches = String(group.orderNum).toLowerCase().includes(q) || (group.customer || '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (orderStatusFilter === 'ready') {
        return group.items.every(req => {
          const dName = getItemDisplayName(req)
          return getSgpStock(req, dName) >= (Number(req.quantity) || 0)
        })
      }
      if (orderStatusFilter === 'shortage') {
        return group.items.some(req => {
          const dName = getItemDisplayName(req)
          return getSgpStock(req, dName) < (Number(req.quantity) || 0)
        })
      }
      return true
    })
  }, [groupedPackagingRequests, requestSearchQuery, orderStatusFilter, inventory, nomenclatures])

  return (
    <div className="warehouse-fgp-module" style={{ background: t.bg, minHeight: '100vh', color: t.textPrimary, display: 'flex', flexDirection: 'column' }}>
      
      {/* ── ХЕДЕР МОДУЛЯ ── */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '12px 25px', 
        background: t.navBg, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderBottom: `1px solid ${t.navBorder}`,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconSGP size={26} color={isDark ? '#34d399' : '#059669'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 950, letterSpacing: '-0.02em', color: t.textPrimary }}>
                  СКЛАД ГОТОВОЇ ПРОДУКЦІЇ ТА КОМПЛЕКТУЮЧИХ (СГП)
                </h1>
                <span style={{
                  background: isDark ? 'rgba(5, 150, 105, 0.25)' : '#ecfdf5',
                  color: isDark ? '#34d399' : '#059669',
                  border: isDark ? '1px solid rgba(5, 150, 105, 0.5)' : '1px solid #a7f3d0',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.62rem',
                  fontWeight: 900
                }}>
                  WMS
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 700, marginTop: '2px' }}>
                {viewMode === 'requests' ? 'Робоче місце комірника: видача замовлень на пакування' : 'Відомість та інвентаризація залишків'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* TOGGLE TO INVENTORY / REQUESTS */}
          {viewMode === 'requests' ? (
            <button
              type="button"
              onClick={() => {
                setViewMode('inventory')
                setSearchParams(prev => {
                  const np = new URLSearchParams(prev)
                  np.set('mode', 'inventory')
                  return np
                })
              }}
              style={{
                height: '42px',
                padding: '0 20px',
                borderRadius: '12px',
                border: `1.5px solid ${t.viewInventoryBtnBorder}`,
                background: t.viewInventoryBtnBg,
                color: t.viewInventoryBtnText,
                fontSize: '0.84rem',
                fontWeight: 900,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(16, 185, 129, 0.15)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDark ? '#1e2433' : '#ecfdf5'
                e.currentTarget.style.borderColor = '#059669'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = t.viewInventoryBtnBg
                e.currentTarget.style.borderColor = t.viewInventoryBtnBorder
              }}
            >
              <Archive size={17} color={isDark ? '#34d399' : '#059669'} />
              <span style={{ color: t.viewInventoryBtnText, fontWeight: 900 }}>ПЕРЕГЛЯНУТИ ЗАЛИШКИ СГП</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setViewMode('requests')
                setSearchParams(prev => {
                  const np = new URLSearchParams(prev)
                  np.delete('mode')
                  return np
                })
              }}
              style={{
                height: '42px',
                padding: '0 20px',
                borderRadius: '12px',
                border: '1.5px solid #10b981',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#10b981' }}
            >
              <Package size={17} color="#ffffff" />
              <span style={{ color: '#ffffff', fontWeight: 900 }}>
                ← ДО ЧЕРГИ ЗАПИТІВ {activePackagingRequests.length > 0 ? `(${activePackagingRequests.length})` : ''}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* ── ОСНОВНИЙ КОНТЕНТ: РЕЖИМ ЗАПИТІВ (ГОЛОВНИЙ РЕЖИМ СГП) ── */}
      {viewMode === 'requests' && (
        <div style={{ padding: '25px', flex: 1, overflowY: 'auto' }}>
          
          {/* KPI Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.kpiBlueIconBg, border: `1px solid ${t.kpiBlueIconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={22} color={isDark ? '#38bdf8' : '#0284c7'} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Нарядів у черзі</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: t.textPrimary }}>{groupedPackagingRequests.length}</div>
              </div>
            </div>

            <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.kpiAmberIconBg, border: `1px solid ${t.kpiAmberIconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} color={isDark ? '#fbbf24' : '#d97706'} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Позицій очікують</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: isDark ? '#fbbf24' : '#d97706' }}>{pendingPackagingRequests.length} <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>поз.</span></div>
              </div>
            </div>

            <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.kpiGreenIconBg, border: `1px solid ${t.kpiGreenIconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} color={isDark ? '#34d399' : '#059669'} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Загальний обсяг</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: isDark ? '#34d399' : '#059669' }}>
                  {pendingPackagingRequests.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>шт</span>
                </div>
              </div>
            </div>

            <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Залишки на СГП</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: t.textPrimary }}>{inventory.length} найменувань</div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('inventory')}
                style={{
                  background: t.buttonSecondaryBg,
                  border: `1.5px solid ${t.buttonSecondaryBorder}`,
                  color: t.textPrimary,
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: '0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#1e2433' : '#ecfdf5'; e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = isDark ? '#34d399' : '#065f46' }}
                onMouseLeave={e => { e.currentTarget.style.background = t.buttonSecondaryBg; e.currentTarget.style.borderColor = t.buttonSecondaryBorder; e.currentTarget.style.color = t.textPrimary }}
              >
                Відомість →
              </button>
            </div>
          </div>

          {/* Subheader: Queue Tabs & Realtime Sync Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            background: t.cardBg,
            border: `1.5px solid ${t.cardBorder}`,
            padding: '10px 18px',
            borderRadius: '14px',
            boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 900, color: t.textSecondary, marginRight: '6px', textTransform: 'uppercase' }}>
                Фільтр черги:
              </span>
              <button
                type="button"
                onClick={() => setRequestQueueTab('active')}
                style={{
                  background: requestQueueTab === 'active' ? (isDark ? '#064e3b' : '#ecfdf5') : t.buttonSecondaryBg,
                  border: requestQueueTab === 'active' ? '1.5px solid #10b981' : `1.5px solid ${t.cardBorder}`,
                  color: requestQueueTab === 'active' ? (isDark ? '#34d399' : '#047857') : t.textSecondary,
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>Очікують видачі</span>
                <span style={{
                  background: requestQueueTab === 'active' ? '#10b981' : (isDark ? '#232938' : '#f1f5f9'),
                  color: requestQueueTab === 'active' ? '#ffffff' : t.textSecondary,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 950
                }}>
                  {activePackagingRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRequestQueueTab('all')}
                style={{
                  background: requestQueueTab === 'all' ? (isDark ? '#1e293b' : '#f1f5f9') : t.buttonSecondaryBg,
                  border: requestQueueTab === 'all' ? (isDark ? '1.5px solid #475569' : '1.5px solid #94a3b8') : `1.5px solid ${t.cardBorder}`,
                  color: requestQueueTab === 'all' ? t.textPrimary : t.textSecondary,
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>Всі запити</span>
                <span style={{
                  background: requestQueueTab === 'all' ? (isDark ? '#475569' : '#334155') : (isDark ? '#232938' : '#f1f5f9'),
                  color: requestQueueTab === 'all' ? '#ffffff' : t.textSecondary,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 950
                }}>
                  {allPackagingRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRequestQueueTab('history')}
                style={{
                  background: requestQueueTab === 'history' ? (isDark ? '#022c22' : '#f0fdf4') : t.buttonSecondaryBg,
                  border: requestQueueTab === 'history' ? (isDark ? '1.5px solid #059669' : '1.5px solid #86efac') : `1.5px solid ${t.cardBorder}`,
                  color: requestQueueTab === 'history' ? (isDark ? '#34d399' : '#166534') : t.textSecondary,
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>Видані / Архів</span>
                <span style={{
                  background: requestQueueTab === 'history' ? '#16a34a' : (isDark ? '#232938' : '#f1f5f9'),
                  color: requestQueueTab === 'history' ? '#ffffff' : t.textSecondary,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 950
                }}>
                  {completedPackagingRequests.length}
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={fetchQueueFromDb}
                disabled={isRefreshingQueue}
                style={{
                  background: t.buttonSecondaryBg,
                  border: `1.5px solid ${t.buttonSecondaryBorder}`,
                  color: t.textSecondary,
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: isRefreshingQueue ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                title="Оновити чергу запитів з бази даних"
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = isDark ? '#34d399' : '#059669' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.buttonSecondaryBorder; e.currentTarget.style.color = t.textSecondary }}
              >
                <RefreshCw size={14} style={{ animation: isRefreshingQueue ? 'spin 1s linear infinite' : 'none' }} />
                <span>{isRefreshingQueue ? 'Оновлення...' : 'Оновити'}</span>
              </button>
            </div>
          </div>

          {/* Controls toolbar: Search, Status Filters & Collapse Controls */}
          {groupedPackagingRequests.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '22px'
            }}>
              {/* Left: Search input */}
              <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '380px' }}>
                <Search size={16} color={t.textSecondary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Пошук наряду або замовника..."
                  value={requestSearchQuery}
                  onChange={e => setRequestSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: t.inputBg,
                    border: `1.5px solid ${t.inputBorder}`,
                    borderRadius: '12px',
                    padding: '10px 14px 10px 42px',
                    color: t.inputText,
                    fontSize: '0.84rem',
                    outline: 'none',
                    boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                />
              </div>

              {/* Center: Quick Status Filters */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: t.inputBg,
                border: `1.5px solid ${t.inputBorder}`,
                padding: '4px',
                borderRadius: '12px',
                boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('all')}
                  style={{
                    border: 'none',
                    background: orderStatusFilter === 'all' ? '#0284c7' : 'transparent',
                    color: orderStatusFilter === 'all' ? '#ffffff' : t.textSecondary,
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Всі наряди ({orderStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('ready')}
                  style={{
                    border: 'none',
                    background: orderStatusFilter === 'ready' ? '#10b981' : 'transparent',
                    color: orderStatusFilter === 'ready' ? '#ffffff' : (isDark ? '#34d399' : '#047857'),
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  ✓ Готові ({orderStats.ready})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('shortage')}
                  style={{
                    border: 'none',
                    background: orderStatusFilter === 'shortage' ? '#f59e0b' : 'transparent',
                    color: orderStatusFilter === 'shortage' ? '#ffffff' : (isDark ? '#fbbf24' : '#b45309'),
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  ⚠️ З нестачею ({orderStats.shortage})
                </button>
              </div>

              {/* Right: Expand / Collapse All */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={expandAll}
                  style={{
                    background: t.buttonSecondaryBg,
                    border: `1.5px solid ${t.buttonSecondaryBorder}`,
                    color: t.textSecondary,
                    borderRadius: '10px',
                    padding: '7px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ChevronsUpDown size={13} /> Розгорнути всі
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  style={{
                    background: t.buttonSecondaryBg,
                    border: `1.5px solid ${t.buttonSecondaryBorder}`,
                    color: t.textSecondary,
                    borderRadius: '10px',
                    padding: '7px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  Згорнути всі
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {groupedPackagingRequests.length === 0 && (
            <div style={{
              background: t.cardBg,
              border: `1.5px solid ${t.cardBorder}`,
              borderRadius: '24px',
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: isDark ? '#022c22' : '#ecfdf5', border: `1.5px solid ${isDark ? '#059669' : '#a7f3d0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                <CheckCircle2 size={32} color={isDark ? '#34d399' : '#059669'} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: t.textPrimary, margin: '0 0 8px 0' }}>
                {requestQueueTab === 'history' ? 'Немає виданих запитів' : 'Черга запитів чиста!'}
              </h3>
              <p style={{ fontSize: '0.88rem', color: t.textSecondary, maxWidth: '480px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                {requestQueueTab === 'history'
                  ? 'У журналі видачі СГП поки немає завершених запитів на пакування.'
                  : completedPackagingRequests.length > 0
                    ? `Всі активні запити видано! У журналі є ${completedPackagingRequests.length} раніше виданих позицій.`
                    : 'Всі запити комплектуючих та готової продукції з відділу пакування наразі видано.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {completedPackagingRequests.length > 0 && requestQueueTab === 'active' && (
                  <button
                    type="button"
                    onClick={() => setRequestQueueTab('history')}
                    style={{
                      background: t.buttonSecondaryBg,
                      color: t.textPrimary,
                      border: `1.5px solid ${t.buttonSecondaryBorder}`,
                      borderRadius: '12px',
                      padding: '12px 22px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = isDark ? '#34d399' : '#047857' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.buttonSecondaryBorder; e.currentTarget.style.color = t.textPrimary }}
                  >
                    <History size={16} /> Переглянути видані ({completedPackagingRequests.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode('inventory')}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 26px',
                    fontSize: '0.86rem',
                    fontWeight: 950,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#10b981' }}
                >
                  <Archive size={18} color="#ffffff" />
                  <span style={{ color: '#ffffff', fontWeight: 950 }}>ПЕРЕГЛЯНУТИ ЗАЛИШКИ СГП</span>
                </button>
              </div>
            </div>
          )}

          {/* Filtered Empty State */}
          {groupedPackagingRequests.length > 0 && filteredOrderGroups.length === 0 && (
            <div style={{
              background: t.cardBg,
              border: `1.5px solid ${t.cardBorder}`,
              borderRadius: '18px',
              padding: '45px 20px',
              textAlign: 'center',
              color: t.textSecondary,
              fontSize: '0.9rem'
            }}>
              Не знайдено нарядів за обраними критеріями пошуку або фільтру.
            </div>
          )}

          {/* Orders list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {filteredOrderGroups.map(group => {
              const itemsWithStock = group.items.map(req => {
                const displayName = getItemDisplayName(req)
                const badge = getItemCategoryBadge(req, displayName)
                const sgpStock = getSgpStock(req, displayName)
                const neededQty = Number(req.quantity) || 0
                const hasEnough = sgpStock >= neededQty
                return { req, displayName, badge, sgpStock, neededQty, hasEnough }
              })
              const totalOrderItems = itemsWithStock.length
              const totalOrderUnits = itemsWithStock.reduce((sum, i) => sum + i.neededQty, 0)
              const readyItemsCount = itemsWithStock.filter(i => i.hasEnough).length
              const isFullyReady = readyItemsCount === totalOrderItems
              const hasShortage = !isFullyReady
              const isCollapsed = collapsedOrders.has(group.key)
              const percentReady = totalOrderItems > 0 ? Math.round((readyItemsCount / totalOrderItems) * 100) : 0

              return (
                <div
                  key={group.key}
                  style={{
                    background: t.cardBg,
                    border: `1.5px solid ${t.cardBorder}`,
                    borderLeft: isFullyReady ? '6px solid #10b981' : '6px solid #f59e0b',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    boxShadow: isDark ? '0 4px 18px rgba(0, 0, 0, 0.4)' : '0 4px 18px rgba(15, 23, 42, 0.05)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Order Card Header */}
                  <div style={{
                    background: t.cardHeaderBg,
                    borderBottom: isCollapsed ? 'none' : `1.5px solid ${t.cardBorder}`,
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {/* Accordion toggle button */}
                      <button
                        type="button"
                        onClick={() => toggleOrderCollapse(group.key)}
                        style={{
                          background: t.buttonSecondaryBg,
                          border: `1px solid ${t.buttonSecondaryBorder}`,
                          borderRadius: '8px',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: t.textPrimary,
                          transition: 'all 0.15s'
                        }}
                        title={isCollapsed ? 'Розгорнути наряд' : 'Згорнути наряд'}
                      >
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                      </button>

                      {/* Order number badge */}
                      <div style={{
                        background: t.orderBadgeBg,
                        color: t.orderBadgeText,
                        border: `1.5px solid ${t.orderBadgeBorder}`,
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontWeight: 1000,
                        fontSize: '0.95rem',
                        letterSpacing: '-0.01em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>НАРЯД № {group.orderNum}{group.batchIndex ? `/${group.batchIndex}` : ''}</span>
                      </div>

                      {/* Customer badge */}
                      {group.customer && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: t.customerBadgeBg,
                          border: `1.5px solid ${t.customerBadgeBorder}`,
                          padding: '5px 12px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          color: t.customerBadgeText,
                          fontWeight: 800
                        }}>
                          <User size={13} color={t.textSecondary} /> {group.customer}
                        </div>
                      )}

                      {/* Order Volume Summary */}
                      <div style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 800 }}>
                        • {totalOrderItems} {totalOrderItems === 1 ? 'позиція' : 'позицій'} ({totalOrderUnits} шт)
                      </div>

                      {/* Readiness status badge */}
                      {isFullyReady ? (
                        <span style={{
                          background: t.readyBadgeBg,
                          color: t.readyBadgeText,
                          border: `1.5px solid ${t.readyBadgeBorder}`,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <CheckCircle2 size={13} /> Готовий до видачі ({readyItemsCount}/{totalOrderItems})
                        </span>
                      ) : (
                        <span style={{
                          background: t.shortageBadgeBg,
                          color: t.shortageBadgeText,
                          border: `1.5px solid ${t.shortageBadgeBorder}`,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <AlertTriangle size={13} /> Нестача ({totalOrderItems - readyItemsCount} з {totalOrderItems} поз.)
                        </span>
                      )}
                    </div>

                    {/* Bulk action on right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {itemsWithStock.some(i => i.req.status !== 'completed' && i.req.status !== 'issued') ? (
                        <button
                          type="button"
                          onClick={() => handleIssueAllForOrder(group)}
                          disabled={isIssuingReq}
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '9px 18px',
                            fontSize: '0.82rem',
                            fontWeight: 1000,
                            cursor: isIssuingReq ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { if (!isIssuingReq) e.currentTarget.style.background = '#059669' }}
                          onMouseLeave={e => { if (!isIssuingReq) e.currentTarget.style.background = '#10b981' }}
                        >
                          <Check size={16} /> ВИДАТИ ВСІ ПОЗИЦІЇ НА НАРЯД
                        </button>
                      ) : (
                        <div style={{
                          background: t.readyBadgeBg,
                          color: t.readyBadgeText,
                          border: `1.5px solid ${t.readyBadgeBorder}`,
                          padding: '7px 14px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <CheckCircle2 size={15} /> ВСІ ПОЗИЦІЇ ВИДАНО
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div style={{ height: '3.5px', width: '100%', background: isDark ? '#232938' : '#e2e8f0', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: `${percentReady}%`,
                      background: isFullyReady ? '#10b981' : '#f59e0b',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>

                  {/* Collapsed Preview */}
                  {isCollapsed ? (
                    <div
                      onClick={() => toggleOrderCollapse(group.key)}
                      style={{
                        padding: '12px 20px',
                        background: t.cardBg,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                        color: t.textSecondary,
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = t.cardHeaderBg }}
                      onMouseLeave={e => { e.currentTarget.style.background = t.cardBg }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 800, color: t.textPrimary }}>Склад замовлення:</span>
                        <span style={{ color: t.textSecondary }}>
                          {itemsWithStock.slice(0, 4).map(i => i.displayName).join(' • ')}
                          {totalOrderItems > 4 ? ` ... (+ще ${totalOrderItems - 4})` : ''}
                        </span>
                      </div>
                      <span style={{ color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900, fontSize: '0.78rem', whiteSpace: 'nowrap', marginLeft: '15px' }}>
                        Розгорнути деталі наряду ({totalOrderItems} поз.) ↓
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Order Items Table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                          <thead>
                            <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, color: t.textSecondary }}>
                              <th style={{ padding: '12px 16px', width: '45px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>№</th>
                              <th style={{ padding: '12px 16px', fontWeight: 900 }}>Номенклатура матеріалу / виробу</th>
                              <th style={{ padding: '12px 16px', width: '130px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>Тип</th>
                              <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>Запитано</th>
                              <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>На СГП</th>
                              <th style={{ padding: '12px 16px', width: '160px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>Статус наявності</th>
                              <th style={{ padding: '12px 20px', width: '120px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>Дія</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsWithStock.map((item, itemIndex) => {
                              const { req, displayName, badge, sgpStock, neededQty, hasEnough } = item

                              return (
                                <tr
                                  key={req.id}
                                  style={{
                                    borderBottom: `1px solid ${t.tableRowBorder}`,
                                    background: t.cardBg,
                                    transition: 'background 0.1s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = t.tableRowHover }}
                                  onMouseLeave={e => { e.currentTarget.style.background = t.cardBg }}
                                >
                                  <td style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {itemIndex + 1}
                                  </td>

                                  <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 900, color: t.textPrimary, fontSize: '0.88rem' }}>
                                      {displayName}
                                    </div>
                                  </td>

                                  <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <span style={{
                                      background: badge.bg,
                                      color: badge.color,
                                      border: `1px solid ${badge.border || badge.color}`,
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 900,
                                      letterSpacing: '0.02em',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: 1.2
                                    }}>
                                      {badge.label}
                                    </span>
                                  </td>

                                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 1000, fontSize: '0.95rem', color: isDark ? '#fbbf24' : '#d97706', whiteSpace: 'nowrap' }}>
                                    {neededQty} <span style={{ fontSize: '0.74rem', color: t.textSecondary }}>шт</span>
                                  </td>

                                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 1000, fontSize: '0.95rem', color: hasEnough ? (isDark ? '#34d399' : '#059669') : '#ef4444', whiteSpace: 'nowrap' }}>
                                    {sgpStock} <span style={{ fontSize: '0.74rem', color: t.textSecondary }}>шт</span>
                                  </td>

                                  <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {hasEnough ? (
                                      <span style={{ color: isDark ? '#34d399' : '#059669', background: isDark ? '#022c22' : '#ecfdf5', border: `1px solid ${isDark ? '#059669' : '#a7f3d0'}`, padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <CheckCircle2 size={13} /> В наявності
                                      </span>
                                    ) : (
                                      <span style={{ color: isDark ? '#f87171' : '#dc2626', background: isDark ? '#450a0a' : '#fef2f2', border: `1px solid ${isDark ? '#991b1b' : '#fecaca'}`, padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <AlertTriangle size={13} /> Нестача {neededQty - sgpStock} шт
                                      </span>
                                    )}
                                  </td>

                                  <td style={{ padding: '12px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {req.status === 'completed' || req.status === 'issued' ? (
                                      <span style={{
                                        color: isDark ? '#34d399' : '#059669',
                                        background: isDark ? '#022c22' : '#ecfdf5',
                                        border: `1px solid ${isDark ? '#059669' : '#a7f3d0'}`,
                                        padding: '5px 12px',
                                        borderRadius: '8px',
                                        fontWeight: 900,
                                        fontSize: '0.76rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        <CheckCircle2 size={13} /> Видано
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleIssueRequest(req)}
                                        disabled={isIssuingReq}
                                        style={{
                                          background: t.issueBtnBg,
                                          color: t.issueBtnText,
                                          border: `1.5px solid ${t.issueBtnBorder}`,
                                          borderRadius: '8px',
                                          padding: '6px 14px',
                                          fontSize: '0.78rem',
                                          fontWeight: 900,
                                          cursor: isIssuingReq ? 'not-allowed' : 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          whiteSpace: 'nowrap',
                                          transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => { if (!isIssuingReq) { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#ffffff' } }}
                                        onMouseLeave={e => { if (!isIssuingReq) { e.currentTarget.style.background = t.issueBtnBg; e.currentTarget.style.color = t.issueBtnText } }}
                                      >
                                        <Check size={14} /> Видати
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Order Card Footer Closure */}
                      <div style={{
                        background: t.cardHeaderBg,
                        borderTop: `1.5px solid ${t.cardBorder}`,
                        padding: '10px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: t.textSecondary,
                        fontWeight: 700
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: t.textSecondary }}>Разом по наряду: <strong style={{ color: t.textPrimary }}>{totalOrderItems} поз.</strong> ({totalOrderUnits} шт)</span>
                          <span>•</span>
                          <span style={{ color: isFullyReady ? (isDark ? '#34d399' : '#059669') : (isDark ? '#fbbf24' : '#d97706'), fontWeight: 800 }}>
                            {isFullyReady ? '✓ Повна комплектація на СГП' : `⚠️ Доступно ${readyItemsCount} з ${totalOrderItems} позицій`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleOrderCollapse(group.key)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: t.textSecondary,
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = t.textPrimary }}
                          onMouseLeave={e => { e.currentTarget.style.color = t.textSecondary }}
                        >
                          <ChevronUp size={14} /> Згорнути наряд
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ОСНОВНИЙ КОНТЕНТ: РЕЖИМ ЗАЛИШКІВ (ВІДОМІСТЬ) ── */}
      {viewMode === 'inventory' && (
        <div style={{ padding: '25px', flex: 1, overflowY: 'auto' }}>
          
          {/* Top Bar back to requests */}
          <div style={{
            background: t.cardBg,
            border: `1.5px solid ${t.cardBorder}`,
            borderRadius: '16px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: t.textPrimary }}>
              <Archive size={18} color={isDark ? '#34d399' : '#059669'} />
              <span>Режим: <strong>Відомість залишків на складі (Інвентаризація)</strong></span>
              {pendingPackagingRequests.length > 0 && (
                <span style={{
                  background: isDark ? '#082f49' : '#e0f2fe',
                  color: isDark ? '#7dd3fc' : '#0369a1',
                  border: `1px solid ${isDark ? '#0284c7' : '#bae6fd'}`,
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: '12px'
                }}>
                  {pendingPackagingRequests.length} поз. очікують видачі
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setViewMode('requests')
                setSearchParams(prev => {
                  const np = new URLSearchParams(prev)
                  np.delete('mode')
                  return np
                })
              }}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#10b981' }}
            >
              ← Повернутись до черги запитів
            </button>
          </div>

          {/* Вкладки */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`warehouse-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchParams(prev => {
                    const np = new URLSearchParams(prev)
                    np.set('tab', tab.id)
                    return np
                  })
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: activeTab === tab.id ? '#10b981' : t.buttonSecondaryBg,
                  color: activeTab === tab.id ? '#ffffff' : t.textSecondary,
                  border: activeTab === tab.id ? '1.5px solid #059669' : `1.5px solid ${t.cardBorder}`,
                  padding: '12px 20px',
                  borderRadius: '14px',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: '0.15s',
                  whiteSpace: 'nowrap',
                  boxShadow: activeTab === tab.id ? '0 4px 14px rgba(16,185,129,0.25)' : (isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.02)')
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tabCounts[tab.id] > 0 && (
                  <span className="tab-count-badge" style={{
                    marginLeft: '6px',
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : (isDark ? '#232938' : '#f1f5f9'),
                    color: activeTab === tab.id ? '#ffffff' : t.textPrimary,
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontWeight: 1000
                  }}>
                    {tabCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Панель таблиці */}
          <div className="content-card" style={{ padding: '25px 25px 120px', borderRadius: '24px', background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 950, color: t.textPrimary }}>
                {tabs.find(t => t.id === activeTab)?.label.toUpperCase()}
              </h2>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                  <input
                    style={{ background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, padding: '10px 14px 10px 36px', borderRadius: '12px', color: t.inputText, fontSize: '0.85rem', outline: 'none', width: '240px' }}
                    placeholder={activeTab === 'shop2_buffer' ? "Пошук деталей або № наряду..." : "Пошук випущених позицій..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {activeTab !== 'shop2_buffer' && activeTab !== 'registry' && (
                  <button
                    onClick={() => setShowAdd(!showAdd)}
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}
                  >
                    <Plus size={18} /> Додати позицію
                  </button>
                )}
              </div>
            </div>

            {showAdd && activeTab !== 'shop2_buffer' && activeTab !== 'registry' && (
              <form onSubmit={handleAddInventoryItem} style={{ display: 'flex', gap: '12px', padding: '16px', background: t.cardHeaderBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', marginBottom: '25px', flexWrap: 'wrap' }}>
                <input
                  style={{ flex: 2, minWidth: '220px', background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, color: t.inputText, padding: '12px', borderRadius: '10px' }}
                  placeholder="Назва готової деталі / метизу..."
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  required
                />
                <input
                  type="number"
                  style={{ flex: 1, minWidth: '120px', background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, color: t.inputText, padding: '12px', borderRadius: '10px' }}
                  placeholder="Кількість"
                  value={newItem.total_qty}
                  onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })}
                  required
                />
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>
                  ЗБЕРЕГТИ
                </button>
              </form>
            )}

            {activeTab === 'registry' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
                    <th style={{ padding: '14px' }}>ДАТА / ЧАС</th>
                    <th style={{ padding: '14px' }}>КАРТКА</th>
                    <th style={{ padding: '14px' }}>ДЕТАЛЬ</th>
                    <th style={{ padding: '14px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                    <th style={{ padding: '14px' }}>ОПЕРАТОР</th>
                  </tr>
                </thead>
                <tbody>
                  {(workCardHistory || []).filter(h => h.status === 'completed').slice(0, 50).map(card => (
                    <tr key={card.id} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
                      <td style={{ padding: '14px', color: t.textSecondary }}>{card.completed_at ? new Date(card.completed_at).toLocaleString('uk-UA') : '—'}</td>
                      <td style={{ padding: '14px', fontWeight: 900, color: isDark ? '#34d399' : '#059669' }}>#{String(card.card_id || card.id).slice(-8).toUpperCase()}</td>
                      <td style={{ padding: '14px', fontWeight: 800, color: t.textPrimary }}>{card.nomenclature_name || card.card_info || 'Готова деталь'}</td>
                      <td style={{ padding: '14px', textAlign: 'center', fontWeight: 900, color: t.textPrimary }}>{card.quantity || 1} шт</td>
                      <td style={{ padding: '14px', color: t.textSecondary }}>{card.operator_name || '—'}</td>
                    </tr>
                  ))}
                  {(workCardHistory || []).filter(h => h.status === 'completed').length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>Записів у реєстрі випуску поки немає</td></tr>
                  )}
                </tbody>
              </table>
            ) : activeTab === 'shop2_buffer' ? (
              <div>
                {/* 1. Header KPIs banner */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '16px',
                  marginBottom: '25px'
                }}>
                  {/* Card 1: Вільні деталі в буфері */}
                  <div style={{
                    background: isDark ? 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.06) 100%)' : '#f5f3ff',
                    border: `1.5px solid ${isDark ? 'rgba(139,92,246,0.4)' : '#ddd6fe'}`,
                    borderRadius: '18px',
                    padding: '18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isDark ? '0 4px 18px rgba(139,92,246,0.12)' : '0 2px 10px rgba(139,92,246,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#c4b5fd' : '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ВХІДНИЙ БУФЕР ЦЕХУ №2
                      </span>
                      <Package size={18} color={isDark ? '#c4b5fd' : '#7c3aed'} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: isDark ? '#ffffff' : '#4c1d95', lineHeight: 1 }}>
                        {totalShop2BufferParts.toLocaleString('uk-UA')}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isDark ? '#c4b5fd' : '#6d28d9' }}>шт</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#a78bfa' : '#6d28d9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
                      Вільні для запуску в роботу Цеху 2
                    </div>
                  </div>

                  {/* Card 2: Нарядів у буфері */}
                  <div style={{
                    background: isDark ? '#161924' : '#ffffff',
                    border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
                    borderRadius: '18px',
                    padding: '18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 900, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        НАРЯДІВ У БУФЕРІ
                      </span>
                      <ClipboardList size={18} color={t.textSecondary} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: t.textPrimary, lineHeight: 1 }}>
                        {filteredShop2BufferTaskGroups.length}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.textMuted }}>нарядів</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: t.textMuted }}>
                      Очікують взяття в роботу
                    </div>
                  </div>

                  {/* Card 3: Активних карток */}
                  <div style={{
                    background: isDark ? '#161924' : '#ffffff',
                    border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
                    borderRadius: '18px',
                    padding: '18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 900, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        КАРТОК У БУФЕРІ
                      </span>
                      <Layers size={18} color={t.textSecondary} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: t.textPrimary, lineHeight: 1 }}>
                        {shop2BufferCards.length}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.textMuted }}>виробничих карток</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#34d399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      Передано з розкрою Цеху №1
                    </div>
                  </div>
                </div>

                {/* 2. Controls bar: Switch between 'По нарядах' and 'Зведена таблиця' */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${t.tableRowBorder}` }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setBufferViewMode('table')
                        localStorage.setItem('sgp_buffer_view_mode', 'table')
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: bufferViewMode === 'table' ? '1.5px solid #8b5cf6' : `1px solid ${t.buttonSecondaryBorder}`,
                        background: bufferViewMode === 'table' ? (isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe') : t.buttonSecondaryBg,
                        color: bufferViewMode === 'table' ? (isDark ? '#c4b5fd' : '#6d28d9') : t.textSecondary,
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Layers size={15} />
                      Зведена таблиця деталей
                    </button>
                    <button
                      onClick={() => {
                        setBufferViewMode('orders')
                        localStorage.setItem('sgp_buffer_view_mode', 'orders')
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: bufferViewMode === 'orders' ? '1.5px solid #8b5cf6' : `1px solid ${t.buttonSecondaryBorder}`,
                        background: bufferViewMode === 'orders' ? (isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe') : t.buttonSecondaryBg,
                        color: bufferViewMode === 'orders' ? (isDark ? '#c4b5fd' : '#6d28d9') : t.textSecondary,
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      <ClipboardList size={15} />
                      По нарядах
                    </button>
                  </div>

                  {bufferViewMode === 'orders' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={expandAllBufferGroups}
                        style={{ background: 'none', border: `1px solid ${t.buttonSecondaryBorder}`, color: t.textSecondary, padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Розгорнути всі
                      </button>
                      <button
                        onClick={collapseAllBufferGroups}
                        style={{ background: 'none', border: `1px solid ${t.buttonSecondaryBorder}`, color: t.textSecondary, padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Згорнути всі
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Main content based on view mode */}
                {bufferViewMode === 'orders' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredShop2BufferTaskGroups.map(group => {
                      const isCollapsed = collapsedBufferGroups.has(group.taskId)
                      const itemsList = Object.values(group.items)
                      return (
                        <div
                          key={group.taskId}
                          style={{
                            background: isDark ? '#141722' : '#ffffff',
                            border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
                            borderRadius: '16px',
                            overflow: 'hidden',
                            transition: 'all 0.2s ease',
                            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.03)'
                          }}
                        >
                          {/* Group header */}
                          <div
                            onClick={() => toggleBufferGroup(group.taskId)}
                            style={{
                              padding: '14px 20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              background: isDark ? '#161924' : '#fafafa',
                              borderBottom: isCollapsed ? 'none' : `1px solid ${t.tableRowBorder}`,
                              userSelect: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '8px',
                                background: isDark ? 'rgba(139,92,246,0.18)' : '#ede9fe',
                                border: `1px solid ${isDark ? 'rgba(139,92,246,0.35)' : '#c4b5fd'}`,
                                color: isDark ? '#c4b5fd' : '#6d28d9',
                                fontWeight: 950,
                                fontSize: '0.85rem'
                              }}>
                                {group.orderNum}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: t.textMuted, fontWeight: 700 }}>
                                {itemsList.length} {itemsList.length === 1 ? 'найменування' : itemsList.length < 5 ? 'найменування' : 'найменувань'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 14px',
                                borderRadius: '10px',
                                background: isDark ? 'rgba(139,92,246,0.15)' : '#f5f3ff',
                                border: `1px solid ${isDark ? 'rgba(139,92,246,0.3)' : '#ddd6fe'}`,
                                color: isDark ? '#c4b5fd' : '#6d28d9',
                                fontWeight: 950,
                                fontSize: '0.88rem'
                              }}>
                                <span>Всього в буфері:</span>
                                <strong>{group.totalQty.toLocaleString('uk-UA')} шт</strong>
                              </div>
                              {isCollapsed ? <ChevronDown size={18} color={t.textSecondary} /> : <ChevronUp size={18} color={t.textSecondary} />}
                            </div>
                          </div>

                          {/* Group body (part cards - matches screenshot 2!) */}
                          {!isCollapsed && (
                            <div style={{
                              padding: '16px 20px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '12px'
                            }}>
                              {itemsList.map(item => (
                                <div
                                  key={item.nomId}
                                  style={{
                                    flex: '1 1 260px',
                                    maxWidth: '360px',
                                    background: isDark ? '#12141c' : '#ffffff',
                                    border: `1.5px solid ${isDark ? '#1f2430' : '#e2e8f0'}`,
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                                    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.02)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.borderColor = isDark ? '#8b5cf6' : '#c4b5fd'
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none'
                                    e.currentTarget.style.borderColor = isDark ? '#1f2430' : '#e2e8f0'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.84rem', color: t.textPrimary, lineHeight: 1.3 }}>
                                      {item.name}
                                    </span>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div style={{ fontSize: '1.2rem', fontWeight: 1000, color: isDark ? '#34d399' : '#059669', lineHeight: 1 }}>
                                        {item.total_qty.toLocaleString('uk-UA')}
                                      </div>
                                      <div style={{ fontSize: '0.62rem', fontWeight: 800, color: t.textMuted, marginTop: '2px' }}>вільних дет.</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${t.tableRowBorder}` }}>
                                    <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 700 }}>
                                      {item.material}{item.thickness ? ` (${item.thickness})` : ''}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 800 }}>
                                      {item.cardCount} {item.cardCount === 1 ? 'картка' : 'картки'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {filteredShop2BufferTaskGroups.length === 0 && (
                      <div style={{ padding: '60px', textAlign: 'center', color: t.textMuted }}>
                        <Package size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                          {searchQuery ? 'За вашим запитом у буфері нічого не знайдено' : 'У буфері Цеху №2 наразі немає деталей'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Table view */
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
                        <th style={{ padding: '14px 16px' }}>НАЙМЕНУВАННЯ ДЕТАЛІ</th>
                        <th style={{ padding: '14px 16px' }}>МАТЕРІАЛ / ТОВЩИНА</th>
                        <th style={{ padding: '14px 16px' }}>НАРЯДИ У БУФЕРІ</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', width: '160px' }}>ВІЛЬНО В БУФЕРІ</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', width: '120px' }}>КАРТОК</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', width: '160px' }}>СТАТУС</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shop2BufferConsolidatedItems.map(item => (
                        <tr key={item.key} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: t.textPrimary }}>
                            {item.name}
                          </td>
                          <td style={{ padding: '14px 16px', color: t.textSecondary, fontSize: '0.82rem', fontWeight: 600 }}>
                            {item.material}{item.thickness ? ` (${item.thickness})` : ''}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {item.naryadList.map(nr => (
                                <span key={nr} style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe',
                                  color: isDark ? '#c4b5fd' : '#6d28d9',
                                  fontSize: '0.72rem',
                                  fontWeight: 800
                                }}>
                                  {nr}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'baseline',
                              gap: '4px',
                              padding: '6px 14px',
                              borderRadius: '12px',
                              background: isDark ? 'rgba(139,92,246,0.15)' : '#f5f3ff',
                              border: `1px solid ${isDark ? 'rgba(139,92,246,0.35)' : '#ddd6fe'}`,
                              color: isDark ? '#c4b5fd' : '#6d28d9',
                              fontWeight: 950,
                              fontSize: '0.92rem'
                            }}>
                              <span>{item.total_qty.toLocaleString('uk-UA')}</span>
                              <small style={{ opacity: 0.8, fontSize: '0.72rem' }}>{item.unit}</small>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: t.textPrimary }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '8px',
                              background: isDark ? '#1a1e2b' : '#f1f5f9',
                              fontSize: '0.78rem',
                              fontWeight: 900
                            }}>
                              {item.cardCount}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5',
                              border: `1px solid ${isDark ? 'rgba(16,185,129,0.25)' : '#a7f3d0'}`,
                              color: isDark ? '#34d399' : '#047857',
                              fontSize: '0.74rem',
                              fontWeight: 900
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                              Вільні для Цеху 2
                            </span>
                          </td>
                        </tr>
                      ))}

                      {shop2BufferConsolidatedItems.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: t.textMuted }}>
                            {searchQuery ? 'За вашим запитом деталей не знайдено' : 'У буфері Цеху №2 наразі немає деталей'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
                    <th style={{ padding: '14px 16px' }}>НАЙМЕНУВАННЯ ВИРОБУ</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', width: '150px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#34d399' : '#047857', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#34d399' : '#10b981' }} /> НАЯВНІСТЬ
                      </span>
                    </th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', width: '140px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#38bdf8' : '#0284c7' }} /> ВІЛЬНО
                      </span>
                    </th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', width: '140px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#fbbf24' : '#b45309', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#fbbf24' : '#f59e0b' }} /> РЕЗЕРВ
                      </span>
                    </th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', width: '80px' }}>ДІЇ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.key} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 800, color: t.textPrimary }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{item.name}</span>
                          {isAdmin && editingInvKey !== item.key && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingInvKey(item.key)
                                setEditingInvTotal(String(item.total_qty || 0))
                                setEditingInvReserved(String(item.reserved_qty || 0))
                              }}
                              style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '4px' }}
                              title="Редагувати залишок"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {editingInvKey === item.key ? (
                          <input
                            type="number"
                            value={editingInvTotal}
                            onChange={e => setEditingInvTotal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item) }}
                            style={{ width: '85px', background: t.inputBg, border: '1.5px solid #10b981', color: t.inputText, textAlign: 'center', borderRadius: '8px', padding: '6px' }}
                            autoFocus
                          />
                        ) : (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            gap: '4px',
                            padding: '6px 14px',
                            borderRadius: '12px',
                            background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0'}`,
                            color: isDark ? '#34d399' : '#047857',
                            fontWeight: 950,
                            fontSize: '0.92rem'
                          }}>
                            <span>{Number(item.total_qty || 0).toLocaleString('uk-UA')}</span>
                            <small style={{ color: isDark ? '#a7f3d0' : '#065f46', opacity: 0.8, fontWeight: 700, fontSize: '0.72rem' }}>{item.unit}</small>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 14px',
                          borderRadius: '12px',
                          background: isDark ? 'rgba(14, 165, 233, 0.12)' : '#f0f9ff',
                          border: `1px solid ${isDark ? 'rgba(14, 165, 233, 0.25)' : '#bae6fd'}`,
                          color: isDark ? '#38bdf8' : '#0284c7',
                          fontWeight: 950,
                          fontSize: '0.92rem'
                        }}>
                          {Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0)).toLocaleString('uk-UA')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {editingInvKey === item.key ? (
                          <input
                            type="number"
                            value={editingInvReserved}
                            onChange={e => setEditingInvReserved(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item) }}
                            style={{ width: '75px', background: t.inputBg, border: '1.5px solid #d97706', color: t.inputText, textAlign: 'center', borderRadius: '8px', padding: '6px' }}
                          />
                        ) : item.reserved_qty > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const primaryRaw = item.rawItems?.[0] || item
                              setReserveAnalysisItem({
                                ...primaryRaw,
                                id: primaryRaw.id || item.key,
                                nomenclature_id: item.nomenclature_id || primaryRaw.nomenclature_id,
                                name: item.name,
                                total_qty: item.total_qty,
                                reserved_qty: item.reserved_qty,
                                unit: item.unit
                              })
                            }}
                            title="Натисніть для перегляду замовлень у резерві"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '12px',
                              background: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                              border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a'}`,
                              color: isDark ? '#fbbf24' : '#b45309',
                              fontWeight: 950,
                              fontSize: '0.92rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              outline: 'none',
                              boxShadow: isDark ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(180, 83, 9, 0.08)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.borderColor = isDark ? '#f59e0b' : '#d97706'
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.25)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none'
                              e.currentTarget.style.borderColor = isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a'
                              e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(180, 83, 9, 0.08)'
                            }}
                          >
                            <span>{Number(item.reserved_qty).toLocaleString('uk-UA')}</span>
                            <Eye size={13} style={{ opacity: 0.85 }} />
                          </button>
                        ) : (
                          <span style={{ color: t.textMuted, fontSize: '0.85rem', fontWeight: 600 }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        {editingInvKey === item.key ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => handleSaveInventoryQty(item)}
                              disabled={isSavingInv}
                              style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                            >
                              {isSavingInv ? '...' : 'ЗБЕРЕГТИ'}
                            </button>
                            <button
                              onClick={() => setEditingInvKey(null)}
                              style={{ background: t.buttonSecondaryBg, color: t.textSecondary, border: `1px solid ${t.buttonSecondaryBorder}`, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: t.textMuted, fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: t.textMuted, fontSize: '0.88rem' }}>
                        На складі готової продукції немає записів за даним фільтром
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {reserveAnalysisItem && (
        <ReserveAnalysisModal
          item={reserveAnalysisItem}
          onClose={() => setReserveAnalysisItem(null)}
          requests={requests}
          orders={orders}
          tasks={tasks}
          nomenclatures={nomenclatures}
        />
      )}
    </div>
  )
}
