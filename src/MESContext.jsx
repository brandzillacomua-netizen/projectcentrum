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

  // ── AUTH ──
  const authActions = createAuthActions({
    currentUser: data.currentUser, 
    setCurrentUser: data.setCurrentUser, 
    setSystemUsers: data.setSystemUsers, 
    fetchData: data.fetchData
  })

  // ── CUSTOMERS ──
  const searchCustomers = async (query) => {
    if (!query) return
    const { data: cData } = await supabase.from('customers').select('*').ilike('name', `%${query}%`).limit(5)
    if (cData) data.setCustomers(cData)
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
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ')
    const displayName = fullName || u.login
    return u.position ? `${displayName} (${u.position})` : displayName
  }

  const operators = (data.systemUsers || [])
    .filter(u => ['Оператор', 'Галтовщик', 'Пресувальник', 'Маляр', 'Слюсар'].includes(u.position))
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

    // 3. Filter by Position (Stage)
    if (stage === 'Галтовка') {
      list = list.filter(u => u.position === 'Галтовщик')
    } else if (stage === 'Розкрій') {
      list = list.filter(u => u.position === 'Оператор')
    } else if (stage === 'Пресування') {
      list = list.filter(u => u.position === 'Пресувальник')
    } else if (stage === 'Фарбування') {
      list = list.filter(u => u.position === 'Маляр (Фарбування)')
    } else if (stage === 'Доопрацювання') {
      list = list.filter(u => u.position === 'Слюсар (Доопрацювання)')
    } else {
      // Default production operators
      list = list.filter(u => ['Оператор', 'Галтовщик', 'Пресувальник', 'Маляр', 'Слюсар'].includes(u.position))
    }

    return list.map(formatUserName).filter(Boolean)
  }

  const getFilteredManagers = (department) => {
    let list = (data.systemUsers || [])
    if (department) {
      list = list.filter(u => u.department === department || u.department === 'Керівництво')
    }
    return list
      .filter(u => ['Адмін', 'Директор виробництва', 'Начальник цеху', 'Майстер цеху'].includes(u.position))
      .map(formatUserName)
      .filter(Boolean)
  }

  const managers = (data.systemUsers || [])
    .filter(u => 
      ['Адмін', 'Директор виробництва', 'Начальник цеху', 'Майстер цеху'].includes(u.position)
    )
    .map(formatUserName)
    .filter(Boolean)
  const productionStages = ["Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]

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
      supabase
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
