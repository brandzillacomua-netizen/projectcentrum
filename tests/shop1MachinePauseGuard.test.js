import { describe, it, expect } from 'vitest'
import { findBlockingMachineCard, getMachineStartBlockAlert } from '../src/modules/Shop1/utils/shop1Helpers'

describe('Shop 1 machine start busy & pause guard', () => {
  const nomenclatures = [{ id: 'nom-1', name: 'Пластина Т300' }]
  const machineActive = { id: 10, name: 'CNC KE XIN - ФЕЯ №Ф12', status: 'idle' }
  const machinePaused = { id: 11, name: 'CNC KE XIN - ФЕЯ №Ф13', status: 'paused' }

  it('blocks starting a second card when a paused card is already on the machine', () => {
    const workCards = [
      {
        id: 'card-paused-11112222',
        status: 'paused',
        operation: 'Розкрій',
        machine: 'CNC KE XIN - ФЕЯ №Ф12',
        machine_id: 10,
        nomenclature_id: 'nom-1',
        operator_name: 'Шак Марʼян',
        card_info: '[PAUSED:Поломка фрези][PAUSED_AT:2026-11-26T10:00:00Z]'
      }
    ]

    const alert = getMachineStartBlockAlert({
      workCards,
      currentCardId: 'card-new-9999',
      targetMachine: 'CNC KE XIN - ФЕЯ №Ф12',
      machine: machineActive,
      nomenclatures
    })

    expect(alert).not.toBeNull()
    expect(alert.title).toContain('на паузі')
    expect(alert.message).toContain('11112222')
    expect(alert.message).toContain('Пластина Т300')
    expect(alert.message).toContain('Поломка фрези')
  })

  it('blocks starting a card when the machine itself is paused without an active card', () => {
    const alert = getMachineStartBlockAlert({
      workCards: [],
      currentCardId: 'card-new-9999',
      targetMachine: 'CNC KE XIN - ФЕЯ №Ф13',
      machine: machinePaused,
      nomenclatures
    })

    expect(alert).not.toBeNull()
    expect(alert.title).toContain('на паузі')
    expect(alert.message).toContain('активної картки на ньому немає')
  })

  it('blocks starting a card when an in-progress card is already running on the machine', () => {
    const workCards = [
      {
        id: 'card-run-33334444',
        status: 'in-progress',
        operation: 'Розкрій',
        machine: 'CNC KE XIN - ФЕЯ №Ф12',
        machine_id: 10,
        nomenclature_id: 'nom-1',
        operator_name: 'Іван Петренко'
      }
    ]

    const alert = getMachineStartBlockAlert({
      workCards,
      currentCardId: 'card-new-9999',
      targetMachine: 'CNC KE XIN - ФЕЯ №Ф12',
      machine: machineActive,
      nomenclatures
    })

    expect(alert).not.toBeNull()
    expect(alert.title).toContain('вже зайнятий')
    expect(alert.message).toContain('33334444')
  })

  it('allows starting when the machine is idle and has no active/paused cards', () => {
    const workCards = [
      {
        id: 'card-done-55556666',
        status: 'completed',
        operation: 'Розкрій',
        machine: 'CNC KE XIN - ФЕЯ №Ф12',
        machine_id: 10
      }
    ]

    expect(findBlockingMachineCard({
      workCards,
      currentCardId: 'card-new-9999',
      targetMachine: 'CNC KE XIN - ФЕЯ №Ф12',
      machineId: 10
    })).toBeNull()

    expect(getMachineStartBlockAlert({
      workCards,
      currentCardId: 'card-new-9999',
      targetMachine: 'CNC KE XIN - ФЕЯ №Ф12',
      machine: machineActive,
      nomenclatures
    })).toBeNull()
  })
})
