import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMES } from '../../../MESContext'
import { apiService } from '../../../services/apiDispatcher'
import { supabase } from '../../../supabase'
import { MACHINE_TYPES, isShop1Task } from '../utils/masterHelpers'

export function useMasterState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    orders, tasks, nomenclatures, bomItems, inventory,
    totalProduced, totalScrapCount,
    createNaryad, issueMaterials, approveWarehouse,
    fetchModuleData,
    machines,
    machineCalls, currentUser, machineOperations, requests
  } = useMES()

  useEffect(() => { fetchModuleData('master') }, [])

  const activeCalls = useMemo(() => {
    return (machineCalls || []).filter(c =>
      c.status === 'pending' &&
      c.called_role === 'master' &&
      (!c.called_employee_id || c.called_employee_id === currentUser?.id)
    )
  }, [machineCalls, currentUser])

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
  const [useStockBZ, setUseStockBZ] = useState(true)
  const [partBZOverrides, setPartBZOverrides] = useState({})
  
  const isPartBZActive = (partNomId) => {
    if (!partNomId) return useStockBZ
    if (partBZOverrides[String(partNomId)] !== undefined) {
      return Boolean(partBZOverrides[String(partNomId)])
    }
    return Boolean(useStockBZ)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [rowMachines, setRowMachines] = useState({})
  const [rowMachinesSplits, setRowMachinesSplits] = useState({})
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState('queue')
  const [reprintTask, setReprintTask] = useState(null)
  const [selectedCutters, setSelectedCutters] = useState({})
  const [partCutterOverrides, setPartCutterOverrides] = useState({})
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [showAuxiliary, setShowAuxiliary] = useState(false)

  const [quickPlanOrder, setQuickPlanOrder] = useState(null)
  const [tempSets, setTempSets] = useState('')
  const [tempDeadline, setTempDeadline] = useState('')

  const [showPrepModal, setShowPrepModal] = useState(false)
  const [prepQuantities, setPrepQuantities] = useState({})
  const [prepDeadline, setPrepDeadline] = useState('')

  const [showCustomCardModal, setShowCustomCardModal] = useState(false)
  const [customCardNomId, setCustomCardNomId] = useState('')
  const [customCardQty, setCustomCardQty] = useState('')
  const [customCardMachine, setCustomCardMachine] = useState('')
  const [customCardDeadline, setCustomCardDeadline] = useState('')
  const [customCardSearch, setCustomCardSearch] = useState('')
  const [isSavingDraftOrder, setIsSavingDraftOrder] = useState(false)

  const [naryadQtys, setNaryadQtys] = useState({})
  const [naryadDeadline, setNaryadDeadline] = useState('')
  const [naryadParts, setNaryadParts] = useState({})
  const [partSearchQueries, setPartSearchQueries] = useState({})
  const [openDropdownRowKey, setOpenDropdownRowKey] = useState(null)
  const [materialSplits, setMaterialSplits] = useState({})
  const [stockInfoModalData, setStockInfoModalData] = useState(null)

  useEffect(() => {
    if (isSavingDraftOrder && activeNaryadOrder && !activeNaryadOrder.isVirtualDraft) {
      setIsSavingDraftOrder(false)
      handlePrint()
    }
  }, [isSavingDraftOrder, activeNaryadOrder])

  const handleCreateCustomCard = async () => {
    if (!customCardNomId) return alert('Оберіть номенклатуру!')
    const qty = parseInt(customCardQty) || 0
    if (qty <= 0) return alert('Введіть кількість більше 0!')
    if (!customCardMachine) return alert('Оберіть верстат!')

    setIsSubmitting(true)
    try {
      const { data: bzOrders, error: bzErr } = await supabase
        .from('orders')
        .select('order_num')
        .like('order_num', 'ВБ%')

      if (bzErr) throw bzErr

      let nextNum = 1
      if (bzOrders && bzOrders.length > 0) {
        const numbers = bzOrders.map(o => {
          const numPart = o.order_num.replace('ВБ', '')
          return parseInt(numPart) || 0
        })
        nextNum = Math.max(...numbers) + 1
      }
      const newOrderNum = `ВБ${String(nextNum).padStart(4, '0')}`

      const selectedNom = nomenclatures.find(n => n.id === customCardNomId)

      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([{
          order_num: newOrderNum,
          customer: 'ВЛАСНИЙ ВИПУСК (НАЧ. ЦЕХУ)',
          status: 'in-progress',
          source: 'Виробництво',
          nomenclature_id: customCardNomId,
          quantity: qty,
          deadline: customCardDeadline || null,
          accessories: selectedNom?.name || ''
        }])
        .select()

      if (orderErr) throw orderErr
      if (!newOrder || newOrder.length === 0) throw new Error('Не вдалося створити віртуальне замовлення')

      const createdOrder = newOrder[0]

      const { data: newItem, error: itemErr } = await supabase
        .from('order_items')
        .insert([{
          order_id: createdOrder.id,
          nomenclature_id: customCardNomId,
          quantity: qty
        }])
        .select()

      if (itemErr) throw itemErr
      if (!newItem || newItem.length === 0) throw new Error('Не вдалося створити елемент замовлення')

      await fetchModuleData('master')

      handleOpenNaryadModal(createdOrder, qty, customCardDeadline || null)
      setRowMachines({ [customCardNomId]: customCardMachine })

      setShowCustomCardModal(false)
      setCustomCardNomId('')
      setCustomCardQty('')
      setCustomCardMachine('')
      setCustomCardDeadline('')
      setCustomCardSearch('')
    } catch (e) {
      alert('Помилка при створенні картки: ' + e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenCustomVirtualNaryad = async () => {
    setIsReprintMode(false)
    setSelectedCutters({})
    setPartCutterOverrides({})
    setSelectedMachine(null)
    setRowMachines({})
    setRowMachinesSplits({})
    setMaterialSplits({})
    setIsDrawerOpen(false)
    setNaryadDeadline('')
    setNaryadParts({})
    setNaryadQtys({})

    let nextNum = 1
    try {
      const { data: bzOrders, error: bzErr } = await supabase
        .from('orders')
        .select('order_num')
        .like('order_num', 'ВБ%')

      if (!bzErr && bzOrders && bzOrders.length > 0) {
        const numbers = bzOrders.map(o => {
          const numPart = o.order_num.replace('ВБ', '')
          return parseInt(numPart) || 0
        })
        nextNum = Math.max(...numbers) + 1
      }
    } catch (e) {
      console.error(e)
    }
    const newOrderNum = `ВБ${String(nextNum).padStart(4, '0')}`

    const virtualOrder = {
      id: 'draft-' + Date.now(),
      order_num: newOrderNum,
      customer: 'ВЛАСНИЙ ВИПУСК (НАЧ. ЦЕХУ)',
      status: 'in-progress',
      source: 'Виробництво',
      isVirtualDraft: true,
      order_items: []
    }

    setActiveNaryadOrder(virtualOrder)
  }

  const handleSaveVirtualDraft = async () => {
    if (!activeNaryadOrder || !activeNaryadOrder.isVirtualDraft) return;
    if (!activeNaryadOrder.order_items || activeNaryadOrder.order_items.length === 0) {
      alert("Додайте принаймні одну деталь!");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([{
          order_num: activeNaryadOrder.order_num,
          customer: 'ВЛАСНИЙ ВИПУСК (НАЧ. ЦЕХУ)',
          status: 'in-progress',
          source: 'Виробництво',
          deadline: naryadDeadline || null,
          accessories: activeNaryadOrder.order_items.map(it => it.nomenclature?.name || '').join(', ')
        }])
        .select();

      if (orderErr) throw orderErr;
      const createdOrder = newOrder[0];

      const itemsToInsert = activeNaryadOrder.order_items.map(it => {
        const qty = naryadQtys[it.id] || 0;
        return {
          order_id: createdOrder.id,
          nomenclature_id: it.nomenclature_id,
          quantity: qty
        };
      });

      const { data: newItems, error: itemsErr } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select();

      if (itemsErr) throw itemsErr;

      const tempIdToRealId = {};
      activeNaryadOrder.order_items.forEach((it, idx) => {
        const realItem = newItems[idx];
        if (realItem) {
          tempIdToRealId[it.id] = realItem.id;
        }
      });

      const updatedNaryadQtys = {};
      const updatedNaryadParts = {};
      Object.entries(naryadQtys).forEach(([key, val]) => {
        const realId = tempIdToRealId[key] || key;
        updatedNaryadQtys[realId] = val;
      });

      Object.entries(naryadParts).forEach(([key, val]) => {
        const realId = tempIdToRealId[key] || key;
        updatedNaryadParts[realId] = val;
      });

      setNaryadQtys(updatedNaryadQtys);
      setNaryadParts(updatedNaryadParts);

      await fetchModuleData('master');

      const finalOrder = {
        ...createdOrder,
        order_items: newItems
      };

      setIsSavingDraftOrder(true);
      setActiveNaryadOrder(finalOrder);
    } catch (err) {
      console.error(err);
      alert("Помилка при створенні наряду: " + err.message);
      setIsSubmitting(false);
    }
  };

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

  useEffect(() => {
    if (tasks.length === 0) return;

    const neededOrderIds = [...new Set(tasks.map(t => t.order_id).filter(Boolean))];

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

  useEffect(() => {
    const taskId = searchParams.get('task')
    const orderId = searchParams.get('order')

    if (taskId) {
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (task) {
        handleReprint(task)
      } else {
        supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data) {
              handleReprint(data)
            }
          })
      }
    } else if (orderId) {
      const order = orders.find(o => String(o.id) === String(orderId)) || allOrdersMap[orderId]
      if (order) {
        handleOpenNaryadModal(order)
      } else {
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data) {
              handleOpenNaryadModal(data)
            }
          })
      }
    }
  }, [tasks, orders, allOrdersMap, searchParams])

  const getPlannedQty = (orderItemId) => {
    const allKnownOrders = [...orders, ...Object.values(allOrdersMap)]
    const item = allKnownOrders.flatMap(o => o?.order_items || []).find(it => String(it.id) === String(orderItemId))
    if (!item) return 0

    const orderTasks = tasks.filter(t => String(t.order_id) === String(item.order_id))
    if (orderTasks.length === 0) return 0
    if (orderTasks.every(t => t.status === 'completed')) return Number(item.quantity) || 0

    const cuttingTasks = orderTasks.filter(t => !t.step || t.step === 'Розкрій' || String(t.step).toLowerCase().includes('розкр'))
    const targetTasks = cuttingTasks.length > 0 ? cuttingTasks : orderTasks

    const batches = {}
    targetTasks.forEach(t => {
      const key = t.batch_index || `task_${t.id}`
      let qty = 0
      if (t.plan_snapshot) {
        const snapEntries = Object.values(t.plan_snapshot).filter(s => s && typeof s === 'object')
        const matchedSnap = snapEntries.find(s => String(s.order_item_id) === String(item.id)) ||
                            snapEntries.find(s => String(s.id) === String(item.nomenclature_id))
        if (matchedSnap) {
          qty = Number(matchedSnap.need || (matchedSnap.plan + (matchedSnap.stock || 0))) || 0
        } else {
          const snapPartNeeds = snapEntries
            .filter(s => s.need !== undefined || s.plan !== undefined)
            .map(s => Number(s.need || (s.plan + (s.stock || 0))) || 0)
          if (snapPartNeeds.length > 0) {
            qty = Math.max(...snapPartNeeds)
          }
        }
      }
      if (qty <= 0) {
        qty = Number(t.planned_sets) || 0
      }
      if (!batches[key] || qty > batches[key]) {
        batches[key] = qty
      }
    })
    return Object.values(batches).reduce((acc, q) => acc + q, 0)
  }

  const handleDeleteOrder = async (orderId, orderNum) => {
    if (!window.confirm(`Ви впевнені, що хочете видалити/закрити замовлення №${orderNum}?`)) return
    try {
      await supabase.from('material_requests').delete().eq('order_id', orderId).neq('status', 'completed')
      const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)
      if (error) throw error
      alert(`Замовлення №${orderNum} успішно закрите!`)
      if (typeof fetchModuleData === 'function') fetchModuleData('master')
    } catch (e) {
      alert('Помилка закриття замовлення: ' + e.message)
    }
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

  const pendingOrders = useMemo(() => {
    return orders.filter(o => {
      if (['completed', 'shipped', 'cancelled', 'closed'].includes(o.status)) return false
      if (!o.order_items || o.order_items.length === 0) return false

      const orderTasks = tasks.filter(t => String(t.order_id) === String(o.id))
      if (orderTasks.length > 0 && orderTasks.every(t => t.status === 'completed')) return false

      const isFullyPlanned = o.order_items.every(it => {
        const planned = getPlannedQty(it.id)
        const total = Number(it.quantity) || 0
        return planned >= total
      })

      return !isFullyPlanned
    })
  }, [orders, tasks, allOrdersMap])

  const filteredPending = useMemo(() => {
    return pendingOrders.filter(o =>
      o.order_num?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [pendingOrders, searchQuery])

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

    const initialQtys = {}
    if (sets !== undefined && sets !== '') {
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

  const currentMachine = useMemo(() => {
    if (!selectedMachine) return null
    if (selectedMachine.sheet_capacity) return selectedMachine
    return machines.find(m => m.name === selectedMachine.name) || selectedMachine
  }, [selectedMachine, machines])

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

    const taskMachineName = "Не призначено"

    setIsSubmitting(true)
    try {
      if (isReprintMode) {
        window.print()
        setReprintTask(null)
        setActiveNaryadOrder(null)
      } else {
        const createdTask = await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits, selectedCutters, naryadParts, partCutterOverrides, rowMachinesSplits, useStockBZ, partBZOverrides))
        
        if (createdTask) {
          setReprintTask(createdTask);
          if (activeNaryadOrder.order_num?.startsWith('ВБ')) {
            await supabase.from('tasks').update({
              engineer_conf: true,
              director_conf: true
            }).eq('id', createdTask.id)
          }
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
      if (task.plan_snapshot?._use_bz !== undefined) {
        setUseStockBZ(Boolean(task.plan_snapshot._use_bz))
        setPartBZOverrides(task.plan_snapshot._part_bz_overrides || {})
      } else {
        const hadStock = Object.values(task.plan_snapshot || {}).some(s => typeof s === 'object' && Number(s?.stock) > 0)
        setUseStockBZ(hadStock)
        setPartBZOverrides({})
      }
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
        const isPartActiveBZ = isPartBZActive(part.nom.id)
        const availableBZ = (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const inStock = snapshot ? (snapshot.stock || 0) : (isPartActiveBZ ? Math.min(totalNeeded, availableBZ) : 0)
        const totalToProduce = Math.max(0, totalNeeded - inStock)
        if (totalToProduce <= 0) return

        const matKeyBase = (part.nom.material_type || part.nom.name || 'Інше').trim()

        const thickMatch = matKeyBase.match(/\((\d+(?:\.\d+)?)мм\)/i) || matKeyBase.match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || matKeyBase.match(/[-_](\d+(?:\.\d+)?)$/i)
        const thicknessClean = thickMatch ? `${thickMatch[1]}мм` : matKeyBase.toLowerCase().replace(/\s+/g, '')
        const rawThickNum = thickMatch ? thickMatch[1] : null
        const prepNom = nomenclatures.find(n =>
          n.name.toLowerCase().includes('підготовлений') &&
          !n.name.toLowerCase().includes('непідготовлений') &&
          (
            n.name.toLowerCase().replace(/\s+/g, '').includes(`(${thicknessClean})`) ||
            (rawThickNum && (n.name.toLowerCase().includes(`(${rawThickNum}мм)`) || n.name.toLowerCase().includes(` ${rawThickNum}мм`) || n.name.toLowerCase().includes(`-${rawThickNum}`)))
          )
        )

        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        const sheetsNeeded = Math.ceil(totalToProduce / unitsPerSheet)
        const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'

        const isDefaultT700 = (part.nom.material_type || part.nom.name || '').toLowerCase().includes('т700') || (part.nom.material_type || part.nom.name || '').toLowerCase().includes('t700')
        const defaultT300 = isDefaultT700 ? 0 : (totalToProduce > 0 ? sheetsNeeded : 0)
        const defaultT700 = isDefaultT700 ? (totalToProduce > 0 ? sheetsNeeded : 0) : 0

        const sheets_t300 = snapshot
          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : (isDefaultT700 ? 0 : Number(snapshot.sheets || 0)))
          : (materialSplits[part.nom.id]?.t300 !== undefined ? Number(materialSplits[part.nom.id].t300) : defaultT300)
        const sheets_t700 = snapshot
          ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : (isDefaultT700 ? Number(snapshot.sheets || 0) : 0))
          : (materialSplits[part.nom.id]?.t700 !== undefined ? Number(materialSplits[part.nom.id].t700) : defaultT700)

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
    result.sort((a, b) => {
      const getThick = (name) => {
        const match = name.match(/\((\d+(?:\.\d+)?)мм\)/i)
        return match ? parseFloat(match[1]) : 999
      }
      return getThick(a.name) - getThick(b.name)
    })
    return result
  }, [activeNaryadOrder, inventory, reprintTask, nomenclatures, bomItems, naryadQtys, isReprintMode, materialSplits, useStockBZ, partBZOverrides])

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

  const isSheetDistributionComplete = useMemo(() => {
    if (!activeNaryadOrder || !activeNaryadOrder.order_items) return false
    if (isReprintMode) return true

    for (const item of activeNaryadOrder.order_items) {
      const thisNaryadQty = naryadQtys[item.id] || 0
      if (thisNaryadQty <= 0) continue

      const displayParts = getDisplayPartsForOrderItem(item)
      for (const part of displayParts) {
        if (!part.nom) continue
        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]
        const availableBZ = (() => {
          const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        const isPartActiveBZ = isPartBZActive(part.nom?.id)
        const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? (snapshot.stock || 0) : (isPartActiveBZ ? Math.min(totalNeeded, availableBZ) : 0)
        const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)

        if (totalToProduce <= 0) continue

        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
        const sheetsNeeded = Math.ceil(totalToProduce / unitsPerSheet)

        const isDefaultT700 = (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('т700') || (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('t700')
        const defaultT300 = isDefaultT700 ? 0 : (totalToProduce > 0 ? sheetsNeeded : 0)
        const defaultT700 = isDefaultT700 ? (totalToProduce > 0 ? sheetsNeeded : 0) : 0

        const splits = materialSplits[part.nom?.id] || {}
        const t300 = splits.t300 !== undefined ? Number(splits.t300) : defaultT300
        const t700 = splits.t700 !== undefined ? Number(splits.t700) : defaultT700

        if ((t300 + t700) !== sheetsNeeded) {
          return false
        }
      }
    }
    return true
  }, [activeNaryadOrder, naryadQtys, materialSplits, inventory, partBZOverrides, useStockBZ, isReprintMode, nomenclatures, bomItems, reprintTask])

  const isPrintDisabled = useMemo(() => {
    if (isSubmitting) return true
    if (!activeNaryadOrder) return true
    if (activeNaryadOrder.isVirtualDraft && (!activeNaryadOrder.order_items || activeNaryadOrder.order_items.length === 0)) return true
    if (!isReprintMode && !isSheetDistributionComplete) return true

    return false
  }, [isSubmitting, activeNaryadOrder, isReprintMode, isSheetDistributionComplete])

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

  const handleShowStockInfo = () => {
    const sheetItems = (nomenclatures || [])
      .filter(n => (n.type === 'raw' || n.name.toLowerCase().includes('лист')) && n.name.toLowerCase().includes('підготовлений'))

    const thicknessMap = {}

    sheetItems.forEach(n => {
      const match = n.name.match(/\((\d+(?:\.\d+)?)мм\)/i) || n.name.match(/(\d+(?:\.\d+)?)мм/i)
      const thickness = match ? `${match[1]}мм` : n.name
      if (!thicknessMap[thickness]) {
        thicknessMap[thickness] = { thickness, t300: 0, t700: 0 }
      }

      const invList = (inventory || []).filter(i => String(i.nomenclature_id) === String(n.id))
      const totalQty = invList.reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
      const available = Math.max(0, totalQty)

      const isT700 = n.name.toLowerCase().includes('т700') || n.name.toLowerCase().includes('t700')
      if (isT700) {
        thicknessMap[thickness].t700 += available
      } else {
        thicknessMap[thickness].t300 += available
      }
    })

    const items = Object.values(thicknessMap).sort((a, b) => {
      const getNum = str => parseFloat(str) || 0
      return getNum(a.thickness) - getNum(b.thickness)
    })

    setStockInfoModalData({
      title: 'Залишки листів на складі СО',
      items: items.length > 0 ? items : [
        { thickness: '3мм', t300: 0, t700: 0 },
        { thickness: '5мм', t300: 0, t700: 0 },
        { thickness: '10мм', t300: 0, t700: 0 }
      ]
    })
  }

  return {
    orders,
    tasks,
    nomenclatures,
    bomItems,
    inventory,
    totalProduced,
    totalScrapCount,
    createNaryad,
    issueMaterials,
    approveWarehouse,
    fetchModuleData,
    machines,
    machineCalls,
    currentUser,
    machineOperations,
    requests,
    activeCalls,
    handleResolveCall,
    activeNaryadOrder,
    setActiveNaryadOrder,
    useStockBZ,
    setUseStockBZ,
    partBZOverrides,
    setPartBZOverrides,
    isPartBZActive,
    isSubmitting,
    setIsSubmitting,
    selectedMachine,
    setSelectedMachine,
    rowMachines,
    setRowMachines,
    rowMachinesSplits,
    setRowMachinesSplits,
    isReprintMode,
    setIsReprintMode,
    searchQuery,
    setSearchQuery,
    isDrawerOpen,
    setIsDrawerOpen,
    drawerType,
    setDrawerType,
    reprintTask,
    setReprintTask,
    selectedCutters,
    setSelectedCutters,
    partCutterOverrides,
    setPartCutterOverrides,
    allOrdersMap,
    showAuxiliary,
    setShowAuxiliary,
    quickPlanOrder,
    setQuickPlanOrder,
    tempSets,
    setTempSets,
    tempDeadline,
    setTempDeadline,
    showPrepModal,
    setShowPrepModal,
    prepQuantities,
    setPrepQuantities,
    prepDeadline,
    setPrepDeadline,
    showCustomCardModal,
    setShowCustomCardModal,
    customCardNomId,
    setCustomCardNomId,
    customCardQty,
    setCustomCardQty,
    customCardMachine,
    setCustomCardMachine,
    customCardDeadline,
    setCustomCardDeadline,
    customCardSearch,
    setCustomCardSearch,
    isSavingDraftOrder,
    naryadQtys,
    setNaryadQtys,
    naryadDeadline,
    setNaryadDeadline,
    naryadParts,
    setNaryadParts,
    partSearchQueries,
    setPartSearchQueries,
    openDropdownRowKey,
    setOpenDropdownRowKey,
    materialSplits,
    setMaterialSplits,
    stockInfoModalData,
    setStockInfoModalData,
    handleShowStockInfo,
    handleCreateCustomCard,
    handleOpenCustomVirtualNaryad,
    handleSaveVirtualDraft,
    handleCreatePrepOrder,
    getPlannedQty,
    handleDeleteOrder,
    getBatchSuffix,
    pendingOrders,
    filteredPending,
    handleOpenNaryadModal,
    getBOMParts,
    getDisplayPartsForOrderItem,
    currentMachine,
    handlePrint,
    handleReprint,
    materialSummary,
    productNames,
    isSheetDistributionComplete,
    isPrintDisabled,
    handleSplitChange,
    searchParams,
    setSearchParams
  }
}
