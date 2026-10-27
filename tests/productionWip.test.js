import { describe, expect, it } from 'vitest'
import { classifyWorkCardStage, WIP_STAGES } from '../src/modules/WarehouseFGP/hooks/useProductionWip.js'

describe('production WIP stage classification', () => {
  it('classifies CNC cutting cards correctly', () => {
    expect(classifyWorkCardStage({ operation: 'Розкрій', status: 'in-progress' }).stage).toBe(WIP_STAGES.CNC)
    expect(classifyWorkCardStage({ operation: 'Розкрій', status: 'new' }).stage).toBe(WIP_STAGES.CNC)
    expect(classifyWorkCardStage({ operation: 'Розкрій', status: 'paused' }).stage).toBe(WIP_STAGES.CNC)
    expect(classifyWorkCardStage({ operation: 'Нова', status: 'new' }).stage).toBe(WIP_STAGES.CNC)
    expect(classifyWorkCardStage({ operation: '', status: 'new' }).stage).toBe(WIP_STAGES.CNC)
  })

  it('classifies Tumbling stages correctly', () => {
    expect(classifyWorkCardStage({ operation: 'Галтовка (Вібростіл)', status: 'in-progress' }).stage).toBe(WIP_STAGES.TUMBLING)
    expect(classifyWorkCardStage({ operation: 'Галтовка (Мийка)', status: 'in-progress' }).stage).toBe(WIP_STAGES.TUMBLING)
    expect(classifyWorkCardStage({ operation: 'Галтовка (Галтовка)', status: 'in-progress' }).stage).toBe(WIP_STAGES.TUMBLING)
    expect(classifyWorkCardStage({ operation: 'Галтовка (Сушка)', status: 'in-progress' }).stage).toBe(WIP_STAGES.TUMBLING)
    expect(classifyWorkCardStage({ operation: 'Розкрій', status: 'at-buffer' }).stage).toBe(WIP_STAGES.TUMBLING)
    expect(classifyWorkCardStage({ operation: 'Галтовка', status: 'at-tumbling-buffer' }).stage).toBe(WIP_STAGES.TUMBLING)
  })

  it('classifies Sorting / Acceptance stages correctly', () => {
    expect(classifyWorkCardStage({ operation: 'Сортування', status: 'in-progress' }).stage).toBe(WIP_STAGES.SORTING)
    expect(classifyWorkCardStage({ operation: 'Прийомка', status: 'at-buffer' }).stage).toBe(WIP_STAGES.SORTING)
    expect(classifyWorkCardStage({ operation: 'ВКЯ', status: 'in-progress' }).stage).toBe(WIP_STAGES.SORTING)
  })

  it('classifies Shop 2 stages correctly', () => {
    const shop2TaskIds = new Set(['task-s2-1'])
    expect(classifyWorkCardStage({ task_id: 'task-s2-1', status: 'in-progress' }, shop2TaskIds).stage).toBe(WIP_STAGES.SHOP2)
    expect(classifyWorkCardStage({ operation: 'Пресування', status: 'in-progress' }).stage).toBe(WIP_STAGES.SHOP2)
    expect(classifyWorkCardStage({ operation: 'Малярка', status: 'in-progress' }).stage).toBe(WIP_STAGES.SHOP2)
    expect(classifyWorkCardStage({ status: 'at-shop2-buffer' }).stage).toBe(WIP_STAGES.SHOP2)
    expect(classifyWorkCardStage({ card_info: '[SHOP:2] Автоматично' }).stage).toBe(WIP_STAGES.SHOP2)
  })
})
