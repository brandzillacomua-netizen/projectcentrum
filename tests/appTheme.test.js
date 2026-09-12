import { describe, expect, it, vi } from 'vitest'
import { applyBodyTheme, nextTheme, resolveInitialTheme } from '../src/contexts/useAppTheme.js'

const createStorage = entries => {
  const values = new Map(Object.entries(entries || {}))
  return {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values
  }
}

describe('application theme helpers', () => {
  it('performs the one-time light theme reset exactly as before', () => {
    const storage = createStorage({ 'app-theme': 'dark' })
    expect(resolveInitialTheme(storage)).toBe('light')
    expect(storage.values.get('app-theme')).toBe('light')
    expect(storage.values.get('theme-reset-light-v1')).toBe('true')
  })

  it('restores the saved theme after the reset marker exists', () => {
    const storage = createStorage({
      'app-theme': 'dark',
      'theme-reset-light-v1': 'true'
    })
    expect(resolveInitialTheme(storage)).toBe('dark')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('falls back to light and toggles deterministically', () => {
    const storage = createStorage({ 'theme-reset-light-v1': 'true' })
    expect(resolveInitialTheme(storage)).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })

  it('changes only the light-theme body class', () => {
    const classList = { add: vi.fn(), remove: vi.fn() }
    applyBodyTheme({ classList }, 'light')
    expect(classList.add).toHaveBeenCalledWith('light-theme')
    expect(classList.remove).not.toHaveBeenCalled()

    classList.add.mockClear()
    applyBodyTheme({ classList }, 'dark')
    expect(classList.remove).toHaveBeenCalledWith('light-theme')
    expect(classList.add).not.toHaveBeenCalled()
  })
})
