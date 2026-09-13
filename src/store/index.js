import { create } from 'zustand'

export const createInitialStoreState = () => ({
  // Auth & Users
  currentUser: null,
  systemUsers: [],

  // Dictionary / Base Data
  nomenclatures: [],
  companyStructure: [],
  companyPositions: [],
  machines: [],
  machineOperations: [],
  machineCalls: [],
  customers: [],

  // Production
  orders: [],
  tasks: [],
  workCards: [],
  workCardHistory: [],
  workCardScrapTotals: [],
  workCardFlowTotals: [],
  bomItems: [],
  managementTasks: [],
  taskProjects: [],

  // Warehouse
  inventory: [],
  requests: [], // material_requests
  receptionDocs: [],
  purchaseRequests: [],

  // Dashboard & Metrics
  productionData: { totalProduced: 0, totalScrap: 0 }
})

export const useStore = create(set => ({
  ...createInitialStoreState(),
  // Generic setter for the strangler fig pattern
  // This allows dataState.js to push updates into Zustand
  setStoreData: (key, value) => set({ [key]: value }),
}))
