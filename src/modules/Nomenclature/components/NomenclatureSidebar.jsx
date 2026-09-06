import React from 'react'
import { FolderPlus } from 'lucide-react'
import { GroupTreeNode } from './GroupTreeNode'

export const NomenclatureSidebar = ({
  groups,
  selectedGroup,
  setSelectedGroup,
  handleOpenCreateGroup,
  handleOpenEditGroup,
  handleDeleteGroup,
  totalItemsCount
}) => {
  return (
    <aside className="nom-v2-sidebar" style={{ width: '320px', background: 'var(--card-bg, #ffffff)', borderRight: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column' }}>
      <div className="nom-v2-sidebar-head" style={{ padding: '20px 20px 15px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '1px' }}>ДЕРЕВО КАТЕГОРІЙ</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => handleOpenCreateGroup(null)}
            style={{ background: 'rgba(255,144,0,0.15)', border: '1px solid rgba(255,144,0,0.3)', color: '#d97706', borderRadius: '8px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Створити нову головну категорію"
          >
            <FolderPlus size={13} /> + Категорія
          </button>
          {selectedGroup && (
            <button 
              onClick={() => setSelectedGroup(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Скинути
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '15px 12px', flex: 1, overflowY: 'auto' }}>
        {groups.filter(g => !g.parent_id).map(rootGroup => (
          <GroupTreeNode 
            key={rootGroup.id}
            group={rootGroup}
            allGroups={groups}
            activeGroupId={selectedGroup?.id}
            onSelectGroup={g => setSelectedGroup(g)}
            onAddSubgroup={g => handleOpenCreateGroup(g.id)}
            onEditGroup={g => handleOpenEditGroup(g)}
            onDeleteGroup={g => handleDeleteGroup(g)}
          />
        ))}
      </div>

      <div className="nom-v2-sidebar-foot" style={{ padding: '15px 20px', background: 'var(--card-header-bg, #f8fafc)', borderTop: '1px solid var(--border-color, #e2e8f0)', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Каталог V2:</span>
        <span style={{ color: '#d97706', fontWeight: 900 }}>{totalItemsCount} позицій</span>
      </div>
    </aside>
  )
}
