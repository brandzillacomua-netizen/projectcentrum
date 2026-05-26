const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/ForemanWorkplace.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Move countAsProduced to the top of ForemanWorkplace component
const topMatch = `const ForemanWorkplace = () => {
  const location = useLocation()
  const { tasks, orders, workCards, createWorkCard, createWorkCardsBatch, inventory, completeTaskByMaster, nomenclatures, bomItems, machines, machineOperations, workCardHistory, confirmBuffer, fetchData, reserveBZForTask, fetchTaskArchiveCards, fetchModuleData, machineCalls, currentUser } = useMES()`;

const topReplacement = `const ForemanWorkplace = () => {
  const location = useLocation()
  const { tasks, orders, workCards, createWorkCard, createWorkCardsBatch, inventory, completeTaskByMaster, nomenclatures, bomItems, machines, machineOperations, workCardHistory, confirmBuffer, fetchData, reserveBZForTask, fetchTaskArchiveCards, fetchModuleData, machineCalls, currentUser } = useMES()

  const countAsProduced = (card) => {
    if (card.status === 'completed' && card.operation === 'Прийомка') return true
    if (card.status === 'completed' && !card.operation) return true
    if (card.status === 'at-shop2-buffer') return true
    return false
  }`;

if (!content.includes(topMatch)) {
  console.error("Top match not found!");
  process.exit(1);
}
content = content.replace(topMatch, topReplacement);

// 2. Remove countAsProduced from the bottom (matching function directly, ignoring comments)
const bottomMatch = `  const countAsProduced = (card) => {
    // completed + Прийомка = офіційно прийнято на склад ✅
    if (card.status === 'completed' && card.operation === 'Прийомка') return true
    // completed без operation = старий формат (до впровадження операцій) ✅
    if (card.status === 'completed' && !card.operation) return true
    // at-shop2-buffer = пройшло Прийомку та Сортування, передано в буфер Цеху №2 ✅
    if (card.status === 'at-shop2-buffer') return true
    // Все інше (at-buffer Розкрій, at-buffer Галтовка, in-progress) = ще в роботі ❌
    return false
  }`;

if (!content.includes(bottomMatch)) {
  console.error("Bottom match not found!");
  process.exit(1);
}
content = content.replace(bottomMatch, '');

// 3. Replace state declarations
const statesMatch = `  const [archiveCards, setArchiveCards] = useState([]) // Завершені картки (статус completed) для поточного наряду
  // Local cache: orders for ALL relevant tasks, bypasses global pagination (PAGE_SIZE=20)
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [productionCache, setProductionCache] = useState({}) // { taskId: { nomId: producedQty } }`;

const statesReplacement = `  const [archiveCards, setArchiveCards] = useState([]) // Завершені картки (статус completed) для поточного наряду
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [taskHistory, setTaskHistory] = useState([])
  const [staticCompletedCards, setStaticCompletedCards] = useState([])
  const [staticHistory, setStaticHistory] = useState([])`;

if (!content.includes(statesMatch)) {
  console.error("States match not found!");
  process.exit(1);
}
content = content.replace(statesMatch, statesReplacement);

// 4. Replace production cache useEffect
const effectMatch = `  // ── Load production progress for ALL relevant tasks ──────────────
  useEffect(() => {
    if (tasks.length === 0) return;
    
    const taskIds = tasks.filter(t => t.status !== 'completed').map(t => t.id);
    if (taskIds.length === 0) return;

    // Fetch ALL completed/shop2-buffer cards for these tasks to get accurate progress
    supabase
      .from('work_cards')
      .select('task_id, nomenclature_id, quantity, operation, status')
      .in('task_id', taskIds)
      .in('status', ['completed', 'at-shop2-buffer'])

      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching production cache:', error);
          return;
        }
        
        const cache = {};
        data.forEach(card => {
          if (!countAsProduced(card)) return;
          if (!cache[card.task_id]) cache[card.task_id] = {};
          const tid = card.task_id;
          const nid = String(card.nomenclature_id);
          cache[tid][nid] = (cache[tid][nid] || 0) + (Number(card.quantity) || 0);
        });
        setProductionCache(cache);
      });
  }, [tasks]); // Update when tasks change; workCards updates flow through realtime subscription`;

const effectReplacement = `  // ── Load static completed progress for ALL relevant tasks ──────────────
  useEffect(() => {
    if (tasks.length === 0) return;
    
    const taskIds = tasks.filter(t => t.status !== 'completed').map(t => t.id);
    if (taskIds.length === 0) return;

    supabase
      .from('work_cards')
      .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
      .in('task_id', taskIds)
      .eq('status', 'completed')
      .then(async ({ data: cardsData, error: cardsError }) => {
        if (cardsError) {
          console.error('Error fetching completed cards:', cardsError);
          return;
        }
        setStaticCompletedCards(cardsData || []);

        const cardIds = (cardsData || []).map(c => c.id);
        if (cardIds.length > 0) {
          const chunkSize = 500;
          const promises = [];
          for (let i = 0; i < cardIds.length; i += chunkSize) {
            const chunk = cardIds.slice(i, i + chunkSize);
            promises.push(
              supabase
                .from('work_card_history')
                .select('card_id, nomenclature_id, scrap_qty')
                .in('card_id', chunk)
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

  // ── Compute production, scrap, and redo caches in memory ──────────────
  const { productionCache, scrapCache, redoCache, allCardsCache } = useMemo(() => {
    const prodCache = {};
    const sCache = {};
    const rCache = {};

    const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id));
    const activeCards = workCards.filter(c => activeTaskIds.has(c.task_id));
    const allCards = [...activeCards, ...staticCompletedCards];

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
    const activeHistory = workCardHistory.filter(h => h.card_id && activeCardIds.has(h.card_id));
    const allHistory = [...staticHistory, ...activeHistory];

    allHistory.forEach(h => {
      const card = allCards.find(c => c.id === h.card_id);
      if (card) {
        const tid = card.task_id;
        const nid = String(h.nomenclature_id);
        if (!sCache[tid]) sCache[tid] = {};
        sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0);
      }
    });

    return {
      productionCache: prodCache,
      scrapCache: sCache,
      redoCache: rCache,
      allCardsCache: allCards
    };
  }, [tasks, workCards, workCardHistory, staticCompletedCards, staticHistory]);`;

if (!content.includes(effectMatch)) {
  console.error("Effect match not found!");
  process.exit(1);
}
content = content.replace(effectMatch, effectReplacement);

// 5. Replace archive fetch useEffect to also load taskHistory
const archiveMatch = `  // Підвантажуємо архівні картки при зміні активного наряду
  useEffect(() => {
    if (activeTaskId) {
      fetchTaskArchiveCards(activeTaskId).then(cards => {
        setArchiveCards(cards || [])
      })
    } else {
      setArchiveCards([])
    }
  }, [activeTaskId, workCards]) // workCards — тригер після будь-якого оновлення`;

const archiveReplacement = `  // Підвантажуємо архівні картки та історію при зміні активного наряду
  useEffect(() => {
    if (activeTaskId) {
      fetchTaskArchiveCards(activeTaskId).then(async (cards) => {
        setArchiveCards(cards || [])
        
        const activeTaskCards = workCards.filter(c => c.task_id === activeTaskId)
        const allTaskCards = [...activeTaskCards, ...(cards || [])]
        const cardIds = allTaskCards.map(c => c.id)
        if (cardIds.length > 0) {
          const { data: histData } = await supabase
            .from('work_card_history')
            .select('*')
            .in('card_id', cardIds)
          setTaskHistory(histData || [])
        } else {
          setTaskHistory([])
        }
      })
    } else {
      setArchiveCards([])
      setTaskHistory([])
    }
  }, [activeTaskId, workCards]) // workCards — тригер після будь-якого оновлення`;

if (!content.includes(archiveMatch)) {
  console.error("Archive match not found!");
  process.exit(1);
}
content = content.replace(archiveMatch, archiveReplacement);

// 6. Replace taskReadinessMap
const readinessMatch = `  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
      
      // Combine global workCards (active) + our productionCache (completed)
      const taskCache = productionCache[task.id] || {}
      const activeCards = workCards.filter(c => c.task_id === task.id)
      
      const isReady = order?.order_items?.every(item => {
        const parts = bomItems
          .filter(b => b.parent_id === item.nomenclature_id)
          .map(b => ({ ...b, nom: nomenclatures.find(n => n.id === b.child_id) }))
        const rows = parts.length > 0
          ? parts
          : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
        const shop1Parts = rows.filter(r => r.nom?.type === 'part')
        if (shop1Parts.length === 0) return true
        return shop1Parts.every(part => {
          const nomId = String(part.nom?.id)
          const snapshot = task.plan_snapshot?.[nomId]
          const need = snapshot
            ? snapshot.need
            : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
          if (need === 0) return true
          
          const producedInCache = taskCache[nomId] || 0
          const producedInActive = activeCards
            .filter(c => String(c.nomenclature_id) === nomId)
            .reduce((sum, c) => sum + (countAsProduced(c) ? Number(c.quantity) : 0), 0)
          
          return (producedInCache + producedInActive) >= need
        })
      })
      map[task.id] = Boolean(isReady)
    })
    return map
  }, [tasks, orders, allOrdersMap, workCards, nomenclatures, bomItems, productionCache])`;

const readinessReplacement = `  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
      
      const taskCache = productionCache[task.id] || {}
      
      const isReady = order?.order_items?.every(item => {
        const parts = getBOMParts(item.nomenclature_id)
        const rows = parts.length > 0
          ? parts
          : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
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
  }, [tasks, orders, allOrdersMap, nomenclatures, bomItems, productionCache, allCardsCache])`;

if (!content.includes(readinessMatch)) {
  console.error("Readiness match not found!");
  process.exit(1);
}
content = content.replace(readinessMatch, readinessReplacement);

// 7. Replace taskShortageMap
const shortageMatch = `  // 0b. Per-task shortage map — needs ДОВИПУСК (scrap exceeded BZ buffer, no REDO card yet)
  const taskShortageMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskCards = workCards.filter(c => c.task_id === task.id)
      const cardIds = taskCards.map(c => String(c.id))
      const taskHistory = workCardHistory.filter(h => cardIds.includes(String(h.card_id)))
      let hasShortage = false
      Object.keys(snapshot).forEach(nomIdStr => {
        if (hasShortage) return
        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
        if (nom?.type !== 'part') return
        const snap = snapshot[nomIdStr]
        if (!snap) return
        const need = snap.need || 0
        const unitsPerSheet = snap.units_per_sheet || 1
        const sheets = snap.sheets || 0
        const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
        const groupScrap = taskHistory
          .filter(h => activeCards.some(c => String(c.id) === String(h.card_id)))
          .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
        const initialBZ = (sheets * unitsPerSheet) - need
        const shortage = (initialBZ - groupScrap) < 0 ? Math.abs(initialBZ - groupScrap) : 0
        // Needs ДОВИПУСК: shortage > 0 AND no REDO card generated yet
        if (shortage > 0 && !activeCards.some(c => (c.card_info || '').includes('[REDO]'))) {
          hasShortage = true
        }
      })
      map[task.id] = hasShortage
    })
    return map
  }, [tasks, workCards, workCardHistory, nomenclatures])`;

const shortageReplacement = `  const taskShortageMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskScrap = scrapCache[task.id] || {}
      const taskRedo = redoCache[task.id] || {}
      
      let hasShortage = false
      Object.keys(snapshot).forEach(nomIdStr => {
        if (hasShortage) return
        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
        if (nom?.type !== 'part') return
        const snap = snapshot[nomIdStr]
        if (!snap) return
        
        const need = snap.need || 0
        const unitsPerSheet = snap.units_per_sheet || 1
        const sheets = snap.sheets || 0
        const initialBZ = (sheets * unitsPerSheet) - need
        
        const groupScrap = taskScrap[nomIdStr] || 0
        const shortage = (initialBZ - groupScrap) < 0 ? Math.abs(initialBZ - groupScrap) : 0
        
        const hasActiveRedoCard = taskRedo[nomIdStr] || false
        
        if (shortage > 0 && !hasActiveRedoCard) {
          hasShortage = true
        }
      })
      map[task.id] = hasShortage
    })
    return map
  }, [tasks, scrapCache, redoCache, nomenclatures])`;

if (!content.includes(shortageMatch)) {
  console.error("Shortage match not found!");
  process.exit(1);
}
content = content.replace(shortageMatch, shortageReplacement);

// 8. Replace details group history calculation
const groupHistMatch = `                      const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                      const cardIdsStrings = activeCards.map(c => String(c.id))
                      const groupHistory = workCardHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))`;

const groupHistReplacement = `                      const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                      const cardIdsStrings = activeCards.map(c => String(c.id))
                      const groupHistory = taskHistory.length > 0 
                        ? taskHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))
                        : workCardHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))`;

if (!content.includes(groupHistMatch)) {
  console.error("Group history match not found!");
  process.exit(1);
}
content = content.replace(groupHistMatch, groupHistReplacement);

// 9. Replace redo button check
const buttonMatch = `                                  <button
                                    onClick={() => {
                                      const machineName = activeCards[0]?.machine || '—'
                                      setGenModal({ task, part: { nom }, total: 1, requirement: shortage, created: 0, machineName, sheets: 1, isRepair: true })
                                    }}
                                    disabled={activeCards.some(c => (c.card_info || '').includes('[REDO]'))}
                                    style={{
                                      background: activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? '#444' : '#ef4444',
                                      color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 900,
                                      cursor: activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? 'not-allowed' : 'pointer',
                                      textTransform: 'uppercase',
                                      opacity: activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? 0.6 : 1
                                    }}
                                  >
                                    {activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? 'ВЖЕ ДОВИПУЩЕНО' : 'ДОВИПУСК'}
                                  </button>`;

const buttonReplacement = `                                  <button
                                    onClick={() => {
                                      const machineName = activeCards[0]?.machine || '—'
                                      setGenModal({ task, part: { nom }, total: 1, requirement: shortage, created: 0, machineName, sheets: 1, isRepair: true })
                                    }}
                                    disabled={activeCards.some(c => !countAsProduced(c) && (c.card_info || '').includes('[REDO]'))}
                                    style={{
                                      background: activeCards.some(c => !countAsProduced(c) && (c.card_info || '').includes('[REDO]')) ? '#444' : '#ef4444',
                                      color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 900,
                                      cursor: activeCards.some(c => !countAsProduced(c) && (c.card_info || '').includes('[REDO]')) ? 'not-allowed' : 'pointer',
                                      textTransform: 'uppercase',
                                      opacity: activeCards.some(c => !countAsProduced(c) && (c.card_info || '').includes('[REDO]')) ? 0.6 : 1
                                    }}
                                  >
                                    {activeCards.some(c => !countAsProduced(c) && (c.card_info || '').includes('[REDO]')) ? 'ВЖЕ ДОВИПУЩЕНО' : 'ДОВИПУСК'}
                                  </button>`;

if (!content.includes(buttonMatch)) {
  console.error("Button match not found!");
  process.exit(1);
}
content = content.replace(buttonMatch, buttonReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log("ForemanWorkplace.jsx successfully optimized!");
