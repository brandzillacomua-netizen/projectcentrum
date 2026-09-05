import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Factory, ListTodo, Loader2, X, Printer, LayoutDashboard, Layers, User, Clock, Package, Scan, CheckCircle2, AlertTriangle, Camera, Tablet, Menu, Shuffle, RefreshCw, Sun, Moon } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'
import { useForemanData } from './Foreman/hooks/useForemanData'
import { useForemanComputed } from './Foreman/hooks/useForemanComputed'
import { useForemanHandlers } from './Foreman/hooks/useForemanHandlers'
import ForemanTaskQueue from './Foreman/components/ForemanTaskQueue'
import ForemanPrintQueue from './Foreman/components/ForemanPrintQueue'
import ForemanPrintNaryadQueue from './Foreman/components/ForemanPrintNaryadQueue'
import { ForemanReportModal } from './Foreman/components/ForemanReportModal'
import ForemanAdminCardDeletePanel from './Foreman/features/admin-card-delete/ForemanAdminCardDeletePanel.jsx'
import MaterialCorrectionModal from './Foreman2/features/material-correction/MaterialCorrectionModal.jsx'
import MaterialCorrectionAction from './Foreman2/features/material-correction/MaterialCorrectionAction.jsx'
import { useMaterialCorrection } from './Foreman2/features/material-correction/useMaterialCorrection.js'
import { getPendingMaterialCorrection } from './Foreman2/features/material-correction/materialCorrectionState.js'
import { getDisplayPartsForOrderItem as getDisplayPartsForOrderItemHelper, getStandardMachineType, findMachineByName, MACHINE_TYPES, getScrapBreakdown } from './Foreman/utils/foremanHelpers'
import MachineChangeModal from './Foreman2/features/machine-change/MachineChangeModal.jsx'
import { useMachineChange } from './Foreman2/features/machine-change/useMachineChange.js'
import { getFinalScrapForTaskPart } from './VKYA/quality-hold/qualityHoldModel.js'
import { useQualityLossTotals } from './VKYA/quality-hold/useQualityLossTotals.js'
import { calculateCuttersForBatch } from '../utils/cutterCalculator'
import { getNomUnitsPerSheet } from '../utils/unitsHelper'

const uniqueById = (rows = []) => {
  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

const fetchWorkCardsByTaskIds = async (taskIds = [], columns = '*') => {
  const rows = []
  const chunkSize = 8
  const pageSize = 1000

  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const chunk = taskIds.slice(i, i + chunkSize)
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('work_cards')
        .select(columns)
        .in('task_id', chunk)
        .order('created_at', { ascending: true })
        .range(from, to)

      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
  }

  return uniqueById(rows)
}

const fetchScrapHistoryByCardIds = async (cardIds = []) => {
  const rows = []
  const chunkSize = 25
  const pageSize = 1000

  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('work_card_history')
        .select('id, card_id, nomenclature_id, scrap_qty, created_at, completed_at, stage_name, operator_name')
        .in('card_id', chunk)
        .gt('scrap_qty', 0)
        .order('created_at', { ascending: true })
        .range(from, to)

      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
  }

  return uniqueById(rows)
}

const getRequestQty = (r) => {
  if (r.quantity !== null && r.quantity !== undefined) return Number(r.quantity);
  const match = (r.details || '').match(/—\s*(\d+)/);
  return match ? Number(match[1]) : 0;
};

const isSameMachineFamily = (left, right) => {
  if (!left || !right) return false
  const normalize = value => String(getStandardMachineType(value) || value)
    .toLowerCase()
    .replace(/[х×]/g, 'x')
    .replace(/\s*№.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalize(left) === normalize(right)
}

const getArchiveMachineGroup = (machineName) => {
  const rawName = String(machineName || '').trim()
  const standardType = getStandardMachineType(rawName)
  const normalized = (standardType || rawName).toLowerCase()

  if (normalized.includes('1200x800') || normalized.includes('12x8') || normalized.includes('малий')) {
    return { key: 'small', label: 'Малий' }
  }
  if (normalized.includes('ke xin') || normalized.includes('фея')) {
    return { key: 'fairy', label: 'Фея' }
  }
  if (normalized.includes('6000x2000') || normalized.includes('60x20') || normalized.includes('дракон')) {
    return { key: 'dragon', label: 'Дракон' }
  }
  if (normalized.includes('3060') || normalized.includes('30x16') || normalized.includes('триголов')) {
    return { key: 'three-head', label: 'Триголовий' }
  }
  if (normalized.includes('3050') || normalized.includes('16x16') || normalized.includes('швидкіс')) {
    return { key: 'speed', label: 'Швидкісний' }
  }

  const baseName = rawName.replace(/\s*№\s*[\w.-]+.*$/iu, '').trim()
  return { key: `other:${baseName || 'unknown'}`, label: baseName || 'Верстат не вказано' }
}


const getDisplayMaterial = (partNom, snapshot) => {
  const baseMat = partNom?.material_type || '—'
  if (!snapshot) return baseMat
  const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
  const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0

  const hasT300 = (baseMat || '').toLowerCase().includes('т300') || (baseMat || '').toLowerCase().includes('t300')
  const hasT700 = (baseMat || '').toLowerCase().includes('т700') || (baseMat || '').toLowerCase().includes('t700')
  const isDefaultT700 = hasT700

  // If we have custom sheets in snapshot
  if (snapshot.sheets_t300 !== undefined || snapshot.sheets_t700 !== undefined) {
    if (s700 > 0 && s300 === 0) {
      if (hasT300) return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
      if (!hasT700) return 'Т700 ' + baseMat
      return baseMat
    }
    if (s300 > 0 && s700 > 0) {
      if (hasT300) return baseMat.replace(/т300/gi, 'Т300+Т700').replace(/t300/gi, 'Т300+Т700')
      if (hasT700) return baseMat.replace(/т700/gi, 'Т300+Т700').replace(/t700/gi, 'Т300+Т700')
      return 'Т300+Т700 ' + baseMat
    }
    if (s300 > 0 && s700 === 0) {
      if (hasT700) return baseMat.replace(/т700/gi, 'Т300').replace(/t700/gi, 'Т300')
      if (!hasT300) return 'Т300 ' + baseMat
      return baseMat
    }
  } else if (isDefaultT700) {
    return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
  }

  return baseMat
}

const getEffectiveMaterial = (partNom, snapshot) => {
  const baseMaterial = snapshot?.material || partNom?.material_type || ''
  const t300Sheets = Number(snapshot?.sheets_t300) || 0
  const t700Sheets = Number(snapshot?.sheets_t700) || 0
  if (t700Sheets > 0 && t300Sheets === 0) {
    if (/[тt]\s*300/i.test(baseMaterial)) return baseMaterial.replace(/[тt]\s*300/ig, 'Т700')
    if (!/[тt]\s*700/i.test(baseMaterial)) return `Т700 ${baseMaterial}`
  }
  if (t300Sheets > 0 && t700Sheets === 0) {
    if (/[тt]\s*700/i.test(baseMaterial)) return baseMaterial.replace(/[тt]\s*700/ig, 'Т300')
    if (!/[тt]\s*300/i.test(baseMaterial)) return `Т300 ${baseMaterial}`
  }
  return baseMaterial
}

const ForemanWorkplace = () => {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { tasks, orders, workCards, createWorkCard, createWorkCardsBatch, inventory, completeTaskByMaster, nomenclatures, bomItems, machines, machineOperations, workCardHistory, confirmBuffer, fetchData, reserveBZForTask, fetchTaskArchiveCards, fetchModuleData, fetchTaskPlanSnapshot, machineCalls, currentUser, createDovyпускMaterialRequests, requests: materialRequests, theme, toggleTheme } = useMES()
  const { workCardScrapTotals = [] } = useMES()
  const qualityLossTaskIds = useMemo(() => tasks.map(task => task.id).filter(Boolean), [tasks])
  const qualityLoss = useQualityLossTotals(supabase, qualityLossTaskIds)
  const materialCorrection = useMaterialCorrection({
    currentUser,
    nomenclatures,
    inventory,
    fetchData
  })

  const countAsProduced = (card) => {
    if (card.status === 'completed') return true
    if (card.status === 'at-shop2-buffer') return true
    return false
  }

  const activeCalls = (machineCalls || []).filter(c =>
    c.status === 'pending' &&
    c.called_role === 'master' &&
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const urlTaskId = searchParams.get('task') || location.state?.taskId || null

  const [activeTaskId, setActiveTaskId] = useState(() => {
    return urlTaskId || localStorage.getItem('foreman_active_task_id') || null
  })
  const [selectedDovypuskCutters, setSelectedDovypuskCutters] = useState({})
  const {
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
  } = useForemanData()

  const [activeTab, setActiveTab] = useState('active') // 'active' | 'archive'
  const [selectedCutterTypes, setSelectedCutterTypes] = useState({})
  const [selectedNomLoadCapacity, setSelectedNomLoadCapacity] = useState('')
  const [nomLoadCapacityOverrides, setNomLoadCapacityOverrides] = useState({})

  const machineChange = useMachineChange({
    tasks: tasks || [],
    relevantTasks: tasks || [],
    nomenclatures: nomenclatures || [],
    machineOperations: machineOperations || [],
    inventory: inventory || [],
    fetchData,
    setCustomAlert
  })
  const [localGeneratedCards, setLocalGeneratedCards] = useState([])
  const [expandedArchiveMachines, setExpandedArchiveMachines] = useState({})
  const archiveLoadSeqRef = useRef(0)
  const activeTaskCardsForArchive = useMemo(() => {
    if (!activeTaskId) return []
    return workCards.filter(c => c.task_id === activeTaskId)
  }, [workCards, activeTaskId])
  const activeTaskCardsKey = useMemo(() => {
    return activeTaskCardsForArchive.map(c => String(c.id)).sort().join('|')
  }, [activeTaskCardsForArchive])
  const activeTaskScrapTotalsKey = useMemo(() => {
    if (!activeTaskId) return ''
    return (workCardScrapTotals || [])
      .filter(row => row.task_id === activeTaskId && (Number(row.total_scrap) || 0) > 0)
      .map(row => `${row.card_id}:${row.nomenclature_id}:${row.total_scrap}`)
      .sort()
      .join('|')
  }, [workCardScrapTotals, activeTaskId])

  useEffect(() => {
    if (localGeneratedCards.length === 0 || workCards.length === 0) return
    const syncedIds = new Set(workCards.map(c => String(c.id)))
    setLocalGeneratedCards(prev => prev.filter(c => !syncedIds.has(String(c.id))))
  }, [workCards, localGeneratedCards.length])

  useEffect(() => {
    if (urlTaskId) {
      if (String(urlTaskId) !== String(activeTaskId)) {
        setActiveTaskId(String(urlTaskId))
      }
      const targetTaskObj = (tasks || []).find(t => String(t.id) === String(urlTaskId))
      if (targetTaskObj && targetTaskObj.status === 'completed') {
        setActiveTab('archive')
      } else if (targetTaskObj) {
        setActiveTab('active')
      }
    }
  }, [urlTaskId, tasks])

  useEffect(() => {
    if (activeTaskId) {
      localStorage.setItem('foreman_active_task_id', activeTaskId)
    } else {
      localStorage.removeItem('foreman_active_task_id')
    }
  }, [activeTaskId])

  useEffect(() => {
    localStorage.setItem('foreman_active_view', activeView)
  }, [activeView])

  const handleCompleteShop1Task = async (taskId) => {
    setIsCompletingTask(true)
    try {
      await apiService.submitCompleteTaskByMaster(taskId, completeTaskByMaster)
      fetchData(['tasks', 'work_cards'])
    } catch (e) {
      console.error(e)
      alert('Помилка при закритті наряду: ' + e.message)
    } finally {
      setIsCompletingTask(false)
    }
  }

  const itemsPerPage = 8

  // Load foreman-specific data (workCards, inventory, requests) immediately on mount
  useEffect(() => { fetchModuleData('foreman') }, [])

  // ── Load archive cards and history on active task change ──────────────
  useEffect(() => {
    if (activeTaskId) {
      if (typeof fetchTaskPlanSnapshot === 'function') {
        fetchTaskPlanSnapshot(activeTaskId).catch(() => {})
      }

      const loadSeq = archiveLoadSeqRef.current + 1
      archiveLoadSeqRef.current = loadSeq
      const cachedCards = taskDataCacheRef.current.archiveCards[activeTaskId]
      const cachedHistory = taskDataCacheRef.current.taskHistory[activeTaskId]
      const hasCachedHistory = Array.isArray(cachedHistory)

      if (cachedCards && hasCachedHistory) {
        setArchiveCards(cachedCards)
        setTaskHistory(cachedHistory)
      }

      const hasTaskScrapTotals = (workCardScrapTotals || []).some(row =>
        row.task_id === activeTaskId && (Number(row.total_scrap) || 0) > 0
      )
      setIsLoadingHistory(!hasCachedHistory && !hasTaskScrapTotals)
      fetchTaskArchiveCards(activeTaskId).then(async (cards) => {
        if (archiveLoadSeqRef.current !== loadSeq) return
        setArchiveCards(cards || [])

        const allTaskCards = Array.from(new Map([...activeTaskCardsForArchive, ...(cards || [])].map(card => [String(card.id), card])).values())
        const cardIds = allTaskCards.map(c => c.id)
        let histData = []
        if (cardIds.length > 0) {
          const cardIdSet = new Set(cardIds.map(id => String(id)))
          const totalRows = (workCardScrapTotals || []).filter(row =>
            row.card_id &&
            cardIdSet.has(String(row.card_id)) &&
            (Number(row.total_scrap) || 0) > 0
          )
          histData = totalRows.length > 0
            ? totalRows.map(row => ({
                id: `scrap-total-${row.id || `${row.card_id}-${row.nomenclature_id}`}`,
                card_id: row.card_id,
                nomenclature_id: row.nomenclature_id,
                scrap_qty: Number(row.total_scrap) || 0,
                created_at: row.last_scrap_at || row.updated_at,
                completed_at: row.last_scrap_at || row.updated_at,
                is_scrap_total: true
              }))
            : await fetchScrapHistoryByCardIds(cardIds)
          if (archiveLoadSeqRef.current !== loadSeq) return
          setTaskHistory(histData)
        } else {
          if (archiveLoadSeqRef.current !== loadSeq) return
          setTaskHistory([])
        }

        taskDataCacheRef.current.archiveCards[activeTaskId] = cards || []
        taskDataCacheRef.current.taskHistory[activeTaskId] = histData
        if (archiveLoadSeqRef.current === loadSeq) setIsLoadingHistory(false)
      }).catch((error) => {
        console.warn('Error loading archive cards/history:', error?.message || error)
        if (archiveLoadSeqRef.current !== loadSeq) return
        if (cachedCards) setArchiveCards(cachedCards)
        if (hasCachedHistory) {
          setTaskHistory(cachedHistory)
        } else {
          const activeIds = new Set(activeTaskCardsForArchive.map(c => String(c.id)))
          const recentScrap = (workCardHistory || []).filter(h =>
            h?.card_id &&
            activeIds.has(String(h.card_id)) &&
            (Number(h.scrap_qty) || 0) > 0
          )
          setTaskHistory(recentScrap)
        }
        setIsLoadingHistory(false)
      })
    } else {
      archiveLoadSeqRef.current += 1
      setArchiveCards([])
      setTaskHistory([])
      setIsLoadingHistory(false)
    }
  }, [activeTaskId, activeTaskCardsKey, activeTaskScrapTotalsKey, fetchTaskPlanSnapshot, fetchTaskArchiveCards])

  // ── Load orders for ALL relevant tasks (pagination-independent) ──────────────
  useEffect(() => {

    if (tasks.length === 0) return;

    // Get all order IDs from tasks that might be shown in the UI
    const neededIds = [...new Set(tasks.map(t => t.order_id).filter(Boolean))];

    // Find IDs that are neither in the global orders list nor in our local allOrdersMap cache
    const missingIds = neededIds.filter(id =>
      !orders.find(o => String(o.id) === String(id)) &&
      !allOrdersMap[id]
    );

    if (missingIds.length === 0) return;

    supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('id', missingIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching missing orders for Foreman:', error);
          return;
        }
        if (data && data.length > 0) {
          setAllOrdersMap(prev => {
            const next = { ...prev };
            data.forEach(o => { next[o.id] = o; });
            return next;
          });
        }
      });
  }, [tasks, orders]);

  // ── Load static completed progress for ALL relevant tasks ──────────────
  // Тригер: tasks (коли змінюється список нарядів)
  useEffect(() => {
    if (tasks.length === 0) return;

    const taskIds = tasks.filter(t => t.status !== 'completed').map(t => t.id);
    if (taskIds.length === 0) return;

    fetchWorkCardsByTaskIds(taskIds, 'id, task_id, nomenclature_id, quantity, operation, status, card_info, created_at')
      .then(async (cardsData) => {

        // Only track completed cards in staticCompletedCards — active cards come from workCards global state
        const completedCards = (cardsData || []).filter(c => countAsProduced(c));
        setStaticCompletedCards(completedCards);

        // For shortage/scrap math we only need rows where scrap_qty > 0.
        const cardIds = (cardsData || []).map(c => c.id);
        if ((workCardScrapTotals || []).length > 0) {
          setStaticHistory([]);
        } else if (cardIds.length > 0) {
          const historyData = await fetchScrapHistoryByCardIds(cardIds);
          setStaticHistory(historyData);
        } else {
          setStaticHistory([]);
        }
      })
      .catch((error) => {
        console.warn('Error fetching cards/history for static progress:', error?.message || error);
      });
  }, [tasks, activeTaskId, workCardScrapTotals]);

  // ── Sync staticHistory з реалтайм workCardHistory (без зайвих DB-запитів) ──
  // При новому браку через realtime INSERT → workCardHistory оновлюється →
  // цей ефект мержить нові записи в staticHistory якщо вони належать completed-карткам.
  useEffect(() => {
    if (staticCompletedCards.length === 0 || workCardHistory.length === 0) return;
    const completedCardIds = new Set(staticCompletedCards.map(c => String(c.id)));
    // Фільтруємо тільки нові history-рядки для completed-карток цього модуля
    const relevantNew = workCardHistory.filter(h => h.card_id && completedCardIds.has(String(h.card_id)));
    if (relevantNew.length === 0) return;
    setStaticHistory(prev => {
      const existingIds = new Set(prev.map(h => h.id));
      const toAdd = relevantNew.filter(h => !existingIds.has(h.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, [workCardHistory, staticCompletedCards]);




  const [activeTaskCards, setActiveTaskCards] = useState([])

  const activeTaskIdsKey = useMemo(() => {
    return (tasks || [])
      .filter(t => t.status !== 'completed' && t.step && !t.step.includes('Пресування') && !t.step.includes('ЦЕХ №2') && !t.step.includes('Доопрацювання'))
      .map(t => t.id)
      .sort()
      .join('|')
  }, [tasks])

  useEffect(() => {
    if (!activeTaskIdsKey) return
    const taskIds = activeTaskIdsKey.split('|').filter(Boolean)
    if (taskIds.length === 0) return

    let cancelled = false
    const fetchScopedCards = async () => {
      try {
        const chunkSize = 25
        const pageSize = 1000
        const rows = []
        for (let i = 0; i < taskIds.length; i += chunkSize) {
          const chunk = taskIds.slice(i, i + chunkSize)
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase
              .from('work_cards')
              .select('*')
              .in('task_id', chunk)
              .range(from, from + pageSize - 1)
            if (error) break
            const page = data || []
            rows.push(...page)
            if (page.length < pageSize) break
          }
        }
        if (!cancelled && rows.length > 0) {
          setActiveTaskCards(rows)
        }
      } catch (err) {
        console.error('Error fetching scoped work_cards for Shop 1 active queue:', err)
      }
    }
    fetchScopedCards()
    return () => { cancelled = true }
  }, [activeTaskIdsKey])

  const effectiveWorkCards = useMemo(() => {
    if (activeTaskCards.length === 0) return workCards
    const activeSet = new Set(activeTaskCards.map(c => String(c.id)))
    const remaining = (workCards || []).filter(c => !activeSet.has(String(c.id)))
    return [...activeTaskCards, ...remaining]
  }, [activeTaskCards, workCards])

  const {
    productionCache, scrapCache, redoCache, allCardsCache, cardScrapCache,
    taskCardsCountMap, taskReadinessMap,
    taskShortageMap,
    relevantTasks: rawRelevantTasks, activeQueueCount: rawActiveQueueCount
  } = useForemanComputed({
    tasks, orders, allOrdersMap, workCards: effectiveWorkCards, workCardHistory, workCardScrapTotals,
    workCardFinalScrapTotals: qualityLoss.rows,
    hasFinalScrapProjection: qualityLoss.isAvailable,
    staticCompletedCards, staticHistory, archiveCards, taskHistory,
    nomenclatures, bomItems, taskDataCacheRef,
    cachedShortageMap,
    staticHistoryLength: staticHistory.length,
    machines
  })

  const isShop1Task = (t) => {
    if (!t) return false
    const step = (t.step || '').toLowerCase()
    if (step.includes('пресування') || step.includes('цех №2') || step.includes('доопрацювання') || step.includes('підготовка')) {
      return false
    }
    return true
  }

  const isPurgedTaskInForeman = (t) => {
    if (!t) return false
    const str = JSON.stringify(t)
    if (str.includes('14082026-01') || str.includes('10082026-01') || str.includes('260821-1')) return true
    return false
  }

  const shop1ActiveTasks = useMemo(() => {
    const getPriority = (t) => {
      if (t.status === 'completed') return 4
      const cardsCount = taskCardsCountMap?.[t.id] || 0
      if (cardsCount === 0) return 0 // 🔵 1. НОВІ

      const isReady = Boolean(taskReadinessMap?.[t.id])
      const isShortage = !isReady && (
        (t.id in (taskShortageMap || {})) ? Boolean(taskShortageMap[t.id]) : Boolean(cachedShortageMap?.[t.id])
      )
      if (isShortage) return 1 // 🔴 2. ЧЕРВОНІ (НЕСТАЧА)

      if (isReady) return 3 // 🟢 4. ГОТОВІ
      return 2 // 🟡 3. ЖОВТІ (В РОБОТІ)
    }

    return (tasks || [])
      .filter(t => !isPurgedTaskInForeman(t) && t.status !== 'completed' && isShop1Task(t))
      .sort((a, b) => {
        const pA = getPriority(a)
        const pB = getPriority(b)
        if (pA !== pB) return pA - pB
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [tasks, taskShortageMap, cachedShortageMap, taskCardsCountMap, taskReadinessMap])

  const shop1ArchiveTasks = useMemo(() => {
    return (tasks || [])
      .filter(t => !isPurgedTaskInForeman(t) && t.status === 'completed' && isShop1Task(t))
      .sort((a, b) => new Date(b.completed_at || b.updated_at || b.created_at) - new Date(a.completed_at || a.updated_at || a.created_at))
  }, [tasks])

  const displayRelevantTasks = useMemo(() => {
    return activeTab === 'active' ? shop1ActiveTasks : shop1ArchiveTasks
  }, [activeTab, shop1ActiveTasks, shop1ArchiveTasks])

  useEffect(() => {
    const currentTaskObj = (tasks || []).find(t => t.id === activeTaskId)
    if (isPurgedTaskInForeman(currentTaskObj)) {
      try { localStorage.removeItem('foreman_active_task_id') } catch {}
      const valid = displayRelevantTasks.find(t => !isPurgedTaskInForeman(t))
      setActiveTaskId(valid ? valid.id : null)
      return
    }
    if (displayRelevantTasks.length > 0) {
      const isCurrentTaskInDisplay = displayRelevantTasks.some(t => t.id === activeTaskId)
      if (!isCurrentTaskInDisplay) {
        setActiveTaskId(displayRelevantTasks[0].id)
      }
    } else if (activeTaskId) {
      setActiveTaskId(null)
    }
  }, [displayRelevantTasks, activeTaskId, tasks])

  const relevantTasks = displayRelevantTasks
  const activeQueueCount = shop1ActiveTasks.length

  const {
    handleResolveCall: handleResolveCallRaw,
    handleOpenReport,
    handleOpenNaryadPrint,
    handleChangeTaskMachine,
    handleUpdateNomenclatureMachineAndRecalculate,
    handleGenerateFromWorksheet,
    handleBufferReception,
    submitBufferReception,
    handleReserveBZ,
    handleUpdateMachineInSnapshot,
    debouncedUpdateSplits
  } = useForemanHandlers({
    createWorkCard, createWorkCardsBatch, completeTaskByMaster, confirmBuffer, reserveBZForTask, createDovyпускMaterialRequests,
    tasks, orders, workCards, inventory, nomenclatures, bomItems, machines, machineOperations, workCardHistory,
    relevantTasks, allOrdersMap, setAllOrdersMap,
    setReportTaskId, setShowReportModal, setReportStageFilter, setReportNomFilter, setReportSortBy, setReportOperatorFilter, setReportData, setReportLoading,
    setPrintNaryadQueue, setNaryadPrintLoading, setIsChangingMachine, setCustomAlert, setChangeMachineTaskId,
    setIsGenerating, setGenModal, setPrintQueue, setBufferScrapModal, setBufferScrapCounts, bufferScrapModal, bufferScrapCounts,
    saveTimeoutRef, setEditingSplits,
    generatingLockRef, cardScrapCache,
    supabase, apiService,
    fetchData, fetchModuleData,
    addLocalWorkCards: (cards) => {
      setLocalGeneratedCards(prev => {
        const existingIds = new Set(prev.map(c => String(c.id)))
        const next = cards.filter(c => c?.id && !existingIds.has(String(c.id)))
        return next.length > 0 ? [...prev, ...next] : prev
      })
    }
  })

  const handleResolveCall = (callId) => handleResolveCallRaw(callId, currentUser)

  const handleAdminCardsDeleted = (result) => {
    const deletedIds = new Set((result?.deletedIds || []).map(id => String(id)))
    if (deletedIds.size === 0) return

    setArchiveCards(prev => prev.filter(card => !deletedIds.has(String(card.id))))
    setLocalGeneratedCards(prev => prev.filter(card => !deletedIds.has(String(card.id))))
    setTaskHistory(prev => prev.filter(row => !deletedIds.has(String(row.card_id))))

    if (activeTaskId && taskDataCacheRef.current?.archiveCards?.[activeTaskId]) {
      taskDataCacheRef.current.archiveCards[activeTaskId] = taskDataCacheRef.current.archiveCards[activeTaskId]
        .filter(card => !deletedIds.has(String(card.id)))
    }
    if (activeTaskId && taskDataCacheRef.current?.taskHistory?.[activeTaskId]) {
      taskDataCacheRef.current.taskHistory[activeTaskId] = taskDataCacheRef.current.taskHistory[activeTaskId]
        .filter(row => !deletedIds.has(String(row.card_id)))
    }
  }

  const persistNomLoadCapacity = async (task, nomId, capacity) => {
    if (!task || !nomId || !capacity) return
    const normalizedCapacity = Math.max(1, Number(capacity) || 1)
    setNomLoadCapacityOverrides(prev => ({ ...prev, [`${task.id}:${nomId}`]: normalizedCapacity }))
    const snapshot = { ...(task.plan_snapshot || {}) }
    const key = String(nomId)
    snapshot[key] = {
      ...(snapshot[key] || {}),
      load_capacity: normalizedCapacity,
      custom_capacity: normalizedCapacity
    }

    const { error } = await supabase
      .from('tasks')
      .update({ plan_snapshot: snapshot })
      .eq('id', task.id)

    if (error) {
      console.error(error)
      setCustomAlert({ title: 'Помилка', message: `Не вдалося зберегти завантаження: ${error.message}` })
      return
    }

    fetchData(['tasks']).catch(() => {})
  }

  const persistSplitLoadCapacity = async (task, nomId, splitIndex, capacity) => {
    const normalizedCapacity = Math.max(1, Number(capacity) || 1)
    const snapshot = { ...(task.plan_snapshot || {}) }
    const key = String(nomId)
    const splits = [...(snapshot[key]?.splits || [])]
    if (!splits[splitIndex]) return
    splits[splitIndex] = { ...splits[splitIndex], load_capacity: normalizedCapacity }
    snapshot[key] = { ...(snapshot[key] || {}), splits }

    const { error } = await supabase.from('tasks').update({ plan_snapshot: snapshot }).eq('id', task.id)
    if (error) {
      setCustomAlert({ title: 'Помилка', message: `Не вдалося зберегти завантаження верстата: ${error.message}` })
      return
    }
    fetchData(['tasks']).catch(() => {})
  }

  // ── Dynamic document title for PDF printouts ──────────────
  useEffect(() => {
    const originalTitle = document.title
    if (printQueue) {
      const order = orders.find(o => o.id === printQueue.task?.order_id) || allOrdersMap[printQueue.task?.order_id]
      const nomenclature = nomenclatures.find(n => n.id === (printQueue.part?.nomenclature_id || printQueue.part?.nom?.id))
      const orderNum = order?.order_num || ''
      const nomName = nomenclature?.name || ''
      document.title = `РК №${orderNum} ${nomName}`.trim()
    } else if (printNaryadQueue) {
      const { task, order } = printNaryadQueue
      const orderNum = order?.order_num || ''
      const customer = order?.customer || ''
      const displayDate = task.created_at
        ? new Date(task.created_at).toLocaleDateString('uk-UA')
        : ''
      document.title = `НАРЯД №${orderNum} від ${displayDate} ${customer}`.trim()
    } else if (showReportModal && reportTaskId) {
      const currentTask = relevantTasks.find(t => t.id === reportTaskId) || tasks.find(t => t.id === reportTaskId)
      const currentOrder = orders.find(o => o.id === currentTask?.order_id) || allOrdersMap[currentTask?.order_id]
      const orderNum = currentOrder?.order_num || ''
      const customer = currentOrder?.customer || ''
      document.title = `ЗВІТ ПО НАРЯДУ №${orderNum} ${customer}`.trim()
    }

    return () => {
      document.title = originalTitle
    }
  }, [printQueue, printNaryadQueue, showReportModal, reportTaskId, orders, allOrdersMap, nomenclatures, tasks, relevantTasks])


  React.useEffect(() => {
    let html5QrCode = null
    if (isBufferScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("buffer-reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      html5QrCode.start(
        { facingMode: "environment" }, config, async (decodedText) => {
          if (decodedText.startsWith("CENTRUM_CARD_")) {
            const cardId = decodedText.replace("CENTRUM_CARD_", "").trim()
            if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop()
            handleBufferReception(cardId)
          }
        }
      ).catch(e => console.error(e))
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { }) }
  }, [isBufferScanning])

  const getBOMPartsLocal = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const getDisplayPartsForOrderItem = (task, item) => {
    return getDisplayPartsForOrderItemHelper(task, item, bomItems, nomenclatures)
  }

  const findMachine = (name) => {
    return findMachineByName(name, machines)
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
        <ForemanTaskQueue
          relevantTasks={relevantTasks}
          activeTaskId={activeTaskId}
          orders={orders}
          allOrdersMap={allOrdersMap}
          nomenclatures={nomenclatures}
          taskReadinessMap={taskReadinessMap}
          taskShortageMap={taskShortageMap}
          cachedShortageMap={cachedShortageMap}
          taskCardsCountMap={taskCardsCountMap}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeQueueCount={shop1ActiveTasks.length}
          archiveQueueCount={shop1ArchiveTasks.length}
          onSelectTask={(taskId) => {
            const targetTask = tasks.find(t => t.id === taskId)
            if (targetTask?.status === 'completed') {
              setActiveTab('archive')
            } else if (targetTask) {
              setActiveTab('active')
            }
            setActiveTaskId(taskId)
            setIsDrawerOpen(false)
            setSearchParams({ task: taskId })
          }}
        />

        <div className="content-panel" style={{ flex: 1, background: '#0a0a0a' }}>
          {/* Active Machine Calls Widget */}
          {activeCalls.length > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                АКТИВНІ ВИКЛИКИ ДО ВЕРСТАТІВ ({activeCalls.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeCalls.map(c => {
                  const mach = machines?.find(m => m.id === c.machine_id)
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px 15px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                          {mach ? mach.name : 'Верстат'} (пор. №{mach?.sequence_number || '—'})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                          Локація: {mach?.floor || '—'} поверх | Викликав: {c.operator_name || 'Оператор'}
                          {c.called_employee_name && <span style={{ color: '#8b5cf6', fontWeight: 800 }}> | Цільовий для: {c.called_employee_name}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 700 }}>
                          {new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleResolveCall(c.id)}
                          style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          Я йду
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '30px', display: 'flex', gap: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '10px' }}>
            <button
              onClick={() => setActiveView('worksheet')}
              style={{ background: 'transparent', border: 'none', color: activeView === 'worksheet' ? '#ef4444' : '#555', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: activeView === 'worksheet' ? '2px solid #ef4444' : '2px solid transparent', paddingBottom: '10px', transition: '0.2s' }}
            >
              <ListTodo size={18} /> РОБОЧІ НАРЯДИ
            </button>
            <Link
              to="/shop1"
              style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', borderRadius: '10px', textDecoration: 'none', marginLeft: 'auto' }}
            >
              <Tablet size={16} /> ВІДКРИТИ ТЕРМІНАЛ ЦЕХУ
            </Link>
          </div>

          {activeTaskId ? (
            (() => {
              const task = relevantTasks.find(t => t.id === activeTaskId) || tasks.find(t => t.id === activeTaskId)
              if (!task) return <div style={{ padding: '20px', color: '#888', fontSize: '0.9rem' }}>Завдання не знайдено або завантажується...</div>
              const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
              // Об'єднуємо АКТИВНІ картки (з глобального стейту) + ЗАВЕРШЕНІ (архів для цього наряду)
              // Це гарантує, що картки НІКОЛИ не зникають після переходу на прийомку/буфер
              const activeTaskCards = [
                ...workCards.filter(c => String(c.task_id) === String(task.id)),
                ...localGeneratedCards.filter(c =>
                  String(c.task_id) === String(task.id) &&
                  !(workCards || []).some(wc => String(wc.id) === String(c.id))
                )
              ]
              const taskCards = [...activeTaskCards, ...(archiveCards || []).filter(c => c.task_id === task.id && !activeTaskCards.some(ac => ac.id === c.id))]
              const isReworkOrder = order?.order_num?.startsWith('ВБ')

              // Fallback for Product Names: if order has no items (internal rework), use snapshot names
              let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
              if (!productNames && task.plan_snapshot) {
                productNames = Object.values(task.plan_snapshot)
                  .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
                  .filter(Boolean)
                  .join(', ')
              }

              const isReady = Boolean(taskReadinessMap[task.id])
              const isTaskComplete = isReady
              // Активний наряд — override з повною taskHistory
              const isShortage = taskShortageMap[task.id] || cachedShortageMap[task.id] || false
              const taskCardsCount = taskCardsCountMap[task.id] || 0
              const isNew = task.status !== 'completed' && taskCardsCount === 0
              const isInProgress = task.status !== 'completed' && taskCardsCount > 0 && !isReady && !isShortage

              return (
                <div style={{ maxWidth: '1200px' }} className="anim-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                          Наряд №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
                          {task.status === 'completed' && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px' }}>
                              ВИКОНАНО
                            </div>
                          )}
                          {isReady && task.status !== 'completed' && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle2 size={14} /> ГОТОВО ДО ЗАКРИТТЯ
                            </div>
                          )}
                          {isShortage && task.status !== 'completed' && !isReady && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <AlertTriangle size={14} /> ПОТРІБЕН ДОВИПУСК
                            </div>
                          )}
                          {isNew && task.status !== 'completed' && (
                            <div className="anim-pulse-blue" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={14} /> НОВИЙ
                            </div>
                          )}
                          {isInProgress && task.status !== 'completed' && !isReady && !isShortage && (
                            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Layers size={14} /> В РОБОТІ
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const url = new URL(window.location.href)
                              url.searchParams.delete('task')
                              url.searchParams.set('task', task.id)
                              navigator.clipboard.writeText(url.toString())
                              alert('Посилання скопійовано!')
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              padding: '6px 15px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: 950,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            Копіювати посилання
                          </button>
                        </h2>

                        <button
                          onClick={() => handleOpenReport(task, order, taskCards)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid #3b82f6',
                            color: '#3b82f6',
                            fontSize: '0.8rem',
                            fontWeight: 900,
                            padding: '8px 18px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: '0.2s',
                            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)',
                            marginTop: '5px'
                          }}
                        >
                          <Printer size={14} /> ЗВІТ ПО НАРЯДУ
                        </button>
                      </div>
                      <div style={{ color: '#555', marginTop: '5px', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        <div>ВИРІБ: <strong style={{ color: '#ef4444' }}>{productNames || '—'}</strong> | {order?.customer}</div>
                        {task.batch_index && (
                          <span style={{ background: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 900 }}>
                            ПАРТІЯ №{task.batch_index}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#555' }}>ВЕРСТАТ:</span>
                          <span style={{ color: '#fff', background: '#222', padding: '4px 10px', borderRadius: '8px', fontSize: '0.95rem' }}>{task.machine_name || 'Не вказано'}</span>
                        </div>
                      </div>
                    </div>
                    {(isTaskComplete || task.status === 'completed') && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {task.status !== 'completed' && (
                          <button
                            onClick={() => handleCompleteShop1Task(task.id)}
                            disabled={isCompletingTask}
                            style={{
                              background: isCompletingTask ? '#222' : '#10b981',
                              color: isCompletingTask ? '#555' : '#fff',
                              border: 'none',
                              padding: '12px 28px',
                              borderRadius: '12px',
                              fontWeight: 900,
                              cursor: isCompletingTask ? 'not-allowed' : 'pointer',
                              boxShadow: isCompletingTask ? 'none' : '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
                              transition: '0.3s',
                              fontSize: '0.95rem',
                              letterSpacing: '0.5px',
                              opacity: isCompletingTask ? 0.6 : 1
                            }}
                          >
                            {isCompletingTask ? 'ОБРОБКА...' : '✓ ВИКОНАНО'}
                          </button>
                        )}
                        {task.status === 'completed' && (
                          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                            ✓ НАРЯД ВИКОНАНО
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ───── ТАБЛИЦЯ ДЕТАЛЕЙ ───── */}
                  <div style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#1a1a1a', textAlign: 'left', color: '#555', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                            <th style={{ padding: '12px 10px', width: '23%', minWidth: '170px' }}>ДЕТАЛЬ В РОЗКРІЙ</th>
                            <th style={{ padding: '12px 6px', textAlign: 'center' }}>ПОТРЕБА</th>
                            {!isReworkOrder && (
                              <>
                                <th style={{ padding: '12px 6px', textAlign: 'center' }}>СКЛАД БЗ</th>
                                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#eab308' }}>ПЛАН</th>
                              </>
                            )}
                            <th style={{ padding: '12px 6px', textAlign: 'center' }}>МАТЕРІАЛ</th>
                            <th style={{ padding: '12px 6px', textAlign: 'center' }}>ШТ/Л</th>
                            <th style={{ padding: '12px 6px', textAlign: 'center', color: '#10b981' }}>ЛИСТІВ</th>
                            {!isReworkOrder && <th style={{ padding: '12px 6px', textAlign: 'center', color: '#ef4444' }}>БЗ</th>}
                            <th style={{ padding: '12px 6px', textAlign: 'center' }}>ДІЇ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order?.order_items?.flatMap(item => {
                            const rows = getDisplayPartsForOrderItem(task, item).filter(r => r.nom?.type === 'part')

                            return rows.map((part, idx) => {
                              const rowId = `${item.id}-${part.nom?.id || idx}`
                              const nomId = part.nom?.id

                              let need, stockBZ, plan, unitsPerSheet, sheets
                              const snapshot = task.plan_snapshot?.[String(nomId)]
                              unitsPerSheet = getNomUnitsPerSheet(part.nom, snapshot)

                              if (snapshot) {
                                need = snapshot.need
                                stockBZ = snapshot.stock
                                plan = snapshot.plan
                                sheets = snapshot.sheets || Math.ceil(plan / unitsPerSheet)
                              } else {
                                need = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
                                const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
                                stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                                plan = Math.max(0, need - stockBZ)
                                sheets = Math.ceil(plan / unitsPerSheet)
                              }

                              const existing = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                              const productionCards = existing.filter(c => c.operation !== 'Склад БЗ')
                              const allRedos = existing.filter(c => c.operation !== 'Склад БЗ' && (c.card_info || '').includes('[REDO]'))
                              const redoCount = allRedos.length
                              const activeProductionCards = productionCards.filter(c => !(c.card_info || '').includes('[REDO]'))
                              const pendingMaterialCorrection = getPendingMaterialCorrection({
                                requests: materialRequests,
                                taskId: task.id,
                                partId: nomId,
                                snapshot,
                                nomenclatures
                              })

                              const rawRowMachineName = ((task.plan_snapshot || {})[String(nomId)]?.machine || (task.plan_snapshot || {})[String(nomId)]?.selected_machine || selectedMachines[rowId] || '')
                                || (productionCards.length > 0 && productionCards[0].machine && productionCards[0].machine !== 'Не вказано' ? productionCards[0].machine : '')
                                || task.machine_name || 'Різні верстати'
                              const rowMachineName = getStandardMachineType(rawRowMachineName)

                              // Use local state if it exists (for fluid typing), fallback to context
                              const splits = editingSplits[nomId] || (task.plan_snapshot || {})[String(nomId)]?.splits || []
                              const isSplitMode = splits.length > 0
                              const totalSheetsNeeded = sheets // This is the total sheets for the whole naryad row

                              const machineObjForCapacity = findMachine(rowMachineName)
                              const defaultCapacity = machineObjForCapacity?.min_capacity || machineObjForCapacity?.sheet_capacity || 1
                              const maxCapacity = machineObjForCapacity?.max_capacity || machineObjForCapacity?.sheet_capacity || 1
                              const overrideLoadCapacity = Number(nomLoadCapacityOverrides[`${task.id}:${nomId}`]) || null
                              const snapshotLoadCapacity = Number((task.plan_snapshot || {})[String(nomId)]?.load_capacity || (task.plan_snapshot || {})[String(nomId)]?.custom_capacity) || null
                              const savedLoadCapacity = overrideLoadCapacity || snapshotLoadCapacity
                              const minimumLoadsAtMaxCapacity = maxCapacity > 0 ? Math.ceil((Number(sheets) || 0) / maxCapacity) : 0
                              const inferredLoadCapacity = activeProductionCards.length >= minimumLoadsAtMaxCapacity && activeProductionCards.length > 0
                                ? Math.min(maxCapacity, Math.max(defaultCapacity, Math.ceil((Number(sheets) || 0) / activeProductionCards.length)))
                                : null
                              const hasRowCapacityInput = rowCapacities[rowId] !== undefined && rowCapacities[rowId] !== ''
                              const isCapacityMissing = false
                              const rawCapacity = hasRowCapacityInput ? rowCapacities[rowId] : (savedLoadCapacity !== null ? savedLoadCapacity : (inferredLoadCapacity || maxCapacity))
                              const machineCapacity = Math.min(maxCapacity, Math.max(defaultCapacity, rawCapacity))

                              let generatedSheetsCalc = 0
                              let generatedQtyCalc = 0
                              activeProductionCards.forEach(c => {
                                generatedSheetsCalc += Math.ceil(Number(c.quantity) / (unitsPerSheet || 1))
                                generatedQtyCalc += Number(c.quantity)
                              })
                              
                              let remainingSheetsCalc = Math.max(0, sheets - generatedSheetsCalc)
                              if (generatedQtyCalc >= plan && plan > 0) {
                                remainingSheetsCalc = 0
                              }

                              const theoreticalMax = Math.ceil(sheets / machineCapacity)
                              let baseLoads = rowMachineName ? (activeProductionCards.length + (remainingSheetsCalc > 0 ? Math.ceil(remainingSheetsCalc / machineCapacity) : 0)) : (sheets || 0)
                              if (activeProductionCards.length === theoreticalMax) {
                                baseLoads = theoreticalMax
                              }
                              const loads = (plan === 0 && existing.some(c => c.operation === 'Склад БЗ')) ? 1 : baseLoads

                              // Split logic for totalTargetLoads
                              let totalTargetLoads = loads
                              if (isSplitMode) {
                                totalTargetLoads = splits.reduce((sum, s) => {
                                  const cap = Number(s.load_capacity) || findMachine(s.machine)?.sheet_capacity || 1
                                  const sSheets = Number(s.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(s.qty) || 0) / unitsPerSheet) : 0)
                                  return sum + Math.ceil(sSheets / cap)
                                }, 0)
                              }

                              if (remainingSheetsCalc === 0 && activeProductionCards.length > 0) {
                                totalTargetLoads = activeProductionCards.length
                              }


                              const surplus = sheets > 0 ? Math.max(0, (sheets * unitsPerSheet) - plan) : 0

                              return (
                                <tr key={rowId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                  <td style={{ padding: '10px 8px', minWidth: '170px' }}>
                                    <div style={{ fontWeight: 800, color: '#fff', wordBreak: 'break-word', whiteSpace: 'normal' }}>{part.nom?.name || '—'}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#444' }}>{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                                  </td>
                                  <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666' }}>{need}</td>
                                  {!isReworkOrder && (
                                    <>
                                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666' }}>{stockBZ}</td>
                                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#eab308', fontWeight: 900 }}>{plan}</td>
                                    </>
                                  )}
                                  <td style={{ padding: '10px 6px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem' }}>
                                    <div>{getDisplayMaterial(part.nom, snapshot)}</div>
                                    <MaterialCorrectionAction
                                      correction={materialCorrection}
                                      task={task}
                                      part={part.nom}
                                      snapshot={snapshot}
                                      productionCards={productionCards}
                                      material={getDisplayMaterial(part.nom, snapshot)}
                                      sheets={sheets}
                                      plan={plan}
                                    />
                                  </td>
                                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>{unitsPerSheet}</td>
                                  <td style={{ padding: '10px 4px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.1rem' }}>{sheets}</td>
                                  {!isReworkOrder && (
                                    <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                                  )}
                                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      {plan === 0 ? (
                                        (stockBZ > 0 && existing.find(c => c.operation === 'Склад БЗ')) ? (
                                          <div style={{ background: '#3b82f620', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 12px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                            ЗАБРОНЬОВАНО ({Math.min(need, stockBZ)})
                                          </div>
                                        ) : (
                                          <div style={{ color: '#222', fontSize: '0.6rem', fontWeight: 900 }}>НЕ ПОТРЕБУЄ ДІЇ</div>
                                        )
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                          {stockBZ > 0 && (
                                            <div style={{ background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 950, textAlign: 'center' }}>
                                              ЗАБРОНЬОВАНО: {Math.min(need, stockBZ)} шт
                                            </div>
                                          )}
                                          {pendingMaterialCorrection ? (
                                            <div style={{ maxWidth: '145px', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.45)', color: '#f59e0b', padding: '7px 9px', borderRadius: '8px', fontSize: '.58rem', fontWeight: 950, lineHeight: 1.25, textAlign: 'center', textTransform: 'uppercase' }}>
                                              Заміна очікує погодження складу
                                            </div>
                                          ) : (activeProductionCards.length === 0 || activeProductionCards.length < totalTargetLoads) && (
                                            <button
                                              disabled={!(rowMachineName || isSplitMode) || (() => {
                                                if (isCapacityMissing) return true
                                                const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                const extractThickness = (str) => {
                                                  const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                                  return match ? match[1] + 'мм' : null
                                                }
                                                const baseThickness = extractThickness(baseMat)
                                                const sheetReqs = taskReqs.filter(r => {
                                                  const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                  const rName = (rNom?.name || r.details || '').toLowerCase()
                                                  const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                  if (!isSheet) return false
                                                  const reqThickness = extractThickness(rName)
                                                  if (baseThickness && reqThickness) {
                                                    return baseThickness === reqThickness
                                                  }
                                                  const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                  return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                })
                                                const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                  .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                const hasKittingReqs = sheetReqs.length > 0
                                                return hasKittingReqs && issued <= 0
                                              })()}
                                              onClick={() => {
                                                if (isCapacityMissing) {
                                                  alert(`Вкажіть кількість листів на одне завантаження (${defaultCapacity}-${maxCapacity} л.) перед генерацією карток.`)
                                                  return
                                                }
                                                const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                const extractThickness = (str) => {
                                                  const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                                  return match ? match[1] + 'мм' : null
                                                }
                                                const baseThickness = extractThickness(baseMat)
                                                const sheetReqs = taskReqs.filter(r => {
                                                  const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                  const rName = (rNom?.name || r.details || '').toLowerCase()
                                                  const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                  if (!isSheet) return false
                                                  const reqThickness = extractThickness(rName)
                                                  if (baseThickness && reqThickness) {
                                                    return baseThickness === reqThickness
                                                  }
                                                  const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                  return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                })
                                                const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                  .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                const hasKittingReqs = sheetReqs.length > 0
                                                if (hasKittingReqs && issued <= 0) return;

                                                const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0);
                                                if (isSplitMode && currentSumSheets > totalSheetsNeeded) {
                                                  alert(`Помилка: Ви запланували ${currentSumSheets} листів, що більше за план (${totalSheetsNeeded} л.). Виправте кількість перед генерацією.`);
                                                  return;
                                                }

                                                if (isSplitMode) {
                                                  setGenModal({
                                                    task, part,
                                                    total: Math.max(1, totalTargetLoads - activeProductionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: activeProductionCards.length, rowId, machineName: rowMachineName || splits[0]?.machine, sheets, splits: splits
                                                  })
                                                } else {
                                                  if (!rowMachineName) return;
                                                  const mObj = findMachine(rowMachineName);
                                                  const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material;
                                                  const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase();
                                                  const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id));
                                                  const extractThickness = (str) => {
                                                    if (!str) return null
                                                    const match = str.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*мм/i) || str.replace(/,/g, '.').match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || str.replace(/,/g, '.').match(/[-_](\d+(?:\.\d+)?)$/i)
                                                    return match ? match[1] + 'мм' : null
                                                  }
                                                  const baseThickness = extractThickness(baseMat)
                                                  const sheetReqs = taskReqs.filter(r => {
                                                    const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                    const rName = (rNom?.name || r.details || '').toLowerCase()
                                                    const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                    if (!isSheet) return false
                                                    const reqThickness = extractThickness(rName)
                                                    if (baseThickness && reqThickness) {
                                                      return baseThickness === reqThickness
                                                    }
                                                    const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                    return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                  })
                                                  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                  const hasKittingReqs = sheetReqs.length > 0

                                                  const maxAllowed = hasKittingReqs ? Math.floor(issued / machineCapacity) : totalTargetLoads
                                                  const initialTotal = Math.min(Math.max(1, totalTargetLoads - activeProductionCards.length), maxAllowed)

                                                  setGenModal({ task, part, total: initialTotal, targetTotal: totalTargetLoads, requirement: plan, created: activeProductionCards.length, rowId, machineName: rowMachineName, sheets, capacity: machineCapacity, maxSheetsToGenerate: remainingSheetsCalc })
                                                }
                                              }}
                                              style={{
                                                background: (() => {
                                                  const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                  const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                  const extractThickness = (str) => {
                                                    if (!str) return null
                                                    const match = str.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*мм/i) || str.replace(/,/g, '.').match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || str.replace(/,/g, '.').match(/[-_](\d+(?:\.\d+)?)$/i)
                                                    return match ? match[1] + 'мм' : null
                                                  }
                                                  const baseThickness = extractThickness(baseMat)
                                                  const sheetReqs = taskReqs.filter(r => {
                                                    const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                    const rName = (rNom?.name || r.details || '').toLowerCase()
                                                    const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                    if (!isSheet) return false
                                                    const reqThickness = extractThickness(rName)
                                                    if (baseThickness && reqThickness) {
                                                      return baseThickness === reqThickness
                                                    }
                                                    const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                    return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                  })
                                                  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                  const hasKittingReqs = sheetReqs.length > 0
                                                  if (isCapacityMissing) return '#222';
                                                  if (hasKittingReqs && issued <= 0) return '#1e1b18';
                                                  return (rowMachineName || isSplitMode) ? '#ff9000' : '#222';
                                                })(),
                                                color: (() => {
                                                  const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                  const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                  const extractThickness = (str) => {
                                                    if (!str) return null
                                                    const match = str.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*мм/i) || str.replace(/,/g, '.').match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || str.replace(/,/g, '.').match(/[-_](\d+(?:\.\d+)?)$/i)
                                                    return match ? match[1] + 'мм' : null
                                                  }
                                                  const baseThickness = extractThickness(baseMat)
                                                  const sheetReqs = taskReqs.filter(r => {
                                                    const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                    const rName = (rNom?.name || r.details || '').toLowerCase()
                                                    const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                    if (!isSheet) return false
                                                    const reqThickness = extractThickness(rName)
                                                    if (baseThickness && reqThickness) {
                                                      return baseThickness === reqThickness
                                                    }
                                                    const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                    return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                  })
                                                  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                  const hasKittingReqs = sheetReqs.length > 0
                                                  if (isCapacityMissing) return '#666';
                                                  if (hasKittingReqs && issued <= 0) return '#7f1d1d';
                                                  return (rowMachineName || isSplitMode) ? '#000' : '#444';
                                                })(),
                                                border: (() => {
                                                  const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                  const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                  const extractThickness = (str) => {
                                                    if (!str) return null
                                                    const match = str.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*мм/i) || str.replace(/,/g, '.').match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || str.replace(/,/g, '.').match(/[-_](\d+(?:\.\d+)?)$/i)
                                                    return match ? match[1] + 'мм' : null
                                                  }
                                                  const baseThickness = extractThickness(baseMat)
                                                  const sheetReqs = taskReqs.filter(r => {
                                                    const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                    const rName = (rNom?.name || r.details || '').toLowerCase()
                                                    const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                    if (!isSheet) return false
                                                    const reqThickness = extractThickness(rName)
                                                    if (baseThickness && reqThickness) {
                                                      return baseThickness === reqThickness
                                                    }
                                                    const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                    return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                  })
                                                  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                  const hasKittingReqs = sheetReqs.length > 0
                                                  if (isCapacityMissing) return '1px solid #333';
                                                  if (hasKittingReqs && issued <= 0) return '1px solid rgba(239,68,68,0.2)';
                                                  return 'none';
                                                })(),
                                                padding: '8px 15px',
                                                borderRadius: '8px',
                                                fontSize: '0.65rem',
                                                fontWeight: 900,
                                                cursor: (() => {
                                                  const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                  const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                  const extractThickness = (str) => {
                                                    if (!str) return null
                                                    const match = str.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*мм/i) || str.replace(/,/g, '.').match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || str.replace(/,/g, '.').match(/[-_](\d+(?:\.\d+)?)$/i)
                                                    return match ? match[1] + 'мм' : null
                                                  }
                                                  const baseThickness = extractThickness(baseMat)
                                                  const sheetReqs = taskReqs.filter(r => {
                                                    const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                    const rName = (rNom?.name || r.details || '').toLowerCase()
                                                    const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                    if (!isSheet) return false
                                                    const reqThickness = extractThickness(rName)
                                                    if (baseThickness && reqThickness) {
                                                      return baseThickness === reqThickness
                                                    }
                                                    const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                    return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                  })
                                                  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                  const hasKittingReqs = sheetReqs.length > 0
                                                  if (isCapacityMissing) return 'not-allowed';
                                                  if (hasKittingReqs && issued <= 0) return 'not-allowed';
                                                  return (rowMachineName || isSplitMode) ? 'pointer' : 'not-allowed';
                                                })(),
                                                textTransform: 'uppercase',
                                                opacity: (isSplitMode && splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0) > totalSheetsNeeded) ? 0.3 : 1
                                              }}
                                            >
                                              {(() => {
                                                const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                                const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                                const extractThickness = (str) => {
                                                  const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                                  return match ? match[1] + 'мм' : null
                                                }
                                                const baseThickness = extractThickness(baseMat)
                                                const sheetReqs = taskReqs.filter(r => {
                                                  const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                                  const rName = (rNom?.name || r.details || '').toLowerCase()
                                                  const isSheet = rName.includes('лист') || rName.includes('sheet')
                                                  if (!isSheet) return false
                                                  const reqThickness = extractThickness(rName)
                                                  if (baseThickness && reqThickness) {
                                                    return baseThickness === reqThickness
                                                  }
                                                  const activeMaterials = baseMat.split('+').map(m => m.trim())
                                                  return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                                })
                                                const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                                  .reduce((sum, r) => sum + getRequestQty(r), 0)
                                                const hasKittingReqs = sheetReqs.length > 0
                                                if (isCapacityMissing) return 'ВКАЖІТЬ ЛИСТИ';
                                                return (hasKittingReqs && issued <= 0) ? 'НЕМАЄ ЛИСТІВ' : 'Генерувати';
                                              })()}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {existing.length > 0 && (
                                        <button
                                          onClick={() => setPrintQueue({
                                            task,
                                            part,
                                            metadata: existing.map(c => ({
                                              id: c.id,
                                              loading: c.card_info,
                                              qty: c.quantity,
                                              machine: c.machine,
                                              totalLoadings: loads,
                                              sheetsPerLoading: findMachine(c.machine)?.sheet_capacity || 1,
                                              estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(c.quantity) || 0) * 60
                                            }))
                                          })}
                                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
                                        >
                                          <Printer size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ───── АРХІВ КАРТОК ───── */}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', marginBottom: '12px', marginTop: '20px', borderLeft: '4px solid #ef4444', paddingLeft: '15px' }}>
                    Архів робочих карток
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.keys(task.plan_snapshot || {}).map((nomIdStr) => {
                      const nomId = isNaN(nomIdStr) ? nomIdStr : Number(nomIdStr)
                      const nom = nomenclatures.find(n => String(n.id) === String(nomId))

                      if (nom?.type !== 'part') return null

                      const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                      const cardIdsStrings = activeCards.map(c => String(c.id))
                      const groupHistory = taskHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

                      // Вироблено = фактичний розкрій на лазері (без картки Складу БЗ)
                      const laserCards = activeCards.filter(c => c.operation !== 'Склад БЗ')
                      const grossCutOnLaser = laserCards.reduce((sum, c) => sum + (countAsProduced(c) ? (Number(c.quantity) || 0) : 0), 0)
                      const detectedScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
                      const groupScrap = qualityLoss.isAvailable
                        ? getFinalScrapForTaskPart(qualityLoss.index, task.id, nomId)
                        : detectedScrap
                      const groupBreakdown = getScrapBreakdown(laserCards, groupHistory, workCards)

                      const snapshot = task.plan_snapshot?.[nomId] || task.plan_snapshot?.[nom?.id]
                      const orderRef = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]

                      let need = 0
                      if (snapshot) {
                        need = snapshot.need
                      } else {
                        const itemRef = orderRef?.order_items?.find(it => it.nomenclature_id === nom?.id)
                        if (itemRef) {
                          need = Number(itemRef.quantity) || 0
                        } else {
                          ; (orderRef?.order_items || []).forEach(oi => {
                            const bom = bomItems.filter(b => b.parent_id === oi.nomenclature_id)
                            const bItem = bom.find(b => b.child_id === nom?.id)
                            if (bItem) {
                              need += (Number(oi.quantity) || 0) * (Number(bItem.quantity_per_parent) || 1)
                            }
                          })
                        }
                      }

                      // Find all cards (active and archived) for this order and nomenclature
                      const orderCards = [
                        ...(workCards || []).filter(c => c.order_id === task.order_id && String(c.nomenclature_id) === String(nom?.id)),
                        ...(archiveCards || []).filter(c => String(c.nomenclature_id) === String(nom?.id))
                      ]

                      const qCutBuf = orderCards.filter(c => c.operation === 'Розкрій' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qDoop = orderCards.filter(c => c.operation === 'Доопрацювання' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qDoopBuf = orderCards.filter(c => c.operation === 'Доопрацювання' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                      const qBz = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom?.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано')).reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
                      const qBzShop2 = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom?.id) && i.type === 'bz_shop2').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
                      const qSgp = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom?.id) && (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP')).reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

                      const unitsPerSheet = getNomUnitsPerSheet(nom, task.plan_snapshot?.[String(nom?.id)]);
                      const plan = Number(snapshot?.plan || snapshot?.need || need) || 0;
                      const sheets = Number(snapshot?.sheets || snapshot?.count || snapshot?.sheets_count) || Math.ceil(plan / unitsPerSheet);
                      const loadCapacity = Number(snapshot?.load_capacity || snapshot?.custom_capacity) || findMachine(snapshot?.machine)?.sheet_capacity || 4;
                      const targetTotalCards = Math.ceil(sheets / (loadCapacity || 1));
                      const stockBZ = Number(snapshot?.stock) || 0;

                      let generatedSheetsCalc = 0
                      let generatedQtyCalc = 0
                      laserCards.forEach(c => {
                        const cardScrap = groupHistory
                          .filter(h => String(h.card_id) === String(c.id))
                          .reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
                        let qty = Number(c.quantity) || 0
                        if (qty === 0 && cardScrap === 0 && c?.card_info) {
                          const match = String(c.card_info).match(/\[REQ:(\d+)\]/)
                          if (match) qty = Number(match[1]) || 0
                        }
                        const originalQty = qty + cardScrap
                        const cSheets = c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / Math.max(1, unitsPerSheet))
                        generatedSheetsCalc += cSheets
                        generatedQtyCalc += Number(c.quantity) || qty
                      })

                      const actualSheetsCount = Math.max(sheets, generatedSheetsCalc)
                      const netAvailable = grossCutOnLaser + stockBZ
                      const plannedTotalQty = (actualSheetsCount * unitsPerSheet) + stockBZ
                      const spareFromSheets = plannedTotalQty - need
                      const utilScrap = groupBreakdown?.util || 0
                      const rawShortage = (need > 0) ? Math.max(0, Math.ceil(utilScrap - spareFromSheets)) : 0
                      const shortage = Math.min(rawShortage, Math.max(0, need - netAvailable))

                      const stages = activeCards.reduce((acc, c) => {
                        if (c.status === 'new' || c.status === 'waiting-materials') acc.waiting++
                        else if (c.status === 'completed' || c.status === 'at-buffer' || c.status === 'waiting-buffer' || c.status === 'at-shop2-buffer') acc.reception++
                        else if (c.status === 'in-progress' && (c.operation || 'Розкрій').includes('Розкрій')) acc.cutting++
                        else if (c.operation?.includes('Галтовка')) acc.tumbling++
                        else if (c.operation?.includes('Прийомка')) acc.reception++
                        return acc
                      }, { waiting: 0, cutting: 0, tumbling: 0, reception: 0 })

                      const hasPartCardsInProgress = stages.waiting > 0 || stages.cutting > 0
                      const hasRedoCardForPart = activeCards.some(c => (c.card_info || '').includes('[REDO]') || Boolean(c.is_rework))
                      const isPlanFullyGenerated = 
                        (targetTotalCards > 0 && laserCards.length >= targetTotalCards) ||
                        (sheets > 0 && generatedSheetsCalc >= sheets) ||
                        (plan > 0 && generatedQtyCalc >= plan);

                      const hasShortageUI = shortage > 0 && task.status !== 'completed' && activeCards.length > 0
                      const canClickReissue = shortage > 0 || (isPlanFullyGenerated && !hasPartCardsInProgress)
                      const isPendingOrPlanned = (hasPartCardsInProgress && shortage <= 0) || !isPlanFullyGenerated || activeCards.length === 0

                      return (
                        <div key={nomId} className="nomenclature-archive-group" style={{ marginBottom: '0' }}>
                          <div
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [nomId]: !prev[nomId] }))}
                            style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#111', padding: '12px 20px', borderRadius: '12px', border: '1px solid #222', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#fff' }}>{nom?.name || 'Невідома деталь'}</div>
                              <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px', fontWeight: 700 }}>
                                Потреба: <span style={{ color: '#aaa' }}>{need}</span> |{' '}
                                Вироблено (придатно): <span style={{ color: netAvailable >= need ? '#10b981' : (isPendingOrPlanned ? '#aaa' : '#ef4444'), fontWeight: 900 }}>{netAvailable}</span> |{' '}
                                БЗ: <span style={{ color: (netAvailable - need) >= 0 ? '#10b981' : (isPendingOrPlanned ? '#aaa' : '#ef4444'), fontWeight: 900 }}>
                                  {(netAvailable - need) >= 0 ? `+${netAvailable - need}` : (netAvailable - need)}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                                КАРТОК: <span style={{ color: '#fff' }}>{activeCards.length}</span>
                                <small style={{ marginLeft: '10px', color: '#333' }}>
                                  ({stages.waiting > 0 && <span style={{ color: '#eab308', marginRight: '6px' }}>Очікують: {stages.waiting}</span>}
                                  {stages.cutting > 0 && <span style={{ color: '#ff9000', marginRight: '6px' }}>В роботі: {stages.cutting}</span>}
                                  {stages.reception > 0 && <span style={{ color: '#10b981' }}>Готові: {stages.reception}</span>})
                                </small>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, paddingLeft: '10px' }}>
                                ПРИЙНЯТО: <span style={{ color: netAvailable >= need ? '#10b981' : ((hasPartCardsInProgress && shortage <= 0) ? '#aaa' : '#ef4444'), fontWeight: 900 }}>{netAvailable}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: groupBreakdown.initialScrap > 0 ? '#ef4444' : '#333', fontWeight: 950 }}>
                                БРАК: {groupBreakdown.initialScrap}
                              </div>
                              {groupBreakdown.returned > 0 && (
                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 950 }}>
                                  ПОВЕРНУТО: {groupBreakdown.returned}
                                </div>
                              )}
                              {groupBreakdown.initialScrap > 0 && (
                                <div style={{ fontSize: '0.7rem', color: groupBreakdown.util > 0 ? '#f59e0b' : '#666', fontWeight: 950 }}>
                                  УТИЛЬ: {groupBreakdown.util}
                                </div>
                              )}
                              {activeCards.some(c => c.status === 'waiting-materials') && (
                                <div style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(255, 144, 0, 0.1)',
                                  border: '1px solid rgba(255, 144, 0, 0.3)',
                                  color: '#ff9000',
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  letterSpacing: '0.5px'
                                }}>
                                  ОЧІКУЄ СКЛАД
                                </div>
                              )}
                              {hasShortageUI && (
                                <div onClick={(e) => e.stopPropagation()} style={{ padding: '4px 12px', borderRadius: '8px', background: canClickReissue ? '#ef444422' : 'rgba(255, 144, 0, 0.1)', border: canClickReissue ? '1px solid #ef444444' : '1px solid rgba(255, 144, 0, 0.3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ color: canClickReissue ? '#ef4444' : '#ff9000', fontSize: '0.7rem', fontWeight: 950 }}>НЕСТАЧА: {shortage}</div>
                                  <button
                                    onClick={() => {
                                      if (!canClickReissue) return
                                      const unitsPerSheet = getNomUnitsPerSheet(nom, task.plan_snapshot?.[String(nom?.id)]);
                                      const sheetsNeeded = Math.ceil(shortage / unitsPerSheet);
                                      const activeCardMachine = activeCards[0]?.machine || (task.plan_snapshot?.[String(nom?.id)]?.machine);
                                      const resolvedMachine = findMachine(activeCardMachine) || findMachine(MACHINE_TYPES[0]);
                                      const machineName = MACHINE_TYPES.find(t => t === resolvedMachine?.type || t === resolvedMachine?.name) || resolvedMachine?.name || MACHINE_TYPES[0];
                                      const capacity = Number(resolvedMachine?.sheet_capacity) || 1;
                                      const cardsNeeded = Math.ceil(sheetsNeeded / capacity);
                                      setGenModal({ task, part: { nom }, total: cardsNeeded, targetTotal: cardsNeeded, requirement: shortage, created: 0, machineName, sheets: sheetsNeeded, isRepair: true, capacity })
                                    }}
                                    disabled={!canClickReissue}
                                    title={!canClickReissue ? (hasPartCardsInProgress ? 'Картки для цієї деталі ще ріжуться на лазері' : 'Спочатку згенеруйте всі планові картки для цієї деталі') : ''}
                                    style={{
                                      background: canClickReissue ? '#ef4444' : '#222',
                                      color: canClickReissue ? '#fff' : '#666',
                                      border: canClickReissue ? 'none' : '1px solid #333',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.65rem',
                                      fontWeight: 950,
                                      cursor: canClickReissue ? 'pointer' : 'not-allowed',
                                      textTransform: 'uppercase',
                                      opacity: canClickReissue ? 1 : 0.6,
                                      boxShadow: canClickReissue ? '0 2px 8px rgba(239, 68, 68, 0.4)' : 'none'
                                    }}
                                  >
                                    ДОВИПУСК
                                  </button>
                                </div>
                              )}
                              <div style={{ color: '#555', fontWeight: 900, fontSize: '0.8rem', marginLeft: '5px' }}>
                                {expandedGroups[nomId] ? '▼' : '▶'}
                              </div>
                            </div>
                          </div>

                          {/* ───── КАРТКИ ───── */}
                          {expandedGroups[nomId] && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {(() => {
                                const getCardSeq = (card) => {
                                  const match = (card.card_info || '').match(/(\d+)\/(\d+)/)
                                  return match ? parseInt(match[1]) : 999999
                                }
                                const sortedCards = [...activeCards].sort((a, b) => getCardSeq(a) - getCardSeq(b))
                                const machineGroups = sortedCards.reduce((acc, card) => {
                                  const machineName = card.machine || snapshot?.machine || 'Верстат не вказано'
                                  const machineGroup = getArchiveMachineGroup(machineName)
                                  if (!acc.has(machineGroup.key)) {
                                    acc.set(machineGroup.key, { label: machineGroup.label, cards: [] })
                                  }
                                  acc.get(machineGroup.key).cards.push(card)
                                  return acc
                                }, new Map())

                                return Array.from(machineGroups.entries()).map(([machineTypeKey, machineGroup]) => {
                                  const machineCards = machineGroup.cards
                                  const machineName = machineGroup.label
                                  const machineKey = `${nomId}:${machineTypeKey}`
                                  const isMachineExpanded = !!expandedArchiveMachines[machineKey]
                                  const machineProduced = machineCards.reduce((sum, c) => sum + (countAsProduced(c) ? (Number(c.quantity) || 0) : 0), 0)
                                  const machineBreakdown = getScrapBreakdown(machineCards, groupHistory, workCards)
                                  const machineWaiting = machineCards.filter(c => c.status === 'new' || c.status === 'waiting-materials').length
                                  const machineInWork = machineCards.filter(c => c.status === 'in-progress').length
                                  const machineDone = machineCards.filter(c => ['completed', 'at-buffer', 'waiting-buffer', 'at-shop2-buffer'].includes(c.status)).length

                                  return (
                                    <div key={machineKey} style={{ background: '#0b0b0b', border: '1px solid #1f1f1f', borderRadius: '14px', overflow: 'hidden' }}>
                                      <div
                                        onClick={() => setExpandedArchiveMachines(prev => ({ ...prev, [machineKey]: !prev[machineKey] }))}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#101010', cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap' }}
                                      >
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 950, lineHeight: 1.25 }}>{machineName}</div>
                                          <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, marginTop: '3px' }}>
                                            КАРТОК: <span style={{ color: '#fff' }}>{machineCards.length}</span>
                                            {machineWaiting > 0 && <span style={{ color: '#eab308' }}> | ОЧІКУЄ: {machineWaiting}</span>}
                                            {machineInWork > 0 && <span style={{ color: '#ff9000' }}> | В РОБОТІ: {machineInWork}</span>}
                                            {machineDone > 0 && <span style={{ color: '#10b981' }}> | ГОТОВІ: {machineDone}</span>}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                          <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 900 }}>ПРИЙНЯТО: <span style={{ color: '#3b82f6' }}>{machineProduced}</span></div>
                                          <div style={{ color: machineBreakdown.initialScrap > 0 ? '#ef4444' : '#555', fontSize: '0.65rem', fontWeight: 950 }}>БРАК: {machineBreakdown.initialScrap}</div>
                                          {machineBreakdown.returned > 0 && (
                                            <div style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 950 }}>ПОВЕРНУТО: {machineBreakdown.returned}</div>
                                          )}
                                          {machineBreakdown.initialScrap > 0 && (
                                            <div style={{ color: machineBreakdown.util > 0 ? '#f59e0b' : '#555', fontSize: '0.65rem', fontWeight: 950 }}>УТИЛЬ: {machineBreakdown.util}</div>
                                          )}
                                          <div style={{ color: '#555', fontWeight: 950, fontSize: '0.75rem' }}>{isMachineExpanded ? '▼' : '▶'}</div>
                                        </div>
                                      </div>

                                      {isMachineExpanded && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px', padding: '12px' }}>
                                          {machineCards.map(card => {
                                  const loadingText = card.card_info?.split(' [')[0]
                                  const isRedo = (card.card_info || '').includes('[REDO]')
                                  const cardScrap = groupHistory
                                    .filter(h => String(h.card_id) === String(card.id))
                                    .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
                                  const cardBreakdown = getScrapBreakdown(card, groupHistory, workCards)

                                  const getStatusBadge = () => {
                                    if (card.status === 'new') return { label: 'ОЧІКУЄ', color: '#eab308' }
                                    if (card.status === 'in-progress') return { label: `У РОБОТІ: ${card.operation?.toUpperCase()}`, color: '#3b82f6' }
                                    if (card.status === 'at-buffer' || card.status === 'waiting-buffer') return { label: `БУФЕР: ${card.operation?.toUpperCase()}`, color: '#10b981' }
                                    if (card.status === 'completed') return { label: 'ЗАВЕРШЕНО', color: '#10b981' }
                                    return { label: card.status?.toUpperCase(), color: '#555' }
                                  }
                                  const badge = getStatusBadge()

                                  return (
                                    <div
                                      key={card.id}
                                      className="archive-card-hover"
                                      style={{ background: '#0f0f0f', padding: '15px', borderRadius: '20px', display: 'flex', gap: '15px', alignItems: 'center', border: `1px solid ${isRedo ? '#ef444444' : '#1a1a1a'}`, borderLeft: cardBreakdown.initialScrap > 0 ? '4px solid #ef4444' : `1px solid ${isRedo ? '#ef444444' : '#1a1a1a'}`, cursor: 'pointer', transition: '0.2s', position: 'relative' }}
                                      onClick={() => setPrintQueue({
                                        task,
                                        part: { nom, nomenclature_id: card.nomenclature_id },
                                        metadata: [{
                                          id: card.id,
                                          loading: card.card_info,
                                          qty: card.quantity,
                                          machine: card.machine || snapshot?.machine,
                                          totalLoadings: '—',
                                          sheetsPerLoading: findMachine(card.machine || snapshot?.machine)?.sheet_capacity || 1,
                                          estimatedTime: (Number(nom?.time_per_unit) || 0) * (Number(card.quantity) || 0) * 60
                                        }]
                                      })}
                                    >
                                      <div style={{ background: '#fff', padding: '5px', borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}><QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={45} /></div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <div style={{ fontSize: '0.7rem', fontWeight: 1000, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Картка #{card.id.slice(-8).toUpperCase()}</div>
                                          <span style={{ fontSize: '0.5rem', fontWeight: 1000, padding: '3px 8px', borderRadius: '6px', background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44` }}>{badge.label}</span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '6px', fontWeight: 700 }}>
                                          <span style={{ color: '#aaa' }}>{loadingText}</span> | <span style={{ color: '#555' }}>Верстат:</span> <span style={{ color: '#fff' }}>{card.machine || snapshot?.machine || '—'}</span> | <span style={{ color: '#555' }}>Шт:</span> <span style={{ color: '#fff' }}>{card.quantity}</span> | <span style={{ color: '#ef4444' }}>Брак:</span> <span style={{ color: cardScrap > 0 ? '#ef4444' : '#888' }}>{cardScrap}</span>
                                        </div>
                                        {cardScrap > 0 && (
                                          <div style={{ position: 'absolute', top: '-10px', right: '15px', display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: '#fff', padding: '3px 10px', borderRadius: '8px', fontWeight: 950, fontSize: '0.6rem', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)' }}>
                                            <AlertTriangle size={10} /> БРАК: {cardScrap} ШТ
                                          </div>
                                        )}
                                        {(() => {
                                          const cardShiftChanges = groupHistory
                                            .filter(h => String(h.card_id) === String(card.id) && h.stage_name === 'Розкрій (перезмінка)')
                                            .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
                                          if (cardShiftChanges.length === 0) return null
                                          return (
                                            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                              <span style={{ fontSize: '0.5rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', alignSelf: 'center' }}>Перезмінка:</span>
                                              {cardShiftChanges.map((h, i) => {
                                                const replacedMatch = h.card_info?.match(/\[REPLACED_BY:(.*?)\]/)
                                                const replacement = replacedMatch ? replacedMatch[1].split(' (')[0] : ''
                                                return (
                                                  <span key={i} style={{ fontSize: '0.5rem', background: '#f59e0b11', border: '1px solid #f59e0b22', color: '#f59e0b', padding: '1px 6px', borderRadius: '5px', fontWeight: 800 }}>
                                                    {h.operator_name}{replacement ? ` ➔ ${replacement}` : ''}
                                                  </span>
                                                )
                                              })}
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  )
                                })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <ForemanAdminCardDeletePanel
                    task={task}
                    workCards={workCards}
                    archiveCards={archiveCards}
                    nomenclatures={nomenclatures}
                    currentUser={currentUser}
                    fetchData={fetchData}
                    onDeleted={handleAdminCardsDeleted}
                  />
                </div>
              )
            })()
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.1 }}>
              <ListTodo size={120} />
              <h3>Оберіть наряд зі списку зліва</h3>
            </div>
          )}
        </div>
      </div>

      {genModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 15000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '480px', borderRadius: '32px', border: '1px solid #222', padding: '40px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <button
              onClick={() => setGenModal(null)}
              style={{ position: 'absolute', top: '25px', right: '25px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 950, margin: '0 0 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Генерація карток</h2>
            <p style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem', marginBottom: '30px' }}>{genModal.part.nom?.name}</p>

            {genModal.splits && genModal.splits.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: 900, marginBottom: '5px' }}>ОБЕРІТЬ ПАРТІЮ ДЛЯ ДРУКУ:</div>
                {(() => {
                  const globalTotalLoadings = genModal.splits.reduce((acc, s) => {
                    const cap = Number(s.load_capacity) || findMachine(s.machine)?.sheet_capacity || 1
                    const unitsPerSheet = getNomUnitsPerSheet(genModal.part.nom, genModal.task?.plan_snapshot?.[String(genModal.part.nom?.id)])
                    const sSheets = Number(s.sheets) || Math.ceil(s.qty / unitsPerSheet)
                    return acc + Math.ceil(sSheets / cap)
                  }, 0)

                  let currentGlobalOffset = 0
                  const existingNomenclatureCards = (workCards || []).filter(wc =>
                    String(wc.task_id) === String(genModal.task.id) &&
                    String(wc.nomenclature_id) === String(genModal.part.nom?.id)
                  )

                  return genModal.splits.map((split, sIdx) => {
                    const cap = Number(split.load_capacity) || findMachine(split.machine)?.sheet_capacity || 1
                    const unitsPerSheet = getNomUnitsPerSheet(genModal.part.nom, genModal.task?.plan_snapshot?.[String(genModal.part.nom?.id)])
                    const splitSheets = Number(split.sheets) || Math.ceil(split.qty / unitsPerSheet)
                    const capacityKey = `${genModal.part.nom?.id}_${sIdx}_cap`
                    const currentCapacity = customLoadingCapacities[capacityKey] ?? (Number(split.load_capacity) || cap)
                    const splitLoadings = Math.ceil(splitSheets / currentCapacity)
                    const splitQty = split.qty || (splitSheets * unitsPerSheet)
                    const qtyPerCard = Math.ceil(splitQty / splitLoadings)

                    // INTELLIGENT FILTERING:
                    // Instead of exact sheet matching (which fails for partials), 
                    // we count sheets for THIS MACHINE in order of splits.

                    // 1. Get ALL cards for this nomenclature that match the machine name
                    const machineCards = existingNomenclatureCards
                      .filter(wc => isSameMachineFamily(wc.machine, split.machine))
                      .sort((a, b) => a.id - b.id)

                    // 2. Determine which cards belong to THIS specific split index
                    const prevSplitsSameMachine = genModal.splits.slice(0, sIdx)
                      .filter(s => isSameMachineFamily(s.machine, split.machine))
                    const sheetsSkipped = prevSplitsSameMachine.reduce((sum, s) => {
                      const sSheets = Number(s.sheets) || Math.ceil(s.qty / unitsPerSheet)
                      return sum + sSheets
                    }, 0)

                    // 3. Select cards that fall within the range of THIS split's sheets
                    let sheetsUsedInThisSplit = 0
                    let cardsBelongingToThisSplitCount = 0
                    let currentGlobalSheets = 0

                    machineCards.forEach(wc => {
                      const cardSheets = Math.ceil((Number(wc.quantity) || 0) / unitsPerSheet)
                      const cardStart = currentGlobalSheets
                      const cardEnd = currentGlobalSheets + cardSheets

                      const splitStart = sheetsSkipped
                      const splitEnd = sheetsSkipped + splitSheets

                      // If any part of this card falls within this split's range
                      if (cardEnd > splitStart && cardStart < splitEnd) {
                        cardsBelongingToThisSplitCount++
                        sheetsUsedInThisSplit += cardSheets // simplified
                      }

                      currentGlobalSheets += cardSheets
                    })

                    const getKittingSheets = (taskObj, partNom) => {
                      const partEntry = (taskObj.plan_snapshot || {})[String(partNom?.id)]
                      const baseMat = getEffectiveMaterial(partNom, partEntry)
                      const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(taskObj.id))
                      const extractThickness = (str) => {
                        const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                        return match ? match[1] + 'мм' : null
                      }
                      const extractMaterialGrade = (str) => {
                        const match = String(str || '').toLowerCase().match(/[tт]\s*(300|700)/)
                        return match ? match[1] : null
                      }
                      const baseThickness = extractThickness(baseMat)
                      const baseGrade = extractMaterialGrade(baseMat)
                      const matchesBaseMaterial = (candidate) => {
                        const candidateLower = String(candidate || '').toLowerCase()
                        const candidateThickness = extractThickness(candidateLower)
                        const candidateGrade = extractMaterialGrade(candidateLower)
                        if (baseThickness && candidateThickness && baseThickness !== candidateThickness) return false
                        if (baseGrade && candidateGrade && baseGrade !== candidateGrade) return false
                        if (baseThickness && candidateThickness) return true
                        const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase()).filter(Boolean)
                        return activeMaterials.some(act => candidateLower.includes(act) || act.includes(candidateLower))
                      }
                      const sheetReqs = taskReqs.filter(r => {
                        const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                        const rName = `${rNom?.name || ''} ${rNom?.material_type || ''} ${r.details || ''}`
                        const lowerName = rName.toLowerCase()

                        const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
                        if (!isSheet) return false
                        return matchesBaseMaterial(lowerName)
                      })
                      const materialRequiresSheets = /(?:т|t)\s*(?:300|700)|лист|sheet/i.test(baseMat)

                      const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                        .reduce((sum, r) => sum + getRequestQty(r), 0)

                      const pending = sheetReqs.filter(r => r.status === 'pending')
                        .reduce((sum, r) => sum + getRequestQty(r), 0)

                      // One issued sheet pool can serve several parts made from the
                      // same material. Subtract cards generated for ALL such parts,
                      // not only the currently opened nomenclature.
                      const usedAcrossTask = (workCards || []).filter(card => {
                        if (String(card.task_id) !== String(taskObj.id) || card.is_rework) return false
                        const operation = String(card.operation || '').toLowerCase()
                        if (operation === 'склад бз' || operation.includes('склад bz')) return false
                        const cardNom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
                        const cardEntry = (taskObj.plan_snapshot || {})[String(card.nomenclature_id)]
                        return matchesBaseMaterial(cardEntry?.material || cardNom?.material_type || cardNom?.name || '')
                      }).reduce((sum, card) => {
                        const cardNom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
                        const cardUnitsPerSheet = getNomUnitsPerSheet(cardNom, (taskObj.plan_snapshot || {})[String(card.nomenclature_id)])
                        return sum + Math.ceil((Number(card.quantity) || 0) / cardUnitsPerSheet)
                      }, 0)

                      return {
                        issuedSheets: issued,
                        pendingSheets: pending,
                        usedAcrossTask,
                        // Fail closed: sheet-based production without a loaded
                        // request must be blocked, never treated as unlimited.
                        hasKittingReqs: materialRequiresSheets || sheetReqs.length > 0
                      }
                    }

                    const { issuedSheets, pendingSheets, usedAcrossTask, hasKittingReqs } = getKittingSheets(genModal.task, genModal.part.nom)
                    const generatedCount = cardsBelongingToThisSplitCount
                    const isGenerated = sheetsUsedInThisSplit >= splitSheets
                    const remainingCount = Math.max(0, splitLoadings - generatedCount)

                    // Розраховуємо ліміт карт на основі виданих листів

                    const availableIssuedSheets = Math.max(0, issuedSheets - usedAcrossTask)
                    const remainingSheetsInSplit = Math.max(0, splitSheets - sheetsUsedInThisSplit)
                    const maxAllowedToGen = hasKittingReqs
                      ? Math.min(remainingCount, Math.floor(Math.min(remainingSheetsInSplit, availableIssuedSheets) / currentCapacity))
                      : remainingCount
                    const isKittingBlocked = hasKittingReqs && maxAllowedToGen <= 0

                    const splitGlobalOffsetForThisMachine = currentGlobalOffset
                    currentGlobalOffset += splitLoadings
                    const toGen = Math.min(maxAllowedToGen, partialCounts[`${genModal.part.nom?.id}_${sIdx}`] ?? remainingCount)

                    return (
                      <div key={sIdx} style={{ background: '#080808', padding: '15px', borderRadius: '16px', border: isGenerated ? '1px solid #10b98133' : '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isGenerated ? 0.8 : 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 900, color: isGenerated ? '#10b981' : '#fff', fontSize: '0.9rem' }}>{split.machine || '—'}</div>
                            <span style={{ fontSize: '0.65rem', background: isGenerated ? '#10b98133' : '#222', color: isGenerated ? '#10b981' : '#888', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                              {generatedCount} / {splitLoadings} КАРТ.
                            </span>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>
                            Листів: {splitSheets} | Деталей: {splitQty}
                          </div>
                          {(() => {
                            if (isGenerated) {
                              return <div style={{ fontSize: '0.55rem', color: '#10b981', marginTop: '2px', fontWeight: 900 }}>Всі карти згенеровано ✅</div>
                            }
                            if (!hasKittingReqs) return null;
                            if (issuedSheets === 0) {
                              return (
                                <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '4px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⚠️ Очікуємо погодження складу (немає листів)
                                </div>
                              )
                            }
                            if (pendingSheets > 0) {
                              return (
                                <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 900, marginTop: '4px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⏳ Видано: {issuedSheets} л. | Очікуємо видачу {pendingSheets} листів з СО
                                </div>
                              )
                            }
                            return (
                              <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                ✅ ГОТОВО ДО ЗАПУСКУ ({issuedSheets} л. видано)
                              </div>
                            )
                          })()}
                        </div>

                        {!isGenerated && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '0.55rem', color: '#ff9000', fontWeight: 900 }}>ЗАГРУЗКА</span>
                              <input
                                type="number"
                                min="1"
                                max={splitSheets}
                                value={currentCapacity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1)
                                  setCustomLoadingCapacities(prev => ({ ...prev, [capacityKey]: val }))
                                }}
                                onBlur={() => persistSplitLoadCapacity(genModal.task, genModal.part.nom?.id, sIdx, currentCapacity)}
                                style={{ width: '45px', background: '#000', border: '1px solid rgba(255,144,0,0.4)', color: '#ff9000', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                                title="Кількість листів на одну загрузку (картку)"
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900 }}>ДРУК</span>
                              <input
                                type="number"
                                min="1"
                                max={maxAllowedToGen}
                                value={toGen}
                                onChange={(e) => {
                                  const val = Math.min(maxAllowedToGen, Math.max(1, parseInt(e.target.value) || 1))
                                  setPartialCounts(prev => ({ ...prev, [`${genModal.part.nom?.id}_${sIdx}`]: val }))
                                }}
                                style={{ width: '45px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                              />
                            </div>
                            <button
                              disabled={isGenerating || isKittingBlocked}
                              onClick={() => {
                                const finalToGen = Math.min(toGen, remainingCount, maxAllowedToGen)
                                if (finalToGen <= 0) return

                                handleGenerateFromWorksheet(
                                  genModal.task,
                                  genModal.part,
                                  splitSheets,
                                  split.machine,
                                  finalToGen,
                                  generatedCount,
                                  splitQty,
                                  genModal.isRepair,
                                  globalTotalLoadings,
                                  splitGlobalOffsetForThisMachine,
                                  currentCapacity,
                                  hasKittingReqs ? Math.min(remainingSheetsInSplit, availableIssuedSheets) : null
                                )
                              }}
                              style={{
                                background: isGenerating ? '#333' : (isKittingBlocked ? '#1e1b18' : '#10b981'),
                                color: isKittingBlocked ? '#7f1d1d' : '#fff',
                                border: isKittingBlocked ? '1px solid rgba(239,68,68,0.2)' : 'none',
                                padding: '10px 15px',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                fontWeight: 950,
                                cursor: (isGenerating || isKittingBlocked) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                pointerEvents: (isGenerating || isKittingBlocked) ? 'none' : 'auto'
                              }}
                            >
                              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                              {isGenerating ? 'ОБРОБКА...' : (isKittingBlocked ? 'НЕМАЄ ЛИСТІВ' : 'ГЕНЕРУАТИ')}
                            </button>
                          </div>
                        )}
                        {isGenerated && (
                          <div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>ГОТОВО</div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <>
                {/* Machine selector */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Оберіть верстат:
                  </label>
                  <select
                    value={genModal.machineName}
                    onChange={(e) => {
                      const newMachineName = e.target.value
                      const resolvedMachine = findMachine(newMachineName)
                      const newCapacity = Number(resolvedMachine?.sheet_capacity) || 1
                      const newCardsNeeded = Math.ceil((genModal.sheets || 1) / newCapacity)
                      setGenModal(prev => ({
                        ...prev,
                        machineName: newMachineName,
                        capacity: newCapacity,
                        total: Math.max(1, newCardsNeeded - (prev.created || 0)),
                        targetTotal: newCardsNeeded
                      }))
                    }}
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
                  >
                    {MACHINE_TYPES.map(t => {
                      const cap = findMachine(t)?.sheet_capacity || 1
                      return (
                        <option key={t} value={t}>{t} (місткість: {cap} л.)</option>
                      )
                    })}
                  </select>
                </div>

                {!genModal.isRepair && (
                  <div style={{ background: '#080808', padding: '15px 20px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>СТАТУС:</span>
                      <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {genModal.created} з {genModal.targetTotal || genModal.total}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(genModal.created / (genModal.targetTotal || genModal.total)) * 100}%`, height: '100%', background: '#3b82f6', transition: '0.3s' }} />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#ff9000', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    Завантаження (від {findMachine(genModal.machineName)?.min_capacity || 1} до {findMachine(genModal.machineName)?.max_capacity || findMachine(genModal.machineName)?.sheet_capacity || 1} л.)
                  </label>
                  <input
                    type="number"
                    value={genModal.capacity !== undefined ? genModal.capacity : (findMachine(genModal.machineName)?.min_capacity || 1)}
                    onChange={(e) => {
                      const newCap = parseInt(e.target.value);
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      const safeCap = isNaN(newCap) ? 1 : Math.min(maxC, Math.max(minC, newCap));
                      const newTargetTotal = Math.ceil((genModal.sheets || 1) / safeCap);
                      setGenModal(prev => ({
                        ...prev,
                        capacity: isNaN(newCap) ? '' : newCap,
                        total: Math.max(1, newTargetTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}
                    onBlur={(e) => {
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = minC;
                      else v = Math.min(maxC, Math.max(minC, v));
                      const newTargetTotal = Math.ceil((genModal.sheets || 1) / v);
                      setGenModal(prev => ({
                        ...prev,
                        capacity: v,
                        total: Math.max(1, newTargetTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}
                    min={findMachine(genModal.machineName)?.min_capacity || 1}
                    max={findMachine(genModal.machineName)?.max_capacity || findMachine(genModal.machineName)?.sheet_capacity || 1}
                    style={{ width: '100%', background: '#000', border: '1px solid rgba(255,144,0,0.5)', color: '#ff9000', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    {genModal.isRepair ? 'Кількість карт до друку' : 'Скільки карт згенерувати?'}
                  </label>
                  <input
                    type="number"
                    id="gen_count_input"
                    value={genModal.total}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      setGenModal(prev => ({ ...prev, total: val }))
                    }}
                    min="1"
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '2.5rem', fontWeight: 950, textAlign: 'center', padding: '15px', borderRadius: '20px', outline: 'none', borderInline: '4px solid #10b981' }}
                  />
                </div>

                {/* Live cutter calculation breakdown */}
                {(() => {
                  const currentPartNom = genModal.part?.nom || genModal.part
                  const batchSheets = (Number(genModal.total) || 1) * (Number(genModal.capacity) || 1)
                  const batchCutters = calculateCuttersForBatch({
                    partNom: currentPartNom,
                    machineName: genModal.machineName,
                    sheets: batchSheets,
                    task: genModal.task,
                    machineOperations,
                    nomenclatures,
                    inventory
                  })

                  return (
                    <div style={{ marginBottom: '25px', background: '#09090b', border: '1px solid #1f1f23', borderRadius: '16px', padding: '16px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>✂️ ПОТРІБНІ ФРЕЗИ ДЛЯ ЦІЄЇ ПОРЦІЇ ({batchSheets} л.):</span>
                        <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 800 }}>{batchCutters.length} найменувань</span>
                      </div>
                      {batchCutters.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {batchCutters.map((item, idx) => {
                            const cutterKey = String(item.nomenclature_id || item.name)
                            const categoryName = item.name

                            const matchingOptions = (nomenclatures || []).filter(n => {
                              if (n.type !== 'consumable') return false
                              if (item.nomenclature_id && String(n.characteristic) === String(item.nomenclature_id)) return true
                              const diaMatch = String(categoryName).match(/ф\s*([\d.,]+)/i)
                              if (diaMatch) {
                                const diaClean = diaMatch[1].replace(',', '.')
                                const nLow = n.name.toLowerCase()
                                return nLow.includes('фреза') && (nLow.includes(`${diaClean}х`) || nLow.includes(`${diaClean}x`))
                              }
                              return false
                            })

                            const options = matchingOptions.length > 0 ? matchingOptions : (nomenclatures || []).filter(n => n.type === 'consumable' && n.name.toLowerCase().includes('фреза'))

                            const selectedNomId = selectedDovypuskCutters[cutterKey]
                              || selectedDovypuskCutters[categoryName]
                              || selectedDovypuskCutters[categoryName.toLowerCase()]
                              || (item.nomenclature_id && nomenclatures.find(n => String(n.id) === String(item.nomenclature_id) && n.type === 'consumable')?.id)
                              || (options[0]?.id || '')

                            const chosenNom = nomenclatures.find(n => String(n.id) === String(selectedNomId))
                            const invItem = (inventory || []).find(i => String(i.nomenclature_id) === String(chosenNom?.id || selectedNomId) && (i.warehouse === 'operational' || !i.warehouse))
                            const inStock = Number(invItem?.total_qty) || 0
                            const freeStock = Math.max(0, inStock - (Number(invItem?.reserved_qty) || 0))
                            const isAvailable = freeStock >= item.qty

                            return (
                              <div key={idx} style={{ background: '#121215', padding: '10px 14px', borderRadius: '12px', border: '1px solid #1f1f23', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ color: '#fff', fontWeight: 900, fontSize: '0.85rem' }}>{categoryName}</div>
                                    <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '2px' }}>
                                      Склад операт.: <strong style={{ color: isAvailable ? '#10b981' : '#ef4444' }}>{freeStock} од. вільних</strong> (всього {inStock})
                                    </div>
                                  </div>
                                  <div style={{ background: 'rgba(255, 144, 0, 0.1)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', padding: '4px 12px', borderRadius: '10px', fontWeight: 950, fontSize: '0.95rem' }}>
                                    {item.qty} од.
                                  </div>
                                </div>

                                <div style={{ marginTop: '4px' }}>
                                  <label style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                                    Модель фрези (складська номенклатура):
                                  </label>
                                  <select
                                    value={selectedNomId}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setSelectedDovypuskCutters(prev => ({
                                        ...prev,
                                        [cutterKey]: val,
                                        [categoryName]: val,
                                        [categoryName.toLowerCase()]: val
                                      }))
                                    }}
                                    style={{ width: '100%', background: '#000', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', padding: '7px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, outline: 'none' }}
                                  >
                                    <option value="">-- Оберіть модель фрези --</option>
                                    {options.map(opt => {
                                      const optInv = (inventory || []).find(i => String(i.nomenclature_id) === String(opt.id) && (i.warehouse === 'operational' || !i.warehouse))
                                      const optFree = Math.max(0, (Number(optInv?.total_qty) || 0) - (Number(optInv?.reserved_qty) || 0))
                                      return (
                                        <option key={opt.id} value={opt.id}>
                                          {opt.name} — [на СО: {optFree} шт.]
                                        </option>
                                      )
                                    })}
                                  </select>
                                </div>
                              </div>
                            )
                          })}
                          <div style={{ fontSize: '0.65rem', color: '#888', fontStyle: 'italic', marginTop: '6px', textAlign: 'center' }}>
                            ℹ️ При створенні буде надіслано запит на оперативний склад. Картки активуються в Цеху 1 після погодження фрез.
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                          Для цієї деталі додаткові фрези не вимагаються
                        </div>
                      )}
                    </div>
                  )
                })()}

                <button
                  onClick={() => {
                    const v = parseInt(document.getElementById('gen_count_input').value)
                    if (v > 0) {
                      handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, v, genModal.created, genModal.requirement, genModal.isRepair, genModal.targetTotal, 0, genModal.capacity, genModal.maxSheetsToGenerate, null, selectedDovypuskCutters)
                      setGenModal(null)
                    }
                  }}
                  style={{ width: '100%', background: '#10b981', color: '#fff', padding: '22px', borderRadius: '22px', fontSize: '1rem', fontWeight: 950, cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)' }}
                >
                  ПІДТВЕРДИТИ ТА ДРУКУВАТИ
                </button>
              </>
            )}
          </div>
        </div>
      )}


      {/* ───── ЛОАДЕР ───── */}
      {isGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <Loader2 size={60} color="#ef4444" className="animate-spin" />
          <h2 style={{ fontWeight: 900, textTransform: 'uppercase' }}>Генерація карток...</h2>
        </div>
      )}
      <ForemanPrintQueue
        printQueue={printQueue}
        setPrintQueue={setPrintQueue}
        orders={orders}
        allOrdersMap={allOrdersMap}
        nomenclatures={nomenclatures}
        machines={machines}
        machineOperations={machineOperations}
        getDisplayMaterial={getDisplayMaterial}
        customers={customers}
      />

      <ForemanPrintNaryadQueue
        printNaryadQueue={printNaryadQueue}
        setPrintNaryadQueue={setPrintNaryadQueue}
        nomenclatures={nomenclatures}
        inventory={inventory}
        getBOMParts={getBOMPartsLocal}
        getRequestQty={getRequestQty}
      />
      <MaterialCorrectionModal
        part={materialCorrection.part}
        options={materialCorrection.materialOptions}
        isSaving={materialCorrection.isSaving}
        error={materialCorrection.error}
        onClose={materialCorrection.close}
        onSave={materialCorrection.save}
      />
      {/* тФАтФАтФАтФАтФА ╨Ь╨Ю╨Ф╨Р╨Ы ╨Ч╨Т╨Ж╨в╨г ╨Я╨Ю ╨Э╨Р╨а╨п╨Ф╨г тФАтФАтФАтФАтФА */}
      <ForemanReportModal
        showReportModal={showReportModal} setShowReportModal={setShowReportModal}
        reportTaskId={reportTaskId} reportLoading={reportLoading} reportData={reportData}
        reportStageFilter={reportStageFilter} setReportStageFilter={setReportStageFilter}
        reportNomFilter={reportNomFilter} setReportNomFilter={setReportNomFilter}
        reportSortBy={reportSortBy} setReportSortBy={setReportSortBy}
        reportOperatorFilter={reportOperatorFilter} setReportOperatorFilter={setReportOperatorFilter}
        reportDetailModal={reportDetailModal} setReportDetailModal={setReportDetailModal}
        handleOpenReport={handleOpenReport} tasks={tasks} orders={orders}
        allOrdersMap={allOrdersMap} bomItems={bomItems} nomenclatures={nomenclatures}
        machineOperations={machineOperations} inventory={inventory} workCards={workCards} getRequestQty={getRequestQty}
      />
      {false && showReportModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 35000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} className="report-modal-backdrop">
          <div style={{
            background: '#0d0d0d',
            border: '1px solid #222',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '30px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            position: 'relative',
            color: '#fff'
          }} className="printable-report-area">
            {/* Close Button */}
            <button
              onClick={() => setShowReportModal(false)}
              className="close-btn-print"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#1a1a1a',
                border: '1px solid #333',
                color: '#fff',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#333'}
              onMouseLeave={e => e.currentTarget.style.background = '#1a1a1a'}
            >
              <X size={20} />
            </button>

            {reportLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '15px' }}>
                <Loader2 size={40} className="animate-spin" color="#3b82f6" />
                <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 800 }}>╨д╨╛╤А╨╝╤Г╨▓╨░╨╜╨╜╤П ╨╖╨▓╤Ц╤В╤Г...</span>
              </div>
            ) : reportData ? (() => {
              const currentTask = relevantTasks.find(t => t.id === reportTaskId) || tasks.find(t => t.id === reportTaskId)
              if (!currentTask) return <div>╨Э╨░╤А╤П╨┤ ╨╜╨╡ ╨╖╨╜╨░╨╣╨┤╨╡╨╜╨╛</div>
              const currentOrder = orders.find(o => o.id === currentTask.order_id) || allOrdersMap[currentTask.order_id]

              // BOM parts helper inside modal
              const getBOMPartsLocal = (nomenclatureId) => {
                return bomItems
                  .filter(b => b.parent_id === nomenclatureId)
                  .map(b => ({
                    ...b,
                    nom: nomenclatures.find(n => n.id === b.child_id)
                  }))
              }

              // Calculate stats
              let totalPlannedSheets = 0
              let totalActualSheets = 0
              let totalPlannedParts = 0
              let totalActualParts = 0
              let totalScrap = 0
              const materialStats = {}

              const partsList = []
              const snapshot = currentTask.plan_snapshot
              const hasSnapshot = snapshot && Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k)).length > 0

              if (hasSnapshot) {
                const keys = Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k))
                keys.forEach(nomId => {
                  const snapEntry = snapshot[nomId]
                  if (!snapEntry) return
                  const nom = nomenclatures.find(n => String(n.id) === String(nomId))
                  if (nom && nom.type !== 'part') return
                  partsList.push({
                    nomId: String(nomId),
                    nom: nom,
                    need: Number(snapEntry.need) || 0,
                    plan: Number(snapEntry.plan) || 0,
                    sheets: Number(snapEntry.sheets) || 0,
                    unitsPerSheet: getNomUnitsPerSheet(nom, snapEntry),
                    material: snapEntry.material || nom?.material_type || 'тАФ'
                  })
                })
              } else {
                currentOrder?.order_items?.forEach(item => {
                  const parts = getBOMPartsLocal(item.nomenclature_id)
                  const rows = parts.length > 0 ? parts.filter(r => r.nom?.type === 'part') : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }].filter(r => r.nom?.type === 'part')

                  rows.forEach(part => {
                    const nomId = part.nom?.id
                    if (!nomId) return
                    const need = Number(item.quantity) * (Number(part.quantity_per_parent) || 1)
                    const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === '╨Э╨╡ ╨▓╨║╨░╨╖╨░╨╜╨╛'))
                    const stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                    const plan = Math.max(0, need - stockBZ)
                    const unitsPerSheet = getNomUnitsPerSheet(part.nom)
                    const sheets = Math.ceil(plan / unitsPerSheet)
                    const material = part.nom?.material_type || 'тАФ'

                    partsList.push({
                      nomId: String(nomId),
                      nom: part.nom,
                      need,
                      plan,
                      sheets,
                      unitsPerSheet,
                      material
                    })
                  })
                })
              }

              const getMaterialName = (typePrefix, thickness) => {
                const rawNom = nomenclatures?.find(n =>
                  (n.type === 'raw' || n.type === 'material') &&
                  n.name.includes('[╨Я╤Ц╨┤╨│╨╛╤В╨╛╨▓╨╗╨╡╨╜╨╕╨╣]') &&
                  (n.name.toLowerCase().includes(typePrefix.toLowerCase()) || (typePrefix === '╨в300' && !n.name.toLowerCase().includes('╤В700') && !n.name.toLowerCase().includes('t700'))) &&
                  n.name.toLowerCase().replace(/\s+/g, '').includes(`(${thickness.toLowerCase()})`)
                )
                return rawNom ? rawNom.name : `╨Ы╨╕╤Б╤В ${typePrefix} (${thickness}) [╨Я╤Ц╨┤╨│╨╛╤В╨╛╨▓╨╗╨╡╨╜╨╕╨╣]`
              }

              partsList.forEach(p => {
                const partHistory = reportData.historyRows.filter(h => String(h.nomenclature_id) === String(p.nomId))
                const cuttingHistory = partHistory.filter(h => h.stage_name === '╨а╨╛╨╖╨║╤А╤Ц╨╣')
                const acceptedHistory = partHistory.filter(h => h.stage_name === '╨Я╤А╨╕╨╣╨╛╨╝╨║╨░' || h.stage_name === 'completed')

                const totalQtyDone = cuttingHistory.reduce((s, h) => s + (Number(h.qty_completed) || 0), 0)
                const sheetsDone = p.unitsPerSheet > 0 ? Math.ceil(totalQtyDone / p.unitsPerSheet) : 0

                const acceptedQty = acceptedHistory.reduce((s, h) => s + (Number(h.qty_completed) || 0), 0)

                totalPlannedSheets += (p.sheets || 0)
                totalActualSheets += sheetsDone
                totalPlannedParts += (p.plan || 0)
                totalActualParts += acceptedQty

                // Get planned splits from snapshot
                const snapEntry = snapshot?.[p.nomId]
                const isDefaultT700 = (p.material || '').toLowerCase().includes('╤В700') || (p.material || '').toLowerCase().includes('t700')
                const defaultT300 = isDefaultT700 ? 0 : p.sheets
                const defaultT700 = isDefaultT700 ? p.sheets : 0
                let plannedT300 = snapEntry ? (snapEntry.sheets_t300 !== undefined ? Number(snapEntry.sheets_t300) : (isDefaultT700 ? 0 : Number(p.sheets))) : defaultT300
                let plannedT700 = snapEntry ? (snapEntry.sheets_t700 !== undefined ? Number(snapEntry.sheets_t700) : (isDefaultT700 ? Number(p.sheets) : 0)) : defaultT700
                if (isNaN(plannedT300)) plannedT300 = defaultT300
                if (isNaN(plannedT700)) plannedT700 = defaultT700

                const totalPlanned = plannedT300 + plannedT700
                const ratioT300 = totalPlanned > 0 ? (plannedT300 / totalPlanned) : 1
                const ratioT700 = totalPlanned > 0 ? (plannedT700 / totalPlanned) : 0

                const actualT300 = Math.round(sheetsDone * ratioT300)
                const actualT700 = Math.round(sheetsDone * ratioT700)

                const rawMat = p.material || 'тАФ'
                const thickMatch = rawMat.match(/(\d+(?:\.\d+)?)╨╝╨╝/i)
                const thickness = thickMatch ? `${thickMatch[1]}╨╝╨╝` : null

                const addToStats = (name, planned, actual) => {
                  if (planned === 0 && actual === 0) return
                  if (!materialStats[name]) {
                    materialStats[name] = {
                      plannedSheets: 0,
                      actualSheets: 0
                    }
                  }
                  materialStats[name].plannedSheets += planned
                  materialStats[name].actualSheets += actual
                }

                if (thickness) {
                  const t300Name = getMaterialName('╨в300', thickness)
                  const t700Name = getMaterialName('╨в700', thickness)

                  addToStats(t300Name, plannedT300, actualT300)
                  addToStats(t700Name, plannedT700, actualT700)
                } else {
                  addToStats(rawMat, p.sheets, sheetsDone)
                }
              })

              totalScrap = reportData.historyRows.reduce((sum, row) => sum + (Number(row.scrap_qty) || 0), 0)

              const cutterRequests = (reportData.materialRequests || []).filter(r => {
                const nomName = r.nomenclature?.name?.toLowerCase() || ''
                const detailsStr = r.details?.toLowerCase() || ''
                return nomName.includes('╤Д╤А╨╡╨╖╨░') || detailsStr.includes('╤Д╤А╨╡╨╖╨░')
              })
              const plannedCuttersBreakdown = {}
              const snapshotCutters = Array.isArray(currentTask?.plan_snapshot?.consumables)
                ? currentTask.plan_snapshot.consumables.filter(item => String(item?.name || '').toLowerCase().includes('фреза'))
                : []
              const resolveSnapshotCutterName = item => {
                const selectedCutters = currentTask?.plan_snapshot?.selectedCutters || {}
                const selectedInvId = selectedCutters[item.name] || selectedCutters[String(item.name || '').toLowerCase()]
                const selectedInv = (inventory || []).find(inv => String(inv.id) === String(selectedInvId))
                const selectedNom = selectedInv ? (nomenclatures || []).find(n => String(n.id) === String(selectedInv.nomenclature_id)) : null
                return selectedNom?.name || selectedInv?.name || item.name || 'Фреза'
              }

              if (snapshotCutters.length > 0) {
                snapshotCutters.forEach(item => {
                  const name = resolveSnapshotCutterName(item)
                  plannedCuttersBreakdown[name] = (plannedCuttersBreakdown[name] || 0) + (Number(item.total) || 0)
                })
              } else {
                cutterRequests.forEach(r => {
                  const name = r.nomenclature?.name || '╨д╤А╨╡╨╖╨░'
                  const declaredQty = Number(String(r.details || '').match(/[—-]\s*(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.') || 0)
                  plannedCuttersBreakdown[name] = (plannedCuttersBreakdown[name] || 0) + (declaredQty || getRequestQty(r))
                })
              }

              const totalPlannedCutters = Object.values(plannedCuttersBreakdown).reduce((sum, qty) => sum + (Number(qty) || 0), 0)

              const actualCuttersBreakdown = {}
              const cuttingHistoryRows = reportData.historyRows.filter(row => String(row.stage_name || '').trim().startsWith('Розкрій'))
              cuttingHistoryRows.forEach(row => {
                const info = row.card_info || ''
                // Robust JSON extraction: find [CUTTERS_BREAKDOWN:{ ... }] using bracket counting
                const markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
                let parsed = null
                if (markerIdx !== -1) {
                  const jsonStart = info.indexOf('{', markerIdx)
                  if (jsonStart !== -1) {
                    let depth = 0
                    let jsonEnd = -1
                    for (let i = jsonStart; i < info.length; i++) {
                      if (info[i] === '{') depth++
                      else if (info[i] === '}') {
                        depth--
                        if (depth === 0) { jsonEnd = i; break }
                      }
                    }
                    if (jsonEnd !== -1) {
                      try {
                        parsed = JSON.parse(info.slice(jsonStart, jsonEnd + 1))
                      } catch (e) {
                        console.warn('Failed to parse cutters breakdown from card_info:', e, info.slice(jsonStart, jsonEnd + 1))
                      }
                    }
                  }
                }
                if (parsed) {
                  Object.entries(parsed).forEach(([cutterName, qty]) => {
                    actualCuttersBreakdown[cutterName] = (actualCuttersBreakdown[cutterName] || 0) + (Number(qty) || 0)
                  })
                } else if (Number(row.cutters_used) > 0) {
                  const plannedNames = Object.keys(plannedCuttersBreakdown)
                  if (plannedNames.length === 1) {
                    const name = plannedNames[0]
                    actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
                  } else if (plannedNames.length > 1) {
                    plannedNames.forEach(name => {
                      // Distribute proportionally by plan, or just add to generic key
                    })
                    const name = '╨д╤А╨╡╨╖╨░ (╨▒╨╡╨╖ ╨┤╨╡╤В╨░╨╗╨╡╨╣)'
                    actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
                  } else {
                    const name = '╨д╤А╨╡╨╖╨░'
                    actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
                  }
                }
              })

              const totalActualCutters = Object.keys(actualCuttersBreakdown).length > 0
                ? Object.values(actualCuttersBreakdown).reduce((sum, val) => sum + val, 0)
                : cuttingHistoryRows.reduce((sum, row) => sum + (Number(row.cutters_used) || 0), 0)

              const totalActualMs = reportData.historyRows.reduce((sum, row) => {
                if (row.started_at && row.completed_at && (row.stage_name === '╨а╨╛╨╖╨║╤А╤Ц╨╣' || row.stage_name === '╨а╨╛╨╖╨║╤А╤Ц╨╣ (╨┐╨╡╤А╨╡╨╖╨╝╤Ц╨╜╨║╨░)')) {
                  const diff = new Date(row.completed_at) - new Date(row.started_at)
                  return sum + (diff > 0 ? diff : 0)
                }
                return sum
              }, 0)
              const totalActualSeconds = Math.round(totalActualMs / 1000)

              const formatDurationHMS = (totalSeconds) => {
                if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return 'тАФ'
                const hours = Math.floor(totalSeconds / 3600)
                const minutes = Math.floor((totalSeconds % 3600) / 60)
                const seconds = Math.floor(totalSeconds % 60)
                const pad = (num) => String(num).padStart(2, '0')
                return `${pad(hours)}╨│╨╛╨┤. ${pad(minutes)}╤Е╨▓. ${pad(seconds)}╤Б`
              }

              let productNames = currentOrder?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
              if (!productNames && currentTask.plan_snapshot) {
                productNames = Object.values(currentTask.plan_snapshot)
                  .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
                  .filter(Boolean)
                  .join(', ')
              }

              return (
                <div>
                  <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '20px', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>
                          <Clock size={14} /> ╨Ч╨▓╤Ц╤В ╨┐╨╛ ╨▓╨╕╤А╨╛╨▒╨╜╨╕╤Ж╤В╨▓╤Г ╤Ж╨╡╤Е╤Г тДЦ1
                        </div>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>
                          ╨Э╨░╤А╤П╨┤ тДЦ{currentOrder?.order_num}{currentTask.batch_index ? `/${currentTask.batch_index}` : ''}
                        </h3>
                      </div>
                      <button
                        onClick={() => handleOpenReport(currentTask, currentOrder, reportData.taskCards, true)}
                        disabled={reportLoading}
                        style={{
                          background: '#1a1a24', border: '1px solid #3b82f640', color: '#3b82f6',
                          padding: '8px 14px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          boxShadow: '0 4px 12px rgba(59,130,246,0.1)'
                        }}
                      >
                        <RefreshCw size={12} className={reportLoading ? "animate-spin" : ""} /> ╨Ю╨Э╨Ю╨Т╨Ш╨в╨Ш ╨Ф╨Р╨Э╨Ж
                      </button>
                    </div>
                    <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '6px', fontWeight: 700 }}>
                      ╨Т╨╕╤А╤Ц╨▒: <strong style={{ color: '#ef4444' }} className="text-accent-red">{productNames || 'тАФ'}</strong>
                      {currentOrder?.customer && ` | ╨Ч╨░╨╝╨╛╨▓╨╜╨╕╨║: ${currentOrder.customer}`}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', marginBottom: '30px' }}>

                    {/*
                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>╨з╨░╤Б ╨▓╨╕╨║╨╛╨╜╨░╨╜╨╜╤П</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>╨Я╨╗╨░╨╜: <strong style={{ color: '#fff' }}>{currentTask.estimated_time ? formatDurationHMS(Number(currentTask.estimated_time) * 60) : 'тАФ'}</strong></div>
                        <div>╨д╨░╨║╤В: <strong style={{ color: '#3b82f6' }} className="text-accent-blue">{formatDurationHMS(totalActualSeconds)}</strong></div>
                      </div>
                    </div>
                    */}

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>╨д╤А╨╡╨╖╨╕ (╨а╨╛╨╖╨║╤А╤Ц╨╣)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
                          <span>╨Я╨╗╨░╨╜: <strong style={{ color: '#fff' }}>{totalPlannedCutters} ╤И╤В</strong></span>
                          <span>╨д╨░╨║╤В: <strong style={{ color: '#eab308' }} className="text-accent-orange">{totalActualCutters} ╤И╤В</strong></span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(() => {
                            const allCutterNames = Array.from(new Set([
                              ...Object.keys(plannedCuttersBreakdown),
                              ...Object.keys(actualCuttersBreakdown)
                            ]))
                            if (allCutterNames.length === 0) {
                              return <div style={{ fontSize: '0.65rem', color: '#444', textAlign: 'center' }}>╨Э╨╡╨╝╨░╤Ф ╨▓╨╕╤В╤А╨░╤В ╤Д╤А╨╡╨╖</div>
                            }
                            return allCutterNames.map(name => {
                              const planVal = plannedCuttersBreakdown[name] || 0
                              const factVal = actualCuttersBreakdown[name] || 0
                              const isExcess = factVal > planVal
                              return (
                                <div key={name} style={{ fontSize: '0.68rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                                  <div style={{ color: isExcess ? '#ef4444' : '#aaa', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name} className={isExcess ? 'text-accent-red' : ''}>
                                    {isExcess && 'тЪая╕П '}{name}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#888' }}>
                                    <span>╨Я╨╗╨░╨╜: <strong style={{ color: '#bbb' }}>{planVal} ╤И╤В</strong></span>
                                    <span>╨д╨░╨║╤В: <strong style={{ color: isExcess ? '#ef4444' : '#bbb' }} className={isExcess ? 'text-accent-red' : 'text-accent-orange'}>{factVal} ╤И╤В</strong></span>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>╨Ы╨╕╤Б╤В╨╕ (╨Ь╨░╤В╨╡╤А╤Ц╨░╨╗)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
                          <span>╨Я╨╗╨░╨╜: <strong style={{ color: '#fff' }}>{totalPlannedSheets} ╨╗.</strong></span>
                          <span>╨д╨░╨║╤В: <strong style={{ color: totalActualSheets > totalPlannedSheets ? '#ef4444' : '#10b981' }} className={totalActualSheets > totalPlannedSheets ? 'text-accent-red' : 'text-accent-green'}>{totalActualSheets} ╨╗.</strong></span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {Object.entries(materialStats).length > 0 ? (
                            Object.entries(materialStats).map(([matName, stats]) => {
                              const isExcess = stats.actualSheets > stats.plannedSheets
                              return (
                                <div key={matName} style={{ fontSize: '0.68rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                                  <div style={{ color: isExcess ? '#ef4444' : '#aaa', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={matName} className={isExcess ? 'text-accent-red' : ''}>
                                    {isExcess && 'тЪая╕П '}{matName}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#888' }}>
                                    <span>╨Я╨╗╨░╨╜: <strong style={{ color: '#bbb' }}>{stats.plannedSheets} ╨╗.</strong></span>
                                    <span>╨д╨░╨║╤В: <strong style={{ color: isExcess ? '#ef4444' : '#bbb' }} className={isExcess ? 'text-accent-red' : 'text-accent-green'}>{stats.actualSheets} ╨╗.</strong></span>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div style={{ color: '#444', fontSize: '0.65rem', fontStyle: 'italic' }}>╨Э╨╡╨╝╨░╤Ф ╨╖╨░╨┐╨╗╨░╨╜╨╛╨▓╨░╨╜╨╕╤Е ╨╝╨░╤В╨╡╤А╤Ц╨░╨╗╤Ц╨▓</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>╨Ф╨╡╤В╨░╨╗╤Ц ╤В╨░ ╨С╤А╨░╨║</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>╨Я╨╗╨░╨╜:</span>
                          <strong style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{totalPlannedParts} ╤И╤В</strong>
                        </div>

                        {/* ╨Я╤А╨╕╨╣╨╜╤П╤В╨╛: Clickable for breakdown */}
                        <div
                          onClick={() => setReportDetailModal('accepted')}
                          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                          onMouseLeave={e => e.currentTarget.style.opacity = 1}
                          title="╨Ъ╨╗╤Ц╨║╨╜╤Ц╤В╤М ╨┤╨╗╤П ╨┤╨╡╤В╨░╨╗╤Ц╨╖╨░╤Ж╤Ц╤Ч ╨┐╤А╨╕╨╣╨╜╤П╤В╨╕╤Е ╨┤╨╡╤В╨░╨╗╨╡╨╣"
                        >
                          <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>╨Я╤А╨╕╨╣╨╜╤П╤В╨╛:</span>
                          <strong
                            style={{
                              color: '#10b981',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              borderBottom: '1px dashed #10b981',
                              paddingBottom: '1px'
                            }}
                            className="text-accent-green"
                          >
                            {totalActualParts} ╤И╤В
                          </strong>
                        </div>

                        {/* ╨С╤А╨░╨║: Clickable for breakdown */}
                        <div
                          onClick={() => setReportDetailModal('scrap')}
                          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                          onMouseLeave={e => e.currentTarget.style.opacity = 1}
                          title="╨Ъ╨╗╤Ц╨║╨╜╤Ц╤В╤М ╨┤╨╗╤П ╨┤╨╡╤В╨░╨╗╤Ц╨╖╨░╤Ж╤Ц╤Ч ╨▒╤А╨░╨║╤Г ╨╖╨░ ╨╡╤В╨░╨┐╨░╨╝╨╕"
                        >
                          <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>╨С╤А╨░╨║:</span>
                          <strong
                            style={{
                              color: '#ef4444',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              borderBottom: '1px dashed #ef4444',
                              paddingBottom: '1px'
                            }}
                            className="text-accent-red"
                          >
                            {totalScrap} ╤И╤В
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>


                  {(() => {
                    const timeStats = {
                      totalShop1: 0,
                      stages: { 'Розкрій': { total: 0, count: 0 }, 'Галтовка': { total: 0, count: 0 }, 'Прийомка': { total: 0, count: 0 }, 'Сортування': { total: 0, count: 0 } },
                      buffers: { 'Буфер Розкрою': { total: 0, count: 0 }, 'Буфер Галтовки': { total: 0, count: 0 }, 'Буфер Прийомки': { total: 0, count: 0 }, 'Буфер Сортування': { total: 0, count: 0 } }
                    }

                    let firstStart = null
                    let lastCompleted = null

                    reportData.historyRows.forEach(row => {
                      if (row.started_at) {
                        const sTime = new Date(row.started_at)
                        if (!firstStart || sTime < firstStart) firstStart = sTime
                      }
                      if (row.completed_at) {
                        const cTime = new Date(row.completed_at)
                        if (!lastCompleted || cTime > lastCompleted) lastCompleted = cTime
                      }

                      if (row.started_at && row.completed_at) {
                        const diff = new Date(row.completed_at) - new Date(row.started_at)
                        const sec = diff > 0 ? Math.round(diff / 1000) : 0

                        if (timeStats.stages[row.stage_name]) {
                          timeStats.stages[row.stage_name].total += sec
                          timeStats.stages[row.stage_name].count += 1
                        } else if (row.stage_name?.startsWith('Галтовка')) {
                          timeStats.stages['Галтовка'].total += sec
                          timeStats.stages['Галтовка'].count += 1
                        } else if (timeStats.buffers[row.stage_name]) {
                          timeStats.buffers[row.stage_name].total += sec
                          timeStats.buffers[row.stage_name].count += 1
                        } else if (row.stage_name?.startsWith('Буфер Галтовки')) {
                          timeStats.buffers['Буфер Галтовки'].total += sec
                          timeStats.buffers['Буфер Галтовки'].count += 1
                        }
                      }
                    })

                    if (firstStart && lastCompleted) {
                      timeStats.totalShop1 = Math.max(0, Math.round((lastCompleted - firstStart) / 1000))
                    }

                    const totalActiveSec = Object.values(timeStats.stages).reduce((sum, s) => sum + s.total, 0)
                    const totalBufferSec = Object.values(timeStats.buffers).reduce((sum, b) => sum + b.total, 0)
                    const activeCardIds = new Set(reportData.historyRows.map(h => h.card_id))
                    const numCards = activeCardIds.size || reportData.taskCards.length || 1

                    return (
                      <div style={{ background: '#111', border: '1px solid #222', borderRadius: '20px', padding: '20px', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px' }}>
                          <Clock size={14} /> Аналітика перебування деталей в Цеху №1
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Загальний час у Цеху №1</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#10b981' }} className="text-accent-green">
                              {timeStats.totalShop1 > 0 ? formatDurationHMS(timeStats.totalShop1) : '—'}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '4px', borderBottom: '1px solid #222', paddingBottom: '8px', width: '100%' }}>Від першого розкрою до передачі в Цех №2</div>

                            <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '8px', width: '100%', display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'left' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#888' }}>Сер. робота / картку:</span>
                                <strong style={{ color: '#3b82f6' }} className="text-accent-blue">{formatDurationHMS(Math.round(totalActiveSec / numCards))}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#888' }}>Сер. буфер / картку:</span>
                                <strong style={{ color: '#f59e0b' }} className="text-accent-orange">{formatDurationHMS(Math.round(totalBufferSec / numCards))}</strong>
                              </div>
                            </div>
                          </div>

                          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px' }}>
                            <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #111', paddingBottom: '4px' }}>Робочі етапи (Активна робота)</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                              {Object.entries(timeStats.stages).filter(([name]) => name !== 'Прийомка').map(([name, s]) => (
                                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: '#aaa', fontWeight: 600 }}>{name}:</span>
                                  <strong style={{ color: '#3b82f6' }} className="text-accent-blue">{s.total > 0 ? formatDurationHMS(s.total) : '00год. 00хв. 00с'}</strong>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px' }}>
                            <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #111', paddingBottom: '4px' }}>Буфери накопичення (Зараз)</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                              {['Розкрій', 'Галтовка', 'Прийомка', 'Сортування'].map(stageName => {
                                const bufCards = workCards.filter(c =>
                                  String(c.task_id) === String(currentTask.id) &&
                                  c.status === 'at-buffer' &&
                                  (stageName === 'Галтовка' ? c.operation?.startsWith('Галтовка') : c.operation === stageName)
                                )
                                const totalQty = bufCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                                const cardCount = bufCards.length
                                const bufferNameMap = { 'Розкрій': 'Буфер Розкрою', 'Галтовка': 'Буфер Галтовки', 'Прийомка': 'Буфер Прийомки', 'Сортування': 'Буфер Сортування' }
                                const bufKey = bufferNameMap[stageName]
                                const bufferTotal = timeStats.buffers[bufKey]?.total || 0
                                return (
                                  <div key={stageName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #151515', paddingBottom: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ color: '#aaa', fontWeight: 600 }}>Буфер {stageName}:</span>
                                      {cardCount > 0 && (
                                        <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                          Зараз: {totalQty} шт
                                        </span>
                                      )}
                                    </div>
                                    <strong style={{ color: '#f59e0b' }} className="text-accent-orange">
                                      {bufferTotal > 0 ? formatDurationHMS(bufferTotal) : '00год. 00хв. 00с'}
                                    </strong>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Хронологічний лог етапів
                    </h4>

                    <div style={{ display: 'flex', gap: '4px', background: '#0a0a0a', padding: '4px', borderRadius: '10px', border: '1px solid #222' }} className="no-print">
                      {['All', 'Розкрій', 'Галтовка', 'Прийомка', 'Сортування'].map(stage => {
                        const isSelected = reportStageFilter === stage
                        let color = '#555'
                        let bg = 'transparent'
                        if (isSelected) {
                          color = '#fff'
                          bg = stage === 'All' ? '#222' : stage === 'Розкрій' ? '#3b82f6' : stage === 'Галтовка' ? '#eab308' : '#10b981'
                        }
                        const labelMap = { 'All': 'Всі етапи', 'Розкрій': 'Розкрій', 'Галтовка': 'Галтовка', 'Прийомка': 'Прийомка', 'Сортування': 'Сортування' }
                        return (
                          <button
                            key={stage}
                            onClick={() => {
                              setReportStageFilter(stage);
                              setReportOperatorFilter('All');
                            }}
                            style={{
                              border: 'none', background: bg, color: isSelected ? (stage === 'All' ? '#fff' : '#000') : color,
                              padding: '5px 12px', borderRadius: '7px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.15s ease', textTransform: 'uppercase',
                              boxShadow: isSelected && stage !== 'All' ? `0 2px 8px ${bg}44` : 'none'
                            }}
                          >
                            {labelMap[stage]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Контролі фільтрації за номенклатурою та сортування */}
                  {(
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' }} className="no-print">
                      {/* Вибір номенклатури */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Деталь:</span>
                        <select
                          value={reportNomFilter}
                          onChange={e => setReportNomFilter(e.target.value)}
                          style={{
                            background: '#111',
                            border: '1px solid #333',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="All">Всі деталі</option>
                          {(() => {
                            const uniqueNoms = [];
                            (reportData.historyRows || []).forEach(row => {
                              if (row.nomenclature_id && !uniqueNoms.includes(row.nomenclature_id)) {
                                uniqueNoms.push(row.nomenclature_id)
                              }
                            });
                            return uniqueNoms.map(nomId => {
                              const nom = nomenclatures.find(n => String(n.id) === String(nomId))
                              return (
                                <option key={nomId} value={nomId}>
                                  {nom?.name || `ID: ${nomId}`}
                                </option>
                              )
                            })
                          })()}
                        </select>
                      </div>

                      {/* Сортування */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Сортування:</span>
                        <select
                          value={reportSortBy}
                          onChange={e => {
                            setReportSortBy(e.target.value);
                            if (e.target.value !== 'operator') {
                              setReportOperatorFilter('All');
                            }
                          }}
                          style={{
                            background: '#111',
                            border: '1px solid #333',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="date">По даті (за замовчуванням)</option>
                          <option value="min-time">Найменший час</option>
                          <option value="max-time">Найбільший час</option>
                          <option value="operator">По оператору</option>
                          <option value="scrap">По кількості браку</option>
                        </select>
                      </div>

                      {/* Вибір оператора (тільки коли сортуємо за оператором) */}
                      {reportSortBy === 'operator' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Оператор:</span>
                          <select
                            value={reportOperatorFilter}
                            onChange={e => setReportOperatorFilter(e.target.value)}
                            style={{
                              background: '#111',
                              border: '1px solid #333',
                              color: '#fff',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="All">Всі оператори</option>
                            {(() => {
                              const uniqueOps = [];
                              (reportData.historyRows || []).forEach(row => {
                                let stageMatch = false
                                if (reportStageFilter === 'All') stageMatch = true
                                else if (reportStageFilter === 'Прийомка') {
                                  stageMatch = row.stage_name === 'Прийомка' || row.stage_name === 'completed'
                                } else {
                                  stageMatch = row.stage_name === reportStageFilter
                                }
                                if (!stageMatch) return

                                if (row.operator_name && !uniqueOps.includes(row.operator_name)) {
                                  uniqueOps.push(row.operator_name)
                                }
                              });
                              return uniqueOps.map(opName => (
                                <option key={opName} value={opName}>
                                  {opName}
                                </option>
                              ))
                            })()}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    let processedRows = (reportData.historyRows || []).filter(row => {
                      // Stage filter
                      let stageMatch = false
                      if (reportStageFilter === 'All') stageMatch = true
                      else if (reportStageFilter === 'Прийомка') {
                        stageMatch = row.stage_name === 'Прийомка' || row.stage_name === 'completed'
                      } else {
                        stageMatch = row.stage_name === reportStageFilter
                      }
                      if (!stageMatch) return false

                      // Nomenclature filter
                      if (reportNomFilter !== 'All' && String(row.nomenclature_id) !== String(reportNomFilter)) {
                        return false
                      }

                      // Operator filter
                      if (reportSortBy === 'operator' && reportOperatorFilter !== 'All' && row.operator_name !== reportOperatorFilter) {
                        return false
                      }
                      return true
                    })

                    // Sorting logic
                    processedRows.sort((a, b) => {
                      if (reportSortBy === 'date') {
                        return new Date(a.started_at || a.created_at) - new Date(b.started_at || b.created_at)
                      }
                      if (reportSortBy === 'min-time') {
                        const durA = a.started_at && a.completed_at ? (new Date(a.completed_at) - new Date(a.started_at)) : 0
                        const durB = b.started_at && b.completed_at ? (new Date(b.completed_at) - new Date(b.started_at)) : 0
                        return durA - durB
                      }
                      if (reportSortBy === 'max-time') {
                        const durA = a.started_at && a.completed_at ? (new Date(a.completed_at) - new Date(a.started_at)) : 0
                        const durB = b.started_at && b.completed_at ? (new Date(b.completed_at) - new Date(b.started_at)) : 0
                        return durB - durA
                      }
                      if (reportSortBy === 'operator') {
                        return String(a.operator_name || '').localeCompare(String(b.operator_name || ''))
                      }
                      if (reportSortBy === 'scrap') {
                        return (Number(b.scrap_qty) || 0) - (Number(a.scrap_qty) || 0)
                      }
                      return 0
                    })

                    if (processedRows.length === 0) {
                      return (
                        <div style={{ padding: '30px', textAlign: 'center', background: '#111', borderRadius: '16px', color: '#555', fontSize: '0.85rem' }}>
                          Операцій для обраних фільтрів ще не проводилось.
                        </div>
                      )
                    }

                    return (
                      <div style={{ background: '#111', borderRadius: '18px', overflowX: 'auto', border: '1px solid #222' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '850px' }}>
                          <thead>
                            <tr style={{ background: '#161616', color: '#888', textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 900, borderBottom: '1px solid #222' }}>
                              <th style={{ padding: '12px 15px' }}>Деталь / Картка</th>
                              <th style={{ padding: '12px 15px' }}>Час (початок / завершення)</th>
                              <th style={{ padding: '12px 15px', textAlign: 'center' }}>План. час</th>
                              <th style={{ padding: '12px 15px', textAlign: 'center' }}>Факт. час</th>
                              <th style={{ padding: '12px 15px' }}>Етап</th>
                              <th style={{ padding: '12px 15px' }}>Оператор / Зміна</th>
                              <th style={{ padding: '12px 15px' }}>Робоче місце</th>
                              <th style={{ padding: '12px 15px', textAlign: 'center' }}>Готово / Брак</th>
                              <th style={{ padding: '12px 15px', textAlign: 'center' }}>Фрези</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processedRows.map((row, idx) => {
                              const startTime = row.started_at
                                ? new Date(row.started_at).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })
                                : '—'
                              const completedTime = row.completed_at
                                ? new Date(row.completed_at).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })
                                : '—'

                              const card = reportData.taskCards.find(c => c.id === row.card_id)
                              const planSec = card?.estimated_time || 0
                              const planStr = planSec > 0 ? formatDurationHMS(planSec) : '—'

                              let actualSeconds = 0
                              if (row.started_at && row.completed_at) {
                                const diff = new Date(row.completed_at) - new Date(row.started_at)
                                actualSeconds = Math.max(0, Math.round(diff / 1000))
                              }
                              const factStr = actualSeconds > 0 ? formatDurationHMS(actualSeconds) : '—'

                              const nom = nomenclatures.find(n => n.id === row.nomenclature_id)
                              const seqMatch = (row.card_info || card?.card_info || '').match(/(\d+\/\d+)/)
                              const seqStr = seqMatch ? seqMatch[1] : `ID: #${row.card_id?.slice(-8).toUpperCase()}`

                              return (
                                <tr key={row.id || idx} style={{ borderBottom: idx < processedRows.length - 1 ? '1px solid #222' : 'none' }}>
                                  <td style={{ padding: '12px 15px' }}>
                                    <div style={{ fontWeight: 800, color: '#fff' }}>{nom?.name || '—'}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>Картка {seqStr}</div>
                                  </td>
                                  <td style={{ padding: '12px 15px' }}>
                                    <div style={{ color: '#888', fontWeight: 600 }}>{startTime}</div>
                                    <div style={{ color: '#aaa', fontWeight: 700, marginTop: '2px' }}>{completedTime}</div>
                                  </td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center', color: '#fff', fontWeight: 700 }}>{planStr}</td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center', color: '#3b82f6', fontWeight: 700 }}>{factStr}</td>
                                  <td style={{ padding: '12px 15px' }}>
                                    <span
                                      className={`stage-badge stage-${row.stage_name.startsWith('Буфер') ? 'buffer' :
                                        row.stage_name === 'Розкрій' ? 'cutting' :
                                          row.stage_name === 'Галтовка' ? 'tumbling' :
                                            (row.stage_name === 'Прийомка' || row.stage_name === 'completed') ? 'reception' : 'sorting'
                                        }`}
                                      style={{
                                        background: row.stage_name.startsWith('Буфер') ? '#a78bfa1e' : row.stage_name === 'Розкрій' ? '#3b82f61a' : row.stage_name === 'Галтовка' ? '#eab3081a' : row.stage_name === 'Прийомка' || row.stage_name === 'completed' ? '#10b9811a' : '#14b8a61a',
                                        color: row.stage_name.startsWith('Буфер') ? '#a78bfa' : row.stage_name === 'Розкрій' ? '#3b82f6' : row.stage_name === 'Галтовка' ? '#eab308' : row.stage_name === 'Прийомка' || row.stage_name === 'completed' ? '#10b981' : '#14b8a6',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 900,
                                        fontSize: '0.7rem',
                                        border: row.stage_name.startsWith('Буфер') ? '1px solid #a78bfa33' : 'none'
                                      }}
                                    >
                                      {row.stage_name === 'completed' ? 'Прийомка' : row.stage_name}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 15px' }}>
                                    <div style={{ color: '#fff', fontWeight: 800 }}>{row.operator_name}</div>
                                    <div style={{ color: '#555', fontSize: '0.65rem' }}>{row.shift_name}</div>
                                    {(() => {
                                      const replacedMatch = row.card_info?.match(/\[REPLACED_BY:(.*?)\]/)
                                      if (replacedMatch) {
                                        return (
                                          <div style={{ color: '#f59e0b', fontSize: '0.65rem', marginTop: '4px', fontWeight: 700 }}>
                                            ↳ Замінено на: {replacedMatch[1]}
                                          </div>
                                        )
                                      }
                                      return null
                                    })()}
                                  </td>
                                  <td style={{ padding: '12px 15px', color: '#888' }}>
                                    {row.machine_name || row.machine || '—'}
                                  </td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                    <strong style={{ color: '#10b981' }}>{row.qty_completed} шт</strong>
                                    {Number(row.scrap_qty) > 0 && (
                                      <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '2px', fontWeight: 700 }}>брак: {row.scrap_qty} шт</div>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center', color: row.cutters_used > 0 ? '#eab308' : '#444', fontWeight: 900 }}>
                                    {row.cutters_used > 0 ? `${row.cutters_used} шт` : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}

                  <div style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }} className="print-actions-row">
                    <button
                      onClick={() => window.print()}
                      style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <Printer size={14} /> Друкувати звіт
                    </button>
                    <button
                      onClick={() => setShowReportModal(false)}
                      style={{
                        background: '#222',
                        color: '#fff',
                        border: '1px solid #333',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Закрити
                    </button>
                  </div>
                </div>
              )
            })() : null}
          </div>

          {/* ───── ДЕТАЛІЗАЦІЯ ПРИЙНЯТОГО / БРАКУ (no-print) ───── */}
          {reportDetailModal && (
            <div
              className="no-print"
              onClick={() => setReportDetailModal(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                zIndex: 45000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#0d0d0d',
                  border: '1px solid #222',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '550px',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  padding: '25px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                  position: 'relative',
                  color: '#fff'
                }}
              >
                {/* Close button */}
                <button
                  onClick={() => setReportDetailModal(null)}
                  style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    background: '#222',
                    border: 'none',
                    color: '#fff',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>

                {reportDetailModal === 'accepted' ? (() => {
                  const acceptedMap = {}
                  const acceptedRows = (reportData?.historyRows || []).filter(h => h.stage_name === 'Прийомка' || h.stage_name === 'completed')

                  acceptedRows.forEach(row => {
                    const nomId = String(row.nomenclature_id)
                    if (!acceptedMap[nomId]) {
                      const nom = nomenclatures.find(n => String(n.id) === nomId)
                      acceptedMap[nomId] = {
                        name: nom?.name || 'Невідома деталь',
                        code: nom?.nomenclature_code || 'БЕЗ КОДУ',
                        qty: 0
                      }
                    }
                    acceptedMap[nomId].qty += (Number(row.qty_completed) || 0)
                  })

                  const items = Object.values(acceptedMap).sort((a, b) => b.qty - a.qty)

                  return (
                    <div>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                        <CheckCircle2 size={20} /> Деталізація прийнятих деталей
                      </h3>
                      {items.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Деталей ще не прийнято</div>
                      ) : (
                        <div style={{ background: '#111', borderRadius: '14px', border: '1px solid #222', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: '#161616', color: '#666', borderBottom: '1px solid #222', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                <th style={{ padding: '10px 12px' }}>Деталь</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Прийнято</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                                  <td style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 800, color: '#fff' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>{item.code}</div>
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: '0.9rem' }}>
                                    {item.qty} шт
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })() : (() => {
                  const scrapRows = (reportData?.historyRows || []).filter(h => (Number(h.scrap_qty) || 0) > 0)

                  const items = scrapRows.map(row => {
                    const nom = nomenclatures.find(n => String(n.id) === String(row.nomenclature_id))
                    const dateStr = row.completed_at
                      ? new Date(row.completed_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(row.completed_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
                      : '—'
                    return {
                      name: nom?.name || 'Невідома деталь',
                      code: nom?.nomenclature_code || 'БЕЗ КОДУ',
                      stage: row.stage_name === 'completed' ? 'Прийомка' : row.stage_name,
                      qty: Number(row.scrap_qty) || 0,
                      operator: row.operator_name || '—',
                      shift: row.shift_name || '—',
                      machine: row.machine_name || '—',
                      time: dateStr
                    }
                  }).sort((a, b) => b.qty - a.qty)

                  return (
                    <div>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                        <AlertTriangle size={20} /> Деталізація браку за етапами
                      </h3>
                      {items.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Бракованих деталей немає</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {items.map((item, idx) => (
                            <div key={idx} style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '15px' }}>
                                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.8rem' }}>{item.name}</div>
                                <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>{item.code}</div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '0.65rem', color: '#888', flexWrap: 'wrap' }}>
                                  <span>Етап: <strong style={{ color: '#aaa' }}>{item.stage}</strong></span>
                                  {item.machine && item.machine !== '—' && (
                                    <span>Верстат: <strong style={{ color: '#aaa' }}>{item.machine}</strong></span>
                                  )}
                                  <span>Оператор: <strong style={{ color: '#aaa' }}>{item.operator}</strong></span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '1rem' }}>+{item.qty} шт</div>
                                <div style={{ fontSize: '0.6rem', color: '#444', marginTop: '2px' }}>{item.time}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <button
                  onClick={() => setReportDetailModal(null)}
                  style={{
                    width: '100%',
                    background: '#222',
                    color: '#fff',
                    border: '1px solid #333',
                    padding: '12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 800,
                    marginTop: '20px',
                    fontSize: '0.85rem',
                    transition: '0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#333'}
                  onMouseLeave={e => e.currentTarget.style.background = '#222'}
                >
                  Закрити
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───── ВІДДІЛЕНИЙ ПІДМОДУЛЬ ЗМІНИ ВЕРСТАТА ───── */}
      <MachineChangeModal
        isOpen={!!machineChange.changeNomMachineTaskId || (!!changeNomMachineTaskId && !!changeNomMachineNomId)}
        task={(tasks || []).find(t => t.id === (machineChange.changeNomMachineTaskId || changeNomMachineTaskId))}
        partId={machineChange.changeNomMachineNomId || changeNomMachineNomId}
        partName={machineChange.changeNomMachineName || changeNomMachineName}
        initialMachine={machineChange.selectedNomNewMachine || selectedNomNewMachine}
        machines={machines || []}
        machineOperations={machineOperations || []}
        nomenclatures={nomenclatures || []}
        inventory={inventory || []}
        workCards={workCards || []}
        archiveCards={archiveCards || []}
        isChanging={machineChange.isChangingMachine || isChangingMachine}
        onClose={() => {
          machineChange.setChangeNomMachineTaskId(null)
          machineChange.setChangeNomMachineNomId(null)
          if (typeof setChangeNomMachineTaskId === 'function') setChangeNomMachineTaskId(null)
          if (typeof setChangeNomMachineNomId === 'function') setChangeNomMachineNomId(null)
        }}
        onConfirm={async (selectedMachine, resolvedSelections, safeNomLoadCapacity) => {
          const targetTaskId = machineChange.changeNomMachineTaskId || changeNomMachineTaskId
          const targetNomId = machineChange.changeNomMachineNomId || changeNomMachineNomId
          const targetTask = (tasks || []).find(t => t.id === targetTaskId)
          await machineChange.handleUpdateNomenclatureMachineAndRecalculate(
            targetTask,
            targetNomId,
            selectedMachine,
            null,
            resolvedSelections,
            safeNomLoadCapacity
          )
          machineChange.setChangeNomMachineTaskId(null)
          machineChange.setChangeNomMachineNomId(null)
          if (typeof setChangeNomMachineTaskId === 'function') setChangeNomMachineTaskId(null)
          if (typeof setChangeNomMachineNomId === 'function') setChangeNomMachineNomId(null)
        }}
      />


      {/* ───── КАСТОМНЕ МОДАЛЬНЕ ВІКНО СПОВІЩЕННЯ ───── */}
      {customAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', zIndex: 30000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '32px', border: '1px solid #222', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', marginBottom: '20px' }}>
              <CheckCircle2 size={30} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 950, margin: '0 0 15px 0', textTransform: 'uppercase', letterSpacing: '1px', color: '#fff' }}>
              {customAlert.title}
            </h2>
            <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '30px', whiteSpace: 'pre-line' }}>
              {customAlert.message}
            </p>

            <button
              onClick={() => setCustomAlert(null)}
              style={{
                width: '100%', background: '#3b82f6', color: '#fff', padding: '15px 0',
                borderRadius: '16px', fontSize: '0.95rem', fontWeight: 950, cursor: 'pointer',
                border: 'none', textTransform: 'uppercase', letterSpacing: '1px',
                boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)'
              }}
            >
              ЗРОЗУМІЛО
            </button>
          </div>
        </div>
      )}

      {isChangingMachine && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <Loader2 size={60} color="#3b82f6" className="animate-spin" />
          <h2 style={{ fontWeight: 900, textTransform: 'uppercase' }}>Перерахунок фрез та перебронювання...</h2>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            filter: none !important;
            -webkit-filter: none !important;
          }
          html, body { 
            background: #fff !important; 
            background-color: #fff !important; 
            color: #000 !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          .module-nav,
          .master-grid {
            display: none !important;
          }
          
          /* Hide normal workplace containers */
          .foreman-module {
            background: #fff !important;
            background-color: #fff !important;
            color: #000 !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          
          /* Show print queue elements or report backdrop */
          .a4-page {
            box-shadow: none !important;
            margin: 0 !important;
            height: 296mm !important;
            page-break-after: always;
            page-break-inside: avoid !important;
          }
          .a4-page:last-child,
          .a4-page:last-of-type {
            page-break-after: avoid !important;
          }
          
          .print-overlay { 
            position: static !important; 
            background: #fff !important; 
            padding: 0 !important; 
            overflow: visible !important; 
          }
          
          /* Modal Backdrop Reset */
          .report-modal-backdrop {
            position: static !important;
            background: #fff !important;
            background-color: #fff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          /* Printable Report styling */
          .printable-report-area {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            background: #fff !important;
            background-color: #fff !important;
            color: #000 !important;
            padding: 15mm 20mm !important; /* Beautiful A4 margins inside container to prevent printer clipping */
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            display: block !important;
          }
          
          /* Dark to Light Print Mapping */
          .printable-report-area div, 
          .printable-report-area table, 
          .printable-report-area tr, 
          .printable-report-area td, 
          .printable-report-area th, 
          .printable-report-area h3, 
          .printable-report-area h4, 
          .printable-report-area strong, 
          .printable-report-area span {
            background: transparent !important;
            color: #000 !important;
            border-color: #ddd !important;
            box-shadow: none !important;
          }
          .printable-report-area strong {
            border-bottom: none !important;
            text-decoration: none !important;
          }
          
          /* Printable Accent Colors with high specificity */
          .printable-report-area .text-accent-blue,
          .printable-report-area strong.text-accent-blue,
          .printable-report-area span.text-accent-blue,
          .printable-report-area div.text-accent-blue {
            color: #1d4ed8 !important;
          }
          .printable-report-area .text-accent-green,
          .printable-report-area strong.text-accent-green,
          .printable-report-area span.text-accent-green,
          .printable-report-area div.text-accent-green {
            color: #047857 !important;
          }
          .printable-report-area .text-accent-orange,
          .printable-report-area strong.text-accent-orange,
          .printable-report-area span.text-accent-orange,
          .printable-report-area div.text-accent-orange {
            color: #b45309 !important;
          }
          .printable-report-area .text-accent-red,
          .printable-report-area strong.text-accent-red,
          .printable-report-area span.text-accent-red,
          .printable-report-area div.text-accent-red {
            color: #b91c1c !important;
          }
          
          /* Printable stage badges in history log */
          .printable-report-area span.stage-badge {
            background: #f3f4f6 !important;
            border: 1px solid #d1d5db !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
          }
          .printable-report-area span.stage-badge.stage-buffer { color: #6d28d9 !important; border-color: #c084fc !important; background: #faf5ff !important; }
          .printable-report-area span.stage-badge.stage-cutting { color: #1d4ed8 !important; border-color: #93c5fd !important; background: #eff6ff !important; }
          .printable-report-area span.stage-badge.stage-tumbling { color: #b45309 !important; border-color: #fde047 !important; background: #fefce8 !important; }
          .printable-report-area span.stage-badge.stage-reception { color: #047857 !important; border-color: #6ee7b7 !important; background: #ecfdf5 !important; }
          .printable-report-area span.stage-badge.stage-sorting { color: #0f766e !important; border-color: #5eead4 !important; background: #f0fdfa !important; }
          
          /* Hide UI actions on printout */
          .printable-report-area .print-actions-row {
            display: none !important;
          }
          .printable-report-area .close-btn-print {
            display: none !important;
          }
          
          /* SVG icons print adaptation */
          .printable-report-area svg {
            color: inherit !important;
            stroke: currentColor !important;
          }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .side-panel {
          width: 300px;
        }
        .mobile-only { display: none; }

        @media screen and (max-width: 1024px) {
          .hide-mobile { display: none !important; }
          .mobile-only { display: block !important; }
          .master-grid { display: block !important; }
          .side-panel { 
            position: fixed; 
            left: 0; 
            top: 0; 
            bottom: 0; 
            z-index: 100000; 
            transform: translateX(-100%); 
            width: 280px !important; 
            height: 100% !important;
          }
          .side-panel.drawer-open { transform: translateX(0); }
          .content-panel { padding: 15px !important; }
          
          /* Scale down headers on mobile/tablets */
          h2 {
            font-size: 1.8rem !important;
          }
        }
        .archive-card-hover:hover { border-color: #ef4444 !important; background: #1a1a1a !important; }
      `}} />
    </div>
  )
}

export default ForemanWorkplace
