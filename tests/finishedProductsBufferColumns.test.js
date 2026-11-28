import { describe, it, expect } from 'vitest'
import {
  extractLogIntervalMs,
  mergeIntervalsMinutes,
  normalizeStageGroup
} from '../src/modules/ProductionAutopilot/utils/autopilotEngine'

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

describe('mergeIntervalsMinutes (wall-clock mode)', () => {
  it('merges overlapping parallel intervals without double-counting', () => {
    const t0 = Date.parse('2026-11-10T08:00:00Z')
    const iv1 = [t0, t0 + 120 * 60000] // 08:00 - 10:00 (120m)
    const iv2 = [t0 + 30 * 60000, t0 + 150 * 60000] // 08:30 - 10:30 (120m)
    const iv3 = [t0 + 200 * 60000, t0 + 260 * 60000] // 11:20 - 12:20 (60m)
    expect(mergeIntervalsMinutes([iv1, iv2, iv3])).toBe(210)
  })

  it('caps log intervals at 48 hours matching SQL RPC', () => {
    const iv = extractLogIntervalMs({
      started_at: '2026-11-10T00:00:00Z',
      completed_at: '2026-11-15T00:00:00Z'
    })
    expect(mergeIntervalsMinutes([iv])).toBe(48 * 60)
  })
})
