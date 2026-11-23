import { describe, expect, it } from 'vitest'
import { summarizeTaskState } from '../src/modules/Foreman2/features/shortage/shortageCalculations.js'

describe('Foreman2 task completion lock when VKYA has unclassified parts', () => {
  const baseTask = { id: 'task-1', status: 'in-progress' }
  const completedCards = [
    { id: 'c1', task_id: 'task-1', status: 'at-shop2-buffer', quantity: 100 }
  ]

  it('blocks task completion and marks awaiting VKYA when qualityHold > 0', () => {
    const summary = summarizeTaskState({
      task: baseTask,
      cards: completedCards,
      parts: [{ need: 80, produced: 85, shortage: 0, qualityHold: 15, scrap: 0 }]
    })

    expect(summary.isReady).toBe(false)
    expect(summary.isAwaitingVkya).toBe(true)
    expect(summary.totalQualityHold).toBe(15)
  })

  it('allows task completion when qualityHold is 0, no shortage, and produced >= need', () => {
    const summary = summarizeTaskState({
      task: baseTask,
      cards: completedCards,
      parts: [{ need: 80, produced: 85, shortage: 0, qualityHold: 0, scrap: 15 }]
    })

    expect(summary.isReady).toBe(true)
    expect(summary.isAwaitingVkya).toBe(false)
    expect(summary.totalQualityHold).toBe(0)
  })

  it('keeps isAwaitingVkya false when there is already a shortage requiring reissue', () => {
    const summary = summarizeTaskState({
      task: baseTask,
      cards: completedCards,
      parts: [{ need: 100, produced: 75, shortage: 10, qualityHold: 15, scrap: 10 }]
    })

    expect(summary.isReady).toBe(false)
    expect(summary.isAwaitingVkya).toBe(false)
    expect(summary.hasShortage).toBe(true)
  })
})
