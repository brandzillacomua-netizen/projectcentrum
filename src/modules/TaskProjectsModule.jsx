import React from 'react'
import { CheckSquare, Plus, Search, X } from 'lucide-react'
import { useTaskProjectsData, DEFAULT_COLUMNS, getSavedProjectColumns } from './TaskProjects/hooks/useTaskProjectsData.js'
import TaskProjectsHeader from './TaskProjects/components/TaskProjectsHeader.jsx'
import TaskProjectsGrid from './TaskProjects/components/TaskProjectsGrid.jsx'
import TaskProjectsBoard from './TaskProjects/components/TaskProjectsBoard.jsx'
import TaskProjectsModal from './TaskProjects/components/modals/TaskProjectsModal.jsx'
import TaskProjectsTaskModal from './TaskProjects/components/modals/TaskProjectsTaskModal.jsx'

export default function TaskProjectsModule() {
  const tp = useTaskProjectsData()

  if (tp.activeProject) {
    const isOwnerOrManager = tp.isDirector || tp.activeProject.created_by === tp.currentUser?.login
    const projectColumns = (Array.isArray(tp.activeProject?.columns) && tp.activeProject.columns.length > 0)
      ? tp.activeProject.columns
      : (getSavedProjectColumns(tp.activeProject?.id) || DEFAULT_COLUMNS)
    const doneColumnId = projectColumns.find(c => c.id === 'done' || (c.title || '').toLowerCase().includes('виконан') || (c.title || '').toLowerCase().includes('готов'))?.id || projectColumns[projectColumns.length - 1]?.id
    const completed = tp.projectTasks.filter(t => t.status === doneColumnId).length
    const pct = tp.projectTasks.length ? Math.round(completed / tp.projectTasks.length * 100) : 0

    return (
      <div className="tp-root">
        <TaskProjectsHeader
          activeProject={tp.activeProject}
          setActiveId={tp.setActiveId}
          pct={pct}
          isOwnerOrManager={isOwnerOrManager}
          openProjectForm={tp.openProjectForm}
        />

        <TaskProjectsBoard
          activeProject={tp.activeProject}
          projectTasks={tp.projectTasks}
          projectColumns={projectColumns}
          isOwnerOrManager={isOwnerOrManager}
          updateManagementTask={tp.updateManagementTask}
          updateTaskProject={tp.updateTaskProject}
          systemUsers={tp.systemUsers}
          currentUser={tp.currentUser}
          openTaskForm={tp.openTaskForm}
          deleteManagementTask={tp.deleteManagementTask}
          isAddingCol={tp.isAddingCol}
          setIsAddingCol={tp.setIsAddingCol}
          newColTitle={tp.newColTitle}
          setNewColTitle={tp.setNewColTitle}
          newColColor={tp.newColColor}
          setNewColColor={tp.setNewColColor}
          handleAddColumnSubmit={tp.handleAddColumnSubmit}
        />

        {!tp.taskModal && !tp.projectModal && (
          <button className="tp-floating-add" onClick={() => tp.openTaskForm()} title="Створити задачу">
            <Plus size={25} />
          </button>
        )}

        {tp.taskModal && (
          <TaskProjectsTaskModal
            form={tp.taskForm}
            setForm={tp.setTaskForm}
            users={tp.assignableUsers}
            editing={tp.editingTask}
            saving={tp.saving}
            onSubmit={tp.saveTask}
            onClose={tp.closeTaskModal}
            project={tp.activeProject}
          />
        )}

        {tp.projectModal && (
          <TaskProjectsModal
            projectForm={tp.projectForm}
            setProjectForm={tp.setProjectForm}
            saveProject={tp.saveProject}
            saving={tp.saving}
            editingProject={tp.editingProject}
            systemUsers={tp.systemUsers}
            companyStructure={tp.companyStructure}
            onClose={() => tp.setProjectModal(false)}
            onDelete={() => tp.removeProject(tp.activeProject)}
          />
        )}

        <Styles />
      </div>
    )
  }

  return (
    <div className="tp-root">
      <TaskProjectsHeader
        activeProject={null}
        setActiveId={tp.setActiveId}
      />

      <div className="tp-toolbar">
        <div className="tp-search">
          <Search size={16} />
          <input placeholder="Пошук проєктів…" value={tp.query} onChange={e => tp.setQuery(e.target.value)} />
        </div>
        <span>{tp.filteredProjects.length} проєктів</span>
      </div>

      <TaskProjectsGrid
        filteredProjects={tp.filteredProjects}
        managementTasks={tp.managementTasks}
        setActiveId={tp.setActiveId}
        projectMembers={tp.projectMembers}
        canCreateProject={tp.canCreateProject}
      />

      {tp.projectModal && (
        <TaskProjectsModal
          projectForm={tp.projectForm}
          setProjectForm={tp.setProjectForm}
          saveProject={tp.saveProject}
          saving={tp.saving}
          editingProject={tp.editingProject}
          systemUsers={tp.systemUsers}
          companyStructure={tp.companyStructure}
          onClose={() => tp.setProjectModal(false)}
        />
      )}

      {tp.taskModal && (
        <TaskProjectsTaskModal
          form={tp.taskForm}
          setForm={tp.setTaskForm}
          users={tp.assignableUsers}
          editing={tp.editingTask}
          saving={tp.saving}
          onSubmit={tp.saveTask}
          onClose={tp.closeTaskModal}
          project={tp.targetProject}
        />
      )}

      {!tp.taskModal && !tp.projectModal && (
        <button className="tp-floating-add" onClick={() => tp.setAddMenuOpen(!tp.addMenuOpen)} title="Створити...">
          <Plus size={24} style={{ transform: tp.addMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      )}

      {tp.addMenuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => { tp.setAddMenuOpen(false); tp.setSelectingProject(false); }} />
          <div className="tp-add-popup">
            {!tp.selectingProject ? (
              <>
                {tp.canCreateProject && (
                  <button className="tp-menu-item" onClick={() => { tp.openProjectForm(); tp.setAddMenuOpen(false); }}>
                    <Plus size={16} color="#ff9000" />
                    <span>Створити проєкт</span>
                  </button>
                )}
                <button className="tp-menu-item" onClick={() => { tp.setSelectingProject(true); }}>
                  <CheckSquare size={16} color="#3b82f6" />
                  <span>Створити задачу по проєкту</span>
                </button>
              </>
            ) : (
              <>
                <div className="tp-popup-header">
                  <span>Оберіть проєкт для задачі:</span>
                  <button className="tp-popup-close" onClick={() => tp.setSelectingProject(false)}><X size={14} /></button>
                </div>
                <div className="tp-popup-list">
                  {tp.visibleProjects.map(p => (
                    <button key={p.id} className="tp-menu-item" onClick={() => { tp.openTaskFormForProject(p.id); tp.setAddMenuOpen(false); tp.setSelectingProject(false); }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span className="tp-popup-project-name">{p.name}</span>
                    </button>
                  ))}
                  {tp.visibleProjects.length === 0 && (
                    <div className="tp-popup-empty">Немає активних проєктів</div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <Styles />
    </div>
  )
}

function Styles() {
  return (
    <style>{`
  .tp-root{min-height:100vh;background:var(--bg, #050505);color:var(--text, #eee);font-family:Inter,system-ui,sans-serif}
  .tp-header{height:78px;padding:0 34px;border-bottom:1px solid var(--glass-border, #171717);display:flex;align-items:center;justify-content:space-between;background:var(--card-bg, #080808);gap:20px}
  .tp-heading,.tp-header-actions{display:flex;align-items:center;gap:14px}
  .tp-heading h1{font-size:1rem;letter-spacing:1.5px;margin:0 0 4px;color:var(--text, #eee)}
  .tp-heading p{margin:0;color:var(--text-muted, #666);font-size:.72rem}
  .tp-icon-btn,.tp-logo{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--glass-border, #222);background:var(--card-bg, #101010);color:var(--text-muted, #aaa);text-decoration:none}
  .tp-logo{color:#ff9000;background:rgba(255,144,0,0.07);border-color:rgba(255,144,0,0.2)}
  .tp-primary,.tp-secondary,.tp-danger{border:0;border-radius:10px;padding:10px 15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}
  .tp-primary{background:linear-gradient(135deg, #ff9000, #ffab2e);color:#090909;border:1px solid #ffc05a !important;box-shadow:0 5px 18px rgba(255,144,0,0.2);transition:transform .2s,box-shadow .2s,filter .2s}
  .tp-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,144,0,0.38);filter:brightness(1.07)}
  .tp-secondary{background:var(--card-bg, #151515);color:var(--text-muted, #ccc);border:1px solid var(--glass-border, #292929)}
  .tp-danger{background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.2)}
  .tp-toolbar{padding:22px 34px;display:flex;justify-content:space-between;align-items:center;color:var(--text-muted, #555);font-size:.75rem}
  .tp-search{width:min(360px,70vw);display:flex;align-items:center;gap:9px;background:var(--card-bg, #0d0d0d);border:1px solid var(--glass-border, #202020);border-radius:11px;padding:9px 12px;color:var(--text-muted, #555)}
  .tp-search input{flex:1;background:none;border:0;outline:0;color:var(--text, #eee)}
  .tp-grid{padding:0 34px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px}
  .tp-project{--pc:#8b5cf6;min-height:210px;background:var(--card-bg, #0b0b0b);border:1px solid var(--glass-border, #1c1c1c);border-top:2px solid var(--pc);border-radius:16px;padding:20px;cursor:pointer;transition:.2s}
  .tp-project:hover{transform:translateY(-3px);border-color:var(--pc);box-shadow:0 16px 40px rgba(0,0,0,0.4)}
  .tp-project-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--pc);background:color-mix(in srgb,var(--pc) 12%,transparent)}
  .tp-project h2{font-size:1rem;margin:17px 0 8px;color:var(--text, #eee)}
  .tp-project>p{font-size:.76rem;color:var(--text-muted, #666);line-height:1.5;height:34px;overflow:hidden}
  .tp-project-meta{display:flex;justify-content:space-between;color:var(--text-muted, #777);font-size:.68rem;margin-top:17px}
  .tp-project-meta span{display:flex;gap:6px;align-items:center}
  .tp-project-progress{height:4px;background:var(--glass-border, #191919);border-radius:3px;margin-top:12px;overflow:hidden}
  .tp-project-progress i{display:block;height:100%;background:var(--pc)}
  .tp-empty{grid-column:1/-1;text-align:center;color:var(--text-muted, #444);padding:80px 20px}
  .tp-empty h2{color:var(--text-muted, #888)}
  .tp-project-dot{width:13px;height:38px;border-radius:6px}
  .tp-progress{display:flex;align-items:center;gap:9px;color:var(--text-muted, #888);font-size:.72rem}
  .tp-progress i{width:90px;height:5px;background:var(--glass-border, #202020);border-radius:5px;overflow:hidden}
  .tp-progress b{display:block;height:100%}
  .tp-board{display:grid;gap:14px;padding:20px 26px;overflow-x:auto;align-items:start}
  .tp-column{background:var(--card-bg, #090909);border:1px solid var(--glass-border, #171717);border-radius:15px;min-height:calc(100vh - 120px)}
  .tp-column-head{padding:16px;display:flex;justify-content:space-between;align-items:center;font-size:.72rem;font-weight:900;letter-spacing:1px;border-bottom:1px solid var(--glass-border, #171717)}
  .tp-column-head b{color:var(--text-muted, #555)}
  .tp-col-controls{display:none;align-items:center;gap:3px;margin-left:auto}
  .tp-column-head:hover .tp-col-controls{display:flex}
  .tp-col-controls button{background:none;border:none;color:#888;cursor:pointer;padding:2px 4px;font-size:0.75rem;border-radius:4px;display:flex;align-items:center;transition:all 0.15s}
  .tp-col-controls button:hover{color:#ff9000;background:rgba(255,144,0,0.12)}
  .tp-col-controls .tp-col-del:hover{color:#ef4444;background:rgba(239,68,68,0.12)}
  .tp-col-color-picker{width:16px;height:16px;border:none;background:none;cursor:pointer;padding:0;border-radius:50%}
  .tp-add-column-card{min-width:270px;min-height:140px;border:2px dashed var(--glass-border, #222);border-radius:15px;background:var(--card-bg, #090909);color:var(--text-muted, #666);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:all 0.2s;font-weight:800;font-size:0.82rem}
  .tp-add-column-card:hover{border-color:#ff9000;color:#ff9000;background:rgba(255,144,0,0.04);transform:translateY(-2px)}
  .tp-new-column-card{min-width:270px;background:var(--card-bg, #0d0d0d);border:1px solid #ff900055;border-radius:15px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 8px 30px rgba(0,0,0,0.5)}
  .tp-new-column-card input{background:#141414;border:1px solid #292929;border-radius:8px;padding:8px 12px;color:#fff;font-size:0.82rem;outline:none}
  .tp-new-col-colors{display:flex;gap:6px}
  .tp-new-col-colors button{width:18px;height:18px;border-radius:50%;border:2px solid transparent;cursor:pointer}
  .tp-new-col-colors button.active{border-color:#fff}
  .tp-new-col-actions{display:flex;gap:8px;justify-content:flex-end}
  .tp-primary-sm{background:#ff9000;color:#000;border:none;padding:5px 12px;border-radius:7px;font-weight:800;font-size:0.75rem;cursor:pointer}
  .tp-secondary-sm{background:#222;color:#aaa;border:none;padding:5px;border-radius:7px;cursor:pointer;display:flex;align-items:center}
  .tp-cards{padding:11px;display:flex;flex-direction:column;gap:10px}
  .tp-task{position:relative;background:var(--card-bg, #111);border:1px solid var(--glass-border, #222);border-radius:13px;padding:15px;cursor:pointer;transition:transform 0.15s,border-color 0.15s,box-shadow 0.15s}
  .tp-task:hover{border-color:rgba(255,255,255,0.15);transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.3)}
  .tp-task h3{font-size:.88rem;margin:10px 0 7px;color:var(--text, #fff);font-weight:700;word-break:break-word}
  .tp-task>p{font-size:.72rem;color:var(--text-muted, #aaa);line-height:1.45;margin:0 0 13px}
  .tp-task footer{display:flex;flex-wrap:wrap;gap:9px;color:var(--text-muted, #777);font-size:.65rem}
  .tp-task footer span{display:flex;align-items:center;gap:5px}
  .tp-priority{font-size:.55rem;font-weight:900;letter-spacing:.8px}
  .p-low{color:#10b981}.p-medium{color:#60a5fa}.p-high{color:#f59e0b}.p-urgent{color:#ef4444}
  .tp-task-actions{position:absolute;right:8px;top:8px;display:none}
  .tp-task:hover .tp-task-actions{display:flex}
  .tp-task-actions button,.tp-modal header button{background:var(--card-bg, #191919);color:var(--text-muted, #888);border:1px solid var(--glass-border, transparent);border-radius:7px;padding:6px;cursor:pointer}
  .tp-task-actions button:hover{color:#ff9000;background:rgba(255,144,0,0.1)}
  .tp-empty-column{text-align:center;border:1px dashed var(--glass-border, #1d1d1d);border-radius:11px;color:var(--text-muted, #333);font-size:.68rem;padding:25px 8px}
  .tp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100100;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}
  .tp-modal{width:min(620px,96vw);max-height:90vh;overflow:auto;background:var(--card-bg, #0c0c0c);border:1px solid var(--glass-border, #292929);border-radius:17px;box-shadow:var(--shadow, 0 30px 90px rgba(0,0,0,0.8))}
  .tp-modal>header{display:flex;align-items:center;justify-content:space-between;padding:18px 21px;border-bottom:1px solid var(--glass-border, #1c1c1c)}
  .tp-modal header h2{font-size:.95rem;margin:0;color:var(--text, #eee)}
  .tp-form{padding:20px;display:flex;flex-direction:column;gap:16px}
  .tp-form label,.tp-label{display:flex;flex-direction:column;gap:7px;color:var(--text-muted, #888);font-size:.7rem;font-weight:700}
  .tp-form input,.tp-form textarea,.tp-form select{background:var(--bg, #111);border:1px solid var(--glass-border, #292929);border-radius:9px;padding:10px;color:var(--text, #eee);outline:none;font:inherit}
  .tp-form input:focus,.tp-form textarea:focus,.tp-form select:focus{border-color:rgba(255,144,0,0.5);box-shadow:0 0 0 2px rgba(255,144,0,0.1)}
  .tp-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tp-colors{display:flex;gap:9px;margin-top:8px}
  .tp-colors button{width:27px;height:27px;border-radius:50%;border:3px solid transparent;cursor:pointer}
  .tp-colors button.active{border-color:var(--text, #fff)}
  .tp-options{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}
  .tp-options label{display:flex;flex-direction:row;align-items:center;background:var(--bg, #111);padding:8px;border-radius:8px}
  .tp-options small{color:var(--text-muted, #444);margin-left:auto}
  .tp-users{max-height:170px;overflow:auto}
  .tp-modal-actions{display:flex;justify-content:flex-end;gap:10px}
  .tp-submit{align-self:flex-end}
  .tp-project-dot+div{max-width:460px}
  .tp-picker{position:relative}
  .tp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
  .tp-chips button{display:flex;align-items:center;gap:6px;background:rgba(255,144,0,0.08);color:#ffad32;border:1px solid rgba(255,144,0,0.22);border-radius:18px;padding:6px 9px;font-size:.68rem;cursor:pointer}
  .tp-picker-search{display:flex;align-items:center;gap:8px;background:var(--bg, #111);border:1px solid var(--glass-border, #292929);border-radius:9px;padding:0 10px;color:var(--text-muted, #555);margin-top:8px}
  .tp-picker-search:focus-within{border-color:rgba(255,144,0,0.4)}
  .tp-picker-search input{flex:1;border:0!important;background:transparent!important;padding-left:0!important;color:var(--text, #eee)}
  .tp-picker-results{margin-top:6px;background:var(--card-bg, #111);border:1px solid var(--glass-border, #292929);border-radius:10px;max-height:210px;overflow:auto;padding:5px}
  .tp-picker-results button{width:100%;display:flex;align-items:center;gap:8px;text-align:left;background:transparent;border:0;color:var(--text, #ddd);padding:9px;border-radius:7px;cursor:pointer}
  .tp-picker-results button:hover{background:var(--bg, #1b1b1b);color:#ffad32}
  .tp-picker-results button span{flex:1}
  .tp-picker-results small{color:var(--text-muted, #555)}
  .tp-picker-results>div{padding:14px;text-align:center;color:var(--text-muted, #555);font-size:.72rem}
  .tp-floating-add{position:fixed;right:32px;bottom:32px;z-index:99999;width:56px;height:56px;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #ff9000 0%, #ff5500 100%);color:#000;cursor:pointer;box-shadow:0 8px 24px rgba(255,144,0,0.4),inset 0 2px 4px rgba(255,255,255,0.2);transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);animation:float-btn-bounce-tp 3s ease-in-out infinite}
  .tp-floating-add:hover{transform:scale(1.1) translateY(-3px);box-shadow:0 12px 30px rgba(255,144,0,0.6);background:linear-gradient(135deg, #ffaa33 0%, #ff6622 100%)}
  .tp-floating-add:active{transform:scale(0.95)}
  @keyframes float-btn-bounce-tp{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  .tp-menu-item{transition:background 0.2s,color 0.2s}
  .tp-task{border-left:3px solid}
  .tp-check-progress{display:flex;align-items:center;gap:8px;margin:11px 0}
  .tp-check-progress>i{height:3px;background:var(--glass-border, #252525);border-radius:3px;overflow:hidden;flex:1}
  .tp-check-progress b{display:block;height:100%;background:#10b981}
  .tp-check-progress span{display:flex;align-items:center;gap:4px;color:#10b981;font-size:.62rem}
  .tp-task-form{padding-bottom:24px}
  .tp-colors .auto-color{width:auto;height:27px;border-radius:7px;background:var(--card-bg, #151515);color:var(--text-muted, #aaa);padding:0 10px;font-size:.65rem}
  .tp-check-builder>.tp-label{flex-direction:row;align-items:center;margin-bottom:8px}
  .checklist-editor{display:flex;flex-direction:column;gap:12px}
  .checklist-progress-row{display:flex;align-items:center;gap:10px}
  .cl-track{flex:1;height:5px;background:var(--glass-border, #111);border-radius:3px;overflow:hidden}
  .cl-fill{height:100%;border-radius:3px}
  .cl-pct{font-size:.75rem;font-weight:900;color:var(--text-muted, #888);min-width:32px;text-align:right}
  .checklist-items{display:flex;flex-direction:column;gap:6px}
  .checklist-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg, #090909);border:1px solid var(--glass-border, #141414);border-radius:9px}
  .checklist-item.parent-item{background:var(--card-bg)!important;border:1px solid var(--glass-border)!important;border-left:3px solid #ff9000!important;border-radius:12px!important;padding:12px 16px!important;margin-top:10px!important}
  .checklist-item.child-item{background:transparent!important;border:none!important;border-left:2px solid rgba(255,144,0,0.25)!important;border-radius:0!important;padding:6px 12px 6px 16px!important;margin-left:28px!important;margin-top:2px!important}
  .checklist-item.done .check-text{text-decoration:line-through;color:var(--text-muted, #444)}
  .check-toggle{background:none;border:none;padding:0;display:flex}
  .check-text{flex:1;font-size:.85rem;color:var(--text, #ccc);line-height:1.4}
  .check-remove{background:none;border:none;color:var(--text-muted, #555);cursor:pointer;padding:2px;display:flex}
  .checklist-empty{text-align:center;padding:20px;color:var(--text-muted, #333);font-size:.8rem}
  .add-check-row{display:flex;gap:8px}
  .add-check-row input{flex:1;background:var(--card-bg, #0d0d0d);border:1px solid var(--glass-border, #1a1a1a);color:var(--text, #fff);padding:9px 14px;border-radius:9px;outline:none}
  .add-check-btn{width:36px;height:36px;border-radius:9px;background:rgba(255,144,0,0.1);border:1px solid rgba(255,144,0,0.2);color:#ff9000;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .tp-add-popup{position:fixed;right:32px;bottom:100px;z-index:99999;background:var(--card-bg, #0c0c0c);border:1px solid var(--glass-border, #222);border-radius:16px;padding:12px;box-shadow:var(--shadow, 0 10px 40px rgba(0,0,0,0.8));width:260px;display:flex;flex-direction:column;gap:8px}
  .tp-menu-item{background:none;border:none;color:var(--text, #eee);text-align:left;padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;font-weight:600;font-size:0.82rem;width:100%;transition:background 0.2s,color 0.2s}
  .tp-menu-item:hover{background:rgba(255,144,0,0.08) !important;color:#ff9000 !important}
  .tp-popup-header{padding:4px 8px 8px;font-size:0.72rem;color:#ff9000;font-weight:800;border-bottom:1px solid var(--glass-border, #1a1a1a);display:flex;justify-content:space-between;align-items:center}
  .tp-popup-close{background:none;border:none;color:var(--text-muted, #555);cursor:pointer;padding:0;display:flex}
  .tp-popup-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-top:6px}
  .tp-popup-list .tp-menu-item{padding:8px 10px;font-size:0.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tp-popup-project-name{overflow:hidden;text-overflow:ellipsis;flex:1}
  .tp-popup-empty{padding:10px;font-size:0.72rem;color:var(--text-muted, #555);text-align:center}
  @media(max-width:800px){.tp-header{height:auto;padding:14px 16px;align-items:flex-start;flex-direction:column}.tp-header-actions{width:100%;flex-wrap:wrap}.tp-toolbar,.tp-grid{padding-left:16px;padding-right:16px}.tp-board{grid-template-columns:repeat(4,82vw);padding:14px}.tp-column{min-height:70vh}.tp-form-row,.tp-options{grid-template-columns:1fr}.tp-progress{display:none}.tp-heading p{max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
`}</style>
  )
}
