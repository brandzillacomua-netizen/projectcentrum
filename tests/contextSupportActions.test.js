import { describe, expect, it, vi } from 'vitest'
import { createContextSupportActions } from '../src/contexts/contextSupportActions.js'

describe('MES context support actions', () => {
  it('searches customers locally without replacing the shared customer cache', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Acme' }] })
    const ilike = vi.fn(() => ({ limit }))
    const select = vi.fn(() => ({ ilike }))
    const from = vi.fn(() => ({ select }))
    const setTaskProjects = vi.fn()
    const actions = createContextSupportActions({ client: { from }, setTaskProjects })

    expect(await actions.searchCustomers('Acm')).toEqual([{ id: 1, name: 'Acme' }])
    expect(from).toHaveBeenCalledWith('customers')
    expect(ilike).toHaveBeenCalledWith('name', '%Acm%')
    expect(limit).toHaveBeenCalledWith(20)
    expect(setTaskProjects).not.toHaveBeenCalled()
  })

  it('adds the current login and deduplicates the returned project', async () => {
    const created = { id: 9, name: 'Operations', created_by: 'director' }
    const select = vi.fn().mockResolvedValue({ data: [created], error: null })
    const insert = vi.fn(() => ({ select }))
    const setTaskProjects = vi.fn()
    const actions = createContextSupportActions({
      client: { from: () => ({ insert }) },
      currentUser: { login: 'director' },
      setTaskProjects
    })

    expect(await actions.addTaskProject({ name: 'Operations' })).toEqual({ data: created, error: null })
    expect(insert).toHaveBeenCalledWith([{ name: 'Operations', created_by: 'director' }])
    expect(setTaskProjects.mock.calls[0][0]([created])).toEqual([created])
    expect(setTaskProjects.mock.calls[0][0]([])).toEqual([created])
  })

  it('keeps optimistic project updates and the established local columns cache', async () => {
    const updated = { id: 4, name: 'Updated', columns: ['ready'] }
    const select = vi.fn().mockResolvedValue({ data: [updated], error: null })
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const setTaskProjects = vi.fn()
    const storage = {
      getItem: vi.fn(() => '{"other":["todo"]}'),
      setItem: vi.fn()
    }
    const actions = createContextSupportActions({
      client: { from: () => ({ update }) },
      setTaskProjects,
      storage
    })

    expect(await actions.updateTaskProject(4, { name: 'Updated', columns: ['ready'] }))
      .toEqual({ data: updated, error: null })
    expect(setTaskProjects.mock.calls[0][0]([{ id: 4, name: 'Old' }])).toEqual([updated])
    expect(storage.setItem).toHaveBeenCalledWith(
      'centrum_project_columns',
      JSON.stringify({ other: ['todo'], 4: ['ready'] })
    )
    expect(eq).toHaveBeenCalledWith('id', 4)
  })

  it('returns caught update failures and only removes successfully deleted projects', async () => {
    const setTaskProjects = vi.fn()
    const updateFailure = new Error('offline')
    const updateActions = createContextSupportActions({
      client: { from: () => ({ update: () => { throw updateFailure } }) },
      setTaskProjects
    })
    expect(await updateActions.updateTaskProject(2, { name: 'Changed' }))
      .toEqual({ data: null, error: updateFailure })

    const eq = vi.fn().mockResolvedValue({ error: null })
    const deleteActions = createContextSupportActions({
      client: { from: () => ({ delete: () => ({ eq }) }) },
      setTaskProjects
    })
    expect(await deleteActions.deleteTaskProject(2)).toEqual({ error: null })
    expect(setTaskProjects.mock.calls.at(-1)[0]([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }])
  })
})
