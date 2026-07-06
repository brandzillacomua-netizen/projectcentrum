const fs = require('fs')
const path = 'a:/centrum/src/modules/Foreman/hooks/useForemanHandlers.js'
let content = fs.readFileSync(path, 'utf8')

// The file currently starts with "imp\r\n  const handleResolveCall..."
// We need to prepend the proper header and wrap all the functions in the hook.
// The first real function starts at "  const handleResolveCall" (with 2 spaces indent).
// Strip everything before that and prepend the correct header.

const firstFn = '  const handleResolveCall'
const firstFnIndex = content.indexOf(firstFn)
if (firstFnIndex === -1) {
  console.error('Cannot find first function marker')
  process.exit(1)
}

const functionsBody = content.slice(firstFnIndex)

const header = `import { useEffect } from 'react'
import { findMachineByName } from '../utils/foremanHelpers'

export function useForemanHandlers({
  // From useMES
  createWorkCard,
  createWorkCardsBatch,
  completeTaskByMaster,
  confirmBuffer,
  reserveBZForTask,
  createDovyпускMaterialRequests,
  tasks,
  orders,
  workCards,
  inventory,
  nomenclatures,
  bomItems,
  machines,
  machineOperations,
  workCardHistory,

  // From useForemanData / State
  relevantTasks,
  allOrdersMap,
  setAllOrdersMap,
  setReportTaskId,
  setShowReportModal,
  setReportStageFilter,
  setReportNomFilter,
  setReportSortBy,
  setReportOperatorFilter,
  setReportData,
  setReportLoading,
  setPrintNaryadQueue,
  setNaryadPrintLoading,
  setIsChangingMachine,
  setCustomAlert,
  setChangeMachineTaskId,
  setIsGenerating,
  setGenModal,
  setPrintQueue,
  setBufferScrapModal,
  setBufferScrapCounts,
  bufferScrapModal,
  bufferScrapCounts,
  saveTimeoutRef,
  setEditingSplits,

  // Refs & Cache
  generatingLockRef,
  cardScrapCache,

  // API & Supabase
  supabase,
  apiService,

  // Methods
  fetchData,
  fetchModuleData,
  addLocalWorkCards
}) {

`

const fixed = header + functionsBody
fs.writeFileSync(path, fixed, 'utf8')
console.log('Done! File restored with correct header.')
console.log('Total lines approx:', fixed.split('\n').length)
