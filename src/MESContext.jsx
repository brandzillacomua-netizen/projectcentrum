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

      const plan_snapshot = {}

      order.order_items?.forEach(item => {
        const parts = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        console.log(`Checking BOM for ${item.nomenclature_id}: found ${parts.length} parts`)

        const displayParts = parts.length > 0 ? parts.map(b => ({
          nom: nomenclatures.find(n => String(n.id) === String(b.child_id)),
          qtyPer: b.quantity_per_parent
        })) : [{ nom: nomenclatures.find(n => String(n.id) === String(item.nomenclature_id)), qtyPer: 1 }]

        displayParts.forEach(part => {
          if (!part.nom) return
          const totalNeeded = (Number(item.quantity) || 0) * (Number(part.qtyPer) || 1)

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
            sheets: sheets, // Цей показник для відображення в Snapshot
            material: part.nom.material_type
          }

          if (usedFromStock > 0 && invItem) {
            bzStockDeductions.push({ id: invItem.id, next_qty: (Number(invItem.total_qty) || 0) - usedFromStock })
          }

          if (totalToProduce <= 0) return

          const matKey = (part.nom.material_type || part.nom.name || 'Інше').trim()
          const normalize = (s) => s?.toLowerCase().replace(/[\s-]/g, '')

          sheets = Math.ceil(totalToProduce / unitsPerSheet)

          if (!materialSummary[matKey]) {
            const rawNom = nomenclatures.find(n =>
              n.type === 'raw' && (
                normalize(n.material_type) === normalize(matKey) ||
                normalize(n.name).includes(normalize(matKey)) ||
                normalize(matKey).includes(normalize(n.name))
              )
            )
            const rawInv = inventory.find(i => rawNom ? (String(i.nomenclature_id) === String(rawNom.id)) : (String(i.nomenclature_id) === String(part.nom.id) && i.type === 'raw'))
            const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'
            materialSummary[matKey] = { matName: matKey, sheets: 0, totalUnits: 0, components: [], inventory_id: rawInv?.id || null, unit }
          }
          materialSummary[matKey].sheets += sheets
          materialSummary[matKey].totalUnits += totalToProduce
          materialSummary[matKey].components.push(`${part.nom.name}: ${totalToProduce}шт`)
          totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
        })
      })

      // --- EXECUTE STOCK DEDUCTIONS & CREATE BZ CARDS ---
      const { data: taskData, error: taskError } = await supabase.from('tasks').insert([{
        order_id: orderId, step: 'Лазерна різка', status: 'waiting', machine_name: machineName || 'Не вказано',
        estimated_time: Math.round(totalMin), engineer_conf: false, warehouse_conf: false, director_conf: false,
        plan_snapshot: plan_snapshot
      }]).select()

      const tData = (taskData && taskData.length > 0) ? taskData[0] : null
      if (taskError) throw taskError

      // Process BZ deductions and reservation cards
      for (const upd of bzStockDeductions) {
        // 1. Списання загальної кількості
        await supabase.from('inventory').update({ total_qty: upd.next_qty }).eq('id', upd.id)

        // 2. Створення завершеної картки резерву для цього наряду
        const invItem = inventory.find(i => i.id === upd.id)
        if (invItem && tData) {
          const usedQty = (Number(invItem.total_qty) || 0) - upd.next_qty
          if (usedQty > 0) {
            // Створюємо картку
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

            // Створюємо історію
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

      // --- FILTER FOR SHOP 1: Only Sheets and Cutters ---
      const filteredMaterials = allMaterials.filter(m => 
        m.matName.toLowerCase().includes('лист') || 
        m.matName.toLowerCase().includes('фреза')
      )

      const requestsToInsert = filteredMaterials.map(info => ({
        order_id: orderId,
        quantity: info.sheets,
        status: 'pending',
        inventory_id: info.inventory_id,
        details: `СИРОВИНА: ${info.matName} — ${info.sheets} л. (Разом: ${info.totalUnits} шт | Для: ${info.components.join(', ')})`
      }))

      const totalActualSheets = allMaterials
        .filter(m => m.unit === 'ЛИСТІВ')
        .reduce((acc, m) => acc + (m.sheets || 0), 0)

      if (totalActualSheets > 0) {
        // Filter consumables to only include those relevant to Shop 1 (Cutters)
        nomenclatures.filter(n => 
          n.type === 'consumable' && 
          (Number(n.consumption_per_sheet) || 0) > 0 &&
          (n.name.toLowerCase().includes('лист') || n.name.toLowerCase().includes('фреза'))
        ).forEach(cons => {
          const neededQty = Math.ceil(totalActualSheets * Number(cons.consumption_per_sheet))
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
    try {
      const doc = (receptionDocs || []).find(d => d.id === docId)
      if (!doc) return console.error('confirmReception: Doc not found', docId)

      let allSuccess = true
      for (const it of (doc.items || [])) {
        const qtyToAdd = Number(it.qty ?? it.missingAmount ?? it.quantity ?? it.needed ?? 0)
        if (!qtyToAdd || qtyToAdd <= 0) continue

        const itemName = it.name || it.reqDetails || it.details || ''
        const nomId = it.nomenclature_id || null

        // ШИКАЄМО В БД ДЛЯ НАДІЙНОСТІ
        let existing = null
        if (nomId) {
          const { data } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'raw').maybeSingle()
          existing = data
        }
        if (!existing && itemName) {
          const { data } = await supabase.from('inventory').select('*').eq('name', itemName).eq('type', 'raw').maybeSingle()
          existing = data
        }

        if (existing) {
          const { error: updErr } = await supabase.from('inventory').update({
            total_qty: (Number(existing.total_qty) || 0) + qtyToAdd,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
          if (updErr) { console.error('Reception Update Error:', updErr.message); allSuccess = false; }
        } else {
          const nom = nomId ? nomenclatures.find(n => n.id === nomId) : null
          const { error: insErr } = await supabase.from('inventory').insert([{
            nomenclature_id: nomId,
            name: nom?.name || itemName || 'Прийнята позиція',
            total_qty: qtyToAdd,
            reserved_qty: 0,
            type: 'raw',
            unit: nom?.unit || 'шт'
          }])
          if (insErr) { console.error('Reception Insert Error:', insErr.message); allSuccess = false; }
        }
      }

      if (allSuccess) {
        await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)
        if (doc.order_id) {
          await supabase.from('purchase_requests').update({ status: 'completed' }).eq('order_id', doc.order_id)
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

      // --- ФІНАЛІЗАЦІЯ БЗ ТА СТВОРЕННЯ ДОКУМЕНТА НА ПЕРЕМІЩЕННЯ (ТОЧНИЙ РОЗРАХУНОК) ---
      try {
        const snapshotPartsArr = Object.keys(task.plan_snapshot || {})
        const arrivals = []
        const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id))

        for (const nomId of snapshotPartsArr) {
          const nom = nomenclatures.find(n => String(n.id) === String(nomId))
          const cardsForNom = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
          
          if (cardsForNom.length === 0) continue

          // Рахуємо скільки деталей було вироблено САМЕ ЦИМ нарядом
          // (Зазвичай completeTaskShop1 розбиває кількість на Need і BZ)
          let semiToMove = 0
          let bzToMove = 0

          cardsForNom.forEach(c => {
            const cBz = Number(c.buffer_qty) || Number(c.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
            const cNeed = Number(c.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(c.quantity) - cBz)
            
            semiToMove += Math.max(0, cNeed)
            bzToMove += Math.max(0, cBz)
          })

          if (semiToMove > 0 || bzToMove > 0) {
            arrivals.push({
              id: nomId,
              name: nom?.name || 'Деталь',
              semi: semiToMove,
              bz: bzToMove
            })
          }

          // 1. ПЕРЕМІЩЕННЯ SEMI (Потреба)
          if (semiToMove > 0) {
            // Зменшуємо в Цеху 1
            const s1Semi = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi')
            if (s1Semi) {
              await supabase.from('inventory')
                .update({ total_qty: Math.max(0, (Number(s1Semi.total_qty) || 0) - semiToMove) })
                .eq('id', s1Semi.id)
            }
            // Збільшуємо в Цеху 2
            const s2Semi = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2')
            if (s2Semi) {
              await supabase.from('inventory').update({ total_qty: (Number(s2Semi.total_qty) || 0) + semiToMove }).eq('id', s2Semi.id)
            } else {
              await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: semiToMove, reserved_qty: 0, type: 'semi_shop2', unit: nom?.unit || 'шт' }])
            }
          }

          // 2. ПЕРЕМІЩЕННЯ BZ (Запас)
          if (bzToMove > 0) {
            // Зменшуємо в Цеху 1 (може бути як wip_bz так і просто bz)
            const s1Bz = (inventory || []).find(i => 
              String(i.nomenclature_id) === String(nomId) && (i.type === 'wip_bz' || i.type === 'bz')
            )
            if (s1Bz) {
              await supabase.from('inventory')
                .update({ total_qty: Math.max(0, (Number(s1Bz.total_qty) || 0) - bzToMove) })
                .eq('id', s1Bz.id)
            }
            // Збільшуємо в Цеху 2
            const s2Bz = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz_shop2')
            if (s2Bz) {
              await supabase.from('inventory').update({ total_qty: (Number(s2Bz.total_qty) || 0) + bzToMove }).eq('id', s2Bz.id)
            } else {
              await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: bzToMove, reserved_qty: 0, type: 'bz_shop2', unit: nom?.unit || 'шт' }])
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
    
    await supabase.from('work_cards').update(updateData).eq('id', cardId)
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
    const CHAIN_SHOP1 = ['Різка', 'Галтовка', 'Прийомка']
    const CHAIN_GENERAL = ['Різка', 'Галтовка', 'Пресування', 'Фарбування', 'Паквання']

    const currentOp = (card.operation || '').trim()
    const isShop1 = (card.card_info || '').includes('[SHOP:1]')
    const isShop2 = (card.card_info || '').includes('[ЦЕХ №2]')
    const chain = isShop1 ? CHAIN_SHOP1 : CHAIN_GENERAL

    const idx = chain.findIndex(s =>
      s.toLowerCase() === currentOp.toLowerCase()
    )
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null

    let cardUpdate = {}
    
    // Якщо це Цех №2 - ми не перекидаємо автоматично на наступний етап, 
    // а кладемо в буфер очікування (at-buffer). Далі оператор сканує і забирає або ми відправляємо на СГП.
    if (isShop2) {
      cardUpdate = { status: 'at-buffer', quantity: qtyCompleted }
    } else {
      cardUpdate = nextStage
        ? { status: 'new', operation: nextStage, quantity: qtyCompleted, started_at: null, operator_name: null }
        : { status: 'completed', quantity: qtyCompleted }
    }

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

    // Оновлюємо інвентар (BZ логіка - ТІЛЬКИ ДЛЯ ЦЕХУ 1 або загального потоку! В ЦЕХУ №2 інша логіка складу)
    if (!isShop2) {
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
    if (nom) {
      const plannedBuffer = Number(card.buffer_qty) || Number(card.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
      const actualBuffer = Math.max(0, plannedBuffer - totalScrap)
      const netQtyForOrder = Math.max(0, qtyCompleted - actualBuffer)

      // 1. Оновлюємо semi (чиста кількість)
      if (netQtyForOrder > 0) {
        const { data: semi } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'semi').maybeSingle()
        if (semi) {
          await supabase.from('inventory').update({ total_qty: (Number(semi.total_qty) || 0) + netQtyForOrder }).eq('id', semi.id)
        } else {
          await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: netQtyForOrder, reserved_qty: 0, type: 'semi' }])
        }
      }

      // 2. Оновлюємо wip_bz як тимчасовий запис (не для віднімання в Майстрі поки що)
      if (actualBuffer > 0) {
        const { data: wip } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'wip_bz').maybeSingle()
        if (wip) {
          await supabase.from('inventory').update({ total_qty: (Number(wip.total_qty) || 0) + actualBuffer }).eq('id', wip.id)
        } else {
          await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBuffer, reserved_qty: 0, type: 'wip_bz' }])
        }
      } // closes actualBuffer
      } // closes nom
    } // closes isShop2
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
       const finishedQty = Math.min(totalQty, needQty)
       // Увесь залишок (за вирахуванням браку) - у БЗ
       const actualBzQty = Math.max(0, totalQty - finishedQty)

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
      // Шукаємо на залишках (Готова продукція або Сировина/Метизи)
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
      createWorkCard, startWorkCard, completeWorkCard, confirmBuffer, completeTaskByMaster, handoverTaskToShop2, completeTaskShop2, fixInventoryTypes, handoverToSGP,
      searchCustomers, addOrder, reserveBZForTask,
      syncBOM,
      createPurchaseRequest, updatePurchaseRequestStatus, convertRequestToOrder,
      createReceptionDoc, sendDocToWarehouse, confirmReception,
      confirmReceptionDoc: confirmReception,
      receiveInventory, submitPickingRequest, completePackaging,
      totalProduced: productionData.totalProduced,
      totalScrapCount: productionData.totalScrap
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
