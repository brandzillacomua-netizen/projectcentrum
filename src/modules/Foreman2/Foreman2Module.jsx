import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListTodo, Tablet } from 'lucide-react'
import { useMES } from '../../MESContext.jsx'
import { apiService } from '../../services/apiDispatcher.js'
import Foreman2Layout from './components/Foreman2Layout.jsx'
import TaskQueue from './components/TaskQueue.jsx'
import TaskDetails from './components/TaskDetails.jsx'
import ActiveCallsWidget from './components/ActiveCallsWidget.jsx'
import ReissueModal from './features/reissue/ReissueModal.jsx'
import { useReissueActions } from './features/reissue/useReissueActions.js'
import { useForeman2Data } from './features/task-loading/useForeman2Data.js'
import { useMachineChange } from './features/machine-change/useMachineChange.js'
import MachineChangeModal from './features/machine-change/MachineChangeModal.jsx'
import { useCardGeneration } from './features/card-generation/useCardGeneration.js'
import GenerateCardsModal from './features/card-generation/GenerateCardsModal.jsx'
import AdminCardDeletePanel from './features/admin-card-delete/AdminCardDeletePanel.jsx'
import { useAdminCardDelete } from './features/admin-card-delete/useAdminCardDelete.js'
import ForemanPrintQueue from '../Foreman/components/ForemanPrintQueue.jsx'
import { getDisplayMaterial } from '../Foreman/utils/foremanHelpers.js'

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
    nomenclatures,
    refreshForeman2
  } = useForeman2Data({ mes })

  const createDovypuskMaterialRequests = mes['createDovyпускMaterialRequests']
  const { createReissue, isReissuing, error: reissueError } = useReissueActions({
    createWorkCardsBatch: mes.createWorkCardsBatch,
    createDovypuskMaterialRequests,
    fetchData: mes.fetchData,
    machines: mes.machines || []
  })

  const machineChange = useMachineChange({
    tasks: mes.tasks || [],
    relevantTasks: mes.relevantTasks || [],
    nomenclatures: mes.nomenclatures || [],
    machineOperations: mes.machineOperations || [],
    inventory: mes.inventory || [],
    fetchData: mes.fetchData,
    setCustomAlert: () => {} // we can plug in custom alerts later if needed
  })

  const cardGen = useCardGeneration({ mes })
  const adminCardDelete = useAdminCardDelete({
    currentUser: mes.currentUser,
    fetchData: mes.fetchData,
    onDeleted: refreshForeman2
  })

  const activeCalls = (mes.machineCalls || []).filter(c =>
    c.status === 'pending' &&
    c.called_role === 'master' &&
    (!c.called_employee_id || c.called_employee_id === mes.currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    try {
      await apiService.resolveMachineCall(callId, mes.currentUser)
      mes.fetchData(['machine_calls']).catch(() => {})
    } catch (e) {
      alert('Помилка: ' + e.message)
    }
  }

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
          nomenclatures={nomenclatures}
          activeId={activeModel?.id}
          onSelect={handleSelectTask}
          isDrawerOpen={isQueueOpen}
          setIsDrawerOpen={setIsQueueOpen}
        />
        <div className="content-panel" style={{ flex: 1, background: '#0a0a0a', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <ActiveCallsWidget
            activeCalls={activeCalls}
            machines={mes.machines || []}
            onResolveCall={handleResolveCall}
          />
          <div className="foreman2-tabs no-print" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #222', background: '#090909', flexShrink: 0, marginTop: activeCalls.length > 0 ? '0' : '0' }}>
            <button type="button" className="active" style={{ borderBottom: '2px solid #ef4444' }}>
              <ListTodo size={15} /> Робочі наряди
            </button>
            <Link to="/shop1" style={{ marginLeft: 'auto', marginRight: '20px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', padding: '6px 12px', borderRadius: '8px', borderRight: 'none' }}>
              <Tablet size={15} /> Відкрити термінал цеху
            </Link>
          </div>
          <TaskDetails
            model={activeModel}
            nomenclatures={nomenclatures}
            allCards={allCards}
            onOpenReissue={handleOpenReissue}
            onMachineChange={(part) => machineChange.openMachineChange(activeModel.task, part)}
            onGenerateCards={(part, count, capacityOverride) => cardGen.openGenModal({ task: activeModel.task, part, count, capacityOverride, isRepair: false })}
            onPrintCards={(part, metadata) => cardGen.setPrintQueue({ task: activeModel.task, part, metadata })}
            adminCardsPanel={
              adminCardDelete.isSuperAdmin ? (
                <AdminCardDeletePanel
                  model={activeModel}
                  currentUser={mes.currentUser}
                  onDeleteCards={adminCardDelete.deleteCards}
                  isDeleting={adminCardDelete.isDeleting}
                  error={adminCardDelete.error}
                  lastResult={adminCardDelete.lastResult}
                />
              ) : null
            }
            onCompleteTask={async (taskId) => {
              try {
                await apiService.submitCompleteTaskByMaster(taskId, mes.completeTaskByMaster)
                mes.fetchData(['tasks', 'work_cards']).catch(() => {})
              } catch (e) {
                alert('Помилка при закритті: ' + e.message)
              }
            }}
          />
        </div>
      </div>

      <MachineChangeModal
        isOpen={!!machineChange.changeNomMachineTaskId}
        task={activeModel?.task}
        partId={machineChange.changeNomMachineNomId}
        partName={machineChange.changeNomMachineName}
        initialMachine={machineChange.selectedNomNewMachine}
        machines={mes.machines || []}
        machineOperations={mes.machineOperations || []}
        nomenclatures={mes.nomenclatures || []}
        inventory={mes.inventory || []}
        workCards={mes.workCards || []}
        archiveCards={[]} // we don't have archiveCards pulled into context, but maybe we do, could add later
        isChanging={machineChange.isChangingMachine}
        onClose={() => {
          machineChange.setChangeNomMachineTaskId(null)
          machineChange.setChangeNomMachineNomId(null)
        }}
        onConfirm={async (selectedMachine, resolvedSelections, safeNomLoadCapacity) => {
          await machineChange.handleUpdateNomenclatureMachineAndRecalculate(
            activeModel?.task,
            machineChange.changeNomMachineNomId,
            selectedMachine,
            null, // splits
            resolvedSelections,
            safeNomLoadCapacity
          )
        }}
      />

      <ReissueModal
        task={activeModel?.task}
        part={reissuePart}
        machines={mes.machines || []}
        isBusy={isReissuing}
        error={reissueError}
        onClose={() => setReissuePart(null)}
        onConfirm={handleConfirmReissue}
      />

      <GenerateCardsModal
        config={cardGen.genModalConfig}
        machines={mes.machines || []}
        nomenclatures={mes.nomenclatures || []}
        workCards={mes.workCards || []}
        materialRequests={mes.materialRequests || []}
        isGenerating={cardGen.isGenerating}
        onClose={cardGen.closeGenModal}
        onGenerate={cardGen.handleGenerateCards}
      />

      <ForemanPrintQueue
        printQueue={cardGen.printQueue}
        setPrintQueue={cardGen.setPrintQueue}
        orders={mes.orders || []}
        allOrdersMap={{}}
        nomenclatures={mes.nomenclatures || []}
        machines={mes.machines || []}
        machineOperations={mes.machineOperations || []}
        getDisplayMaterial={getDisplayMaterial}
      />
    </Foreman2Layout>
  )
}
