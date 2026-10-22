import { describe, expect, it } from 'vitest'
import { buildShop1OperatorCandidates } from '../src/modules/Brak/utils/operatorAttribution.js'

describe('VKYA responsible operator candidates', () => {
  it('auto-resolves one unique production operator across multiple cutting sessions', () => {
    const candidates = buildShop1OperatorCandidates([
      { operator_name: 'Петренко Іван', stage_name: 'Розкрій', shift_name: 'Зміна 1', completed_at: '2026-10-20T08:00:00Z' },
      { operator_name: 'Петренко Іван', stage_name: 'Розкрій (перезмінка)', shift_name: 'Зміна 1', completed_at: '2026-10-20T10:00:00Z' },
      { operator_name: 'Команда', stage_name: 'Галтовка (Мийка)', shift_name: 'Зміна 1', completed_at: '2026-10-20T11:00:00Z' }
    ])

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ name: 'Петренко Іван', shifts: ['Зміна 1'] })
    expect(candidates[0].stages).toEqual(['Розкрій', 'Розкрій (перезмінка)'])
  })

  it('returns every distinct operator who worked the Shop 1 card', () => {
    const candidates = buildShop1OperatorCandidates([
      { operator_name: 'Петренко Іван', stage_name: 'Розкрій', shift_name: 'Зміна 1' },
      { operator_name: 'Коваль Андрій', stage_name: 'Розкрій (перезмінка)', shift_name: 'Зміна 2' },
      { operator_name: 'Сидоренко Олег', stage_name: 'Сортування', shift_name: 'Зміна 1' }
    ])

    expect(candidates.map(candidate => candidate.name)).toEqual([
      'Петренко Іван',
      'Коваль Андрій',
      'Сидоренко Олег'
    ])
  })

  it('excludes team, QC, buffer, TV, system, and other technical identities', () => {
    const candidates = buildShop1OperatorCandidates([
      { operator_name: 'Команда', stage_name: 'Галтовка' },
      { operator_name: 'ВКЯ Зміна 1', stage_name: 'Сортування' },
      { operator_name: 'Петренко Іван', stage_name: 'Буфер Розкрій' },
      { operator_name: 'Система', stage_name: 'Розкрій' },
      { operator_name: 'Термінал відновлення', stage_name: 'Сортування' }
    ])

    expect(candidates).toEqual([])
  })

  it('returns strictly the operators who took part in this card (including resolved galtovshchik)', () => {
    const systemUsers = [
      { id: 101, login: 'galt.zm1', first_name: 'Зміна 1', last_name: 'Галтовка', position: 'Галтовщик', department: 'Цех №1', shift: 'Зміна 1' },
      { id: 102, login: 'galt.zm2', first_name: 'Зміна 2', last_name: 'Галтовка', position: 'Галтовщик', department: 'Цех №1', shift: 'Зміна 2' },
      { id: 103, login: 'galt.zm3', first_name: 'Зміна 1', last_name: 'Галтовка', position: 'Галтовщик', department: 'Цех №1', shift: 'Зміна 3' },
      { id: 104, login: 'random.op', first_name: 'Олег', last_name: 'Сторонній', position: 'Оператор', department: 'Цех №1', shift: 'Зміна 2' }
    ]

    const historyRows = [
      { operator_name: 'Мальчин О.', stage_name: 'Розкрій (перезмінка)', shift_name: 'Зміна 4', completed_at: '2026-10-22T08:00:00Z' },
      { operator_name: 'Команда галтовки', stage_name: 'Галтовка (Мийка)', shift_name: 'Зміна 3', completed_at: '2026-10-22T09:00:00Z' },
      { operator_name: 'Арендач С.', stage_name: 'Сортування', shift_name: 'Зміна 1', completed_at: '2026-10-22T10:00:00Z' }
    ]

    const candidates = buildShop1OperatorCandidates(historyRows, systemUsers)

    // Strictly returns ONLY the 3 participants of this card
    expect(candidates.map(c => c.name)).toEqual([
      'Мальчин О.',
      'Галтовка Зміна 3',
      'Арендач С.'
    ])
  })

  it('includes press or paint operators only when they worked on this card', () => {
    const systemUsers = [
      { id: 201, login: 'press.zm1', first_name: 'Зміна 1', last_name: 'Пресувальник', position: 'Пресувальник', department: 'Цех №2', shift: 'Зміна 1' },
      { id: 202, login: 'paint.zm2', first_name: 'Зміна 2', last_name: 'Фарбувальник', position: 'Маляр', department: 'Цех №2', shift: 'Зміна 2' }
    ]

    const historyRows = [
      { operator_name: 'Пресувальник Зміна 1', stage_name: 'Пресування', shift_name: 'Зміна 1' }
    ]

    const candidates = buildShop1OperatorCandidates(historyRows, systemUsers)
    // Only press operator who worked on the card is returned; paint operator who did not work is NOT included
    expect(candidates.map(c => c.name)).toEqual(['Пресувальник Зміна 1'])
  })
})
