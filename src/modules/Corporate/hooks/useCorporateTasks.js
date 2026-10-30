import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'
import { corporateApi } from '../services/corporateApi'

export function useCorporateTasks(currentUser) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await corporateApi.fetchTasks()
      setTasks(data || [])
      setError(null)
    } catch (err) {
      console.warn('[useCorporateTasks] Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()

    const channel = supabase
      .channel('corporate_tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corporate_tasks' }, () => {
        loadTasks()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTasks])

  const handleCreateTask = async (taskData) => {
    try {
      const newTask = await corporateApi.createTask({
        ...taskData,
        creator_id: currentUser?.id
      })
      setTasks(prev => [newTask, ...prev])
      return newTask
    } catch (err) {
      console.error('[useCorporateTasks] Create error:', err)
      throw err
    }
  }

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      await corporateApi.updateTaskStatus(taskId, newStatus)
    } catch (err) {
      console.error(err)
      alert('Помилка оновлення статусу: ' + err.message)
      loadTasks()
    }
  }

  const handleToggleChecklistItem = async (taskId, itemIndex) => {
    const targetTask = tasks.find(t => t.id === taskId)
    if (!targetTask) return

    const currentChecklist = Array.isArray(targetTask.checklist) ? [...targetTask.checklist] : []
    if (!currentChecklist[itemIndex]) return

    currentChecklist[itemIndex] = {
      ...currentChecklist[itemIndex],
      completed: !currentChecklist[itemIndex].completed
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, checklist: currentChecklist } : t))
    try {
      await corporateApi.updateTaskChecklist(taskId, currentChecklist)
    } catch (err) {
      console.error(err)
      loadTasks()
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Видалити це завдання?')) return
    try {
      await corporateApi.deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err) {
      alert('Помилка видалення завдання: ' + err.message)
    }
  }

  return {
    tasks,
    loading,
    error,
    refreshTasks: loadTasks,
    createTask: handleCreateTask,
    updateStatus: handleUpdateStatus,
    toggleChecklistItem: handleToggleChecklistItem,
    deleteTask: handleDeleteTask
  }
}

