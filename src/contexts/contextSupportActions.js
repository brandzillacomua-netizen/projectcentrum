export const createContextSupportActions = ({
  client,
  currentUser,
  setTaskProjects,
  storage = globalThis.localStorage
}) => {
  const searchCustomers = async query => {
    if (!query) return []
    const { data } = await client.from('customers').select('*').ilike('name', `%${query}%`).limit(20)
    return data || []
  }

  const addTaskProject = async project => {
    const payload = { ...project, created_by: currentUser?.login || 'system' }
    const { data: rows, error } = await client.from('task_projects').insert([payload]).select()
    if (!error && rows?.[0]) {
      setTaskProjects(previous => (
        previous.some(item => item.id === rows[0].id) ? previous : [rows[0], ...previous]
      ))
    }
    return { data: rows?.[0], error }
  }

  const updateTaskProject = async (id, updates) => {
    setTaskProjects(previous => previous.map(project => (
      project.id === id ? { ...project, ...updates } : project
    )))

    if (updates.columns) {
      try {
        const saved = JSON.parse(storage.getItem('centrum_project_columns') || '{}')
        saved[id] = updates.columns
        storage.setItem('centrum_project_columns', JSON.stringify(saved))
      } catch {
        // Preserve database persistence even if a legacy local cache is invalid.
      }
    }

    try {
      const { data: rows, error } = await client.from('task_projects').update(updates).eq('id', id).select()
      return { data: rows?.[0], error }
    } catch (error) {
      return { data: null, error }
    }
  }

  const deleteTaskProject = async id => {
    const { error } = await client.from('task_projects').delete().eq('id', id)
    if (!error) setTaskProjects(previous => previous.filter(project => project.id !== id))
    return { error }
  }

  return { searchCustomers, addTaskProject, updateTaskProject, deleteTaskProject }
}
