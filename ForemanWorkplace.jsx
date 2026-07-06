import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Factory, Loader2, X, Menu } from 'lucide-react'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

// Hooks
import { useForemanData } from './Foreman/hooks/useForemanData'
import { useMachineAssignment } from './Foreman/hooks/useMachineAssignment'

// Components
import { ForemanReportModal } from './Foreman/components/ForemanReportModal'
import { ForemanNaryadPrint } from './Foreman/components/ForemanNaryadPrint'
import { ForemanTaskList } from './Foreman/components/ForemanTaskList'
import { ForemanTaskDetails } from './Foreman/components/ForemanTaskDetails'

export default function ForemanWorkplace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTaskId = searchParams.get('task') || ''

  const {
    tasks,
    orders,
    allOrdersMap,
    nomenclatures,
    inventory,
    workCards,
    workCardHistory,
    machines,
    machineOperations,
    materialRequests,
    currentUser,
    fetchData,
    createWorkCardsBatch,
    confirmBuffer,
    reserveBZForTask,
    completeShop1Task,
    bomItems,
    activeCalls,
    resolveCall
  } = useMES()

  // State Management
  const [activeView, setActiveView] = useState('worksheet')
  const [selectedMachines, setSelectedMachines] = useState({})
  const [rowCapacities, setRowCapacities] = useState({})
  const [editingSplits, setEditingSplits] = useState({})
  const [genModal, setGenModal] = useState(null)
  const [printQueue, setPrintQueue] = useState(null)
  const [partialCounts, setPartialCounts] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCompletingTask, setIsCompletingTask] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedGroups, setExpandedGroups] = useState({})

  // Modals / Overlays States
  const [changeMachineTaskId, setChangeMachineTaskId] = useState(null)
  const [selectedNewMachine, setSelectedNewMachine] = useState('')
  
  const [changeNomMachineTaskId, setChangeNomMachineTaskId] = useState(null)
  const [changeNomMachineNomId, setChangeNomMachineNomId] = useState(null)
  const [changeNomMachineName, setChangeNomMachineName] = useState('')
  const [selectedNomNewMachine, setSelectedNomNewMachine] = useState('')

  const [printNaryadQueue, setPrintNaryadQueue] = useState(null)
  const [naryadPrintLoading, setNaryadPrintLoading] = useState(false)
  const [customAlert, setCustomAlert] = useState(null)

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTaskId, setReportTaskId] = useState(null)
  const [reportOrderRef, setReportOrderRef] = useState(null)
  const [reportCardsRef, setReportCardsRef] = useState([])

  // Drawer / Menu State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Lock refs for async operations
  const generatingLockRef = useRef(false)
  const saveTimeoutRef = useRef(null)

  // Shared Helper Functions
  const getRequestQty = (r) => {
    const q = Number(r.quantity) || 0
    const returned = Number(r.returned_qty) || 0
    return Math.max(0, q - returned)
  }

  const getDisplayMaterial = (partNom, snapshot) => {
    if (snapshot && snapshot.material) return snapshot.material
    return partNom?.material_type || '—'
  }

  // Bind custom hooks
  const {
    archiveCards,
    taskHistory,
    staticCompletedCards,
    staticHistory,
    taskCardsCountMap,
    taskReadinessMap,
    taskShortageMap,
    cachedShortageMap,
    cardScrapCache,
    productionCache,
    scrapCache,
    redoCache,
    allCardsCache,
    getDisplayPartsForOrderItem,
    getBOMParts,
    relevantTasks,
    activeQueueCount,
    itemsPerPage
  } = useForemanData({
    tasks,
    orders,
    allOrdersMap,
    nomenclatures,
    inventory,
    workCards,
    workCardHistory,
    bomItems,
    activeTaskId
  })

  const {
    isChangingMachine,
    handleChangeTaskMachine,
    handleUpdateNomenclatureMachineAndRecalculate
  } = useMachineAssignment(setCustomAlert)

  // Title effect for printing mode
  useEffect(() => {
    const originalTitle = document.title
    if (printQueue) {
      document.title = `Друк_${printQueue.part.nom?.name || 'Картки'}`
    } else if (printNaryadQueue) {
      document.title = `Наряд_${printNaryadQueue.order?.order_num || ''}`
    } else if (showReportModal && reportTaskId) {
      const taskObj = tasks.find(t => t.id === reportTaskId)
      const orderObj = taskObj ? (taskObj.orders || orders.find(o => o.id === taskObj.order_id) || allOrdersMap[taskObj.order_id]) : null
      document.title = `Звіт_Наряд_${orderObj?.order_num || ''}`
    }

    return () => {
      document.title = originalTitle
    }
  }, [printQueue, printNaryadQueue, showReportModal, reportTaskId, orders, allOrdersMap, nomenclatures, tasks, relevantTasks])

  // Call Handlers
  const handleResolveCall = async (callId) => {
    try {
      await resolveCall(callId, currentUser?.name || 'Майстер')
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleOpenReport = (taskObj, orderObj, cardsObj) => {
    setReportTaskId(taskObj.id)
    setReportOrderRef(orderObj)
    setReportCardsRef(cardsObj)
    setShowReportModal(true)
  }

  const handleOpenNaryadPrint = async (taskObj, orderObj) => {
    setNaryadPrintLoading(true)
    try {
      setPrintNaryadQueue({ task: taskObj, order: orderObj })
    } catch (e) {
      console.error(e)
    } finally {
      setNaryadPrintLoading(false)
    }
  }

  const handleCompleteShop1Task = async (taskId) => {
    if (!window.confirm("Ви дійсно хочете закрити наряд?")) return
    setIsCompletingTask(true)
    try {
      await completeShop1Task(taskId)
      setCustomAlert({ title: 'Наряд виконано!', message: '✓ Наряд успішно закрито та переведено в статус Виконано.' })
      fetchData(['tasks', 'work_cards', 'inventory'])
    } catch (err) {
      setCustomAlert({ title: 'Помилка закриття', message: err.message })
    } finally {
      setIsCompletingTask(false)
    }
  }

  const handleGenerateFromWorksheet = async (taskObj, partObj, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0, customCapacity = null) => {
    if (generatingLockRef.current) {
      console.warn("Generation already in progress, ignoring duplicate call.")
      return
    }
    generatingLockRef.current = true

    const findMachineLocal = (name) => {
      if (!name || name === 'Не вказано') return null
      const baseName = name.split(' №')[0].trim()
      let found = machines.find(m => m.name === baseName)
        || machines.find(m => m.name === name)
        || machines.find(m => m.type === baseName)
        || machines.find(m => m.type === name)
      return found
    }

    const machineObj = findMachineLocal(selectedMachineName)
    const capacity = customCapacity !== null ? Number(customCapacity) : (Number(machineObj?.sheet_capacity) || 1)
    const unitsPerSheet = Number(partObj.nom?.units_per_sheet) || 1

    const maxCardsForThisSplit = Math.ceil(sheets / capacity)
    const displayTotal = globalTotalCards || maxCardsForThisSplit

    let finalCount = Math.min(count, maxCardsForThisSplit - localGeneratedCount)
    if (finalCount <= 0) {
      generatingLockRef.current = false
      return
    }

    if (!isRepair) {
      let dbCardsCount = 0
      try {
        const { data, error } = await supabase
          .from('work_cards')
          .select('id, is_rework, operation')
          .eq('task_id', taskObj.id)
          .eq('nomenclature_id', partObj.nom?.id)
        if (!error && data) {
          dbCardsCount = data.filter(c => !c.is_rework && c.operation !== 'Склад БЗ').length
        }
      } catch (err) {
        console.error("Error fetching dbCardsCount:", err)
      }

      finalCount = Math.min(finalCount, displayTotal - dbCardsCount)
    }

    if (finalCount <= 0) {
      generatingLockRef.current = false
      return
    }

    const existingNomenclatureCards = (workCards || []).filter(wc =>
      String(wc.task_id) === String(taskObj.id) &&
      String(wc.nomenclature_id) === String(partObj.nom?.id)
    )

    let maxExistingSeq = 0
    existingNomenclatureCards.forEach(wc => {
      const match = (wc.card_info || '').match(/(\d+)\/(\d+)/)
      if (match) {
        const seq = parseInt(match[1])
        if (seq > maxExistingSeq) maxExistingSeq = seq
      }
    })

    const startSeqForThisBatch = maxExistingSeq + 1

    setIsGenerating(true)
    try {
      const cardsBatch = []
      let sheetsRemainingForThisSplit = sheets - (localGeneratedCount * capacity)

      const snapshotEntry = taskObj.plan_snapshot?.[String(partObj.nom?.id)]
      const originalNeed = snapshotEntry?.need || totalToReach || 0

      let reqRemainingForThisSplit = originalNeed - (localGeneratedCount * capacity * unitsPerSheet)
      if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0

      for (let i = 1; i <= finalCount; i++) {
        const currentSeq = startSeqForThisBatch + (i - 1)
        const sheetsInThisLoading = Math.min(sheetsRemainingForThisSplit, capacity)
        const qtyInThisLoading = Math.ceil(sheetsInThisLoading * unitsPerSheet)
        const reqInThisLoading = Math.min(qtyInThisLoading, reqRemainingForThisSplit)
        const bzInThisLoading = Math.max(0, qtyInThisLoading - reqInThisLoading)

        const prefix = isRepair ? '[REDO] ' : ''
        cardsBatch.push({
          operation: 'Розкрій',
          machine: selectedMachineName || 'Не вказано',
          estimatedTime: (Number(partObj.nom?.time_per_unit) || 0) * reqInThisLoading * 60,
          cardInfo: `${prefix}${currentSeq}/${displayTotal}${originalNeed > 0 ? ` [NEED:${originalNeed}]` : ''} [REQ:${reqInThisLoading}] [BZ:${bzInThisLoading}]`,
          quantity: qtyInThisLoading,
          bufferQty: bzInThisLoading,
          actualSheets: sheetsInThisLoading,
          status: isRepair ? 'waiting-materials' : 'new',
          is_rework: isRepair
        })

        sheetsRemainingForThisSplit -= sheetsInThisLoading
        reqRemainingForThisSplit -= reqInThisLoading
        if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0
      }

      const createdCards = await createWorkCardsBatch(taskObj.id, taskObj.order_id, partObj.nom.id, cardsBatch)

      if (isRepair && sheets > 0) {
        const totalQty = finalCount * capacity * unitsPerSheet
        // Insert material requests for dovyпуск
        const { data: currentReqs } = await supabase
          .from('material_requests')
          .select('*')
          .eq('task_id', taskObj.id)

        const baseThickness = partObj.nom?.material_type ? partObj.nom.material_type.match(/(\d+(?:\.\d+)?)\s*мм/) : null
        const thickStr = baseThickness ? baseThickness[1] + 'мм' : null

        const rawSheetsNom = nomenclatures.find(n => {
          const lowerName = n.name.toLowerCase()
          const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
          if (!isSheet) return false
          if (thickStr) {
            const reqThickness = lowerName.match(/(\d+(?:\.\d+)?)\s*мм/)
            return reqThickness && reqThickness[1] + 'мм' === thickStr
          }
          return n.name.toLowerCase().includes((partObj.nom?.material_type || '').toLowerCase())
        })

        if (rawSheetsNom) {
          await supabase.from('material_requests').insert({
            order_id: taskObj.order_id,
            task_id: taskObj.id,
            quantity: sheets,
            status: 'pending',
            nomenclature_id: rawSheetsNom.id,
            details: `ДОВИПУСК ДЛЯ ${taskObj.id}: ${rawSheetsNom.name} — ${sheets} л. (ДОДАТКОВО)`
          })
        }
      }

      if (createdCards && createdCards.length > 0) {
        setPrintQueue({
          task: taskObj,
          part: partObj,
          total: displayTotal,
          created: startSeqForThisBatch,
          metadata: createdCards.map((c, idx) => {
            const batchItem = cardsBatch[idx]
            return {
              id: c.id,
              loading: c.card_info,
              qty: batchItem ? batchItem.quantity : 0,
              estimatedTime: (Number(partObj.nom?.time_per_unit) || 0) * (batchItem ? batchItem.quantity : 0) * 60,
              totalLoadings: displayTotal,
              sheetsPerLoading: batchItem ? batchItem.actualSheets : capacity,
              machine: selectedMachineName
            }
          })
        })
      }
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenModal(null)
        generatingLockRef.current = false
      }, 500)
    }
  }

  // Local helper for setExpandedGroups update from within subcomponents
  const handleSetExpandedGroups = (updater) => {
    setExpandedGroups(updater)
  }

  return (
    <div className="foreman-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header className="module-nav no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', textDecoration: 'none' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled mobile-only">
            <Menu size={20} />
            <span>Черга</span>
            {activeQueueCount > 0 && (
              <span className="queue-badge" style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 900,
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {activeQueueCount}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Factory size={22} color="#ef4444" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900 }}>ВИРОБНИЦТВО</h1>
        </div>
        <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.75rem' }} className="hide-mobile">РЕЖИМ МАЙСТРА</div>
      </header>

      {isDrawerOpen && (
        <div
          className="drawer-backdrop no-print"
          onClick={() => setIsDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
        />
      )}

      <div className="master-grid no-print">
        {/* Task List Selector Sidebar */}
        <ForemanTaskList
          relevantTasks={relevantTasks}
          orders={orders}
          allOrdersMap={allOrdersMap}
          nomenclatures={nomenclatures}
          activeTaskId={activeTaskId}
          setActiveTaskId={(id) => {
            setActiveTaskId(id)
            setSearchParams({ task: id })
          }}
          taskReadinessMap={taskReadinessMap}
          taskShortageMap={taskShortageMap}
          cachedShortageMap={cachedShortageMap}
          taskCardsCountMap={taskCardsCountMap}
          staticHistory={staticHistory}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
        />

        {/* Workspace details Panel */}
        <div className="content-panel" style={{ flex: 1, background: '#0a0a0a' }}>
          <ForemanTaskDetails
            activeTaskId={activeTaskId}
            setActiveTaskId={(id) => {
              setActiveTaskId(id)
              setSearchParams({ task: id })
            }}
            activeView={activeView}
            setActiveView={setActiveView}
            selectedMachines={selectedMachines}
            setSelectedMachines={setSelectedMachines}
            rowCapacities={rowCapacities}
            setRowCapacities={setRowCapacities}
            editingSplits={editingSplits}
            setEditingSplits={setEditingSplits}
            genModal={genModal}
            setGenModal={setGenModal}
            printQueue={printQueue}
            setPrintQueue={setPrintQueue}
            partialCounts={partialCounts}
            setPartialCounts={setPartialCounts}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
            isCompletingTask={isCompletingTask}
            setIsCompletingTask={setIsCompletingTask}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            expandedGroups={expandedGroups}
            setExpandedGroups={handleSetExpandedGroups}
            changeMachineTaskId={changeMachineTaskId}
            setChangeMachineTaskId={setChangeMachineTaskId}
            selectedNewMachine={selectedNewMachine}
            setSelectedNewMachine={setSelectedNewMachine}
            changeNomMachineTaskId={changeNomMachineTaskId}
            setChangeNomMachineTaskId={setChangeNomMachineTaskId}
            changeNomMachineNomId={changeNomMachineNomId}
            setChangeNomMachineNomId={setChangeNomMachineNomId}
            changeNomMachineName={changeNomMachineName}
            setChangeNomMachineName={setChangeNomMachineName}
            selectedNomNewMachine={selectedNomNewMachine}
            setSelectedNomNewMachine={setSelectedNomNewMachine}
            printNaryadQueue={printNaryadQueue}
            setPrintNaryadQueue={setPrintNaryadQueue}
            naryadPrintLoading={naryadPrintLoading}
            setNaryadPrintLoading={setNaryadPrintLoading}
            customAlert={customAlert}
            setCustomAlert={setCustomAlert}
            // Hooks data
            archiveCards={archiveCards}
            taskHistory={taskHistory}
            staticCompletedCards={staticCompletedCards}
            staticHistory={staticHistory}
            taskCardsCountMap={taskCardsCountMap}
            taskReadinessMap={taskReadinessMap}
            taskShortageMap={taskShortageMap}
            cachedShortageMap={cachedShortageMap}
            productionCache={productionCache}
            scrapCache={scrapCache}
            redoCache={redoCache}
            allCardsCache={allCardsCache}
            getDisplayPartsForOrderItem={getDisplayPartsForOrderItem}
            getBOMParts={getBOMParts}
            // MES context data & actions
            tasks={tasks}
            orders={orders}
            allOrdersMap={allOrdersMap}
            nomenclatures={nomenclatures}
            inventory={inventory}
            workCards={workCards}
            machines={machines}
            machineOperations={machineOperations}
            materialRequests={materialRequests}
            currentUser={currentUser}
            // Shared actions
            handleResolveCall={handleResolveCall}
            handleOpenReport={handleOpenReport}
            handleOpenNaryadPrint={handleOpenNaryadPrint}
            handleChangeTaskMachine={handleChangeTaskMachine}
            handleUpdateNomenclatureMachineAndRecalculate={handleUpdateNomenclatureMachineAndRecalculate}
            handleCompleteShop1Task={handleCompleteShop1Task}
            handleGenerateFromWorksheet={handleGenerateFromWorksheet}
            activeCalls={activeCalls}
            getRequestQty={getRequestQty}
            getDisplayMaterial={getDisplayMaterial}
          />
        </div>
      </div>

      {/* Global Modals */}

      {/* Change task machine Modal */}
      {changeMachineTaskId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 16000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '28px', border: '1px solid #222', padding: '35px', position: 'relative', color: '#fff' }}>
            <button onClick={() => setChangeMachineTaskId(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
            <h3 style={{ margin: '0 0 15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Зміна верстата для всього наряду</h3>
            <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '25px' }}>Це змінить верстат для наряду та всіх невиконаних карток. Бронь старих фрез зніметься і створиться новий запит.</p>
            <div style={{ marginBottom: '25px' }}>
              <select
                value={selectedNewMachine}
                onChange={e => setSelectedNewMachine(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', fontWeight: 800 }}
              >
                {machines.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <button
              onClick={async () => {
                await handleChangeTaskMachine(changeMachineTaskId, selectedNewMachine)
                setChangeMachineTaskId(null)
              }}
              style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '18px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', border: 'none' }}
            >
              ПІДТВЕРДИТИ
            </button>
          </div>
        </div>
      )}

      {/* Change single nomenclature machine Modal */}
      {changeNomMachineTaskId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 16000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '28px', border: '1px solid #222', padding: '35px', position: 'relative', color: '#fff' }}>
            <button onClick={() => setChangeNomMachineTaskId(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
            <h3 style={{ margin: '0 0 15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Зміна верстата для деталі</h3>
            <p style={{ color: '#ff9000', fontSize: '0.85rem', fontWeight: 800, marginBottom: '5px' }}>{changeNomMachineName}</p>
            <p style={{ color: '#666', fontSize: '0.75rem', marginBottom: '25px' }}>Це змінить верстат для цієї деталі та всіх її невиконаних карток. Бронь фрез буде перераховано.</p>
            <div style={{ marginBottom: '25px' }}>
              <select
                value={selectedNomNewMachine}
                onChange={e => setSelectedNomNewMachine(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', fontWeight: 800 }}
              >
                {machines.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                onClick={async () => {
                  const taskObj = tasks.find(t => t.id === changeNomMachineTaskId)
                  await handleUpdateNomenclatureMachineAndRecalculate(taskObj, changeNomMachineNomId, selectedNomNewMachine)
                  setChangeNomMachineTaskId(null)
                }}
                style={{ flex: 1, background: '#3b82f6', color: '#fff', padding: '18px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', border: 'none' }}
              >
                ОДИН ВЕРСТАТ
              </button>
              <button
                onClick={() => {
                  const taskObj = tasks.find(t => t.id === changeNomMachineTaskId)
                  const entry = taskObj.plan_snapshot?.[String(changeNomMachineNomId)]
                  const currentSplits = entry?.splits || []
                  const unitsPerSheet = Number(entry?.units_per_sheet) || 1
                  const totalSheetsNeeded = Number(entry?.sheets) || 0
                  
                  let newSplits = [...currentSplits]
                  if (newSplits.length === 0) {
                    newSplits = [{ machine: selectedNomNewMachine, sheets: totalSheetsNeeded, qty: totalSheetsNeeded * unitsPerSheet }]
                  }
                  
                  setEditingSplits(prev => ({ ...prev, [changeNomMachineNomId]: newSplits }))
                  setChangeNomMachineTaskId(null)
                }}
                style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', padding: '18px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer' }}
              >
                РОЗДІЛИТИ (SPLIT)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytical report Modal Overlay */}
      {showReportModal && (
        <ForemanReportModal
          reportTaskId={reportTaskId}
          setShowReportModal={setShowReportModal}
          reportOrderRef={reportOrderRef}
          reportCardsRef={reportCardsRef}
        />
      )}

      {/* printable work order PDF overlay */}
      {printNaryadQueue && (
        <ForemanNaryadPrint
          printNaryadQueue={printNaryadQueue}
          setPrintNaryadQueue={setPrintNaryadQueue}
        />
      )}

      {/* Global customAlert overlay */}
      {customAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '400px', borderRadius: '24px', border: '1px solid #222', padding: '30px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 950, color: '#fff' }}>{customAlert.title}</h3>
            <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 25px', lineHeight: 1.5 }}>{customAlert.message}</p>
            <button
              onClick={() => setCustomAlert(null)}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)' }}
            >
              Зрозуміло
            </button>
          </div>
        </div>
      )}
    </div>
  )
}