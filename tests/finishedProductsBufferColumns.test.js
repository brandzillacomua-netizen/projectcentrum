import { describe, it, expect } from 'vitest'
import { normalizeStageGroup } from '../src/modules/ProductionAutopilot/utils/autopilotEngine'

describe('ProductionAutopilot buffer stage classification', () => {
  it('keeps legacy Буфер grouping when includeBuffers is false', () => {
    expect(normalizeStageGroup('Буфер Розкрій')).toBe('Буфер')
    expect(normalizeStageGroup('Буфер Галтовка (Вібростіл)')).toBe('Буфер')
  })

  it('splits each buffer stage into its own column when includeBuffers is true', () => {
    expect(normalizeStageGroup('Буфер Розкрій', { includeBuffers: true })).toBe('Буфер Розкрій')
    expect(normalizeStageGroup('Буфер Галтовки', { includeBuffers: true })).toBe('Буфер Галтовка')
    expect(normalizeStageGroup('Буфер Галтовка (Мийка)', { includeBuffers: true })).toBe('Буфер Галтовка')
    expect(normalizeStageGroup('Буфер Прийомка', { includeBuffers: true })).toBe('Буфер Прийомка')
    expect(normalizeStageGroup('Буфер Сортування', { includeBuffers: true })).toBe('Буфер Сортування')
  })
})
