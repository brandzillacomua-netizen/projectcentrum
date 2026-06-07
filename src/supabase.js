import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

export const rawSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

// Global set to keep track of record IDs created/updated by this client session
window.myConfirmedWrites = window.myConfirmedWrites || new Set()

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Checks if a given incoming realtime change belongs to a database write
 * performed by this browser tab.
 */
export function isLocalWrite(tableName, newRecord) {
  if (!newRecord || !newRecord.id) return false
  return window.myConfirmedWrites.has(newRecord.id)
}

// Wrap PostgrestFilterBuilder to capture IDs used in filters like .eq('id', ...)
function wrapFilterBuilder(builder, tableName) {
  if (!builder) return builder
  
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver)
      
      if (typeof originalValue === 'function') {
        return function (...args) {
          // 1. Intercept .eq('id', rowId)
          if (prop === 'eq' && args[0] === 'id' && args[1]) {
            window.myConfirmedWrites.add(args[1])
            const idToClean = args[1]
            setTimeout(() => { window.myConfirmedWrites.delete(idToClean) }, 5 * 60 * 1000)
          }
          // 2. Intercept .in('id', [rowId1, rowId2, ...])
          if (prop === 'in' && args[0] === 'id' && Array.isArray(args[1])) {
            args[1].forEach(id => {
              if (id) {
                window.myConfirmedWrites.add(id)
                setTimeout(() => { window.myConfirmedWrites.delete(id) }, 5 * 60 * 1000)
              }
            })
          }
          // 3. Intercept .match({ id: rowId })
          if (prop === 'match' && args[0] && typeof args[0] === 'object' && args[0].id) {
            const rowId = args[0].id
            window.myConfirmedWrites.add(rowId)
            const idToClean = rowId
            setTimeout(() => { window.myConfirmedWrites.delete(idToClean) }, 5 * 60 * 1000)
          }
          
          const result = originalValue.apply(target, args)
          return wrapFilterBuilder(result, tableName)
        }
      }
      return originalValue
    }
  })
}

// Wrap PostgrestQueryBuilder methods
function wrapQueryBuilder(builder, tableName) {
  const originalInsert = builder.insert
  const originalUpdate = builder.update
  const originalUpsert = builder.upsert

  builder.insert = function (values, options) {
    const isArray = Array.isArray(values)
    const cloned = isArray ? values.map(v => ({ ...v })) : (values ? { ...values } : {})
    const records = isArray ? cloned : [cloned]
    
    for (const r of records) {
      if (r && typeof r === 'object') {
        if (!r.id) {
          r.id = generateUUID()
        }
        window.myConfirmedWrites.add(r.id)
        const idToClean = r.id
        setTimeout(() => {
          window.myConfirmedWrites.delete(idToClean)
        }, 5 * 60 * 1000)
      }
    }
    
    const filterBuilder = originalInsert.call(this, cloned, options)
    return wrapFilterBuilder(filterBuilder, tableName)
  }

  builder.update = function (values, options) {
    const filterBuilder = originalUpdate.call(this, values, options)
    return wrapFilterBuilder(filterBuilder, tableName)
  }

  builder.upsert = function (values, options) {
    const isArray = Array.isArray(values)
    const records = isArray ? values : [values]
    
    for (const r of records) {
      if (r && typeof r === 'object' && r.id) {
        window.myConfirmedWrites.add(r.id)
        const idToClean = r.id
        setTimeout(() => {
          window.myConfirmedWrites.delete(idToClean)
        }, 5 * 60 * 1000)
      }
    }
    
    const filterBuilder = originalUpsert.call(this, values, options)
    return wrapFilterBuilder(filterBuilder, tableName)
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

