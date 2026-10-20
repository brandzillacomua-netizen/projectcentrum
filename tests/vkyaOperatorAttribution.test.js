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

  it('excludes team, QC, buffer and other technical identities', () => {
    const candidates = buildShop1OperatorCandidates([
      { operator_name: 'Команда', stage_name: 'Галтовка' },
      { operator_name: 'ВКЯ Зміна 1', stage_name: 'Сортування' },
      { operator_name: 'Петренко Іван', stage_name: 'Буфер Розкрій' },
      { operator_name: 'Фарбувальник Зміна 1', stage_name: 'Фарбування' }
    ])

    expect(candidates).toEqual([])
  })
})

