import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { filterIssueGroups, WarehouseIssueWorkspace } from '../src/modules/Warehouse/components/WarehouseIssueWorkspace.jsx'

describe('Operational warehouse issue workspace', () => {
  const groups = {
    first: [{ id: 'r1', order_id: 'o1', details: 'Лист Т300' }, { id: 'r2', order_id: 'o1', details: 'Фреза' }],
    second: [{ id: 'r3', order_id: 'o2', details: 'Лист Т700' }]
  }
  it('keeps the entire naryad when one material matches, preserving the issue payload', () => {
    const result = filterIssueGroups(groups, 'фреза')
    expect(Object.keys(result)).toEqual(['first'])
    expect(result.first).toBe(groups.first)
    expect(result.first).toHaveLength(2)
  })
  it('finds the naryad by its order number', () => {
    const result = filterIssueGroups(groups, '260902-3', [{ id: 'o2', order_num: '260902-3' }])
    expect(Object.keys(result)).toEqual(['second'])
  })
  it('restores all groups for an empty query', () => {
    expect(filterIssueGroups(groups, ' ')).toBe(groups)
  })
  it('shows an actionable empty queue with access to stock and cutter boxes', () => {
    const html = renderToStaticMarkup(React.createElement(WarehouseIssueWorkspace, {
      groupedRequests: {}, inventory: [], orders: [], tasks: [], nomenclatures: [], boxesCount: 4,
      onOpenStock() {}, onOpenBoxes() {}, onRefresh() {}
    }))
    expect(html).toContain('Немає заявок на видачу')
    expect(html).toContain('Залишки →')
    expect(html).toContain('Боксів фрез до підготовки')
  })
})
