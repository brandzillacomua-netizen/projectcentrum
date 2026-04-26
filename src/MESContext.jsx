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

  const operators = ["Олексій", "Дмитро", "Сергій", "Андрій", "Микола"]
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
      productionStages,
      supabase
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
