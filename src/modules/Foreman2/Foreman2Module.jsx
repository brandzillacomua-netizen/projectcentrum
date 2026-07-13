import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListTodo, Tablet } from 'lucide-react'
import { useMES } from '../../MESContext.jsx'
import Foreman2Layout from './components/Foreman2Layout.jsx'
import TaskQueue from './components/TaskQueue.jsx'
import TaskDetails from './components/TaskDetails.jsx'
import ReissueModal from './features/reissue/ReissueModal.jsx'
import { useReissueActions } from './features/reissue/useReissueActions.js'
import { useForeman2Data } from './features/task-loading/useForeman2Data.js'

export default function Foreman2Module() {
  const mes = useMES()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTaskId, setActiveTaskId] = useState(() => searchParams.get('task') || localStorage.getItem('foreman2_active_task_id') || null)
  const [reissuePart, setReissuePart] = useState(null)
  const [isQueueOpen, setIsQueueOpen] = useState(false)

  const {
    taskModels,
    allCards,
    loading,
    error,
    refreshForeman2
  } = useForeman2Data({ mes })

  const createDovypuskMaterialRequests = mes['createDovyпускMaterialRequests']
  const { createReissue, isReissuing, error: reissueError } = useReissueActions({
    createWorkCardsBatch: mes.createWorkCardsBatch,
    createDovypuskMaterialRequests,
    fetchData: mes.fetchData,
    machines: mes.machines || []
  })

  useEffect(() => {
    if (activeTaskId) {
      localStorage.setItem('foreman2_active_task_id', activeTaskId)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('task', activeTaskId)
        return next
      }, { replace: true })
    }
  }, [activeTaskId, setSearchParams])

  useEffect(() => {
    if (taskModels.length === 0) return
    if (!activeTaskId || !taskModels.some(model => model.id === activeTaskId)) {
      setActiveTaskId(taskModels[0].id)
    }
  }, [taskModels, activeTaskId])

  const activeModel = useMemo(() => {
    return taskModels.find(model => model.id === activeTaskId) || taskModels[0] || null
  }, [taskModels, activeTaskId])

  const handleOpenReissue = (part) => setReissuePart(part)

  const handleConfirmReissue = async ({ capacityOverride }) => {
    if (!activeModel || !reissuePart) return
    await createReissue({ task: activeModel.task, part: reissuePart, capacityOverride })
    setReissuePart(null)
    refreshForeman2()
  }

  const handleSelectTask = (taskId) => {
    setActiveTaskId(taskId)
    setIsQueueOpen(false)
  }

  return (
    <Foreman2Layout loading={loading} error={error} onRefresh={refreshForeman2} onOpenQueue={() => setIsQueueOpen(true)}>
      <div className="master-grid no-print" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TaskQueue
          taskModels={taskModels}
          activeId={activeModel?.id}
          onSelect={handleSelectTask}
          isDrawerOpen={isQueueOpen}
          setIsDrawerOpen={setIsQueueOpen}
        />
        <div className="content-panel" style={{ flex: 1, background: '#0a0a0a', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="foreman2-tabs no-print" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #222', background: '#090909', flexShrink: 0 }}>
            <button type="button" className="active">
              <ListTodo size={15} /> Робочі наряди
            </button>
            <Link to="/shop1">
              <Tablet size={15} /> Відкрити термінал цеху
            </Link>
          </div>
          <TaskDetails
            model={activeModel}
            allCards={allCards}
            onOpenReissue={handleOpenReissue}
          />
        </div>
      </div>

      <ReissueModal
        task={activeModel?.task}
        part={reissuePart}
        machines={mes.machines || []}
        isBusy={isReissuing}
        error={reissueError}
        onClose={() => setReissuePart(null)}
        onConfirm={handleConfirmReissue}
      />
    </Foreman2Layout>
  )
}
