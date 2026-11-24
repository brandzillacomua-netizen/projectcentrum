import { describe, expect, it } from 'vitest'
import {
  selectFilteredManagerNames,
  selectFilteredOperatorNames,
  selectManagerNames,
  selectOperatorNames
} from '../src/contexts/userDirectorySelectors.js'

describe('Soft-dismissed users exclusion from active operator/manager pickers', () => {
  const users = [
    { id: 1, login: 'op1', first_name: 'Іван', last_name: 'Петренко', position: 'Оператор', department: 'Цех №1', shift: 'Зміна 1', is_dismissed: false },
    { id: 2, login: 'op2', first_name: 'Петро', last_name: 'Сидоренко', position: 'Оператор', department: 'Цех №1', shift: 'Зміна 1', is_dismissed: true },
    { id: 3, login: 'm1', first_name: 'Олег', last_name: 'Коваль', position: 'Майстер цеху', department: 'Цех №1', shift: 'Без зміни', is_dismissed: false },
    { id: 4, login: 'm2', first_name: 'Сергій', last_name: 'Бондар', position: 'Майстер цеху', department: 'Цех №1', shift: 'Без зміни', is_dismissed: true }
  ]

  it('excludes dismissed users from operator selectors', () => {
    expect(selectOperatorNames(users)).toEqual(['Петренко Іван'])
    expect(selectFilteredOperatorNames(users, 'Цех №1', 'Зміна 1')).toEqual(['Петренко Іван'])
  })

  it('excludes dismissed users from manager selectors', () => {
    expect(selectManagerNames(users)).toEqual(['Коваль Олег'])
    expect(selectFilteredManagerNames(users, 'Цех №1')).toEqual(['Коваль Олег'])
  })
})
