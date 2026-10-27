/**
 * Helper to preserve unsaved machine operations drafts in localStorage
 * Prevents user data loss during background realtime syncs, re-fetches, or accidental reloads.
 */

const STORAGE_PREFIX = 'centrum_ops_draft_'

export function getDraftKey(nomId, machine) {
  if (!nomId || !machine) return null
  return `${STORAGE_PREFIX}${nomId}_${machine.replace(/\s+/g, '_')}`
}

export function getOpsDraft(nomId, machine) {
  try {
    const key = getDraftKey(nomId, machine)
    if (!key || typeof window === 'undefined') return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validate draft has content
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (err) {
    console.warn('[operationsDraft] Failed to read draft:', err)
    return null
  }
}

export function saveOpsDraft(nomId, machine, data) {
  try {
    const key = getDraftKey(nomId, machine)
    if (!key || typeof window === 'undefined') return
    const payload = {
      ...data,
      updatedAt: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (err) {
    console.warn('[operationsDraft] Failed to save draft:', err)
  }
}

export function clearOpsDraft(nomId, machine) {
  try {
    const key = getDraftKey(nomId, machine)
    if (!key || typeof window === 'undefined') return
    localStorage.removeItem(key)
  } catch (err) {
    console.warn('[operationsDraft] Failed to clear draft:', err)
  }
}
