import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInitialStoreState } from '../src/store/index.js'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))
const selectorPattern = /useStore\(state\s*=>\s*state\.([A-Za-z0-9_]+)/g

const sourceFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name)
  if (entry.isDirectory()) return sourceFiles(path)
  return ['.js', '.jsx', '.mjs'].includes(extname(entry.name)) ? [path] : []
})

const selectedStoreKeys = () => {
  const selectedKeys = new Set()
  for (const file of sourceFiles(sourceRoot)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(selectorPattern)) selectedKeys.add(match[1])
  }
  return [...selectedKeys].sort()
}

describe('Zustand read-model contract', () => {
  it('declares a safe initial value for every selector used by the application', () => {
    const initialState = createInitialStoreState()
    const missingKeys = selectedStoreKeys()
      .filter(key => !Object.prototype.hasOwnProperty.call(initialState, key) && key !== 'setStoreData')

    expect(missingKeys).toEqual([])
  })

  it('keeps mutation functions in MESContext during the read-model migration', () => {
    expect(selectedStoreKeys().filter(key => key.startsWith('set'))).toEqual([])
  })

  it('mirrors every selected read model from dataState', () => {
    const dataStateSource = readFileSync(new URL('../src/contexts/data/dataState.js', import.meta.url), 'utf8')
    const syncBlock = dataStateSource.match(/useStore\.setState\(\{([\s\S]*?)\}\)/)?.[1] || ''
    const missingFromSync = selectedStoreKeys().filter(key => (
      key !== 'setStoreData' && !new RegExp(`\\b${key}\\b`).test(syncBlock)
    ))

    expect(missingFromSync).toEqual([])
  })

  it('returns fresh containers so test and session resets cannot share mutable state', () => {
    const first = createInitialStoreState()
    const second = createInitialStoreState()

    expect(first).not.toBe(second)
    expect(first.tasks).not.toBe(second.tasks)
    expect(first.productionData).not.toBe(second.productionData)
  })
})
