import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const MESContext = createContext()

export const MESProvider = ({ children }) => {
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [tasks, setTasks] = useState([])
  const [requests, setRequests] = useState([])
  const [nomenclatures, setNomenclatures] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const { data: o } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
    const { data: i } = await supabase.from('inventory').select('*')
    const { data: t } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    const { data: r } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false })
    const { data: n } = await supabase.from('nomenclatures').select('*')
    
    if (o) setOrders(o)
    if (i) setInventory(i)
    if (t) setTasks(t)
    if (r) setRequests(r)
    if (n) setNomenclatures(n)
    setLoading(false)
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
    if (req && req.inventory_id) {
      const material = inventory.find(i => i.id === req.inventory_id)
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
          if (goodCount > 0) {
            inventoryChanges.push({ nomenclature_id: nom.id, name: nom.name, type: 'semi', qty: goodCount })
          }
          if (scrapCount > 0) {
            inventoryChanges.push({ nomenclature_id: nom.id, name: nom.name, type: 'scrap', qty: scrapCount })
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
  const addOrder = async (orderData, items) => {
    console.log('Adding order:', orderData, items)
    const { data: order, error: orderError } = await supabase.from('orders').insert([{
      customer: orderData.customer,
      order_num: orderData.orderNum,
      deadline: orderData.deadline || null,
      accessories: orderData.accessories,
      status: 'pending',
      // New spreadsheet fields
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

  const upsertNomenclature = async (nom) => { await supabase.from('nomenclatures').upsert([nom]) }

  const createNaryad = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) return

      let totalSheets = 0
      let totalMin = 0
      order.order_items?.forEach(item => {
        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
        if (nom) {
          totalSheets += Math.ceil(Number(item.quantity) / (nom.units_per_sheet || 1))
          totalMin += Number(item.quantity) * (Number(nom.time_per_unit) || 0)
        }
      })

      console.log('Creating naryad for:', order.order_num, { totalSheets, totalMin })

      const { error: orderUpdateError } = await supabase.from('orders').update({ status: 'in-progress' }).eq('id', orderId)
      if (orderUpdateError) throw orderUpdateError

      const { error: taskError } = await supabase.from('tasks').insert([{ 
        order_id: orderId, 
        step: 'Лазерна різка', 
        status: 'waiting',
        estimated_time: Math.round(totalMin)
      }])
      if (taskError) throw taskError

      const rawMaterial = inventory.find(i => i.type === 'raw')
      const details = `Сировина для ${order.order_num}: ${totalSheets} листів.`
      const { error: reqError } = await supabase.from('material_requests').insert([{ 
        order_id: orderId, inventory_id: rawMaterial?.id || null, quantity: totalSheets, details, status: 'pending' 
      }])
      if (reqError) throw reqError

      console.log('Naryad created successfully')
      await fetchData()
    } catch (err) {
      console.error('Error in createNaryad:', err)
      alert('Помилка при створенні наряду: ' + (err.message || err))
    }
  }

  const issueMaterials = async (requestId) => {
    const req = requests.find(r => r.id === requestId)
    if (req && req.inventory_id) {
      const item = inventory.find(i => i.id === req.inventory_id)
      if (item) await supabase.from('inventory').update({ reserved_qty: (Number(item.reserved_qty) || 0) + Number(req.quantity) }).eq('id', item.id)
    }
    await supabase.from('material_requests').update({ status: 'issued' }).eq('id', requestId)
  }

  const addInventory = async (item) => {
    await supabase.from('inventory').insert([{ 
      name: item.name, unit: item.unit, total_qty: Number(item.total_qty), type: item.type || 'raw'
    }])
  }

  return (
    <MESContext.Provider value={{ 
      orders, addOrder, 
      inventory, addInventory, 
      tasks, startTask, completeTask, createNaryad,
      requests, issueMaterials,
      nomenclatures, upsertNomenclature,
      loading 
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
