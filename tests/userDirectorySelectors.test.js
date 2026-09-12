import { describe, expect, it } from 'vitest'
import {
  formatUserName,
  selectFilteredManagerNames,
  selectFilteredOperatorNames,
  selectManagerNames,
  selectOperatorNames
} from '../src/contexts/userDirectorySelectors.js'

const users = [
  { id: 1, login: 'receiver', first_name: 'Ірина', last_name: 'Бондар', position: 'Приймальник', department: 'Цех №1', shift: 'Зміна 1' },
  { id: 2, login: 'quality', first_name: 'Олег', last_name: 'Андрущенко', position: 'Контролер ВКЯ', department: 'Цех №1', shift: 'Зміна 1' },
  { id: 3, login: 'operator', first_name: 'Максим', last_name: 'Гнатюк', position: 'Оператор ЧПК', department: 'Цех №1', shift: 'Зміна 1' },
  { id: 4, login: 'sorter', first_name: 'Анна', last_name: 'Дяченко', position: 'Сортувальник', department: 'Сортування', shift: 'Зміна 2' },
  { id: 5, login: 'master', first_name: 'Петро', last_name: 'Ємець', position: 'Майстер зміни', department: 'Керівництво', shift: 'Без зміни' },
  { id: 6, login: 'prep', first_name: 'Леся', last_name: 'Жук', position: 'Працівник ВП', department: 'Відділ Підготовки', shift: 'Зміна 1' }
]

describe('user directory selectors', () => {
  it('formats names without leaking the position and falls back to login', () => {
    expect(formatUserName(users[0])).toBe('Бондар Ірина')
    expect(formatUserName({ login: 'fallback' })).toBe('fallback')
    expect(formatUserName(null)).toBe('')
  })

  it('keeps the established broad operator directory contract', () => {
    expect(selectOperatorNames(users)).toEqual([
      'Андрущенко Олег',
      'Гнатюк Максим',
      'Жук Леся'
    ])
  })

  it('uses the dedicated reception filter and returns stable alphabetical names', () => {
    expect(selectFilteredOperatorNames(users, 'Цех №1', 'Зміна 1', 'Прийомка')).toEqual([
      'Бондар Ірина'
    ])
  })

  it('includes stage departments without duplicate users', () => {
    expect(selectFilteredOperatorNames(users, null, 'Зміна 2', 'Сортування')).toEqual([
      'Дяченко Анна'
    ])
    expect(selectFilteredOperatorNames(users, 'Цех №1', 'Зміна 1', 'Підготовка')).toEqual([])
    expect(selectFilteredOperatorNames(users, null, 'Зміна 1', 'Підготовка')).toEqual([
      'Жук Леся'
    ])
    expect(selectFilteredOperatorNames([
      { id: 7, login: 'missing-position', department: 'Відділ Підготовки', shift: 'Зміна 1' }
    ], null, 'Зміна 1', 'Підготовка')).toEqual([])
  })

  it('preserves manager and department filtering', () => {
    expect(selectManagerNames(users)).toEqual(['Ємець Петро'])
    expect(selectFilteredManagerNames(users, 'Цех №1')).toEqual(['Ємець Петро'])
  })

  it('does not mutate the source user array while sorting', () => {
    const originalIds = users.map(user => user.id)
    selectFilteredOperatorNames(users, null, null)
    expect(users.map(user => user.id)).toEqual(originalIds)
  })
})
