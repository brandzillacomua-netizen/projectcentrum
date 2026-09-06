import React from 'react'
import { ChevronRight, ChevronLeft, Briefcase, Calendar, TrendingUp } from 'lucide-react'
import { UserAvatar } from './KanbanUserAvatar'
import {
  COLUMNS,
  getTaskDepartment,
  isOverdueTask
} from '../utils/kanbanHelpers'

export const KanbanSidebar = ({
  isSidebarOpen,
  setIsSidebarOpen,
  currentUser,
  departments,
  selectedDeptFilter,
  setSelectedDeptFilter,
  managementTasks,
  systemUsers,
  companyStructure,
  isDirector,
  isTaskRelevantToUser,
  handleOpenTask
}) => {
  return (
    <aside className={`kb-sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <button className="kb-sidebar-toggle-tab" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title={isSidebarOpen ? "Сховати панель" : "Показати аналітику"}>
        <div className="tab-arrow-icon">
          {isSidebarOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </div>
        <span className="tab-text">ІНФО</span>
        <div className="tab-indicator-dots" />
      </button>

      {/* ── DEPARTMENT TASKS ────────────────────────────────────────────── */}
      {(() => {
        const pos = (currentUser?.position || '').toLowerCase()
        const rights = currentUser?.access_rights || {}
        const isSuperOrProdDirector = rights.director || rights.master || rights.foreman ||
          pos.includes('адмін') || pos.includes('директор') || pos.includes('керівник')

        if (!isSuperOrProdDirector) return null

        return (
          <div className="sb-block">
            <div className="sb-block-head">
              <Briefcase size={13} />
              <span>ЗАВДАННЯ ВІДДІЛІВ</span>
            </div>
            <div className="sb-dept-list">
              {departments.map(d => {
                const deptTasks = (managementTasks || []).filter(t => !t.project_id).filter(t => {
                  if (d.id === 'all') return true
                  return getTaskDepartment(t, systemUsers, companyStructure) === d.id
                })

                const todoCnt = deptTasks.filter(t => t.status === 'todo').length
                const progCnt = deptTasks.filter(t => t.status === 'in_progress').length
                const reviewCnt = deptTasks.filter(t => t.status === 'review').length
                const overdueCnt = deptTasks.filter(t => isOverdueTask(t)).length

                const isSelected = selectedDeptFilter === d.id

                return (
                  <div key={d.id} className={`sb-dept-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedDeptFilter(isSelected ? 'all' : d.id)}>
                    <span className="sb-dept-name">{d.label}</span>
                    <div className="sb-dept-badges">
                      {todoCnt > 0 && <span className="sb-dbadge sb-dbadge-todo" title="Нові">{todoCnt}</span>}
                      {progCnt > 0 && <span className="sb-dbadge sb-dbadge-prog" title="В роботі">{progCnt}</span>}
                      {reviewCnt > 0 && <span className="sb-dbadge sb-dbadge-rev" title="Перевірка">{reviewCnt}</span>}
                      {overdueCnt > 0 && <span className="sb-dbadge sb-dbadge-over" title="Прострочено">{overdueCnt}</span>}
                      {todoCnt === 0 && progCnt === 0 && reviewCnt === 0 && overdueCnt === 0 && (
                        <span className="sb-dbadge sb-dbadge-empty">0</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── UPCOMING DEADLINES ───────────────────────────────────────── */}
      <div className="sb-block">
        <div className="sb-block-head">
          <Calendar size={13} />
          <span>ДЕДЛАЙНИ</span>
        </div>
        <div className="sb-deadline-list">
          {(() => {
            const now = new Date()
            const in7 = new Date(now.getTime() + 7 * 86400000)
            const allTasks = (managementTasks || []).filter(t => !t.project_id)
            const visibleTasks = isDirector ? allTasks : allTasks.filter(t => isTaskRelevantToUser(t, currentUser))
            const upcoming = visibleTasks
              .filter(t => t.deadline && t.status !== 'done')
              .map(t => ({ ...t, _dl: new Date(t.deadline) }))
              .sort((a, b) => a._dl - b._dl)
              .slice(0, 6)

            if (upcoming.length === 0) return (
              <div className="sb-empty">Немає наступних дедлайнів</div>
            )
            return upcoming.map(task => {
              const overdue = task._dl < now && task.status !== 'done'
              const isToday = task._dl.toDateString() === now.toDateString()
              const isSoon = task._dl <= in7 && !overdue
              const assignee = (systemUsers || []).find(u => u.login === task.assigned_to)
              const daysLeft = Math.ceil((task._dl - now) / 86400000)
              return (
                <div key={task.id} className={`sb-deadline-item ${overdue ? 'dl-overdue' : isSoon ? 'dl-soon' : ''}`}
                  onClick={() => handleOpenTask(task)}>
                  <div className="dl-left">
                    <div className="dl-date" style={{ color: overdue ? '#ef4444' : isSoon ? '#f59e0b' : '#888' }}>
                      {overdue ? `Простр. ${Math.abs(daysLeft)}д` : isToday ? 'Сьогодні' : `${daysLeft}д`}
                    </div>
                    <div className="dl-title">{task.title}</div>
                  </div>
                  {!task.is_collective && assignee && (
                    <UserAvatar user={assignee} size={22} />
                  )}
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* ── RECENT ACTIVITY / STATS ─────────────────────────────────────────────── */}
      <div className="sb-block">
        <div className="sb-block-head">
          <TrendingUp size={13} />
          <span>СТАТИСТИКА</span>
        </div>
        <div className="sb-stats-grid">
          {(() => {
            const all = (managementTasks || []).filter(t => !t.project_id)
            const visibleAll = isDirector ? all : all.filter(t => isTaskRelevantToUser(t, currentUser))
            const byStatus = COLUMNS.map(col => ({
              ...col,
              count: visibleAll.filter(t => t.status === col.id).length,
              pct: visibleAll.length ? Math.round(visibleAll.filter(t => t.status === col.id).length / visibleAll.length * 100) : 0
            }))
            const urgent = visibleAll.filter(t => t.priority === 'urgent' && t.status !== 'done').length
            const withChecklist = visibleAll.filter(t => Array.isArray(t.checklist) && t.checklist.length > 0).length
            const checklistDone = visibleAll.filter(t => {
              if (!Array.isArray(t.checklist) || !t.checklist.length) return false
              return t.checklist.every(i => i.done)
            }).length
            return (
              <>
                {byStatus.map(col => (
                  <div key={col.id} className="sb-stat-row">
                    <div className="sb-stat-label" style={{ color: col.color }}>{col.title}</div>
                    <div className="sb-stat-bar-wrap">
                      <div className="sb-stat-bar">
                        <div style={{ width: `${col.pct}%`, background: col.color, height: '100%', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                      <span className="sb-stat-num" style={{ color: col.color }}>{col.count}</span>
                    </div>
                  </div>
                ))}
                <div className="sb-divider" />
                <div className="sb-mini-stats">
                  <div className="sb-mini-stat">
                    <span className="sb-mini-label">Нагальних</span>
                    <span className="sb-mini-val" style={{ color: urgent > 0 ? '#ef4444' : '#555' }}>{urgent}</span>
                  </div>
                  <div className="sb-mini-stat">
                    <span className="sb-mini-label">З чеклістом</span>
                    <span className="sb-mini-val" style={{ color: '#60a5fa' }}>{withChecklist}</span>
                  </div>
                  <div className="sb-mini-stat">
                    <span className="sb-mini-label">Чекл. 100%</span>
                    <span className="sb-mini-val" style={{ color: '#10b981' }}>{checklistDone}</span>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </aside>
  )
}
