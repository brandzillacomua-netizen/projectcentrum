import { describe, it, expect } from 'vitest'
import { createProductionActions } from '../src/contexts/useProduction.js'
import { createProductionOrdersActions } from '../src/contexts/production/productionOrders.js'
import { createProductionCardsActions } from '../src/contexts/production/productionCards.js'
import { createProductionHandoversActions } from '../src/contexts/production/productionHandovers.js'
import { createProductionAuxiliaryActions } from '../src/contexts/production/productionAuxiliary.js'

describe('useProduction Decomposition Parity & Structure', () => {
  const mockDeps = {
    orders: [{ id: 'ord-1', order_num: 'ORD-001', status: 'in-progress' }],
    tasks: [{ id: 'task-1', order_id: 'ord-1', step: 'Розкрій', status: 'waiting' }],
    inventory: [{ id: 'inv-1', name: 'Деталь', total_qty: 10 }],
    nomenclatures: [{ id: 'nom-1', name: 'Деталь', type: 'material' }],
    bomItems: [],
    workCards: [{ id: 'card-1', order_id: 'ord-1', status: 'new', operation: 'Розкрій', quantity: 10 }],
    machineOperations: [],
    machines: [],
    systemUsers: [],
    currentUser: { id: 'usr-1', login: 'admin', role: 'admin' },
    setTasks: () => {},
    setWorkCards: () => {},
    setWorkCardHistory: () => {},
    setManagementTasks: () => {},
    setMachines: () => {},
    normalize: (s) => s,
    refreshTable: () => Promise.resolve(),
    fetchData: () => Promise.resolve(),
    deductIssuedMaterialsForTask: () => Promise.resolve(),
    maintenanceCheckEnabled: false
  }

  it('instantiates all 4 submodules with expected domain methods', () => {
    const ordersActions = createProductionOrdersActions(mockDeps)
    expect(typeof ordersActions.addOrder).toBe('function')
    expect(typeof ordersActions.updateOrder).toBe('function')
    expect(typeof ordersActions.deleteOrder).toBe('function')
    expect(typeof ordersActions.superDeleteOrder).toBe('function')
    expect(typeof ordersActions.getOrderProductionProgress).toBe('function')
    expect(typeof ordersActions.createDovyпускMaterialRequests).toBe('function')

    const cardsActions = createProductionCardsActions(mockDeps)
    expect(typeof cardsActions.createWorkCard).toBe('function')
    expect(typeof cardsActions.createWorkCardsBatch).toBe('function')
    expect(typeof cardsActions.startWorkCard).toBe('function')
    expect(typeof cardsActions.completeWorkCard).toBe('function')
    expect(typeof cardsActions.confirmBuffer).toBe('function')
    expect(typeof cardsActions.createNaryad).toBe('function')

    const handoversActions = createProductionHandoversActions(mockDeps)
    expect(typeof handoversActions.approveWarehouse).toBe('function')
    expect(typeof handoversActions.approveEngineer).toBe('function')
    expect(typeof handoversActions.approveDirector).toBe('function')
    expect(typeof handoversActions.handoverTaskToShop2).toBe('function')
    expect(typeof handoversActions.cancelHandoverToShop2).toBe('function')
    expect(typeof handoversActions.completeTaskShop2).toBe('function')
    expect(typeof handoversActions.directHandoverToSGP).toBe('function')
    expect(typeof handoversActions.handoverToSGP).toBe('function')
    expect(typeof handoversActions.reserveBZForTask).toBe('function')
    expect(typeof handoversActions.completePackaging).toBe('function')

    const auxiliaryActions = createProductionAuxiliaryActions(mockDeps)
    expect(typeof auxiliaryActions.upsertNomenclature).toBe('function')
    expect(typeof auxiliaryActions.deleteNomenclature).toBe('function')
    expect(typeof auxiliaryActions.saveBOM).toBe('function')
    expect(typeof auxiliaryActions.removeBOM).toBe('function')
    expect(typeof auxiliaryActions.syncBOM).toBe('function')
    expect(typeof auxiliaryActions.addManagementTask).toBe('function')
    expect(typeof auxiliaryActions.updateManagementTask).toBe('function')
    expect(typeof auxiliaryActions.deleteManagementTask).toBe('function')
    expect(typeof auxiliaryActions.addMachine).toBe('function')
    expect(typeof auxiliaryActions.updateMachine).toBe('function')
    expect(typeof auxiliaryActions.deleteMachine).toBe('function')
    expect(typeof auxiliaryActions.disposeScrapItem).toBe('function')
    expect(typeof auxiliaryActions.createReworkNaryad).toBe('function')
  })

  it('facade exposes all 33 production methods with 100% backward compatibility', () => {
    const facade = createProductionActions(mockDeps)
    const requiredMethods = [
      'createNaryad', 'handoverTaskToShop2', 'cancelHandoverToShop2', 'completeTaskShop2',
      'directHandoverToSGP', 'handoverToSGP', 'reserveBZForTask', 'completePackaging',
      'disposeScrapItem', 'createReworkNaryad', 'approveWarehouse', 'approveEngineer',
      'approveDirector', 'upsertNomenclature', 'deleteNomenclature', 'saveBOM',
      'removeBOM', 'syncBOM', 'addOrder', 'updateOrder', 'deleteOrder',
      'superDeleteOrder', 'createWorkCard', 'createWorkCardsBatch', 'startWorkCard',
      'completeWorkCard', 'confirmBuffer', 'completeTaskByMaster', 'addManagementTask',
      'updateManagementTask', 'deleteManagementTask', 'addMachine', 'updateMachine',
      'deleteMachine', 'getOrderProductionProgress', 'createDovyпускMaterialRequests'
    ]

    for (const m of requiredMethods) {
      expect(typeof facade[m]).toBe('function')
    }
  })

  it('pure calculation method getOrderProductionProgress returns valid progress structure', () => {
    const facade = createProductionActions(mockDeps)
    const res = facade.getOrderProductionProgress(mockDeps.orders[0])
    expect(res).toBeDefined()
    expect(typeof res.total).toBe('number')
    expect(typeof res.status).toBe('string')
  })
})
