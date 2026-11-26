import { describe, it, expect } from 'vitest'
import { syncPreparedBoxCutterRequest } from '../src/modules/Warehouse/utils/boxCutterRequestHelper'

function createMockSupabase(initialRows) {
  const rows = initialRows.map(r => ({ ...r }))

  const makeQuery = () => {
    const filters = []
    let orderAsc = true
    const chain = {
      select: () => chain,
      eq: (col, val) => { filters.push(r => r[col] === val); return chain },
      is: (col, val) => { filters.push(r => (r[col] ?? null) === val); return chain },
      gt: (col, val) => { filters.push(r => Number(r[col]) > val); return chain },
      order: (_col, opts) => { orderAsc = opts?.ascending !== false; return chain },
      maybeSingle: async () => {
        const found = rows.find(r => filters.every(fn => fn(r))) || null
        return { data: found ? { ...found } : null, error: null }
      },
      then: (resolve) => {
        const matched = rows.filter(r => filters.every(fn => fn(r)))
        if (!orderAsc) matched.reverse()
        return Promise.resolve({ data: matched.map(r => ({ ...r })), error: null }).then(resolve)
      },
      update: (patch) => ({
        eq: async (col, val) => {
          rows.forEach(r => {
            if (r[col] === val) Object.assign(r, patch)
          })
          return { error: null }
        }
      }),
      insert: async (payload) => {
        rows.push({ id: `req-${rows.length + 1}`, ...payload })
        return { error: null }
      }
    }
    return chain
  }

  return {
    rows,
    from: () => makeQuery()
  }
}

describe('warehouse box cutter deduplication', () => {
  it('splits quota from existing task-level issued request without increasing total reserved qty', async () => {
    const supabase = createMockSupabase([
      {
        id: 'task-req-1',
        task_id: 'task-1',
        order_id: 'order-1',
        card_id: null,
        nomenclature_id: 'cutter-2mm',
        quantity: 160,
        status: 'issued',
        created_at: '2026-11-26T08:50:20Z'
      }
    ])

    await syncPreparedBoxCutterRequest({
      supabase,
      card: { id: 'card-1', task_id: 'task-1', order_id: 'order-1', card_info: '№391/412 [SHEETS:8]' },
      cutter: { nomenclature_id: 'cutter-2mm', inventory_id: 'inv-1', name: 'Фреза 2мм' },
      qtyToDeduct: 8
    })

    const totalIssued = supabase.rows
      .filter(r => r.status === 'issued')
      .reduce((s, r) => s + Number(r.quantity), 0)

    expect(totalIssued).toBe(160)
    expect(supabase.rows.find(r => r.id === 'task-req-1').quantity).toBe(152)
    expect(supabase.rows.find(r => r.card_id === 'card-1').quantity).toBe(8)
  })

  it('marks task-level request completed when its remaining quantity is fully split into card request', async () => {
    const supabase = createMockSupabase([
      {
        id: 'task-req-1',
        task_id: 'task-1',
        order_id: 'order-1',
        card_id: null,
        nomenclature_id: 'cutter-2mm',
        quantity: 8,
        status: 'issued',
        created_at: '2026-11-26T08:50:20Z'
      }
    ])

    await syncPreparedBoxCutterRequest({
      supabase,
      card: { id: 'card-1', task_id: 'task-1', order_id: 'order-1', card_info: '№391/412' },
      cutter: { nomenclature_id: 'cutter-2mm', name: 'Фреза 2мм' },
      qtyToDeduct: 8
    })

    const taskReq = supabase.rows.find(r => r.id === 'task-req-1')
    expect(taskReq.quantity).toBe(0)
    expect(taskReq.status).toBe('completed')
  })
})
