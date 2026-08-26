import { useState, useRef } from 'react'

export function useForemanData() {
  const [activeView, setActiveView] = useState('worksheet')
  const [selectedMachines, setSelectedMachines] = useState({})
  const [rowCapacities, setRowCapacities] = useState({})
  const [editingSplits, setEditingSplits] = useState({}) 
  const saveTimeoutRef = useRef(null)
  const [genModal, setGenModal] = useState(null)
  const [printQueue, setPrintQueue] = useState(null)
  const [partialCounts, setPartialCounts] = useState({}) 
  const [isGenerating, setIsGenerating] = useState(false)
  const generatingLockRef = useRef(false)
  const [isCompletingTask, setIsCompletingTask] = useState(false) 
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedGroups, setExpandedGroups] = useState({})

  // Reports
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTaskId, setReportTaskId] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [reportStageFilter, setReportStageFilter] = useState('All')
  const [reportNomFilter, setReportNomFilter] = useState('All')
  const [reportSortBy, setReportSortBy] = useState('date') 
  const [reportOperatorFilter, setReportOperatorFilter] = useState('All')
  const [reportDetailModal, setReportDetailModal] = useState(null) 

  // Machine changes
  const [changeMachineTaskId, setChangeMachineTaskId] = useState(null)
  const [selectedNewMachine, setSelectedNewMachine] = useState('')
  const [isChangingMachine, setIsChangingMachine] = useState(false)
  const [customAlert, setCustomAlert] = useState(null) 

  // Nom machine changes
  const [changeNomMachineTaskId, setChangeNomMachineTaskId] = useState(null)
  const [changeNomMachineNomId, setChangeNomMachineNomId] = useState(null)
  const [changeNomMachineName, setChangeNomMachineName] = useState('')
  const [selectedNomNewMachine, setSelectedNomNewMachine] = useState('')

  const [printNaryadQueue, setPrintNaryadQueue] = useState(null)
  const [naryadPrintLoading, setNaryadPrintLoading] = useState(false)

  const [isBufferScanning, setIsBufferScanning] = useState(false)
  const [bufferScrapModal, setBufferScrapModal] = useState(null)
  const [bufferScrapCounts, setBufferScrapCounts] = useState({})
  
  const [archiveCards, setArchiveCards] = useState([]) 
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [taskHistory, setTaskHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const taskDataCacheRef = useRef({
    archiveCards: {},
    taskHistory: {},
    lastWorkCards: null
  })
  const [staticCompletedCards, setStaticCompletedCards] = useState([])
  const [staticHistory, setStaticHistory] = useState([])
  const [customLoadingCapacities, setCustomLoadingCapacities] = useState({})

  const [cachedShortageMap, setCachedShortageMap] = useState({})

  return {
    activeView, setActiveView,
    selectedMachines, setSelectedMachines,
    rowCapacities, setRowCapacities,
    editingSplits, setEditingSplits,
    saveTimeoutRef,
    genModal, setGenModal,
    printQueue, setPrintQueue,
    partialCounts, setPartialCounts,
    isGenerating, setIsGenerating,
    generatingLockRef,
    isCompletingTask, setIsCompletingTask,
    isDrawerOpen, setIsDrawerOpen,
    currentPage, setCurrentPage,
    expandedGroups, setExpandedGroups,
    showReportModal, setShowReportModal,
    reportTaskId, setReportTaskId,
    reportLoading, setReportLoading,
    reportData, setReportData,
    reportStageFilter, setReportStageFilter,
    reportNomFilter, setReportNomFilter,
    reportSortBy, setReportSortBy,
    reportOperatorFilter, setReportOperatorFilter,
    reportDetailModal, setReportDetailModal,
    changeMachineTaskId, setChangeMachineTaskId,
    selectedNewMachine, setSelectedNewMachine,
    isChangingMachine, setIsChangingMachine,
    customAlert, setCustomAlert,
    changeNomMachineTaskId, setChangeNomMachineTaskId,
    changeNomMachineNomId, setChangeNomMachineNomId,
    changeNomMachineName, setChangeNomMachineName,
    selectedNomNewMachine, setSelectedNomNewMachine,
    printNaryadQueue, setPrintNaryadQueue,
    naryadPrintLoading, setNaryadPrintLoading,
    isBufferScanning, setIsBufferScanning,
    bufferScrapModal, setBufferScrapModal,
    bufferScrapCounts, setBufferScrapCounts,
    archiveCards, setArchiveCards,
    allOrdersMap, setAllOrdersMap,
    taskHistory, setTaskHistory,
    isLoadingHistory, setIsLoadingHistory,
    taskDataCacheRef,
    staticCompletedCards, setStaticCompletedCards,
    staticHistory, setStaticHistory,
    cachedShortageMap, setCachedShortageMap,
    customLoadingCapacities, setCustomLoadingCapacities
  }
}
