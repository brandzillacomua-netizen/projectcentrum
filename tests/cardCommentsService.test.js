import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  parseCardComments,
  stripCardComments,
  serializeCardComments,
  saveCardComment
} from '../src/services/cardCommentsService.js'

describe('Card Comments Service Unit Tests', () => {
  it('parses empty array when no comments tag exists in card_info', () => {
    expect(parseCardComments('')).toEqual([])
    expect(parseCardComments(null)).toEqual([])
    expect(parseCardComments('[SHEETS:4] [REQ:88]')).toEqual([])
  })

  it('correctly parses comments from [CARD_COMMENTS:[...]] tag', () => {
    const mockComments = [
      {
        id: 'c-1',
        author_name: 'Вайнапель Данило',
        author_role: 'Оператор ЧПК',
        stage: 'Розкрій',
        text: 'Пластик 4мм має захисну плівку з одного боку',
        created_at: '2026-11-03T14:30:00.000Z'
      },
      {
        id: 'c-2',
        author_name: 'ВКЯ Микола',
        author_role: 'ВКЯ',
        stage: 'Розкрій',
        text: 'Отвори перевірено, допуск в нормі',
        created_at: '2026-11-03T15:10:00.000Z'
      }
    ]

    const cardInfo = `[SHEETS:4] [CARD_COMMENTS:${JSON.stringify(mockComments)}] [QC_OPS:{"lastStamp":"ВКЯ 5"}]`
    const parsed = parseCardComments(cardInfo)

    expect(parsed).toHaveLength(2)
    expect(parsed[0].author_name).toBe('Вайнапель Данило')
    expect(parsed[0].text).toContain('Пластик 4мм')
    expect(parsed[1].author_role).toBe('ВКЯ')
  })

  it('also parses legacy [COMMENTS:[...]] tag for backwards compatibility', () => {
    const mockComments = [
      {
        id: 'c-legacy',
        author_name: 'Петренко Іван',
        text: 'Старий коментар'
      }
    ]
    const cardInfo = `[COMMENTS:${JSON.stringify(mockComments)}]`
    const parsed = parseCardComments(cardInfo)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe('c-legacy')
    expect(parsed[0].text).toBe('Старий коментар')
  })

  it('stripCardComments cleanly removes comment tags while preserving other tags', () => {
    const raw = '[SHEETS:4] [CARD_COMMENTS:[{"id":"1","text":"Примітка"}]] [REQ:88]'
    const stripped = stripCardComments(raw)

    expect(stripped).toContain('[SHEETS:4]')
    expect(stripped).toContain('[REQ:88]')
    expect(stripped).not.toContain('CARD_COMMENTS')
    expect(stripped).not.toContain('Примітка')
  })

  it('serializeCardComments updates card_info preserving existing metadata', () => {
    const initialCardInfo = '[SHEETS:2] [BZ:10]'
    const newComments = [
      {
        id: 'cmt-new',
        author_name: 'Когут Назар',
        author_role: 'Оператор',
        stage: 'Галтовка',
        text: 'Залишено на 15 хв довше через задирки',
        photos: [{ url: 'https://example.com/photo1.jpg', name: 'photo1.jpg' }]
      }
    ]

    const serialized = serializeCardComments(initialCardInfo, newComments)

    expect(serialized).toContain('[SHEETS:2]')
    expect(serialized).toContain('[BZ:10]')
    expect(serialized).toContain('[CARD_COMMENTS:')
    expect(serialized).toContain('Залишено на 15 хв довше')
    expect(serialized).toContain('https://example.com/photo1.jpg')

    // Re-parsing gives exact structure back
    const reParsed = parseCardComments(serialized)
    expect(reParsed).toHaveLength(1)
    expect(reParsed[0].author_name).toBe('Когут Назар')
    expect(reParsed[0].photos).toHaveLength(1)
  })

  it('validates that comment text or photos must be provided', async () => {
    await expect(saveCardComment({
      card: { id: 'card-1' },
      text: '',
      photos: []
    })).rejects.toThrow('Коментар не може бути порожнім')
  })

  it('validates that card must have an id', async () => {
    await expect(saveCardComment({
      card: null,
      text: 'Тест'
    })).rejects.toThrow('Не вказано картку для додавання коментаря')
  })
})

