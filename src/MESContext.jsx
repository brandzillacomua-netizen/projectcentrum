import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { apiService } from './services/apiDispatcher'

const MESContext = createContext()

const CACHE_KEY = 'MES_APP_CACHE_V1'

const loadFromCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch (e) {
    console.warn('Failed to load cache:', e)
    return {}
  }
}

export const MESProvider = ({ children }) => {
  const cache = loadFromCache()

  const [orders, setOrders] = useState(cache.orders || [])
  const [customers, setCustomers] = useState(cache.customers || [])
  const [inventory, setInventory] = useState(cache.inventory || [])
  const [tasks, setTasks] = useState(cache.tasks || [])
  const [managementTasks, setManagementTasks] = useState(cache.managementTasks || [])
  const [requests, setRequests] = useState(cache.requests || [])
  const [nomenclatures, setNomenclatures] = useState(cache.nomenclatures || [])
  const [bomItems, setBomItems] = useState(cache.bomItems || [])
  const [receptionDocs, setReceptionDocs] = useState(cache.receptionDocs || [])
  const [purchaseRequests, setPurchaseRequests] = useState(cache.purchaseRequests || [])
  const [workCards, setWorkCards] = useState(cache.workCards || [])
  const [workCardHistory, setWorkCardHistory] = useState(cache.workCardHistory || [])
  const [machines, setMachines] = useState(cache.machines || [])
  const [systemUsers, setSystemUsers] = useState(cache.systemUsers || [])
  const [accessLogs, setAccessLogs] = useState(cache.accessLogs || [])
  const [fortnetUrl, setFortnetUrl] = useState(localStorage.getItem('FORTNET_API_URL') || 'http://192.168.1.100:8090')
  // Сесія — зберігаємо лише login, права завжди беремо свіжі з Supabase
  const [currentUser, setCurrentUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(() => !!localStorage.getItem('MES_SESSION_LOGIN'))
  const [loading, setLoading] = useState(false)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const PAGE_SIZE = 20

  const operators = ["Олексій", "Дмитро", "Сергій", "Андрій", "Микола"]
  const productionStages = ["Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]
  
  const CHAIN_SHOP1 = ["Розкрій", "Галтовка", "Прийомка"]
  const CHAIN_GENERAL = ["Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't')
    .replace(/[аa]/g, 'a')
    .replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o')
    .replace(/[рp]/g, 'p')
    .replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x')
    .replace(/\s/g, '')

  const fetchOrders = async (page = 0, append = false, options = {}) => {
    const { searchQuery, dateRange } = options
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })

    if (searchQuery) {
      query = query.or(`order_num.ilike.%${searchQuery}%,customer.ilike.%${searchQuery}%`)
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date()
      let gteDate = null
      if (dateRange === 'today') gteDate = new Date(now.setHours(0, 0, 0, 0))
      else if (dateRange === 'week') gteDate = new Date(now.setDate(now.getDate() - 7))
      else if (dateRange === 'month') gteDate = new Date(now.setMonth(now.getMonth() - 1))
      else if (dateRange === 'quarter') gteDate = new Date(now.setMonth(now.getMonth() - 3))
      
      if (gteDate) query = query.gte('created_at', gteDate.toISOString())
    }

    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE - 1
    
    const { data, error } = await query.range(start, end)
    if (error) {
      console.error('Fetch orders error:', error)
      return
    }

    if (append) {
      setOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id))
        const newData = (data || []).filter(o => !existingIds.has(o.id))
        return [...prev, ...newData]
      })
    } else {
      setOrders(data || [])
    }
    setHasMoreOrders((data || []).length === PAGE_SIZE)
  }

  const fetchData = async () => {
    if (orders.length === 0) setLoading(true)
    try {
      // Refresh first page smartly to avoid full list reset
      const { data: latest, error: oErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (!oErr && latest) {
        setOrders(prev => {
          const next = [...prev]
          latest.forEach(newItem => {
            const idx = next.findIndex(o => o.id === newItem.id)
            if (idx >= 0) next[idx] = newItem
            else next.unshift(newItem)
          })
          return next
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // unique
        })
      }

      const { data: c } = await supabase.from('customers').select('*').limit(10).order('name')
      const { data: i } = await supabase.from('inventory').select('*').order('name')
      const { data: t } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
      const { data: r } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false })
      const { data: n } = await supabase.from('nomenclatures').select('*')
      const { data: b } = await supabase.from('bom_items').select('*')
      const { data: rec } = await supabase.from('reception_docs').select('*').order('created_at', { ascending: false })
      const { data: pr } = await supabase.from('purchase_requests').select('*').order('created_at', { ascending: false })
      const { data: wc } = await supabase.from('work_cards').select('*').order('created_at', { ascending: true })
      const { data: mc } = await supabase.from('machines').select('*').order('name')
      const { data: su } = await supabase.from('system_users').select('*').order('login')
      const { data: mt } = await supabase.from('management_tasks').select('*').order('created_at', { ascending: false })

      if (c) setCustomers(c)
      if (i) setInventory(i)
      if (t) setTasks(t)
      if (mt) setManagementTasks(mt)
      if (r) setRequests(r)
      if (n) setNomenclatures(n)
      if (b) setBomItems(b)
      if (mc) setMachines(mc)
      if (su) setSystemUsers(su)
      if (rec) setReceptionDocs(rec)
      if (pr) setPurchaseRequests(pr)
      if (wc) setWorkCards(wc)

      const { data: wch } = await supabase.from('work_card_history').select('*').order('created_at', { ascending: false })
      if (wch) setWorkCardHistory(wch)

      const { data: al } = await supabase.from('access_logs').select('*').order('event_time', { ascending: false }).limit(200)
      if (al) setAccessLogs(al)
    } finally {
      setLoading(false)
    }
  }


  const productionData = useMemo(() => {
    return {
      totalProduced: workCardHistory.reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0),
      totalScrap: workCardHistory.reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
    }
  }, [workCardHistory])

  // --- PERSISTENCE ---
  useEffect(() => {
    const dataToCache = {
      orders, customers, inventory, tasks, managementTasks, requests, nomenclatures,
      bomItems, receptionDocs, purchaseRequests, workCards, workCardHistory, machines, systemUsers, accessLogs
      // currentUser НЕ кешується — завжди завантажуємо свіжі права при старті
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache))
  }, [orders, customers, inventory, tasks, managementTasks, requests, nomenclatures, bomItems, receptionDocs, purchaseRequests, workCards, workCardHistory, machines, systemUsers])

  // --- ВІДНОВЛЕННЯ СЕСІЇ ТА СИНХРОНІЗАЦІЯ ПРАВ ---
  // На старті: якщо є збережений login — підтягуємо свіжого користувача з Supabase
  useEffect(() => {
    const savedLogin = localStorage.getItem('MES_SESSION_LOGIN')
    if (savedLogin) {
      supabase.from('system_users').select('*').eq('login', savedLogin).then(({ data }) => {
        if (data && data.length > 0) {
          setCurrentUser(data[0])
        } else {
          // Юзера видалили з бази — очищаємо сесію
          localStorage.removeItem('MES_SESSION_LOGIN')
        }
        setSessionLoading(false)
      })
    } else {
      setSessionLoading(false)
    }
  }, [])

  // Real-time: коли systemUsers оновлюється — одразу синхронізуємо currentUser
  useEffect(() => {
    if (currentUser?.id && systemUsers.length > 0) {
      const fresh = systemUsers.find(u => u.id === currentUser.id)
      if (fresh) {
        setCurrentUser(prev => ({ ...fresh, token: prev?.token }))
      }
    }
  }, [systemUsers])

  useEffect(() => {
    fetchData()
    // Одноразова міграція
    const runFix = async () => {
      const done = localStorage.getItem('bz_fix_v2')
      if (!done) {
        await fixInventoryTypes()
        localStorage.setItem('bz_fix_v2', 'true')
        console.log('--- BZ FIX COMPLETE ---')
      }
    }
    runFix()

    const sub = supabase.channel('mes-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // --- FORTNET SYNC LOGIC ---
  const syncFortnetEvents = async () => {
    if (!fortnetUrl) return;
    try {
      // 1. Fetch from Fortnet (via Vite proxy /fortnet-api/online/)
      // In production, fortnetUrl would be the actual local IP.
      // We use /fortnet-api/ as a relative path that Vite proxies.
      const response = await fetch('/fortnet-api/online/');
      if (!response.ok) throw new Error('Fortnet offline');
      const data = await response.json();

      // Check for new events
      const events = Array.isArray(data) ? data : (data?.Event ? [data.Event] : []);
      
      for (const ev of events) {
        // Parse time: "27.09.2011 19:04:43" -> Date
        // Note: Fortnet format might vary, but based on docs: DD.MM.YYYY HH:MM:SS
        const dtParts = ev.DateTime?.split(' ');
        let eventDate = new Date();
        if (dtParts && dtParts.length === 2) {
          const [d, m, y] = dtParts[0].split('.');
          const [h, min, s] = dtParts[1].split(':');
          eventDate = new Date(y, m - 1, d, h, min, s);
        }

        // Check if event already exists (by timestamp and person)
        const isDuplicate = accessLogs.some(l => 
          new Date(l.event_time).getTime() === eventDate.getTime() && 
          l.person_name === ev.person?.FullName
        );

        if (!isDuplicate) {
          const newEntry = {
            event_time: eventDate.toISOString(),
            card_code: ev.card ? String(ev.card) : 'UNKNOWN',
            person_name: ev.person?.FullName || 'Unknown',
            hardware_name: ev.hardware?.Name || 'Door',
            event_kind: ev.message?.Name || 'Scan'
          };
          
          const { error } = await supabase.from('access_logs').insert([newEntry]);
          if (!error) {
            setAccessLogs(prev => [newEntry, ...prev].slice(0, 500));
          }
        }
      }
    } catch (err) {
      console.warn('Sync Fortnet failed:', err.message);
    }
  }

  // Periodic Sync
  useEffect(() => {
    const timer = setInterval(syncFortnetEvents, 60000); // Every 60 seconds
    return () => clearInterval(timer);
  }, [fortnetUrl, accessLogs]);

  const updateFortnetUrl = (url) => {
    setFortnetUrl(url);
    localStorage.setItem('FORTNET_API_URL', url);
  }

  // --- AUTH & USER MANAGEMENT ---
  const login = async (loginName, password) => {
    // 1. СИНХРОНІЗАЦІЯ З БЕКЕНДОМ (ngrok)
    const backendRes = await apiService.submitLogin(loginName, password);

    // 2. ПЕРЕВІРКА В БД (Supabase)
    const { data } = await supabase
      .from('system_users')
      .select('*')
      .eq('login', loginName)

    let user = (data && data.length > 0) ? data[0] : null;

    // 3. ОБРОБКА РЕЗУЛЬТАТІВ ГІБРИДНОЇ АВТОРИЗАЦІЇ
    const token = backendRes?.token || backendRes?.accessToken || backendRes?.data?.token;

    // ПУСКАЄМО ЯКЩО: є правильний пароль у Supabase АБО бекенд видав токен
    const isSupabaseAuth = user && user.password === password;
    const isBackendAuth = !!token;

    if (isSupabaseAuth || isBackendAuth) {
      let finalUser = user;

      // Якщо користувач з бекенду, але його немає в Supabase — СТВОРЮЄМО ПРОФІЛЬ АВТОМАТИЧНО
      if (!user && isBackendAuth) {
        console.log("Auto-creating profile for external user:", loginName);
        const newUser = {
          login: loginName,
          password: password, // Зберігаємо для локального входу наступного разу (опціонально)
          first_name: 'Зовнішній',
          last_name: 'Користувач',
          position: 'Працівник',
          access_rights: { operator: true, manager: true } // Дефолтні права
        };
        const { data: created } = await upsertUser(newUser);
        finalUser = created;
      }

      // Додаємо токен до сесії
      const userWithToken = { ...finalUser, token };
      setCurrentUser(userWithToken);
      localStorage.setItem('MES_SESSION_LOGIN', finalUser.login)
      return { success: true, user: userWithToken };
    }

    return { success: false, error: 'Невірний логін або пароль' };
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('MES_SESSION_LOGIN')
  }

  const searchCustomers = async (query) => {
    if (!query) return
    const { data } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(5)
    if (data) setCustomers(data)
  }

  const addOrder = async (header, items) => {
    if (header.customer) {
      const trimmedName = header.customer.trim()
      const { data: existing } = await supabase.from('customers').select('id').ilike('name', trimmedName).maybeSingle()
      if (!existing) {
        await supabase.from('customers').insert([{
          name: trimmedName,
          official_name: header.official_customer?.trim() || ''
        }])
      }
    }

    const { data, error } = await supabase.from('orders').insert([{
      order_num: header.orderNum,
      customer: header.customer,
      official_customer: header.official_customer,
      deadline: header.deadline,
      status: 'pending'
    }]).select()

    if (error) throw error
    const newOrderId = data[0].id

    const itemsToInsert = items.map(it => ({
      order_id: newOrderId,
      nomenclature_id: it.nomenclature_id,
      quantity: Number(it.quantity)
    }))

    await supabase.from('order_items').insert(itemsToInsert)
    fetchData()
  }

  const upsertUser = async (userData) => {
    // 1. СИНХРОНІЗАЦІЯ З ЗОВНІШНІМ БЕКЕНДОМ
    await apiService.submitUserAction(userData, null, currentUser?.token);

    // 2. ЗБЕРЕЖЕННЯ В SUPABASE
    const payload = { ...userData }
    if (!payload.id) delete payload.id
    const { data, error } = await supabase.from('system_users').upsert([payload]).select()
    const result = (data && data.length > 0) ? data[0] : null
    if (!error && result) {
      setSystemUsers(prev => {
        const idx = prev.findIndex(u => u.id === result.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = result; return next; }
        return [...prev, result]
      })
      if (currentUser && currentUser.id === result.id) setCurrentUser(result)
    }
    return { data: result, error }
  }

  const deleteUser = async (id) => {
    const { error } = await supabase.from('system_users').delete().eq('id', id)
    if (!error) setSystemUsers(prev => prev.filter(u => u.id !== id))
    return { error }
  }

  // --- CORE BUSINESS LOGIC ---
  const createNaryad = async (orderId, machineName, customQuantities = null, customDeadline = null) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) return
      let totalMin = 0
      const materialSummary = {}
      const bzStockDeductions = []
      const plan_snapshot = {}

      order.order_items?.forEach(item => {
        const requestedQty = customQuantities && customQuantities[item.id] !== undefined 
          ? Number(customQuantities[item.id]) 
          : Number(item.quantity)
        
        if (requestedQty <= 0) return

        const parts = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        const displayParts = parts.length > 0 ? parts.map(b => ({
          nom: nomenclatures.find(n => String(n.id) === String(b.child_id)),
          qtyPer: b.quantity_per_parent
        })) : [{ nom: nomenclatures.find(n => String(n.id) === String(item.nomenclature_id)), qtyPer: 1 }]

        displayParts.forEach(part => {
          if (!part.nom) return
          const totalNeeded = requestedQty * (Number(part.qtyPer) || 1)
          const invItem = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          const inStockQty = invItem ? Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)) : 0

          const usedFromStock = Math.min(totalNeeded, inStockQty)
          const totalToProduce = Math.max(0, totalNeeded - inStockQty)
          const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
          let sheets = Math.ceil(totalToProduce / unitsPerSheet)

          plan_snapshot[part.nom.id] = {
            id: part.nom.id,
            name: part.nom.name,
            code: part.nom.nomenclature_code,
            need: totalNeeded,
            stock: inStockQty,
            plan: totalToProduce,
            units_per_sheet: unitsPerSheet,
            sheets: sheets, 
            material: part.nom.material_type,
            order_item_id: item.id
          }

          if (usedFromStock > 0 && invItem) {
            bzStockDeductions.push({ id: invItem.id, next_qty: (Number(invItem.total_qty) || 0) - usedFromStock })
          }

          if (totalToProduce <= 0) return

          const matKey = (part.nom.material_type || part.nom.name || 'Інше').trim()
          const normalizeStr = (s) => s?.toLowerCase().replace(/[\s-]/g, '')
          sheets = Math.ceil(totalToProduce / unitsPerSheet)

          if (!materialSummary[matKey]) {
            const rawNom = nomenclatures.find(n =>
              n.type === 'raw' && (
                normalizeStr(n.material_type) === normalizeStr(matKey) ||
                normalizeStr(n.name).includes(normalizeStr(matKey)) ||
                normalizeStr(matKey).includes(normalizeStr(n.name))
              )
            )
            const rawInv = inventory.find(i => rawNom ? (String(i.nomenclature_id) === String(rawNom.id)) : (String(i.nomenclature_id) === String(part.nom.id) && i.type === 'raw'))
            const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'
            materialSummary[matKey] = { matName: matKey, sheets: 0, totalUnits: 0, components: [], inventory_id: rawInv?.id || null, unit, partType: part.nom.type }
          }
          materialSummary[matKey].sheets += sheets
          materialSummary[matKey].totalUnits += totalToProduce
          materialSummary[matKey].components.push(`${part.nom.name}: ${totalToProduce}шт`)
          totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
        })
      })

      if (Object.keys(plan_snapshot).length === 0) return

      // --- SMART NUMBERING & DATA LOGIC ---
      const totalUnits = order.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;
      const thisNaryadTotalSets = customQuantities 
          ? Math.max(...Object.values(customQuantities).map(v => Number(v) || 0)) 
          : totalUnits;
      
      const alreadyPlannedSets = tasks.filter(t => t.order_id === orderId).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);
      const isPartial = (thisNaryadTotalSets < totalUnits) || (alreadyPlannedSets > 0);
      const nextBatchIndex = tasks.filter(t => t.order_id === orderId && (t.step === 'Лазерний розкрій' || t.step === 'Лазерна різка')).length + 1;

      plan_snapshot._metadata = {
        planned_deadline: customDeadline || order.deadline,
        batch_index: isPartial ? nextBatchIndex : null
      }

      const { data: taskData, error: taskError } = await supabase.from('tasks').insert([{
        order_id: orderId, 
        step: 'Лазерний розкрій', 
        status: 'waiting', 
        machine_name: machineName || 'Не вказано',
        estimated_time: Math.round(totalMin), 
        engineer_conf: false, 
        warehouse_conf: false, 
        director_conf: false,
        plan_snapshot: plan_snapshot,
        planned_sets: thisNaryadTotalSets,
        batch_index: isPartial ? nextBatchIndex : null,
        planned_deadline: customDeadline || order.deadline
      }]).select()

      const tData = (taskData && taskData.length > 0) ? taskData[0] : null
      if (taskError) throw taskError

      for (const upd of bzStockDeductions) {
        await supabase.from('inventory').update({ total_qty: upd.next_qty }).eq('id', upd.id)
        const invItem = inventory.find(i => i.id === upd.id)
        if (invItem && tData) {
          const usedQty = (Number(invItem.total_qty) || 0) - upd.next_qty
          if (usedQty > 0) {
            const { data: bzCardData } = await supabase.from('work_cards').insert([{
              task_id: tData.id,
              order_id: orderId,
              nomenclature_id: invItem.nomenclature_id,
              quantity: usedQty,
              status: 'completed',
              operation: 'Склад БЗ',
              card_info: '[ЗІ СКЛАДУ БЗ]'
            }]).select()
            const bzCard = (bzCardData && bzCardData.length > 0) ? bzCardData[0] : null
            await supabase.from('work_card_history').insert([{
              card_id: bzCard?.id || null,
              nomenclature_id: invItem.nomenclature_id,
              stage_name: 'Склад БЗ',
              operator_name: 'Склад (БРОНЬ)',
              qty_at_start: usedQty,
              qty_completed: usedQty,
              scrap_qty: 0,
              completed_at: new Date().toISOString()
            }])
          }
        }
      }

      await supabase.from('orders').update({ status: 'in-progress' }).eq('id', orderId)

      const allMaterials = Object.values(materialSummary).map(info => ({
        ...info,
        sheets: Number(info.sheets) || 0
      }))

      const requestsToInsert = allMaterials
        .filter(info => info.partType === 'raw' || (info.matName && info.matName.toLowerCase().includes('лист')))
        .map(info => {
          const qtyToRequest = info.unit === 'ЛИСТІВ' ? info.sheets : info.totalUnits;
          const unitLabel = info.unit === 'ЛИСТІВ' ? 'л.' : 'од.';
          return {
            order_id: orderId,
            task_id: tData.id,
            quantity: qtyToRequest,
            status: 'pending',
            inventory_id: info.inventory_id,
            details: `СКЛАД ОПЕРАТИВНИЙ: ${info.matName} — ${qtyToRequest} ${unitLabel} (Разом: ${info.totalUnits} шт | Для: ${info.components.join(', ')})`
          }
        })

      const totalActualSheets = allMaterials
        .filter(m => m.unit === 'ЛИСТІВ')
        .reduce((acc, m) => acc + (m.sheets || 0), 0)

      if (totalActualSheets > 0) {
        nomenclatures.filter(n => 
          n.type === 'consumable' && 
          (Number(n.consumption_per_sheet) || 0) > 0 &&
          (n.name.toLowerCase().includes('лист') || n.name.toLowerCase().includes('фреза'))
        ).forEach(cons => {
          const neededQty = Math.ceil(totalActualSheets * Number(cons.consumption_per_sheet))
          const invItem = inventory.find(i => i.nomenclature_id === cons.id)
          requestsToInsert.push({
            order_id: orderId, 
            task_id: tData.id,
            quantity: neededQty, 
            status: 'pending', 
            inventory_id: invItem?.id || null,
            details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${order.order_num}: ${cons.name} — ${neededQty} од.`
          })
        })
      }
      if (requestsToInsert.length > 0) await supabase.from('material_requests').insert(requestsToInsert)
      fetchData()
    } catch (err) { console.error('Error creating naryad:', err.message) }
  }

  const createPurchaseRequest = async (orderId, orderNum, items, taskId = null) => {
    // Process items but keep them for the Production Warehouse to review
    const processedItems = items.map(it => {
      const invItem = inventory.find(i => 
        (i.id === it.inventory_id || i.nomenclature_id === it.nomenclature_id) && 
        i.warehouse === 'production'
      )
      const available = invItem ? (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0) : 0
      const needed = Number(it.needed || it.missingAmount || 0)
      
      return {
        ...it,
        production_available: available,
        needs_procurement: available < needed
      }
    })

    const { error } = await supabase.from('purchase_requests').insert([{
      order_id: orderId,
      task_id: taskId,
      order_num: orderNum,
      items: processedItems,
      status: 'pending',
      destination_warehouse: 'production' // Always to Production first
    }])
    if (!error) fetchData()
    return { error }
  }

  const updatePurchaseRequestStatus = async (id, status, destWarehouse = 'production') => {
    const { error } = await supabase.from('purchase_requests').update({ status, destination_warehouse: destWarehouse }).eq('id', id)
    if (!error) fetchData()
    return { error }
  }

  const convertRequestToOrder = async (requestId) => {
    // 1. Отримуємо дані запиту
    const { data: requestData } = await supabase.from('purchase_requests').select('*').eq('id', requestId).single()
    if (!requestData) return { error: 'Запит не знайдено' }

    // 2. Визначаємо маршрут
    // Якщо destination_warehouse === 'procurement' -> це зовнішня закупівля для Складу Виробництва
    // Якщо destination_warehouse === 'production' -> це передача зі Складу Виробництва на Оперативний
    let targetWH = 'production'
    let sourceWH = null
    
    if (requestData.destination_warehouse === 'production') {
      targetWH = 'operational'
      sourceWH = 'production'
    }

    // 3. Створюємо документ прийомки (з маршрутизацією!)
    // Якщо це зовнішня закупівля (target: production, source: null), 
    // ставимо статус 'shipped' одразу, щоб вона з'явилася в прийомці на СВ.
    const { error: recError } = await supabase.from('reception_docs').insert([{
      items: requestData.items,
      order_id: requestData.order_id,
      task_id: requestData.task_id,
      status: targetWH === 'production' && !sourceWH ? 'shipped' : 'ordered',
      target_warehouse: targetWH,
      source_warehouse: sourceWH,
      created_at: new Date().toISOString()
    }])

    if (recError) return { error: recError }

    // 4. Оновлюємо статус запиту на "Замовлено" (ordered)
    // Це залишить запит видимим для обох складів як "в процесі"
    const { error } = await supabase.from('purchase_requests').update({ status: 'ordered' }).eq('id', requestId)
    if (!error) fetchData()
    return { error }
  }

  const createReceptionDoc = async (items, status = 'pending', orderId = null, taskId = null) => {
    const { data, error } = await supabase.from('reception_docs').insert([{
      items: items,
      status: status,
      order_id: orderId,
      task_id: taskId,
      created_at: new Date().toISOString()
    }]).select()
    if (!error) fetchData()
    return { data: (data && data.length > 0) ? data[0] : null, error }
  }

  const sendDocToWarehouse = async (docId) => {
    const { error } = await supabase.from('reception_docs').update({ status: 'shipped' }).eq('id', docId)
    if (!error) fetchData()
    return { error }
  }

  const confirmReception = async (docId) => {
    try {
      const doc = (receptionDocs || []).find(d => d.id === docId)
      if (!doc) return console.error('confirmReception: Doc not found', docId)

      const targetWarehouse = doc.target_warehouse || 'production'
      const sourceWarehouse = doc.source_warehouse || null

      let allSuccess = true
      for (const it of (doc.items || [])) {
        const qtyToAdd = Number(it.qty ?? it.missingAmount ?? it.quantity ?? it.needed ?? 0)
        if (!qtyToAdd || qtyToAdd <= 0) continue

        const itemName = it.name || it.reqDetails || it.details || ''
        const nomId = it.nomenclature_id || null

        // ШИКАЄМО В БД ДЛЯ НАДІЙНОСТІ
        let existing = null
        if (nomId) {
          const { data } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'raw').eq('warehouse', targetWarehouse).maybeSingle()
          existing = data
        }
        if (!existing && itemName) {
          const { data } = await supabase.from('inventory').select('*').eq('name', itemName).eq('type', 'raw').eq('warehouse', targetWarehouse).maybeSingle()
          existing = data
        }

        if (existing) {
          const { error: updErr } = await supabase.from('inventory').update({
            total_qty: (Number(existing.total_qty) || 0) + qtyToAdd,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
          if (updErr) { console.error('Reception Update Error:', updErr.message); allSuccess = false; }
          
          // DEDUCT FROM SOURCE if specified
          if (allSuccess && sourceWarehouse) {
            const { data: srcItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'raw').eq('warehouse', sourceWarehouse).maybeSingle()
            if (srcItem && (Number(srcItem.total_qty) >= qtyToAdd)) {
               await supabase.from('inventory').update({
                 total_qty: Number(srcItem.total_qty) - qtyToAdd
               }).eq('id', srcItem.id)
            }
          }
        } else {
          const nom = nomId ? nomenclatures.find(n => n.id === nomId) : null
          const { error: insErr } = await supabase.from('inventory').insert([{
            nomenclature_id: nomId,
            name: nom?.name || itemName || 'Прийнята позиція',
            total_qty: qtyToAdd,
            reserved_qty: 0,
            type: 'raw',
            warehouse: targetWarehouse,
            unit: nom?.unit || 'шт'
          }])
          if (insErr) { console.error('Reception Insert Error:', insErr.message); allSuccess = false; }
        }
      }

      if (allSuccess) {
        await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)
        
        // Mark specific purchase request as completed based on target warehouse routing
        if (doc.task_id || doc.order_id) {
          let destWhToComplete = ''
          if (targetWarehouse === 'production') destWhToComplete = 'procurement'
          if (targetWarehouse === 'operational') destWhToComplete = 'production'
          
          if (destWhToComplete) {
            let q = supabase.from('purchase_requests')
              .update({ status: 'completed' })
              .eq('destination_warehouse', destWhToComplete)
              
            if (doc.task_id) {
              q = q.eq('task_id', doc.task_id)
            } else {
              q = q.eq('order_id', doc.order_id)
            }
            await q
          }
        }
        
        await fetchData()
        alert('Прийомку успішно завершено! Склад оновлено.')
      } else {
        alert('Помилка при оновленні складу. Перевірте консоль (F12).')
      }
    } catch (err) {
      console.error('CRITICAL: confirmReception crash:', err)
      alert('Критична помилка прийомки. Подробиці в консолі.')
    }
  }

  const issueMaterials = async (requestId) => {
    const req = requests.find(r => r.id === requestId)
    if (!req) return
    let parsedName = ''
    try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) { }
    const invItem = inventory.find(i => i.id === req.inventory_id || (req.nomenclature_id && i.nomenclature_id === req.nomenclature_id) || (parsedName && normalize(i.name) === normalize(parsedName)))
    if (invItem) {
      await supabase.from('inventory').update({ reserved_qty: (Number(invItem.reserved_qty) || 0) + Number(req.quantity) }).eq('id', invItem.id)
      await supabase.from('material_requests').update({ status: 'issued', inventory_id: invItem.id }).eq('id', requestId)
    } else {
      await supabase.from('material_requests').update({ status: 'issued' }).eq('id', requestId)
    }
  }

  const receiveInventory = async (inventoryId, qty) => {
    const invItem = inventory.find(i => i.id === inventoryId)
    if (!invItem) return
    const { error } = await supabase.from('inventory').update({
      total_qty: (Number(invItem.total_qty) || 0) + Number(qty)
    }).eq('id', inventoryId)
    if (!error) fetchData()
    return { error }
  }

  const approveWarehouse = async (taskId) => {
    await supabase.from('tasks').update({ warehouse_conf: true }).eq('id', taskId)
    fetchData()
  }

  const approveEngineer = async (taskId) => {
    await supabase.from('tasks').update({ engineer_conf: true }).eq('id', taskId)
    fetchData()
  }

  const approveDirector = async (taskId) => {
    await supabase.from('tasks').update({ director_conf: true }).eq('id', taskId)
    fetchData()
  }

  const upsertNomenclature = async (nom) => {
    await supabase.from('nomenclatures').upsert([nom])
    fetchData()
  }

  const deleteNomenclature = async (id) => {
    await supabase.from('nomenclatures').delete().eq('id', id)
    fetchData()
  }
  const saveBOM = async (parentId, childId, qty) => {
    await supabase.from('bom_items').upsert([{
      parent_id: parentId, child_id: childId, quantity_per_parent: Number(qty)
    }], { onConflict: 'parent_id, child_id' })
    fetchData()
  }

  const removeBOM = async (bomId) => {
    await supabase.from('bom_items').delete().eq('id', bomId)
    fetchData()
  }

  const syncBOM = async (parentId, items) => {
    // 1. Видаляємо старі зв'язки
    await supabase.from('bom_items').delete().eq('parent_id', parentId)
    // 2. Вставляємо нові
    if (items.length > 0) {
      const toInsert = items.map(it => ({
        parent_id: parentId,
        child_id: it.child_id,
        quantity_per_parent: Number(it.qty)
      }))
      await supabase.from('bom_items').insert(toInsert)
    }
    fetchData()
  }

  const createWorkCard = async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, cardInfo, quantity, bufferQty, isRework = false) => {
    const { data: list } = await supabase.from('work_cards').insert([{
      task_id: taskId, order_id: orderId, nomenclature_id: nomenclatureId,
      operation: operation || 'Нова', machine, quantity: Number(quantity) || 0,
      estimated_time: Number(estimatedTime) || 0, status: 'new',
      is_rework: isRework,
      card_info: `${cardInfo || ''}${Number(bufferQty) > 0 ? ` [BZ:${bufferQty}]` : ''}${isRework ? ' [REDO]' : ''}`
    }]).select()
    const data = (list && list.length > 0) ? list[0] : null
    await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskId)
    fetchData()
    return data
  }

  const handoverTaskToShop2 = async (taskId) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (!task) return

      // 1. Завершуємо поточний наряд у Цеху №1
      await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)

      // --- АВТОМАТИЧНЕ СПИСАННЯ МАТЕРІАЛІВ (ШОП 1) ---
      try {
        const issuedReqs = (requests || []).filter(r => String(r.order_id) === String(task.order_id) && r.status === 'issued')
        if (issuedReqs.length > 0) {
          for (const req of issuedReqs) {
            const inv = (inventory || []).find(i => String(i.id) === String(req.inventory_id))
            if (inv) {
              const nextTotal = Math.max(0, (Number(inv.total_qty) || 0) - Number(req.quantity))
              const nextReserved = Math.max(0, (Number(inv.reserved_qty) || 0) - Number(req.quantity))
              await supabase.from('inventory').update({ total_qty: nextTotal, reserved_qty: nextReserved }).eq('id', inv.id)
              await supabase.from('material_requests').update({ status: 'completed' }).eq('id', req.id)
            }
          }
        }
      } catch (e) {
        console.error("Material deduction error:", e)
      }

      // --- ФІНАЛІЗАЦІЯ БЗ ТА СТВОРЕННЯ ДОКУМЕНТА НА ПЕРЕМІЩЕННЯ (ФАКТИЧНІ ЗАЛИШКИ) ---
      try {
        const { data: freshInventory } = await supabase.from('inventory').select('*')
        const currentInventory = freshInventory || inventory

        const snapshotPartsArr = Object.keys(task.plan_snapshot || {})
        const arrivals = []

        for (const nomId of snapshotPartsArr) {
          const nom = nomenclatures.find(n => String(n.id) === String(nomId))

          // Читаємо ФАКТИЧНІ залишки в свіжому inventory (те що реально накопичилось після прийомки)
          const s1Semi = currentInventory.find(i =>
            String(i.nomenclature_id) === String(nomId) && i.type === 'semi'
          )
          const s1WipBz = currentInventory.find(i =>
            String(i.nomenclature_id) === String(nomId) && i.type === 'wip_bz'
          )
          const s1Bz = currentInventory.find(i =>
            String(i.nomenclature_id) === String(nomId) && i.type === 'bz'
          )

          const semiToMove = Number(s1Semi?.total_qty) || 0
          const bzToMove = (Number(s1WipBz?.total_qty) || 0) + (Number(s1Bz?.total_qty) || 0)

          if (semiToMove <= 0 && bzToMove <= 0) continue

          arrivals.push({
            id: nomId,
            name: nom?.name || 'Деталь',
            semi: semiToMove,
            bz: bzToMove
          })

          // 1. ПЕРЕМІЩЕННЯ SEMI (НФ → Цех №2)
          if (semiToMove > 0 && s1Semi) {
            // Обнуляємо в Цеху 1
            await supabase.from('inventory').update({ total_qty: 0, reserved_qty: 0 }).eq('id', s1Semi.id)
            // Збільшуємо в Цеху 2
            const s2Semi = currentInventory.find(i =>
              String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2'
            )
            if (s2Semi) {
              await supabase.from('inventory')
                .update({ total_qty: (Number(s2Semi.total_qty) || 0) + semiToMove })
                .eq('id', s2Semi.id)
            } else {
              await supabase.from('inventory').insert([{
                nomenclature_id: nomId,
                name: nom?.name || 'Деталь',
                total_qty: semiToMove,
                reserved_qty: 0,
                type: 'semi_shop2',
                unit: nom?.unit || 'шт'
              }])
            }
          }

          // 2. ПЕРЕМІЩЕННЯ WIP_BZ / BZ (БЗ → Цех №2)
          if (bzToMove > 0) {
            // Обнуляємо в Цеху 1
            if (s1WipBz) await supabase.from('inventory').update({ total_qty: 0, reserved_qty: 0 }).eq('id', s1WipBz.id)
            if (s1Bz) await supabase.from('inventory').update({ total_qty: 0, reserved_qty: 0 }).eq('id', s1Bz.id)

            // Збільшуємо в Цеху 2
            const s2Bz = currentInventory.find(i =>
              String(i.nomenclature_id) === String(nomId) && i.type === 'bz_shop2'
            )
            if (s2Bz) {
              await supabase.from('inventory')
                .update({ total_qty: (Number(s2Bz.total_qty) || 0) + bzToMove })
                .eq('id', s2Bz.id)
            } else {
              await supabase.from('inventory').insert([{
                nomenclature_id: nomId,
                name: nom?.name || 'Деталь',
                total_qty: bzToMove,
                reserved_qty: 0,
                type: 'bz_shop2',
                unit: nom?.unit || 'шт'
              }])
            }
          }
        }

        // Створюємо офіційний документ на переміщення
        const { data: moveDoc } = await supabase.from('reception_docs').insert([{
          doc_num: `T-S1-S2-${Date.now().toString().slice(-6)}`,
          type: 'internal_transfer',
          status: 'completed',
          order_id: task.order_id,
          details: JSON.stringify(arrivals)
        }]).select().single()

        // 2. Створюємо новий наряд для Цеху №2 з замороженими даними
        await supabase.from('tasks').insert([{
          order_id: task.order_id,
          step: 'Пресування',
          status: 'waiting',
          estimated_time: task.estimated_time || 0,
          engineer_conf: true,
          warehouse_conf: true,
          director_conf: true,
          batch_index: task.batch_index || null,
          plan_snapshot: {
            ...task.plan_snapshot,
            arrival_doc_id: moveDoc?.id || null,
            arrivals: arrivals // ЗАМОРОЖЕНІ ДАНІ
          }
        }])
      } catch (e) {
        console.error("BZ/Transfer error:", e)
      }

      if (window.fetchData) window.fetchData() // На всяк випадок
      fetchData()
    } catch (err) {
      console.error('Handover error:', err)
      throw err
    }
  }

  // Скасувати передачу в Цех №2 (для тесту) — відкат inventory + видалити наряд Цеху 2
  const cancelHandoverToShop2 = async (taskId) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (!task) return

      // Знаходимо наряд Цеху 2 для того ж замовлення
      const shop2Task = tasks.find(t =>
        String(t.order_id) === String(task.order_id) &&
        t.step === 'Пресування' &&
        String(t.id) !== String(task.id)
      )

      const snapshotPartsArr = Object.keys(task.plan_snapshot || {})

      const { data: freshInventory } = await supabase.from('inventory').select('*')
      const currentInventory = freshInventory || inventory

      for (const nomId of snapshotPartsArr) {
        const nom = nomenclatures.find(n => String(n.id) === String(nomId))

        // semi_shop2 → semi
        const s2Semi = currentInventory.find(i =>
          String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2'
        )
        if (s2Semi && Number(s2Semi.total_qty) > 0) {
          const qty = Number(s2Semi.total_qty)
          await supabase.from('inventory').update({ total_qty: 0 }).eq('id', s2Semi.id)
          const s1Semi = currentInventory.find(i =>
            String(i.nomenclature_id) === String(nomId) && i.type === 'semi'
          )
          if (s1Semi) {
            await supabase.from('inventory').update({ total_qty: (Number(s1Semi.total_qty) || 0) + qty }).eq('id', s1Semi.id)
          } else {
            await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: qty, reserved_qty: 0, type: 'semi', unit: nom?.unit || 'шт' }])
          }
        }

        // bz_shop2 → wip_bz
        const s2Bz = currentInventory.find(i =>
          String(i.nomenclature_id) === String(nomId) && i.type === 'bz_shop2'
        )
        if (s2Bz && Number(s2Bz.total_qty) > 0) {
          const qty = Number(s2Bz.total_qty)
          await supabase.from('inventory').update({ total_qty: 0 }).eq('id', s2Bz.id)
          const s1Bz = currentInventory.find(i =>
            String(i.nomenclature_id) === String(nomId) && i.type === 'wip_bz'
          )
          if (s1Bz) {
            await supabase.from('inventory').update({ total_qty: (Number(s1Bz.total_qty) || 0) + qty }).eq('id', s1Bz.id)
          } else {
            await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: qty, reserved_qty: 0, type: 'wip_bz', unit: nom?.unit || 'шт' }])
          }
        }
      }

      // Видаляємо наряд Цеху 2
      if (shop2Task) {
        await supabase.from('tasks').delete().eq('id', shop2Task.id)
      }

      // Відновлюємо наряд Цеху 1
      await supabase.from('tasks').update({ status: 'in-progress', completed_at: null }).eq('id', taskId)

      fetchData()
    } catch (err) {
      console.error('Cancel handover error:', err)
      throw err
    }
  }

  const completeTaskByMaster = async (taskId) => {
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    fetchData()
  }

  const completeTaskShop2 = async (taskId) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      const order = orders.find(o => String(o.id) === String(task?.order_id))
      if (!task || !order) return

      // 1. Mark task as completed
      await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)

      // 2. Convert WIP BZ and Shop 2 BZ to main Warehouse BZ
      const itemNoms = (order.order_items || []).map(it => it.nomenclature_id)
      const childIds = bomItems.filter(b => itemNoms.map(String).includes(String(b.parent_id))).map(b => b.child_id)
      const allRelatedNoms = Array.from(new Set([...itemNoms, ...childIds]))

      for (const nomId of allRelatedNoms) {
        // Collect all types of buffer from Shop 2
        const shop2Stock = (inventory || []).filter(i => 
          String(i.nomenclature_id) === String(nomId) && 
          (i.type === 'wip_bz' || i.type === 'bz_shop2')
        )
        
        let totalToMove = 0
        for (const s of shop2Stock) {
          totalToMove += (Number(s.total_qty) || 0)
        }
        
        if (totalToMove > 0) {
          const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'bz').maybeSingle()
          
          if (bzItem) {
            await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + totalToMove }).eq('id', bzItem.id)
          } else {
            const nom = nomenclatures.find(n => n.id === nomId)
            await supabase.from('inventory').insert([{ 
              nomenclature_id: nomId, 
              name: nom?.name || 'BZ Item', 
              unit: nom?.unit || 'шт', 
              total_qty: totalToMove, 
              reserved_qty: 0, 
              type: 'bz' 
            }])
          }
          // Clean up shop 2 buffers
          for (const s of shop2Stock) {
            if (s.type === 'bz_shop2') {
              await supabase.from('inventory').update({ total_qty: 0 }).eq('id', s.id)
            } else {
              await supabase.from('inventory').delete().eq('id', s.id)
            }
          }
        }
      }

      fetchData()
    } catch (err) {
      console.error('Error completing Shop 2 task:', err)
      throw err
    }
  }

  const fixInventoryTypes = async () => {
    const { error } = await supabase.from('inventory').update({ type: 'wip_bz' }).eq('type', 'bz')
    if (!error) fetchData()
    return { error }
  }

  const startWorkCard = async (taskId, cardId, operatorName, metadata = {}) => {
    const updateData = { 
      status: 'in-progress', 
      started_at: new Date().toISOString(), 
      operator_name: operatorName 
    }
    
    // Якщо передано назву етапу (метадані), оновлюємо операцію
    if (metadata.stage_name) {
      updateData.operation = metadata.stage_name
    }

    // Якщо передано ID верстата, зберігаємо його для суворої прив'язки
    if (metadata.machine_id) {
      updateData.machine_id = metadata.machine_id
    }
    
    // ПЕРЕКОНУЄМОСЯ, що назва матини теж зберігається (для історії)
    if (metadata.machine_name) {
      updateData.machine = metadata.machine_name
    }
    
    await supabase.from('work_cards').update(updateData).eq('id', cardId)
    fetchData()
  }

  const completeWorkCard = async (taskId, cardId, operatorName) => {
    await supabase.from('work_cards').update({ 
      status: 'waiting-buffer', 
      operator_name: operatorName,
      completed_at: new Date().toISOString()
    }).eq('id', cardId)
    fetchData()
  }

  const confirmBuffer = async (cardId, scrapData = {}) => {
    const card = workCards.find(c => c.id === cardId)
    if (!card) return

    // scrapData може бути числом (з ForemanWorkplace) або об'єктом (з Shop1Terminal)
    const totalScrap = typeof scrapData === 'number'
      ? scrapData
      : Object.values(scrapData).reduce((acc, c) => acc + Number(c), 0)

    const qtyCompleted = Math.max(0, (card.quantity || 0) - totalScrap)
    const isRework = (card.card_info || '').includes('[REWORK]')

    // Ланцюжки виробництва
    const currentOp = (card.operation || '').trim()
    const isShop1 = (card.card_info || '').includes('[SHOP:1]')
    const isShop2 = (card.card_info || '').includes('[ЦЕХ №2]')
    const chain = isShop1 ? CHAIN_SHOP1 : CHAIN_GENERAL

    const idx = chain.findIndex(s =>
      s.toLowerCase() === currentOp.toLowerCase()
    )
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null

    let cardUpdate = {}
    
    // Якщо це переробка - завершуємо наряд і відправляємо в БЗ
    if (isRework) {
      cardUpdate = { status: 'completed', quantity: qtyCompleted }
    } else if (isShop2) {
      cardUpdate = { status: 'at-buffer', quantity: qtyCompleted }
    } else {
      cardUpdate = nextStage
        ? { status: 'new', operation: nextStage, quantity: qtyCompleted, started_at: null, operator_name: null, machine: null, machine_id: null }
        : { status: 'completed', quantity: qtyCompleted, machine: null, machine_id: null }
    }

    const machineTag = `[MACHINE_ID:${card.machine_id || ''}] [MACHINE_NAME:${card.machine || ''}]`;
    const historyCardInfo = (machineTag + ' ' + (card.card_info || '')).trim();

    await Promise.all([
      supabase.from('work_card_history').insert([{
        card_id: cardId,
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation || 'Розкрій',
        operator_name: card.operator_name || 'Не вказано',
        card_info: historyCardInfo,
        qty_at_start: card.quantity,
        qty_completed: qtyCompleted,
        scrap_qty: totalScrap,
        started_at: card.started_at,
        completed_at: new Date().toISOString()
      }]),
      supabase.from('work_cards').update(cardUpdate).eq('id', cardId)
    ])

    // Оновлюємо інвентар
    if (isRework) {
      // Додаємо назад в БЗ
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      if (nom && qtyCompleted > 0) {
        const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'bz').maybeSingle()
        if (bzItem) {
          await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + qtyCompleted }).eq('id', bzItem.id)
        } else {
          await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: qtyCompleted, reserved_qty: 0, type: 'bz' }])
        }
      }
    } else if (!isShop2) {
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      if (nom) {
        // REQ — фіксована потреба замовника з card_info (не змінюється через скрап)
        // Все що вироблено ПОНАД req (з урахуванням скрапу всіх попередніх етапів) → реальний БЗ
        // Визначаємо потребу замовлення (пріоритет)
        let totalNeed = Number(card.card_info?.match(/\[NEED:(\d+)\]/)?.[1])
        const plannedReq = Number(card.card_info?.match(/\[REQ:(\d+)\]/)?.[1])
        
        // РОЗШИРЕНИЙ ФОЛБЕК: Якщо тегів немає (стара картка), шукаємо глобальну потребу в замовленні
        if (!totalNeed && card.order_id) {
          const order = orders.find(o => String(o.id) === String(card.order_id))
          if (order) {
            const directItem = order.order_items?.find(it => String(it.nomenclature_id) === String(card.nomenclature_id))
            if (directItem) {
              totalNeed = Number(directItem.quantity) || 0
            } else {
              // Перевірка BOM (якщо це деталь)
              order.order_items?.forEach(oi => {
                const bom = bomItems.filter(b => b.parent_id === oi.nomenclature_id)
                const match = bom.find(b => b.child_id === card.nomenclature_id)
                if (match) {
                  totalNeed += (Number(oi.quantity) || 0) * (Number(match.quantity_per_parent) || 1)
                }
              })
            }
          }
        }

        // Пріоритет: NEED -> REQ -> FALLBACK (quantity - BZ)
        const effectiveReq = totalNeed || plannedReq ||
          Math.max(0, (Number(card.quantity) - (Number(card.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0)))

        const netQtyForOrder = Math.min(qtyCompleted, effectiveReq)
        const actualBuffer = Math.max(0, qtyCompleted - netQtyForOrder)

        // 1. Оновлюємо semi (чиста кількість для замовлення)
        if (netQtyForOrder > 0) {
          const { data: semi } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'semi').maybeSingle()
          if (semi) {
            await supabase.from('inventory').update({ total_qty: (Number(semi.total_qty) || 0) + netQtyForOrder }).eq('id', semi.id)
          } else {
            await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: netQtyForOrder, reserved_qty: 0, type: 'semi' }])
          }
        }

        // 2. Оновлюємо wip_bz (реальний залишок понад потребу, після врахування всього скрапу)
        if (actualBuffer > 0) {
          const { data: wip } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'wip_bz').maybeSingle()
          if (wip) {
            await supabase.from('inventory').update({ total_qty: (Number(wip.total_qty) || 0) + actualBuffer }).eq('id', wip.id)
          } else {
            await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBuffer, reserved_qty: 0, type: 'wip_bz' }])
          }
        }
      }
    }
    fetchData()
  } // closes confirmBuffer

  const handoverToSGP = async (cardId) => {
    try {
      const card = workCards.find(c => c.id === cardId)
      if (!card) return

      const nomId = card.nomenclature_id
       const totalQty = Number(card.quantity) || 0
       const bzTotal = Number(card.buffer_qty) || Number(card.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
       
       // Визначаємо початкову потребу (те що було для замовлення)
       const needQty = Number(card.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, totalQty - bzTotal))
       
       // Пріоритет - Готова продукція (спочатку закриваємо потребу)
       const isRework = card.card_info?.includes('[REWORK]')
       const finishedQty = isRework ? 0 : Math.min(totalQty, needQty)
       const actualBzQty = isRework ? totalQty : Math.max(0, totalQty - finishedQty)

       // 1. Списуємо з Цеху №2 ПРЕЦИЗІЙНО (рівно стільки, скільки було в наряді)
      const nomName = card.card_info?.split('\n')[0]?.trim()
      
      const subFromS2 = async (nid, nname, itype, iqty) => {
        if (!iqty || iqty <= 0) return
        let remaining = iqty

        // А. Списуємо за ID
        if (nid) {
          const { data: rows } = await supabase.from('inventory').select('*').eq('nomenclature_id', nid).eq('type', itype)
          for (const r of (rows || [])) {
            const current = Number(r.total_qty) || 0
            const take = Math.min(current, remaining)
            if (take > 0) {
              await supabase.from('inventory').update({ total_qty: current - take }).eq('id', r.id)
              remaining -= take
            }
            if (remaining <= 0) break
          }
        }

        // Б. Пошук за назвою (Евристика), якщо все ще залишилось що списувати
        if (remaining > 0 && nname) {
          const { data: rows } = await supabase.from('inventory').select('*').eq('name', nname).eq('type', itype)
          for (const r of (rows || [])) {
            const current = Number(r.total_qty) || 0
            const take = Math.min(current, remaining)
            if (take > 0) {
              await supabase.from('inventory').update({ total_qty: current - take }).eq('id', r.id)
              remaining -= take
            }
            if (remaining <= 0) break
          }
        }
      }

      await subFromS2(nomId, nomName, 'semi_shop2', needQty)
      await subFromS2(nomId, nomName, 'bz_shop2', bzTotal)

      // 2. Додаємо на склад готової продукції (finished)
      if (finishedQty > 0) {
        const { data: finishedItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'finished').maybeSingle()
        if (finishedItem) {
          await supabase.from('inventory').update({ total_qty: (Number(finishedItem.total_qty) || 0) + finishedQty }).eq('id', finishedItem.id)
        } else {
          const nom = nomenclatures.find(n => n.id === nomId)
          await supabase.from('inventory').insert([{ 
            nomenclature_id: nomId, 
            name: nom?.name || 'Готова продукція', 
            unit: nom?.unit || 'шт', 
            total_qty: finishedQty, 
            reserved_qty: 0, 
            type: 'finished' 
          }])
        }
      }

      // 3. Додаємо залишок на склад БЗ (bz)
      if (actualBzQty > 0) {
        const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'bz').maybeSingle()
        if (bzItem) {
          await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + actualBzQty }).eq('id', bzItem.id)
        } else {
          const nom = nomenclatures.find(n => n.id === nomId)
          await supabase.from('inventory').insert([{ 
            nomenclature_id: nomId, 
            name: nom?.name || 'Запас БЗ', 
            unit: nom?.unit || 'шт', 
            total_qty: actualBzQty, 
            reserved_qty: 0, 
            type: 'bz' 
          }])
        }
      }

      // 4. Відмічаємо картку як завершену і передану на СГП
      await supabase.from('work_cards').update({ 
        status: 'completed', 
        operation: 'Паквання/СГП' 
      }).eq('id', cardId)

      fetchData()
      alert("Деталі успішно передані на Склад Готової Продукції!")
    } catch (e) {
      console.error("Помилка передачі на СГП:", e)
      alert("Помилка передачі на СГП: " + e.message)
    }
  }

  const reserveBZForTask = async (taskId, orderId, nomenclatureId, qty) => {
    try {
      const { data: bz } = await supabase
        .from('inventory')
        .select('*')
        .eq('nomenclature_id', nomenclatureId)
        .eq('type', 'bz')
        .maybeSingle()

      if (!bz) throw new Error("Товар не знайдено на складі БЗ")

      const nextReserved = (Number(bz.reserved_qty) || 0) + Number(qty)
      await supabase
        .from('inventory')
        .update({ reserved_qty: nextReserved })
        .eq('id', bz.id)

      await supabase.from('work_cards').insert([{
        task_id: taskId,
        order_id: orderId,
        nomenclature_id: nomenclatureId,
        quantity: qty,
        status: 'completed',
        operation: 'Склад БЗ',
        card_info: '[ЗІ СКЛАДУ БЗ]',
        buffer_qty: 0
      }])

      // 1. Записуємо в history одразу, щоб відображалось як "Вироблено"
      await supabase.from('work_card_history').insert([{
        task_id: taskId,
        nomenclature_id: nomenclatureId,
        stage_name: 'Склад БЗ',
        operator_name: 'Система (БРОНЬ)',
        qty_at_start: qty,
        qty_completed: qty,
        scrap_qty: 0,
        completed_at: new Date().toISOString()
      }])

      fetchData()
      return { success: true }
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  const submitPickingRequest = async (orderId, requiredItems) => {
    const order = orders.find(o => o.id === orderId)
    const requestsToInsert = []

    for (const item of requiredItems) {
      const nomId = item.nomId || item.nomenclature_id
      // Шукаємо на залишках (Готова продукція або Склад Оперативний/Метизи)
      const matches = (inventory || []).filter(inv => String(inv.nomenclature_id) === String(nomId) && (inv.type === 'finished' || inv.type === 'raw'))
      const totalAvailable = matches.reduce((acc, m) => acc + (Number(m.total_qty) || 0) - (Number(m.reserved_qty) || 0), 0)

      let neededQty = Number(item.qty) || 0

      // 1. Якщо щось є в наявності - видаємо (резервуємо)
      if (totalAvailable > 0) {
        const issuedQty = Math.min(neededQty, totalAvailable)
        const firstMatch = matches.find(m => (Number(m.total_qty) || 0) > (Number(m.reserved_qty) || 0))
        
        if (firstMatch) {
          requestsToInsert.push({
            order_id: orderId,
            nomenclature_id: nomId,
            quantity: issuedQty,
            status: 'issued', // Автоматично видано зі складу
            inventory_id: firstMatch.id,
            details: `ВИДАНО З СКЛАДУ (${order?.order_num || ''}): ${item.name} — ${issuedQty} шт.`
          })

          // Оновлюємо резерв у базі
          await supabase.from('inventory').update({ 
            reserved_qty: (Number(firstMatch.reserved_qty) || 0) + issuedQty 
          }).eq('id', firstMatch.id)

          neededQty -= issuedQty
        }
      }

      // 2. Якщо все ще потрібно (або нічого не було) - створюємо запит на постачання
      if (neededQty > 0) {
        requestsToInsert.push({
          order_id: orderId,
          nomenclature_id: nomId,
          quantity: neededQty,
          status: 'pending', // Чекає на постачання
          inventory_id: null,
          details: `ЗАПИТ НА ПОСТАЧАННЯ (${order?.order_num || ''}): ${item.name} — ${neededQty} шт.`
        })
      }
    }

    if (requestsToInsert.length > 0) {
      const { error } = await supabase.from('material_requests').insert(requestsToInsert)
      if (error) console.error("Picking Request Error:", error)
      fetchData()
    }
  }

  const completePackaging = async (orderId) => {
    // 1. Mark order as packaged
    await supabase.from('orders').update({ status: 'packaged' }).eq('id', orderId)
    fetchData()
  }

  // --- MANAGEMENT TASKS (KANBAN) ---
  const addManagementTask = async (taskPayload) => {
    const { data, error } = await supabase.from('management_tasks').insert([{
      ...taskPayload,
      created_by: currentUser?.login || 'system',
      created_at: new Date().toISOString()
    }]).select()
    if (!error) fetchData()
    return { data: data?.[0], error }
  }

  const updateManagementTask = async (taskId, updates) => {
    const { error } = await supabase.from('management_tasks').update(updates).eq('id', taskId)
    if (!error) fetchData()
    return { error }
  }

  const deleteManagementTask = async (taskId) => {
    const { error } = await supabase.from('management_tasks').delete().eq('id', taskId)
    if (!error) setManagementTasks(prev => prev.filter(t => t.id !== taskId))
    return { error }
  }

  const addMachine = async (machineData) => {
    const { data, error } = await supabase.from('machines').insert([machineData]).select()
    if (!error) fetchData()
    return { data: data?.[0], error }
  }

  const updateMachine = async (id, updates) => {
    const { error } = await supabase.from('machines').update(updates).eq('id', id)
    if (!error) fetchData()
    return { error }
  }

  const deleteMachine = async (id) => {
    const { error } = await supabase.from('machines').delete().eq('id', id)
    if (!error) setMachines(prev => prev.filter(m => m.id !== id))
    return { error }
  }

  return (
    <MESContext.Provider value={{
      orders, customers, inventory, tasks, managementTasks, requests, nomenclatures, bomItems,
      receptionDocs, purchaseRequests, workCards, workCardHistory, machines,
      systemUsers, currentUser, loading, sessionLoading, hasMoreOrders,
      operators, productionStages,
      accessLogs, fortnetUrl, updateFortnetUrl,
      login, logout, upsertUser, deleteUser,
      fetchOrders, fetchData,
      createNaryad, issueMaterials, approveWarehouse, approveEngineer, approveDirector,
      upsertNomenclature, deleteNomenclature, saveBOM, removeBOM,
      createWorkCard, startWorkCard, completeWorkCard, confirmBuffer, completeTaskByMaster, handoverTaskToShop2, cancelHandoverToShop2, completeTaskShop2, fixInventoryTypes, handoverToSGP,
      searchCustomers, addOrder, reserveBZForTask,
      syncBOM,
      createPurchaseRequest, updatePurchaseRequestStatus, convertRequestToOrder,
      createReceptionDoc, sendDocToWarehouse, confirmReception,
      confirmReceptionDoc: confirmReception,
      receiveInventory, submitPickingRequest, completePackaging,
      addManagementTask, updateManagementTask, deleteManagementTask,
      addMachine, updateMachine, deleteMachine,
      disposeScrapItem: async (invId, qty) => {
        const item = inventory.find(i => i.id === invId)
        if (!item) return
        const nextQty = (Number(item.total_qty) || 0) - Number(qty)
        
        if (nextQty > 0) {
          await supabase.from('inventory').update({ total_qty: nextQty, updated_at: new Date().toISOString() }).eq('id', invId)
        } else {
          await supabase.from('inventory').delete().eq('id', invId)
        }

        // Create Disposal Record
        await supabase.from('reception_docs').insert([{
          doc_num: `DIS-${Date.now().toString().slice(-6)}`,
          type: 'scrap_disposal',
          status: 'completed',
          items: JSON.stringify([{
            name: item.name,
            qty: qty,
            nomenclature_id: item.nomenclature_id,
            disposed_at: new Date().toISOString()
          }])
        }])
        
        fetchData()
      },
      createReworkNaryad: async (invId, qty, stage) => {
        const scrapItem = inventory.find(i => i.id === invId)
        if (!scrapItem) return
        
        const nomId = scrapItem.nomenclature_id
        const nom = nomenclatures.find(n => n.id === nomId)

        // 0. Generate Unique Rework Order (ВБxxxx)
        const vbOrders = (orders || []).filter(o => o.order_num && o.order_num.startsWith('ВБ'))
        const maxNum = vbOrders.reduce((max, o) => {
          const numPart = o.order_num.replace('ВБ', '')
          const num = parseInt(numPart)
          return isNaN(num) ? max : Math.max(max, num)
        }, 0)
        const nextOrderNum = `ВБ${String(maxNum + 1).padStart(4, '0')}`

        const { data: reworkOrder, error: orderErr } = await supabase.from('orders').insert([{
          order_num: nextOrderNum,
          customer: 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ',
          status: 'in-progress'
        }]).select().single()

        if (orderErr) {
          console.error("Error creating rework order:", orderErr)
          return
        }
        
        const orderId = reworkOrder?.id || null
        
        // 1. Create Standalone Task with proper snapshot for UI
        const plan_snapshot = {
          [nomId]: {
            id: nomId,
            name: nom?.name || scrapItem.name,
            code: nom?.nomenclature_code || '—',
            need: qty,
            stock: 0,
            plan: qty,
            is_rework: true
          }
        }

        const { data: taskData } = await supabase.from('tasks').insert([{
          order_id: orderId,
          step: stage,
          status: 'waiting',
          machine_name: 'Доопрацювання',
          estimated_time: 0,
          engineer_conf: true,
          warehouse_conf: true,
          director_conf: true,
          plan_snapshot: plan_snapshot,
          planned_sets: 0
        }]).select()
        
        const newTask = taskData?.[0]

        // 2. Create WIP Card for Rework
        if (newTask) {
          await supabase.from('work_cards').insert([{
            task_id: newTask.id,
            order_id: orderId,
            nomenclature_id: nomId,
            quantity: qty,
            status: 'pending',
            operation: stage,
            card_info: `[REWORK] ${nom?.name || scrapItem.name} — ДООПРАЦЮВАННЯ БРАКУ`,
            buffer_qty: 0
          }])
        }

        // 3. Deduct from specific scrap inventory item
        const nextQty = (Number(scrapItem.total_qty) || 0) - Number(qty)
        if (nextQty > 0) {
          await supabase.from('inventory').update({ total_qty: nextQty, updated_at: new Date().toISOString() }).eq('id', scrapItem.id)
        } else {
          await supabase.from('inventory').delete().eq('id', scrapItem.id)
        }

        fetchData()
      },
      totalProduced: productionData.totalProduced,
      totalScrapCount: productionData.totalScrap
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
