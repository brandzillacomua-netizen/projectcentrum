export function createStableFetcherFacade(getLatestFetchers, keys) {
  return Object.fromEntries(keys.map(key => [key, (...args) => {
    const latest = getLatestFetchers()
    const implementation = latest?.[key]
    if (typeof implementation !== 'function') {
      throw new TypeError(`Missing data fetcher implementation: ${key}`)
    }
    return implementation(...args)
  }]))
}
