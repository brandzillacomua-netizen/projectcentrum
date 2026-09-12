import { describe, expect, it } from 'vitest'
import { filterReceptionOperators } from '../src/utils/operatorFiltering.js'

const users = [
  { id: 1, first_name: 'Іван', position: 'Приймальник', department: 'Цех №1', shift: 'Зміна 1' },
  { id: 2, first_name: 'Олена', position: 'Працівник', department: 'Прийомка', shift: 'Без зміни' },
  { id: 3, first_name: 'Петро', position: 'Приймальник', department: 'Цех №1', shift: 'Зміна 2' },
  { id: 4, first_name: 'Марія', position: 'Комірник', department: 'Склад', shift: 'Зміна 1' },
  { id: 5, first_name: 'Тарас', position: 'Оператор розкрою', department: 'Цех №1', shift: 'Зміна 1' }
]

describe('reception operator filtering', () => {
  it('includes Shop 1 receptionists and legacy Reception department workers for the selected shift', () => {
    expect(filterReceptionOperators(users, 'Зміна 1', 'Цех №1').map(user => user.id))
      .toEqual([1, 2])
  })

  it('does not leak another shift or unrelated warehouse and cutting workers', () => {
    expect(filterReceptionOperators(users, 'Зміна 1', 'Прийомка').map(user => user.id))
      .toEqual([1, 2])
  })

  it('supports an unassigned shift without mutating the source list', () => {
    const snapshot = structuredClone(users)
    expect(filterReceptionOperators(users, 'Без зміни').map(user => user.id))
      .toEqual([1, 2, 3])
    expect(users).toEqual(snapshot)
  })
})
