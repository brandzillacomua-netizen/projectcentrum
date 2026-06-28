import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Factory, ListTodo, Loader2, X, Printer, LayoutDashboard, Layers, User, Clock, Package, Scan, CheckCircle2, AlertTriangle, Camera, Tablet, Menu, Shuffle } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const getDisplayMaterial = (partNom, snapshot) => {
  const baseMat = partNom?.material_type || '—'
  if (!snapshot) return baseMat
  const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
  const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0

  const isDefaultT700 = (baseMat || '').toLowerCase().includes('т700') || (baseMat || '').toLowerCase().includes('t700')

  // If we have custom sheets in snapshot
  if (snapshot.sheets_t300 !== undefined || snapshot.sheets_t700 !== undefined) {
    if (s700 > 0 && s300 === 0) {
      return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
    }
    if (s300 > 0 && s700 > 0) {
      return baseMat.replace(/т300/gi, 'Т300+Т700').replace(/t300/gi, 'Т300+Т700')
    }
    if (s300 > 0 && s700 === 0) {
      return baseMat.replace(/т700/gi, 'Т300').replace(/t700/gi, 'Т300')
    }
  } else if (isDefaultT700) {
    return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
  }

  return baseMat
}

const ForemanWorkplace = () => {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { tasks, orders, workCards, createWorkCard, createWorkCardsBatch, inventory, completeTaskByMaster, nomenclatures, bomItems, machines, machineOperations, workCardHistory, confirmBuffer, fetchData, reserveBZForTask, fetchTaskArchiveCards, fetchModuleData, machineCalls, currentUser, createDovyпускMaterialRequests } = useMES()

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

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Майстер зміни'
    const { error } = await supabase
      .from('machine_calls')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolverName
      })
      .eq('id', callId)
    if (error) {
      alert('Помилка при вирішенні виклику: ' + error.message)
    }
  }

  const [activeTaskId, setActiveTaskId] = useState(() => {
    return location.state?.taskId || localStorage.getItem('foreman_active_task_id') || null
  })
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('foreman_active_view') || 'worksheet'
  })

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
  const [selectedMachines, setSelectedMachines] = useState({})
  const [rowCapacities, setRowCapacities] = useState({})
  const [editingSplits, setEditingSplits] = useState({}) // { nomId: [{machine, qty}] }
  const saveTimeoutRef = useRef(null)
  const [genModal, setGenModal] = useState(null)
  const [printQueue, setPrintQueue] = useState(null)
  const [partialCounts, setPartialCounts] = useState({}) // For partial generation in modal
  const [isGenerating, setIsGenerating] = useState(false)
  const generatingLockRef = useRef(false)
  const [isCompletingTask, setIsCompletingTask] = useState(false) // Захист від подвійного кліку "ВИКОНАНО"
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  const [expandedGroups, setExpandedGroups] = useState({})

  // Звіти по наряду
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTaskId, setReportTaskId] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [reportStageFilter, setReportStageFilter] = useState('All')
  const [reportDetailModal, setReportDetailModal] = useState(null) // 'accepted' | 'scrap' | null

  const [printNaryadQueue, setPrintNaryadQueue] = useState(null)
  const [naryadPrintLoading, setNaryadPrintLoading] = useState(false)

  const handleOpenReport = async (task, order, taskCards) => {
    setReportTaskId(task.id)
    setShowReportModal(true)
    setReportStageFilter('All')

    // Check if we have a cached report snapshot in the plan_snapshot
    const cached = task?.plan_snapshot?._report_snapshot
    if (cached) {
      setReportData(cached)
      // If the task is completed, we don't need to refresh it at all! It's final.
      if (task.status === 'completed') {
        setReportLoading(false)
        return
      }
    }

    setReportLoading(true)
    if (!cached) {
      setReportData(null)
    }

    try {
      // 1. Fetch material requests for this task to determine planned cutters/consumables
      const { data: materialRequests, error: reqError } = await supabase
        .from('material_requests')
        .select('*, nomenclature:nomenclatures(*)')
        .eq('task_id', task.id)

      if (reqError) console.warn('Error fetching material requests:', reqError.message)

      // 2. Fetch ALL card IDs for this task directly from DB
      const { data: allTaskCardsDB } = await supabase
        .from('work_cards')
        .select('id')
        .eq('task_id', task.id)

      const stateCardIds = taskCards.map(c => c.id)
      const dbCardIds = (allTaskCardsDB || []).map(c => c.id)
      const allCardIds = [...new Set([...stateCardIds, ...dbCardIds])]

      console.log('[Report] task:', task.id, '| stateCards:', stateCardIds.length, '| dbCards:', dbCardIds.length, '| total:', allCardIds.length)

      if (allCardIds.length === 0) {
        const finalData = { historyRows: [], taskCards, materialRequests: materialRequests || [] }
        setReportData(finalData)
        setReportLoading(false)
        return
      }

      // 3. Fetch all work_card_history rows for ALL cards of this task
      const { data: historyRows, error } = await supabase
        .from('work_card_history')
        .select('*')
        .in('card_id', allCardIds)
        .order('completed_at', { ascending: true })

      if (error) throw error

      const finalData = { historyRows: historyRows || [], taskCards, materialRequests: materialRequests || [] }
      setReportData(finalData)

      // Save to cache in the database
      const updatedSnapshot = {
        ...(task.plan_snapshot || {}),
        _report_snapshot: finalData
      }

      await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
    } catch (e) {
      console.error(e)
      if (!cached) {
        alert('Помилка завантаження звіту: ' + e.message)
      }
    } finally {
      setReportLoading(false)
    }
  }

  const handleOpenNaryadPrint = async (task, order) => {
    setNaryadPrintLoading(true)
    try {
      // Fetch material requests for this task to determine planned cutters/consumables
      const { data: materialRequests, error: reqError } = await supabase
        .from('material_requests')
        .select('*, nomenclature:nomenclatures(*)')
        .eq('task_id', task.id)

      if (reqError) console.warn('Error fetching material requests:', reqError.message)

      setPrintNaryadQueue({
        task,
        order,
        materialRequests: materialRequests || []
      })
    } catch (e) {
      console.error(e)
      alert('Помилка завантаження даних наряду: ' + e.message)
    } finally {
      setNaryadPrintLoading(false)
    }
  }

  const [isBufferScanning, setIsBufferScanning] = useState(false)
  const [bufferScrapModal, setBufferScrapModal] = useState(null)
  const [bufferScrapCounts, setBufferScrapCounts] = useState({})
  const [archiveCards, setArchiveCards] = useState([]) // Завершені картки (статус completed) для поточного наряду
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
  // ── Instant-from-cache shortage map (no flicker on reload) ──
  const SHORTAGE_CACHE_KEY = 'foreman_shortage_map_v1'
  const [cachedShortageMap, setCachedShortageMap] = useState(() => {
    try {
      const raw = localStorage.getItem('foreman_shortage_map_v1')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  // Load foreman-specific data (workCards, inventory, requests) immediately on mount
  useEffect(() => { fetchModuleData('foreman') }, [])

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

    supabase
      .from('work_cards')
      .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
      .in('task_id', taskIds)
      .then(async ({ data: cardsData, error: cardsError }) => {
        if (cardsError) {
          console.error('Error fetching cards for static progress:', cardsError);
          return;
        }
        
        // Filter out completed ones to update staticCompletedCards state (reactive split)
        const completedCards = (cardsData || []).filter(c => c.status === 'completed');
        setStaticCompletedCards(completedCards);

        // Fetch history for ALL cards (completed and active) to ensure scrap quantities are 100% accurate
        // Chunk size 100 to avoid PostgREST URL length limits with large .in() arrays
        const cardIds = (cardsData || []).map(c => c.id);
        if (cardIds.length > 0) {
          const chunkSize = 100;
          const promises = [];
          for (let i = 0; i < cardIds.length; i += chunkSize) {
            const chunk = cardIds.slice(i, i + chunkSize);
            promises.push(
              supabase
                .from('work_card_history')
                .select('id, card_id, nomenclature_id, scrap_qty')
                .in('card_id', chunk)
                .limit(5000)
            );
          }
          const results = await Promise.all(promises);
          const historyData = results.flatMap(res => res.data || []);
          setStaticHistory(historyData);
        } else {
          setStaticHistory([]);
        }
      });
  }, [tasks]);

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



  // ── Compute production, scrap, and redo caches in memory ──────────────
  const { productionCache, scrapCache, redoCache, allCardsCache, cardScrapCache } = useMemo(() => {
    const prodCache = {};
    const sCache = {};
    const rCache = {};
    const csCache = {};

    const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id));
    const activeCards = workCards.filter(c => activeTaskIds.has(c.task_id));

    // Merge cached archive cards from taskDataCacheRef to prevent losing status on inactive tasks
    const cachedArchiveCards = [];
    if (taskDataCacheRef.current && taskDataCacheRef.current.archiveCards) {
      Object.keys(taskDataCacheRef.current.archiveCards).forEach(tid => {
        const list = taskDataCacheRef.current.archiveCards[tid] || [];
        list.forEach(c => {
          if (!activeCards.some(ac => ac.id === c.id) && !staticCompletedCards.some(sc => sc.id === c.id)) {
            cachedArchiveCards.push(c);
          }
        });
      });
    }

    const allCards = [...activeCards, ...staticCompletedCards, ...cachedArchiveCards];

    allCards.forEach(card => {
      const tid = card.task_id;
      const nid = String(card.nomenclature_id);

      if (!prodCache[tid]) prodCache[tid] = {};
      if (!sCache[tid]) sCache[tid] = {};
      if (!rCache[tid]) rCache[tid] = {};

      if (countAsProduced(card)) {
        prodCache[tid][nid] = (prodCache[tid][nid] || 0) + (Number(card.quantity) || 0);
      }

      const isRedo = (card.card_info || '').includes('[REDO]');
      const isActive = !countAsProduced(card);
      if (isRedo && isActive) {
        rCache[tid][nid] = true;
      }
    });

    const activeCardIds = new Set(activeCards.map(c => c.id));
    // activeHistory: recent scrap from global workCardHistory (fallback before staticHistory loads)
    const activeHistory = workCardHistory.filter(h => h.card_id && activeCardIds.has(h.card_id));

    // Merge cached taskHistory from taskDataCacheRef
    const cachedHistory = [];
    if (taskDataCacheRef.current && taskDataCacheRef.current.taskHistory) {
      Object.keys(taskDataCacheRef.current.taskHistory).forEach(tid => {
        const list = taskDataCacheRef.current.taskHistory[tid] || [];
        list.forEach(h => { cachedHistory.push(h); });
      });
    }

    // Deduplicate by entry ID to prevent double-counting when staticHistory overlaps with activeHistory/cachedHistory
    const historyMap = new Map();
    [...staticHistory, ...activeHistory, ...cachedHistory].forEach(h => {
      if (h && h.id && !historyMap.has(h.id)) historyMap.set(h.id, h);
    });
    const allHistory = Array.from(historyMap.values());

    allHistory.forEach(h => {
      if (h.card_id) {
        csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0);
      }
      const card = allCards.find(c => c.id === h.card_id);
      if (card) {
        const tid = card.task_id;
        const nid = String(card.nomenclature_id);
        if (!sCache[tid]) sCache[tid] = {};
        sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0);
      }
    });

    return {
      productionCache: prodCache,
      scrapCache: sCache,
      redoCache: rCache,
      allCardsCache: allCards,
      cardScrapCache: csCache
    };
  }, [tasks, workCards, workCardHistory, staticCompletedCards, staticHistory, archiveCards, taskHistory]);

  useEffect(() => {
    if (location.state?.taskId) {
      setActiveTaskId(location.state.taskId)
      setActiveView('worksheet')
    } else if (location.state?.highlightTaskId) {
      setActiveTaskId(location.state.highlightTaskId)
      setActiveView('worksheet')
    } else {
      const tParam = searchParams.get('task')
      if (tParam) {
        setActiveTaskId(tParam)
        setActiveView('worksheet')
      }
    }
  }, [location.state, searchParams])


  // Підвантажуємо архівні картки та історію при зміні активного наряду
  useEffect(() => {
    if (activeTaskId) {
      // Якщо глобальні workCards змінилися — скидаємо кеш ТІЛЬКИ для активного наряду, зберігаючи інші
      if (taskDataCacheRef.current.lastWorkCards !== workCards) {
        delete taskDataCacheRef.current.archiveCards[activeTaskId]
        delete taskDataCacheRef.current.taskHistory[activeTaskId]
        taskDataCacheRef.current.lastWorkCards = workCards
      }

      // Перевіряємо чи є дані в кеші для цього наряду
      const cachedCards = taskDataCacheRef.current.archiveCards[activeTaskId]
      const cachedHistory = taskDataCacheRef.current.taskHistory[activeTaskId]

      if (cachedCards && cachedHistory) {
        setArchiveCards(cachedCards)
        setTaskHistory(cachedHistory)
        setIsLoadingHistory(false)
        return
      }

      setIsLoadingHistory(true)
      fetchTaskArchiveCards(activeTaskId).then(async (cards) => {
        setArchiveCards(cards || [])

        const activeTaskCards = workCards.filter(c => c.task_id === activeTaskId)
        const allTaskCards = [...activeTaskCards, ...(cards || [])]
        const cardIds = allTaskCards.map(c => c.id)
        let histData = []
        if (cardIds.length > 0) {
          const { data } = await supabase
            .from('work_card_history')
            .select('*')
            .in('card_id', cardIds)
          histData = data || []
          setTaskHistory(histData)
        } else {
          setTaskHistory([])
        }

        // Записуємо в кеш
        taskDataCacheRef.current.archiveCards[activeTaskId] = cards || []
        taskDataCacheRef.current.taskHistory[activeTaskId] = histData
        setIsLoadingHistory(false)
      }).catch(() => {
        setIsLoadingHistory(false)
      })
    } else {
      setArchiveCards([])
      setTaskHistory([])
      setIsLoadingHistory(false)
    }
  }, [activeTaskId, workCards]) // workCards — тригер після будь-якого оновлення

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const getDisplayPartsForOrderItem = (task, it) => {
    if (task?.plan_snapshot) {
      const partsFromSnapshot = Object.values(task.plan_snapshot)
        .filter(p => p && String(p.order_item_id) === String(it.id))
        .map(p => {
          const nom = nomenclatures.find(n => String(n.id) === String(p.id))
          return {
            nom: nom || { id: p.id, name: p.name, nomenclature_code: p.code, material_type: p.material, type: 'part' },
            quantity_per_parent: p.need / (Number(it.quantity) || 1)
          }
        });
      if (partsFromSnapshot.length > 0) return partsFromSnapshot;
    }
    const parts = getBOMParts(it.nomenclature_id)
    return parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
  }

  const MACHINE_TYPES = [
    'CNC 1200x800 - 4 листи (Малий)',
    'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
    'CNC 3060х1600 - 3-36 листів (Три Головий)',
    'CNC 6000x2000 - 4 - 96 листів (Дракон)',
    'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
  ]

  const getStandardMachineType = (name) => {
    if (!name || name === 'Не вказано') return ''
    const normName = name.toLowerCase()
    const directMatch = MACHINE_TYPES.find(t => t.toLowerCase() === normName)
    if (directMatch) return directMatch
    if (normName.includes('12x8') || normName.includes('1200x800') || normName.includes('малий')) {
      return 'CNC 1200x800 - 4 листи (Малий)'
    }
    if (normName.includes('16x16') || normName.includes('3050(16)') || normName.includes('швидкісний') || normName.includes('3050x1600') || normName.includes('3050х1600') || normName.includes('3050')) {
      return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
    }
    if (normName.includes('30x16') || normName.includes('3060x1600') || normName.includes('3060х1600') || normName.includes('три головий') || normName.includes('триголовий')) {
      return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
    }
    if (normName.includes('60x20') || normName.includes('6000x2000') || normName.includes('дракон')) {
      return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
    }
    if (normName.includes('ke xin') || normName.includes('фея')) {
      return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
    }
    const partial = MACHINE_TYPES.find(t => t.toLowerCase().includes(normName) || normName.includes(t.toLowerCase()))
    if (partial) return partial
    return ''
  }

  const findMachine = (name) => {
    if (!name || name === 'Не вказано') return null
    const baseName = name.split(' №')[0].trim()
    let found = machines.find(m => m.name === baseName)
      || machines.find(m => m.name === name)
      || machines.find(m => m.type === baseName)
      || machines.find(m => m.type === name)
    if (!found) {
      const baseNameLower = baseName.toLowerCase()
      if (baseNameLower.includes('12x8') || baseNameLower.includes('1200x800') || baseNameLower.includes('малий')) {
        found = { sheet_capacity: 4, name: 'CNC 1200x800 - 4 листи (Малий)' }
      } else if (baseNameLower.includes('16x16') || baseNameLower.includes('3050(16)') || baseNameLower.includes('швидкісний') || baseNameLower.includes('3050x1600') || baseNameLower.includes('3050х1600') || baseNameLower.includes('3050')) {
        found = { sheet_capacity: 12, name: 'CNC 3050(16)х16 - 3-12 листів (швидкісний)' }
      } else if (baseNameLower.includes('30x16') || baseNameLower.includes('3060x1600') || baseNameLower.includes('3060х1600') || baseNameLower.includes('три головий') || baseNameLower.includes('триголовий')) {
        found = { sheet_capacity: 36, name: 'CNC 3060х1600 - 3-36 листів (Три Головий)' }
      } else if (baseNameLower.includes('60x20') || baseNameLower.includes('6000x2000') || baseNameLower.includes('дракон')) {
        found = { sheet_capacity: 96, name: 'CNC 6000x2000 - 4 - 96 листів (Дракон)' }
      } else if (baseNameLower.includes('ke xin') || baseNameLower.includes('фея')) {
        found = { sheet_capacity: 16, name: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)' }
      }
    }

    if (found) {
      const result = { ...found }
      const searchName = (result.name || '') + ' ' + (name || '')
      const match = searchName.match(/(\d+)\s*-\s*(\d+)\s*лист/i)
      if (match) {
        result.min_capacity = parseInt(match[1])
        result.max_capacity = parseInt(match[2])
      } else {
        const matchSingle = searchName.match(/(\d+)\s*лист/i)
        if (matchSingle) {
          result.min_capacity = parseInt(matchSingle[1])
          result.max_capacity = parseInt(matchSingle[1])
        } else {
          const bnl = searchName.toLowerCase()
          if (bnl.includes('12x8') || bnl.includes('1200x800') || bnl.includes('малий')) {
            result.min_capacity = 4; result.max_capacity = 4;
          } else if (bnl.includes('16x16') || bnl.includes('3050(16)') || bnl.includes('швидкісний') || bnl.includes('3050x1600') || bnl.includes('3050х1600') || bnl.includes('3050')) {
            result.min_capacity = 3; result.max_capacity = 12;
          } else if (bnl.includes('30x16') || bnl.includes('3060x1600') || bnl.includes('3060х1600') || bnl.includes('три головий') || bnl.includes('триголовий')) {
            result.min_capacity = 3; result.max_capacity = 36;
          } else if (bnl.includes('60x20') || bnl.includes('6000x2000') || bnl.includes('дракон')) {
            result.min_capacity = 4; result.max_capacity = 96;
          } else if (bnl.includes('ke xin') || bnl.includes('фея')) {
            result.min_capacity = 4; result.max_capacity = 16;
          } else {
            result.min_capacity = result.sheet_capacity || 1
            result.max_capacity = result.sheet_capacity || 1
          }
        }
      }
      return result
    }
    return null
  }


  const handleCloseNaryad = async (taskId) => {
    if (!window.confirm("Ви впевнені, що хочете закрити цей наряд?")) return
    try {
      await completeTaskByMaster(taskId)
      setActiveTaskId(null)
      fetchData(['tasks', 'orders', 'work_cards'])
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleCompleteShop1Task = async (taskId) => {
    if (isCompletingTask) return
    if (!window.confirm('Підтвердити завершення наряду Цеху №1? Сировину буде списано.')) return
    setIsCompletingTask(true)
    try {
      await completeTaskByMaster(taskId)
      setActiveTaskId(null)
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsCompletingTask(false)
    }
  }

  // 0. Per-task readiness: all Shop-1 cards produced >= need
  // Картка вважається "виробленою" ЛИШЕ після формальної ПРИЙОМКИ на склад Цеху №1
  // Ланцюжок: Розкрій → at-buffer(Розкрій) → Галтовка → at-buffer(Галтовка) → ПРИЙОМКА → completed
  // Будь-який проміжний стан (at-buffer, in-progress) — ще НЕ вироблено



  const taskCardsCountMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      map[task.id] = workCards.filter(c => c.task_id === task.id && c.operation !== 'Склад БЗ').length
    })
    return map
  }, [tasks, workCards])

  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]

      const taskCache = productionCache[task.id] || {}

      const isReady = order?.order_items?.every(item => {
        const rows = getDisplayPartsForOrderItem(task, item)
        const shop1Parts = rows.filter(r => r.nom?.type === 'part')
        if (shop1Parts.length === 0) return true
        return shop1Parts.every(part => {
          const nomId = String(part.nom?.id)
          const snapshot = task.plan_snapshot?.[nomId]
          const need = snapshot
            ? snapshot.need
            : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
          if (need === 0) return true

          const produced = taskCache[nomId] || 0
          return produced >= need
        })
      })
      const taskCards = allCardsCache.filter(c => c.task_id === task.id)
      const hasActiveInProgressCards = taskCards.some(c => !countAsProduced(c))
      map[task.id] = Boolean(isReady) && !hasActiveInProgressCards
    })
    return map
  }, [tasks, orders, allOrdersMap, nomenclatures, bomItems, productionCache, allCardsCache, scrapCache])

  const taskShortageMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskScrap = scrapCache[task.id] || {}
      const taskRedo = redoCache[task.id] || {}
      const taskCards = allCardsCache.filter(c => c.task_id === task.id)

      let hasShortage = false
      Object.keys(snapshot).forEach(nomIdStr => {
        if (hasShortage) return
        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
        if (nom?.type !== 'part') return
        const snap = snapshot[nomIdStr]
        if (!snap) return

        const need = snap.need || 0
        const stockBZ = snap.stock || 0
        const unitsPerSheet = snap.units_per_sheet || 1

        const nomCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
        const productionCards = nomCards.filter(c => c.operation !== 'Склад БЗ')

        // Якщо карток немає взагалі — пропускаємо (наряд ще не розпочато по цій позиції)
        if (nomCards.length === 0) return

        // Якщо є картки — рахуємо листи з урахуванням браку
        const totalSheets = productionCards.reduce((sum, c) => {
          const cardScrap = cardScrapCache[c.id] || 0
          const originalQty = (Number(c.quantity) || 0) + cardScrap
          return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
        }, 0)

        const plannedSheets = snap.sheets || 0
        // Якщо немає production cards (все вже завершено) — беремо plannedSheets як базу
        const totalSheetsMax = productionCards.length > 0
          ? Math.max(plannedSheets, totalSheets)
          : plannedSheets

        const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
        const groupScrap = taskScrap[nomIdStr] || 0
        const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

        if (shortage > 0) {
          hasShortage = true
        }
      })
      map[task.id] = hasShortage
    })
    return map
  }, [tasks, scrapCache, redoCache, nomenclatures, allCardsCache, cardScrapCache])

  // ── Persist shortage map to localStorage once staticHistory is loaded ──
  // This eliminates the red→yellow flicker on page reload
  useEffect(() => {
    if (staticHistory.length === 0) return // Don't overwrite cache with empty-state results
    try {
      const serialized = JSON.stringify(taskShortageMap)
      localStorage.setItem(SHORTAGE_CACHE_KEY, serialized)
      setCachedShortageMap(taskShortageMap)
    } catch (e) {}
  }, [taskShortageMap, staticHistory.length])

  // ── Точний override shortage для активного наряду (використовує повну taskHistory) ──
  // taskShortageMap може мати хибний false якщо записи браку не потрапили в ліміт workCardHistory.
  // Цей мемо перераховує shortage для activeTaskId з повними даними що вже є в state.
  const activeTaskShortageOverride = useMemo(() => {
    if (!activeTaskId) return false
    if (isLoadingHistory) {
      return !!taskShortageMap[activeTaskId]
    }
    const task = tasks.find(t => t.id === activeTaskId)
    if (!task || task.status === 'completed') return false

    const snapshot = task.plan_snapshot || {}
    const taskCards = [
      ...workCards.filter(c => c.task_id === activeTaskId),
      ...archiveCards
    ]
    const allHistory = taskHistory.length > 0 ? taskHistory : workCardHistory.filter(h => {
      const cardId = taskCards.find(c => c.id === h.card_id)
      return !!cardId
    })

    let hasShortage = false
    Object.keys(snapshot).forEach(nomIdStr => {
      if (hasShortage) return
      const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
      if (nom?.type !== 'part') return
      const snap = snapshot[nomIdStr]
      if (!snap) return

      const need = snap.need || 0
      const stockBZ = snap.stock || 0
      const unitsPerSheet = snap.units_per_sheet || 1

      const nomCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
      const productionCards = nomCards.filter(c => c.operation !== 'Склад БЗ')
      if (productionCards.length === 0) return

      // Рахуємо groupScrap з повної taskHistory
      const cardIds = new Set(nomCards.map(c => String(c.id)))
      const groupScrap = allHistory
        .filter(h => h.card_id && cardIds.has(String(h.card_id)))
        .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

      // Рахуємо totalSheets з кешу браку по картках
      const totalSheets = productionCards.reduce((sum, c) => {
        const cardScrap = allHistory
          .filter(h => String(h.card_id) === String(c.id))
          .reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
        const originalQty = (Number(c.quantity) || 0) + cardScrap
        return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
      }, 0)

      const plannedSheets = snap.sheets || 0
      const totalSheetsMax = Math.max(plannedSheets, totalSheets)
      const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
      const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

      if (shortage > 0) hasShortage = true
    })
    return hasShortage
  }, [activeTaskId, tasks, workCards, archiveCards, taskHistory, workCardHistory, nomenclatures, isLoadingHistory, taskShortageMap])

  const relevantTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const stepName = (t.step || '').toLowerCase()
        const isLaser = stepName.includes('розкрій') || stepName.includes('різка')

        // Якщо наряд АКТИВНИЙ (не завершений)
        if (t.status !== 'completed') {
          return t.warehouse_conf && t.engineer_conf && t.director_conf && isLaser
        }

        // Якщо наряд ЗАВЕРШЕНИЙ (Архів)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) || (t.updated_at && new Date(t.updated_at) > threeDaysAgo)

        // Для архіву Цеху №1 показуємо будь-який нещодавній наряд, який був розкрійним/різкою
        // (Або взагалі будь-який завершений нещодавно, щоб нічого не зникло)
        return isRecent && (isLaser || !t.step)
      })
      .sort((a, b) => {
        // Already transferred → bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        // Ready for Shop 2 → top
        if (taskReadinessMap[a.id] && !taskReadinessMap[b.id]) return -1
        if (!taskReadinessMap[a.id] && taskReadinessMap[b.id]) return 1
        // Needs ДОВИПУСК → second (для активного наряду — точний override; для решти — fallback з кешу поки staticHistory не завантажено)
        const getShortage = (t) => {
          if (t.id === activeTaskId) return activeTaskShortageOverride
          const fromMap = taskShortageMap[t.id]
          if (staticHistory.length > 0) return fromMap
          return fromMap || cachedShortageMap[t.id]
        }
        const aShortage = getShortage(a)
        const bShortage = getShortage(b)
        if (aShortage && !bShortage) return -1
        if (!aShortage && bShortage) return 1
        // New tasks (no cards) → third
        const aNew = a.status !== 'completed' && (taskCardsCountMap[a.id] || 0) === 0
        const bNew = b.status !== 'completed' && (taskCardsCountMap[b.id] || 0) === 0
        if (aNew && !bNew) return -1
        if (!aNew && bNew) return 1
        // In Progress tasks → fourth
        const aInProg = a.status !== 'completed' && (taskCardsCountMap[a.id] || 0) > 0 && !taskReadinessMap[a.id] && !aShortage
        const bInProg = b.status !== 'completed' && (taskCardsCountMap[b.id] || 0) > 0 && !taskReadinessMap[b.id] && !bShortage
        if (aInProg && !bInProg) return -1
        if (!aInProg && bInProg) return 1

        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [tasks, taskReadinessMap, taskShortageMap, cachedShortageMap, taskCardsCountMap, activeTaskId, activeTaskShortageOverride, staticHistory.length])

  const activeQueueCount = useMemo(() => {
    return relevantTasks.filter(t => t.status !== 'completed').length
  }, [relevantTasks])

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

  const handleGenerateFromWorksheet = async (task, part, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0, customCapacity = null) => {
    if (generatingLockRef.current) {
      console.warn("Generation already in progress, ignoring duplicate call.");
      return
    }
    generatingLockRef.current = true

    const machineObj = findMachine(selectedMachineName)
    const capacity = customCapacity !== null ? Number(customCapacity) : (Number(machineObj?.sheet_capacity) || 1)
    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1

    const maxCardsForThisSplit = Math.ceil(sheets / capacity)
    const displayTotal = globalTotalCards || maxCardsForThisSplit

    // CLAMP: Don't allow generating more than planned for this specific machine split
    let finalCount = Math.min(count, maxCardsForThisSplit - localGeneratedCount)
    if (finalCount <= 0) {
      generatingLockRef.current = false
      return
    }

    if (!isRepair) {
      // Query the database to get the absolute up-to-date count of existing cards
      let dbCardsCount = 0
      try {
        const { data, error } = await supabase
          .from('work_cards')
          .select('id, is_rework, operation')
          .eq('task_id', task.id)
          .eq('nomenclature_id', part.nom?.id)
        if (!error && data) {
          // Exclude BZ buffer cards — they are not production cutting cards
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

    // DYNAMIC NUMBERING: Find absolute max sequence across ALL machines for this nomenclature
    const existingNomenclatureCards = (workCards || []).filter(wc =>
      String(wc.task_id) === String(task.id) &&
      String(wc.nomenclature_id) === String(part.nom?.id)
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

      // PRECISE PROGRESS TRACKING: Check how many sheets of THIS NOMENCLATURE are already accounted for
      const globalSheetsMadeTotal = existingNomenclatureCards.reduce((sum, wc) => {
        if (wc.actualSheets) return sum + Number(wc.actualSheets)
        const cardScrap = cardScrapCache[wc.id] || 0
        const originalQty = (Number(wc.quantity) || 0) + cardScrap
        return sum + Math.ceil(originalQty / unitsPerSheet)
      }, 0)

      // Start calculating for THIS SPLIT
      // localIdx tracks where we are in CURRENT machine split
      let sheetsRemainingForThisSplit = sheets - (localGeneratedCount * capacity)

      // FIX: Use the Snapshot's NEED (e.g. 1000) not just the Plan (e.g. 775)
      // for the purpose of the REQ/BZ labels on the card.
      const snapshotEntry = task.plan_snapshot?.[String(part.nom?.id)]
      const originalNeed = snapshotEntry?.need || totalToReach || 0

      let reqRemainingForThisSplit = originalNeed - (localGeneratedCount * capacity * unitsPerSheet)
      if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0

      for (let i = 1; i <= finalCount; i++) {
        // Sequential numbering
        const currentSeq = startSeqForThisBatch + (i - 1)

        // Use EXACT MIN logic to ensure we don't exceed the split or nomenclature capacity
        const sheetsInThisLoading = Math.min(sheetsRemainingForThisSplit, capacity)
        const qtyInThisLoading = Math.ceil(sheetsInThisLoading * unitsPerSheet)
        const reqInThisLoading = Math.min(qtyInThisLoading, reqRemainingForThisSplit)
        const bzInThisLoading = Math.max(0, qtyInThisLoading - reqInThisLoading)

        const prefix = isRepair ? '[REDO] ' : ''
        cardsBatch.push({
          operation: 'Розкрій',
          machine: selectedMachineName || 'Не вказано',
          estimatedTime: (Number(part.nom?.time_per_unit) || 0) * reqInThisLoading * 60,
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

      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCardsBatch)

      if (isRepair && sheets > 0) {
        const totalQty = finalCount * capacity * unitsPerSheet;
        await createDovyпускMaterialRequests(task.id, task.order_id, part.nom, sheets, totalQty, selectedMachineName);
      }

      if (createdCards && createdCards.length > 0) {
        setPrintQueue({
          task,
          part,
          total: displayTotal,
          created: startSeqForThisBatch,
          metadata: createdCards.map((c, idx) => {
            const batchItem = cardsBatch[idx]
            return {
              id: c.id,
              loading: c.card_info,
              qty: batchItem ? batchItem.quantity : 0,
              estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (batchItem ? batchItem.quantity : 0) * 60,
              totalLoadings: displayTotal,
              sheetsPerLoading: batchItem ? batchItem.actualSheets : capacity, // Use ACTUAL sheets
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

  const handleBufferReception = async (cardId) => {
    const card = workCards.find(c => String(c.id) === String(cardId))
    if (!card) { alert("Картку не знайдено!"); return; }
    setBufferScrapModal({ cardId: card.id, nomenclature_id: card.nomenclature_id })
    setBufferScrapCounts({ [card.nomenclature_id]: 0 })
  }

  const submitBufferReception = async () => {
    if (!bufferScrapModal) return
    const scrap = bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0
    try {
      await confirmBuffer(bufferScrapModal.cardId, scrap)
      setBufferScrapModal(null)
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks'])
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleReserveBZ = async (taskId, orderId, nomId, qty) => {
    if (!window.confirm(`Забронювати ${qty} шт. зі складу БЗ?`)) return
    try {
      await reserveBZForTask(taskId, orderId, nomId, qty)
      alert("Деталі заброньовано!")
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleUpdateMachineInSnapshot = async (task, nomId, machineName = null, splits = null) => {
    if (!task || !nomId) return
    const sId = String(nomId)
    const currentSnapshot = task.plan_snapshot || {}

    // Construct updated entry
    const entry = { ...(currentSnapshot[sId] || {}) }
    if (machineName !== null) entry.machine = machineName
    if (splits !== null) entry.splits = splits

    const updatedSnapshot = {
      ...currentSnapshot,
      [sId]: entry
    }
    try {
      const { error } = await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
      if (error) throw error
      // Only fetchData if we are NOT in the middle of a local edit update to avoid flicker
      if (!saveTimeoutRef.current) fetchData('tasks')
    } catch (err) { console.error("Snapshot error:", err) }
  }

  const debouncedUpdateSplits = (task, nomId, newSplits) => {
    // 1. Update local state immediately for UI response
    setEditingSplits(prev => ({ ...prev, [nomId]: newSplits }))

    // 2. Clear old timeout
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    // 3. Set new timeout to sync with DB
    saveTimeoutRef.current = setTimeout(() => {
      handleUpdateMachineInSnapshot(task, nomId, null, newSplits)
      saveTimeoutRef.current = null
    }, 1000) // 1 second debounce
  }

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
        <div
          className={`side-panel no-print ${isDrawerOpen ? 'drawer-open' : ''}`}
          style={{ display: 'flex', flexDirection: 'column', background: '#121212', borderRight: '1px solid #222', transition: '0.3s transform' }}
        >
          <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ЧЕРГА НАРЯДІВ ({relevantTasks.length})
            {isDrawerOpen && (
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}>
                <X size={18} />
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {relevantTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(task => {
              const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
              const isActive = activeTaskId === task.id
              const isReady = taskReadinessMap[task.id]
              // Для активного наряду — використовуємо точний override з повною taskHistory
              // Для неактивних: поки staticHistory ще не завантажено — використовуємо кешований результат з localStorage (без мерехтіння при оновленні)
              const shortageFromMap = staticHistory.length > 0 ? taskShortageMap[task.id] : (taskShortageMap[task.id] || cachedShortageMap[task.id])
              const isShortage = isActive ? activeTaskShortageOverride : shortageFromMap
              const isCompleted = task.status === 'completed'
              const taskCardsCount = taskCardsCountMap[task.id] || 0
              const isNew = !isCompleted && taskCardsCount === 0
              const isInProgress = !isCompleted && taskCardsCount > 0 && !isReady && !isShortage

              const borderColor = isReady && !isCompleted
                ? '#10b981'
                : isShortage && !isCompleted
                  ? '#ef4444'
                  : isNew
                    ? '#3b82f6'
                    : isInProgress
                      ? '#eab308'
                      : isActive
                        ? '#fff'
                        : 'transparent'

              const borderSize = isActive ? '6px' : '4px'

              const bgColor = isActive
                ? 'rgba(255,255,255,0.08)'
                : isReady && !isCompleted
                  ? 'rgba(16, 185, 129, 0.08)'
                  : isShortage && !isCompleted
                    ? 'rgba(239, 68, 68, 0.08)'
                    : isNew
                      ? 'rgba(59, 130, 246, 0.08)'
                      : isInProgress
                        ? 'rgba(234, 179, 8, 0.08)'
                        : 'transparent'

              return (
                <div
                  onClick={() => {
                    setActiveTaskId(task.id);
                    setIsDrawerOpen(false);
                    setSearchParams({ task: task.id });
                  }}
                  style={{
                    padding: '18px 15px',
                    borderLeft: `${borderSize} solid ${borderColor}`,
                    background: bgColor,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '1px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isCompleted ? '#555' : '#fff' }}>
                      № {order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isCompleted && <CheckCircle2 size={14} color="#10b981" />}
                      {isReady && !isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#10b981', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
                          <ArrowRight size={10} color="#fff" />
                          <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#fff', letterSpacing: '0.5px' }}>ГОТОВО</span>
                        </div>
                      )}
                      {isShortage && !isCompleted && !isReady && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }}>
                          <AlertTriangle size={10} color="#fff" />
                          <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#fff', letterSpacing: '0.5px' }}>НЕСТАЧА</span>
                        </div>
                      )}
                      {isNew && (
                        <div className="anim-pulse-blue" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f6', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                          <Clock size={10} color="#fff" />
                          <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#fff', letterSpacing: '0.5px' }}>НОВИЙ</span>
                        </div>
                      )}
                      {isInProgress && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#eab308', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(234,179,8,0.3)' }}>
                          <Layers size={10} color="#000" />
                          <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#000', letterSpacing: '0.5px' }}>В РОБОТІ</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const prodId = order?.nomenclature_id || order?.order_items?.[0]?.nomenclature_id
                    const prod = nomenclatures?.find(n => String(n.id) === String(prodId))
                    const qty = task.planned_sets || order?.quantity || 0
                    return (
                      <div style={{ fontSize: '0.85rem', color: isCompleted ? '#555' : '#eaeaea', fontWeight: 900, margin: '4px 0' }}>
                        {prod ? prod.name : '—'} • <span style={{ color: isCompleted ? '#777' : '#ff9000' }}>{qty} шт.</span>
                      </div>
                    )
                  })()}
                  <div style={{ fontSize: '0.7rem', color: isCompleted ? '#333' : '#555' }}>{order?.customer}</div>
                  {isCompleted && <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px' }}>ВИКОНАНО</div>}
                  {isReady && !isCompleted && (
                    <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={10} />
                      ВСІ КАРТКИ ГОТОВІ — ЗАВЕРШИТИ
                    </div>
                  )}
                  {isShortage && !isCompleted && !isReady && (
                    <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={10} />
                      ПОТРІБЕН ДОВИПУСК
                    </div>
                  )}
                  {isNew && (
                    <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} />
                      КАРТКИ ЩЕ НЕ ЗГЕНЕРОВАНО
                    </div>
                  )}
                  {isInProgress && (
                    <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={10} />
                      У ПРОЦЕСІ ВИРОБНИЦТВА
                    </div>
                  )}
                </div>
              )
            })}
            {relevantTasks.length === 0 && (
              <div style={{ padding: '20px', color: '#333', fontSize: '0.8rem' }}>Немає нарядів</div>
            )}
          </div>
          {relevantTasks.length > itemsPerPage && (
            <div style={{ padding: '15px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
              >Назад</button>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                {currentPage} / {Math.ceil(relevantTasks.length / itemsPerPage)}
              </div>
              <button
                disabled={currentPage === Math.ceil(relevantTasks.length / itemsPerPage)}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === Math.ceil(relevantTasks.length / itemsPerPage) ? 0.3 : 1 }}
              >Вперед</button>
            </div>
          )}
        </div>

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
              const activeTaskCards = workCards.filter(c => c.task_id === task.id)
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

              // ПЕРЕВІРКА НА ПОВНЕ ВИКОНАННЯ
              // Картки вважаються «виробленими», якщо вони completed, at-buffer або на стадії прийомки
              const isTaskComplete = order?.order_items?.every(item => {
                const rows = getDisplayPartsForOrderItem(task, item)
                const shop1Parts = rows.filter(r => r.nom?.type === 'part')
                return shop1Parts.every(part => {
                  const snapshot = task.plan_snapshot?.[String(part.nom?.id)]
                  const need = snapshot ? snapshot.need : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
                  const produced = taskCards
                    .filter(c => String(c.nomenclature_id) === String(part.nom?.id))
                    .reduce((sum, c) => sum + (countAsProduced(c) ? Number(c.quantity) : 0), 0)
                  return produced >= need
                })
              })

              const isReady = taskReadinessMap[task.id]
              // Активний наряд — override з повною taskHistory
              const isShortage = task.id === activeTaskId ? activeTaskShortageOverride : taskShortageMap[task.id]
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

                        <button
                          onClick={() => handleOpenNaryadPrint(task, order)}
                          disabled={naryadPrintLoading}
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid #10b981',
                            color: '#10b981',
                            fontSize: '0.8rem',
                            fontWeight: 900,
                            padding: '8px 18px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: '0.2s',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)',
                            marginTop: '5px'
                          }}
                        >
                          {naryadPrintLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Printer size={14} />
                          )}
                          ДРУК НАРЯДУ
                        </button>
                      </div>
                      <div style={{ color: '#555', marginTop: '5px', fontSize: '1.1rem', fontWeight: 800 }}>
                        ВИРІБ: <strong style={{ color: '#ef4444' }}>{productNames || '—'}</strong> | {order?.customer}
                        {task.batch_index && (
                          <span style={{ marginLeft: '15px', background: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 900 }}>
                            ПАРТІЯ №{task.batch_index}
                          </span>
                        )}
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
                            <th style={{ padding: '12px 10px', width: '12%' }}>ВЕРСТАТ</th>
                            <th style={{ padding: '12px 6px', textAlign: 'center', color: '#3b82f6', width: '8%' }}>ЗАВАНТ.</th>
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

                              if (snapshot) {
                                need = snapshot.need
                                stockBZ = snapshot.stock
                                plan = snapshot.plan
                                unitsPerSheet = snapshot.units_per_sheet
                                sheets = snapshot.sheets
                              } else {
                                need = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
                                const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz')
                                stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                                plan = Math.max(0, need - stockBZ)
                                unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                                sheets = Math.ceil(plan / unitsPerSheet)
                              }

                              const existing = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                              const productionCards = existing.filter(c => c.operation !== 'Склад БЗ')
                              const allRedos = existing.filter(c => c.operation !== 'Склад БЗ' && (c.card_info || '').includes('[REDO]'))
                              const redoCount = allRedos.length
                              const activeProductionCards = productionCards.filter(c => !(c.card_info || '').includes('[REDO]'))

                              const rawRowMachineName = ((task.plan_snapshot || {})[String(nomId)]?.machine || (task.plan_snapshot || {})[String(nomId)]?.selected_machine || selectedMachines[rowId] || '')
                                || (productionCards.length > 0 && productionCards[0].machine && productionCards[0].machine !== 'Не вказано' ? productionCards[0].machine : '')
                              const rowMachineName = getStandardMachineType(rawRowMachineName)
                              console.log(`[NOM:${part.nom?.name}] rawRowMachineName: "${rawRowMachineName}", rowMachineName: "${rowMachineName}", productionCardsCount: ${productionCards.length}`)

                              // Use local state if it exists (for fluid typing), fallback to context
                              const splits = editingSplits[nomId] || (task.plan_snapshot || {})[String(nomId)]?.splits || []
                              const isSplitMode = splits.length > 0
                              const totalSheetsNeeded = sheets // This is the total sheets for the whole naryad row

                              const machineObjForCapacity = findMachine(rowMachineName)
                              const defaultCapacity = machineObjForCapacity?.min_capacity || machineObjForCapacity?.sheet_capacity || 1
                              const maxCapacity = machineObjForCapacity?.max_capacity || machineObjForCapacity?.sheet_capacity || 1
                              const rawCapacity = (rowCapacities[rowId] !== undefined && rowCapacities[rowId] !== '') ? rowCapacities[rowId] : defaultCapacity
                              const machineCapacity = Math.min(maxCapacity, Math.max(defaultCapacity, rawCapacity))

                              const baseLoads = rowMachineName ? Math.ceil(sheets / machineCapacity) : (sheets || 0)
                              const loads = (plan === 0 && existing.some(c => c.operation === 'Склад БЗ')) ? 1 : baseLoads

                              // Split logic for totalTargetLoads
                              let totalTargetLoads = loads
                              if (isSplitMode) {
                                totalTargetLoads = splits.reduce((sum, s) => {
                                  const cap = findMachine(s.machine)?.sheet_capacity || 1
                                  const sSheets = Number(s.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(s.qty) || 0) / unitsPerSheet) : 0)
                                  return sum + Math.ceil(sSheets / cap)
                                }, 0)
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
                                  <td style={{ padding: '10px 6px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem' }}>{getDisplayMaterial(part.nom, snapshot)}</td>
                                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>{unitsPerSheet}</td>
                                  <td style={{ padding: '10px 4px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.1rem' }}>{sheets}</td>
                                  <td style={{ padding: '10px 4px' }}>
                                    {!isSplitMode ? (
                                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        <select
                                          value={rowMachineName || ''}
                                          disabled={productionCards.length > 0 || plan === 0}
                                          onChange={(e) => {
                                            const mName = e.target.value
                                            setSelectedMachines(p => ({ ...p, [rowId]: mName }))
                                            handleUpdateMachineInSnapshot(task, nomId, mName)
                                          }}
                                          style={{ flex: 1, background: '#000', border: rowMachineName || plan === 0 ? '1px solid #333' : '1px solid #ef4444', color: rowMachineName || plan === 0 ? '#fff' : '#ef4444', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, opacity: plan === 0 ? 0.3 : 1 }}
                                        >
                                          <option value="">{plan === 0 ? 'Не потрібно' : 'Оберіть тип верстата'}</option>
                                          {MACHINE_TYPES.map(t => {
                                            const cap = findMachine(t)?.sheet_capacity || 1
                                            return <option key={t} value={t}>{t} ({cap} л.)</option>
                                          })}
                                        </select>
                                        {plan > 0 && rowMachineName && defaultCapacity !== maxCapacity && (
                                          <input
                                            type="number"
                                            title={`Листів за завантаження (від ${defaultCapacity} до ${maxCapacity})`}
                                            placeholder="Завант."
                                            value={rowCapacities[rowId] !== undefined ? rowCapacities[rowId] : machineCapacity}
                                            min={defaultCapacity}
                                            max={maxCapacity}
                                            readOnly={productionCards.length > 0 && productionCards.length >= totalTargetLoads}
                                            onChange={(e) => {
                                              if (productionCards.length > 0 && productionCards.length >= totalTargetLoads) return
                                              const v = parseInt(e.target.value)
                                              setRowCapacities(p => ({ ...p, [rowId]: isNaN(v) ? '' : v }))
                                            }}
                                            onBlur={(e) => {
                                              if (productionCards.length > 0 && productionCards.length >= totalTargetLoads) return
                                              let v = parseInt(e.target.value)
                                              if (isNaN(v)) v = defaultCapacity;
                                              else v = Math.min(maxCapacity, Math.max(defaultCapacity, v));
                                              setRowCapacities(p => ({ ...p, [rowId]: v }));
                                            }}
                                            style={{
                                              width: '60px',
                                              background: '#000',
                                              border: `1px solid ${productionCards.length > 0 && productionCards.length >= totalTargetLoads ? '#222' : '#ff9000'}`,
                                              color: productionCards.length > 0 && productionCards.length >= totalTargetLoads ? '#444' : '#ff9000',
                                              padding: '8px',
                                              borderRadius: '8px',
                                              fontSize: '0.75rem',
                                              fontWeight: 700,
                                              textAlign: 'center',
                                              cursor: productionCards.length > 0 && productionCards.length >= totalTargetLoads ? 'default' : 'text'
                                            }}
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {splits.map((s, sIdx) => {
                                          const cap = findMachine(s.machine)?.sheet_capacity || 1
                                          const sh = Math.ceil(Number(s.qty) / (unitsPerSheet || 1))
                                          const l = Math.ceil(sh / cap)
                                          return (
                                            <div key={sIdx} style={{ display: 'flex', gap: '5px', alignItems: 'center', background: '#080808', padding: '5px', borderRadius: '8px', border: '1px solid #151515' }}>
                                              <input
                                                type="number"
                                                value={(s.sheets || (unitsPerSheet > 0 ? Math.ceil((s.qty || 0) / unitsPerSheet) : 0)) || ''}
                                                placeholder="Л."
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                  const newSplits = [...splits]
                                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                                                  newSplits[sIdx].sheets = val
                                                  newSplits[sIdx].qty = val * unitsPerSheet
                                                  debouncedUpdateSplits(task, nomId, newSplits)
                                                }}
                                                onBlur={() => {
                                                  // Force sync on blur
                                                  if (saveTimeoutRef.current) {
                                                    clearTimeout(saveTimeoutRef.current)
                                                    handleUpdateMachineInSnapshot(task, nomId, null, splits)
                                                    saveTimeoutRef.current = null
                                                  }
                                                }}
                                                style={{ width: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 5px', borderRadius: '8px', fontSize: '1rem', fontWeight: 950, textAlign: 'center', outline: 'none' }}
                                              />
                                              <select
                                                value={s.machine || ''}
                                                onChange={(e) => {
                                                  const newSplits = [...splits]
                                                  newSplits[sIdx].machine = e.target.value
                                                  debouncedUpdateSplits(task, nomId, newSplits)
                                                }}
                                                style={{ flex: 1, background: '#000', border: '1px solid #222', color: '#fff', padding: '5px', borderRadius: '6px', fontSize: '0.7rem' }}
                                              >
                                                <option value="">Тип верстата</option>
                                                {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                              </select>
                                              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, minWidth: '35px' }}>{l} завант.</span>
                                              <button
                                                onClick={() => {
                                                  const newSplits = splits.filter((_, i) => i !== sIdx)
                                                  handleUpdateMachineInSnapshot(task, nomId, null, newSplits.length === 0 ? null : newSplits)
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                          )
                                        })}
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                          <button
                                            onClick={() => {
                                              const currentSum = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0)
                                              const remaining = Math.max(0, totalSheetsNeeded - currentSum)
                                              const newSplits = [...splits, { machine: '', sheets: remaining, qty: remaining * unitsPerSheet }]
                                              handleUpdateMachineInSnapshot(task, nomId, null, newSplits)
                                            }}
                                            style={{ flex: 1, background: '#111', border: '1px solid #222', color: '#555', fontSize: '0.6rem', padding: '5px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800 }}
                                          >
                                            + ДОДАТИ ВЕРСТАТ
                                          </button>
                                          <button
                                            onClick={() => handleUpdateMachineInSnapshot(task, nomId, null, [])}
                                            style={{ background: '#111', border: '1px solid #222', color: '#ef4444', padding: '5px', borderRadius: '6px', cursor: 'pointer' }}
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                        {(() => {
                                          const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0);
                                          const isOver = currentSumSheets > totalSheetsNeeded;
                                          const isExact = currentSumSheets === totalSheetsNeeded;
                                          const statusColor = isOver ? '#ef4444' : isExact ? '#10b981' : '#ff9000';
                                          return (
                                            <div style={{
                                              fontSize: '0.65rem',
                                              textAlign: 'center',
                                              color: statusColor,
                                              fontWeight: 950,
                                              background: `${statusColor}11`,
                                              padding: '6px',
                                              borderRadius: '10px',
                                              border: `1px solid ${statusColor}33`,
                                              marginTop: '5px'
                                            }}>
                                              {isOver ? (
                                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                  <AlertTriangle size={10} /> ПЕРЕВИЩЕННЯ: {currentSumSheets} / {totalSheetsNeeded} л.
                                                </span>
                                              ) : (
                                                <span>ПЛАН: {currentSumSheets} / {totalSheetsNeeded} листів</span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 4px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.2rem' }}>
                                    {rowMachineName || isSplitMode ? (
                                      <>
                                        <span style={{ color: activeProductionCards.length < totalTargetLoads ? '#444' : '#3b82f6' }}>{activeProductionCards.length}</span>
                                        <span style={{ color: '#222', margin: '0 5px' }}>/</span>
                                        <span>{totalTargetLoads}</span>
                                        {redoCount > 0 && <span style={{ fontSize: '0.9rem', color: '#ef4444', marginLeft: '5px', fontWeight: 900 }}>+{redoCount}</span>}
                                      </>
                                    ) : (
                                      <span style={{ color: '#222', fontSize: '0.8rem' }}>—</span>
                                    )}
                                  </td>
                                  {!isReworkOrder && (
                                    <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                                  )}
                                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      {plan === 0 ? (
                                        (stockBZ > 0 && existing.find(c => c.operation === 'Склад БЗ')) ? (
                                          <div style={{ background: '#3b82f620', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 12px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                            ЗАБРОНЬОВАНО ({stockBZ})
                                          </div>
                                        ) : (
                                          <div style={{ color: '#222', fontSize: '0.6rem', fontWeight: 900 }}>НЕ ПОТРЕБУЄ ДІЇ</div>
                                        )
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                          {stockBZ > 0 && (
                                            <div style={{ background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 950, textAlign: 'center' }}>
                                              ЗАБРОНЬОВАНО: {stockBZ} шт
                                            </div>
                                          )}
                                          {(productionCards.length === 0 || productionCards.length < totalTargetLoads) && (
                                            <button
                                              onClick={() => {
                                                const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0);
                                                if (isSplitMode && currentSumSheets > totalSheetsNeeded) {
                                                  alert(`Помилка: Ви запланували ${currentSumSheets} листів, що більше за план (${totalSheetsNeeded} л.). Виправте кількість перед генерацією.`);
                                                  return;
                                                }

                                                if (isSplitMode) {
                                                  setGenModal({
                                                    task, part,
                                                    total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName || splits[0]?.machine, sheets, splits: splits
                                                  })
                                                } else {
                                                  if (!rowMachineName) return;
                                                  const mObj = findMachine(rowMachineName);
                                                  setGenModal({ task, part, total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets, capacity: machineCapacity })
                                                }
                                              }}
                                              style={{
                                                background: (rowMachineName || isSplitMode) ? '#ff9000' : '#222',
                                                color: (rowMachineName || isSplitMode) ? '#000' : '#444',
                                                border: 'none',
                                                padding: '8px 15px',
                                                borderRadius: '8px',
                                                fontSize: '0.65rem',
                                                fontWeight: 900,
                                                cursor: (rowMachineName || isSplitMode) ? 'pointer' : 'not-allowed',
                                                textTransform: 'uppercase',
                                                opacity: (isSplitMode && splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0) > totalSheetsNeeded) ? 0.3 : 1
                                              }}
                                            >
                                              Генерувати
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
                      const groupHistory = taskHistory.length > 0
                        ? taskHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))
                        : workCardHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

                      // Вироблено = всі картки що вже виготовлені (completed, at-buffer, на прийомці)
                      const groupProduced = activeCards.reduce((sum, c) => sum + (countAsProduced(c) ? (Number(c.quantity) || 0) : 0), 0)
                      const groupScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

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

                      const qCutWait = orderCards.filter(c => c.operation === 'Розкрій' && c.status === 'new').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qCut = orderCards.filter(c => c.operation === 'Розкрій' && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qCutBuf = orderCards.filter(c => c.operation === 'Розкрій' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qGalt = orderCards.filter(c => c.operation === 'Галтовка' && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qGaltBuf = orderCards.filter(c => c.operation === 'Галтовка' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qPriyCards = orderCards.filter(c => c.operation === 'Прийомка').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qSortAct = orderCards.filter(c => c.operation === 'Сортування' && ['in-progress', 'at-buffer'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qSortCards = orderCards.filter(c => c.status === 'at-shop2-buffer').reduce((sum, c) => sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
                      const qMalWait = orderCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'new').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qMal = orderCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qMalBuf = orderCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qPres = orderCards.filter(c => c.operation === 'Пресування' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qPresBuf = orderCards.filter(c => c.operation === 'Пресування' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qDoop = orderCards.filter(c => c.operation === 'Доопрацювання' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                      const qDoopBuf = orderCards.filter(c => c.operation === 'Доопрацювання' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                      const qBz = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom?.id) && i.type === 'bz').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
                      const qBzShop2 = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom?.id) && i.type === 'bz_shop2').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
                      const qSgp = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom?.id) && (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP')).reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

                      const unitsPerSheet = Number(nom?.units_per_sheet) || 1;
                      const plannedSheets = snapshot?.sheets || 0;
                      const stockBZ = snapshot?.stock || 0;

                      const totalSheets = activeCards.reduce((sum, c) => {
                        if (c.operation === 'Склад БЗ') return sum
                        const cardScrap = groupHistory
                          .filter(h => String(h.card_id) === String(c.id))
                          .reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
                        const originalQty = (Number(c.quantity) || 0) + cardScrap
                        return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
                      }, 0)
                      
                      const totalSheetsMax = Math.max(plannedSheets, totalSheets)
                      const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
                      const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

                      const stages = activeCards.reduce((acc, c) => {
                        if (c.status === 'new') acc.waiting++
                        else if (c.status === 'completed') acc.reception++
                        else if (c.status === 'at-buffer' || c.status === 'waiting-buffer') acc.reception++ // Буфер = фактично готово
                        else if (c.operation?.includes('Розкрій')) acc.cutting++
                        else if (c.operation?.includes('Галтовка')) acc.tumbling++
                        else if (c.operation?.includes('Прийомка')) acc.reception++
                        return acc
                      }, { waiting: 0, cutting: 0, tumbling: 0, reception: 0 })

                      return (
                        <div key={nomId} className="nomenclature-archive-group" style={{ marginBottom: '0' }}>
                          <div
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [nomId]: !prev[nomId] }))}
                            style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#111', padding: '12px 20px', borderRadius: '12px', border: '1px solid #222', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#fff' }}>{nom?.name || 'Невідома деталь'}</div>
                              <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '2px', fontWeight: 700 }}>
                                Потреба: <span style={{ color: '#aaa' }}>{need}</span> |{' '}
                                Вироблено: <span style={{ color: '#3b82f6' }}>{groupProduced}</span> |{' '}
                                БЗ: <span style={{ color: groupProduced - need >= 0 ? '#10b981' : '#aaa' }}>
                                  {groupProduced - need > 0
                                    ? `+${groupProduced - need}`
                                    : '+0'
                                  }
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                                КАРТОК: <span style={{ color: '#fff' }}>{activeCards.length}</span>
                                <small style={{ marginLeft: '10px', color: '#333' }}>
                                  ({stages.waiting > 0 && <span style={{ color: '#eab308' }}>{stages.waiting} </span>}
                                  {stages.reception > 0 && <span style={{ color: '#10b981' }}>Готові: {stages.reception}</span>})
                                </small>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, paddingLeft: '10px' }}>
                                ПРИЙНЯТО: <span style={{ color: '#3b82f6' }}>{groupProduced}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: groupScrap > 0 ? '#ef4444' : '#333', fontWeight: 950 }}>
                                БРАК: {groupScrap}
                              </div>
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
                              {shortage > 0 && task.status !== 'completed' && (
                                <div onClick={(e) => e.stopPropagation()} style={{ padding: '4px 12px', borderRadius: '8px', background: '#ef444422', border: '1px solid #ef444444', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 950 }}>НЕСТАЧА: {shortage}</div>
                                  <button
                                    onClick={() => {
                                      const unitsPerSheet = Number(nom?.units_per_sheet) || 1;
                                      const sheetsNeeded = Math.ceil(shortage / unitsPerSheet);
                                      const activeCardMachine = activeCards[0]?.machine || (task.plan_snapshot?.[String(nom?.id)]?.machine);
                                      const resolvedMachine = findMachine(activeCardMachine) || findMachine(MACHINE_TYPES[0]);
                                      const machineName = MACHINE_TYPES.find(t => t === resolvedMachine?.type || t === resolvedMachine?.name) || resolvedMachine?.name || MACHINE_TYPES[0];
                                      const capacity = Number(resolvedMachine?.sheet_capacity) || 1;
                                      const cardsNeeded = Math.ceil(sheetsNeeded / capacity);
                                      setGenModal({ task, part: { nom }, total: cardsNeeded, targetTotal: cardsNeeded, requirement: shortage, created: 0, machineName, sheets: sheetsNeeded, isRepair: true, capacity })
                                    }}
                                    disabled={activeCards.some(c => ['new', 'waiting-materials'].includes(c.status) && (c.card_info || '').includes('[REDO]'))}
                                    style={{
                                      background: activeCards.some(c => ['new', 'waiting-materials'].includes(c.status) && (c.card_info || '').includes('[REDO]')) ? '#444' : '#ef4444',
                                      color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 900,
                                      cursor: activeCards.some(c => ['new', 'waiting-materials'].includes(c.status) && (c.card_info || '').includes('[REDO]')) ? 'not-allowed' : 'pointer',
                                      textTransform: 'uppercase',
                                      opacity: activeCards.some(c => ['new', 'waiting-materials'].includes(c.status) && (c.card_info || '').includes('[REDO]')) ? 0.6 : 1
                                    }}
                                  >
                                    {activeCards.some(c => ['new', 'waiting-materials'].includes(c.status) && (c.card_info || '').includes('[REDO]')) ? 'ВЖЕ ДОВИПУЩЕНО' : 'ДОВИПУСК'}
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                              {(() => {
                                const getCardSeq = (card) => {
                                  const match = (card.card_info || '').match(/(\d+)\/(\d+)/)
                                  return match ? parseInt(match[1]) : 999999
                                }
                                const sortedCards = [...activeCards].sort((a, b) => getCardSeq(a) - getCardSeq(b))

                                return sortedCards.map(card => {
                                  const loadingText = card.card_info?.split(' [')[0]
                                  const isRedo = (card.card_info || '').includes('[REDO]')
                                  const cardScrap = groupHistory
                                    .filter(h => String(h.card_id) === String(card.id))
                                    .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

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
                                      style={{ background: '#0f0f0f', padding: '15px', borderRadius: '20px', display: 'flex', gap: '15px', alignItems: 'center', border: `1px solid ${isRedo ? '#ef444444' : '#1a1a1a'}`, borderLeft: cardScrap > 0 ? '4px solid #ef4444' : `1px solid ${isRedo ? '#ef444444' : '#1a1a1a'}`, cursor: 'pointer', transition: '0.2s', position: 'relative' }}
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
                                })
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                    const cap = findMachine(s.machine)?.sheet_capacity || 1
                    const unitsPerSheet = genModal.part.nom?.units_per_sheet || 1
                    const sSheets = Number(s.sheets) || Math.ceil(s.qty / unitsPerSheet)
                    return acc + Math.ceil(sSheets / cap)
                  }, 0)

                  let currentGlobalOffset = 0
                  const existingNomenclatureCards = (workCards || []).filter(wc =>
                    String(wc.task_id) === String(genModal.task.id) &&
                    String(wc.nomenclature_id) === String(genModal.part.nom?.id)
                  )

                  return genModal.splits.map((split, sIdx) => {
                    const cap = findMachine(split.machine)?.sheet_capacity || 1
                    const unitsPerSheet = genModal.part.nom?.units_per_sheet || 1
                    const splitSheets = Number(split.sheets) || Math.ceil(split.qty / unitsPerSheet)
                    const capacityKey = `${genModal.part.nom?.id}_${sIdx}_cap`
                    const currentCapacity = customLoadingCapacities[capacityKey] ?? cap
                    const splitLoadings = Math.ceil(splitSheets / currentCapacity)
                    const splitQty = split.qty || (splitSheets * unitsPerSheet)
                    const qtyPerCard = Math.ceil(splitQty / splitLoadings)

                    // INTELLIGENT FILTERING:
                    // Instead of exact sheet matching (which fails for partials), 
                    // we count sheets for THIS MACHINE in order of splits.

                    // 1. Get ALL cards for this nomenclature that match the machine name
                    const machineCards = existingNomenclatureCards
                      .filter(wc => wc.machine === split.machine)
                      .sort((a, b) => a.id - b.id)

                    // 2. Determine which cards belong to THIS specific split index
                    const prevSplitsSameMachine = genModal.splits.slice(0, sIdx).filter(s => s.machine === split.machine)
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

                    const generatedCount = cardsBelongingToThisSplitCount
                    const isGenerated = sheetsUsedInThisSplit >= splitSheets
                    const remainingCount = Math.max(0, splitLoadings - generatedCount)

                    const splitGlobalOffsetForThisMachine = currentGlobalOffset
                    currentGlobalOffset += splitLoadings
                    const toGen = partialCounts[`${genModal.part.nom?.id}_${sIdx}`] ?? remainingCount

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
                          {isGenerated && <div style={{ fontSize: '0.55rem', color: '#444', marginTop: '2px' }}>Всі карти згенеровано ✅</div>}
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
                                style={{ width: '45px', background: '#000', border: '1px solid rgba(255,144,0,0.4)', color: '#ff9000', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                                title="Кількість листів на одну загрузку (картку)"
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900 }}>ДРУК</span>
                              <input
                                type="number"
                                min="1"
                                max={remainingCount}
                                value={toGen}
                                onChange={(e) => {
                                  const val = Math.min(remainingCount, Math.max(1, parseInt(e.target.value) || 1))
                                  setPartialCounts(prev => ({ ...prev, [`${genModal.part.nom?.id}_${sIdx}`]: val }))
                                }}
                                style={{ width: '45px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                              />
                            </div>
                            <button
                              disabled={isGenerating}
                              onClick={() => {
                                const finalToGen = Math.min(toGen, remainingCount)
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
                                  currentCapacity
                                )
                              }}
                              style={{ background: isGenerating ? '#333' : '#10b981', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950, cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: isGenerating ? 'none' : 'auto' }}
                            >
                              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                              {isGenerating ? 'ОБРОБКА...' : 'ГЕНЕРУВАТИ'}
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
                {genModal.isRepair ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                    {/* Machine selector */}
                    <div>
                      <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                        Оберіть верстат для довипуску:
                      </label>
                      <select
                        value={genModal.machineName}
                        onChange={(e) => {
                          const newMachineName = e.target.value
                          const resolvedMachine = findMachine(newMachineName)
                          const newCapacity = Number(resolvedMachine?.sheet_capacity) || 1
                          const newCardsNeeded = Math.ceil(genModal.sheets / newCapacity)
                          setGenModal(prev => ({ ...prev, machineName: newMachineName, total: Math.max(1, newCardsNeeded - (prev.created || 0)), targetTotal: newCardsNeeded }))
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

                    {/* Deficit info cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>НЕОБХІДНО ЛИСТІВ:</div>
                        <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{genModal.sheets} л.</div>
                      </div>
                      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>КІЛЬКІСТЬ КАРТ:</div>
                        <div style={{ color: '#ff9000', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{genModal.total} шт.</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#080808', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
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
                      const newTargetTotal = Math.ceil(genModal.sheets / safeCap);
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
                      const newTargetTotal = Math.ceil(genModal.sheets / v);
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

                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    {genModal.isRepair ? 'Кількість карт до друку' : 'Скільки ще карт згенерувати?'}
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

                <button
                  onClick={() => {
                    const v = parseInt(document.getElementById('gen_count_input').value)
                    if (v > 0) {
                      handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, v, genModal.created, genModal.requirement, genModal.isRepair, null, 0, genModal.capacity)
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

      {/* ───── ДРУК ───── */}
      {printQueue && (
        <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#111', color: '#000', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
          <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', padding: '15px 30px', background: '#111', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', zIndex: 100 }}>
            <h3>Друк: {printQueue.part.nom?.name}</h3>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>ДРУКУВАТИ</button>
              <button onClick={() => setPrintQueue(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
          </div>

          {printQueue.metadata.map((m, i) => {
            const order = orders.find(o => o.id === printQueue.task.order_id) || allOrdersMap[printQueue.task.order_id]
            const nomenclature = nomenclatures.find(n => n.id === (printQueue.part.nomenclature_id || printQueue.part.nom?.id))
            const currentDate = new Date().toLocaleDateString('uk-UA')
            const finishedProduct = order?.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id) : null
            const formatTime = (seconds) => {
              const h = Math.floor(seconds / 3600)
              const min = Math.floor((seconds % 3600) / 60)
              if (h > 0) return `${h}год ${min}хв`
              return `${min}хв`
            }

            // Dynamically resolve operations
            const mac = machines.find(mac => mac.name === m.machine)
            const opData = machineOperations?.find(o =>
              o.nomenclature_id === nomenclature?.id &&
              (o.machine_type === m.machine || (mac && o.machine_id === mac.id))
            )
            let s1Ops = (opData?.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
            let s2Ops = (opData?.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
            let s2CutOps = (opData?.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))

            const snapshotPart = printQueue.task.plan_snapshot?.[String(nomenclature?.id)]
            const isCutter1_5 = snapshotPart?.cutter_override === '1.5'

            if (isCutter1_5) {
              const replacer = (op) => {
                if (op.includes('|')) return op.split('|')[1].trim()
                return op.replace(/[фФ]2(?![0-9.])/g, match => match[0] === 'ф' ? 'ф1.5' : 'Ф1.5')
              }
              s1Ops = s1Ops.map(replacer)
              s2Ops = s2Ops.map(replacer)
            } else {
              const replacer = (op) => {
                if (op.includes('|')) return op.split('|')[0].trim()
                return op
              }
              s1Ops = s1Ops.map(replacer)
              s2Ops = s2Ops.map(replacer)
            }

            const s2CutOpsF2 = s2CutOps.map(op => {
              if (op.includes('|')) return op.split('|')[0].trim()
              return op.replace(/[фФ]1\.5(?![0-9.])/g, match => match[0] === 'ф' ? 'ф2' : 'Ф2')
            })
            const s2CutOpsF15 = s2CutOps.map(op => {
              if (op.includes('|')) return op.split('|')[1].trim()
              return op.replace(/[фФ]2(?![0-9.])/g, match => match[0] === 'ф' ? 'ф1.5' : 'Ф1.5')
            })

            const maxOps = Math.max(10, s1Ops.length, s2Ops.length, s2CutOpsF2.length, s2CutOpsF15.length)
            const opRows = Array.from({ length: maxOps }).map((_, i) => ({
              s1: s1Ops[i] || '',
              s2: s2Ops[i] || '',
              s2cF2: s2CutOpsF2[i] || '',
              s2cF15: s2CutOpsF15[i] || ''
            }))

            return (
              <div key={i} className="a4-page" style={{ width: '210mm', height: '297mm', background: '#fff', padding: '10mm', margin: '0 auto 40px auto', pageBreakAfter: i === printQueue.metadata.length - 1 ? 'avoid' : 'always', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1.5px solid #000' }}>
                  {[1, 2].map(blockIdx => (
                    <div key={blockIdx} style={{ borderBottom: '1.5px solid #000', marginBottom: blockIdx === 1 ? '20px' : '0' }}>
                      <div style={{ borderTop: blockIdx === 2 ? '1.5px solid #000' : 'none' }}>
                        <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Замовник</div>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Номер замовлення</div>
                          <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова дата відвантаження</div>
                          <div style={{ width: '15%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Дата</div>
                        </div>
                        <div style={{ display: 'flex', height: '24px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '25%', borderRight: '1px solid #000', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 950 }}>{order?.customer || '—'}</div>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 950 }}>{order?.order_num || '—'}</div>
                          <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '10pt', fontWeight: 950 }}>{order?.deadline ? new Date(order.deadline).toLocaleDateString('uk-UA') : '—'}</div>
                          <div style={{ width: '15%', fontSize: '11pt', fontWeight: 950 }}>{currentDate}</div>
                        </div>
                        <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Назва проєкту</div>
                          <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>К-сть листів</div>
                          <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Товщина, мм</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Тип станку</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>№ картки</div>
                          <div style={{ width: '18%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Системний номер</div>
                        </div>
                        <div style={{ display: 'flex', height: '26px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '9pt', fontWeight: 1000 }}>{finishedProduct?.name || '—'}</div>
                          <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '13pt', fontWeight: 1000 }}>
                            {Math.ceil(m.qty / (nomenclature?.units_per_sheet || 1))}
                          </div>
                          <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{getDisplayMaterial(nomenclature, snapshotPart)}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '7.5pt', fontWeight: 1000, padding: '0 2px' }}>{m.machine}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 1000 }}>{m.loading?.split(' [')[0]}</div>
                          <div style={{ width: '18%', fontSize: '11pt', fontWeight: 1000 }}>#{m.id.slice(-8).toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', height: '125px' }}>
                        <div style={{ width: '75%', borderRight: '1.5px solid #000', display: 'flex' }}>
                          <div style={{ width: '68%', borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Основна номенклатура</div>
                              <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова к-сть, шт</div>
                              <div style={{ width: '20%', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ЧПУ №</div>
                            </div>
                            <div style={{ display: 'flex', height: '28px', borderBottom: '1px solid #000', textAlign: 'center', alignItems: 'center' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, padding: '0 4px', lineHeight: 1.1 }}>{nomenclature?.name}</div>
                              <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '20pt', fontWeight: 1000 }}>{m.qty}</div>
                              <div style={{ width: '20%', fontSize: '11pt', fontWeight: 1000 }}></div>
                            </div>
                            <div style={{ display: 'flex', height: '30px', borderBottom: '1px solid #000' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span><div style={{ flex: 1 }}></div></div>
                              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span><div style={{ flex: 1 }}></div></div>
                            </div>
                            <div style={{ display: 'flex', height: '49px' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата початку / Час початку</span><div style={{ flex: 1 }}></div></div>
                              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата завершення / Час завершення</span><div style={{ flex: 1 }}></div></div>
                            </div>
                          </div>
                          <div style={{ width: '32%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                            <QRCodeSVG value={`CENTRUM_CARD_${m.id}`} size={105} />
                          </div>
                        </div>
                        <div style={{ width: '25%', display: 'flex', flexDirection: 'column' }}>
                          <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: '6pt' }}>
                            <tbody>
                              {[1, 2, 3].map(idx => (
                                <tr key={idx} style={{ height: '28px', borderBottom: '1px solid #000' }}>
                                  <td style={{ borderRight: '1px solid #000', width: '70%', background: '#fff' }}></td>
                                  <td style={{ textAlign: 'center', width: '30%' }}>
                                    <div style={{ fontSize: '5pt', fontWeight: 900, borderBottom: '1px solid #eee', textTransform: 'uppercase' }}>К-сть, шт</div>
                                    <div style={{ fontSize: '9pt', fontWeight: 1000 }}>0</div>
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ flex: 1, background: '#fff' }}>
                                <td colSpan="2" style={{ padding: '2px', textAlign: 'center' }}>
                                  <span style={{ fontSize: '6pt', fontWeight: 900, display: 'block', textTransform: 'uppercase', marginBottom: '1px' }}>План. час виконання</span>
                                  <span style={{ fontSize: '11pt', fontWeight: 1000 }}>{formatTime(m.estimatedTime || 0)}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '28px', margin: '4px 0' }}>
                    <div style={{ display: 'flex', border: '1.5px solid #000', height: '100%' }}>
                      <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>Листи відповідають</div>
                      <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>{nomenclature?.material_type || '—'}</div>
                      <div style={{ padding: '0 15px', display: 'flex', alignItems: 'center', fontSize: '14pt', fontWeight: 900 }}>☐</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                      <thead>
                        <tr style={{ background: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                          <td style={{ border: '1.5px solid #000', width: '22%', height: '36px' }}>Операція (1 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '11%', fontSize: '5.5pt', lineHeight: 1.2 }}>
                            Статус<br />виконання ☑<br />
                            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '2px 0', padding: '2px 0' }}>Лист | Лист</div>
                            1, 2 | 3, 4
                          </td>
                          <td style={{ border: '1.5px solid #000', width: '22%' }}>Операція (2 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '11%', fontSize: '5.5pt', lineHeight: 1.2 }}>
                            Статус<br />виконання ☑<br />
                            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '2px 0', padding: '2px 0' }}>Лист | Лист</div>
                            1, 2 | 3, 4
                          </td>
                          {!isCutter1_5 ? (
                            <td style={{ border: '1.5px solid #000', width: '26%', fontSize: '6.5pt', fontWeight: 'bold' }}>Операція (2 сторона вирізка)<br />Ф2мм</td>
                          ) : (
                            <td style={{ border: '1.5px solid #000', width: '26%', fontSize: '6.5pt', fontWeight: 'bold' }}>Операція (2 сторона вирізка)<br />Ф1.5мм</td>
                          )}
                          <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br />виконання<br />☑</td>
                        </tr>
                      </thead>
                      <tbody>
                        {opRows.map((row, idx) => (
                          <tr key={idx} style={{ height: '22px' }}>
                            <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s1}</td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: '2px' }}>☐ | ☐</td>
                            <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2}</td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: '2px' }}>☐ | ☐</td>
                            {!isCutter1_5 ? (
                              <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF2}</td>
                            ) : (
                              <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF15}</td>
                            )}
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>☐</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ border: '1.5px solid #000', borderTop: 'none', display: 'flex', height: '35px' }}>
                    <div style={{ width: '130px', borderRight: '1.5px solid #000', background: '#fff', fontWeight: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt' }}>Коментар</div>
                    <div style={{ flex: 1 }}></div>
                  </div>
                  <div style={{ border: '1.5px solid #000', marginTop: '4px', display: 'flex', flexDirection: 'column', fontSize: '7.5pt' }}>
                    <div style={{ display: 'flex', borderBottom: '1.5px solid #000', background: '#f5f5f5', fontWeight: 900, textAlign: 'center' }}>
                      <div style={{ width: '70%', padding: '4px', borderRight: '1.5px solid #000' }}>Кількість використаних фрез</div>
                      <div style={{ width: '30%', padding: '4px' }}>Загалом використано фрез</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: '70%', borderRight: '1.5px solid #000', display: 'flex' }}>
                        <div style={{ width: '50%', borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                            <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>1,5мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                          <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                            <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>2мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                          <div style={{ display: 'flex', height: '24px' }}>
                            <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>3мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                        </div>
                        <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '36px' }}>
                            <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>4мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                          <div style={{ display: 'flex', height: '36px' }}>
                            <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>6мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                        </div>
                      </div>
                      <div style={{ width: '30%', display: 'flex', flexDirection: 'column', fontWeight: 900, padding: '4px 8px', justifyContent: 'space-between' }}>
                        <div>1,5мм - </div>
                        <div>2мм - </div>
                        <div>3мм - </div>
                        <div>4мм - </div>
                        <div>6мм - </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '2px', border: '1.5px solid #000', display: 'flex', fontSize: '7.5pt', height: '60px' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '110px', padding: '2px', fontWeight: 1000, textAlign: 'center' }}>Причина браку:</div>
                        <div style={{ flex: 1, padding: '2px', fontSize: '5.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px' }}>
                          <div>☐ Биття цанги</div>
                          <div>☐ Помилка програми</div>
                          <div>☐ Збій станка</div>
                          <div>☐ Кривизна листа</div>
                          <div>☐ Поломка флешки</div>
                          <div>☐ Прив'язка</div>
                          <div>☐ Помилка оператора</div>
                          <div>☐ Інше (коментар)</div>
                        </div>
                      </div>
                      <div style={{ width: '120px', borderLeft: '1.5px solid #000', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ borderBottom: '1px solid #000', padding: '2px', fontWeight: 1000 }}>Кількість браку</div>
                        <div style={{ flex: 1 }}></div>
                      </div>
                      <div style={{ width: '140px', borderLeft: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ borderBottom: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 1000, fontSize: '6pt' }}>Корекція перегортання</div>
                        <div style={{ flex: 1, display: 'flex' }}>
                          <div style={{ flex: 1, borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '7pt', fontWeight: 900 }}>X</span>
                            <div style={{ flex: 1 }}></div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '7pt', fontWeight: 900 }}>Y</span>
                            <div style={{ flex: 1 }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ───── ДРУК НАРЯДУ ───── */}
      {printNaryadQueue && (() => {
        const { task, order, materialRequests } = printNaryadQueue

        let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
        if (!productNames && task.plan_snapshot) {
          productNames = Object.values(task.plan_snapshot)
            .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
            .filter(Boolean)
            .join(', ')
        }

        const isReworkOrder = order?.order_num?.startsWith('ВБ')

        const tableRows = []
        let totalNeed = 0
        let totalPlan = 0
        let totalSheets = 0

        const snapshot = task.plan_snapshot
        const hasSnapshot = snapshot && Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k)).length > 0

        if (hasSnapshot) {
          const keys = Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k))
          keys.forEach(nomId => {
            const snapEntry = snapshot[nomId]
            if (!snapEntry) return

            const need = Number(snapEntry.need) || 0
            const plan = Number(snapEntry.plan) || 0
            const sheets = Number(snapEntry.sheets) || 0
            const stockBZ = Number(snapEntry.stock) || 0
            const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
            const name = snapEntry.name || nomenclatures.find(n => String(n.id) === String(nomId))?.name || '—'
            const code = snapEntry.code || nomenclatures.find(n => String(n.id) === String(nomId))?.nomenclature_code || 'БЕЗ КОДУ'
            const material = snapEntry.material || nomenclatures.find(n => String(n.id) === String(nomId))?.material_type || '—'

            totalNeed += need
            totalPlan += plan
            totalSheets += sheets

            tableRows.push({
              name,
              code,
              need,
              stockBZ,
              plan,
              material,
              unitsPerSheet,
              sheets
            })
          })
        } else {
          order?.order_items?.forEach(item => {
            const parts = getBOMParts(item.nomenclature_id)
            const initialRows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
            const rows = initialRows.filter(r => r.nom?.type === 'part')

            rows.forEach((part, idx) => {
              const nomId = part.nom?.id
              const need = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
              const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz')
              const stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
              const plan = Math.max(0, need - stockBZ)
              const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
              const sheets = Math.ceil(plan / unitsPerSheet)

              totalNeed += need
              totalPlan += plan
              totalSheets += sheets

              tableRows.push({
                name: part.nom?.name || '—',
                code: part.nom?.nomenclature_code || 'БЕЗ КОДУ',
                need,
                stockBZ,
                plan,
                material: part.nom?.material_type || '—',
                unitsPerSheet,
                sheets
              })
            })
          })
        }

        // Materials summary — prefer plan_snapshot.materialSummary for correct Т700/Т300 names
        const materialsSummary = {}
        const snapshotMaterials = task?.plan_snapshot?.materialSummary
        if (snapshotMaterials && Object.keys(snapshotMaterials).length > 0) {
          // Use the saved materialSummary which has exact sheet type names (Лист Т700, Лист Т300 etc.)
          Object.values(snapshotMaterials).forEach(mat => {
            const name = mat.matName || mat.name || ''
            const qty = Number(mat.sheets) || 0
            if (name && qty > 0) {
              materialsSummary[name] = (materialsSummary[name] || 0) + qty
            }
          })
        } else {
          // Fallback: build from tableRows.material (less precise, no Т700/Т300 distinction)
          tableRows.forEach(row => {
            if (row.material && row.material !== '—' && row.sheets > 0) {
              materialsSummary[row.material] = (materialsSummary[row.material] || 0) + row.sheets
            }
          })
        }

        // Consumables summary
        const cuttersSummary = {}
        materialRequests.forEach(r => {
          let displayName = r.nomenclature?.name || ''
          if (!displayName && r.details) {
            const match = r.details.match(/:\s*(Фреза[^-—]+)(?:[-—]|$)/i)
            displayName = match ? match[1].trim() : r.details
          }
          if (displayName.toLowerCase().includes('фреза')) {
            cuttersSummary[displayName] = (cuttersSummary[displayName] || 0) + (Number(r.quantity) || 0)
          }
        })

        const formatDate = (dateStr) => {
          if (!dateStr) return '—'
          const date = new Date(dateStr)
          if (isNaN(date.getTime())) return '—'
          return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
        }

        return (
          <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#111', color: '#000', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', padding: '15px 30px', background: '#111', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', zIndex: 100 }}>
              <h3>Друк наряду: №{order?.order_num}</h3>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>ДРУКУВАТИ</button>
                <button onClick={() => setPrintNaryadQueue(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
              </div>
            </div>

            <div className="a4-page" style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '20mm', margin: '0 auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>
              <h1 style={{ fontSize: '24pt', fontWeight: 950, margin: '0 0 20px 0', textTransform: 'uppercase', color: '#000', letterSpacing: '-0.5px' }}>
                НАРЯД №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
              </h1>

              {/* Box Info */}
              <div style={{ border: '1.5px solid #000', borderRadius: '16px', padding: '18px', marginBottom: '30px' }}>
                <div style={{ fontSize: '12pt', fontWeight: 1000, borderBottom: '1.5px solid #000', paddingBottom: '10px', marginBottom: '12px', textTransform: 'uppercase' }}>
                  ВИРІБ: <span style={{ textDecoration: 'underline' }}>{productNames || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  <div>
                    <div style={{ fontSize: '6.5pt', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Замовник</div>
                    <div style={{ fontSize: '10pt', fontWeight: 950 }}>{order?.customer || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '6.5pt', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Дата формування</div>
                    <div style={{ fontSize: '10pt', fontWeight: 950 }}>{formatDate(task.created_at)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '6.5pt', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Дедлайн на цю партію</div>
                    <div style={{ fontSize: '10pt', fontWeight: 950 }}>{formatDate(order?.deadline)}</div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '9pt' }}>
                <thead>
                  <tr style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', textAlign: 'left', fontWeight: 900, textTransform: 'uppercase', fontSize: '7pt' }}>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #000', width: '40%' }}>Деталь в розкрій</th>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '10%' }}>Потреба</th>
                    {!isReworkOrder && (
                      <>
                        <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '10%' }}>Склад БЗ</th>
                        <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '10%' }}>План</th>
                      </>
                    )}
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '18%' }}>Матеріал</th>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '6%' }}>Шт/л</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '10%' }}>Листів</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000' }}>
                        <div style={{ fontWeight: 900 }}>{row.name}</div>
                        <div style={{ fontSize: '7pt', color: '#666' }}>{row.code}</div>
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 800 }}>{row.need}</td>
                      {!isReworkOrder && (
                        <>
                          <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', color: '#555' }}>{row.stockBZ}</td>
                          <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 850 }}>{row.plan}</td>
                        </>
                      )}
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', fontSize: '8pt' }}>{row.material}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center' }}>{row.unitsPerSheet}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 1000, fontSize: '10pt' }}>{row.sheets}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', fontWeight: 950, textTransform: 'uppercase', background: '#fcfcfc' }}>
                    <td style={{ padding: '10px', borderRight: '1px solid #000' }}>Загальний підсумок:</td>
                    <td style={{ padding: '10px', borderRight: '1px solid #000', textAlign: 'center' }}>{totalNeed}</td>
                    {!isReworkOrder && (
                      <>
                        <td style={{ padding: '10px', borderRight: '1px solid #000' }}></td>
                        <td style={{ padding: '10px', borderRight: '1px solid #000', textAlign: 'center' }}>{totalPlan}</td>
                      </>
                    )}
                    <td style={{ padding: '10px', borderRight: '1px solid #000' }}></td>
                    <td style={{ padding: '10px', borderRight: '1px solid #000' }}></td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '11pt' }}>{totalSheets}</td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom blocks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Materials Summary */}
                <div style={{ border: '1.5px solid #000', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#555', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    Відомість матеріалів:
                  </div>
                  {Object.keys(materialsSummary).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                      {Object.entries(materialsSummary).map(([mat, qty]) => (
                        <div key={mat} style={{ borderLeft: '3.5px solid #000', paddingLeft: '10px', minWidth: '160px' }}>
                          <div style={{ fontSize: '8pt', color: '#555', fontWeight: 600 }}>{mat}</div>
                          <div style={{ fontSize: '13pt', fontWeight: 1000, marginTop: '2px' }}>{qty} листів</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '9pt', color: '#888' }}>Немає запланованих матеріалів</div>
                  )}
                </div>

                {/* Consumables Summary */}
                <div style={{ border: '1.5px solid #000', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#555', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    Витратні матеріали:
                  </div>
                  {Object.keys(cuttersSummary).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                      {Object.entries(cuttersSummary).map(([name, qty]) => (
                        <div key={name} style={{ borderLeft: '3.5px solid #000', paddingLeft: '10px', minWidth: '160px' }}>
                          <div style={{ fontSize: '8pt', color: '#555', fontWeight: 600 }}>{name}</div>
                          <div style={{ fontSize: '13pt', fontWeight: 1000, marginTop: '2px' }}>{qty} од.</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                      <div style={{ borderLeft: '3.5px solid #000', paddingLeft: '10px', minWidth: '160px' }}>
                        <div style={{ fontSize: '8pt', color: '#555', fontWeight: 600 }}>Фреза</div>
                        <div style={{ fontSize: '13pt', fontWeight: 1000, marginTop: '2px' }}>— од.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ───── СКАНЕР ───── */}
      {isBufferScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 25000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsBufferScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#333', color: '#fff', padding: '15px', borderRadius: '50%', border: 'none' }}>
            <X size={32} />
          </button>
          <div id="buffer-reader" style={{ width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden' }}></div>
        </div>
      )}

      {/* ───── МОДАЛ БРАКУ БУФЕРА ───── */}
      {bufferScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', width: '400px', padding: '30px', borderRadius: '20px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 20px' }}>ПРИЙОМКА НА БУФЕР</h3>
            <div style={{ marginBottom: '20px' }}>
              <label>Кількість браку:</label>
              <input
                type="number"
                style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #333', padding: '10px' }}
                value={bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0}
                onChange={e => setBufferScrapCounts({ ...bufferScrapCounts, [bufferScrapModal.nomenclature_id]: parseInt(e.target.value) || 0 })}
              />
            </div>
            <button onClick={submitBufferReception} style={{ width: '100%', background: '#10b981', color: '#fff', padding: '15px', borderRadius: '10px', border: 'none' }}>
              ПІДТВЕРДИТИ
            </button>
          </div>
        </div>
      )}

      {/* ───── МОДАЛ ЗВІТУ ПО НАРЯДУ ───── */}
      {showReportModal && (
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
                <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 800 }}>Формування звіту...</span>
              </div>
            ) : reportData ? (() => {
              const currentTask = relevantTasks.find(t => t.id === reportTaskId) || tasks.find(t => t.id === reportTaskId)
              if (!currentTask) return <div>Наряд не знайдено</div>
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
                    unitsPerSheet: Number(snapEntry.units_per_sheet) || (nom?.units_per_sheet || 1),
                    material: snapEntry.material || nom?.material_type || '—'
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
                    const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz')
                    const stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                    const plan = Math.max(0, need - stockBZ)
                    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                    const sheets = Math.ceil(plan / unitsPerSheet)
                    const material = part.nom?.material_type || '—'

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
                  n.name.includes('[Підготовлений]') &&
                  (n.name.toLowerCase().includes(typePrefix.toLowerCase()) || (typePrefix === 'Т300' && !n.name.toLowerCase().includes('т700') && !n.name.toLowerCase().includes('t700'))) &&
                  n.name.toLowerCase().replace(/\s+/g, '').includes(`(${thickness.toLowerCase()})`)
                )
                return rawNom ? rawNom.name : `Лист ${typePrefix} (${thickness}) [Підготовлений]`
              }

              partsList.forEach(p => {
                const partHistory = reportData.historyRows.filter(h => String(h.nomenclature_id) === String(p.nomId))
                const cuttingHistory = partHistory.filter(h => h.stage_name === 'Розкрій')
                const acceptedHistory = partHistory.filter(h => h.stage_name === 'Прийомка' || h.stage_name === 'completed')

                const totalQtyDone = cuttingHistory.reduce((s, h) => s + (Number(h.qty_completed) || 0), 0)
                const sheetsDone = p.unitsPerSheet > 0 ? Math.ceil(totalQtyDone / p.unitsPerSheet) : 0

                const acceptedQty = acceptedHistory.reduce((s, h) => s + (Number(h.qty_completed) || 0), 0)

                totalPlannedSheets += (p.sheets || 0)
                totalActualSheets += sheetsDone
                totalPlannedParts += (p.plan || 0)
                totalActualParts += acceptedQty

                // Get planned splits from snapshot
                const snapEntry = snapshot?.[p.nomId]
                const isDefaultT700 = (p.material || '').toLowerCase().includes('т700') || (p.material || '').toLowerCase().includes('t700')
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

                const rawMat = p.material || '—'
                const thickMatch = rawMat.match(/(\d+(?:\.\d+)?)мм/i)
                const thickness = thickMatch ? `${thickMatch[1]}мм` : null

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
                  const t300Name = getMaterialName('Т300', thickness)
                  const t700Name = getMaterialName('Т700', thickness)

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
                return nomName.includes('фреза') || detailsStr.includes('фреза')
              })
              const totalPlannedCutters = cutterRequests.length > 0
                ? cutterRequests.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
                : 0

              const plannedCuttersBreakdown = {}
              cutterRequests.forEach(r => {
                const name = r.nomenclature?.name || 'Фреза'
                plannedCuttersBreakdown[name] = (plannedCuttersBreakdown[name] || 0) + (Number(r.quantity) || 0)
              })

              const actualCuttersBreakdown = {}
              reportData.historyRows.forEach(row => {
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
                    const name = 'Фреза (без деталей)'
                    actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
                  } else {
                    const name = 'Фреза'
                    actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
                  }
                }
              })

              const totalActualCutters = Object.keys(actualCuttersBreakdown).length > 0
                ? Object.values(actualCuttersBreakdown).reduce((sum, val) => sum + val, 0)
                : reportData.historyRows.reduce((sum, row) => sum + (Number(row.cutters_used) || 0), 0)

              const totalActualMs = reportData.historyRows.reduce((sum, row) => {
                if (row.started_at && row.completed_at) {
                  const diff = new Date(row.completed_at) - new Date(row.started_at)
                  return sum + (diff > 0 ? diff : 0)
                }
                return sum
              }, 0)
              const totalActualSeconds = Math.round(totalActualMs / 1000)

              const formatDurationHMS = (totalSeconds) => {
                if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '—'
                const hours = Math.floor(totalSeconds / 3600)
                const minutes = Math.floor((totalSeconds % 3600) / 60)
                const seconds = Math.floor(totalSeconds % 60)
                const pad = (num) => String(num).padStart(2, '0')
                return `${pad(hours)}год. ${pad(minutes)}хв. ${pad(seconds)}с`
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>
                      <Clock size={14} /> Звіт по виробництву цеху №1
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>
                      Наряд №{currentOrder?.order_num}{currentTask.batch_index ? `/${currentTask.batch_index}` : ''}
                    </h3>
                    <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '6px', fontWeight: 700 }}>
                      Виріб: <strong style={{ color: '#ef4444' }} className="text-accent-red">{productNames || '—'}</strong>
                      {currentOrder?.customer && ` | Замовник: ${currentOrder.customer}`}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', marginBottom: '30px' }}>

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Час виконання</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>План: <strong style={{ color: '#fff' }}>{currentTask.estimated_time ? formatDurationHMS(Number(currentTask.estimated_time) * 60) : '—'}</strong></div>
                        <div>Факт: <strong style={{ color: '#3b82f6' }} className="text-accent-blue">{formatDurationHMS(totalActualSeconds)}</strong></div>
                      </div>
                    </div>

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Фрези (Розкрій)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
                          <span>План: <strong style={{ color: '#fff' }}>{totalPlannedCutters} шт</strong></span>
                          <span>Факт: <strong style={{ color: '#eab308' }} className="text-accent-orange">{totalActualCutters} шт</strong></span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(() => {
                            const allCutterNames = Array.from(new Set([
                              ...Object.keys(plannedCuttersBreakdown),
                              ...Object.keys(actualCuttersBreakdown)
                            ]))
                            if (allCutterNames.length === 0) {
                              return <div style={{ fontSize: '0.65rem', color: '#444', textAlign: 'center' }}>Немає витрат фрез</div>
                            }
                            return allCutterNames.map(name => {
                              const planVal = plannedCuttersBreakdown[name] || 0
                              const factVal = actualCuttersBreakdown[name] || 0
                              const isExcess = factVal > planVal
                              return (
                                <div key={name} style={{ fontSize: '0.68rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                                  <div style={{ color: isExcess ? '#ef4444' : '#aaa', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name} className={isExcess ? 'text-accent-red' : ''}>
                                    {isExcess && '⚠️ '}{name}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#888' }}>
                                    <span>План: <strong style={{ color: '#bbb' }}>{planVal} шт</strong></span>
                                    <span>Факт: <strong style={{ color: isExcess ? '#ef4444' : '#bbb' }} className={isExcess ? 'text-accent-red' : 'text-accent-orange'}>{factVal} шт</strong></span>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Листи (Матеріал)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
                          <span>План: <strong style={{ color: '#fff' }}>{totalPlannedSheets} л.</strong></span>
                          <span>Факт: <strong style={{ color: totalActualSheets > totalPlannedSheets ? '#ef4444' : '#10b981' }} className={totalActualSheets > totalPlannedSheets ? 'text-accent-red' : 'text-accent-green'}>{totalActualSheets} л.</strong></span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {Object.entries(materialStats).length > 0 ? (
                            Object.entries(materialStats).map(([matName, stats]) => {
                              const isExcess = stats.actualSheets > stats.plannedSheets
                              return (
                                <div key={matName} style={{ fontSize: '0.68rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                                  <div style={{ color: isExcess ? '#ef4444' : '#aaa', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={matName} className={isExcess ? 'text-accent-red' : ''}>
                                    {isExcess && '⚠️ '}{matName}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#888' }}>
                                    <span>План: <strong style={{ color: '#bbb' }}>{stats.plannedSheets} л.</strong></span>
                                    <span>Факт: <strong style={{ color: isExcess ? '#ef4444' : '#bbb' }} className={isExcess ? 'text-accent-red' : 'text-accent-green'}>{stats.actualSheets} л.</strong></span>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div style={{ color: '#444', fontSize: '0.65rem', fontStyle: 'italic' }}>Немає запланованих матеріалів</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Деталі та Брак</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>План:</span>
                          <strong style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{totalPlannedParts} шт</strong>
                        </div>

                        {/* Прийнято: Clickable for breakdown */}
                        <div
                          onClick={() => setReportDetailModal('accepted')}
                          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                          onMouseLeave={e => e.currentTarget.style.opacity = 1}
                          title="Клікніть для деталізації прийнятих деталей"
                        >
                          <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>Прийнято:</span>
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
                            {totalActualParts} шт
                          </strong>
                        </div>

                        {/* Брак: Clickable for breakdown */}
                        <div
                          onClick={() => setReportDetailModal('scrap')}
                          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                          onMouseLeave={e => e.currentTarget.style.opacity = 1}
                          title="Клікніть для деталізації браку за етапами"
                        >
                          <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>Брак:</span>
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
                            {totalScrap} шт
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
                        } else if (timeStats.buffers[row.stage_name]) {
                          timeStats.buffers[row.stage_name].total += sec
                          timeStats.buffers[row.stage_name].count += 1
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
                                  c.operation === stageName
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
                            onClick={() => setReportStageFilter(stage)}
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

                  {(() => {
                    const filteredRows = (reportData.historyRows || []).filter(row => {
                      if (reportStageFilter === 'All') return true
                      if (reportStageFilter === 'Прийомка') {
                        return row.stage_name === 'Прийомка' || row.stage_name === 'completed'
                      }
                      return row.stage_name === reportStageFilter
                    })

                    if (filteredRows.length === 0) {
                      return (
                        <div style={{ padding: '30px', textAlign: 'center', background: '#111', borderRadius: '16px', color: '#555', fontSize: '0.85rem' }}>
                          Операцій на етапі "{reportStageFilter === 'All' ? 'Всі етапи' : reportStageFilter}" ще не проводилось.
                        </div>
                      )
                    }

                    return (
                      <div style={{ background: '#111', borderRadius: '18px', overflow: 'hidden', border: '1px solid #222' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#161616', color: '#888', textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 900, borderBottom: '1px solid #222' }}>
                              <th style={{ padding: '12px 15px' }}>Час початку</th>
                              <th style={{ padding: '12px 15px' }}>Час завершення</th>
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
                            {filteredRows.map((row, idx) => {
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

                              return (
                                <tr key={row.id || idx} style={{ borderBottom: idx < filteredRows.length - 1 ? '1px solid #222' : 'none' }}>
                                  <td style={{ padding: '12px 15px', color: '#888', fontWeight: 600 }}>{startTime}</td>
                                  <td style={{ padding: '12px 15px', color: '#aaa', fontWeight: 700 }}>{completedTime}</td>
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
                                      <span style={{ color: '#ef4444', marginLeft: '5px' }}>(брак: {row.scrap_qty})</span>
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