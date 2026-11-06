import React from 'react'
import { CheckCircle2, FolderKanban, Plus, Users } from 'lucide-react'

export const TaskProjectsGrid = ({
  filteredProjects,
  managementTasks,
  setActiveId,
  projectMembers,
  canCreateProject,
  openProjectForm
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
          <p>Створіть свій перший проєкт або дочекайтеся запрошення в команду.</p>
          <button
            type="button"
            className="tp-primary"
            onClick={() => openProjectForm?.()}
            style={{
              marginTop: '14px',
              background: '#ff9000',
              color: '#000',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            <Plus size={16} />
            <span>Створити перший проєкт</span>
          </button>
        </div>
      )}
    </main>
  )
}

export default TaskProjectsGrid
