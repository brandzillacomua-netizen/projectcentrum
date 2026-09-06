import React from 'react'
import { CheckCircle2, FolderKanban, Users } from 'lucide-react'

export const TaskProjectsGrid = ({
  filteredProjects,
  managementTasks,
  setActiveId,
  projectMembers,
  canCreateProject
}) => {
  return (
    <main className="tp-grid">
      {filteredProjects.map(project => {
        const tasks = managementTasks.filter(t => String(t.project_id || '') === String(project.id))
        const done = tasks.filter(t => t.status === 'done').length
        const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0
        return (
          <article className="tp-project" key={project.id} onClick={() => setActiveId(project.id)} style={{ '--pc': project.color }}>
            <div className="tp-project-icon"><FolderKanban size={24} /></div>
            <h2>{project.name}</h2>
            <p>{project.description || 'Без опису'}</p>
            <div className="tp-project-meta">
              <span><Users size={14} /> {projectMembers(project)}</span>
              <span><CheckCircle2 size={14} /> {done}/{tasks.length}</span>
            </div>
            <div className="tp-project-progress"><i style={{ width: `${pct}%` }} /></div>
          </article>
        )
      })}
      {!filteredProjects.length && (
        <div className="tp-empty">
          <FolderKanban size={44} />
          <h2>Проєктів поки немає</h2>
          <p>{canCreateProject ? 'Створіть перший проєкт і сформуйте його команду.' : 'Вас ще не додано до жодного активного проєкту.'}</p>
        </div>
      )}
    </main>
  )
}

export default TaskProjectsGrid
