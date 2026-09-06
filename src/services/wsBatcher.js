/**
 * WebSocket Event Batcher
 * Buffers incoming realtime WebSocket events over a short window (150ms)
 * and applies state updates in consolidated batches to prevent UI micro-freezes.
 */

class WSBatcher {
  constructor(delayMs = 150) {
    this.delayMs = delayMs
    this.queues = {
      work_cards: [],
      tasks: [],
      inventory: [],
      material_requests: [],
      orders: [],
      work_card_history: []
    }
    this.handlers = {}
    this.timer = null
  }

  /**
   * Registers a callback function to handle consolidated batch events for a specific table
   */
  registerHandler(table, handlerFn) {
    this.handlers[table] = handlerFn
  }

  /**
   * Enqueues an incoming realtime Postgres change payload
   */
  enqueue(table, payload) {
    if (!this.queues[table]) {
      this.queues[table] = []
    }
    this.queues[table].push(payload)
    this.scheduleFlush()
  }

  /**
   * Schedules a debounced batch flush
   */
  scheduleFlush() {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, this.delayMs)
  }

  /**
   * Flushes all queued events chronologically per table in a single React state pass
   */
  flush() {
    Object.keys(this.queues).forEach(table => {
      const events = this.queues[table]
      if (!events || events.length === 0) return

      // Consolidate updates for identical records to avoid redundant state updates
      const consolidatedEvents = this.consolidateEvents(events)
      this.queues[table] = []

      const handler = this.handlers[table]
      if (typeof handler === 'function') {
        try {
          handler(consolidatedEvents)
        } catch (err) {
          console.error(`[WSBatcher] Error flushing batch for table ${table}:`, err)
        }
      }
    })
  }

  /**
   * Merges multiple updates to the same record into a single change
   */
  consolidateEvents(events) {
    const recordMap = new Map()

    events.forEach(evt => {
      const id = evt.new?.id || evt.old?.id
      if (!id) {
        recordMap.set(`seq_${Math.random()}`, evt)
        return
      }

      const existing = recordMap.get(id)
      if (!existing) {
        recordMap.set(id, evt)
      } else {
        if (evt.eventType === 'DELETE') {
          recordMap.set(id, evt)
        } else if (evt.eventType === 'UPDATE' || evt.eventType === 'INSERT') {
          recordMap.set(id, {
            ...evt,
            new: { ...(existing.new || {}), ...(evt.new || {}) }
          })
        }
      }
    })

    return Array.from(recordMap.values())
  }
}

export const wsBatcher = new WSBatcher(150)
