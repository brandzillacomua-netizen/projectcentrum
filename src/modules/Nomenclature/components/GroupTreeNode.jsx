import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FolderPlus, Edit2, Trash2 } from 'lucide-react'

export const GroupTreeNode = ({ group, allGroups, activeGroupId, onSelectGroup, onAddSubgroup, onEditGroup, onDeleteGroup, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const children = useMemo(() => allGroups.filter(g => g.parent_id === group.id), [allGroups, group.id])
  const hasChildren = children.length > 0
  const isSelected = activeGroupId === group.id

  const handleNodeClick = () => {
    onSelectGroup(group)
    if (hasChildren) {
      setIsOpen(prev => !prev)
    }
  }

  return (
    <div className="tree-node-wrap" style={{ marginLeft: depth * 12 }}>
      <div 
        onClick={handleNodeClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '8px 10px', 
          background: isSelected ? 'rgba(255, 144, 0, 0.15)' : isHovered ? 'var(--hover-bg, rgba(255,255,255,0.03))' : 'transparent', 
          borderRadius: '10px', 
          border: isSelected ? '1px solid rgba(255, 144, 0, 0.4)' : '1px solid transparent',
          marginBottom: '3px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          {hasChildren ? (
            <div style={{ color: '#ff9000', display: 'flex', alignItems: 'center' }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          ) : (
            <div style={{ width: '14px' }} />
          )}

          {hasChildren ? (
            isOpen ? <FolderOpen size={16} color="#ff9000" /> : <Folder size={16} color="#e58300" />
          ) : (
            <Folder size={16} color={isSelected ? '#ff9000' : '#e58300'} />
          )}

          <span style={{ 
            fontWeight: isSelected || depth === 0 ? 800 : 600, 
            fontSize: depth === 0 ? '0.85rem' : '0.8rem', 
            color: isSelected ? '#ff9000' : 'var(--text, #eee)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {group.name}
          </span>
        </div>

        {group.code && !isHovered && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, fontFamily: 'monospace' }}>
            {group.code}
          </span>
        )}

        {/* Hover Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', opacity: isHovered || isSelected ? 1 : 0, transition: 'opacity 0.2s' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); onAddSubgroup(group); }} 
            title="Додати підкатегорію сюди" 
            style={{ background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '6px', color: '#ff9000', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
          >
            <FolderPlus size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEditGroup(group); }} 
            title="Редагувати категорію" 
            style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#0284c7', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
          >
            <Edit2 size={12} />
          </button>
          {!hasChildren && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }} 
              title="Видалити категорію" 
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className="tree-node-children">
          {children.map(child => (
            <GroupTreeNode 
              key={child.id} 
              group={child} 
              allGroups={allGroups} 
              activeGroupId={activeGroupId}
              onSelectGroup={onSelectGroup}
              onAddSubgroup={onAddSubgroup}
              onEditGroup={onEditGroup}
              onDeleteGroup={onDeleteGroup}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  )
}
