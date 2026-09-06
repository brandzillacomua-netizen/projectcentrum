import React from 'react'
import { Edit3, Trash2, X, Calendar, Eye, CheckSquare, MessageSquare } from 'lucide-react'
import { PriorityBadge } from '../KanbanPriorityBadge'
import { UserAvatar } from '../KanbanUserAvatar'
import { ChecklistEditor } from '../KanbanChecklistEditor'
import {
  PRIORITY_CFG,
  COLUMNS,
  getAssignees,
  isOverdueTask,
  genId
} from '../../utils/kanbanHelpers'

export const KanbanTaskDetailModal = ({
  detailOpen,
  setDetailOpen,
  selectedTask,
  setSelectedTask,
  detailTab,
  setDetailTab,
  canManageTask,
  canAdvance,
  handleOpenEdit,
  handleDelete,
  handleStatusChange,
  parsedSelectedTask,
  handleToggleCheckItem,
  newCheckItem,
  setNewCheckItem,
  updateManagementTask,
  isManager,
  currentUser,
  systemUsers,
  commentText,
  setCommentText,
  handleAddComment
}) => {
  if (!detailOpen || !selectedTask) return null

  return (
    <div className="modal-overlay" onClick={() => setDetailOpen(false)}>
      <div className="modal-box detail-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-head" style={{ borderBottomColor: (PRIORITY_CFG[selectedTask.priority] || PRIORITY_CFG.medium).color + '30' }}>
          <div className="modal-head-left">
            <span className="priority-dot" style={{ background: (PRIORITY_CFG[selectedTask.priority] || PRIORITY_CFG.medium).color }} />
            <h2>{selectedTask.title}</h2>
          </div>
          <div className="modal-head-right">
            {canManageTask(selectedTask) && (
              <>
                <button className="icon-btn" onClick={() => { setDetailOpen(false); handleOpenEdit(selectedTask) }} title="Редагувати"><Edit3 size={16} /></button>
                <button className="icon-btn danger" onClick={e => handleDelete(selectedTask.id, e)} title="Видалити"><Trash2 size={16} /></button>
              </>
            )}
            <button className="icon-btn" onClick={() => setDetailOpen(false)}><X size={18} /></button>
          </div>
        </div>

        <div className="detail-body">
          {/* Sidebar */}
          <aside className="detail-side">
            {/* Status */}
            <div className="side-block">
              <label>СТАТУС</label>
              {canManageTask(selectedTask) ? (
                <select className="status-select" value={selectedTask.status}
                  onChange={async e => handleStatusChange(e.target.value)}>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              ) : (
                <div className="side-val status-chip" style={{ color: COLUMNS.find(c => c.id === selectedTask.status)?.color }}>
                  {COLUMNS.find(c => c.id === selectedTask.status)?.title}
                </div>
              )}
            </div>

            {/* Assignees */}
            <div className="side-block">
              <label>ВИКОНАВЦІ</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {getAssignees(selectedTask).length > 0
                  ? getAssignees(selectedTask).map(login => {
                      const u = (systemUsers || []).find(u => u.login === login)
                      return u ? (
                        <div key={login} className="side-val">
                          <UserAvatar user={u} size={22} showName />
                        </div>
                      ) : null
                    })
                  : <div className="side-val"><UserAvatar user={null} size={22} showName /></div>
                }
              </div>
            </div>

            {/* Deadline */}
            {selectedTask.deadline && (
              <div className="side-block">
                <label>ДЕДЛАЙН</label>
                <div className="side-val" style={{ color: isOverdueTask(selectedTask) ? '#ef4444' : '#888' }}>
                  <Calendar size={13} />
                  {new Date(selectedTask.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            )}

            {/* Creator */}
            <div className="side-block">
              <label>ТВОРЕЦЬ</label>
              <div className="side-val">
                <UserAvatar user={(systemUsers || []).find(u => u.login === selectedTask.created_by)} size={22} showName />
              </div>
            </div>

            {/* Priority */}
            <div className="side-block">
              <label>ПРІОРИТЕТ</label>
              <PriorityBadge priority={selectedTask.priority} />
            </div>

            {/* Quick actions */}
            {canAdvance(selectedTask) && selectedTask.status !== 'done' && (
              <div className="side-block">
                <label>ДІЇ</label>
                <div className="side-actions">
                  {selectedTask.status === 'todo' && (
                    <button className="sa-btn sa-start" onClick={() => handleStatusChange('in_progress')}>▶ Почати роботу</button>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <button className="sa-btn sa-review" onClick={() => handleStatusChange('review')}>⚙ На перевірку</button>
                  )}
                  {selectedTask.status === 'review' && (
                    <>
                      {canManageTask(selectedTask) ? (
                        <>
                          <button className="sa-btn sa-approve" onClick={() => handleStatusChange('done')}>✓ Прийняти</button>
                          <button className="sa-btn sa-reject" onClick={() => handleStatusChange('in_progress')}>✕ Відхилити</button>
                        </>
                      ) : (
                        <button className="sa-btn sa-reject" style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleStatusChange('in_progress')}>↩ Скасувати перевірку</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* Main content */}
          <div className="detail-main">
            {/* Tabs */}
            <div className="detail-tabs">
              {[
                ['desc', 'Опис', <Eye size={13} />],
                ['checklist', `Чеклист${Array.isArray(selectedTask.checklist) && selectedTask.checklist.length ? ` (${selectedTask.checklist.length})` : ''}`, <CheckSquare size={13} />],
                ['comments', `Коментарі (${parsedSelectedTask.comments.length})`, <MessageSquare size={13} />],
              ].map(([id, lbl, icon]) => (
                <button key={id} className={`dtab ${detailTab === id ? 'active' : ''}`} onClick={() => setDetailTab(id)}>
                  {icon} {lbl}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {detailTab === 'desc' && (
              <div className="tab-content">
                <div className="desc-box">
                  {parsedSelectedTask.description || <span className="dim-text">Опис відсутній</span>}
                </div>
              </div>
            )}

            {detailTab === 'checklist' && (
              <div className="tab-content">
                <ChecklistEditor
                  items={Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []}
                  onToggle={(itemId) => handleToggleCheckItem(selectedTask, itemId)}
                  newItem={newCheckItem}
                  setNewItem={setNewCheckItem}
                  onAdd={async () => {
                    if (!newCheckItem.trim()) return
                    const updated = [...(Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []), { id: genId(), text: newCheckItem.trim(), done: false }]
                    await updateManagementTask(selectedTask.id, { checklist: updated })
                    setSelectedTask(prev => ({ ...prev, checklist: updated }))
                    setNewCheckItem('')
                  }}
                  onAddSubItem={async (parentId, text) => {
                    const updated = [...(Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []), { id: genId(), text, done: false, parent_id: parentId }]
                    await updateManagementTask(selectedTask.id, { checklist: updated })
                    setSelectedTask(prev => ({ ...prev, checklist: updated }))
                  }}
                  onRemove={async (itemId) => {
                    const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).filter(i =>
                      String(i.id) !== String(itemId) && String(i.parent_id) !== String(itemId)
                    )
                    await updateManagementTask(selectedTask.id, { checklist: updated })
                    setSelectedTask(prev => ({ ...prev, checklist: updated }))
                  }}
                  canEdit={isManager || selectedTask?.created_by === currentUser?.login}
                  systemUsers={systemUsers}
                  onUpdateAssignee={async (itemId, assignees) => {
                    const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).map(i =>
                      String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i
                    )
                    await updateManagementTask(selectedTask.id, { checklist: updated })
                    setSelectedTask(prev => ({ ...prev, checklist: updated }))
                  }}
                  onUpdateDeadline={async (itemId, dateStr) => {
                    const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).map(i =>
                      String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i
                    )
                    await updateManagementTask(selectedTask.id, { checklist: updated })
                    setSelectedTask(prev => ({ ...prev, checklist: updated }))
                  }}
                />
              </div>
            )}

            {detailTab === 'comments' && (
              <div className="tab-content comments-content">
                <div className="comments-list">
                  {parsedSelectedTask.comments.map((c, i) => (
                    <div key={i} className="comment-item">
                      <div className="comment-meta">
                        <span className="comment-author">{c.author}</span>
                        <span className="comment-time">{c.time}</span>
                      </div>
                      <div className="comment-bubble">{c.text}</div>
                    </div>
                  ))}
                  {parsedSelectedTask.comments.length === 0 && (
                    <div className="comments-empty"><MessageSquare size={20} /><span>Немає коментарів</span></div>
                  )}
                </div>
                <form className="comment-form" onSubmit={handleAddComment}>
                  <input type="text" placeholder="Напишіть коментар..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                  <button type="submit" className="comment-send">НАДІСЛАТИ</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
