import React from 'react'
import { X } from 'lucide-react'
import PreparationQueueList from './PreparationQueueList'

export const PreparationQueueDrawer = ({
  isOpen,
  onClose,
  prepSubTasks,
  selectedSubTaskId,
  onSelectSubTask
}) => {
  return (
    <>
      {isOpen && (
        <div
          className="prep-drawer-overlay"
          onClick={onClose}
        />
      )}
      <div
        className="prep-drawer-content"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          left: 0
        }}
      >
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ ЗАВДАННЯ</span>
          <X size={20} onClick={onClose} style={{ cursor: 'pointer' }} />
        </div>
        <PreparationQueueList
          prepSubTasks={prepSubTasks}
          selectedSubTaskId={selectedSubTaskId}
          onSelectSubTask={onSelectSubTask}
        />
      </div>
    </>
  )
}

export default PreparationQueueDrawer
