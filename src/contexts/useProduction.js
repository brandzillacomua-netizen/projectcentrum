/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 MES CENTRUM: PRODUCTION ACTIONS FACADE
 * ═══════════════════════════════════════════════════════════════════════════
 * Orchestrates domain production actions across:
 * - Orders & Material Calculation (`production/productionOrders.js`)
 * - Work Cards & Naryads (`production/productionCards.js`)
 * - Workflow Handovers, Approvals & SGP (`production/productionHandovers.js`)
 * - Master Registry, BOM, Machines & Rework (`production/productionAuxiliary.js`)
 * 
 * Preserves 100% backward compatibility and exact method signatures for MESContext.
 */

import { createProductionOrdersActions } from './production/productionOrders.js'
import { createProductionCardsActions } from './production/productionCards.js'
import { createProductionHandoversActions } from './production/productionHandovers.js'
import { createProductionAuxiliaryActions } from './production/productionAuxiliary.js'

export function createProductionActions(deps) {
  const ordersActions = createProductionOrdersActions(deps)
  const cardsActions = createProductionCardsActions(deps, {
    createDovyпускMaterialRequests: ordersActions.createDovyпускMaterialRequests
  })
  const handoversActions = createProductionHandoversActions(deps)
  const auxiliaryActions = createProductionAuxiliaryActions(deps)

  return {
    // ── Work Cards, Buffers & Batch Generation ──
    ...cardsActions,

    // ── Workflow Handovers, Approvals & SGP ──
    ...handoversActions,

    // ── Orders & Material Calculations ──
    ...ordersActions,

    // ── Auxiliary: BOM, Machines, Tasks & Rework ──
    ...auxiliaryActions
  }
}

export default createProductionActions
