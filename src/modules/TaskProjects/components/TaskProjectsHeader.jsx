import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, ChevronLeft, Edit3 } from 'lucide-react'

export const TaskProjectsHeader = ({
  activeProject,
  setActiveId,
  pct,
  isOwnerOrManager,
  openProjectForm
}) => {
  if (activeProject) {
    return (
      <header className="tp-header">
        <div className="tp-heading">
          <button className="tp-icon-btn" onClick={() => setActiveId(null)}><ChevronLeft size={20} /></button>
          <span className="tp-project-dot" style={{ background: activeProject.color }} />
          <div>
            <h1>{activeProject.name}</h1>
            <p>{activeProject.description || 'Проєктна канбан-дошка'}</p>
          </div>
        </div>
        <div className="tp-header-actions">
          <div className="tp-progress">
            <span>{pct}%</span>
            <i><b style={{ width: `${pct}%`, background: activeProject.color }} /></i>
          </div>
          {isOwnerOrManager && (
            <button className="tp-secondary" onClick={() => openProjectForm(activeProject)}>
              <Edit3 size={15} /> Налаштувати
            </button>
          )}
        </div>
      </header>
    )
  }

  return (
    <header className="tp-header">
      <div className="tp-heading" style={{ display: 'flex', alignItems: 'center', flex: 1, width: '100%' }}>
        <Link className="tp-icon-btn" to="/tasks" style={{ width: 'auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <ArrowLeft size={18} />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'none', letterSpacing: 'normal' }}>до задач</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <div className="tp-logo"><BriefcaseBusiness size={20} /></div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1rem', letterSpacing: '1.5px', textAlign: 'left' }}>ПРОЄКТИ</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '.72rem', textAlign: 'left', lineHeight: '1.2', whiteSpace: 'normal' }}>
              Окремі команди<br />та канбан-дошки
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TaskProjectsHeader
