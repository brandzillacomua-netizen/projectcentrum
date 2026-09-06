import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KanbanSquare, Shield, Briefcase, ChevronRight, Search } from 'lucide-react'

export const KanbanNav = ({
  isDirector,
  filterMode,
  setFilterMode,
  setStatsFilter,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery
}) => {
  return (
    <nav className="kb-nav">
      <div className="kb-nav-left">
        <Link to="/" className="kb-back">
          <ArrowLeft size={16} />
          <span>НАЗАД</span>
        </Link>
        <div className="kb-brand">
          <div className="kb-brand-icon"><KanbanSquare size={20} /></div>
          <div className="kb-brand-text">
            <h1>ЗАДАЧІ</h1>
            <span>Внутрішні домовленості</span>
          </div>
        </div>
        {isDirector && (
          <div className="role-badge manager-badge"><Shield size={11} /> Керівник</div>
        )}
        <Link to="/tasks/projects" className="projects-nav-btn">
          <span className="projects-nav-icon"><Briefcase size={16} /></span>
          <span className="projects-nav-copy"><b>ПРОЄКТИ</b><small>Відкрити дошки</small></span>
          <ChevronRight size={16} className="projects-nav-arrow" />
        </Link>
      </div>
      <div className="kb-nav-right">
        <div className={`kb-search-wrap ${showSearch ? 'open' : ''}`}>
          <button className="icon-btn" onClick={() => setShowSearch(s => !s)}><Search size={16} /></button>
          {showSearch && (
            <input autoFocus type="text" placeholder="Пошук задач..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="kb-search-input" />
          )}
        </div>

        <div className="kb-filters">
          {isDirector ? (
            <>
              {[['all', 'УСІ ЗАДАЧІ'], ['my', 'Я ВИКОНАВЕЦЬ'], ['assigned_by_me', 'Я АВТОР'], ['unassigned', 'БЕЗ ВИКОНАВЦЯ']].map(([id, lbl]) => (
                <button key={id} className={`kf-btn ${filterMode === id ? 'active' : ''}`} onClick={() => { setFilterMode(id); setStatsFilter('all') }}>{lbl}</button>
              ))}
            </>
          ) : (
            <>
              {[['all', 'МОЇ ТА ДОРУЧЕНІ'], ['my', 'Я ВИКОНАВЕЦЬ'], ['assigned_by_me', 'Я АВТОР'], ['department', 'ВІДДІЛ']].map(([id, lbl]) => (
                <button key={id} className={`kf-btn ${filterMode === id ? 'active' : ''}`} onClick={() => { setFilterMode(id); setStatsFilter('all') }}>{lbl}</button>
              ))}
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
