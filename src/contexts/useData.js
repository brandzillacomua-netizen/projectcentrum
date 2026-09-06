import { useDataState } from './data/dataState.js'
import { useDataFetchers } from './data/dataFetchers.js'
import { useDataRealtime } from './data/dataRealtime.js'
import { useDataLifecycle } from './data/dataLifecycle.js'

export function useData() {
  const state = useDataState()
  const fetchers = useDataFetchers(state)
  useDataRealtime(state, fetchers)
  useDataLifecycle(state, fetchers)

  return {
    orders: state.orders, setOrders: state.setOrders,
    customers: state.customers, setCustomers: state.setCustomers,
    inventory: state.inventory, setInventory: state.setInventory,
    tasks: state.tasks, setTasks: state.setTasks,
    managementTasks: state.managementTasks, setManagementTasks: state.setManagementTasks,
    taskProjects: state.taskProjects, setTaskProjects: state.setTaskProjects,
    requests: state.requests, setRequests: state.setRequests,
    nomenclatures: state.nomenclatures, setNomenclatures: state.setNomenclatures,
    bomItems: state.bomItems, setBomItems: state.setBomItems,
    receptionDocs: state.receptionDocs, setReceptionDocs: state.setReceptionDocs,
    purchaseRequests: state.purchaseRequests, setPurchaseRequests: state.setPurchaseRequests,
    workCards: state.workCards, setWorkCards: state.setWorkCards,
    workCardHistory: state.workCardHistory, setWorkCardHistory: state.setWorkCardHistory,
    workCardScrapTotals: state.workCardScrapTotals, setWorkCardScrapTotals: state.setWorkCardScrapTotals,
    workCardFlowTotals: state.workCardFlowTotals, setWorkCardFlowTotals: state.setWorkCardFlowTotals,
    machines: state.machines, setMachines: state.setMachines,
    systemUsers: state.systemUsers, setSystemUsers: state.setSystemUsers,
    machineOperations: state.machineOperations, setMachineOperations: state.setMachineOperations,
    machineCalls: state.machineCalls, setMachineCalls: state.setMachineCalls,
    accessLogs: state.accessLogs, setAccessLogs: state.setAccessLogs,
    fortnetUrl: state.fortnetUrl, setFortnetUrl: state.setFortnetUrl,
    currentUser: state.currentUser, setCurrentUser: state.setCurrentUser,
    sessionLoading: state.sessionLoading, setSessionLoading: state.setSessionLoading,
    loading: state.loading, setLoading: state.setLoading,
    hasMoreOrders: state.hasMoreOrders, setHasMoreOrders: state.setHasMoreOrders,
    normalize: fetchers.normalize,
    fetchOrders: fetchers.fetchOrders,
    fetchData: fetchers.fetchData,
    fetchCritical: fetchers.fetchCritical,
    fetchModuleData: fetchers.fetchModuleData,
    refreshProductionSummary: fetchers.refreshProductionSummary,
    fetchTaskPlanSnapshot: fetchers.fetchTaskPlanSnapshot,
    fetchHistoryRange: fetchers.fetchHistoryRange,
    fetchTaskArchiveCards: fetchers.fetchTaskArchiveCards,
    fetchCompletedManagementTasks: fetchers.fetchCompletedManagementTasks,
    fetchCompletedManagementTasksCount: fetchers.fetchCompletedManagementTasksCount,
    refreshTable: fetchers.refreshTable,
    clearAllData: state.clearAllData,
    productionData: state.productionData,
    companyStructure: state.companyStructure, setCompanyStructure: state.setCompanyStructure,
    upsertCompanyStructure: fetchers.upsertCompanyStructure,
    deleteCompanyStructure: fetchers.deleteCompanyStructure,
    companyPositions: state.companyPositions, setCompanyPositions: state.setCompanyPositions,
    upsertCompanyPosition: fetchers.upsertCompanyPosition,
    deleteCompanyPosition: fetchers.deleteCompanyPosition,
    maintenanceCheckEnabled: state.maintenanceCheckEnabled,
    updateMaintenanceCheckEnabled: state.updateMaintenanceCheckEnabled
  }
}
