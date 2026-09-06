// Global browser mock environment for Vitest tests
if (typeof window === 'undefined') {
  globalThis.window = {
    Date: globalThis.Date,
    timeDrift: 0,
    myConfirmedWrites: new Set(),
    localStorage: {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
      clear() { this._store = {}; }
    },
    sessionStorage: {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
      clear() { this._store = {}; }
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: 'http://localhost' }
  };
  globalThis.localStorage = globalThis.window.localStorage;
  globalThis.sessionStorage = globalThis.window.sessionStorage;
  const idbStore = new Map()
  globalThis.window.indexedDB = {
    open() {
      const req = {
        result: {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => {},
          transaction() {
            return {
              objectStore() {
                return {
                  get(key) {
                    const r = { result: idbStore.get(key) }
                    setTimeout(() => r.onsuccess && r.onsuccess(), 0)
                    return r
                  },
                  put(val, key) {
                    idbStore.set(key, val)
                    const r = { result: key }
                    setTimeout(() => r.onsuccess && r.onsuccess(), 0)
                    return r
                  },
                  delete(key) {
                    idbStore.delete(key)
                    const r = { result: undefined }
                    setTimeout(() => r.onsuccess && r.onsuccess(), 0)
                    return r
                  }
                }
              },
              onabort: null
            }
          },
          close: () => {}
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      }
      setTimeout(() => req.onsuccess && req.onsuccess(), 0)
      return req
    }
  }
  globalThis.indexedDB = globalThis.window.indexedDB

  try {
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true
    });
  } catch {
    // navigator already has onLine
  }
}
