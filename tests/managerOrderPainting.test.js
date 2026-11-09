import { describe, it, expect } from 'vitest'
import {
  PAINTING_TYPES,
  DEFAULT_PAINTING_COLORS,
  getOrderPaintingInfo
} from '../src/modules/Manager/constants/paintingConstants'

describe('Manager Order Painting Options & Helper', () => {
  it('exposes valid painting types for manager selection', () => {
    expect(PAINTING_TYPES.map(t => t.value)).toEqual(['none', 'full', 'edges'])
    expect(PAINTING_TYPES.find(t => t.value === 'none')?.label).toBe('Без фарбування')
    expect(PAINTING_TYPES.find(t => t.value === 'full')?.label).toBe('Повне фарбування')
    expect(PAINTING_TYPES.find(t => t.value === 'edges')?.label).toBe('Фарбування торців')
  })

  it('provides default colors list until customized by user', () => {
    expect(Array.isArray(DEFAULT_PAINTING_COLORS)).toBe(true)
    expect(DEFAULT_PAINTING_COLORS).toContain('Зелений')
    expect(DEFAULT_PAINTING_COLORS).toContain('Червоний')
  })

  it('returns safe default for order without painting specs', () => {
    expect(getOrderPaintingInfo(null)).toEqual({ type: 'none', color: '', notes: '' })
    expect(getOrderPaintingInfo({})).toEqual({ type: 'none', color: '', notes: '' })
    expect(getOrderPaintingInfo({ report: '' })).toEqual({ type: 'none', color: '', notes: '' })
  })

  it('extracts painting info from JSON report string or object', () => {
    const orderWithJsonStr = {
      id: 'ord-1',
      report: JSON.stringify({
        batch_schedule: [],
        painting: { type: 'full', color: 'Зелений', notes: 'Отвори закрити' }
      })
    }
    expect(getOrderPaintingInfo(orderWithJsonStr)).toEqual({
      type: 'full',
      color: 'Зелений',
      notes: 'Отвори закрити'
    })

    const orderWithObj = {
      id: 'ord-2',
      report: {
        painting: { type: 'edges', color: 'Червоний', notes: '' }
      }
    }
    expect(getOrderPaintingInfo(orderWithObj)).toEqual({
      type: 'edges',
      color: 'Червоний',
      notes: ''
    })
  })

  it('extracts painting info from direct order fields if present', () => {
    const orderDirect = {
      id: 'ord-3',
      painting_type: 'full',
      painting_color: 'Чорний мат',
      painting_notes: 'Терміново'
    }
    expect(getOrderPaintingInfo(orderDirect)).toEqual({
      type: 'full',
      color: 'Чорний мат',
      notes: 'Терміново'
    })
  })
})

