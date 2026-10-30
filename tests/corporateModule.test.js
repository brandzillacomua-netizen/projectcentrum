import { describe, it, expect } from 'vitest'
import {
  bytesToLabel,
  extractMentionedUserIds,
  renderFormattedContent
} from '../src/modules/Corporate/utils/corporateHelpers'

describe('Corporate Module Helpers', () => {
  it('formats byte labels correctly', () => {
    expect(bytesToLabel(0)).toBe('0 B')
    expect(bytesToLabel(512)).toBe('512 B')
    expect(bytesToLabel(1024)).toBe('1.0 KB')
    expect(bytesToLabel(1048576 * 2.5)).toBe('2.5 MB')
  })

  it('extracts mentioned user IDs from content', () => {
    const text = 'Привіт @[Роман](usr_1) та @[Олександр](usr_2), перевірте креслення.'
    const ids = extractMentionedUserIds(text)
    expect(ids).toEqual(['usr_1', 'usr_2'])
  })

  it('renders content with formatted mention tokens', () => {
    const text = 'Увага @[Роман](usr_1) регламент оновлено'
    const tokens = renderFormattedContent(text, [{ id: 'usr_1', first_name: 'Роман', last_name: 'Шиманський' }])
    expect(tokens.length).toBe(3)
    expect(tokens[0]).toBe('Увага ')
    expect(tokens[1]).toEqual({
      isMention: true,
      userId: 'usr_1',
      name: 'Роман Шиманський'
    })
    expect(tokens[2]).toBe(' регламент оновлено')
  })
})

