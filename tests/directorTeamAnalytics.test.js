import { describe, it, expect } from 'vitest'
import {
  filterHistoryByDate,
  calculateOperatorTier,
  computeOperatorsStats,
  computeShiftStats,
  generateTeamAIInsights
} from '../src/modules/Director/team/utils/teamAnalyticsHelpers.js'
import { processGeminiQuery } from '../src/modules/Director/team/utils/geminiQueryProcessor.js'

describe('Director Team AI Analytics Helpers', () => {
  const fixedNow = new Date('2026-10-31T20:00:00.000Z')

  const mockUsers = [
    { first_name: 'Назар', last_name: 'Когут', position: 'Оператор ЧПК', department: 'Цех №1', shift: 'Зміна 3' },
    { first_name: 'Данило', last_name: 'Вайнапель', position: 'Оператор ЧПК', department: 'Цех №1', shift: 'Зміна 3' },
    { first_name: 'Іван', last_name: 'Петренко', position: 'Фрезерувальник', department: 'Цех №2', shift: 'Зміна 1' }
  ]

  const mockNomenclatures = [
    { id: 'nom-1', name: 'Рама KHARAК 10' },
    { id: 'nom-2', name: 'Комплект карбону V2' }
  ]

  const mockHistory = [
    {
      card_id: 'c1',
      operator_name: 'Когут Назар',
      nomenclature_id: 'nom-1',
      product_name: 'Рама KHARAК 10',
      machine_name: '№15',
      shift_name: 'Зміна 3',
      stage_name: 'Розкрій',
      qty_completed: 150,
      scrap_qty: 2,
      duration_active_sec: 3600, // 1 hour -> 150 pcs/hr
      duration_pause_sec: 600,
      pause_reason: 'Перевірка фрези',
      cutters_used: 1,
      started_at: '2026-10-31T18:00:00.000Z'
    },
    {
      card_id: 'c2',
      operator_name: 'Вайнапель Данило',
      nomenclature_id: 'nom-2',
      product_name: 'Комплект карбону V2',
      machine_name: '№1.12',
      shift_name: 'Зміна 3',
      stage_name: 'Розкрій',
      qty_completed: 200,
      scrap_qty: 15, // High scrap
      duration_active_sec: 7200, // 2 hours -> 100 pcs/hr
      duration_pause_sec: 1800,
      pause_reason: 'Заміна інструменту',
      cutters_used: 3,
      started_at: '2026-10-30T10:00:00.000Z'
    },
    {
      card_id: 'c3',
      operator_name: 'Петренко Іван',
      nomenclature_id: 'nom-1',
      product_name: 'Рама KHARAК 10',
      machine_name: '№2.01',
      shift_name: 'Зміна 1',
      stage_name: 'Фрезерування Цех 2',
      qty_completed: 600,
      scrap_qty: 1,
      duration_active_sec: 7200,
      duration_pause_sec: 300,
      cutters_used: 1,
      started_at: '2026-09-01T10:00:00.000Z' // old date
    }
  ]

  it('filters history correctly by dateRange', () => {
    // 7d should include items from Oct 31 and Oct 30, but not Sep 01
    const res7d = filterHistoryByDate(mockHistory, '7d', fixedNow)
    expect(res7d.length).toBe(2)
    expect(res7d.map(h => h.operator_name)).toEqual(['Когут Назар', 'Вайнапель Данило'])

    // 'all' includes all
    const resAll = filterHistoryByDate(mockHistory, 'all', fixedNow)
    expect(resAll.length).toBe(3)
  })

  it('calculates operator executive tiers accurately', () => {
    expect(calculateOperatorTier(95, 1.2).tier).toBe('S')
    expect(calculateOperatorTier(95, 4.5).tier).toBe('A') // high scrap drops from S
    expect(calculateOperatorTier(75, 2.0).tier).toBe('A')
    expect(calculateOperatorTier(55, 1.0).tier).toBe('B')
    expect(calculateOperatorTier(35, 8.0).tier).toBe('C')
  })

  it('computes operator stats, speed, scrap rate and rankings', () => {
    const stats = computeOperatorsStats({
      filteredHistory: mockHistory.slice(0, 2),
      systemUsers: mockUsers,
      nomenclatures: mockNomenclatures,
      selectedDept: 'ALL',
      searchQuery: ''
    })

    expect(stats.length).toBe(2)
    const kohut = stats.find(s => s.name === 'Когут Назар')
    expect(kohut).toBeDefined()
    expect(kohut.producedQty).toBe(150)
    expect(kohut.scrapQty).toBe(2)
    expect(kohut.unitsPerHour).toBe(150)
    expect(kohut.topMachine).toBe('№15')
    expect(kohut.topPauseReason).toBe('Перевірка фрези')

    const vayn = stats.find(s => s.name === 'Вайнапель Данило')
    expect(vayn).toBeDefined()
    expect(vayn.producedQty).toBe(200)
    expect(vayn.scrapQty).toBe(15)
    expect(vayn.unitsPerHour).toBe(100)
    expect(vayn.scrapRate).toBeGreaterThan(6)
  })

  it('aggregates shift statistics and compares performance', () => {
    const stats = computeOperatorsStats({
      filteredHistory: mockHistory.slice(0, 2),
      systemUsers: mockUsers,
      nomenclatures: mockNomenclatures,
      selectedDept: 'ALL',
      searchQuery: ''
    })

    const shifts = computeShiftStats(stats)
    expect(shifts.length).toBe(4)
    const shift3 = shifts.find(s => s.name === 'Зміна 3')
    expect(shift3).toBeDefined()
    expect(shift3.produced).toBe(350)
    expect(shift3.scrap).toBe(17)
    expect(shift3.operatorsCount).toBe(2)
  })

  it('generates actionable AI Insights and leadership directives', () => {
    const stats = computeOperatorsStats({
      filteredHistory: mockHistory.slice(0, 2),
      systemUsers: mockUsers,
      nomenclatures: mockNomenclatures,
      selectedDept: 'ALL',
      searchQuery: ''
    })
    const shifts = computeShiftStats(stats)
    const insights = generateTeamAIInsights(stats, shifts)

    expect(insights.length).toBeGreaterThan(0)
    // Speed leader should be Kohut (150 pcs/hr)
    const speedInsight = insights.find(i => i.type === 'speed')
    expect(speedInsight).toBeDefined()
    expect(speedInsight.operatorName).toBe('Когут Назар')

    // High scrap risk alert for Vayn
    const scrapInsight = insights.find(i => i.type === 'warning')
    expect(scrapInsight).toBeDefined()
    expect(scrapInsight.operatorName).toBe('Вайнапель Данило')
  })

  it('answers Director queries via Gemini NLP processor accurately', () => {
    const stats = computeOperatorsStats({
      filteredHistory: mockHistory.slice(0, 2),
      systemUsers: mockUsers,
      nomenclatures: mockNomenclatures,
      selectedDept: 'ALL',
      searchQuery: ''
    })
    const shifts = computeShiftStats(stats)

    // 1. Leader query
    const leaderRes = processGeminiQuery('Хто найкращий оператор цього місяця?', {
      operators: stats,
      shifts,
      history: mockHistory,
      nomenclatures: mockNomenclatures
    })
    expect(leaderRes.text).toContain('Рейтинг ефективності')
    expect(leaderRes.highlightOperator).toBeDefined()
    expect(leaderRes.highlightOperator.name).toBe('Когут Назар')

    // 2. Scrap query
    const scrapRes = processGeminiQuery('У кого найбільший брак і дефекти?', {
      operators: stats,
      shifts,
      history: mockHistory,
      nomenclatures: mockNomenclatures
    })
    expect(scrapRes.badge).toBe('⚠️ Зона ризику браку')
    expect(scrapRes.text).toContain('Вайнапель Данило')

    // 3. Shift query
    const shiftRes = processGeminiQuery('Порівняй ефективність зміни 1 та 3', {
      operators: stats,
      shifts,
      history: mockHistory,
      nomenclatures: mockNomenclatures
    })
    expect(shiftRes.badge).toContain('Бенчмарк')
    expect(shiftRes.text).toContain('Зміна 3')

    // 4. Specific operator dossier query
    const opRes = processGeminiQuery('Зроби повний аудит оператора Когут Назар', {
      operators: stats,
      shifts,
      history: mockHistory,
      nomenclatures: mockNomenclatures
    })
    expect(opRes.highlightOperator.name).toBe('Когут Назар')
    expect(opRes.action).toBeDefined()
    expect(opRes.action.type).toBe('OPEN_DOSSIER')

    // 5. Inventory & Cutters query: "які залишки фрез 3мм на со"
    const mockInventory = [
      { name: 'Фреза кукурудза 3х3,175х12х38', total_qty: 60, reserved_qty: 10, warehouse: 'operational', type: 'cutter' },
      { name: 'Фреза кінцева 2мм', total_qty: 25, reserved_qty: 5, warehouse: 'operational', type: 'cutter' },
      { name: 'Лист Т300 (3мм)', total_qty: 120, reserved_qty: 0, warehouse: 'raw', type: 'raw' }
    ]

    const cutterRes = processGeminiQuery('які залишки фрез 3мм на со', {
      operators: stats,
      shifts,
      history: mockHistory,
      nomenclatures: mockNomenclatures,
      inventory: mockInventory
    })

    expect(cutterRes.badge).toContain('Склад СО')
    expect(cutterRes.text).toContain('Фреза кукурудза 3х3,175х12х38')
    expect(cutterRes.text).toContain('60 шт')
    expect(cutterRes.text).toContain('50 шт')

    // 6. Conversational query: "За які дати ти береш дані?"
    const dateRes = processGeminiQuery('За які дати ти береш дані?', {
      operators: stats,
      shifts,
      history: mockHistory,
      dateRange: '30d'
    })
    expect(dateRes.badge).toBe('📅 Період аналізу')
    expect(dateRes.text).toContain('останні 30 днів')

    // 7. Conversational greeting: "Привіт! Як справи?"
    const greetRes = processGeminiQuery('Привіт! Як справи?', {
      operators: stats,
      shifts,
      history: mockHistory
    })
    expect(greetRes.badge).toBe('👋 CENTRUM AI')
    expect(greetRes.text).toContain('Радий поспілкуватись')

    // 8. Provenance / reports discrepancy query
    const provRes = processGeminiQuery('А звідки воно блядь інфо бере бо в мене звіти показують іншу інформацію', {
      operators: stats,
      shifts,
      history: mockHistory,
      dateRange: '30d'
    })
    expect(provRes.badge).toContain('Джерела даних та методологія')
    expect(provRes.text).toContain('work_card_history')
    expect(provRes.text).toContain('Операційний виробіток')
    expect(provRes.text).toContain('Звітах (1С / Леджер)')

    // 9. Active work cards query
    const cardsRes = processGeminiQuery('Скільки карт робочих в роботі зараз?', {
      operators: stats,
      shifts,
      workCards: [
        { id: 'c-101', product_name: 'Рама KHARAК 10', quantity: 150, status: 'in_progress', operation: 'Розкрій', operator_name: 'Когут Назар' }
      ]
    })
    expect(cardsRes.badge).toBe('📋 Наряди в роботі')
    expect(cardsRes.text).toContain('1 робочих карт')
    expect(cardsRes.text).toContain('Рама KHARAК 10')
    expect(cardsRes.text).toContain('Когут Назар')
  })
})

