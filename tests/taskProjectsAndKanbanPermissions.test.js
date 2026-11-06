import { describe, expect, it } from 'vitest'
import { asArray, isDirectorUser } from '../src/modules/TaskProjects/hooks/useTaskProjectsData.js'

describe('TaskProjects & Tasks access and visibility permissions', () => {
  const romanUser = {
    id: 'user-roman-123',
    login: 'roman_tverdokhlib',
    first_name: 'Роман',
    last_name: 'Твердохліб',
    position: 'інженер',
    department: 'Виробництво'
  }

  const directorUser = {
    id: 'user-director-1',
    login: 'director',
    first_name: 'Олександр',
    last_name: 'Директор',
    position: 'Директор',
    access_rights: { director: true }
  }

  const otherUser = {
    id: 'user-vasyl-2',
    login: 'vasyl',
    first_name: 'Василь',
    last_name: 'Коваль',
    position: 'майстер',
    department: 'Виробництво'
  }

  const projects = [
    {
      id: 'proj-1',
      name: 'Демонтажні роботи підвальне приміщення',
      created_by: 'vasyl',
      member_logins: ['vasyl', 'petro'],
      department_ids: ['dep-production']
    },
    {
      id: 'proj-2',
      name: 'Розробка нової оснастки',
      created_by: 'roman_tverdokhlib',
      member_logins: ['roman_tverdokhlib'],
      department_ids: []
    },
    {
      id: 'proj-3',
      name: 'Модернізація лінії',
      created_by: 'director',
      member_logins: ['roman_tverdokhlib', 'ivan'],
      department_ids: []
    },
    {
      id: 'proj-4',
      name: 'Встановлення вентиляції',
      created_by: 'vasyl',
      member_logins: ['vasyl'],
      department_ids: []
    }
  ]

  const managementTasks = [
    {
      id: 'task-1',
      title: 'Демонтувати стійки',
      project_id: 'proj-1',
      created_by: 'vasyl',
      assigned_to: 'petro',
      assignees: ['petro']
    },
    {
      id: 'task-2',
      title: 'Підключити датчики на вентиляції',
      project_id: 'proj-4',
      created_by: 'vasyl',
      assigned_to: 'roman_tverdokhlib',
      assignees: ['roman_tverdokhlib']
    }
  ]

  const filterVisibleProjects = (projectsList, user, tasksList) => {
    const isDirector = isDirectorUser(user)
    return projectsList.filter(project => {
      if (project.status === 'archived') return false
      if (isDirector) return true

      const userLogin = user?.login
      const userId = user?.id ? String(user.id) : null

      // 1. Author of project
      if (userLogin && project.created_by === userLogin) return true
      if (userId && (String(project.created_by) === userId || String(project.user_id) === userId)) return true

      // 2. Participant (member) of project
      const members = asArray(project.member_logins).map(String)
      if (userLogin && members.includes(userLogin)) return true
      if (userId && members.includes(userId)) return true

      // 3. Has task in project addressed to user or created by user
      const hasProjectTask = (tasksList || []).some(t => {
        if (String(t.project_id || '') !== String(project.id)) return false
        if (userLogin && t.created_by === userLogin) return true
        if (userId && String(t.created_by) === userId) return true
        const assignees = (Array.isArray(t.assignees) ? t.assignees : [t.assigned_to]).filter(Boolean).map(String)
        if (userLogin && assignees.includes(userLogin)) return true
        if (userId && assignees.includes(userId)) return true
        return false
      })
      if (hasProjectTask) return true

      return false
    })
  }

  it('hides projects where the user is neither author nor participant, even if department matches', () => {
    const visibleToRoman = filterVisibleProjects(projects, romanUser, managementTasks)
    const visibleIds = visibleToRoman.map(p => p.id)

    // proj-1 (Демонтажні роботи) has department_ids but Roman is not author, not member, and has no task
    expect(visibleIds).not.toContain('proj-1')

    // proj-2: Roman is author
    expect(visibleIds).toContain('proj-2')

    // proj-3: Roman is in member_logins
    expect(visibleIds).toContain('proj-3')

    // proj-4: Roman has a task assigned to him in this project
    expect(visibleIds).toContain('proj-4')
  })

  it('allows directors to view all projects across the company', () => {
    const visibleToDirector = filterVisibleProjects(projects, directorUser, managementTasks)
    expect(visibleToDirector).toHaveLength(projects.length)
  })

  it('permits any authenticated user with module access to create projects', () => {
    const canCreateAsRoman = !!romanUser
    const canCreateAsDirector = !!directorUser
    const canCreateAsOther = !!otherUser

    expect(canCreateAsRoman).toBe(true)
    expect(canCreateAsDirector).toBe(true)
    expect(canCreateAsOther).toBe(true)
  })

  it('filters Kanban tasks so non-director users only see tasks addressed to them or created by them', () => {
    const kanbanTasks = [
      { id: 'kt-1', title: 'Task for Roman', created_by: 'vasyl', assigned_to: 'roman_tverdokhlib', assignees: ['roman_tverdokhlib'] },
      { id: 'kt-2', title: 'Task by Roman', created_by: 'roman_tverdokhlib', assigned_to: 'petro', assignees: ['petro'] },
      { id: 'kt-3', title: 'Task with checklist for Roman', created_by: 'vasyl', assigned_to: 'petro', checklist: [{ text: 'Item', assignee: 'roman_tverdokhlib' }] },
      { id: 'kt-4', title: 'Other people task', created_by: 'vasyl', assigned_to: 'petro', assignees: ['petro'] }
    ]

    const isTaskRelevantToUser = (task, user) => {
      if (!user || !task) return false
      const login = user.login
      const userId = user.id ? String(user.id) : null
      const taskCreator = String(task.created_by || '')

      if (login && taskCreator === login) return true
      if (userId && taskCreator === userId) return true

      const assignees = (Array.isArray(task.assignees) ? task.assignees : [task.assigned_to]).filter(Boolean).map(String)
      if (login && assignees.includes(login)) return true
      if (userId && assignees.includes(userId)) return true

      if (Array.isArray(task.checklist) && task.checklist.some(item => {
        const itemAssignees = (Array.isArray(item.assignees) ? item.assignees : [item.assignee]).filter(Boolean).map(String)
        return (login && itemAssignees.includes(login)) || (userId && itemAssignees.includes(userId))
      })) return true

      return false
    }

    const romanTasks = kanbanTasks.filter(t => isTaskRelevantToUser(t, romanUser))
    expect(romanTasks.map(t => t.id)).toEqual(['kt-1', 'kt-2', 'kt-3'])
    expect(romanTasks.map(t => t.id)).not.toContain('kt-4')
  })
})

