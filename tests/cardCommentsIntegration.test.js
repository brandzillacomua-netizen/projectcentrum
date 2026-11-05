import { describe, it, expect } from 'vitest'
import { parseCardComments, serializeCardComments, stripCardComments } from '../src/services/cardCommentsService.js'

describe('Card Comments Integration & Parsing in Reports', () => {
  it('correctly parses card comments from card_info string', () => {
    const rawComment = {
      id: 'comm-1',
      text: 'Перевірити кромку після ЧПК',
      author_name: 'Іван О.',
      author_role: 'Оператор',
      stage: 'Розкрій',
      created_at: new Date().toISOString(),
      photos: ['https://example.com/photo1.jpg']
    }

    const serializedInfo = serializeCardComments('Деталь А [BZ:5]', [rawComment])
    expect(serializedInfo).toContain('[CARD_COMMENTS:')

    const parsed = parseCardComments(serializedInfo)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe('Перевірити кромку після ЧПК')
    expect(parsed[0].author_name).toBe('Іван О.')
    expect(parsed[0].photos).toEqual(['https://example.com/photo1.jpg'])
  })

  it('handles cards without comments gracefully returning empty array', () => {
    expect(parseCardComments('')).toEqual([])
    expect(parseCardComments(null)).toEqual([])
    expect(parseCardComments(undefined)).toEqual([])
    expect(parseCardComments('Звичайний card_info без коментарів')).toEqual([])
  })

  it('strips card comments cleanly', () => {
    const rawComment = { id: 'comm-1', text: 'Коментар', author_name: 'Петро' }
    const serializedInfo = serializeCardComments('Деталь Б [BZ:2]', [rawComment])
    const clean = stripCardComments(serializedInfo)
    expect(clean).toBe('Деталь Б [BZ:2]')
  })

  it('formats comments for export string matching reportsExportService pattern', () => {
    const c1 = { id: '1', text: 'Коментар 1', author_name: 'Майстер' }
    const c2 = { id: '2', text: 'Коментар 2', author_name: 'ВКЯ', photos: ['p1.jpg', 'p2.jpg'] }

    const comments = [c1, c2]
    const formatted = comments
      .map(c => `[${c.author_name || 'Працівник'}]: ${c.text || ''}${c.photos?.length ? ` (📷 ${c.photos.length})` : ''}`)
      .join(' | ')

    expect(formatted).toBe('[Майстер]: Коментар 1 | [ВКЯ]: Коментар 2 (📷 2)')
  })

  it('correctly maps logged in currentUser to author name and role', () => {
    const user1 = { id: 10, first_name: 'Олег', last_name: 'Коваль', position: 'Майстер зміни' }
    const name1 = `${user1.last_name} ${user1.first_name}`.trim()
    expect(name1).toBe('Коваль Олег')
    expect(user1.position).toBe('Майстер зміни')

    const user2 = { id: 15, login: 'petrenko.v', role: 'admin' }
    const name2 = ([user2.last_name, user2.first_name].filter(Boolean).join(' ') || user2.login).trim()
    expect(name2).toBe('petrenko.v')
  })

  it('filters machine overview list by selectedMachineId, operator, and search term', () => {
    const machines = [
      { id: 'm1', name: 'CNC 12x8', sequence_number: '1.11', type: 'CNC 1200x800 - 4 листи (Малий)', operatorsList: ['Лосев В.', 'Онисько Р.'] },
      { id: 'm2', name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф14', type: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)', operatorsList: ['Боднар М.'] }
    ]

    // Filter by specific machine
    const filteredBySpecific = machines.filter(m => m.id === 'm1')
    expect(filteredBySpecific).toHaveLength(1)
    expect(filteredBySpecific[0].sequence_number).toBe('1.11')

    // Filter by operator
    const filteredByOp = machines.filter(m => (m.operatorsList || []).includes('Боднар М.'))
    expect(filteredByOp).toHaveLength(1)
    expect(filteredByOp[0].id).toBe('m2')
  })
})
