import { isTestEnvironment } from '../supabase.js'

const getDbName = () => isTestEnvironment() ? 'centrum-mes-staging-cache' : 'centrum-mes-cache'
const DB_VERSION = 1
const STORE_NAME = 'app-cache'

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB is not supported'))
    return
  }

  const dbName = getDbName()
  const request = indexedDB.open(dbName, DB_VERSION)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const runTransaction = async (mode, action) => {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = action(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

const sanitizeForIndexedDb = (val) => {
  if (!val || typeof val !== 'object') return val
  if (Array.isArray(val)) {
    return Array.from(val).map(sanitizeForIndexedDb)
  }
  const clean = {}
  for (const [k, v] of Object.entries(val)) {
    if (typeof v === 'function') continue
    if (Array.isArray(v)) {
      clean[k] = Array.from(v)
    } else if (v && typeof v === 'object') {
      clean[k] = sanitizeForIndexedDb(v)
    } else {
      clean[k] = v
    }
  }
  return clean
}

export const getIndexedCache = key => runTransaction('readonly', store => store.get(key))
export const setIndexedCache = (key, value) => {
  try {
    const cleanValue = sanitizeForIndexedDb(value)
    return runTransaction('readwrite', store => store.put(cleanValue, key))
  } catch (err) {
    return Promise.reject(err)
  }
}
export const removeIndexedCache = key => runTransaction('readwrite', store => store.delete(key))