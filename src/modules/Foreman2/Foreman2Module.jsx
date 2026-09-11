import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
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
import MaterialCorrectionModal from './features/material-correction/MaterialCorrectionModal.jsx'
import { useMaterialCorrection } from './features/material-correction/useMaterialCorrection.js'
import CreateNaryadModal from './features/create-naryad/CreateNaryadModal.jsx'
import ForemanPrintQueue from './components/ForemanPrintQueue.jsx'
import { ForemanReportModal } from '../Foreman/components/ForemanReportModal.jsx'
import { getDisplayMaterial } from './utils/foremanHelpers.js'
import {
  NARYAD_REPORT_SNAPSHOT_VERSION,
  reconcileScrapDetailRows,
  scopeReportCards,
  summarizeReportProduction,
  summarizeReportParts,
  uniqueReportRows
} from '../Foreman/utils/naryadReport.js'

export default function Foreman2Module() {
  const mes = useMES()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const urlTaskId = searchParams.get('task') || location.state?.taskId || null
  const [activeTaskId, setActiveTaskId] = useState(() => urlTaskId || localStorage.getItem('foreman2_active_task_id') || null)
  const [reissuePart, setReissuePart] = useState(null)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isCreateNaryadOpen, setIsCreateNaryadOpen] = useState(false)

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTaskId, setReportTaskId] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [reportStageFilter, setReportStageFilter] = useState('All')
  const [reportNomFilter, setReportNomFilter] = useState('All')
  const [reportSortBy, setReportSortBy] = useState('date')
  const [reportOperatorFilter, setReportOperatorFilter] = useState('All')
  const [reportDetailModal, setReportDetailModal] = useState(null)

  const {
    taskModels,
    allCards,
    allHistory,
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
  const materialCorrection = useMaterialCorrection({
    currentUser: mes.currentUser,
    nomenclatures: mes.nomenclatures || [],
    inventory: mes.inventory || [],
    fetchData: mes.fetchData,
    onCorrected: refreshForeman2
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
    if (urlTaskId && String(urlTaskId) !== String(activeTaskId)) {
      setActiveTaskId(String(urlTaskId))
    }
  }, [urlTaskId])

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

  const handleOpenReport = async (task, order, taskCardsOrForceRefresh = false, explicitForceRefresh = false) => {
    if (!task) return
    const forceRefresh = typeof taskCardsOrForceRefresh === 'boolean'
      ? taskCardsOrForceRefresh
      : Boolean(explicitForceRefresh)
    setReportTaskId(task.id)
    setShowReportModal(true)
    setReportStageFilter('All')
    setReportNomFilter('All')
    setReportSortBy('date')
    setReportOperatorFilter('All')

    const expectedOrderId = task.order_id || order?.id || null
    const reportModel = taskModels.find(model => String(model.id) === String(task.id))
    const liveTaskCards = scopeReportCards(allCards || [], task.id, expectedOrderId)
    const liveCardIds = new Set(liveTaskCards.map(card => String(card.id)))
    const liveHistory = uniqueReportRows((allHistory || []).filter(row => liveCardIds.has(String(row.card_id))))
    const liveScrapSummary = summarizeReportParts(reportModel?.parts || [])
    const liveProductionSummary = summarizeReportProduction(reportModel?.parts || [])
    const rawLiveScrapRows = uniqueReportRows(reportModel?.scrapRows || []).map(({ card: _card, ...row }) => row)
    const liveScrapRows = reconcileScrapDetailRows({
      parts: reportModel?.parts || [],
      rows: rawLiveScrapRows
    })
    const withLiveArchiveData = data => ({
      ...(data || {}),
      version: NARYAD_REPORT_SNAPSHOT_VERSION,
      taskId: task.id,
      orderId: expectedOrderId,
      taskCards: scopeReportCards([...(liveTaskCards || []), ...(data?.taskCards || [])], task.id, expectedOrderId),
      historyRows: uniqueReportRows([...(liveHistory || []), ...(data?.historyRows || [])]),
      scrapSummary: liveScrapSummary,
      scrapDetailRows: liveScrapRows,
      productionSummary: liveProductionSummary,
      acceptedDetailRows: liveProductionSummary.rows
    })

    const cached = task?.plan_snapshot?._report_snapshot
    const isUsableCache = Boolean(
      cached &&
      cached.version === NARYAD_REPORT_SNAPSHOT_VERSION &&
      String(cached.taskId || '') === String(task.id) &&
      String(cached.orderId || '') === String(expectedOrderId || '')
    )
    if (isUsableCache && !forceRefresh) {
      setReportData(withLiveArchiveData(cached))
      if (task.status === 'completed') {
        setReportLoading(false)
        return
      }
    }

    setReportLoading(true)
    if (!isUsableCache || forceRefresh) {
      setReportData(null)
    }

    try {
      const [{ data: materialRequests, error: reqError }, { data: allTaskCardsDB, error: cardsError }] = await Promise.all([
        mes.supabase
          .from('material_requests')
          .select('*, nomenclature:nomenclatures_v2(*)')
          .eq('task_id', task.id),
        mes.supabase
          .from('work_cards')
          .select('*')
          .eq('task_id', task.id)
          .limit(10000)
      ])

      if (reqError) console.warn('Error fetching material requests:', reqError.message)
      if (cardsError) throw cardsError

      const finalTaskCards = scopeReportCards(
        [...liveTaskCards, ...(allTaskCardsDB || [])],
        task.id,
        expectedOrderId
      )
      const allCardIds = finalTaskCards.map(c => c.id)
      const scopedMaterialRequests = (materialRequests || []).filter(request => (
        !expectedOrderId || !request.order_id || String(request.order_id) === String(expectedOrderId)
      ))

      if (allCardIds.length === 0) {
        const finalData = withLiveArchiveData({
          historyRows: [],
          taskCards: finalTaskCards,
          materialRequests: scopedMaterialRequests
        })
        setReportData(finalData)
        setReportLoading(false)
        return
      }

      const historyRows = []
      const chunkSize = 25
      const pageSize = 1000
      for (let i = 0; i < allCardIds.length; i += chunkSize) {
        const chunk = allCardIds.slice(i, i + chunkSize)
        for (let from = 0; ; from += pageSize) {
          const to = from + pageSize - 1
          const { data, error } = await mes.supabase
            .from('work_card_history')
            .select('*')
            .in('card_id', chunk)
            .order('created_at', { ascending: true })
            .range(from, to)

          if (error) throw error
          historyRows.push(...(data || []))
          if (!data || data.length < pageSize) break
        }
      }

      const uniqueHistory = Array.from(new Map(historyRows.filter(Boolean).map(row => [String(row.id), row])).values())
      uniqueHistory.sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0))
      const fetchedHistoryCardIds = new Set(uniqueHistory.map(row => String(row.card_id)).filter(Boolean))
      const supplementalLiveHistory = liveHistory.filter(row => (
        !row.is_scrap_total || !fetchedHistoryCardIds.has(String(row.card_id))
      ))

      const finalData = withLiveArchiveData({
        historyRows: uniqueReportRows([...supplementalLiveHistory, ...uniqueHistory]),
        taskCards: finalTaskCards,
        materialRequests: scopedMaterialRequests,
        scrapSummary: liveScrapSummary
      })
      setReportData(finalData)

      const updatedSnapshot = {
        ...(task.plan_snapshot || {}),
        _report_snapshot: finalData
      }

      await mes.supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
    } catch (e) {
      console.error(e)
      if (!isUsableCache) {
        alert('Помилка завантаження звіту: ' + e.message)
      }
    } finally {
      setReportLoading(false)
    }
  }

  const handleOpenReissue = (part) => {
    if (!activeModel) return
    const shortageSheets = Math.ceil(Number(part.shortage) / Math.max(1, Number(part.unitsPerSheet) || 1))
    cardGen.openGenModal({
      task: activeModel.task,
      part,
      count: 1,
      maxSheetsToGenerate: shortageSheets,
      isRepair: true
    })
  }

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
          onOpenCreateNaryad={() => setIsCreateNaryadOpen(true)}
        />
        <div className="content-panel no-print" style={{ flex: 1, background: '#0a0a0a', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            onOpenReport={(task, order) => handleOpenReport(task, order)}
            onOpenReissue={handleOpenReissue}
            onMachineChange={(part) => machineChange.openMachineChange(activeModel.task, part)}
            onMaterialCorrection={materialCorrection.canCorrect ? (part) => materialCorrection.open(activeModel.task, part) : null}
            onGenerateCards={(part, count, capacityOverride, maxSheetsToGenerate) => {
              // Dovypusk mode triggers ONLY when initial plan is fully generated, cards already exist, there is real scrap, and shortage > 0
              const remainingPlannedSheets = Math.max(0, (Number(part.plannedSheets) || 0) - (Number(part.actualSheets) || 0))
              const isInitialPlanFinished = remainingPlannedSheets <= 0
              const hasCards = (part.productionCards || []).length > 0
              const hasScrap = Number(part.scrap) > 0
              const isDovypusk = isInitialPlanFinished && hasCards && hasScrap && Number(part.shortage) > 0
              cardGen.openGenModal({ task: activeModel.task, part, count: 1, capacityOverride, maxSheetsToGenerate, isRepair: isDovypusk })
            }}
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
        partMachine={machineChange.changeNomMachineCurrentMachine}
        machines={mes.machines || []}
        inventory={mes.inventory || []}
        nomenclatures={mes.nomenclatures || []}
        machineOperations={mes.machineOperations || []}
        planPartInfo={activeModel?.task?.plan_snapshot?.[machineChange.changeNomMachineNomId]}
        onClose={machineChange.closeMachineChange}
        onSave={machineChange.saveMachineChange}
        isSaving={machineChange.isSavingMachineChange}
      />

      {reissuePart && (
        <ReissueModal
          task={activeModel?.task}
          part={reissuePart}
          machines={mes.machines || []}
          isBusy={isReissuing}
          error={reissueError}
          onClose={() => setReissuePart(null)}
          onConfirm={handleConfirmReissue}
        />
      )}

      {cardGen.genModalConfig && (
        <GenerateCardsModal
          config={cardGen.genModalConfig}
          machines={mes.machines || []}
          nomenclatures={mes.nomenclatures || []}
          machineOperations={mes.machineOperations || []}
          inventory={mes.inventory || []}
          workCards={mes.workCards || []}
          materialRequests={mes.requests || mes.materialRequests || []}
          isGenerating={cardGen.isGenerating}
          onClose={cardGen.closeGenModal}
          onGenerate={cardGen.handleGenerateCards}
        />
      )}

      {materialCorrection.part && (
        <MaterialCorrectionModal
          part={materialCorrection.part}
          options={materialCorrection.materialOptions}
          isSaving={materialCorrection.isSaving}
          error={materialCorrection.error}
          onClose={materialCorrection.close}
          onSave={materialCorrection.save}
        />
      )}

      <CreateNaryadModal
        isOpen={isCreateNaryadOpen}
        onClose={() => setIsCreateNaryadOpen(false)}
        orders={mes.orders || []}
        tasks={mes.tasks || []}
        nomenclatures={mes.nomenclatures || []}
        bomItems={mes.bomItems || []}
        inventory={mes.inventory || []}
        machines={mes.machines || []}
        createNaryad={mes.createNaryad}
        onNaryadCreated={(createdTask) => {
          refreshForeman2()
          if (createdTask?.id) setActiveTaskId(String(createdTask.id))
        }}
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
        customers={mes.customers || []}
      />

      <ForemanReportModal
        showReportModal={showReportModal}
        setShowReportModal={setShowReportModal}
        reportTaskId={reportTaskId}
        reportLoading={reportLoading}
        reportData={reportData}
        reportStageFilter={reportStageFilter}
        setReportStageFilter={setReportStageFilter}
        reportNomFilter={reportNomFilter}
        setReportNomFilter={setReportNomFilter}
        reportSortBy={reportSortBy}
        setReportSortBy={setReportSortBy}
        reportOperatorFilter={reportOperatorFilter}
        setReportOperatorFilter={setReportOperatorFilter}
        reportDetailModal={reportDetailModal}
        setReportDetailModal={setReportDetailModal}
        handleOpenReport={handleOpenReport}
        tasks={mes.tasks || []}
        orders={mes.orders || []}
        allOrdersMap={{}}
        bomItems={mes.bomItems || []}
        nomenclatures={mes.nomenclatures || []}
        machineOperations={mes.machineOperations || []}
        inventory={mes.inventory || []}
        workCards={mes.workCards || []}
        getRequestQty={(req) => Number(req?.quantity) || 0}
      />
    </Foreman2Layout>
  )
}
