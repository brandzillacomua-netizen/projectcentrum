import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

export const rawSupabase = createClient(supabaseUrl, supabaseAnonKey)

// Global set to keep track of record IDs created/updated by this client session
window.myRecentWrites = window.myRecentWrites || []
window.myConfirmedWrites = window.myConfirmedWrites || new Set()

function recordWrite(tableName, type, data) {
  const timestamp = Date.now()
  const records = Array.isArray(data) ? data : [data]
  
  const items = records.map(r => {
    if (!r) return {}
    return {
      id: r.id,
      task_id: r.task_id,
      order_id: r.order_id,
      nomenclature_id: r.nomenclature_id,
      quantity: r.quantity,
      details: r.details,
      order_num: r.order_num,
      machine_id: r.machine_id,
      called_role: r.called_role,
      operator_name: r.operator_name
    }
  })

  window.myRecentWrites.push({
    table: tableName,
    type,
    items,
    timestamp
  })

  // Clean up after 1.5 minutes to avoid memory leaks
  setTimeout(() => {
    window.myRecentWrites = window.myRecentWrites.filter(w => w.timestamp !== timestamp)
  }, 90000)
}

/**
 * Checks if a given incoming realtime change belongs to a database write
 * performed by this browser tab.
 */
export function isLocalWrite(tableName, newRecord) {
  if (!newRecord) return false
  
  if (window.myConfirmedWrites.has(newRecord.id)) {
    return true
  }

  const recent = window.myRecentWrites || []
  for (let i = 0; i < recent.length; i++) {
    const write = recent[i]
    if (write.table !== tableName) continue
    
    const match = write.items.some(item => {
      // 1. Match by exact ID if available
      if (item.id && newRecord.id && String(item.id) === String(newRecord.id)) {
        return true
      }
      
      // 2. Fallbacks for key fields depending on table
      if (tableName === 'material_requests') {
        return (
          (!item.task_id || String(item.task_id) === String(newRecord.task_id)) &&
          (!item.nomenclature_id || String(item.nomenclature_id) === String(newRecord.nomenclature_id)) &&
          (!item.quantity || Number(item.quantity) === Number(newRecord.quantity))
        )
      }
      
      if (tableName === 'orders') {
        return (
          (!item.order_num || item.order_num === newRecord.order_num) &&
          (!item.customer || item.customer === newRecord.customer)
        )
      }
      
      if (tableName === 'purchase_requests') {
        return (
          (!item.order_num || item.order_num === newRecord.order_num) &&
          (!item.task_id || String(item.task_id) === String(newRecord.task_id))
        )
      }
      
      if (tableName === 'machine_calls') {
        return (
          (!item.machine_id || String(item.machine_id) === String(newRecord.machine_id)) &&
          (!item.called_role || item.called_role === newRecord.called_role)
        )
      }
      
      if (tableName === 'tasks') {
        return (
          (!item.id || String(item.id) === String(newRecord.id)) &&
          (!item.order_id || String(item.order_id) === String(newRecord.order_id))
        )
      }
      
      return false
    })

    if (match) {
      window.myConfirmedWrites.add(newRecord.id)
      setTimeout(() => {
        window.myConfirmedWrites.delete(newRecord.id)
      }, 5 * 60 * 1000)
      return true
    }
  }

  return false
}

// Wrap PostgrestQueryBuilder methods
function wrapQueryBuilder(builder, tableName) {
  const originalInsert = builder.insert
  const originalUpdate = builder.update
  const originalUpsert = builder.upsert

  builder.insert = function (values, options) {
    recordWrite(tableName, 'insert', values)
    return originalInsert.call(this, values, options)
  }

  builder.update = function (values, options) {
    recordWrite(tableName, 'update', values)
    return originalUpdate.call(this, values, options)
  }

  builder.upsert = function (values, options) {
    recordWrite(tableName, 'upsert', values)
    return originalUpsert.call(this, values, options)
  }

  return builder
}

export const supabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return function (tableName) {
        const builder = target.from(tableName)
        return wrapQueryBuilder(builder, tableName)
      }
    }
    return Reflect.get(target, prop, receiver)
  }
})

