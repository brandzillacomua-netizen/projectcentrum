import { describe, it, expect } from 'vitest'
import {
  encryptCorporateText,
  decryptCorporateText,
  decryptCorporatePost,
  decryptCorporatePostList,
  decryptCorporateComment,
  decryptCorporateCommentList
} from '../src/utils/corporateCrypto.js'

describe('corporateCrypto client-side ChaCha20 encryption suite', () => {
  it('encrypts plaintext into [ENC:v1:nonce:cipher] and decrypts back correctly', () => {
    const original = 'Терміновий наказ керівництва щодо другої зміни та перевірки обладнання!'
    const encrypted = encryptCorporateText(original, 'post_title')

    expect(encrypted).not.toBe(original)
    expect(encrypted.startsWith('[ENC:v1:')).toBe(true)

    const decrypted = decryptCorporateText(encrypted, 'post_title')
    expect(decrypted).toBe(original)
  })

  it('handles multiline text with Ukrainian characters, quotes and symbols', () => {
    const multiline = `Офіційне розпорядження:\n1. Перевірити «Верстат №2»\n2. Дедлайн: 18:00\n3. Відповідальні: @[Олександр Станько](123)`
    const encrypted = encryptCorporateText(multiline, 'post_content')

    expect(encrypted.startsWith('[ENC:v1:')).toBe(true)
    const decrypted = decryptCorporateText(encrypted, 'post_content')
    expect(decrypted).toBe(multiline)
  })

  it('does not double encrypt already encrypted strings', () => {
    const text = 'Привіт команді'
    const enc1 = encryptCorporateText(text, 'post_content')
    const enc2 = encryptCorporateText(enc1, 'post_content')

    expect(enc2).toBe(enc1)
    expect(decryptCorporateText(enc2, 'post_content')).toBe(text)
  })

  it('preserves unencrypted plaintext for backwards compatibility', () => {
    const legacy = 'Старий допис створений до ввімкнення шифрування'
    expect(decryptCorporateText(legacy, 'post_content')).toBe(legacy)
    expect(decryptCorporateText(null)).toBe(null)
    expect(decryptCorporateText('')).toBe('')
  })

  it('decrypts corporate post objects and lists correctly', () => {
    const rawPosts = [
      {
        id: 1,
        title: encryptCorporateText('Тема 1', 'post_title'),
        content: encryptCorporateText('Текст першого допису', 'post_content'),
        category: 'announcement'
      },
      {
        id: 2,
        title: 'Стара незашифрована тема',
        content: 'Старий незашифрований текст',
        category: 'discussion'
      }
    ]

    const decrypted = decryptCorporatePostList(rawPosts)
    expect(decrypted[0].title).toBe('Тема 1')
    expect(decrypted[0].content).toBe('Текст першого допису')
    expect(decrypted[1].title).toBe('Стара незашифрована тема')
    expect(decrypted[1].content).toBe('Старий незашифрований текст')
  })

  it('decrypts corporate comment objects and lists correctly', () => {
    const rawComments = [
      {
        id: 101,
        content: encryptCorporateText('Погоджено, беремо в роботу', 'comment_content')
      },
      {
        id: 102,
        content: 'Старий коментар без шифрування'
      }
    ]

    const decrypted = decryptCorporateCommentList(rawComments)
    expect(decrypted[0].content).toBe('Погоджено, беремо в роботу')
    expect(decrypted[1].content).toBe('Старий коментар без шифрування')
  })
})

