const DB_NAME = 'centrum-mes-cache'
const DB_VERSION = 1
const STORE_NAME = 'app-cache'

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB is not supported'))
    return
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION)
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

export const getIndexedCache = key => runTransaction('readonly', store => store.get(key))
export const setIndexedCache = (key, value) => runTransaction('readwrite', store => store.put(value, key))
export const removeIndexedCache = key => runTransaction('readwrite', store => store.delete(key))