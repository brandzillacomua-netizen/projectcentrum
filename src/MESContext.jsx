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
  const [requests, setRequests] = useState(cache.requests || [])
  const [nomenclatures, setNomenclatures] = useState(cache.nomenclatures || [])
  const [bomItems, setBomItems] = useState(cache.bomItems || [])
  const [receptionDocs, setReceptionDocs] = useState(cache.receptionDocs || [])
  const [purchaseRequests, setPurchaseRequests] = useState(cache.purchaseRequests || [])
  const [workCards, setWorkCards] = useState(cache.workCards || [])
  const [workCardHistory, setWorkCardHistory] = useState(cache.workCardHistory || [])
  const [machines, setMachines] = useState(cache.machines || [])
  const [systemUsers, setSystemUsers] = useState(cache.systemUsers || [])
  const [currentUser, setCurrentUser] = useState(cache.currentUser || null)
  const [loading, setLoading] = useState(false)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const PAGE_SIZE = 20

  const operators = ["Олексій", "Дмитро", "Сергій", "Андрій", "Микола"]
  const productionStages = ["Різка", "Галтовка", "Пресування", "Фарбування", "Паквання"]

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't')
    .replace(/[аa]/g, 'a')
    .replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o')
    .replace(/[рp]/g, 'p')
    .replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x')
    .replace(/\s/g, '')

  const fetchOrders = async (page = 0, append = false) => {
    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .range(start, end)
    if (error) return
    if (append) setOrders(prev => [...prev, ...data])
    else setOrders(data)
    setHasMoreOrders(data.length === PAGE_SIZE)
  }

  const fetchData = async () => {
    if (orders.length === 0) setLoading(true)
    try {
      await fetchOrders(0)
      const { data: c } = await supabase.from('customers').select('*').limit(10).order('name')
      const { data: i } = await supabase.from('inventory').select('*')
      const { data: t } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
      const { data: r } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false })
      const { data: n } = await supabase.from('nomenclatures').select('*')
      const { data: b } = await supabase.from('bom_items').select('*')
      const { data: rec } = await supabase.from('reception_docs').select('*').order('created_at', { ascending: false })
      const { data: pr } = await supabase.from('purchase_requests').select('*').order('created_at', { ascending: false })
      const { data: wc } = await supabase.from('work_cards').select('*').order('created_at', { ascending: true })
      const { data: mc } = await supabase.from('machines').select('*').order('name')
      const { data: su } = await supabase.from('system_users').select('*').order('login')

      if (c) setCustomers(c)
      if (i) setInventory(i)
      if (t) setTasks(t)
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
      orders, customers, inventory, tasks, requests, nomenclatures,
      bomItems, receptionDocs, purchaseRequests, workCards, workCardHistory, machines, systemUsers, currentUser
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache))
  }, [orders, customers, inventory, tasks, requests, nomenclatures, bomItems, receptionDocs, purchaseRequests, workCards, workCardHistory, machines, systemUsers, currentUser])

  useEffect(() => {
    fetchData()
    const sub = supabase.channel('mes-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

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
      return { success: true, user: userWithToken };
    }

    return { success: false, error: 'Невірний логін або пароль' };
  }

  const logout = () => {
    setCurrentUser(null)
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
  const createNaryad = async (orderId, machineName) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) return
      let totalMin = 0
      const materialSummary = {}
      const bzStockDeductions = []

      order.order_items?.forEach(item => {
        const parts = bomItems.filter(b => b.parent_id === item.nomenclature_id)
        const displayParts = parts.length > 0 ? parts.map(b => ({
          nom: nomenclatures.find(n => n.id === b.child_id),
          qtyPer: b.quantity_per_parent
        })) : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), qtyPer: 1 }]

        displayParts.forEach(part => {
          if (!part.nom) return
          const totalNeeded = (Number(item.quantity) || 0) * (Number(part.qtyPer) || 1)
          
          // Use bz_qty (Safety Buffer) for stock reduction as per user requirement
          const invItem = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'semi')
          const inStockQty = Number(invItem?.bz_qty) || 0
          
          const usedFromBZ = Math.min(totalNeeded, inStockQty)
          const totalToProduce = Math.max(0, totalNeeded - inStockQty)

          if (usedFromBZ > 0 && invItem) {
            bzStockDeductions.push({ id: invItem.id, next_bz: inStockQty - usedFromBZ })
          }

          if (totalToProduce <= 0) return
          
          const sheets = Math.ceil(totalToProduce / (part.nom.units_per_sheet || 1))
          const matKey = part.nom.material_type || part.nom.name || 'Інше'
          
          if (!materialSummary[matKey]) {
            const rawNom = nomenclatures.find(n => n.type === 'raw' && (normalize(n.material_type) === normalize(matKey) || normalize(n.name) === normalize(matKey)))
            const rawInv = inventory.find(i => rawNom ? (String(i.nomenclature_id) === String(rawNom.id)) : (String(i.nomenclature_id) === String(part.nom.id)) && i.type === 'raw')
            materialSummary[matKey] = { matName: matKey, sheets: 0, components: [], inventory_id: rawInv?.id || null }
          }
          materialSummary[matKey].sheets += sheets
          materialSummary[matKey].components.push(`${part.nom.name}: ${totalToProduce}шт`)
          totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
        })
      })
      
      // --- EXECUTE BZ DEDUCTIONS IMMEDIATELY ---
      for (const upd of bzStockDeductions) {
        await supabase.from('inventory').update({ bz_qty: upd.next_bz }).eq('id', upd.id)
      }
      
      await supabase.from('orders').update({ status: 'in-progress' }).eq('id', orderId)
      const { data: taskData, error: taskError } = await supabase.from('tasks').insert([{
        order_id: orderId, step: 'Лазерна різка', status: 'waiting', machine_name: machineName || 'Не вказано',
        estimated_time: Math.round(totalMin), engineer_conf: false, warehouse_conf: false, director_conf: false
      }]).select()
      const tData = (taskData && taskData.length > 0) ? taskData[0] : null
      if (taskError) throw taskError
      const allMaterials = Object.values(materialSummary)
      const requestsToInsert = allMaterials.map(info => ({
        order_id: orderId, quantity: Number(info.sheets) || 0, status: 'pending', inventory_id: info.inventory_id,
        details: `Сировина для ${order.order_num}: ${info.matName} — ${info.sheets} л. (Для: ${info.components.join(', ')})`
      }))
      const totalSheetsOverall = allMaterials.reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
      if (totalSheetsOverall > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0).forEach(cons => {
          const neededQty = Math.ceil(totalSheetsOverall * Number(cons.consumption_per_sheet))
          const invItem = inventory.find(i => i.nomenclature_id === cons.id)
          requestsToInsert.push({
            order_id: orderId, quantity: neededQty, status: 'pending', inventory_id: invItem?.id || null,
            details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${order.order_num}: ${cons.name} — ${neededQty} од.`
          })
        })
      }
      if (requestsToInsert.length > 0) await supabase.from('material_requests').insert(requestsToInsert)
      fetchData()
    } catch (err) { console.error('Error creating naryad:', err.message) }
  }

  const createPurchaseRequest = async (orderId, orderNum, items) => {
    const { error } = await supabase.from('purchase_requests').insert([{
      order_id: orderId,
      order_num: orderNum,
      items: items, // Assuming items is jsonb
      status: 'pending'
    }])
    if (!error) fetchData()
    return { error }
  }

  const updatePurchaseRequestStatus = async (id, status) => {
    const { error } = await supabase.from('purchase_requests').update({ status }).eq('id', id)
    if (!error) fetchData()
    return { error }
  }

  const convertRequestToOrder = async (requestId) => {
    // 1. Отримуємо дані запиту
    const { data: requestData } = await supabase.from('purchase_requests').select('*').eq('id', requestId).single()
    if (!requestData) return { error: 'Запит не знайдено' }

    // 2. Створюємо документ прийомки (з order_id для відстеження!)
    const { error: recError } = await supabase.from('reception_docs').insert([{
      items: requestData.items,
      order_id: requestData.order_id,
      status: 'ordered',
      created_at: new Date().toISOString()
    }])

    if (recError) return { error: recError }

    // 3. Оновлюємо статус запиту на "Замовлено"
    const { error } = await supabase.from('purchase_requests').update({ status: 'ordered' }).eq('id', requestId)
    if (!error) fetchData()
    return { error }
  }

  const createReceptionDoc = async (items, status = 'pending') => {
    const { data, error } = await supabase.from('reception_docs').insert([{
      items: items,
      status: status,
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
    const doc = receptionDocs.find(d => d.id === docId)
    if (!doc) return

    for (const it of (doc.items || [])) {
      // 1. Визначаємо кількість (всі можливі назви полів)
      const qtyToAdd = Number(it.qty ?? it.missingAmount ?? it.quantity ?? it.needed ?? 0)
      if (!qtyToAdd || qtyToAdd <= 0) continue

      // 2. Визначаємо назву позиції (всі можливі назви полів)
      const itemName = it.name || it.reqDetails || it.details || ''

      // 3. Шукаємо в інвентарі: спочатку за ID, потім за nomenclature_id, потім за назвою (fuzzy)
      let invItem = null
      if (it.inventory_id) {
        invItem = inventory.find(i => i.id === it.inventory_id)
      }
      if (!invItem && it.nomenclature_id) {
        invItem = inventory.find(i => i.nomenclature_id === it.nomenclature_id)
      }
      if (!invItem && itemName) {
        // Fuzzy пошук за назвою (нормалізований)
        const norm = (s) => (s || '').toLowerCase().trim()
          .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
          .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
          .replace(/[хx]/g, 'x').replace(/\s/g, '')
        invItem = inventory.find(i => norm(i.name) === norm(itemName))
      }

      if (invItem) {
        // 4a. Позиція знайдена → оновлюємо кількість
        const currentQty = Number(invItem.total_qty) || 0
        const updatePayload = { total_qty: currentQty + qtyToAdd }
        if (!invItem.type) updatePayload.type = 'raw'
        await supabase.from('inventory').update(updatePayload).eq('id', invItem.id)
      } else {
        // 4b. Позиції немає → створюємо нову (завжди type: 'raw' для прийомки від постачальника)
        const nom = it.nomenclature_id
          ? nomenclatures.find(n => n.id === it.nomenclature_id)
          : null
        await supabase.from('inventory').insert([{
          nomenclature_id: it.nomenclature_id || null,
          name: nom?.name || itemName || 'Невідома позиція',
          total_qty: qtyToAdd,
          bz_qty: 0,
          type: 'raw',
          unit: nom?.unit || 'шт'
        }])
      }
    }

    // 5. Закриваємо документ прийомки
    const { error } = await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)

    // 6. Закриваємо пов'язаний purchase_request (щоб кнопка на складі стала "ВИДАТИ")
    if (doc.order_id) {
      await supabase.from('purchase_requests')
        .update({ status: 'completed' })
        .eq('order_id', doc.order_id)
        .in('status', ['pending', 'accepted', 'ordered'])
    }

    if (!error) fetchData()
    return { error }
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

  const createWorkCard = async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, cardInfo, quantity, bufferQty) => {
    const { data: list } = await supabase.from('work_cards').insert([{
      task_id: taskId, order_id: orderId, nomenclature_id: nomenclatureId,
      operation: operation || 'Нова', machine, quantity: Number(quantity) || 0,
      estimated_time: Number(estimatedTime) || 0, status: 'new', 
      card_info: `${cardInfo}${Number(bufferQty) > 0 ? ` [BZ:${bufferQty}]` : ''}`
    }]).select()
    const data = (list && list.length > 0) ? list[0] : null
    await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskId)
    fetchData()
    return data
  }

  const completeTaskByMaster = async (taskId) => {
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    fetchData()
  }

  const startWorkCard = async (taskId, cardId, operatorName) => {
    await supabase.from('work_cards').update({ status: 'in-progress', started_at: new Date().toISOString(), operator_name: operatorName }).eq('id', cardId)
    fetchData()
  }

  const completeWorkCard = async (taskId, cardId, operatorName) => {
    await supabase.from('work_cards').update({ status: 'waiting-buffer', operator_name: operatorName }).eq('id', cardId)
    fetchData()
  }

  const confirmBuffer = async (cardId, scrapData = {}) => {
    const card = workCards.find(c => c.id === cardId)
    if (!card) return
    const totalScrap = Object.values(scrapData).reduce((acc, c) => acc + Number(c), 0)
    const qtyCompleted = Math.max(0, (card.quantity || 0) - totalScrap)

    // Ланцюжки виробництва
    // Цех №1: Різка → Галтовка → Прийомка    (мітка [SHOP:1] у card_info)
    // Загальний: Різка → Галтовка → Пресування → Фарбування → Паквання
    const CHAIN_SHOP1   = ['Різка', 'Галтовка', 'Прийомка']
    const CHAIN_GENERAL = ['Різка', 'Галтовка', 'Пресування', 'Фарбування', 'Паквання']

    const currentOp = (card.operation || '').trim()
    const isShop1 = (card.card_info || '').includes('[SHOP:1]')

    const chain = isShop1 ? CHAIN_SHOP1 : CHAIN_GENERAL

    const idx = chain.findIndex(s =>
      s.toLowerCase() === currentOp.toLowerCase()
    )
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null

    // Паралельно: зберігаємо history + оновлюємо картку
    const cardUpdate = nextStage
      ? { status: 'new', operation: nextStage, quantity: qtyCompleted, started_at: null, operator_name: null }
      : { status: 'completed', quantity: qtyCompleted }

    await Promise.all([
      supabase.from('work_card_history').insert([{
        card_id: cardId,
        nomenclature_id: card.nomenclature_id,
        stage_name: card.operation || 'Різка',
        operator_name: card.operator_name || 'Не вказано',
        qty_at_start: card.quantity,
        qty_completed: qtyCompleted,
        scrap_qty: totalScrap,
        started_at: card.started_at,
        completed_at: new Date().toISOString()
      }]),
      supabase.from('work_cards').update(cardUpdate).eq('id', cardId)
    ])

    // Оновлюємо інвентар (BZ логіка)
    if (qtyCompleted > 0) {
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      if (nom) {
        const plannedBuffer = Number(card.buffer_qty) || Number(card.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
        const actualBuffer = Math.max(0, plannedBuffer - totalScrap)
        const netQtyForOrder = Math.max(0, (Number(card.quantity) || 0) - (totalScrap > plannedBuffer ? totalScrap - plannedBuffer : 0))

        // Шукаємо по nomenclature_id БЕЗ фільтру type (щоб уникнути 400 duplicate)
        const item = inventory.find(i => i.nomenclature_id === nom.id)

        if (item) {
          await supabase.from('inventory').update({
            total_qty: Number(item.total_qty) + netQtyForOrder,
            bz_qty: (Number(item.bz_qty) || 0) + actualBuffer
          }).eq('id', item.id)
        } else {
          // Upsert замість insert — безпечно при constraint
          await supabase.from('inventory').upsert([{
            name: nom.name,
            unit: nom.unit || 'шт',
            total_qty: netQtyForOrder,
            bz_qty: actualBuffer,
            type: 'semi',
            nomenclature_id: nom.id
          }], { onConflict: 'nomenclature_id' })
        }
      }
    }
    fetchData()
  }

  return (
    <MESContext.Provider value={{
      orders, customers, inventory, tasks, requests, nomenclatures, bomItems,
      receptionDocs, purchaseRequests, workCards, workCardHistory, machines,
      systemUsers, currentUser, loading, hasMoreOrders,
      operators, productionStages,
      login, logout, upsertUser, deleteUser,
      fetchOrders, fetchData,
      createNaryad, issueMaterials, approveWarehouse, approveEngineer, approveDirector,
      upsertNomenclature, deleteNomenclature, saveBOM, removeBOM,
      createWorkCard, startWorkCard, completeWorkCard, confirmBuffer, completeTaskByMaster,
      searchCustomers, addOrder,
      createPurchaseRequest, updatePurchaseRequestStatus, convertRequestToOrder,
      createReceptionDoc, sendDocToWarehouse, confirmReception,
      issueMaterials, receiveInventory,
      totalProduced: productionData.totalProduced,
      totalScrapCount: productionData.totalScrap
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
