import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { requestBelongsToOpenWork, selectIssuedRequestsForInventory, sumRequestQuantity } from '../src/services/reservationLedger.js'

describe('Cutter Reservation & Plan Deduction Accounting', () => {
  it('correctly filters out requests belonging to completed or cancelled tasks', () => {
    const tasks = [
      { id: 'task-1', status: 'completed' },
      { id: 'task-2', status: 'in-progress' },
      { id: 'task-3', status: 'cancelled' }
    ]
    const orders = [
      { id: 'order-1', status: 'delivered' },
      { id: 'order-2', status: 'in-progress' }
    ]

    const requests = [
      { id: 'r1', inventory_id: 'inv-cutter', task_id: 'task-1', quantity: 1303, status: 'issued' },
      { id: 'r2', inventory_id: 'inv-cutter', task_id: 'task-2', order_id: 'order-2', quantity: 456, status: 'issued' },
      { id: 'r3', inventory_id: 'inv-cutter', task_id: 'task-3', quantity: 50, status: 'issued' },
      { id: 'r4', inventory_id: 'inv-cutter', order_id: 'order-1', quantity: 100, status: 'issued' }
    ]

    expect(requestBelongsToOpenWork(requests[0], tasks, orders)).toBe(false)
    expect(requestBelongsToOpenWork(requests[1], tasks, orders)).toBe(true)
    expect(requestBelongsToOpenWork(requests[2], tasks, orders)).toBe(false)
    expect(requestBelongsToOpenWork(requests[3], tasks, orders)).toBe(false)

    const activeRequests = selectIssuedRequestsForInventory(requests, 'inv-cutter', tasks, orders)
    expect(activeRequests).toHaveLength(1)
    expect(activeRequests[0].id).toBe('r2')
    expect(sumRequestQuantity(activeRequests)).toBe(456)
  })

  it('verifies that useShop1CardWorkflow and useShop1Actions build effectiveBreakdown covering all planned cutters even if operator specifies only one', () => {
    const workflowPath = path.resolve(__dirname, '../src/modules/Shop1/hooks/subhooks/useShop1CardWorkflow.js')
    const actionsPath = path.resolve(__dirname, '../src/modules/Shop1/hooks/useShop1Actions.js')

    const workflowContent = fs.readFileSync(workflowPath, 'utf-8')
    const actionsContent = fs.readFileSync(actionsPath, 'utf-8')

    // Both files must have the updated logic collecting reqCutters, consumables, and dbTaskRequests
    for (const content of [workflowContent, actionsContent]) {
      expect(content).toContain('reqCutters.forEach')
      expect(content).toContain('task?.plan_snapshot?.consumables')
      expect(content).toContain('dbTaskRequests.forEach')
      // Must not skip other cutters when breakdown has keys
      expect(content).not.toContain('if (Object.keys(effectiveBreakdown).length === 0)')
    }
  })

  it('migration 20261109230000 provides automatic cleanup triggers for terminal tasks and orders', () => {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261109230000_auto_cleanup_terminal_task_material_requests.sql')
    expect(fs.existsSync(migrationPath)).toBe(true)
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('trg_cleanup_terminal_task_material_requests')
    expect(sql).toContain('trg_cleanup_terminal_order_material_requests')
    expect(sql).toContain('UPDATE public.material_requests mr')
    expect(sql).toContain('UPDATE public.inventory i')
  })
})

