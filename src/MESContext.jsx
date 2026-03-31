import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const MESContext = createContext()

export const MESProvider = ({ children }) => {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [inventory, setInventory] = useState([])
  const [tasks, setTasks] = useState([])
  const [requests, setRequests] = useState([])
  const [nomenclatures, setNomenclatures] = useState([])
  const [bomItems, setBomItems] = useState([])
  const [receptionDocs, setReceptionDocs] = useState([])
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [workCards, setWorkCards] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const PAGE_SIZE = 20



  const fetchOrders = async (page = 0, append = false) => {
    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE - 1
    
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .range(start, end)
      
    if (error) {
      console.error('Error fetching orders:', error)
      return
    }
    
    if (append) {
      setOrders(prev => [...prev, ...data])
    } else {
      setOrders(data)
    }
    setHasMoreOrders(data.length === PAGE_SIZE)
  }

  const fetchData = async () => {
    setLoading(true)
    await fetchOrders(0)
    const { data: c } = await supabase.from('customers').select('*').limit(10).order('name')
    const { data: i } = await supabase.from('inventory').select('*')
    const { data: t } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    const { data: r } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false })
    const { data: n } = await supabase.from('nomenclatures').select('*')
    const { data: b } = await supabase.from('bom_items').select('*')
    const { data: rec, error: recError } = await supabase.from('reception_docs').select('*').order('created_at', { ascending: false })
    const { data: pr, error: prError } = await supabase.from('purchase_requests').select('*').order('created_at', { ascending: false })
    const { data: wc, error: wcError } = await supabase.from('work_cards').select('*').order('created_at', { ascending: true })
    const { data: mc } = await supabase.from('machines').select('*').order('name')
    
    if (c) setCustomers(c)
    if (i) setInventory(i)
    if (t) setTasks(t)
    if (r) setRequests(r)
    if (n) setNomenclatures(n)
    if (b) setBomItems(b)
    if (mc) setMachines(mc)
    if (recError) {
      console.warn('reception_docs error:', recError)
      setReceptionDocs([])
    } else if (rec) setReceptionDocs(rec)

    if (prError) {
      console.warn('purchase_requests error:', prError)
      setPurchaseRequests([])
    } else if (pr) setPurchaseRequests(pr)

    if (wcError) {
      console.warn('work_cards error:', wcError)
      setWorkCards([])
    } else if (wc) setWorkCards(wc)

    setLoading(false)
  }

  const createReceptionDoc = async (items, initStatus = 'pending') => {
    const { error } = await supabase.from('reception_docs').insert([{
      items, // JSON array of { nomenclature_id, qty }
      status: initStatus,
      created_at: new Date().toISOString()
    }])
    if (error) throw error
    fetchData()
  }

  const confirmReceptionDoc = async (docId) => {
    const doc = receptionDocs.find(d => d.id === docId)
    if (!doc || !doc.items) return

    // 1. Aggregate items by nomenclature_id to prevent "stale state" overwrites
    const totalsByNom = doc.items.reduce((acc, it) => {
      acc[it.nomenclature_id] = (acc[it.nomenclature_id] || 0) + Number(it.qty)
      return acc
    }, {})

    // 2. Perform updates for each unique nomenclature
    for (const [nomId, totalQtyChange] of Object.entries(totalsByNom)) {
      const nom = nomenclatures.find(n => n.id === nomId)
      if (nom) {
        const invItem = inventory.find(i => i.nomenclature_id === nomId && i.type === (nom.type === 'part' ? 'semi' : 'raw'))
        
        if (invItem) {
          const currentQty = Number(invItem.total_qty) || 0
          await supabase.from('inventory').update({ 
            total_qty: currentQty + totalQtyChange 
          }).eq('id', invItem.id)
        } else {
          // Construct a descriptive name if material_type exists but isn't in the name
          let invName = nom.name
          if (nom.material_type && !invName.includes(nom.material_type)) {
            invName = `${invName} (${nom.material_type})`
          }
          
          await supabase.from('inventory').insert([{
            name: invName,
            total_qty: totalQtyChange,
            unit: nom.unit || 'шт',
            type: nom.type === 'part' ? 'semi' : 'raw',
            nomenclature_id: nomId
          }])
        }
      }
    }
    
    await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)
    fetchData()
  }

  const createPurchaseRequest = async (orderId, orderNum, items) => {
    const { error } = await supabase.from('purchase_requests').insert([{
      order_id: orderId,
      order_num: orderNum,
      items, // array of { reqDetails, missingAmount, inventory_id }
      status: 'pending',
      created_at: new Date().toISOString()
    }])
    if (error) throw error
    fetchData()
  }

  const updatePurchaseRequestStatus = async (id, newStatus) => {
    const { error } = await supabase.from('purchase_requests').update({ status: newStatus }).eq('id', id)
    if (error) throw error
    fetchData()
  }

  const convertRequestToOrder = async (prId) => {
    const pr = purchaseRequests.find(p => p.id === prId)
    if (!pr || !pr.items) return

    const docItems = []
    let failedItem = null

    const normalize = (s) => (s || '').toLowerCase().replace(/t/g, 'т').trim()

    pr.items.forEach(it => {
      let nomId = null
      
      if (it.inventory_id) {
        const inv = inventory.find(i => i.id === it.inventory_id)
        if (inv) nomId = inv.nomenclature_id
      }
      
      if (!nomId) {
        const reqNorm = normalize(it.reqDetails)
        
        // Find nomenclature by comparing normalized names and considering the " — " suffix
        const nom = nomenclatures.find(n => {
          const nFullName = `${n.name}${n.material_type ? ` (${n.material_type})` : ''}`
          const nNameNorm = normalize(n.name)
          const nFullNorm = normalize(nFullName)
          
          return (
            reqNorm === nNameNorm ||
            reqNorm.startsWith(nNameNorm + ' —') ||
            reqNorm === nFullNorm ||
            reqNorm.startsWith(nFullNorm + ' —')
          )
        })
        if (nom) nomId = nom.id
      }

      if (nomId) { 
        docItems.push({ nomenclature_id: nomId, qty: it.missingAmount }) 
      } else { 
        failedItem = it.reqDetails 
      }
    })

    if (failedItem) {
      alert(`Помилка: Товар "${failedItem}" не знайдено в базі номенклатур. Неможливо замовити.`)
      return
    }

    await createReceptionDoc(docItems, 'ordered')
    await updatePurchaseRequestStatus(prId, 'completed')
  }

  const sendDocToWarehouse = async (docId) => {
    await supabase.from('reception_docs').update({ status: 'pending' }).eq('id', docId)
    fetchData()
  }

  useEffect(() => {
    fetchData()
    const sub = supabase.channel('mes-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const startTask = async (taskId, operatorName) => {
    await supabase.from('tasks').update({ 
      status: 'in-progress', 
      operator_name: operatorName,
      started_at: new Date().toISOString()
    }).eq('id', taskId)
  }

  const completeTask = async (taskId, scrapData = {}) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === 'completed') return

    const order = orders.find(o => o.id === task.order_id)
    const req = requests.find(r => r.order_id === task.order_id)

    // 1. Mark Task Completed
    const { error: taskError } = await supabase.from('tasks').update({ 
      status: 'completed', 
      completed_at: new Date().toISOString(),
      scrap_data: scrapData
    }).eq('id', taskId)

    if (taskError) {
      console.error('Error completing task:', taskError)
      return
    }

    // 2. Consume Raw Materials (Full amount as planned)
    if (req) {
      let parsedName = ''
      try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch(e) {}

      const material = inventory.find(i => i.id === req.inventory_id || (parsedName && i.name === parsedName && i.type === 'raw'))
      if (material) {
        await supabase.from('inventory').update({
          total_qty: (Number(material.total_qty) || 0) - Number(req.quantity),
          reserved_qty: (Number(material.reserved_qty) || 0) - Number(req.quantity)
        }).eq('id', material.id)
      }
    }

    // 3. Aggregate outputs to avoid race conditions
    if (order && order.order_items) {
      const inventoryChanges = [] // { nomenclature_id, type, qty, name }

      for (const item of order.order_items) {
        const scrapCount = Number(scrapData[item.nomenclature_id] || 0)
        const goodCount = Number(item.quantity) - scrapCount
        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
        
        if (nom) {
          const fullName = `${nom.name}${nom.material_type ? ` (${nom.material_type})` : ''}`
          if (goodCount > 0) {
            inventoryChanges.push({ nomenclature_id: nom.id, name: fullName, type: 'semi', qty: goodCount })
          }
          if (scrapCount > 0) {
            inventoryChanges.push({ nomenclature_id: nom.id, name: fullName, type: 'scrap', qty: scrapCount })
          }
        }
      }

      // Process aggregated changes
      const consolidated = inventoryChanges.reduce((acc, current) => {
        const key = `${current.nomenclature_id}-${current.type}`
        if (!acc[key]) {
          acc[key] = { ...current }
        } else {
          acc[key].qty += current.qty
        }
        return acc
      }, {})

      for (const key in consolidated) {
        const change = consolidated[key]
        const existing = inventory.find(i => i.nomenclature_id === change.nomenclature_id && i.type === change.type)
        
        if (existing) {
          console.log(`Updating existing inventory: ${change.name} (${change.type}) +${change.qty}`)
          const { error: upError } = await supabase.from('inventory')
            .update({ total_qty: (Number(existing.total_qty) || 0) + change.qty })
            .eq('id', existing.id)
          if (upError) {
            console.error('Update Error:', upError)
            alert(`Помилка оновлення складу (${change.name}): ${upError.message}`)
          }
        } else {
          console.log(`Inserting new inventory: ${change.name} (${change.type}) qty: ${change.qty}`)
          const { error: inError } = await supabase.from('inventory')
            .insert([{ 
              nomenclature_id: change.nomenclature_id, 
              name: change.name, 
              total_qty: change.qty, 
              type: change.type, 
              unit: 'шт' 
            }])
          if (inError) {
            console.error('Insert Error:', inError)
            alert(`Помилка запису на склад (${change.name}): ${inError.message}`)
          }
        }
      }
    }

    // 4. Update order status
    await supabase.from('orders').update({ status: 'completed' }).eq('id', task.order_id)
    fetchData()
  }

  // ... rest of the functions ...
  const searchCustomers = async (query) => {
    if (!query) return
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(5)
    if (!error && data) setCustomers(data)
  }

  const addOrder = async (orderData, items) => {
    console.log('Adding order:', orderData, items)
    
    // 1. Upsert Customer logic
    if (orderData.customer) {
      await supabase.from('customers').upsert([
        { name: orderData.customer, official_name: orderData.official_customer }
      ], { onConflict: 'name' })
    }

    const { data: order, error: orderError } = await supabase.from('orders').insert([{
      customer: orderData.customer,
      order_num: orderData.orderNum,
      deadline: orderData.deadline || null,
      accessories: orderData.accessories,
      status: 'pending',
      order_date: orderData.orderDate || new Date().toISOString().split('T')[0],
      official_customer: orderData.official_customer || '',
      unit: orderData.unit || 'шт',
      entered_by: orderData.entered_by || '',
      responsible_person: orderData.responsible_person || '',
      actual_date: orderData.actual_date || null,
      source: orderData.source || 'Виробництво',
      report: orderData.report || ''
    }]).select().single()



    if (orderError) {
      console.error('Error creating order:', orderError)
      alert('Помилка створення замовлення: ' + orderError.message)
      return
    }

    if (order) {
      const itemsToInsert = items.map(item => ({
        order_id: order.id,
        nomenclature_id: item.nomenclature_id,
        quantity: Number(item.quantity)
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert)
      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        alert('Помилка додавання позицій: ' + itemsError.message)
      } else {
        fetchData() // Force refresh
      }
    }
  }

  const upsertNomenclature = async (nom) => { 
    const { error } = await supabase.from('nomenclatures').upsert([nom])
    if (error) {
      console.error('Nomenclature Save Error:', error)
      alert(`Помилка збереження: ${error.message} (Код: ${error.code})`)
    } else {
      fetchData()
    }
  }
  
  const deleteNomenclature = async (id) => {
    const { error } = await supabase.from('nomenclatures').delete().eq('id', id)
    if (error) {
      console.error('Error deleting nomenclature:', error)
      alert('Помилка: ' + error.message)
    } else {
      fetchData()
    }
  }

  const saveBOM = async (parentId, childId, qty) => {

    await supabase.from('bom_items').upsert([{ 
      parent_id: parentId, 
      child_id: childId, 
      quantity_per_parent: Number(qty) 
    }], { onConflict: 'parent_id, child_id' })
    fetchData()
  }

  const removeBOM = async (bomId) => {
    await supabase.from('bom_items').delete().eq('id', bomId)
    fetchData()
  }

  const updateBOMQuantity = async (id, qty) => {
    await supabase.from('bom_items').update({ quantity_per_parent: Number(qty) }).eq('id', id)
    fetchData()
  }

  const syncBOM = async (parentId, draftItems) => {
    const { error: delError } = await supabase.from('bom_items').delete().eq('parent_id', parentId)
    if (delError) {
      console.error('Error clearing BOM:', delError)
      return
    }
    
    if (draftItems && draftItems.length > 0) {
      const itemsToInsert = draftItems.map(d => ({
        parent_id: parentId,
        child_id: d.child_id,
        quantity_per_parent: Number(d.qty || d.quantity_per_parent)
      }))
      const { error: insError } = await supabase.from('bom_items').insert(itemsToInsert)
      if (insError) alert('Помилка збереження специфікації: ' + insError.message)
    }
    fetchData()
  }

  const createNaryad = async (orderId, machineName) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) return

      let totalMin = 0
      const materialSummary = {} // { nomenclature_id: { matName, sheets } }

      order.order_items?.forEach(item => {
        // Expand BOM
        const parts = bomItems.filter(b => b.parent_id === item.nomenclature_id)
        const displayParts = parts.length > 0 ? parts.map(b => ({
          nom: nomenclatures.find(n => n.id === b.child_id),
          qtyPer: b.quantity_per_parent
        })) : [{ 
          nom: nomenclatures.find(n => n.id === item.nomenclature_id), 
          qtyPer: 1 
        }]

        displayParts.forEach(part => {
          if (!part.nom) return
          const totalToProduce = item.quantity * part.qtyPer
          const sheets = Math.ceil(totalToProduce / (part.nom.units_per_sheet || 1))
          
          // Group by material_type (thickness) to provide a summary for the warehouse
          const matGroup = part.nom.material_type || 'Інше'
          
          if (!materialSummary[matGroup]) {
            materialSummary[matGroup] = { matName: matGroup, sheets: 0 }
          }
          materialSummary[matGroup].sheets += sheets
          totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
        })
      })

      console.log('Creating naryad for:', order.order_num, { materialSummary, totalMin, machineName })

      const { error: orderUpdateError } = await supabase.from('orders').update({ status: 'in-progress' }).eq('id', orderId)
      if (orderUpdateError) throw orderUpdateError

      const { error: taskError } = await supabase.from('tasks').insert([{ 
        order_id: orderId, 
        step: 'Лазерна різка', 
        status: 'waiting',
        machine_name: machineName || 'Не вказано',
        estimated_time: Math.round(totalMin),
        engineer_conf: false,
        warehouse_conf: false
      }])
      if (taskError) throw taskError

      // Create detailed material requests
      for (const [nomId, info] of Object.entries(materialSummary)) {
        const invItem = inventory.find(i => i.nomenclature_id === nomId && i.type === 'raw')
        const details = `Сировина для ${order.order_num}: ${info.matName} — ${info.sheets} листів.`
        
        await supabase.from('material_requests').insert([{ 
          order_id: orderId, 
          inventory_id: invItem?.id || null, 
          quantity: info.sheets, 
          details, 
          status: 'pending' 
        }])
      }

      console.log('Naryad created successfully with detailed requests')
      await fetchData()
    } catch (err) {
      console.error('Error in createNaryad:', err)
      alert('Помилка при створенні наряду: ' + (err.message || err))
    }
  }

  const receiveInventory = async (itemId, quantity) => {
    const item = inventory.find(i => i.id === itemId)
    if (!item) return
    const newQty = (Number(item.total_qty) || 0) + Number(quantity)
    await supabase.from('inventory').update({ total_qty: newQty }).eq('id', itemId)
    fetchData()
  }

  const issueMaterials = async (requestId) => {
    const req = requests.find(r => r.id === requestId)
    if (req) {
      let parsedName = ''
      try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch(e) {}
      
      // Prioritize nomenclature_id for issuance
      const invItem = inventory.find(i => 
        i.id === req.inventory_id || 
        (req.nomenclature_id && i.nomenclature_id === req.nomenclature_id && i.type === 'raw') ||
        (parsedName && i.name === parsedName && i.type === 'raw')
      )
      
      if (invItem) {
        await supabase.from('inventory').update({ reserved_qty: (Number(invItem.reserved_qty) || 0) + Number(req.quantity) }).eq('id', invItem.id)
        if (!req.inventory_id) {
          // Permanently link the requested order line with the arrived item ID
          await supabase.from('material_requests').update({ status: 'issued', inventory_id: invItem.id }).eq('id', requestId)
        } else {
          await supabase.from('material_requests').update({ status: 'issued' }).eq('id', requestId)
        }
      } else {
        await supabase.from('material_requests').update({ status: 'issued' }).eq('id', requestId)
      }
    }
  }

  const addInventory = async (item) => {
    await supabase.from('inventory').insert([{ 
      name: item.name, unit: item.unit, total_qty: Number(item.total_qty), type: item.type || 'raw'
    }])
  }

  const approveEngineer = async (taskId) => {
    await supabase.from('tasks').update({ engineer_conf: true }).eq('id', taskId)
    fetchData()
  }

  const approveWarehouse = async (taskId) => {
    await supabase.from('tasks').update({ warehouse_conf: true }).eq('id', taskId)
    fetchData()
  }

  const startWorkCard = async (cardId) => {
    const { error } = await supabase.from('work_cards').update({ 
      status: 'in-progress', 
      started_at: new Date().toISOString() 
    }).eq('id', cardId)
    if (error) throw error
    fetchData()
  }

  const completeWorkCard = async (cardId, scrapCounts = {}) => {
    const card = workCards.find(c => c.id === cardId)
    if (!card) return

    const { error } = await supabase.from('work_cards').update({ 
      status: 'completed', 
      completed_at: new Date().toISOString() 
    }).eq('id', cardId)
    if (error) throw error

    // 1. Calculate & record Scrap
    for (const [nomenclatureId, count] of Object.entries(scrapCounts)) {
      if (count > 0) {
        const nom = nomenclatures.find(n => n.id === nomenclatureId)
        if (nom) {
          const fullName = `${nom.name}${nom.material_type ? ` (${nom.material_type})` : ''}`
          let scrapItem = inventory.find(i => i.nomenclature_id === nomenclatureId && i.type === 'scrap')
          if (!scrapItem) {
            const { data } = await supabase.from('inventory').insert([{
              name: fullName + ' (Брак)',
              unit: 'шт',
              total_qty: Number(count),
              type: 'scrap',
              nomenclature_id: nomenclatureId
            }]).select()
            if (data && data.length > 0) scrapItem = data[0]
          } else {
            await supabase.from('inventory').update({ total_qty: Number(scrapItem.total_qty) + Number(count) }).eq('id', scrapItem.id)
          }
        }
      }
    }
    
    fetchData()
  }

  const createWorkCard = async (taskId, orderId, operation, machine, estimatedTime, cardInfo) => {
    const { error } = await supabase.from('work_cards').insert([{
      task_id: taskId,
      order_id: orderId,
      operation,
      machine,
      estimated_time: Number(estimatedTime) || 0,
      status: 'pending',
      card_info: cardInfo || null
    }])
    if (error) throw error
    
    await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskId)
    fetchData()
  }

  const completeTaskByMaster = async (taskId) => {
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    fetchData()
  }

  const addMachine = async (name, capacity) => {
    const { error } = await supabase.from('machines').insert([{ 
      name, 
      sheet_capacity: Number(capacity) || 1 
    }])
    if (error) throw error
    fetchData()
  }

  const deleteMachine = async (id) => {
    await supabase.from('machines').delete().eq('id', id)
    fetchData()
  }

  const updateOrderStatus = async (id, status) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) throw error
    fetchData()
  }

  return (
    <MESContext.Provider value={{ 
      orders, addOrder, fetchOrders, hasMoreOrders,
      customers, searchCustomers,
      inventory, addInventory, receiveInventory,
      tasks, startTask, completeTask, createNaryad,
      requests, issueMaterials,
      nomenclatures, upsertNomenclature, deleteNomenclature,
      bomItems, saveBOM, removeBOM, updateBOMQuantity, syncBOM,
      receptionDocs, createReceptionDoc, confirmReceptionDoc, sendDocToWarehouse,
      purchaseRequests, createPurchaseRequest, updatePurchaseRequestStatus, convertRequestToOrder,
      approveEngineer, approveWarehouse,
      workCards, createWorkCard, startWorkCard, completeWorkCard, completeTaskByMaster,
      machines, addMachine, deleteMachine,
      updateOrderStatus,
      loading 
    }}>




      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
