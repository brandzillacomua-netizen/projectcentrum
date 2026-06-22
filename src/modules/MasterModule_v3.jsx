import React, { useState, useMemo, useEffect } from 'react'
import {
  ClipboardCheck,
  ArrowLeft,
  Printer,
  Play,
  History,
  Search,
  Menu,
  X,
  ListChecks,
  Monitor,
  CheckCircle2,
  Info,
  Shuffle
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const normalizeName = (s) => {
  if (!s) return '';
  const mapper = {
    'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
    'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
    'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
  };
  return s.toLowerCase()
    .trim()
    .split('')
    .map(c => mapper[c] || c)
    .join('')
    .replace(/[^a-z0-9]/g, '');
};

const getCleanNormalized = (name) => {
  if (!name) return '';
  let clean = name.toLowerCase()
    .replace(/\[\s*підготовлений\s*\]/gi, '')
    .replace(/\[\s*непідготовлений\s*\]/gi, '')
    .replace(/\s*підготовлений\s*/gi, '')
    .replace(/\s*непідготовлений\s*/gi, '')
    .trim();
  return normalizeName(clean);
};

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

const MasterModule = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    orders, tasks, nomenclatures, bomItems, inventory,
    totalProduced, totalScrapCount,
    createNaryad, issueMaterials, approveWarehouse,
    fetchModuleData,
    machines,
    machineCalls, currentUser, machineOperations
  } = useMES()

  // Load module-specific data on mount (inventory, work_cards, requests)
  useEffect(() => { fetchModuleData('master') }, [])

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

  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [rowMachines, setRowMachines] = useState({}) // { [partNomId]: machineType }
  const [rowMachinesSplits, setRowMachinesSplits] = useState({}) // { [partNomId]: [ { machine, sheets, qty } ] }
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState('queue') // 'queue' | 'archive'
  const [reprintTask, setReprintTask] = useState(null)
  const [selectedCutters, setSelectedCutters] = useState({}) // { [consumableName]: inventoryItemId }
  const [partCutterOverrides, setPartCutterOverrides] = useState({}) // { [partNomId]: '1.5' | '2' }
  // Local cache of ALL orders needed for active tasks (bypasses pagination)
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [showAuxiliary, setShowAuxiliary] = useState(false)

  // Quick Plan state
  const [quickPlanOrder, setQuickPlanOrder] = useState(null)
  const [tempSets, setTempSets] = useState('')
  const [tempDeadline, setTempDeadline] = useState('')

  // Preparation Terminal state
  const [showPrepModal, setShowPrepModal] = useState(false)
  const [prepQuantities, setPrepQuantities] = useState({})
  const [prepDeadline, setPrepDeadline] = useState('')

  const handleCreatePrepOrder = async () => {
    const itemsToCreate = Object.entries(prepQuantities).filter(([_, qty]) => Number(qty) > 0);
    if (itemsToCreate.length === 0) return alert('Введіть кількість хоча б для одного листа!');

    setIsSubmitting(true);
    try {
      const planSnapshot = {};
      let totalSheets = 0;
      for (const [materialId, qty] of itemsToCreate) {
        const nom = nomenclatures.find(n => n.id === materialId);
        planSnapshot[materialId] = {
          name: nom?.name || 'Лист',
          need: qty,
          stock: 0,
          plan: qty
        };
        totalSheets += Number(qty);
      }

      // Generate sequential prep number (e.g. №НП000001)
      const { count, error: errCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('step', 'Підготовка');

      const nextNum = (count || 0) + 1;
      const prepNum = `НП${String(nextNum).padStart(6, '0')}`;
      planSnapshot._prep_num = prepNum;

      const { data: newTask, error: errTask } = await supabase.from('tasks').insert({
        step: 'Підготовка',
        status: 'new',
        machine_name: 'PREP-TERM',
        planned_sets: totalSheets,
        planned_deadline: prepDeadline || null,
        plan_snapshot: planSnapshot,
        engineer_conf: true,
        director_conf: true
      }).select().single();

      if (errTask) throw errTask;

      const requestsToInsert = itemsToCreate.map(([materialId, qty]) => {
        const nom = nomenclatures.find(n => n.id === materialId)
        return {
          task_id: newTask.id,
          nomenclature_id: materialId,
          quantity: qty,
          status: 'pending',
          inventory_id: null,
          details: `ЗАПИТ НА ПІДГОТОВКУ (${prepNum}): ${nom?.name} — ${qty} шт.`
        }
      })

      const { error: errReq } = await supabase.from('material_requests').insert(requestsToInsert)
      if (errReq) throw errReq;

      alert('Наряди на підготовку успішно створено!');
      setShowPrepModal(false);
      setPrepQuantities({});
      setPrepDeadline('');
    } catch (e) {
      alert('Помилка: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isShop1Task = (t) => {
    if (!t || !t.step) return true;
    const step = t.step.toLowerCase();
    return !step.includes('№2') && !step.includes('пресув') && !step.includes('присув') && !step.includes('фарбув');
  }

  // ── Fetch orders for ALL tasks in state (pagination-independent) ───────────────
  // This ensures that tasks created before today are never orphaned
  useEffect(() => {
    if (tasks.length === 0) return;

    const neededOrderIds = [...new Set(tasks.map(t => t.order_id).filter(Boolean))];

    // Find IDs that are neither in the global orders context nor in our local allOrdersMap cache
    const missingIds = neededOrderIds.filter(id =>
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
          console.error('Error fetching missing orders for Master:', error);
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

  // Deep Link loading of specific naryad (task) or new order creation modal
  useEffect(() => {
    if (tasks.length === 0) return

    const taskId = searchParams.get('task')
    if (taskId) {
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (task) {
        // Clear param to prevent loop/sticky modal if closed
        handleReprint(task)
      }
    } else {
      const orderId = searchParams.get('order')
      if (orderId) {
        const order = orders.find(o => String(o.id) === String(orderId)) || allOrdersMap[orderId]
        if (order) {
          handleOpenNaryadModal(order)
        }
      }
    }
  }, [tasks, orders, allOrdersMap, searchParams])

  const getPlannedQty = (orderItemId) => {
    const item = orders.flatMap(o => o.order_items || []).find(it => it.id === orderItemId)
    if (!item) return 0

    const orderTasks = tasks.filter(t => String(t.order_id) === String(item.order_id))

    // Групуємо наряди за індексом партії (batch_index), щоб не рахувати одну й ту саму партію двічі на різних етапах
    const batches = {}
    orderTasks.forEach(t => {
      const key = t.batch_index || `task_${t.id}`
      const qty = Number(t.planned_sets) || 0
      if (!batches[key] || qty > batches[key]) {
        batches[key] = qty
      }
    })
    return Object.values(batches).reduce((acc, q) => acc + q, 0)
  }

  const getBatchSuffix = () => {
    if (!activeNaryadOrder) return '';
    if (activeNaryadOrder.isPrepOrder) return '';
    if (isReprintMode && reprintTask) {
      return reprintTask.batch_index ? `/${reprintTask.batch_index}` : '';
    }
    const totalUnits = activeNaryadOrder.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;
    const thisNaryadTotal = Object.values(naryadQtys).reduce((acc, v) => acc + (Number(v) || 0), 0) || 0;
    const alreadyPlanned = tasks.filter(t => String(t.order_id) === String(activeNaryadOrder.id)).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);

    if (thisNaryadTotal < totalUnits || alreadyPlanned > 0) {
      const orderTasks = tasks.filter(t => String(t.order_id) === String(activeNaryadOrder.id));
      const maxBatchIndex = orderTasks.reduce((max, t) => Math.max(max, Number(t.batch_index) || 0), 0);
      return `/${maxBatchIndex + 1}`;
    }
    return '';
  }

  const pendingOrders = orders.filter(o => {
    // Якщо замовлення в архіві або відвантажено - не показуємо
    if (o.status === 'completed' || o.status === 'shipped') return false

    // Якщо нове (pending) - показуємо
    if (o.status === 'pending') return true

    // Для всіх інших (in-progress, packaged) - перевіряємо чи є що ще планувати
    return o.order_items?.some(it => {
      const planned = getPlannedQty(it.id)
      const total = Number(it.quantity) || 0
      return planned < total
    })
  })
  const filteredPending = pendingOrders.filter(o =>
    o.order_num?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const [naryadQtys, setNaryadQtys] = useState({}) // { [orderItemId]: qty }
  const [naryadDeadline, setNaryadDeadline] = useState('')
  const [naryadParts, setNaryadParts] = useState({}) // { [orderItemId]: [ { nom, quantity_per_parent } ] }
  const [partSearchQueries, setPartSearchQueries] = useState({}) // { [rowKey]: string }
  const [openDropdownRowKey, setOpenDropdownRowKey] = useState(null) // string (rowKey)
  const [materialSplits, setMaterialSplits] = useState({}) // { [partId]: { t300: number, t700: number } }
  const [stockInfoModalData, setStockInfoModalData] = useState(null)

  const handleShowStockInfo = () => {
    const neededThicknesses = materialSummary.map(m => {
      const match = m.name.match(/\((\d+(?:\.\d+)?)мм\)/i);
      return match ? match[1] : null;
    }).filter(Boolean);

    const rawItems = nomenclatures
      .filter(n => {
        const isPreparedSheet = (n.type === 'raw' || n.type === 'material') && n.name.includes('[Підготовлений]');
        if (!isPreparedSheet) return false;
        
        if (neededThicknesses.length > 0) {
          const match = n.name.match(/\((\d+(?:\.\d+)?)мм\)/i);
          const thick = match ? match[1] : null;
          return thick && neededThicknesses.includes(thick);
        }
        return true;
      })
      .map(n => {
        const inv = inventory.find(i => String(i.nomenclature_id) === String(n.id) && i.warehouse === 'operational')
        return {
          id: n.id,
          name: n.name,
          stock: inv ? Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0)) : 0
        }
      });

    const grouped = {};
    rawItems.forEach(item => {
      const thickMatch = item.name.match(/\((\d+(?:\.\d+)?)мм\)/i);
      const thick = thickMatch ? `${thickMatch[1]}мм` : 'Інше';
      const isT700 = item.name.toLowerCase().includes('т700') || item.name.toLowerCase().includes('t700');
      
      if (!grouped[thick]) {
        grouped[thick] = { thickness: thick, t300: 0, t700: 0 };
      }
      if (isT700) {
        grouped[thick].t700 += item.stock;
      } else {
        grouped[thick].t300 += item.stock;
      }
    });

    const items = Object.values(grouped).sort((a, b) => {
      return (parseFloat(a.thickness) || 0) - (parseFloat(b.thickness) || 0);
    });

    setStockInfoModalData({
      title: 'Залишки підготовлених листів на СО',
      items
    })
  }

  const handleSplitChange = (partId, type, val, totalRequired) => {
    setMaterialSplits(prev => {
      if (val === '') {
        return {
          ...prev,
          [partId]: {
            ...prev[partId],
            [type]: ''
          }
        };
      }
      const nextVal = Math.max(0, Math.min(totalRequired, parseInt(val) || 0));
      const otherType = type === 't300' ? 't700' : 't300';
      const otherVal = Math.max(0, totalRequired - nextVal);
      return {
        ...prev,
        [partId]: {
          [type]: nextVal,
          [otherType]: otherVal
        }
      };
    })
  }

  const handleOpenNaryadModal = (order, sets, deadline) => {
    setIsReprintMode(false)
    setSelectedCutters({})
    setPartCutterOverrides({})
    setSelectedMachine(null)
    setRowMachines({})
    setRowMachinesSplits({})
    setMaterialSplits({})
    setActiveNaryadOrder(order)
    setIsDrawerOpen(false)
    setNaryadDeadline(deadline || order.deadline || '')
    // Initialize custom BOM parts state for editing
    const initialParts = {}
    order.order_items?.forEach(it => {
      const parts = bomItems.filter(b => b.parent_id === it.nomenclature_id)
      const allParts = parts.length > 0 ? parts.map(b => ({ nom: nomenclatures.find(n => n.id === b.child_id), quantity_per_parent: b.quantity_per_parent })) : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
      const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type)
      initialParts[it.id] = displayParts.map(p => ({
        nom: p.nom,
        quantity_per_parent: Number(p.quantity_per_parent) || 1
      }))
    })
    setNaryadParts(initialParts)

    // Default quantities to remaining balance or proportional to sets
    const initialQtys = {}

    if (sets !== undefined && sets !== '') {
      // PROPORTIONAL LOGIC
      const setsNum = Number(sets) || 0
      const totalRef = Math.max(...(order.order_items?.map(it => Number(it.quantity)) || [1]))
      const isFullPackage = setsNum >= (totalRef - Math.max(...(order.order_items?.map(it => getPlannedQty(it.id)) || [0])))

      order.order_items?.forEach(it => {
        const planned = getPlannedQty(it.id)
        const total = Number(it.quantity)
        const remaining = Math.max(0, total - planned)

        if (isFullPackage) {
          initialQtys[it.id] = remaining
        } else {
          const ratio = setsNum / totalRef
          const calc = Math.min(remaining, Math.round(total * ratio))
          initialQtys[it.id] = calc
        }
      })
    } else {
      order.order_items?.forEach(it => {
        const remaining = Math.max(0, Number(it.quantity) - getPlannedQty(it.id))
        initialQtys[it.id] = remaining
      })
    }
    setNaryadQtys(initialQtys)
  }

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        nom: nomenclatures.find(n => n.id === b.child_id),
        quantity_per_parent: b.quantity_per_parent
      }))
  }

  const getDisplayPartsForOrderItem = (it) => {
    if (isReprintMode && reprintTask?.plan_snapshot) {
      const partsFromSnapshot = Object.values(reprintTask.plan_snapshot)
        .filter(p => p && String(p.order_item_id) === String(it.id))
        .map(p => {
          const nom = nomenclatures.find(n => String(n.id) === String(p.id))
          return {
            nom: nom || { id: p.id, name: p.name, nomenclature_code: p.code, material_type: p.material },
            quantity_per_parent: p.need / (Number(it.quantity) || 1)
          }
        });
      if (partsFromSnapshot.length > 0) return partsFromSnapshot;
    }
    return naryadParts[it.id] || (() => {
      const parts = getBOMParts(it.nomenclature_id)
      const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
      return allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type)
    })()
  }

  // Robust machine lookup to ensure we have capacity even in reprint mode
  const currentMachine = useMemo(() => {
    if (!selectedMachine) return null
    if (selectedMachine.sheet_capacity) return selectedMachine
    return machines.find(m => m.name === selectedMachine.name) || selectedMachine
  }, [selectedMachine, machines])

  const autoCreatePrepOrder = async (quantities, deadline) => {
    const itemsToCreate = Object.entries(quantities).filter(([_, qty]) => Number(qty) > 0);
    if (itemsToCreate.length === 0) return;

    try {
      const planSnapshot = {};
      let totalSheets = 0;
      for (const [materialId, qty] of itemsToCreate) {
        const nom = nomenclatures.find(n => n.id === materialId);
        planSnapshot[materialId] = {
          name: nom?.name || 'Лист',
          need: qty,
          stock: 0,
          plan: qty
        };
        totalSheets += Number(qty);
      }

      // Generate sequential prep number (e.g. №НП000001)
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('step', 'Підготовка');

      const nextNum = (count || 0) + 1;
      const prepNum = `НП${String(nextNum).padStart(6, '0')}`;
      planSnapshot._prep_num = prepNum;

      const { data: newTask, error: errTask } = await supabase.from('tasks').insert({
        step: 'Підготовка',
        status: 'new',
        machine_name: 'PREP-TERM',
        planned_sets: totalSheets,
        planned_deadline: deadline || null,
        plan_snapshot: planSnapshot,
        engineer_conf: true,
        director_conf: true
      }).select().single();

      if (errTask) throw errTask;

      const requestsToInsert = itemsToCreate.map(([materialId, qty]) => {
        const nom = nomenclatures.find(n => n.id === materialId)
        return {
          task_id: newTask.id,
          nomenclature_id: materialId,
          quantity: qty,
          status: 'pending',
          inventory_id: null,
          details: `ЗАПИТ НА ПІДГОТОВКУ (${prepNum}): ${nom?.name} — ${qty} шт.`
        }
      })

      const { error: errReq } = await supabase.from('material_requests').insert(requestsToInsert)
      if (errReq) throw errReq;
    } catch (e) {
      console.error('Error auto-creating prep order:', e.message);
    }
  };

  const handlePrint = async () => {
    if (!activeNaryadOrder || isSubmitting) return

    const oldTitle = document.title;
    const batchSuffix = getBatchSuffix();
    const dateStr = new Date().toLocaleDateString('uk-UA').replace(/\//g, '.');
    const customerStr = activeNaryadOrder.customer || '';

    if (activeNaryadOrder.isPrepOrder) {
      setIsSubmitting(true)
      document.title = `НАРЯД № ${activeNaryadOrder.order_num} ${dateStr} ВИРОБНИЦТВО`;
      try {
        if (isReprintMode) {
          window.print()
          setReprintTask(null)
          setActiveNaryadOrder(null)
        } else {
          await apiService.submitCreateTask(activeNaryadOrder.id, 'PREP-TERM', (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline))
          window.print()
          setActiveNaryadOrder(null)
        }
      } catch (err) {
        console.error(err)
        alert("Помилка: " + err.message)
      } finally {
        document.title = oldTitle;
        setIsSubmitting(false)
      }
      return
    }

    document.title = `НАРЯД № ${activeNaryadOrder.order_num}${batchSuffix} ${dateStr} ${customerStr}`;

    const uniqueMachinesSet = new Set()
    activeNaryadOrder.order_items?.forEach(it => {
      const displayParts = getDisplayPartsForOrderItem(it)
      displayParts.forEach(part => {
        if (!part.nom) return
        const splits = rowMachinesSplits[part.nom.id] || []
        if (splits.length > 0) {
          splits.forEach(s => {
            if (s.machine) uniqueMachinesSet.add(s.machine)
          })
        } else if (rowMachines[part.nom.id]) {
          uniqueMachinesSet.add(rowMachines[part.nom.id])
        }
      })
    })
    const uniqueMachines = Array.from(uniqueMachinesSet)

    // Calculate if we actually need to produce anything
    let totalPlanQuantity = 0;
    activeNaryadOrder.order_items?.forEach(it => {
      const parts = getBOMParts(it.nomenclature_id)
      const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
      const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type)
      
      displayParts.forEach(part => {
        const thisNaryadQty = naryadQtys[it.id] || 0
        const totalNeeded = thisNaryadQty * (Number(part.quantity_per_parent) || 1)
        const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz')
        const inStock = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        const totalToProduce = Math.max(0, totalNeeded - inStock)
        totalPlanQuantity += totalToProduce
      })
    })

    if (!isReprintMode && hasUnassignedMachines) {
      alert("Будь ласка, оберіть верстат для деталей.")
      return
    }
    const taskMachineName = uniqueMachines.length === 1 ? uniqueMachines[0] : (uniqueMachines.length > 1 ? "Різні верстати" : "Не вказано")

    if (!isReprintMode) {
      let missingPrepQuantities = {}
      let hasDeficit = false

      for (const m of materialSummary) {
        if (m.name.toLowerCase().includes('лист') || m.name.toLowerCase().includes('карбон') || m.name.toLowerCase().includes('carbon')) {
          const requiredSheets = m.sheets;
          const normName = getCleanNormalized(m.name)
          const prepNom = nomenclatures.find(n =>
            n.name.toLowerCase().includes('підготовлений') &&
            !n.name.toLowerCase().includes('непідготовлений') &&
            getCleanNormalized(n.name) === normName
          )

          if (prepNom) {
            const bzInv = inventory.find(i => String(i.nomenclature_id) === String(prepNom.id) && (i.type === 'raw' || i.type === 'bz'));
            const stock = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;

            if (stock < requiredSheets) {
              const rawNom = nomenclatures.find(n =>
                n.name.toLowerCase().includes('непідготовлений') &&
                getCleanNormalized(n.name) === normName
              )
              const targetId = rawNom ? rawNom.id : prepNom.id
              missingPrepQuantities[targetId] = requiredSheets - stock
              hasDeficit = true
            }
          }
        }
      }

      if (hasDeficit) {
        let errorMsg = 'УВАГА: Недостатньо підготовленого матеріалу на складі СО!\n\n';
        Object.entries(missingPrepQuantities).forEach(([targetId, deficit]) => {
          const rawNom = nomenclatures.find(n => n.id === targetId);
          const normName = rawNom ? getCleanNormalized(rawNom.name) : '';
          const prepNom = nomenclatures.find(n =>
            n.name.toLowerCase().includes('підготовлений') &&
            !n.name.toLowerCase().includes('непідготовлений') &&
            getCleanNormalized(n.name) === normName
          );
          const prepName = prepNom ? prepNom.name : (rawNom ? rawNom.name.replace('Непідготовлений', 'Підготовлений') : 'Лист');

          const m = materialSummary.find(item => getCleanNormalized(item.name) === normName);
          const totalNeeded = m ? m.sheets : deficit;
          const currentStock = Math.max(0, totalNeeded - deficit);

          errorMsg += `• "${prepName}": Потрібно: ${totalNeeded} шт., в наявності: ${currentStock} шт. (Дефіцит: ${deficit} шт.)\n`;
        });
        errorMsg += '\nНатисніть ОК, щоб створити ці наряди. Наряд на підготовку дефіцитних листів буде створено автоматично паралельно!';

        alert(errorMsg);

        setIsSubmitting(true);
        try {
          // 1. Auto-create prep order first
          await autoCreatePrepOrder(missingPrepQuantities, naryadDeadline || activeNaryadOrder.deadline);

          // 2. Create task
          const createdTask = await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits, selectedCutters, naryadParts, partCutterOverrides, rowMachinesSplits));

          if (createdTask) {
            setReprintTask(createdTask);
          }

          // 3. Trigger print dialog
          window.print();

          setReprintTask(null);
          setActiveNaryadOrder(null);
        } catch (err) {
          console.error("Naryad creation error:", err);
          alert("Помилка створення наряду: " + err.message);
        } finally {
          document.title = oldTitle;
          setIsSubmitting(false);
        }
        return; // Concluded
      }
    }

    setIsSubmitting(true)
    try {
      if (isReprintMode) {
        window.print()
        setReprintTask(null)
        setActiveNaryadOrder(null)
      } else {
        const createdTask = await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits, selectedCutters, naryadParts, partCutterOverrides, rowMachinesSplits))
        
        if (createdTask) {
          setReprintTask(createdTask);
        }
        
        window.print()
        setReprintTask(null)
        setActiveNaryadOrder(null)
      }
    } catch (err) {
      console.error("Naryad creation error:", err)
      alert("Помилка створення наряду: " + err.message)
    } finally {
      document.title = oldTitle;
      setIsSubmitting(false)
    }
  }

  const handleReprint = (task) => {
    let resolvedType = MACHINE_TYPES.find(t => t === task.machine_name)
    if (!resolvedType && task.machine_name) {
      const physicalMac = machines?.find(m => m.name === task.machine_name)
      if (physicalMac && MACHINE_TYPES.includes(physicalMac.type)) {
        resolvedType = physicalMac.type
      } else {
        const normName = task.machine_name.toLowerCase()
        if (normName.includes('3050(16)x1600') || normName.includes('3050(16)х1600') || normName.includes('3050(16)') || normName.includes('16x16') || normName.includes('16х16') || normName.includes('3050x1600') || normName.includes('3050х1600') || normName.includes('3050')) {
          resolvedType = 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
        } else if (normName.includes('дракон') || normName.includes('60x20') || normName.includes('6000x2000') || normName.includes('6000х2000')) {
          resolvedType = 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
        } else if (normName.includes('малий') || normName.includes('12x8') || normName.includes('1200x800') || normName.includes('12х8') || normName.includes('1200х800')) {
          resolvedType = 'CNC 1200x800 - 4 листи (Малий)'
        } else if (normName.includes('фея') || normName.includes('ke xin') || normName.includes('kexin')) {
          resolvedType = 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
        } else if (normName.includes('3060') || normName.includes('три головий') || normName.includes('3060х1600')) {
          resolvedType = 'CNC 3060х1600 - 3-36 листів (Три Головий)'
        }
      }
    }

    const initialRowMachines = {}
    const initialRowMachinesSplits = {}
    if (task.step !== 'Підготовка') {
      Object.keys(task.plan_snapshot || {}).forEach(partId => {
        if (!partId.startsWith('_') && partId !== 'materialSummary') {
          const snapshotPart = task.plan_snapshot[partId]
          initialRowMachines[partId] = snapshotPart?.selected_machine || resolvedType || task.machine_name
          initialRowMachinesSplits[partId] = snapshotPart?.splits || []
        }
      })
    }
    setRowMachines(initialRowMachines)
    setRowMachinesSplits(initialRowMachinesSplits)

    if (task.step === 'Підготовка') {
      setIsReprintMode(true)
      setReprintTask(task)
      setSelectedMachine({ name: task.machine_name })
      const virtualOrder = {
        id: `prep-${task.id}`,
        order_num: task.plan_snapshot?._prep_num || 'ПІДГОТОВКА',
        customer: 'ВИРОБНИЦТВО',
        deadline: task.planned_deadline,
        isPrepOrder: true,
        order_items: Object.entries(task.plan_snapshot || {})
          .filter(([key]) => !key.startsWith('_'))
          .map(([nomId, item]) => ({
            id: `item-${nomId}`,
            nomenclature_id: nomId,
            quantity: item.plan,
            name: item.name
          }))
      }
      setActiveNaryadOrder(virtualOrder)
      return
    }
    const order = orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
    if (order) {
      setIsReprintMode(true)
      setReprintTask(task)
      setSelectedMachine({ name: task.machine_name })
      setActiveNaryadOrder(order)
    }

    setSelectedCutters({})
    setPartCutterOverrides({})
    if (task.plan_snapshot?.selectedCutters) {
      setSelectedCutters(task.plan_snapshot.selectedCutters)
    } else {
      supabase
        .from('material_requests')
        .select('inventory_id, nomenclature_id')
        .eq('task_id', task.id)
        .then(({ data, error }) => {
          if (!error && data) {
            const mapped = {}
            data.forEach(req => {
              if (req.inventory_id) {
                const inv = (inventory || []).find(i => String(i.id) === String(req.inventory_id))
                if (inv) {
                  const nom = nomenclatures.find(n => n.id === inv.nomenclature_id)
                  if (nom && nom.name.toLowerCase().startsWith('фреза')) {
                    const nameLower = nom.name.toLowerCase()
                    const fMatch = nameLower.match(/ф\s*([0-9,.]+)/)
                    const parsedDiam = fMatch ? parseFloat(fMatch[1].replace(',', '.')) : null
                    if (parsedDiam) {
                      const genericNom = nomenclatures.find(n => {
                        if (n.type !== 'consumable') return false
                        if (!n.name.toLowerCase().startsWith('фреза')) return false
                        const gMatch = n.name.toLowerCase().match(/ф\s*([0-9,.]+)/)
                        if (gMatch) {
                          const gDiam = parseFloat(gMatch[1].replace(',', '.'))
                          return Math.abs(gDiam - parsedDiam) < 0.01
                        }
                        return false
                      })
                      if (genericNom) {
                        mapped[genericNom.name] = req.inventory_id
                      }
                    }
                  }
                }
              }
            })
            if (Object.keys(mapped).length > 0) {
              setSelectedCutters(mapped)
            }
          }
        })
    }

    const loadedOverrides = {}
    if (task.plan_snapshot) {
      Object.keys(task.plan_snapshot).forEach(k => {
        if (!k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables') {
          const snapshotPart = task.plan_snapshot[k]
          if (snapshotPart?.cutter_override) {
            loadedOverrides[k] = snapshotPart.cutter_override
          }
        }
      })
    }
    setPartCutterOverrides(loadedOverrides)
  }

  const materialSummary = useMemo(() => {
    if (!activeNaryadOrder) return []
    const summary = {}

    if (activeNaryadOrder.isPrepOrder) {
      activeNaryadOrder.order_items?.forEach(item => {
        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
        if (nom) {
          summary[nom.name] = { name: nom.name, sheets: Number(item.quantity), unit: 'ЛИСТІВ' }
        }
      })
      return Object.values(summary)
    }

    activeNaryadOrder.order_items?.forEach(item => {
      const displayParts = getDisplayPartsForOrderItem(item)

      const currentQty = isReprintMode ? Number(item.quantity) : (naryadQtys[item.id] || 0)
      if (currentQty <= 0) return

      displayParts.forEach(part => {
        if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return

        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
        const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? snapshot.stock : (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const totalToProduce = Math.max(0, totalNeeded - inStock)
        const matKeyBase = (part.nom.material_type || part.nom.name || 'Інше').trim()

        // Match the prepared sheet nomenclature directly by name using robust normalization
        const thickMatch = matKeyBase.match(/\((\d+(?:\.\d+)?)мм\)/i)
        const thicknessClean = thickMatch ? `${thickMatch[1]}мм` : matKeyBase.toLowerCase().replace(/\s+/g, '')
        const prepNom = nomenclatures.find(n =>
          n.name.toLowerCase().includes('підготовлений') &&
          !n.name.toLowerCase().includes('непідготовлений') &&
          n.name.toLowerCase().replace(/\s+/g, '').includes(`(${thicknessClean})`)
        )

        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        const sheets = Math.ceil(totalToProduce / unitsPerSheet)
        const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'

        const sheets_t300 = snapshot
          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
          : (materialSplits[part.nom.id]?.t300 !== undefined ? materialSplits[part.nom.id].t300 : sheets)
        const sheets_t700 = snapshot
          ? (Number(snapshot.sheets_t700) || 0)
          : (materialSplits[part.nom.id]?.t700 || 0)

        const addToSummary = (typePrefix, qty) => {
          if (qty <= 0) return
          const matKey = prepNom
            ? prepNom.name.replace('Т300', typePrefix).replace('T300', typePrefix)
            : `Лист ${typePrefix} (${matKeyBase}) [Підготовлений]`
          if (!summary[matKey]) {
            summary[matKey] = { name: matKey, sheets: 0, unit }
          }
          summary[matKey].sheets += qty
        }

        addToSummary('Т300', sheets_t300)
        addToSummary('Т700', sheets_t700)
      })
    })

    const result = Object.values(summary)
    // Sort by thickness (e.g. "3мм" -> 3)
    result.sort((a, b) => {
      const getThick = (name) => {
        const match = name.match(/\((\d+(?:\.\d+)?)мм\)/i)
        return match ? parseFloat(match[1]) : 999
      }
      return getThick(a.name) - getThick(b.name)
    })
    return result
  }, [activeNaryadOrder, inventory, reprintTask, nomenclatures, bomItems, naryadQtys, isReprintMode, materialSplits])

  const productNames = useMemo(() => {
    if (!activeNaryadOrder) return ''
    if (activeNaryadOrder.isPrepOrder) {
      return 'Підготовка сировини'
    }
    return activeNaryadOrder.order_items
      ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
      .filter(Boolean)
      .join(', ')
  }, [activeNaryadOrder, nomenclatures])

  const consumableSummary = useMemo(() => {
    if (!activeNaryadOrder || activeNaryadOrder.isPrepOrder) return []

    const machineSpecificCutters = {}
    let hasMachineSpecificCutters = false

    activeNaryadOrder.order_items?.forEach(item => {
      const displayParts = getDisplayPartsForOrderItem(item)

      const currentQty = isReprintMode ? Number(item.quantity) : (naryadQtys[item.id] || 0)
      if (currentQty <= 0) return

      displayParts.forEach(part => {
        if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return

        const machineName = rowMachines[part.nom.id]
        if (!machineName) return

        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
        const override = snapshot?.cutter_override || partCutterOverrides[part.nom.id] || '2'
        const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? snapshot.stock : (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const totalToProduce = snapshot ? snapshot.plan : (isReprintMode ? 0 : Math.max(0, totalNeeded - inStock))
        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        
        // Calculate sheets using splits if split mode is active
        const splits = rowMachinesSplits[part.nom.id] || []
        let sheets = 0
        if (splits.length > 0) {
          sheets = splits.reduce((acc, s) => acc + (Number(s.sheets) || 0), 0)
        } else {
          // If not split across multiple machines, get sheets from T300 + T700 split state
          const sheets_t300 = snapshot
            ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
            : (materialSplits[part.nom.id]?.t300 !== undefined ? materialSplits[part.nom.id].t300 : Math.ceil(totalToProduce / unitsPerSheet))
          const sheets_t700 = snapshot
            ? (Number(snapshot.sheets_t700) || 0)
            : (materialSplits[part.nom.id]?.t700 || 0)
          sheets = sheets_t300 + sheets_t700
        }

        if (sheets <= 0) return

        const opData = machineOperations?.find(o =>
          String(o.nomenclature_id) === String(part.nom.id) &&
          (o.machine_type === machineName || o.machine_id === machineName)
        )

        if (opData && opData.side2_cut_ops) {
          const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
          cutterOps.forEach(op => {
            const opParts = op.split(':')
            const cutterNomId = opParts[1]
            const qtyPerSheet = parseFloat(opParts[2]) || 0
            if (cutterNomId && qtyPerSheet > 0) {
              hasMachineSpecificCutters = true
              const totalQty = Math.ceil(sheets * qtyPerSheet)
              let cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
              
              if (cutterNom) {
                const nl = cutterNom.name.toLowerCase()
                const m1 = nl.match(/ф\s*([0-9,.]+)/)
                const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх×])/)
                const d = m1 ? parseFloat(m1[1].replace(',', '.')) : (m2 ? parseFloat(m2[1].replace(',', '.')) : null)
                
                if (override !== '1.5' && d && Math.abs(d - 1.5) < 0.01) {
                  return // skip this Ф1.5 cutter because we chose Ф2
                }
                if (override === '1.5' && d && Math.abs(d - 2) < 0.01) {
                  cutterNom = { ...cutterNom, name: 'Фреза ф1.5', id: '__synthetic_f1.5__' }
                }
              }

              if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
                const cleanName = cutterNom.name.trim()
                const key = cleanName.toLowerCase()
                if (!machineSpecificCutters[key]) {
                  machineSpecificCutters[key] = {
                    name: cleanName,
                    total: 0
                  }
                }
                machineSpecificCutters[key].total += totalQty
              }
            }
          })
        }
      })
    })

    if (hasMachineSpecificCutters) {
      return Object.values(machineSpecificCutters)
    }

    // Fallback: default database consumables, excluding generic "Фреза"
    const totalSheetsCount = materialSummary.reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
    if (totalSheetsCount <= 0) return []

    const fallbackConsumables = {}
    nomenclatures
      .filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза')
      .forEach(n => {
        const cleanName = n.name.trim()
        const key = cleanName.toLowerCase()
        const total = Math.ceil(totalSheetsCount * Number(n.consumption_per_sheet))
        if (!fallbackConsumables[key]) {
          fallbackConsumables[key] = {
            name: cleanName,
            total: 0
          }
        }
        fallbackConsumables[key].total += total
      })

    return Object.values(fallbackConsumables)
  }, [activeNaryadOrder, materialSummary, nomenclatures, rowMachines, machineOperations, naryadQtys, isReprintMode, reprintTask, inventory, naryadParts, partCutterOverrides, rowMachinesSplits, materialSplits])

  const hasUnassignedMachines = useMemo(() => {
    if (!activeNaryadOrder) return false
    if (activeNaryadOrder.isPrepOrder) return false

    let hasUnassigned = false
    activeNaryadOrder.order_items?.forEach(item => {
      const currentQty = isReprintMode ? Number(item.quantity) : (naryadQtys[item.id] || 0)
      if (currentQty <= 0) return

      const displayParts = getDisplayPartsForOrderItem(item)

      displayParts.forEach(part => {
        if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return

        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
        const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? snapshot.stock : (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const totalToProduce = snapshot ? snapshot.plan : (isReprintMode ? 0 : Math.max(0, totalNeeded - inStock))
        if (totalToProduce > 0) {
          const splits = rowMachinesSplits[part.nom.id] || []
          if (splits.length > 0) {
            if (splits.some(s => !s.machine)) {
              hasUnassigned = true
            }
          } else if (!rowMachines[part.nom.id]) {
            hasUnassigned = true
          }
        }
      })
    })

    return hasUnassigned
  }, [activeNaryadOrder, isReprintMode, naryadQtys, nomenclatures, bomItems, inventory, reprintTask, rowMachines, rowMachinesSplits, naryadParts])

  const isPrintDisabled = useMemo(() => {
    if (isSubmitting) return true
    if (!activeNaryadOrder) return true
    return hasUnassignedMachines
  }, [isSubmitting, activeNaryadOrder, hasUnassignedMachines])

  const renderAnalytics = () => (
    <div className="analytics-scroll" style={{ overflowX: 'auto', marginBottom: '25px', display: 'flex', gap: '15px', paddingBottom: '10px' }}>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Виконано</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{(Number(totalProduced) || 0).toString()}</div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Брак</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>{(Number(totalScrapCount) || 0).toString()} <small style={{ fontSize: '0.7rem' }}>шт</small></div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>В роботі</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{tasks.filter(t => t.status === 'in-progress' && isShop1Task(t)).length}</div>
      </div>
    </div>
  )

  const renderArchiveContent = () => {
    const archiveTasks = tasks.filter(t => {
      if (t.status !== 'completed' || !t.completed_at) return false
      const d = new Date(t.completed_at)
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      return d >= threeDaysAgo
    });

    if (archiveTasks.length === 0) return <div style={{ textAlign: 'center', padding: '20px', color: '#555', fontSize: '0.75rem' }}>Архів порожній</div>;

    // ГРУПУЄМО ЗА НОМЕРОМ НАРЯДУ
    const groups = {};
    archiveTasks.forEach(task => {
      const order = orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id];
      const key = `${task.order_id}_${task.batch_index || '1'}`;
      if (!groups[key]) {
        groups[key] = {
          orderNum: order?.order_num || '?',
          customer: order?.customer || '?',
          batchIndex: task.batch_index || '1',
          lastCompletedAt: task.completed_at,
          stages: [],
          task: task
        };
      }
      let shopName = task.step;
      if (task.step?.includes('Розкрій') || task.step?.includes('Різка')) {
        shopName = 'ЦЕХ №1';
      } else if (task.step?.includes('Пресування') || task.step?.includes('№2') || task.step?.includes('Фарбування')) {
        shopName = 'ЦЕХ №2';
      }

      if (!groups[key].stages.includes(shopName)) {
        groups[key].stages.push(shopName);
      }
      if (new Date(task.completed_at) > new Date(groups[key].lastCompletedAt)) {
        groups[key].lastCompletedAt = task.completed_at;
      }
    });

    return (
      <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.values(groups).sort((a, b) => new Date(b.lastCompletedAt) - new Date(a.lastCompletedAt)).map((group, gIdx) => (
          <div key={gIdx} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '16px', border: '1px solid #1a1a1a', borderLeft: '3px solid #10b981', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
              <strong
                onClick={() => {
                  if (group.task) {
                    handleReprint(group.task);
                    setIsDrawerOpen(false);
                  }
                }}
                className="interactive-naryad-title"
                style={{ fontSize: '0.9rem', color: '#fff', cursor: 'pointer' }}
              >
                №{group.orderNum}/{group.batchIndex}
              </strong>
              <span style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(group.lastCompletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '10px' }}>{group.customer}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.stages.map((s, sIdx) => (
                <div key={sIdx} style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={10} /> {s}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOrderQueue = () => (
    <section className="grid-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0, flex: 1 }}><ListChecks size={16} /> ЧЕРГА ЗАМОВЛЕНЬ</h3>
        <button
          onClick={() => setShowPrepModal(true)}
          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
        >
          НАРЯД НА ПІДГОТОВКУ
        </button>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
          <input style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '4px 8px 4px 25px', color: '#fff', fontSize: '0.75rem', width: '110px' }} placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredPending.map(order => (
          <div key={order.id} className="order-p-card glass-panel" style={{ background: '#0a0a0a', padding: '18px', borderRadius: '20px', border: '1px solid #222', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ff9000' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <strong
                  onClick={() => {
                    setQuickPlanOrder(order);
                    const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                    setTempSets(maxRem);
                    setTempDeadline(order.deadline || '');
                  }}
                  className="interactive-naryad-title"
                  style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  №{order.order_num}
                </strong>
                <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700 }}>
                  {order.order_date ? new Date(order.order_date).toLocaleDateString('uk-UA') : ''}
                </span>
              </div>
              <button
                onClick={() => {
                  setQuickPlanOrder(order);
                  const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                  setTempSets(maxRem);
                  setTempDeadline(order.deadline || '');
                }}
                style={{ background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', cursor: 'pointer', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                title="Відкрити наряд"
              >
                <Printer size={18} />
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 700, marginBottom: '15px' }}>{order.customer}</div>
            <div style={{ marginBottom: '15px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
              {order.order_items?.map(it => {
                const planned = getPlannedQty(it.id)
                const total = Number(it.quantity)
                const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                return (
                  <div key={it.id} style={{ fontSize: '0.75rem', color: planned >= total ? '#22c55e' : '#fff', display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                    <span style={{ maxWidth: '75%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nom?.name}:</span>
                    <span style={{ fontWeight: 800 }}>{planned} / {total} шт</span>
                  </div>
                )
              })}
            </div>

            {/* СПИСОК ВЖЕ СТВОРЕНИХ НАРЯДІВ */}
            {(() => {
              const orderTasks = tasks.filter(t => String(t.order_id) === String(order.id));
              if (orderTasks.length === 0) return null;

              // Групуємо за індексом, щоб не було дублів плашок /1 /1
              const uniqueBatches = {};
              orderTasks.forEach(t => {
                const idx = t.batch_index || '1';
                if (!uniqueBatches[idx]) {
                  uniqueBatches[idx] = {
                    index: idx,
                    isAllCompleted: true // припустимо що так, поки не знайдемо незавершений
                  };
                }
                if (t.status !== 'completed') {
                  uniqueBatches[idx].isAllCompleted = false;
                }
              });

              return (
                <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
                  <div style={{ fontSize: '0.6rem', color: '#666', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Вже в роботі:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Object.values(uniqueBatches).sort((a, b) => a.index - b.index).map(b => (
                      <span key={b.index} style={{
                        fontSize: '0.7rem',
                        padding: '4px 8px',
                        background: b.isAllCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: b.isAllCompleted ? '#10b981' : '#aaa',
                        borderRadius: '6px',
                        border: b.isAllCompleted ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #222',
                        fontWeight: 800
                      }}>
                        ПАРТІЯ /{b.index}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <button
              onClick={() => {
                setQuickPlanOrder(order);
                const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                setTempSets(maxRem);
                setTempDeadline(order.deadline || '');
              }}
              style={{ width: '100%', padding: '12px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              Сформувати наряд
            </button>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <div className="master-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <nav className="module-nav no-print" style={{ flexShrink: 0, padding: '0 20px', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" className="back-link" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
          <span className="mobile-nav-buttons" style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setDrawerType('queue');
                setIsDrawerOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 144, 0, 0.1)',
                border: '1px solid rgba(255, 144, 0, 0.2)',
                color: '#ff9000',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Menu size={16} />
              <span>Черга</span>
              {pendingOrders.length > 0 && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '50%',
                    minWidth: '18px',
                    height: '18px',
                    fontSize: '0.65rem',
                    fontWeight: 950,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    marginLeft: '2px'
                  }}
                >
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setDrawerType('archive');
                setIsDrawerOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <History size={16} />
              <span>Архів</span>
            </button>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardCheck className="text-accent" size={24} color="#ff9000" />
          <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }} className="hide-mobile">Керування виробництвом</h1>
        </div>
        <div className="hide-mobile" style={{ fontSize: '0.8rem', color: '#444', fontWeight: 700 }}>СИСТЕМА MES v2.1</div>
      </nav>

      <div className="module-content no-print" style={{ padding: '20px 20px 80px 20px' }}>

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

        <div className="master-grid" style={{ display: 'grid', gap: '25px', alignItems: 'start' }}>
          <div className="hide-mobile">{renderOrderQueue()}</div>

          <section className="grid-col">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}><Play size={16} fill="currentColor" /> АКТИВНІ В ЦЕХУ</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#888', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showAuxiliary}
                  onChange={e => setShowAuxiliary(e.target.checked)}
                  style={{
                    accentColor: '#ff9000',
                    cursor: 'pointer'
                  }}
                />
                <span>Показати НП та ВБ</span>
              </label>
            </div>
            <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {tasks.filter(t => {
                if (t.status === 'completed' || t.status === 'pending' || !isShop1Task(t)) return false;

                const order = orders.find(o => o.id === t.order_id) || allOrdersMap[t.order_id];
                const isNP = t.step === 'Підготовка' || order?.order_num?.includes('НП') || t.plan_snapshot?._prep_num?.includes('НП');
                const isVB = order?.order_num?.includes('ВБ') || t.plan_snapshot?._prep_num?.includes('ВБ');

                if ((isNP || isVB) && !showAuxiliary) {
                  return false;
                }
                return true;
              }).map(task => {
                const order = orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
                let taskProductNames = 'Виріб...'
                if (task.step === 'Підготовка') {
                  taskProductNames = Object.entries(task.plan_snapshot || {})
                    .filter(([key]) => !key.startsWith('_'))
                    .map(([_, it]) => it.name || 'Лист')
                    .join(', ')
                } else {
                  taskProductNames = order?.order_items
                    ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
                    .filter(Boolean)
                    .join(', ') || 'Виріб...'
                }

                const isSkladConfirmed = task.warehouse_conf === true
                const isTechConfirmed = task.engineer_conf === true
                const isDirConfirmed = task.director_conf === true

                return (
                  <div key={task.id} style={{ position: 'relative', background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #222', borderLeft: '4px solid #ff9000' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong
                          onClick={() => handleReprint(task)}
                          style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', cursor: 'pointer' }}
                          title="Друк наряду"
                          className="interactive-naryad-title"
                        >
                          {task.step === 'Підготовка'
                            ? `№ ${task.plan_snapshot?._prep_num || 'НП------'}`
                            : `№ ${order?.order_num || ''}${task.batch_index ? `/${task.batch_index}` : ''}`}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>
                          {task.step === 'Підготовка' ? 'ПІДГОТОВКА СИРОВИНИ' : (order?.customer || 'ПРЯМИЙ')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>СТВОРЕНО</span>
                          <span style={{ fontSize: '0.75rem', color: '#ccc', fontWeight: 800 }}>{new Date(task.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <button onClick={() => handleReprint(task)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 0 0 5px' }} title="Друк наряду"><Printer size={22} /></button>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 15px', borderRadius: '14px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#bbb', fontWeight: 800, lineHeight: 1.3, flex: 1, paddingRight: '10px' }}>{taskProductNames}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900, letterSpacing: '1px' }}>ТИРАЖ</span>
                          <span style={{ fontSize: '1.2rem', color: '#ff9000', fontWeight: 950, lineHeight: 1 }}>{task.planned_sets || '—'}<small style={{ fontSize: '0.65rem', color: '#666', marginLeft: '2px' }}>ОД.</small></span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: '#222', padding: '4px 10px', borderRadius: '8px', color: '#ddd' }}>{task.step}</span>
                        <span>ВЕРСТАТ:</span>
                        <span style={{ color: '#ff9000', fontWeight: 900 }}>{task.machine_name || 'НЕ ВКАЗАНО'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{
                        fontSize: '0.65rem',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: isSkladConfirmed ? '#064e3b' : '#1a1a1a',
                        color: isSkladConfirmed ? '#10b981' : '#333',
                        fontWeight: 1000,
                        border: isSkladConfirmed ? '1px solid #10b981' : '1px solid #222'
                      }}>СКЛАД</div>
                      {task.step !== 'Підготовка' && (
                        <>
                          <div style={{
                            fontSize: '0.65rem',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            background: isTechConfirmed ? '#064e3b' : '#1a1a1a',
                            color: isTechConfirmed ? '#10b981' : '#333',
                            fontWeight: 1000,
                            border: isTechConfirmed ? '1px solid #10b981' : '1px solid #222'
                          }}>ІНЖЕНЕР</div>
                          <div style={{
                            fontSize: '0.65rem',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            background: isDirConfirmed ? '#064e3b' : '#1a1a1a',
                            color: isDirConfirmed ? '#10b981' : '#333',
                            fontWeight: 1000,
                            border: isDirConfirmed ? '1px solid #10b981' : '1px solid #222'
                          }}>ДИРЕКТОР</div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="grid-col hide-mobile">
            <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><History size={16} /> АРХІВ (ОСТАННІ 3 ДНІ)</h3>
            {renderArchiveContent()}
          </section>
        </div>
      </div>

      {activeNaryadOrder && (
        <div className="worksheet-modal-overlay print-target" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div className="worksheet-panel glass-panel" style={{ background: '#0a0a0a', width: '100%', maxWidth: '1300px', maxHeight: '100vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #222' }}>

            <div className="worksheet-header-area" style={{ padding: '35px 45px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h2 className="doc-ti" style={{ margin: 0, fontSize: '1.8rem', color: '#ff9000', fontWeight: 950, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      НАРЯД № {activeNaryadOrder.order_num}
                      {getBatchSuffix()}
                      <button
                        type="button"
                        onClick={() => {
                          const url = new URL(window.location.href)
                          url.searchParams.delete('order')
                          url.searchParams.delete('task')
                          if (reprintTask?.id) {
                            url.searchParams.set('task', reprintTask.id)
                          } else {
                            url.searchParams.set('order', activeNaryadOrder.id)
                          }
                          navigator.clipboard.writeText(url.toString())
                          alert('Посилання скопійовано!')
                        }}
                        style={{
                          background: 'rgba(255, 144, 0, 0.1)',
                          border: '1px solid rgba(255, 144, 0, 0.3)',
                          color: '#ff9000',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          marginLeft: '10px'
                        }}
                        className="no-print"
                      >
                        Копіювати посилання
                      </button>
                    </h2>
                  </div>
                  <button onClick={() => {
                    setActiveNaryadOrder(null);
                    setSearchParams({});
                  }} className="no-print" style={{ background: '#111', border: '1px solid #222', color: '#555', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
                </div>

                <div style={{ background: '#111', padding: '20px 25px', borderRadius: '20px', border: '1px solid #1a1a1a' }} className="print-info-box">
                  <div className="print-prod-info" style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 1000, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '4px', height: '24px', background: '#ff9000', borderRadius: '2px' }} className="no-print"></div>
                    ВИРІБ: <span style={{ color: '#ff9000' }}>{productNames || '—'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ЗАМОВНИК</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>{activeNaryadOrder.customer}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДАТА ФОРМУВАННЯ</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>{new Date().toLocaleDateString('uk-UA')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДЕДЛАЙН НА ЦЮ ПАРТІЮ</span>
                      <div className="no-print">
                        <input
                          type="date"
                          value={naryadDeadline ? naryadDeadline.split('T')[0] : ''}
                          onChange={(e) => setNaryadDeadline(e.target.value)}
                          style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '5px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}
                        />
                      </div>
                      <span className="print-only" style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>
                        {(isReprintMode && reprintTask)
                          ? (reprintTask.planned_deadline ? new Date(reprintTask.planned_deadline).toLocaleDateString('uk-UA') : '—')
                          : (naryadDeadline ? new Date(naryadDeadline).toLocaleDateString('uk-UA') : '—')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="worksheet-scrollable" style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>


              <div className="table-responsive-container" style={{ marginBottom: '35px' }}>
                <table className="print-table screen-only-table no-print" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#111', textAlign: 'left', color: '#555' }} className="print-thr">
                      <th style={{ padding: '12px 15px', width: '20%', borderBottom: '1.5px solid #222' }} className="col-name">ДЕТАЛЬ В РОЗКРІЙ</th>
                      <th style={{ padding: '12px 15px', width: '14%', textAlign: 'center', borderBottom: '1.5px solid #222' }} className="no-print">ВЕРСТАТ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%' }} className="no-print">ПОТРЕБА</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%' }} className="no-print">СКЛАД БЗ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%', color: '#ff9000' }} className="col-plan">ПЛАН</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '12%' }} className="col-material">МАТЕРІАЛ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '5%' }} className="col-qty-sh">ШТ/Л</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', color: '#a855f7' }} className="col-sheets-total">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          ЗАГАЛОМ ЛИСТІВ
                          <button
                            type="button"
                            onClick={handleShowStockInfo}
                            title="Показати залишки на складі СО"
                            style={{
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)',
                              border: '1px solid rgba(168, 85, 247, 0.5)',
                              borderRadius: '50%',
                              color: '#d8b4fe',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              outline: 'none',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              marginLeft: '6px',
                              boxShadow: '0 0 8px rgba(168, 85, 247, 0.2), inset 0 0 4px rgba(168, 85, 247, 0.1)',
                              verticalAlign: 'middle'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.background = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
                              e.currentTarget.style.border = '1px solid #c084fc';
                              e.currentTarget.style.transform = 'scale(1.2) rotate(10deg)';
                              e.currentTarget.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.6), inset 0 0 6px rgba(255, 255, 255, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#d8b4fe';
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)';
                              e.currentTarget.style.border = '1px solid rgba(168, 85, 247, 0.5)';
                              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                              e.currentTarget.style.boxShadow = '0 0 8px rgba(168, 85, 247, 0.2), inset 0 0 4px rgba(168, 85, 247, 0.1)';
                            }}
                          >
                            <Info size={13} style={{ strokeWidth: 2.5 }} />
                          </button>
                        </div>
                      </th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', color: '#22c55e' }} className="col-sheets">ЛИСТІВ Т300</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', color: '#0ea5e9' }} className="col-sheets-t700">ЛИСТІВ Т700</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '4%', color: '#ff9000' }} className="col-bz">БЗ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeNaryadOrder.order_items?.map(it => {
                      const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                      const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)
                      if (thisNaryadQty <= 0) return null

                      if (activeNaryadOrder.isPrepOrder) {
                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                            <td style={{ padding: '18px 15px' }} className="col-name">
                              <div style={{ fontWeight: 1000, color: '#fff', fontSize: '1rem', letterSpacing: '-0.01em' }} className="print-txt">{nom?.name || '—'}</div>
                              {nom?.nomenclature_code && (
                                <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{nom.nomenclature_code}</div>
                              )}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '0.85rem', color: '#aaa', fontWeight: 800 }} className="no-print">
                              PREP-TERM
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }} className="no-print">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }} className="no-print">
                              —
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.2rem', color: '#ff9000', fontWeight: 1000 }} className="col-plan">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center' }} className="col-material">
                              <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">{nom?.name || '—'}</div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }} className="col-qty-sh">
                              1
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.4rem' }} className="col-sheets print-accent-g">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1rem', color: '#ff9000', fontWeight: 900 }} className="col-bz">
                              0
                            </td>
                          </tr>
                        )
                      }

                      const planned = getPlannedQty(it.id)
                      const remainingBalance = Math.max(0, Number(it.quantity) - planned)
const displayParts = getDisplayPartsForOrderItem(it)

                      const rows = displayParts.map((part, pIdx) => {
                        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]

                        // If reprint, use snapshot. Otherwise use thisNaryadQty
                        const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
                        const inStock = snapshot ? snapshot.stock : (() => {
                          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz')
                          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                        })()
                        const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)

                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                        const sheets = Math.ceil(totalToProduce / unitsPerSheet)

                        const sheets_t300 = snapshot
                          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
                          : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : (totalToProduce > 0 ? sheets : 0))
                        const sheets_t700 = snapshot
                          ? (Number(snapshot.sheets_t700) || 0)
                          : (materialSplits[part.nom?.id]?.t700 || 0)

                        const totalSplitsSheets = sheets_t300 + sheets_t700

                        return (
                          <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                            <td style={{ padding: '18px 15px' }} className="col-name">
                              {!isReprintMode ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {(() => {
                                      const rowKey = `${it.id}-${pIdx}`
                                      const query = partSearchQueries[rowKey] !== undefined ? partSearchQueries[rowKey] : ''
                                      const filteredParts = nomenclatures.filter(n =>
                                        n.type === 'part' &&
                                        (query === '' ||
                                         n.name.toLowerCase().includes(query.toLowerCase()) ||
                                         (n.nomenclature_code && n.nomenclature_code.toLowerCase().includes(query.toLowerCase())))
                                      )
                                      return (
                                        <div style={{ position: 'relative', flex: 1 }}>
                                          <input
                                            type="text"
                                            value={partSearchQueries[rowKey] !== undefined ? partSearchQueries[rowKey] : (part.nom?.name || '')}
                                            onChange={(e) => {
                                              const val = e.target.value
                                              setPartSearchQueries(prev => ({ ...prev, [rowKey]: val }))
                                            }}
                                            onFocus={() => {
                                              setOpenDropdownRowKey(rowKey)
                                              setPartSearchQueries(prev => ({ ...prev, [rowKey]: part.nom?.name || '' }))
                                            }}
                                            onBlur={() => setTimeout(() => {
                                              setOpenDropdownRowKey(null)
                                              setPartSearchQueries(prev => {
                                                const next = { ...prev }
                                                delete next[rowKey]
                                                return next
                                              })
                                            }, 250)}
                                            placeholder="Пошук деталі..."
                                            style={{
                                              background: '#111',
                                              border: '1px solid #333',
                                              color: '#fff',
                                              padding: '6px 12px',
                                              borderRadius: '10px',
                                              fontSize: '0.9rem',
                                              fontWeight: 'bold',
                                              width: '100%',
                                              outline: 'none'
                                            }}
                                          />
                                          {openDropdownRowKey === rowKey && (
                                            <div style={{
                                              position: 'absolute',
                                              top: '100%',
                                              left: 0,
                                              right: 0,
                                              background: '#0d0d0d',
                                              border: '1px solid #333',
                                              borderRadius: '10px',
                                              maxHeight: '220px',
                                              overflowY: 'auto',
                                              zIndex: 9999,
                                              marginTop: '5px',
                                              boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                                            }}>
                                              {filteredParts.length === 0 ? (
                                                <div style={{ padding: '10px', color: '#555', fontSize: '0.8rem', textAlign: 'center' }}>Немає таких деталей</div>
                                              ) : (
                                                filteredParts.map(n => (
                                                  <div
                                                    key={n.id}
                                                    onMouseDown={() => {
                                                      const oldNomId = part.nom?.id;
                                                      setNaryadParts(prev => {
                                                        const itemParts = [...(prev[it.id] || [])]
                                                        itemParts[pIdx] = { ...itemParts[pIdx], nom: n }
                                                        return { ...prev, [it.id]: itemParts }
                                                      })
                                                      if (oldNomId && oldNomId !== n.id) {
                                                        setRowMachines(prev => {
                                                          if (prev[oldNomId]) {
                                                            return { ...prev, [n.id]: prev[oldNomId] }
                                                          }
                                                          return prev
                                                        })
                                                        setMaterialSplits(prev => {
                                                          if (prev[oldNomId]) {
                                                            return { ...prev, [n.id]: prev[oldNomId] }
                                                          }
                                                          return prev
                                                        })
                                                      }
                                                      setOpenDropdownRowKey(null)
                                                      setPartSearchQueries(prev => {
                                                        const next = { ...prev }
                                                        delete next[rowKey]
                                                        return next
                                                      })
                                                    }}
                                                    style={{
                                                      padding: '10px 14px',
                                                      fontSize: '0.85rem',
                                                      cursor: 'pointer',
                                                      color: '#eee',
                                                      borderBottom: '1px solid #1c1c1c',
                                                      transition: 'all 0.2s',
                                                      textAlign: 'left'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.background = 'rgba(255,144,0,0.1)'
                                                      e.currentTarget.style.color = '#ff9000'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.background = 'transparent'
                                                      e.currentTarget.style.color = '#eee'
                                                    }}
                                                  >
                                                    {n.name} {n.nomenclature_code ? `(${n.nomenclature_code})` : ''}
                                                  </div>
                                                ))
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNaryadParts(prev => {
                                          const itemParts = (prev[it.id] || []).filter((_, idx) => idx !== pIdx)
                                          return { ...prev, [it.id]: itemParts }
                                        })
                                      }}
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444',
                                        borderRadius: '8px',
                                        width: '28px',
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                      }}
                                      title="Видалити деталь"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#888' }}>
                                    <span>К-ть на виріб:</span>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.001"
                                      value={part.quantity_per_parent}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setNaryadParts(prev => {
                                          const itemParts = [...(prev[it.id] || [])]
                                          itemParts[pIdx] = {
                                            ...itemParts[pIdx],
                                            quantity_per_parent: val
                                          }
                                          return { ...prev, [it.id]: itemParts }
                                        })
                                      }}
                                      style={{
                                        width: '60px',
                                        background: '#000',
                                        border: '1px solid #222',
                                        color: '#ff9000',
                                        padding: '4px 6px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        textAlign: 'center'
                                      }}
                                    />
                                    {part.nom?.nomenclature_code && (
                                      <span style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginLeft: 'auto' }}>
                                        {part.nom.nomenclature_code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 1000, color: '#fff', fontSize: '1rem', letterSpacing: '-0.01em' }} className="print-txt">{part.nom?.name || '—'}</div>
                                  {part.nom?.nomenclature_code && (
                                    <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{part.nom.nomenclature_code}</div>
                                  )}
                                  {(() => {
                                    const selectedMach = rowMachines[part.nom?.id] || selectedMachine?.name || ''
                                    if (!selectedMach) return null
                                    const opData = machineOperations?.find(o =>
                                      String(o.nomenclature_id) === String(part.nom?.id) &&
                                      (o.machine_type === selectedMach || o.machine_id === selectedMach)
                                    )
                                    if (!opData?.side2_cut_ops) return null
                                    const usesF2 = opData.side2_cut_ops.some(op => {
                                      if (!op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:')) return false
                                      const parts = op.split(':')
                                      const cutterNomId = parts[1]
                                      const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
                                      if (!cutterNom) return false
                                      const nameLower = cutterNom.name.toLowerCase()
                                      const fMatch = nameLower.match(/ф\s*([0-9,.]+)/)
                                      const parsedDiam = fMatch ? parseFloat(fMatch[1].replace(',', '.')) : null
                                      return parsedDiam === 2 || parsedDiam === 2.0
                                    })
                                    if (!usesF2) return null

                                    return (
                                      <div className="no-print" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.62rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Фреза:</span>
                                        {isReprintMode ? (
                                          <span style={{
                                            fontSize: '0.72rem', fontWeight: 900,
                                            color: (partCutterOverrides[part.nom?.id] || '2') === '1.5' ? '#f59e0b' : '#ff9000',
                                            background: (partCutterOverrides[part.nom?.id] || '2') === '1.5' ? 'rgba(245,158,11,0.12)' : 'rgba(255,144,0,0.1)',
                                            padding: '2px 8px', borderRadius: '5px'
                                          }}>
                                            Ф{(partCutterOverrides[part.nom?.id] || '2')} мм
                                          </span>
                                        ) : (
                                          <div style={{ display: 'flex', gap: '3px', background: '#111', borderRadius: '7px', padding: '2px' }}>
                                            {['2', '1.5'].map(val => {
                                              const isActive = (partCutterOverrides[part.nom?.id] || '2') === val
                                              return (
                                                <button
                                                  key={val}
                                                  onClick={() => setPartCutterOverrides(prev => ({ ...prev, [part.nom?.id]: val }))}
                                                  style={{
                                                    background: isActive ? (val === '1.5' ? '#f59e0b' : '#ff9000') : 'transparent',
                                                    color: isActive ? '#000' : '#555',
                                                    border: 'none',
                                                    padding: '3px 9px',
                                                    borderRadius: '5px',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 900,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    letterSpacing: '-0.01em',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                >
                                                  Ф{val}
                                                </button>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </>
                              )}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center' }} className="no-print">
                              {totalToProduce > 0 ? (
                                (() => {
                                  const splits = rowMachinesSplits[part.nom?.id] || []
                                  const isSplitMode = splits.length > 0
                                  const totalSheetsNeeded = sheets

                                  if (!isSplitMode) {
                                    return (
                                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        <select
                                          value={rowMachines[part.nom?.id] || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setRowMachines(prev => ({
                                              ...prev,
                                              [part.nom?.id]: val
                                            }));
                                          }}
                                          style={{
                                            flex: 1,
                                            background: '#111',
                                            border: '1px solid #333',
                                            color: '#fff',
                                            padding: '8px',
                                            borderRadius: '10px',
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
                                            outline: 'none',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <option value="">-- Оберіть верстат --</option>
                                          {MACHINE_TYPES.map(type => (
                                            <option key={type} value={type}>{type.split(' - ')[0]}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const initialSplits = [{ machine: rowMachines[part.nom?.id] || '', sheets: sheets, qty: totalToProduce }]
                                            setRowMachinesSplits(prev => ({
                                              ...prev,
                                              [part.nom?.id]: initialSplits
                                            }))
                                          }}
                                          title="Розділити на кілька верстатів"
                                          style={{ background: '#222', border: 'none', color: '#888', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                                        >
                                          <Shuffle size={14} />
                                        </button>
                                      </div>
                                    )
                                  } else {
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {splits.map((s, sIdx) => {
                                          return (
                                            <div key={sIdx} style={{ display: 'flex', gap: '5px', alignItems: 'center', background: '#080808', padding: '5px', borderRadius: '8px', border: '1px solid #151515' }}>
                                              <input
                                                type="number"
                                                value={s.sheets || ''}
                                                placeholder="Л."
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                                                  setRowMachinesSplits(prev => {
                                                    const newSplits = [...(prev[part.nom?.id] || [])]
                                                    newSplits[sIdx] = {
                                                      ...newSplits[sIdx],
                                                      sheets: val,
                                                      qty: val * unitsPerSheet
                                                    }
                                                    return { ...prev, [part.nom?.id]: newSplits }
                                                  })
                                                }}
                                                style={{ width: '60px', background: '#000', border: '1px solid #333', color: '#fff', padding: '6px 4px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 950, textAlign: 'center', outline: 'none' }}
                                              />
                                              <select
                                                value={s.machine || ''}
                                                onChange={(e) => {
                                                  const val = e.target.value
                                                  setRowMachinesSplits(prev => {
                                                    const newSplits = [...(prev[part.nom?.id] || [])]
                                                    newSplits[sIdx] = {
                                                      ...newSplits[sIdx],
                                                      machine: val
                                                    }
                                                    return { ...prev, [part.nom?.id]: newSplits }
                                                  })
                                                }}
                                                style={{ flex: 1, background: '#000', border: '1px solid #222', color: '#fff', padding: '5px', borderRadius: '6px', fontSize: '0.7rem' }}
                                              >
                                                <option value="">Тип верстата</option>
                                                {MACHINE_TYPES.map(t => <option key={t} value={t}>{t.split(' - ')[0]}</option>)}
                                              </select>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setRowMachinesSplits(prev => {
                                                    const newSplits = (prev[part.nom?.id] || []).filter((_, i) => i !== sIdx)
                                                    return { ...prev, [part.nom?.id]: newSplits }
                                                  })
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                          )
                                        })}
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentSum = splits.reduce((a, b) => a + (Number(b.sheets) || 0), 0)
                                              const remaining = Math.max(0, totalSheetsNeeded - currentSum)
                                              setRowMachinesSplits(prev => {
                                                const newSplits = [...(prev[part.nom?.id] || []), { machine: '', sheets: remaining, qty: remaining * unitsPerSheet }]
                                                return { ...prev, [part.nom?.id]: newSplits }
                                              })
                                            }}
                                            style={{ flex: 1, background: '#111', border: '1px solid #222', color: '#555', fontSize: '0.6rem', padding: '5px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800 }}
                                          >
                                            + ДОДАТИ ВЕРСТАТ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRowMachinesSplits(prev => ({
                                                ...prev,
                                                [part.nom?.id]: []
                                              }))
                                            }}
                                            style={{ background: '#111', border: '1px solid #222', color: '#ef4444', padding: '5px', borderRadius: '6px', cursor: 'pointer' }}
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                        {(() => {
                                          const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || 0), 0);
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
                                              padding: '4px',
                                              borderRadius: '8px',
                                              border: `1px solid ${statusColor}33`
                                            }}>
                                              {isOver ? (
                                                <span>ПЕРЕВИЩЕННЯ: {currentSumSheets} / {totalSheetsNeeded} л.</span>
                                              ) : (
                                                <span>ПЛАН: {currentSumSheets} / {totalSheetsNeeded} листів</span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )
                                  }
                                })()
                              ) : (
                                <span style={{ color: '#444', fontSize: '0.85rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }} className="no-print">
                              {totalNeeded.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }} className="no-print">
                              {inStock.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.2rem', color: '#ff9000', fontWeight: 1000 }} className="col-plan">
                              {totalToProduce.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center' }} className="col-material">
                              <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">
                                {(part.nom?.material_type || '—').replace(/т300/gi, '').replace(/t300/gi, '').replace(/т700/gi, '').replace(/t700/gi, '').replace(/\s+/g, ' ').trim()}
                              </div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }} className="col-qty-sh">
                              {unitsPerSheet.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#a855f7', fontSize: '1.4rem' }} className="col-sheets-total print-accent-p">
                              {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                            </td>
                            <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.4rem' }} className="col-sheets print-accent-g">
                              {isReprintMode ? (
                                sheets_t300.toString()
                              ) : totalToProduce > 0 ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={sheets}
                                  value={sheets_t300}
                                  onChange={(e) => handleSplitChange(part.nom?.id, 't300', e.target.value, sheets)}
                                  style={{
                                    width: '60px',
                                    background: '#111',
                                    border: '1px solid #333',
                                    color: '#22c55e',
                                    padding: '5px',
                                    borderRadius: '5px',
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                  }}
                                />
                              ) : '0'}
                            </td>
                            <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 1000, color: '#0ea5e9', fontSize: '1.4rem' }} className="col-sheets-t700 print-accent-b">
                              {isReprintMode ? (
                                sheets_t700.toString()
                              ) : totalToProduce > 0 ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={sheets}
                                  value={sheets_t700}
                                  onChange={(e) => handleSplitChange(part.nom?.id, 't700', e.target.value, sheets)}
                                  style={{
                                    width: '60px',
                                    background: '#111',
                                    border: '1px solid #333',
                                    color: '#0ea5e9',
                                    padding: '5px',
                                    borderRadius: '5px',
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                  }}
                                />
                              ) : '0'}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1rem', color: '#ff9000', fontWeight: 900 }} className="col-bz">
                              {totalToProduce > 0 ? `+${(totalSplitsSheets * unitsPerSheet) - totalToProduce}` : '0'}
                            </td>
                          </tr>
                        )
                      })

                      if (!isReprintMode) {
                        rows.push(
                          <tr key={`add-part-${it.id}`} style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,144,0,0.015)' }} className="no-print">
                            <td colSpan={11} style={{ padding: '12px 15px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const firstPart = nomenclatures.find(n => n.type === 'part' || n.type === 'raw' || !n.type)
                                  setNaryadParts(prev => {
                                    const itemParts = [...(prev[it.id] || [])]
                                    itemParts.push({
                                      nom: firstPart,
                                      quantity_per_parent: 1
                                    })
                                    return { ...prev, [it.id]: itemParts }
                                  })
                                }}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#10b981',
                                  padding: '8px 16px',
                                  borderRadius: '10px',
                                  fontSize: '0.8rem',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s'
                                }}
                              >
                                ➕ Додати деталь в розкрій
                              </button>
                            </td>
                          </tr>
                        )
                      }
                      return rows
                    })}
                  </tbody>
                  <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }} className="print-tf">
                    {(() => {
                      let totalNeed = 0;
                      let totalPlan = 0;
                      let totalSheetsT300 = 0;
                      let totalSheetsT700 = 0;

                      if (activeNaryadOrder.isPrepOrder) {
                        activeNaryadOrder.order_items?.forEach(it => {
                          totalNeed += Number(it.quantity);
                          totalPlan += Number(it.quantity);
                          totalSheetsT300 += Number(it.quantity);
                        });
                      } else {
                        activeNaryadOrder.order_items?.forEach(it => {
                          const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                          const displayParts = getDisplayPartsForOrderItem(it);

                          displayParts.forEach(part => {
                            const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)];
                            const need = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1));
                            const inStock = snapshot ? snapshot.stock : (() => {
                              const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz');
                              return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;
                            })();
                            const plan = snapshot ? snapshot.plan : Math.max(0, need - inStock);
                            const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1;
                            const sheets = Math.ceil(plan / unitsPerSheet);

                            const sheets_t300 = snapshot
                              ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
                              : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : (plan > 0 ? sheets : 0));
                            const sheets_t700 = snapshot
                              ? (Number(snapshot.sheets_t700) || 0)
                              : (materialSplits[part.nom?.id]?.t700 || 0);

                            totalNeed += need;
                            totalPlan += plan;
                            totalSheetsT300 += sheets_t300;
                            totalSheetsT700 += sheets_t700;
                          });
                        });
                      }

                      return (
                        <tr>
                          <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="col-name print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                          <td className="no-print" style={{ border: '1px solid #000' }}></td>
                          <td className="no-print" style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.2rem', border: '1px solid #000' }}>{totalNeed.toString()}</td>
                          <td className="no-print" style={{ border: '1px solid #000' }}></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="col-plan print-txt">
                            {totalPlan.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }} className="col-material"></td>
                          <td style={{ border: '1px solid #000' }} className="col-qty-sh"></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#a855f7', border: '1px solid #000' }} className="col-sheets-total print-accent-p">
                            {(totalSheetsT300 + totalSheetsT700).toString()}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="col-sheets print-accent-g">
                            {totalSheetsT300.toString()}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#0ea5e9', border: '1px solid #000' }} className="col-sheets-t700 print-accent-b">
                            {totalSheetsT700.toString()}
                          </td>
                          <td className="col-bz" style={{ border: '1px solid #000' }}></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>

                {/* PRINT ONLY TABLE (EXACTLY 8 COLUMNS FOR SPLIT SHEETS) */}
                <table className="print-table print-only-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#111', textAlign: 'left', color: '#555' }} className="print-thr">
                      <th style={{ padding: '12px 15px', width: '30%' }} className="col-name">ДЕТАЛЬ В РОЗКРІЙ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }} className="col-plan">ПЛАН</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '16%' }} className="col-material">МАТЕРІАЛ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '6%' }} className="col-qty-sh">ШТ/Л</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', color: '#a855f7' }} className="col-sheets-total">ЗАГАЛОМ ЛИСТІВ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', color: '#22c55e' }} className="col-sheets">ЛИСТІВ Т300</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', color: '#0ea5e9' }} className="col-sheets-t700">ЛИСТІВ Т700</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%' }} className="col-bz">БЗ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeNaryadOrder.order_items?.map(it => {
                      const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                      const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)
                      if (thisNaryadQty <= 0) return null

                      if (activeNaryadOrder.isPrepOrder) {
                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                            <td className="col-name">
                              <div style={{ fontWeight: 1000, color: '#000', fontSize: '0.75rem', letterSpacing: '-0.01em' }} className="print-txt">{nom?.name || '—'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 1000 }} className="col-plan">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ textAlign: 'center' }} className="col-material">
                              <div style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }} className="print-subtxt">
                                {(nom?.name || '—').replace(/т300/gi, '').replace(/t300/gi, '').replace(/т700/gi, '').replace(/t700/gi, '').replace(/\s+/g, ' ').trim()}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem' }} className="col-qty-sh">
                              1
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-total print-accent-p">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets print-accent-g">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-t700 print-accent-b">
                              0
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900 }} className="col-bz">
                              0
                            </td>
                          </tr>
                        )
                      }

                      const displayParts = getDisplayPartsForOrderItem(it)

                      return displayParts.map((part, pIdx) => {
                        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]

                        const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
                        const inStock = snapshot ? snapshot.stock : (() => {
                          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz')
                          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                        })()
                        const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)

                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                        const sheets = Math.ceil(totalToProduce / unitsPerSheet)

                        const sheets_t300 = snapshot
                          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
                          : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : (totalToProduce > 0 ? sheets : 0))
                        const sheets_t700 = snapshot
                          ? (Number(snapshot.sheets_t700) || 0)
                          : (materialSplits[part.nom?.id]?.t700 || 0)

                        const totalSplitsSheets = sheets_t300 + sheets_t700

                        return (
                          <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                            <td className="col-name">
                              <div style={{ fontWeight: 1000, color: '#000', fontSize: '0.75rem', letterSpacing: '-0.01em' }} className="print-txt">{part.nom?.name || '—'}</div>
                              {part.nom?.nomenclature_code && (
                                <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{part.nom.nomenclature_code}</div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 1000 }} className="col-plan">
                              {totalToProduce.toString()}
                            </td>
                            <td style={{ textAlign: 'center' }} className="col-material">
                              <div style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }} className="print-subtxt">
                                {(part.nom?.material_type || '—').replace(/т300/gi, '').replace(/t300/gi, '').replace(/т700/gi, '').replace(/t700/gi, '').replace(/\s+/g, ' ').trim()}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem' }} className="col-qty-sh">
                              {unitsPerSheet.toString()}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-total print-accent-p">
                              {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets print-accent-g">
                              {totalToProduce > 0 ? (sheets_t300 || 0).toString() : '0'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-t700 print-accent-b">
                              {totalToProduce > 0 ? (sheets_t700 || 0).toString() : '0'}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900 }} className="col-bz">
                              {totalToProduce > 0 ? `+${(totalSplitsSheets * unitsPerSheet) - totalToProduce}` : '0'}
                            </td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                  <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }} className="print-tf">
                    {(() => {
                      let totalNeed = 0;
                      let totalPlan = 0;
                      let totalSheetsT300 = 0;
                      let totalSheetsT700 = 0;

                      if (activeNaryadOrder.isPrepOrder) {
                        activeNaryadOrder.order_items?.forEach(it => {
                          totalNeed += Number(it.quantity);
                          totalPlan += Number(it.quantity);
                          totalSheetsT300 += Number(it.quantity);
                        });
                      } else {
                        activeNaryadOrder.order_items?.forEach(it => {
                          const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                          const displayParts = getDisplayPartsForOrderItem(it);

                          displayParts.forEach(part => {
                            const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)];
                            const need = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1));
                            const inStock = snapshot ? snapshot.stock : (() => {
                              const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz');
                              return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;
                            })();
                            const plan = snapshot ? snapshot.plan : Math.max(0, need - inStock);
                            const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1;
                            const sheets = Math.ceil(plan / unitsPerSheet);

                            const sheets_t300 = snapshot
                              ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : Number(snapshot.sheets))
                              : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : (plan > 0 ? sheets : 0));
                            const sheets_t700 = snapshot
                              ? (Number(snapshot.sheets_t700) || 0)
                              : (materialSplits[part.nom?.id]?.t700 || 0);

                            totalNeed += need;
                            totalPlan += plan;
                            totalSheetsT300 += sheets_t300;
                            totalSheetsT700 += sheets_t700;
                          });
                        });
                      }

                      return (
                        <tr>
                          <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="col-name print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="col-plan print-txt">
                            {totalPlan.toString()}
                          </td>
                          <td style={{ border: '1px solid #000' }} className="col-material"></td>
                          <td style={{ border: '1px solid #000' }} className="col-qty-sh"></td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#a855f7', border: '1px solid #000' }} className="col-sheets-total print-accent-p">
                            {(totalSheetsT300 + totalSheetsT700).toString()}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="col-sheets print-accent-g">
                            {totalSheetsT300.toString()}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#0ea5e9', border: '1px solid #000' }} className="col-sheets-t700 print-accent-b">
                            {totalSheetsT700.toString()}
                          </td>
                          <td className="col-bz" style={{ border: '1px solid #000' }}></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>

              {materialSummary.length > 0 && (
                <div className="mat-summary-section" style={{ marginTop: '25px', padding: '20px 30px', borderRadius: '18px', border: '1px solid #222', background: '#070707' }}>
                  <h4 style={{ margin: '0 0 15px', fontSize: '0.75rem', fontWeight: 950, color: '#444', textTransform: 'uppercase' }}>ВІДОМІСТЬ МАТЕРІАЛІВ:</h4>
                  <div className="mat-flex-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '25px', overflowX: 'hidden' }}>
                    {materialSummary.map((m, idx) => (
                      <div key={idx} className="mat-card-p" style={{ flex: 1, padding: '0 0 5px 15px', borderLeft: '4px solid #ff9000', minWidth: 'min-content' }}>
                        <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 800, marginBottom: '3px' }} className="print-subtxt">{m.name || '—'}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 950, color: '#fff' }} className="print-txt">{(Number(m.sheets) || 0).toString()} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: '#444' }} className="print-subtxt">{m.unit || 'ЛИСТІВ'}</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!activeNaryadOrder.isPrepOrder && hasUnassignedMachines ? (
                <div className="consumable-summary-section no-print" style={{ marginTop: '15px', padding: '20px 30px', borderRadius: '18px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 950, color: '#ef4444', textTransform: 'uppercase' }}>ВИТРАТНІ МАТЕРІАЛИ:</h4>
                  <div style={{ color: '#aaa', fontSize: '0.85rem', fontWeight: 700 }}>
                    ⚠️ Оберіть верстат для кожної деталі в таблиці, щоб розрахувати та відобразити необхідні фрези.
                  </div>
                </div>
              ) : (
                consumableSummary.length > 0 && (
                  <div className="consumable-summary-section" style={{ marginTop: '15px', padding: '20px 30px', borderRadius: '18px', border: '1px solid #222', background: 'rgba(59,130,246,0.05)' }}>
                    <h4 style={{ margin: '0 0 15px', fontSize: '0.75rem', fontWeight: 950, color: '#3b82f6', textTransform: 'uppercase' }}>ВИТРАТНІ МАТЕРІАЛИ:</h4>
                    <div className="mat-flex-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '25px' }}>
                      {consumableSummary.map((c, idx) => {
                        const selectedInvId = selectedCutters[c.name];
                        const selectedInv = selectedInvId ? (inventory || []).find(i => String(i.id) === String(selectedInvId)) : null;
                        const nom = selectedInv ? nomenclatures.find(n => String(n.id) === String(selectedInv.nomenclature_id)) : null;
                        const displayName = nom ? nom.name : c.name;

                        // Show toggle for Ф2 AND Ф1.5 cards (Ф1.5 is just an overridden Ф2)
                        const cNameLower = c.name.toLowerCase()
                        const cFMatch = cNameLower.match(/ф\s*([0-9,.]+)/)
                        const cDiam = cFMatch ? parseFloat(cFMatch[1].replace(',', '.')) : null
                        const isSwitchableCard = cDiam === 2 || Math.abs((cDiam || 0) - 1.5) < 0.01

                        // Find all part nomIds in this order that use Ф2 in their operations
                        const f2PartIds = isSwitchableCard ? (() => {
                          const ids = []
                          activeNaryadOrder.order_items?.forEach(item => {
                            getDisplayPartsForOrderItem(item).forEach(part => {
                              if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return
                              const machineName = rowMachines[part.nom.id]
                              if (!machineName) return
                              const opData = machineOperations?.find(o =>
                                String(o.nomenclature_id) === String(part.nom.id) &&
                                (o.machine_type === machineName || o.machine_id === machineName)
                              )
                              if (!opData?.side2_cut_ops) return
                              const hasF2 = opData.side2_cut_ops.some(op => {
                                if (!op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:')) return false
                                const opSplit = op.split(':')
                                const cnId = opSplit[1]
                                const cnNom = nomenclatures?.find(n => String(n.id) === String(cnId))
                                if (!cnNom) return false
                                const nl = cnNom.name.toLowerCase()
                                const m = nl.match(/ф\s*([0-9,.]+)/)
                                const d = m ? parseFloat(m[1].replace(',', '.')) : null
                                return d === 2
                              })
                              if (hasF2 && !ids.includes(part.nom.id)) ids.push(part.nom.id)
                            })
                          })
                          return ids
                        })() : []

                        // Current override state for these parts
                        const currentF2Override = f2PartIds.length > 0 &&
                          f2PartIds.every(id => (partCutterOverrides[id] || '2') === '1.5') ? '1.5' : '2'

                        return (
                          <div key={idx} className="mat-card-p" style={{
                            padding: '10px 15px',
                            borderLeft: `4px solid ${isSwitchableCard && currentF2Override === '1.5' ? '#f59e0b' : '#3b82f6'}`,
                            minWidth: '150px',
                            borderRadius: '0 8px 8px 0',
                            background: isSwitchableCard && currentF2Override === '1.5' ? 'rgba(245,158,11,0.05)' : 'transparent',
                            transition: 'all 0.2s'
                          }}>
                            <div style={{ fontSize: '0.65rem', color: isSwitchableCard && currentF2Override === '1.5' ? '#f59e0b' : '#555', fontWeight: 800, marginBottom: '3px', transition: 'color 0.2s' }} className="print-subtxt">
                              {displayName}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff' }} className="print-txt">
                              {(Number(c.total) || 0).toString()} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: '#444' }} className="print-subtxt">ОД.</small>
                            </div>
                            {isSwitchableCard && f2PartIds.length > 0 && !isReprintMode && (
                              <div style={{ marginTop: '8px', display: 'flex', gap: '3px', background: '#0d0d0d', borderRadius: '7px', padding: '2px', width: 'fit-content' }}>
                                {[['2', 'Ф2'], ['1.5', 'Ф1.5']].map(([val, label]) => {
                                  const isActive = currentF2Override === val
                                  return (
                                    <button
                                      key={val}
                                      onClick={() => {
                                        setPartCutterOverrides(prev => {
                                          const next = { ...prev }
                                          f2PartIds.forEach(id => {
                                            next[id] = val
                                          })
                                          return next
                                        })
                                      }}
                                      style={{
                                        background: isActive ? (val === '1.5' ? '#f59e0b' : '#3b82f6') : 'transparent',
                                        color: isActive ? '#fff' : '#888',
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: '5px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}

              {consumableSummary.length > 0 && (() => {
                const cutterItems = consumableSummary.filter(c => c.name.toLowerCase().startsWith('фреза'))
                if (cutterItems.length === 0) return null
                return (
                  <div className="stock-cutters-section no-print" style={{ marginTop: '15px', padding: '20px 30px', borderRadius: '18px', border: '1px solid rgba(255,144,0,0.18)', background: 'rgba(255,144,0,0.03)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: 950, color: '#ff9000', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🔧 ВИБІР ФРЕЗ ЗІ СКЛАДУ
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {cutterItems.map((c, idx) => {
                      // Extract diameter from the consumable name e.g. "Фреза ф3" → 3, "Фреза ф1.5" → 1.5
                      const nameLower = c.name.toLowerCase()
                      const fMatch = nameLower.match(/ф\s*([0-9][0-9,.]*)/)
                      const parsedDiam = fMatch ? parseFloat(fMatch[1].replace(',', '.')) : null

                      // Helper: extract cutting diameter from an inventory cutter nom name
                      // Handles: "Фреза ф2", "Фреза кукурудза 2×3,175×6×50", "Фреза двопера 3×4×6×50"
                      const extractNomDiam = (nomName) => {
                        const nl = nomName.toLowerCase()
                        // 1) Explicit ф<number> pattern
                        const m1 = nl.match(/ф\s*([0-9][0-9,.]*)/)
                        if (m1) return parseFloat(m1[1].replace(',', '.'))
                        // 2) First dimension before × (e.g. "кукурудза 2×3,175×..." or "двопера 3×4×...")
                        const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх×])/)
                        if (m2) return parseFloat(m2[1].replace(',', '.'))
                        // 3) Last resort: first standalone number in name
                        const m3 = nl.match(/\b([0-9][0-9,.]*)\b/)
                        if (m3) return parseFloat(m3[1].replace(',', '.'))
                        return null
                      }

                      // Filter inventory for consumable cutters with matching diameter
                      const stockCutters = (inventory || []).filter(inv => {
                        const nom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                        if (!nom) return false
                        if (!nom.name.toLowerCase().startsWith('фреза')) return false
                        if (inv.type !== 'consumable') return false
                        const availQty = Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0))
                        if (availQty <= 0) return false
                        if (parsedDiam) {
                          const nomDiam = extractNomDiam(nom.name)
                          if (nomDiam === null) return false
                          return Math.abs(nomDiam - parsedDiam) < 0.01
                        }
                        return true
                      })

                        const selectedInvId = selectedCutters[c.name] || ''
                        const selectedInv = stockCutters.find(inv => String(inv.id) === String(selectedInvId))
                        const availQty = selectedInv ? Math.max(0, (Number(selectedInv.total_qty) || 0) - (Number(selectedInv.reserved_qty) || 0)) : null

                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: '180px' }}>
                              <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, marginBottom: '2px' }}>{c.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Потрібно: <span style={{ color: '#fff', fontWeight: 900 }}>{c.total} ОД.</span></div>
                            </div>
                            <div style={{ flex: 1, minWidth: '260px' }}>
                              <select
                                value={selectedInvId}
                                onChange={e => setSelectedCutters(prev => ({ ...prev, [c.name]: e.target.value }))}
                                style={{
                                  width: '100%',
                                  background: '#0d0d11',
                                  border: selectedInvId ? '1px solid rgba(255,144,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '10px',
                                  color: '#fff',
                                  padding: '9px 14px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  outline: 'none',
                                  cursor: 'pointer',
                                  fontFamily: "'Outfit', sans-serif"
                                }}
                              >
                                <option value="">— Оберіть фрезу зі складу —</option>
                                {stockCutters.map(inv => {
                                  const nom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                                  const qty = Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0))
                                  return (
                                    <option key={inv.id} value={inv.id}>
                                      {nom?.name || inv.name} — {qty} шт на складі
                                    </option>
                                  )
                                })}
                                {stockCutters.length === 0 && (
                                  <option disabled value="">Немає фрез на складі</option>
                                )}
                              </select>
                            </div>
                            {selectedInvId && availQty !== null && (
                              <div style={{
                                fontSize: '0.72rem', fontWeight: 800, padding: '6px 12px', borderRadius: '8px',
                                background: availQty >= c.total ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: availQty >= c.total ? '#10b981' : '#ef4444',
                                border: `1px solid ${availQty >= c.total ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                              }}>
                                {availQty >= c.total ? '✓ Достатньо' : `⚠ Не вистачає ${c.total - availQty} шт`}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="no-print" style={{ padding: '30px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button onClick={() => { setActiveNaryadOrder(null); setReprintTask(null); setSelectedCutters({}); setPartCutterOverrides({}); }} style={{ background: '#222', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
              <button
                onClick={handlePrint}
                disabled={isPrintDisabled}
                style={{
                  background: isPrintDisabled ? '#222' : '#ff9000',
                  color: isPrintDisabled ? '#555' : '#000',
                  border: 'none',
                  padding: '12px 45px',
                  borderRadius: '12px',
                  fontWeight: 950,
                  cursor: isPrintDisabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: '0.2s',
                  opacity: isPrintDisabled ? 0.6 : 1
                }}
              >
                {isSubmitting ? 'ЧЕКАЙТЕ...' : (isReprintMode ? 'ПОВТОРНИЙ ДРУК' : 'ДРУКУВАТИ ТА В РОБОТУ')}
              </button>
            </div>
            {stockInfoModalData && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 10005,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={() => setStockInfoModalData(null)}>
                <div style={{
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '24px',
                  padding: '30px',
                  width: '95%',
                  maxWidth: '500px',
                  boxShadow: '0 0 30px rgba(168, 85, 247, 0.25)',
                  animation: 'fadeIn 0.2s ease-out'
                }}
                onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#a855f7', fontWeight: 950, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={20} />
                      {stockInfoModalData.title}
                    </h3>
                    <button
                      onClick={() => setStockInfoModalData(null)}
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        color: '#aaa',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr',
                      padding: '10px 15px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      borderBottom: '2px solid #222',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      <div>Товщина</div>
                      <div style={{ textAlign: 'center', color: '#22c55e' }}>Т300</div>
                      <div style={{ textAlign: 'center', color: '#0ea5e9' }}>Т700</div>
                    </div>
                    {stockInfoModalData.items.length === 0 ? (
                      <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontSize: '0.9rem' }}>Немає підготовлених листів на залишку.</div>
                    ) : (
                      stockInfoModalData.items.map((item, idx) => (
                        <div key={idx} style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr',
                          alignItems: 'center',
                          padding: '14px 15px',
                          background: '#111',
                          borderRadius: '14px',
                          border: '1px solid #1a1a1a'
                        }}>
                          <span style={{ fontSize: '1rem', color: '#eee', fontWeight: 800 }}>Лист ({item.thickness})</span>
                          <span style={{
                            textAlign: 'center',
                            fontSize: '1.25rem',
                            color: item.t300 > 0 ? '#22c55e' : '#444',
                            fontWeight: 950
                          }}>
                            {item.t300} <small style={{ fontSize: '0.7rem', fontWeight: 400, color: '#444' }}>шт</small>
                          </span>
                          <span style={{
                            textAlign: 'center',
                            fontSize: '1.25rem',
                            color: item.t700 > 0 ? '#0ea5e9' : '#444',
                            fontWeight: 950
                          }}>
                            {item.t700} <small style={{ fontSize: '0.7rem', fontWeight: 400, color: '#444' }}>шт</small>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {quickPlanOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '24px', border: '1px solid #222', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', color: '#ff9000', fontWeight: 900 }}>ШВИДКЕ ПЛАНУВАННЯ</h3>
            <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '25px' }}>Вкажіть кількість комплектів для цього наряду та планивий дедлайн.</p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>КІЛЬКІСТЬ КОМПЛЕКТІВ</label>
              <input
                type="number"
                value={tempSets}
                onChange={e => setTempSets(e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 900 }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>ДЕЛАЙН ПАРТІЇ</label>
              <input
                type="date"
                value={tempDeadline ? tempDeadline.split('T')[0] : ''}
                onChange={e => setTempDeadline(e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setQuickPlanOrder(null)} style={{ flex: 1, padding: '12px', background: '#222', color: '#555', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
              <button
                onClick={() => {
                  handleOpenNaryadModal(quickPlanOrder, tempSets, tempDeadline);
                  setQuickPlanOrder(null);
                }}
                style={{ flex: 2, padding: '12px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
              >
                ДАЛІ
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrepModal && (() => {
        const prepNoms = nomenclatures.filter(n => n.name.toLowerCase().includes('непідготовлений'))

        const thicknessMap = {}
        prepNoms.forEach(n => {
          const match = n.name.match(/\((\d+(?:\.\d+)?)\s*мм\)/i)
          const thickness = match ? `${match[1]} мм` : 'Інше'
          const isT700 = n.name.toLowerCase().includes('т700') || n.name.toLowerCase().includes('t700')
          const isT300 = n.name.toLowerCase().includes('т300') || n.name.toLowerCase().includes('t300')
          
          if (!thicknessMap[thickness]) {
            thicknessMap[thickness] = {}
          }
          if (isT700) {
            thicknessMap[thickness].t700 = n
          } else if (isT300) {
            thicknessMap[thickness].t300 = n
          } else {
            thicknessMap[thickness].other = n
          }
        })

        const sortedThicknesses = Object.keys(thicknessMap).sort((a, b) => {
          if (a === 'Інше') return 1
          if (b === 'Інше') return -1
          const thickA = parseFloat(a) || 0
          const thickB = parseFloat(b) || 0
          return thickA - thickB
        })

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel" style={{ 
              background: '#0a0a0a', 
              padding: '30px', 
              borderRadius: '24px', 
              border: '1px solid #222', 
              width: '95%', 
              maxWidth: '720px', 
              display: 'flex', 
              flexDirection: 'column', 
              maxHeight: '95vh',
              boxShadow: '0 10px 40px rgba(16,185,129,0.15)',
              overflowY: 'auto'
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '1.4rem', color: '#10b981', fontWeight: 900 }}>НАРЯД НА ПІДГОТОВКУ</h3>

              <div style={{ display: 'block', fontSize: '0.75rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px' }}>
                СИРОВИНА (НЕПІДГОТОВЛЕНА)
              </div>

              {/* Two side-by-side grids */}
              <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', marginBottom: '25px' }}>
                
                {/* Left Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.2fr 1fr 1fr', 
                    gap: '10px', 
                    paddingBottom: '5px',
                    borderBottom: '1px solid #222',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    <div>Товщина</div>
                    <div style={{ textAlign: 'center', color: '#22c55e' }}>Т300</div>
                    <div style={{ textAlign: 'center', color: '#0ea5e9' }}>Т700</div>
                  </div>
                  
                  {sortedThicknesses.slice(0, Math.ceil(sortedThicknesses.length / 2)).map(thick => {
                    const entry = thicknessMap[thick]
                    return (
                      <div key={thick} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.2fr 1fr 1fr', 
                        alignItems: 'center', 
                        gap: '10px', 
                        background: '#111',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: '1px solid #1a1a1a'
                      }}>
                        <span style={{ fontSize: '0.85rem', color: '#eee', fontWeight: 800 }}>Лист ({thick})</span>
                        
                        {/* T300 Input */}
                        <div>
                          {entry.t300 ? (
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={prepQuantities[entry.t300.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setPrepQuantities(prev => ({
                                  ...prev,
                                  [entry.t300.id]: val === '' ? '' : Math.max(0, parseInt(val) || 0)
                                }));
                              }}
                              style={{ 
                                width: '100%', 
                                background: '#000', 
                                border: '1px solid #333', 
                                color: '#22c55e', 
                                padding: '6px', 
                                borderRadius: '8px', 
                                fontSize: '1rem', 
                                fontWeight: 950, 
                                textAlign: 'center',
                                outline: 'none' 
                              }}
                            />
                          ) : (
                            <div style={{ color: '#333', textAlign: 'center', fontSize: '0.85rem' }}>—</div>
                          )}
                        </div>
                        
                        {/* T700 Input */}
                        <div>
                          {entry.t700 ? (
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={prepQuantities[entry.t700.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setPrepQuantities(prev => ({
                                  ...prev,
                                  [entry.t700.id]: val === '' ? '' : Math.max(0, parseInt(val) || 0)
                                }));
                              }}
                              style={{ 
                                width: '100%', 
                                background: '#000', 
                                border: '1px solid #333', 
                                color: '#0ea5e9', 
                                padding: '6px', 
                                borderRadius: '8px', 
                                fontSize: '1rem', 
                                fontWeight: 950, 
                                textAlign: 'center',
                                outline: 'none' 
                              }}
                            />
                          ) : (
                            <div style={{ color: '#333', textAlign: 'center', fontSize: '0.85rem' }}>—</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.2fr 1fr 1fr', 
                    gap: '10px', 
                    paddingBottom: '5px',
                    borderBottom: '1px solid #222',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    <div>Товщина</div>
                    <div style={{ textAlign: 'center', color: '#22c55e' }}>Т300</div>
                    <div style={{ textAlign: 'center', color: '#0ea5e9' }}>Т700</div>
                  </div>
                  
                  {sortedThicknesses.slice(Math.ceil(sortedThicknesses.length / 2)).map(thick => {
                    const entry = thicknessMap[thick]
                    return (
                      <div key={thick} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.2fr 1fr 1fr', 
                        alignItems: 'center', 
                        gap: '10px', 
                        background: '#111',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: '1px solid #1a1a1a'
                      }}>
                        <span style={{ fontSize: '0.85rem', color: '#eee', fontWeight: 800 }}>Лист ({thick})</span>
                        
                        {/* T300 Input */}
                        <div>
                          {entry.t300 ? (
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={prepQuantities[entry.t300.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setPrepQuantities(prev => ({
                                  ...prev,
                                  [entry.t300.id]: val === '' ? '' : Math.max(0, parseInt(val) || 0)
                                }));
                              }}
                              style={{ 
                                width: '100%', 
                                background: '#000', 
                                border: '1px solid #333', 
                                color: '#22c55e', 
                                padding: '6px', 
                                borderRadius: '8px', 
                                fontSize: '1rem', 
                                fontWeight: 950, 
                                textAlign: 'center',
                                outline: 'none' 
                              }}
                            />
                          ) : (
                            <div style={{ color: '#333', textAlign: 'center', fontSize: '0.85rem' }}>—</div>
                          )}
                        </div>
                        
                        {/* T700 Input */}
                        <div>
                          {entry.t700 ? (
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={prepQuantities[entry.t700.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setPrepQuantities(prev => ({
                                  ...prev,
                                  [entry.t700.id]: val === '' ? '' : Math.max(0, parseInt(val) || 0)
                                }));
                              }}
                              style={{ 
                                width: '100%', 
                                background: '#000', 
                                border: '1px solid #333', 
                                color: '#0ea5e9', 
                                padding: '6px', 
                                borderRadius: '8px', 
                                fontSize: '1rem', 
                                fontWeight: 950, 
                                textAlign: 'center',
                                outline: 'none' 
                              }}
                            />
                          ) : (
                            <div style={{ color: '#333', textAlign: 'center', fontSize: '0.85rem' }}>—</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

              </div>

              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>ДЕДЛАЙН</label>
                <input
                  type="date"
                  value={prepDeadline ? prepDeadline.split('T')[0] : ''}
                  onChange={e => setPrepDeadline(e.target.value)}
                  style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowPrepModal(false)} style={{ flex: 1, padding: '12px', background: '#222', color: '#555', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
                <button
                  onClick={handleCreatePrepOrder}
                  disabled={isSubmitting}
                  style={{ flex: 2, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'ЧЕКАЙТЕ...' : 'СТВОРИТИ'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MOBILE DRAWER */}
      {isDrawerOpen && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              background: '#0a0a0a',
              width: '85%',
              maxWidth: '380px',
              height: '100%',
              borderLeft: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              overflowY: 'auto',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              animation: 'slideIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {drawerType === 'queue' ? (
                  <>
                    <ListChecks size={18} color="#ff9000" />
                    <span>ЧЕРГА ЗАМОВЛЕНЬ</span>
                  </>
                ) : (
                  <>
                    <History size={18} color="#10b981" />
                    <span>АРХІВ ЗАМОВЛЕНЬ</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  color: '#aaa',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1 }}>
              {drawerType === 'queue' ? renderOrderQueue() : renderArchiveContent()}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .print-only-table {
          display: none !important;
        }
        .master-grid {
          grid-template-columns: minmax(300px, 320px) 1fr minmax(280px, 300px) !important;
        }
        .mobile-nav-buttons {
          display: flex !important;
          gap: 8px;
        }
        @media (min-width: 769px) {
          .mobile-nav-buttons {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .master-grid {
            grid-template-columns: 1fr !important;
            gap: 15px !important;
          }
          .module-content {
            padding: 10px !important;
          }
        }
        .interactive-naryad-title {
          text-decoration: underline !important;
          text-decoration-style: dashed !important;
          text-decoration-color: rgba(255, 144, 0, 0.6) !important;
          text-underline-offset: 4px !important;
          transition: all 0.2s ease !important;
        }
        .interactive-naryad-title:hover {
          color: #ff9000 !important;
          text-decoration-color: #ff9000 !important;
          text-decoration-style: solid !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media print {
          .print-only-table {
            display: table !important;
          }
          .screen-only-table {
            display: none !important;
          }
          @page { 
            size: A4 portrait; 
            margin: 8mm !important; /* Safe zone margin for physical printers */
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #fff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Force box-sizing and white backgrounds */
          * { 
            visibility: hidden !important; 
            background: transparent !important; 
            color: #000 !important; 
            box-sizing: border-box !important;
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .print-target, .print-target * { 
            visibility: visible !important; 
          }
          
           /* DYNAMIC CONTAINER FOR A4 */
          /* CRITICAL FIX: position:fixed breaks print on mobile browsers (Chrome Android, Safari iOS) */
          .worksheet-modal-overlay {
            position: static !important;
            inset: auto !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: auto !important;
            background: #fff !important;
            z-index: auto !important;
            display: block !important;
            padding: 0 !important;
            align-items: unset !important;
            justify-content: unset !important;
          }
          
          .print-target { 
            position: static !important; 
            width: 100% !important;
            max-width: 100% !important;
            background: #fff !important; 
            display: block !important;
            padding: 10mm 15mm !important;
            margin: 0 auto !important;
            z-index: auto !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          
          .worksheet-panel {
            background: #fff !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            /* Undo any transform/translate that hides content on mobile */
            transform: none !important;
          }
          
          .worksheet-header-area { 
            border-bottom: 2px solid #000 !important; 
            padding: 0 0 10px 0 !important;
            margin-bottom: 15px !important;
            width: 100% !important;
            display: block !important;
          }

          .doc-ti { 
            font-size: 2.2rem !important; 
            margin-bottom: 10px !important;
          }
          
          .print-info-box { 
            border: 2px solid #000 !important; 
            padding: 10px 15px !important;
            margin-bottom: 15px !important;
            width: 100% !important;
            display: block !important;
          }

          .print-prod-info {
            font-size: 1.4rem !important;
            text-decoration: underline !important;
          }
          
          .worksheet-scrollable, .table-responsive-container { 
            padding: 0 !important; 
            margin: 0 !important;
            overflow: visible !important; 
            width: 100% !important;
            display: block !important;
          }

           .print-table { 
            border-collapse: collapse !important; 
            width: 80% !important; 
            border: 2px solid #000 !important;
            table-layout: fixed !important; /* Use fixed for guaranteed sizing */
            margin: 0 !important;
          }

          /* COLUMN SIZING (PERCENTAGES TOTAL: 100% of table width) */
          .col-name { width: 40% !important; text-align: left !important; }
          .col-plan { width: 8% !important; text-align: center !important; white-space: nowrap !important; }
          .col-material { width: 18% !important; text-align: left !important; }
          .col-qty-sh { width: 11% !important; text-align: center !important; white-space: nowrap !important; }
          .col-sheets { width: 11% !important; text-align: center !important; white-space: nowrap !important; }
          .col-bz { width: 12% !important; text-align: center !important; white-space: nowrap !important; }

          .print-thr th {
             padding: 4px 3px !important;
             font-size: 0.6rem !important;
             border: 1px solid #000 !important;
             background: #eee !important;
             text-transform: uppercase !important;
          }
          .print-tr td {
             padding: 3px 4px !important;
             border: 1px solid #000 !important;
             font-size: 0.65rem !important;
             vertical-align: middle !important;
             overflow: hidden !important;
             text-overflow: ellipsis !important;
             word-break: break-all !important;
          }
          .col-name, .col-name * {
             font-size: 0.6rem !important;
             line-height: 1.1 !important;
          }
          .print-tr td * {
             font-size: 0.65rem !important;
          }
          .print-tf td {
             font-weight: bold !important;
             font-size: 0.85rem !important;
             padding: 6px 5px !important;
             border: 2px solid #000 !important;
             background: #eee !important;
          }
          
          .print-txt { font-weight: bold !important; }
          .print-subtxt { font-weight: bold !important; font-size: 0.6rem !important; }
          
          /* Summaries */
          .mat-summary-section, .consumable-summary-section { 
            border: 2px solid #000 !important; 
            margin-top: 15px !important;
            padding: 10px !important;
            width: 100% !important;
            page-break-inside: avoid !important;
          }
          .mat-card-p { 
            border-left: 5px solid #000 !important; 
            margin-bottom: 5px !important;
          }
          
          .no-print, 
          .no-print *, 
          .screen-only-table, 
          .screen-only-table *,
          .print-target .no-print, 
          .print-target .no-print *, 
          .print-target .screen-only-table, 
          .print-target .screen-only-table * {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          ::-webkit-scrollbar { display: none !important; }
        }
      `}} />
    </div>
  )
}

export default MasterModule
