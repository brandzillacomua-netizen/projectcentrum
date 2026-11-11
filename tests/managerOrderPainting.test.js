import { describe, it, expect } from 'vitest'
import {
  PAINTING_TYPES,
  FULL_PAINTING_BASE_COLOR,
  EDGE_PAINTING_COLORS,
  formatPaintingColor,
  extractEdgeColor,
  getOrderPaintingInfo
} from '../src/modules/Manager/constants/paintingConstants'

describe('Manager Order Painting Options & Edge/Full Rules', () => {
  it('exposes valid painting types for manager selection', () => {
    expect(PAINTING_TYPES.map(t => t.value)).toEqual(['none', 'full', 'edges'])
    expect(PAINTING_TYPES.find(t => t.value === 'none')?.label).toBe('Без фарбування')
    expect(PAINTING_TYPES.find(t => t.value === 'full')?.label).toBe('Повне фарбування')
    expect(PAINTING_TYPES.find(t => t.value === 'edges')?.label).toBe('Фарбування торців')
  })

  it('defines fixed base color as "Чорний" and edge colors as "Помаранчевий", "Червоний", "Синій"', () => {
    expect(FULL_PAINTING_BASE_COLOR).toBe('Чорний')
    expect(EDGE_PAINTING_COLORS).toEqual(['Помаранчевий', 'Червоний', 'Синій'])
  })

  it('formats painting color string according to painting type', () => {
    // For full painting: base is Чорний + edge color chosen
    expect(formatPaintingColor('full', 'Помаранчевий')).toBe('Чорний (торці: Помаранчевий)')
    expect(formatPaintingColor('full', 'Червоний')).toBe('Чорний (торці: Червоний)')
    expect(formatPaintingColor('full', 'Синій')).toBe('Чорний (торці: Синій)')

    // For edge painting: only edge color
    expect(formatPaintingColor('edges', 'Помаранчевий')).toBe('Помаранчевий')
    expect(formatPaintingColor('edges', 'Червоний')).toBe('Червоний')
    expect(formatPaintingColor('edges', 'Синій')).toBe('Синій')

    // Empty cases
    expect(formatPaintingColor('full', '')).toBe('')
    expect(formatPaintingColor('none', '')).toBe('')
  })

  it('extracts edge color from formatted string or bare color', () => {
    expect(extractEdgeColor('Чорний (торці: Помаранчевий)')).toBe('Помаранчевий')
    expect(extractEdgeColor('Чорний (торці: Синій)')).toBe('Синій')
    expect(extractEdgeColor('Червоний')).toBe('Червоний')
    expect(extractEdgeColor('')).toBe('')
  })

  it('returns safe default for order without painting specs', () => {
    expect(getOrderPaintingInfo(null)).toEqual({
      type: 'none',
      color: '',
      edgeColor: '',
      baseColor: '',
      notes: ''
    })
    expect(getOrderPaintingInfo({})).toEqual({
      type: 'none',
      color: '',
      edgeColor: '',
      baseColor: '',
      notes: ''
    })
    expect(getOrderPaintingInfo({ report: '' })).toEqual({
      type: 'none',
      color: '',
      edgeColor: '',
      baseColor: '',
      notes: ''
    })
  })

  it('extracts painting info from JSON report string or object', () => {
    const orderWithJsonStr = {
      id: 'ord-1',
      report: JSON.stringify({
        batch_schedule: [],
        painting: {
          type: 'full',
          color: 'Чорний (торці: Помаранчевий)',
          edge_color: 'Помаранчевий',
          notes: 'Отвори закрити'
        }
      })
    }
    expect(getOrderPaintingInfo(orderWithJsonStr)).toEqual({
      type: 'full',
      color: 'Чорний (торці: Помаранчевий)',
      edgeColor: 'Помаранчевий',
      baseColor: 'Чорний',
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
      edgeColor: 'Червоний',
      baseColor: '',
      notes: ''
    })
  })

  it('extracts painting info from direct order fields if present', () => {
    const orderDirect = {
      id: 'ord-3',
      painting_type: 'full',
      painting_color: 'Чорний (торці: Синій)',
      painting_notes: 'Терміново'
    }
    expect(getOrderPaintingInfo(orderDirect)).toEqual({
      type: 'full',
      color: 'Чорний (торці: Синій)',
      edgeColor: 'Синій',
      baseColor: 'Чорний',
      notes: 'Терміново'
    })
  })
})
