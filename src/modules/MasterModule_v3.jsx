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
  CheckCircle2
} from 'lucide-react'
import { Link } from 'react-router-dom'
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
  const {
    orders, tasks, machines, nomenclatures, bomItems, inventory,
    totalProduced, totalScrapCount,
    createNaryad, issueMaterials, approveWarehouse,
    fetchModuleData,
    machineCalls, currentUser, supabase, machineOperations
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
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState('queue') // 'queue' | 'archive'
  const [reprintTask, setReprintTask] = useState(null)
  // Local cache of ALL orders needed for active tasks (bypasses pagination)
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [showAuxiliary, setShowAuxiliary] = useState(false)

  // Quick Plan state
  const [quickPlanOrder, setQuickPlanOrder] = useState(null)
  const [tempSets, setTempSets] = useState(0)
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

  const handleOpenNaryadModal = (order, sets, deadline) => {
    setIsReprintMode(false)
    setSelectedMachine(null)
    setRowMachines({})
    setActiveNaryadOrder(order)
    setIsDrawerOpen(false)
    setNaryadDeadline(deadline || order.deadline || '')

    // Default quantities to remaining balance or proportional to sets
    const initialQtys = {}

    if (sets !== undefined) {
      // PROPORTIONAL LOGIC
      const totalRef = Math.max(...(order.order_items?.map(it => Number(it.quantity)) || [1]))
      const isFullPackage = sets >= (totalRef - Math.max(...(order.order_items?.map(it => getPlannedQty(it.id)) || [0])))

      order.order_items?.forEach(it => {
        const planned = getPlannedQty(it.id)
        const total = Number(it.quantity)
        const remaining = Math.max(0, total - planned)

        if (isFullPackage) {
          initialQtys[it.id] = remaining
        } else {
          const ratio = sets / totalRef
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
        window.print()
        if (isReprintMode) {
          setReprintTask(null)
          setActiveNaryadOrder(null)
        } else {
          await apiService.submitCreateTask(activeNaryadOrder.id, 'PREP-TERM', (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline))
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

    // Group items by machine type
    const machineGroups = {}
    if (!isReprintMode) {
      activeNaryadOrder.order_items?.forEach(item => {
        const currentQty = naryadQtys[item.id] || 0
        if (currentQty <= 0) return

        const parts = getBOMParts(item.nomenclature_id)
        const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]

        displayParts.forEach(part => {
          if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return

          const machineType = rowMachines[part.nom.id]
          if (machineType) {
            if (!machineGroups[machineType]) {
              machineGroups[machineType] = {}
            }
            machineGroups[machineType][item.id] = currentQty
          }
        })
      })
    }

    const groupTypes = Object.keys(machineGroups)

    if (!isReprintMode && groupTypes.length === 0) {
      alert("Будь ласка, оберіть верстат для деталей.")
      return
    }

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

          // 2. Trigger print dialog
          window.print();

          // 3. Create tasks per machine group
          for (const mType of groupTypes) {
            const groupQtys = {}
            activeNaryadOrder.order_items?.forEach(item => {
              groupQtys[item.id] = machineGroups[mType][item.id] || 0
            })
            await apiService.submitCreateTask(activeNaryadOrder.id, mType, (oid, m) => createNaryad(oid, m, groupQtys, naryadDeadline));
          }
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
      // Trigger print dialog immediately
      window.print()

      if (isReprintMode) {
        setReprintTask(null)
        setActiveNaryadOrder(null)
      } else {
        // Create tasks per machine group
        for (const mType of groupTypes) {
          const groupQtys = {}
          activeNaryadOrder.order_items?.forEach(item => {
            groupQtys[item.id] = machineGroups[mType][item.id] || 0
          })
          await apiService.submitCreateTask(activeNaryadOrder.id, mType, (oid, m) => createNaryad(oid, m, groupQtys, naryadDeadline))
        }
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
        if (normName.includes('3050(16)x1600') || normName.includes('3050(16)х1600') || normName.includes('3050(16)') || normName.includes('16x16') || normName.includes('16х16')) {
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
    if (task.step !== 'Підготовка') {
      Object.keys(task.plan_snapshot || {}).forEach(partId => {
        if (!partId.startsWith('_') && partId !== 'materialSummary') {
          initialRowMachines[partId] = resolvedType || task.machine_name
        }
      })
    }
    setRowMachines(initialRowMachines)

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
      const parts = getBOMParts(item.nomenclature_id)
      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]

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
        const normKey = getCleanNormalized(matKeyBase)
        const prepNom = nomenclatures.find(n =>
          n.name.toLowerCase().includes('підготовлений') &&
          !n.name.toLowerCase().includes('непідготовлений') &&
          getCleanNormalized(n.name) === normKey
        )
        const matKey = prepNom ? prepNom.name : matKeyBase

        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        const sheets = Math.ceil(totalToProduce / unitsPerSheet)
        const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'

        if (!summary[matKey]) {
          summary[matKey] = { name: matKey, sheets: 0, unit, prepNomId: prepNom ? String(prepNom.id) : null }
        }
        summary[matKey].sheets += sheets
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
  }, [activeNaryadOrder, inventory, reprintTask, nomenclatures, bomItems, naryadQtys, isReprintMode])

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
      const parts = getBOMParts(item.nomenclature_id)
      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]

      const currentQty = isReprintMode ? Number(item.quantity) : (naryadQtys[item.id] || 0)
      if (currentQty <= 0) return

      displayParts.forEach(part => {
        if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return

        const machineName = rowMachines[part.nom.id]
        if (!machineName) return

        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
        const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? snapshot.stock : (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const totalToProduce = Math.max(0, totalNeeded - inStock)
        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        const sheets = Math.ceil(totalToProduce / unitsPerSheet)

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
              const cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
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
  }, [activeNaryadOrder, materialSummary, nomenclatures, rowMachines, machineOperations, naryadQtys, isReprintMode, reprintTask, inventory])

  const isPrintDisabled = useMemo(() => {
    if (isSubmitting) return true
    if (!activeNaryadOrder) return true
    if (activeNaryadOrder.isPrepOrder) return false

    let hasUnassigned = false
    activeNaryadOrder.order_items?.forEach(item => {
      const currentQty = isReprintMode ? Number(item.quantity) : (naryadQtys[item.id] || 0)
      if (currentQty <= 0) return

      const parts = getBOMParts(item.nomenclature_id)
      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]

      displayParts.forEach(part => {
        if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return

        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
        const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? snapshot.stock : (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const totalToProduce = Math.max(0, totalNeeded - inStock)
        if (totalToProduce > 0 && !rowMachines[part.nom.id]) {
          hasUnassigned = true
        }
      })
    })

    return hasUnassigned
  }, [activeNaryadOrder, isSubmitting, isReprintMode, naryadQtys, nomenclatures, bomItems, inventory, reprintTask, rowMachines])

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
      if (task.step?.includes('Лазерн') || task.step?.includes('Різка')) {
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
          <div className="worksheet-panel glass-panel" style={{ background: '#0a0a0a', width: '100%', maxWidth: '1000px', maxHeight: '100vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #222' }}>

            <div className="worksheet-header-area" style={{ padding: '35px 45px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h2 className="doc-ti" style={{ margin: 0, fontSize: '1.8rem', color: '#ff9000', fontWeight: 950, letterSpacing: '-0.02em' }}>
                      НАРЯД № {activeNaryadOrder.order_num}
                      {getBatchSuffix()}
                    </h2>
                  </div>
                  <button onClick={() => setActiveNaryadOrder(null)} className="no-print" style={{ background: '#111', border: '1px solid #222', color: '#555', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
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
                      <th style={{ padding: '12px 15px', width: '22%', borderBottom: '1.5px solid #222' }} className="col-name">ДЕТАЛЬ В РОЗКРІЙ</th>
                      <th style={{ padding: '12px 15px', width: '18%', textAlign: 'center', borderBottom: '1.5px solid #222' }} className="no-print">ВЕРСТАТ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }} className="no-print">ПОТРЕБА</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }} className="no-print">СКЛАД БЗ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', color: '#ff9000' }} className="col-plan">ПЛАН</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '15%' }} className="col-material">МАТЕРІАЛ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%' }} className="col-qty-sh">ШТ/Л</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%', color: '#22c55e' }} className="col-sheets">ЛИСТІВ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%', color: '#ff9000' }} className="col-bz">БЗ</th>
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

                      const parts = getBOMParts(it.nomenclature_id)
                      const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                      const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type)

                      return displayParts.map((part, pIdx) => {
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

                        return (
                          <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                            <td style={{ padding: '18px 15px' }} className="col-name">
                              <div style={{ fontWeight: 1000, color: '#fff', fontSize: '1rem', letterSpacing: '-0.01em' }} className="print-txt">{part.nom?.name || '—'}</div>
                              {part.nom?.nomenclature_code && (
                                <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{part.nom.nomenclature_code}</div>
                              )}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center' }} className="no-print">
                              {totalToProduce > 0 ? (
                                <>
                                  <div className="no-print">
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
                                        background: '#111',
                                        border: '1px solid #333',
                                        color: '#fff',
                                        padding: '5px 8px',
                                        borderRadius: '10px',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        outline: 'none',
                                        cursor: 'pointer',
                                        width: '100%',
                                        maxWidth: '180px'
                                      }}
                                    >
                                      <option value="">-- Оберіть верстат --</option>
                                      {MACHINE_TYPES.map(type => (
                                        <option key={type} value={type}>{type.split(' - ')[0]}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <span className="print-only" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#eee' }}>
                                    {rowMachines[part.nom?.id] ? rowMachines[part.nom?.id].split(' - ')[0] : '—'}
                                  </span>
                                </>
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
                              <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">{part.nom?.material_type || '—'}</div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }} className="col-qty-sh">
                              {unitsPerSheet.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.4rem' }} className="col-sheets print-accent-g">
                              {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1rem', color: '#ff9000', fontWeight: 900 }} className="col-bz">
                              {totalToProduce > 0 ? `+${(sheets * unitsPerSheet) - totalToProduce}` : '0'}
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
                      let totalSheets = 0;

                      if (activeNaryadOrder.isPrepOrder) {
                        activeNaryadOrder.order_items?.forEach(it => {
                          totalNeed += Number(it.quantity);
                          totalPlan += Number(it.quantity);
                          totalSheets += Number(it.quantity);
                        });
                      } else {
                        activeNaryadOrder.order_items?.forEach(it => {
                          const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                          const parts = getBOMParts(it.nomenclature_id);
                          const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }];
                          const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type);

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

                            totalNeed += need;
                            totalPlan += plan;
                            if (plan > 0) totalSheets += sheets;
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
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="col-sheets print-accent-g">
                            {totalSheets.toString()}
                          </td>
                          <td className="col-bz" style={{ border: '1px solid #000' }}></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>

                {/* PRINT ONLY TABLE (EXACTLY 6 COLUMNS) */}
                <table className="print-table print-only-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#111', textAlign: 'left', color: '#555' }} className="print-thr">
                      <th style={{ padding: '12px 15px', width: '40%' }} className="col-name">ДЕТАЛЬ В РОЗКРІЙ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }} className="col-plan">ПЛАН</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '18%' }} className="col-material">МАТЕРІАЛ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '11%' }} className="col-qty-sh">ШТ/Л</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '11%' }} className="col-sheets">ЛИСТІВ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '12%' }} className="col-bz">БЗ</th>
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
                              <div style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }} className="print-subtxt">{nom?.name || '—'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem' }} className="col-qty-sh">
                              1
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets print-accent-g">
                              {thisNaryadQty.toString()}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900 }} className="col-bz">
                              0
                            </td>
                          </tr>
                        )
                      }

                      const planned = getPlannedQty(it.id)
                      const remainingBalance = Math.max(0, Number(it.quantity) - planned)

                      const parts = getBOMParts(it.nomenclature_id)
                      const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                      const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type)

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
                              <div style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }} className="print-subtxt">{part.nom?.material_type || '—'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem' }} className="col-qty-sh">
                              {unitsPerSheet.toString()}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets print-accent-g">
                              {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900 }} className="col-bz">
                              {totalToProduce > 0 ? `+${(sheets * unitsPerSheet) - totalToProduce}` : '0'}
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
                      let totalSheets = 0;

                      if (activeNaryadOrder.isPrepOrder) {
                        activeNaryadOrder.order_items?.forEach(it => {
                          totalNeed += Number(it.quantity);
                          totalPlan += Number(it.quantity);
                          totalSheets += Number(it.quantity);
                        });
                      } else {
                        activeNaryadOrder.order_items?.forEach(it => {
                          const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                          const parts = getBOMParts(it.nomenclature_id);
                          const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }];
                          const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type);

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

                            totalNeed += need;
                            totalPlan += plan;
                            if (plan > 0) totalSheets += sheets;
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
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="col-sheets print-accent-g">
                            {totalSheets.toString()}
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

              {!activeNaryadOrder.isPrepOrder && isPrintDisabled ? (
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
                      {consumableSummary.map((c, idx) => (
                        <div key={idx} className="mat-card-p" style={{ padding: '0 0 5px 15px', borderLeft: '4px solid #3b82f6', minWidth: '150px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, marginBottom: '3px' }} className="print-subtxt">{c.name}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff' }} className="print-txt">{(Number(c.total) || 0).toString()} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: '#444' }} className="print-subtxt">ОД.</small></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="no-print" style={{ padding: '30px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button onClick={() => { setActiveNaryadOrder(null); setReprintTask(null); }} style={{ background: '#222', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
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
                onChange={e => setTempSets(Number(e.target.value))}
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

      {showPrepModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '24px', border: '1px solid #222', width: '95%', maxWidth: '500px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.4rem', color: '#10b981', fontWeight: 900 }}>НАРЯД НА ПІДГОТОВКУ</h3>

            <div style={{ marginBottom: '20px', paddingRight: '5px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px' }}>СИРОВИНА (НЕПІДГОТОВЛЕНА)</label>
              {nomenclatures
                .filter(n => n.name.toLowerCase().includes('непідготовлений'))
                .sort((a, b) => {
                  const matchA = a.name.match(/\((\d+(?:\.\d+)?)\s*мм\)/i);
                  const matchB = b.name.match(/\((\d+(?:\.\d+)?)\s*мм\)/i);
                  const thickA = matchA ? parseFloat(matchA[1]) : 0;
                  const thickB = matchB ? parseFloat(matchB[1]) : 0;
                  return thickA - thickB;
                })
                .map(n => {
                  const qty = prepQuantities[n.id] || '';
                  return (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '15px' }}>
                      <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 800 }}>{n.name}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={qty}
                        onChange={e => {
                          const val = e.target.value;
                          setPrepQuantities(prev => ({
                            ...prev,
                            [n.id]: val === '' ? '' : Math.max(0, parseInt(val) || 0)
                          }));
                        }}
                        style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '8px 12px', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 900, textAlign: 'center', width: '80px' }}
                      />
                    </div>
                  );
                })}
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
      )}

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
          .print-target { 
            position: relative !important; 
            width: 100% !important;
            max-width: 100% !important;
            background: #fff !important; 
            display: block !important;
            padding: 10mm 15mm !important; /* Extremely safe 15mm side margins inside the container */
            margin: 0 auto !important;
            z-index: 99999 !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          
          .worksheet-panel {
            background: #fff !important;
            width: 100% !important;
            max-width: 100% !important; /* Scale content to fit screen/paper */
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important; /* Disable flex layout in print */
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
