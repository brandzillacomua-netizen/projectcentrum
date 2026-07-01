import React, { createContext, useContext, useEffect } from 'react'
import { supabase } from './supabase'

import { useData } from './contexts/useData'
import { createAuthActions } from './contexts/useAuth'
import { createFortnetActions } from './contexts/useFortnet'
import { createProductionActions } from './contexts/useProduction'
import { createWarehouseActions } from './contexts/useWarehouse'

const MESContext = createContext()

export const MESProvider = ({ children }) => {
  const data = useData()

  // ── FORTNET SYNC LOGIC ──
  const { syncFortnetEvents } = createFortnetActions({ 
    fortnetUrl: data.fortnetUrl, 
    accessLogs: data.accessLogs, 
    setAccessLogs: data.setAccessLogs, 
    updateFortnetUrl: data.setFortnetUrl 
  })

  useEffect(() => {
    const timer = setInterval(syncFortnetEvents, 60000); // Every 60 seconds
    return () => clearInterval(timer);
  }, [data.fortnetUrl, data.accessLogs]);

  // ── USER PRESENCE HEARTBEAT ──
  useEffect(() => {
    if (!data.currentUser?.id) return

    const updatePresence = async () => {
      try {
        await supabase
          .from('system_users')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', data.currentUser.id)
      } catch (err) {
        console.error('Failed to update presence:', err)
      }
    }

    updatePresence()
    const timer = setInterval(updatePresence, 30000) // every 30s
    return () => clearInterval(timer)
  }, [data.currentUser?.id])

  // ── AUTH ──
  const authActions = createAuthActions({
    currentUser: data.currentUser, 
    setCurrentUser: data.setCurrentUser, 
    setSystemUsers: data.setSystemUsers, 
    fetchData: data.fetchData,
    clearAllData: data.clearAllData,
    setSessionLoading: data.setSessionLoading
  })

  // ── CUSTOMERS ──
  const searchCustomers = async (query) => {
    if (!query) return []
    const { data: cData } = await supabase.from('customers').select('*').ilike('name', `%${query}%`).limit(20)
    // IMPORTANT: do NOT call setCustomers here — that would replace the full
    // cached list with just 5 search hits, breaking every other dropdown.
    // Instead return the results for the caller to use locally.
    return cData || []
  }

  // ── WAREHOUSE ──
  const warehouseActions = createWarehouseActions({
    inventory: data.inventory, 
    nomenclatures: data.nomenclatures, 
    requests: data.requests, 
    tasks: data.tasks,
    orders: data.orders,
    setInventory: data.setInventory, 
    setRequests: data.setRequests, 
    setTasks: data.setTasks,
    normalize: data.normalize, 
    refreshTable: data.refreshTable, 
    fetchData: data.fetchData
  })

  // ── PRODUCTION ──
  const productionActions = createProductionActions({
    orders: data.orders, 
    tasks: data.tasks, 
    inventory: data.inventory, 
    nomenclatures: data.nomenclatures, 
    bomItems: data.bomItems, 
    workCards: data.workCards,
    machineOperations: data.machineOperations,
    setTasks: data.setTasks, 
    setWorkCards: data.setWorkCards, 
    setWorkCardHistory: data.setWorkCardHistory, 
    setManagementTasks: data.setManagementTasks, 
    setMachines: data.setMachines,
    normalize: data.normalize, 
    refreshTable: data.refreshTable, 
    fetchData: data.fetchData,
    deductIssuedMaterialsForTask: warehouseActions.deductIssuedMaterialsForTask
  })

  const formatUserName = (u) => {
    // Display as: Прізвище Ім'я (without position)
    const lastName = (u.last_name || '').trim()
    const firstName = (u.first_name || '').trim()
    const fullName = [lastName, firstName].filter(Boolean).join(' ')
    return (fullName || u.login || '').trim()
  }

  const operators = (data.systemUsers || [])
    .filter(u => {
      if (!u.position) return false
      const pos = u.position.toLowerCase()
      return ['оператор', 'галтовщик', 'пресов', 'пресув', 'маляр', 'слюсар', 'чистил', 'працівник', 'вкя', 'якост', 'підготов'].some(kw => pos.includes(kw))
    })
    .map(formatUserName)
    .filter(Boolean)

  const getFilteredOperators = (department, shift, stage = null) => {
    let list = (data.systemUsers || [])
    
    // 1. Filter by Department
    if (department) {
      list = list.filter(u => u.department === department)
    }
    
    // 2. Filter by Shift
    if (shift && shift !== 'Без зміни') {
      list = list.filter(u => u.shift === shift || u.shift === 'Без зміни')
    }

    // 3. Filter by Position / Stage assignment
    if (stage) {
      const stageLower = stage.toLowerCase()

      if (stageLower === 'розкрій') {
        list = list.filter(u => u.position && u.position.toLowerCase().includes('оператор'))
      } else if (stageLower.includes('галтовка')) {
        list = list.filter(u => u.position && u.position.toLowerCase().includes('галтовщик'))
      } else if (stageLower === 'прийомка') {
        // Also include users from 'Прийомка' department (not only the filtered dept)
        const priyomkaDept = (data.systemUsers || []).filter(u => {
          if (shift && shift !== 'Без зміни') {
            if (u.shift !== shift && u.shift !== 'Без зміни') return false
          }
          return u.department === 'Прийомка'
        })
        list = list.filter(u => {
          if (!u.position) return false
          const pos = u.position.toLowerCase()
          return pos.includes('прийом') || pos.includes('прийма') || pos.includes('склад') || pos.includes('працівник')
        })
        // Merge, deduplicate by login
        const merged = [...list]
        priyomkaDept.forEach(u => { if (!merged.find(m => m.id === u.id)) merged.push(u) })
        list = merged
      } else if (stageLower === 'сортування') {
        // Also include users from 'Сортування' department
        const sortDept = (data.systemUsers || []).filter(u => {
          if (shift && shift !== 'Без зміни') {
            if (u.shift !== shift && u.shift !== 'Без зміни') return false
          }
          return u.department === 'Сортування'
        })
        list = list.filter(u => {
          if (!u.position) return false
          const pos = u.position.toLowerCase()
          return pos.includes('сортув') || pos.includes('сортувал') || pos.includes('працівник')
        })
        const merged = [...list]
        sortDept.forEach(u => { if (!merged.find(m => m.id === u.id)) merged.push(u) })
        list = merged
      } else if (stageLower === 'доопрацювання') {
        const doopDept = (data.systemUsers || []).filter(u => {
          if (shift && shift !== 'Без зміни') {
            if (u.shift !== shift && u.shift !== 'Без зміни') return false
          }
          return u.department === 'Доопрацювання' || u.department === 'Відділ Доопрацювання'
        })
        list = list.filter(u => {
          if (!u.position) return false
          const pos = u.position.toLowerCase()
          return pos.includes('слюсар') || pos.includes('майстер') || pos.includes('доопрац')
        })
        const merged = [...list]
        doopDept.forEach(u => { if (!merged.find(m => m.id === u.id)) merged.push(u) })
        list = merged
      } else if (stageLower === 'фарбування') {
        list = list.filter(u => u.position && u.position.toLowerCase().includes('маляр'))
      } else if (stageLower === 'пресування') {
        list = list.filter(u => u.position && (u.position.toLowerCase().includes('прес') || u.position.toLowerCase().includes('пресув')))
      } else if (stageLower === 'підготовка') {
        list = list.filter(u => u.position && (
          u.position.toLowerCase().includes('працівник вп') || 
          u.position.toLowerCase().includes('підготов') ||
          u.department === 'Відділ Підготовки'
        ))
      } else {
        list = list.filter(u => {
          if (!u.position) return false
          const pos = u.position.toLowerCase()
          return ['оператор', 'галтовщик', 'пресов', 'пресув', 'маляр', 'слюсар', 'чистил', 'працівник', 'вкя', 'якост', 'підготов'].some(kw => pos.includes(kw))
        })
      }
    } else {
      list = list.filter(u => {
        if (!u.position) return false
        const pos = u.position.toLowerCase()
        return ['оператор', 'галтовщик', 'пресов', 'пресув', 'маляр', 'слюсар', 'чистил', 'працівник', 'вкя', 'якост', 'підготов'].map(kw => kw === 'преsuв' ? 'пресув' : kw).some(kw => pos.includes(kw))
      })
    }

    // Sort alphabetically by last_name, then first_name
    list = list.sort((a, b) => {
      const aName = (a.last_name || '').localeCompare(b.last_name || '', 'uk') ||
                    (a.first_name || '').localeCompare(b.first_name || '', 'uk')
      return aName
    })
    return list.map(formatUserName).filter(Boolean)
  }

  const getFilteredManagers = (department) => {
    let list = (data.systemUsers || [])
    if (department) {
      list = list.filter(u => !u.department || u.department === department || u.department === 'Керівництво')
    }
    return list
      .filter(u => {
        if (!u.position) return false
        const pos = u.position.toLowerCase()
        return pos.includes('майстер') ||
               pos.includes('нач') ||
               pos.includes('директор') ||
               pos.includes('адмін')
      })
      .map(formatUserName)
      .filter(Boolean)
  }

  const managers = (data.systemUsers || [])
    .filter(u => {
      if (!u.position) return false
      const pos = u.position.toLowerCase()
      return pos.includes('майстер') ||
             pos.includes('нач') ||
             pos.includes('директор') ||
             pos.includes('адмін')
    })
    .map(formatUserName)
    .filter(Boolean)
  const productionStages = ["Підготовка", "Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]

  return (
    <MESContext.Provider value={{
      ...data,
      ...authActions,
      ...warehouseActions,
      ...productionActions,
      searchCustomers,
      addManagementTask: (p) => productionActions.addManagementTask(p, data.currentUser?.login),
      confirmReceptionDoc: warehouseActions.confirmReception,
      totalProduced: data.productionData.totalProduced,
      totalScrapCount: data.productionData.totalScrap,
      operators,
      getFilteredOperators,
      getFilteredManagers,
      managers,
      productionStages,
      machineOperations: data.machineOperations,
      setMachineOperations: data.setMachineOperations,
      machineCalls: data.machineCalls,
      setMachineCalls: data.setMachineCalls,
      fetchModuleData: data.fetchModuleData,
      formatUserName,
      supabase
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)

