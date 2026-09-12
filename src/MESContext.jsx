import React, { createContext, useContext, useEffect } from 'react'
import { supabase } from './supabase'

import { useData } from './contexts/useData'
import { createAuthActions } from './contexts/useAuth'
import { createProductionActions } from './contexts/useProduction'
import { createWarehouseActions } from './contexts/useWarehouse'
import { useAppTheme } from './contexts/useAppTheme'
import { useUserPresence } from './contexts/useUserPresence'
import {
  formatUserName,
  selectFilteredManagerNames,
  selectFilteredOperatorNames,
  selectManagerNames,
  selectOperatorNames
} from './contexts/userDirectorySelectors'

const MESContext = createContext()

export const MESProvider = ({ children }) => {
  const data = useData()
  const { theme, toggleTheme } = useAppTheme()
  useUserPresence(data.currentUser?.id, supabase)

  // ── USER AUTH STATUS LOG ──
  useEffect(() => {
    if (data.currentUser?.login) {
      console.log(`%c[Centrum Auth] 🛡️ Активна JWT сесія підтверджена! Користувач: "${data.currentUser.login}" (${data.currentUser.position || 'Працівник'})`, 'color: #22c55e; font-weight: bold; font-size: 13px;')
    }
  }, [data.currentUser?.id, data.currentUser?.login])

  // ── AUTH ──
  const authActions = createAuthActions({
    currentUser: data.currentUser, 
    setCurrentUser: data.setCurrentUser, 
    setSystemUsers: data.setSystemUsers, 
    clearAllData: data.clearAllData,
    setSessionLoading: data.setSessionLoading
  })

  // ── STRICT JWT ENFORCEMENT GUARD ──
  useEffect(() => {
    if (data.currentUser?.id) {
      const isStrict = localStorage.getItem('MES_SESSION_STRICT') === 'true'
      if (!isStrict) {
        console.warn('[Centrum Auth] ⚠️ Виявлено сесію старого режиму без JWT. Примусовий вихід на екран авторизації...')
        authActions.logout()
      }
    }
  }, [data.currentUser?.id])

  // ── CUSTOMERS ──
  const searchCustomers = async (query) => {
    if (!query) return []
    const { data: cData } = await supabase.from('customers').select('*').ilike('name', `%${query}%`).limit(20)
    // IMPORTANT: do NOT call setCustomers here — that would replace the full
    // cached list with just 5 search hits, breaking every other dropdown.
    // Instead return the results for the caller to use locally.
    return cData || []
  }

  const addTaskProject = async (project) => {
    const payload = { ...project, created_by: data.currentUser?.login || 'system' }
    const { data: rows, error } = await supabase.from('task_projects').insert([payload]).select()
    if (!error && rows?.[0]) data.setTaskProjects(prev => prev.some(p => p.id === rows[0].id) ? prev : [rows[0], ...prev])
    return { data: rows?.[0], error }
  }

  const updateTaskProject = async (id, updates) => {
    data.setTaskProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    if (updates.columns) {
      try {
        const saved = JSON.parse(localStorage.getItem('centrum_project_columns') || '{}')
        saved[id] = updates.columns
        localStorage.setItem('centrum_project_columns', JSON.stringify(saved))
      } catch (e) {}
    }
    try {
      const { data: rows, error } = await supabase.from('task_projects').update(updates).eq('id', id).select()
      return { data: rows?.[0], error }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  const deleteTaskProject = async (id) => {
    const { error } = await supabase.from('task_projects').delete().eq('id', id)
    if (!error) data.setTaskProjects(prev => prev.filter(p => p.id !== id))
    return { error }
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
    machines: data.machines,
    systemUsers: data.systemUsers,
    currentUser: data.currentUser,
    setTasks: data.setTasks, 
    setWorkCards: data.setWorkCards, 
    setWorkCardHistory: data.setWorkCardHistory, 
    setManagementTasks: data.setManagementTasks, 
    setMachines: data.setMachines,
    normalize: data.normalize, 
    refreshTable: data.refreshTable, 
    fetchData: data.fetchData,
    deductIssuedMaterialsForTask: warehouseActions.deductIssuedMaterialsForTask,
    maintenanceCheckEnabled: data.maintenanceCheckEnabled,
    requests: data.requests
  })

  const operators = selectOperatorNames(data.systemUsers)
  const getFilteredOperators = (department, shift, stage = null) => (
    selectFilteredOperatorNames(data.systemUsers, department, shift, stage)
  )
  const getFilteredManagers = department => selectFilteredManagerNames(data.systemUsers, department)
  const managers = selectManagerNames(data.systemUsers)
  const productionStages = ["Підготовка", "Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]

  return (
    <MESContext.Provider value={{
      theme,
      toggleTheme,
      ...data,
      ...authActions,
      ...warehouseActions,
      ...productionActions,
      searchCustomers,
      addManagementTask: (p) => productionActions.addManagementTask(p, data.currentUser?.login),
      addTaskProject,
      updateTaskProject,
      deleteTaskProject,
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
      fetchTaskPlanSnapshot: data.fetchTaskPlanSnapshot,
      formatUserName,
      supabase
    }}>
      {children}
    </MESContext.Provider>
  )
}

export const useMES = () => useContext(MESContext)
