import { describe, it, expect } from 'vitest'
import { MACHINE_CATEGORIES } from '../src/modules/Shop1/components/modals/Shop1BulkPauseModal'

describe('Shop 1 Bulk Machine Pause Configuration & Logic', () => {
  it('correctly categorizes CNC and processing machines', () => {
    const smallCnc = { name: 'CNC 1200x800 №1.2', type: 'CNC 1200x800 - 4 листи (Малий)' }
    const kexinCnc = { name: 'CNC KE XIN №Ф3', type: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)' }
    const speedCnc = { name: 'CNC 3050 №2.1', type: 'CNC 3050(16)х16 - 3-12 листів (швидкісний)' }
    const tripleCnc = { name: 'CNC 3060 №3.1', type: 'CNC 3060х1600 - 3-36 листів (Три Головий)' }
    const dragonCnc = { name: 'CNC 6000x2000 №D1', type: 'CNC 6000x2000 - 4 - 96 листів (Дракон)' }
    const galtovka = { name: 'Галтовка вібростіл №1', type: 'galtovka' }

    const findCat = (m) => MACHINE_CATEGORIES.find(c => c.matcher(m))?.id

    expect(findCat(smallCnc)).toBe('cnc_small')
    expect(findCat(kexinCnc)).toBe('cnc_kexin')
    expect(findCat(speedCnc)).toBe('cnc_3050')
    expect(findCat(tripleCnc)).toBe('cnc_3060')
    expect(findCat(dragonCnc)).toBe('cnc_dragon')
    // Galtovka is excluded from cutting pause categories
    expect(findCat(galtovka)).toBeUndefined()
  })

  it('correctly maps cards to machine status', () => {
    const mockMachines = [
      { id: 'm-1', name: 'CNC 1200x800 №1.1', sequence_number: '1.1' },
      { id: 'm-2', name: 'CNC 1200x800 №1.2', sequence_number: '1.2' },
      { id: 'm-3', name: 'CNC KE XIN №Ф1', sequence_number: 'Ф1' }
    ]

    const mockCards = [
      { id: 'card-1', machine: 'CNC 1200x800 №1.1', status: 'in-progress' },
      { id: 'card-2', machine: 'CNC 1200x800 №1.2', status: 'paused', card_info: '[PAUSED:Повітряна тривога]' }
    ]

    const machineStatusMap = mockMachines.map(m => {
      const activeCard = mockCards.find(c => c.machine === m.name)
      return {
        id: m.id,
        name: m.name,
        isWorking: activeCard?.status === 'in-progress',
        isPaused: activeCard?.status === 'paused',
        isIdle: !activeCard
      }
    })

    expect(machineStatusMap[0].isWorking).toBe(true)
    expect(machineStatusMap[0].isPaused).toBe(false)
    expect(machineStatusMap[1].isWorking).toBe(false)
    expect(machineStatusMap[1].isPaused).toBe(true)
    expect(machineStatusMap[2].isIdle).toBe(true)
  })

  it('formats pause card_info with reason and timestamp', () => {
    const card = {
      id: 'card-123',
      started_at: '2026-11-04T10:00:00.000Z',
      card_info: '[SHEETS:4] Розкрій деталі А'
    }
    const now = '2026-11-04T12:00:00.000Z'
    const reason = 'Повітряна тривога'

    const originalStart = card.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || card.started_at || now
    let cleanInfo = (card.card_info || '')
      .replace(/\[ORIGINAL_START:[^\]]+\]/g, '')
      .replace(/\[PAUSED:[^\]]+\]/g, '')
      .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
      .trim()

    const updatedCardInfo = `[PAUSED:${reason}][PAUSED_AT:${now}][ORIGINAL_START:${originalStart}] ${cleanInfo}`.trim()

    expect(updatedCardInfo).toContain('[PAUSED:Повітряна тривога]')
    expect(updatedCardInfo).toContain(`[PAUSED_AT:${now}]`)
    expect(updatedCardInfo).toContain(`[ORIGINAL_START:${card.started_at}]`)
    expect(updatedCardInfo).toContain('[SHEETS:4] Розкрій деталі А')
  })

  it('filters custom list to only active machines (in work or paused), omitting idle machines', () => {
    const mockMachines = [
      { id: 'm-1', name: 'CNC 1200x800 №1.1', isWorking: true, isPaused: false },
      { id: 'm-2', name: 'CNC 1200x800 №1.2', isWorking: false, isPaused: true },
      { id: 'm-3', name: 'CNC KE XIN №Ф1', isWorking: false, isPaused: false, isIdle: true },
      { id: 'm-4', name: 'CNC KE XIN №Ф2', isWorking: false, isPaused: false, isIdle: true }
    ]

    const filteredForCustom = mockMachines.filter(m => m.isWorking || m.isPaused)

    expect(filteredForCustom).toHaveLength(2)
    expect(filteredForCustom.map(m => m.id)).toEqual(['m-1', 'm-2'])
    expect(filteredForCustom.some(m => m.id === 'm-3')).toBe(false)
    expect(filteredForCustom.some(m => m.id === 'm-4')).toBe(false)
  })
})

