import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  isShop2User,
  buildShop2TodayShiftSummary
} from '../src/modules/Shop2Foreman/utils/shop2ForemanUtils.js'
import { selectFilteredOperatorNames } from '../src/contexts/userDirectorySelectors.js'

describe('Shop 2 Foreman Cabinet & Today Shift Filtering', () => {
  const todayKey = '2026-11-12'

  const sampleUsers = [
    {
      id: 'u1',
      first_name: 'Іван',
      last_name: 'Фарбов',
      position: 'Фарбувальник',
      department: 'Цех №2',
      shift: 'Зміна 1',
      shift_calendar: { [todayKey]: 'Р' }
    },
    {
      id: 'u2',
      first_name: 'Петро',
      last_name: 'Пресов',
      position: 'Пресувальник',
      department: 'Цех 2',
      shift: 'Зміна 1',
      shift_calendar: { [todayKey]: 'Р' }
    },
    {
      id: 'u3',
      first_name: 'Олег',
      last_name: 'Вихідний',
      position: 'Фарбувальник',
      department: 'Цех №2',
      shift: 'Зміна 1',
      shift_calendar: { [todayKey]: 'В' }
    },
    {
      id: 'u4',
      first_name: 'Анатолій',
      last_name: 'Майстер',
      position: 'Начальник Цеху №2',
      department: 'Цех №2',
      shift: 'Зміна 1',
      shift_calendar: { [todayKey]: 'Р' }
    },
    {
      id: 'u5',
      first_name: 'Сергій',
      last_name: 'Цех1',
      position: 'Оператор розкрою',
      department: 'Цех №1',
      shift: 'Зміна 1',
      shift_calendar: { [todayKey]: 'Р' }
    }
  ]

  it('includes all users with department Цех 2 / Цех №2 and builds today shift summary', () => {
    const shop2Users = sampleUsers.filter(isShop2User)
    expect(shop2Users.map(u => u.id)).toEqual(['u1', 'u2', 'u3', 'u4'])

    const summary = buildShop2TodayShiftSummary(shop2Users, todayKey)
    expect(summary.totalCount).toBe(3)
    expect(summary.byRole.painting).toHaveLength(1)
    expect(summary.byRole.pressing).toHaveLength(1)
    expect(summary.byRole.masters).toHaveLength(1)
    expect(summary.byRole.painting[0].name).toBe('Фарбов Іван')
  })

  it('filters Shop 2 terminal operators by today shift_calendar with fallback to all', () => {
    const onShiftPainters = selectFilteredOperatorNames(
      sampleUsers,
      'Цех №2',
      'Зміна 1',
      'Фарбування',
      { onlyOnShiftDate: todayKey }
    )
    expect(onShiftPainters).toEqual(['Фарбов Іван'])

    const allPainters = selectFilteredOperatorNames(
      sampleUsers,
      'Цех №2',
      'Зміна 1',
      'Фарбування'
    )
    expect(allPainters).toEqual(['Вихідний Олег', 'Фарбов Іван'])

    const onShiftPressers = selectFilteredOperatorNames(
      sampleUsers,
      'Цех №2',
      'Зміна 1',
      'Пресування',
      { onlyOnShiftDate: todayKey }
    )
    expect(onShiftPressers).toEqual(['Пресов Петро'])
  })

  it('registers shop2_foreman route, permission, and Shop2CardDetails toggle', () => {
    const registrySrc = fs.readFileSync(path.resolve(process.cwd(), 'src/config/moduleRegistry.jsx'), 'utf8')
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.jsx'), 'utf8')
    const cardDetailsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/Shop2/components/Shop2CardDetails.jsx'), 'utf8')
    const settingsUsersSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/Settings/hooks/subhooks/useSettingsUsers.jsx'), 'utf8')

    expect(registrySrc).toContain("id: 'shop2_foreman'")
    expect(registrySrc).toContain("path: '/shop2-foreman'")
    expect(appSrc).toContain('/shop2-foreman')
    expect(appSrc).toContain('Shop2ForemanModule')
    expect(settingsUsersSrc).toContain("id: 'shop2_foreman'")
    expect(cardDetailsSrc).toContain('onlyOnShiftDate')
    expect(cardDetailsSrc).toContain('Показати всіх')
  })
})

