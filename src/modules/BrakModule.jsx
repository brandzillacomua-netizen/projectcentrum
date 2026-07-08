import React, { useState, useEffect } from 'react'
import { ArrowLeft, AlertTriangle, CheckCircle2, Package, Layers, ChevronRight, Info, Camera, X, Scan } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { useScrapReasons } from '../hooks/useScrapReasons'

export default function BrakModule() {
  const { inventory, nomenclatures, fetchData, currentUser, disposeScrapItem, createReworkNaryad, productionStages, workCards, orders, machineCalls, machines, supabase, workCardHistory } = useMES()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [distribution, setDistribution] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [reasonAllocations, setReasonAllocations] = useState([{ reason: '', qty: 0 }])
  const [viewingCategory, setViewingCategory] = useState(null)
  const { rows: scrapReasonRows, names: scrapReasons, reload: reloadScrapReasons } = useScrapReasons({ includeInactive: true })
  const [newScrapReason, setNewScrapReason] = useState('')
  const [showReasonCatalog, setShowReasonCatalog] = useState(false)
  const [editingScrapReasonId, setEditingScrapReasonId] = useState(null)
  const [editingScrapReasonName, setEditingScrapReasonName] = useState('')

  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scannedCard, setScannedCard] = useState(null)
  const [qcInspector, setQcInspector] = useState('')
  const [qcScrapCount, setQcScrapCount] = useState(0)
  const [qcReason, setQcReason] = useState('Биття цанги')
  const [qcCustomReason, setQcCustomReason] = useState('')

  const handleAddScrapReason = async () => {
    const name = newScrapReason.trim()
    if (!name) return
    const maxSort = scrapReasonRows
      .filter(row => row.name !== 'Інше (коментар)')
      .reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0)
    const { error } = await supabase.from('scrap_reasons').insert({ name, sort_order: maxSort + 10 })
    if (error) return alert('Не вдалося додати причину: ' + error.message)
    setNewScrapReason('')
    await reloadScrapReasons()
  }

  const handleToggleScrapReason = async row => {
    const { error } = await supabase.from('scrap_reasons')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) return alert('Не вдалося змінити причину: ' + error.message)
    await reloadScrapReasons()
  }

  const handleUpdateScrapReason = async row => {
    const name = editingScrapReasonName.trim()
    if (!name) return
    const { error } = await supabase.from('scrap_reasons')
      .update({ name, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) return alert('Не вдалося перейменувати причину: ' + error.message)
    setEditingScrapReasonId(null)
    setEditingScrapReasonName('')
    await reloadScrapReasons()
  }

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    (c.called_role === 'quality' || c.called_role === 'qc') && 
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Фахівець ВКЯ'
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

  // Обробка сканера QR
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("qc-reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        try {
          let cardIdStr = decodedText
          try {
            const qrData = JSON.parse(decodedText)
            if (qrData.id) cardIdStr = qrData.id
          } catch (e) { }

          await stopAndClose()
          const foundCard = (workCards || []).find(c => String(c.id).trim() === String(cardIdStr).trim() || String(c.id).endsWith(String(cardIdStr).trim()))
          if (!foundCard) {
            setScanError(`Картку №${cardIdStr} не знайдено в базі.`)
          } else {
            setScannedCard(foundCard)
            setQcScrapCount(0)
            setScanError(null)
          }
        } catch (e) {
          setScanError("Невірний формат QR або помилка зчитування.")
        }
      }).catch(err => { setScanError("Помилка камери: " + err); setIsScanning(false) })
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {})
      }
    }
  }, [isScanning, workCards])

  // Уніфікована функція запису в інвентар
  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)
        .eq('type', type)
        .limit(1).maybeSingle()

      if (existing) {
        await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
      } else {
        const nom = (nomenclatures || []).find(n => n.id === nomId)
        await supabase.from('inventory').insert([{
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: Number(qty),
          type: type,
          nomenclature_id: nomId
        }])
      }
    } catch (e) { console.warn(`Stock update failed for type ${type}:`, e) }
  }

  // Обробник списання додаткового браку ВКЯ
  const handleQCScrapOverride = async () => {
    if (!scannedCard || qcScrapCount <= 0) return
    if (qcScrapCount > scannedCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!')
      return
    }
    setIsProcessing(true)
    try {
      const reasonText = qcReason === 'Інше (коментар)'
        ? `Інше (${qcCustomReason || 'без коментаря'})`
        : qcReason
      const op = `ВКЯ (${qcInspector || 'відповідальний'}) — Причина: ${reasonText}`
      const newQty = Math.max(0, scannedCard.quantity - qcScrapCount)

      // 1. Запис у work_card_history
      await supabase.from('work_card_history').insert([{
        card_id: scannedCard.id,
        nomenclature_id: scannedCard.nomenclature_id,
        stage_name: 'Контроль ВКЯ',
        operator_name: op,
        qty_at_start: scannedCard.quantity,
        qty_completed: newQty,
        scrap_qty: qcScrapCount,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        is_archived_scrap: true,
        shift_name: scannedCard.shift_name,
        manager_name: scannedCard.manager_name,
        machine_name: scannedCard.machine,
        qc_scrap_reason: qcReason,
        qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null
      }])

      // 2. Оновлюємо кількість картки
      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }
      await supabase.from('work_cards').update(updatePayload).eq('id', scannedCard.id)

      // 3. Записуємо виявлений брак на склад
      await updateInventoryStock(scannedCard.nomenclature_id, qcScrapCount, 'scrap_ready')

      const recordedScrap = qcScrapCount
      setScannedCard(null)
      setQcScrapCount(0)
      setQcInspector('')
      setQcReason('Биття цанги')
      setQcCustomReason('')
      await fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks'])
      alert(`✅ Успішно списано ${recordedScrap} шт у брак за рішенням відділу ВКЯ!`)
    } catch (e) {
      console.error('QC error:', e)
      alert('Помилка фіксації браку ВКЯ: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  const [localScrapHistory, setLocalScrapHistory] = useState([])
  const [scrapSourceMeta, setScrapSourceMeta] = useState({ cards: {}, tasks: {}, orders: {}, sequences: {} })

  const loadScrapHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('work_card_history')
        .select('*')
        .eq('is_archived_scrap', true)
        .gt('scrap_qty', 0)
        .order('created_at', { ascending: false })
      if (!error && data) {
        // Load exact source records for the queue. This must not depend on the
        // globally cached "latest N" cards/orders, otherwise old scrap loses
        // its work-order and card numbers.
        const cardIds = [...new Set(data.map(row => row.card_id).filter(Boolean))]
        const { data: sourceCardsData } = cardIds.length
          ? await supabase.from('work_cards').select('id,task_id,order_id,created_at').in('id', cardIds)
          : { data: [] }
        const sourceCards = sourceCardsData || []
        const taskIds = [...new Set(sourceCards.map(card => card.task_id).filter(Boolean))]
        const { data: sourceTasksData } = taskIds.length
          ? await supabase.from('tasks').select('id,order_id,batch_index,step,plan_snapshot').in('id', taskIds)
          : { data: [] }
        const sourceTasks = sourceTasksData || []
        const orderIds = [...new Set([
          ...sourceCards.map(card => card.order_id),
          ...sourceTasks.map(task => task.order_id)
        ].filter(Boolean))]
        const { data: sourceOrdersData } = orderIds.length
          ? await supabase.from('orders').select('id,order_num').in('id', orderIds)
          : { data: [] }
        const sourceOrders = sourceOrdersData || []

        // A card's human number is its 1-based position inside the task,
        // ordered exactly as cards were created. Load every card in those
        // tasks page-by-page so numbering also works beyond 1000 records.
        const taskCards = []
        if (taskIds.length) {
          const pageSize = 1000
          for (let from = 0; ; from += pageSize) {
            const { data: page, error: pageError } = await supabase.from('work_cards')
              .select('id,task_id,created_at').in('task_id', taskIds)
              .order('created_at', { ascending: true }).order('id', { ascending: true })
              .range(from, from + pageSize - 1)
            if (pageError || !page?.length) break
            taskCards.push(...page)
            if (page.length < pageSize) break
          }
        }
        const cardsByTask = taskCards.reduce((result, card) => {
          const key = String(card.task_id)
          if (!result[key]) result[key] = []
          result[key].push(card)
          return result
        }, {})
        const sequences = {}
        Object.values(cardsByTask).forEach(cards => {
          cards.forEach((card, index) => { sequences[String(card.id)] = index + 1 })
        })

        setScrapSourceMeta({
          cards: Object.fromEntries(sourceCards.map(card => [String(card.id), card])),
          tasks: Object.fromEntries(sourceTasks.map(task => [String(task.id), task])),
          orders: Object.fromEntries(sourceOrders.map(order => [String(order.id), order])),
          sequences
        })
        setLocalScrapHistory(data)
      }
    } catch (e) {
      console.error('Failed to fetch local scrap history:', e)
    }
  }

  useEffect(() => {
    loadScrapHistory()
  }, [workCardHistory])

  // Reset distribution when selected item changes
  useEffect(() => {
    setDistribution({ 1: 0, 2: 0, 3: 0, 4: 0 })
    setReasonAllocations([{ reason: '', qty: 0 }])
  }, [selectedItem])

  const totalDistributed = Object.values(distribution).reduce((a, b) => a + b, 0)
  const totalReasonAllocated = reasonAllocations.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
  const hasMissingScrapReason = reasonAllocations.some(item => Number(item.qty) > 0 && !item.reason?.trim())
  const isReasonDistributionValid = totalDistributed > 0
    && totalReasonAllocated === totalDistributed
    && !hasMissingScrapReason
  const remainingInBatch = selectedItem ? Number(selectedItem.total_qty) - totalDistributed : 0
  const activeScrapReasons = scrapReasons.filter(reason => scrapReasonRows.find(row => row.name === reason)?.is_active !== false)

  const updateCategoryQty = (category, requestedQty) => {
    const otherQty = Object.entries(distribution)
      .filter(([key]) => String(key) !== String(category))
      .reduce((sum, [, qty]) => sum + (Number(qty) || 0), 0)
    const maxQty = Math.max(0, Number(selectedItem?.total_qty || 0) - otherQty)
    setDistribution(previous => ({
      ...previous,
      [category]: Math.min(maxQty, Math.max(0, Number(requestedQty) || 0))
    }))
  }

  const updateReasonQty = (index, requestedQty) => {
    setReasonAllocations(items => {
      const otherQty = items.reduce((sum, item, itemIndex) => itemIndex === index ? sum : sum + (Number(item.qty) || 0), 0)
      const maxQty = Math.max(0, totalDistributed - otherQty)
      return items.map((item, itemIndex) => itemIndex === index
        ? { ...item, qty: Math.min(maxQty, Math.max(0, Number(requestedQty) || 0)) }
        : item)
    })
  }

  useEffect(() => {
    setReasonAllocations(items => {
      let available = totalDistributed
      let changed = false
      const clamped = items.map(item => {
        const qty = Math.min(Math.max(0, Number(item.qty) || 0), available)
        available -= qty
        if (qty !== Number(item.qty || 0)) changed = true
        return changed ? { ...item, qty } : item
      })
      return changed ? clamped : items
    })
  }, [totalDistributed])

  // Filter for items ready for classification from work_card_history
  const readyItems = (localScrapHistory || [])
    .filter(h => h.is_archived_scrap && Number(h.scrap_qty) > 0)
    .map(h => {
      let sum = 0;
      if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
        try {
          const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
          if (match) {
            const cats = JSON.parse(match[1]);
            sum = Object.values(cats).reduce((a, b) => a + Number(b), 0);
          }
        } catch(e) {}
      }
      const remaining = Math.max(0, Number(h.scrap_qty) - sum);
      if (remaining <= 0) return null;
      
      const nom = nomenclatures?.find(n => n.id === h.nomenclature_id);
      const sourceCard = scrapSourceMeta.cards[String(h.card_id)]
        || workCards?.find(card => String(card.id) === String(h.card_id))
      const sourceTask = sourceCard?.task_id
        ? scrapSourceMeta.tasks[String(sourceCard.task_id)]
        : null
      const sourceOrderId = sourceTask?.order_id || sourceCard?.order_id
      const sourceOrder = sourceOrderId
        ? scrapSourceMeta.orders[String(sourceOrderId)] || orders?.find(order => String(order.id) === String(sourceOrderId))
        : null
      const taskNumber = sourceTask?.step === 'Підготовка' && sourceTask?.plan_snapshot?._prep_num
        ? sourceTask.plan_snapshot._prep_num
        : sourceOrder?.order_num
          ? `${sourceOrder.order_num}${sourceTask?.batch_index ? `/${sourceTask.batch_index}` : ''}`
          : sourceTask?.plan_snapshot?._prep_num || '—'
      return {
        id: h.id, // we use history id as item id
        is_history_row: true,
        history_row: h,
        nomenclature_id: h.nomenclature_id,
        name: nom?.name || 'Деталь',
        unit: nom?.unit || 'шт',
        total_qty: remaining, // Show remaining as total_qty for UI compatibility
        operator: h.operator_name,
        stage: h.stage_name,
        updated_at: h.created_at,
        card_number: h.card_id ? String(h.card_id).slice(-8).toUpperCase() : '—',
        card_sequence: h.card_id ? scrapSourceMeta.sequences[String(h.card_id)] || null : null,
        card_id: h.card_id,
        naryad_number: taskNumber
      };
    })
    .filter(Boolean);

  // Stats for categorized scrap
  const categorizedStats = {
    cat1: (inventory || []).filter(i => i.type === 'scrap_cat_1').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    cat2: (inventory || []).filter(i => i.type === 'scrap_cat_2').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    cat3: (inventory || []).filter(i => i.type === 'scrap_cat_3').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    cat4: (inventory || []).filter(i => i.type === 'scrap_cat_4').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    restoration: (inventory || []).filter(i => i.type === 'scrap_restoration').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
  }

  const itemsInCat = viewingCategory 
    ? (viewingCategory === 'restoration'
        ? (inventory || []).filter(i => i.type === 'scrap_restoration' && (Number(i.total_qty) > 0))
        : (inventory || []).filter(i => i.type === `scrap_cat_${viewingCategory}` && (Number(i.total_qty) > 0)))
    : []

  const handleBulkClassify = async () => {
    if (!selectedItem || totalDistributed <= 0) return
    if (totalDistributed > Number(selectedItem.total_qty)) {
      alert('Розподілено більше ніж є в наявності!')
      return
    }
    if (!isReasonDistributionValid) {
      alert('Розподіліть за причинами рівно ту саму кількість, що й за категоріями.')
      return
    }

    setIsProcessing(true)
    try {
      const categoriesToProcess = Object.entries(distribution).filter(([_, qty]) => Number(qty) > 0)
      
      for (const [cat, qty] of categoriesToProcess) {
        const type = `scrap_cat_${cat}`
        const numQty = Number(qty)
        
        const { data: existing } = await supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', selectedItem.nomenclature_id)
          .eq('type', type)
          .limit(1).maybeSingle()
          
        if (existing) {
          await supabase.from('inventory').update({
            total_qty: (Number(existing.total_qty) || 0) + numQty,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
        } else {
          await supabase.from('inventory').insert([{
            nomenclature_id: selectedItem.nomenclature_id,
            name: selectedItem.name,
            unit: selectedItem.unit || 'шт',
            total_qty: numQty,
            type: type,
            updated_at: new Date().toISOString()
          }])
        }
      }
      
      const absoluteRemaining = Number(selectedItem.total_qty) - totalDistributed
      
      // We need to update the work_card_history with the new JSON distribution
      if (selectedItem.is_history_row) {
        const row = selectedItem.history_row;
        let existingCats = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, restoration: 0 };
        if (row.qc_scrap_comment && row.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = row.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
            if (match) existingCats = JSON.parse(match[1]);
          } catch(e) {}
        }
        
        const newCats = { ...existingCats };
        for (const [cat, qty] of categoriesToProcess) {
           const key = cat === 'restoration' ? 'restoration' : `cat${cat}`;
           newCats[key] = (newCats[key] || 0) + Number(qty);
        }
        
        const jsonStr = `[SCRAP_CAT:${JSON.stringify(newCats)}]`;
        let existingReasons = {};
        if (row.qc_scrap_comment?.includes('SCRAP_REASONS:')) {
          try {
            const reasonMatch = row.qc_scrap_comment.match(/\[SCRAP_REASONS:([^\]]+)\]/);
            if (reasonMatch) existingReasons = JSON.parse(reasonMatch[1]);
          } catch (e) { console.warn('Invalid scrap reason allocation:', e) }
        }
        const newReasons = { ...existingReasons };
        reasonAllocations.forEach(allocation => {
          if (!allocation.reason || Number(allocation.qty) <= 0) return;
          newReasons[allocation.reason] = (Number(newReasons[allocation.reason]) || 0) + Number(allocation.qty);
        });
        const reasonsJson = `[SCRAP_REASONS:${JSON.stringify(newReasons)}]`;
        const baseComment = row.qc_scrap_comment
          ? row.qc_scrap_comment.replace(/\[SCRAP_CAT:[^\]]+\]/g, '').replace(/\[SCRAP_REASONS:[^\]]+\]/g, '').trim()
          : '';
        const newComment = [baseComment, jsonStr, reasonsJson].filter(Boolean).join(' ');
        
        await supabase.from('work_card_history').update({ qc_scrap_comment: newComment }).eq('id', selectedItem.id);
      }
      
      if (absoluteRemaining > 0) {
        setSelectedItem({ ...selectedItem, total_qty: absoluteRemaining })
      } else {
        setSelectedItem(null)
      }
      
      await fetchData(['inventory', 'work_card_history'])
    } catch (e) {
      alert('Помилка при класифікації: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispose = async (item) => {
    if (!window.confirm(`Ви дійсно хочете списати ${item.total_qty} шт ${item.name}?`)) return
    setIsProcessing(true)
    await disposeScrapItem(item.id, item.total_qty)
    setIsProcessing(false)
  }

  const handleRework = async (item, stage) => {
    setIsProcessing(true)
    await createReworkNaryad(item.id, item.total_qty, stage)
    setIsProcessing(false)
    alert(`Створено незалежний наряд на ${stage} для ${item.total_qty} шт.`)
  }

  const handleSendToRestoration = async (item) => {
    setIsProcessing(true)
    try {
      // Переносимо зі scrap_cat_X у scrap_restoration
      const { data: existing } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', item.nomenclature_id)
        .eq('type', 'scrap_restoration')
        .limit(1).maybeSingle()

      if (existing) {
        await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(item.total_qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
      } else {
        const nom = (nomenclatures || []).find(n => n.id === item.nomenclature_id)
        await supabase.from('inventory').insert([{
          nomenclature_id: item.nomenclature_id,
          name: nom?.name || item.name,
          unit: item.unit || 'шт',
          total_qty: Number(item.total_qty),
          type: 'scrap_restoration',
          updated_at: new Date().toISOString()
        }])
      }

      await supabase.from('inventory').delete().eq('id', item.id)
      await fetchData('inventory')
      alert(`Деталі (${item.total_qty} шт.) перенесено до внутрішнього відділу відновлення ВКЯ!`)
    } catch (e) {
      alert('Помилка відправки на відновлення: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <nav style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '0 25px', height: '75px', background: '#000', borderBottom: '1px solid #1a1a1a', flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span>Назад</span>
          </Link>
          <div style={{ width: '2px', height: '24px', background: '#1a1a1a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle color="#ef4444" size={22} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>ВКЯ · Управління Якістю</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', fontWeight: 900 }}>Інспектор ВКЯ</div>
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, padding: '30px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Active Machine Calls Widget */}
        {!showReasonCatalog && activeCalls.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '25px' }}>
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

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          {!showReasonCatalog && <button
            onClick={() => setIsScanning(true)}
            style={{
              background: '#ef444420', border: '1px solid #ef444455', color: '#ef4444',
              padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef444430';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ef444420';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Camera size={18} /> СКАНУВАТИ КАРТКУ
          </button>}
          <button
            onClick={() => setShowReasonCatalog(value => !value)}
            style={{ background: '#f59e0b20', border: '1px solid #f59e0b55', color: '#f59e0b', padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer' }}
          >
            {showReasonCatalog ? '← ЧЕРГА КЛАСИФІКАЦІЇ' : `ДОВІДНИК ПРИЧИН БРАКУ (${scrapReasonRows.filter(row => row.is_active).length})`}
          </button>
        </div>

        {showReasonCatalog && (
          <div style={{ background: '#0d0d0d', border: '1px solid #f59e0b33', borderRadius: '24px', padding: '26px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', marginBottom: '25px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.45rem', fontWeight: 1000, color: '#fff' }}>Довідник причин браку</div>
                <div style={{ color: '#666', fontSize: '0.78rem', marginTop: '6px' }}>Ці значення використовуються у випадаючих списках ВКЯ та виробничих терміналів.</div>
              </div>
              <div style={{ background: '#f59e0b18', color: '#f59e0b', borderRadius: '12px', padding: '9px 14px', fontSize: '0.75rem', fontWeight: 950 }}>
                {scrapReasonRows.filter(row => row.is_active).length} АКТИВНИХ
              </div>
            </div>

            <div style={{ background: '#080808', border: '1px solid #222', borderRadius: '16px', padding: '16px', marginBottom: '22px' }}>
              <div style={{ color: '#888', fontSize: '0.68rem', fontWeight: 950, marginBottom: '10px' }}>ДОДАТИ НОВУ ПРИЧИНУ</div>
              <div style={{ display: 'flex', gap: '10px' }}>
              <input value={newScrapReason} onChange={event => setNewScrapReason(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') handleAddScrapReason() }}
                placeholder="Наприклад: Невірний розмір деталі"
                style={{ flex: 1, minWidth: 0, background: '#000', border: '1px solid #333', borderRadius: '11px', color: '#fff', padding: '13px 15px', fontWeight: 700 }} />
              <button onClick={handleAddScrapReason} disabled={!newScrapReason.trim()}
                style={{ background: '#f59e0b', color: '#000', border: 0, borderRadius: '11px', padding: '0 22px', fontWeight: 950, cursor: 'pointer', opacity: newScrapReason.trim() ? 1 : 0.45 }}>
                ДОДАТИ
              </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {scrapReasonRows.map(row => (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#111', border: '1px solid #202020', borderRadius: '14px', padding: '13px 15px' }}>
                  <div style={{ width: '10px', height: '10px', flexShrink: 0, borderRadius: '50%', background: row.is_active ? '#10b981' : '#444', boxShadow: row.is_active ? '0 0 10px #10b98166' : 'none' }} />
                  {editingScrapReasonId === row.id ? (
                    <input autoFocus value={editingScrapReasonName} onChange={event => setEditingScrapReasonName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') handleUpdateScrapReason(row)
                        if (event.key === 'Escape') setEditingScrapReasonId(null)
                      }}
                      style={{ flex: 1, background: '#050505', border: '1px solid #f59e0b66', borderRadius: '9px', color: '#fff', padding: '9px 11px', fontWeight: 800 }} />
                  ) : (
                    <div style={{ flex: 1, color: row.is_active ? '#fff' : '#666', fontWeight: 850 }}>{row.name}</div>
                  )}
                  {editingScrapReasonId === row.id ? <>
                    <button onClick={() => handleUpdateScrapReason(row)} style={{ background: '#10b981', color: '#000', border: 0, borderRadius: '9px', padding: '9px 13px', fontWeight: 950, cursor: 'pointer' }}>ЗБЕРЕГТИ</button>
                    <button onClick={() => setEditingScrapReasonId(null)} style={{ background: '#222', color: '#888', border: '1px solid #333', borderRadius: '9px', padding: '9px 13px', fontWeight: 850, cursor: 'pointer' }}>СКАСУВАТИ</button>
                  </> : <>
                    <button onClick={() => { setEditingScrapReasonId(row.id); setEditingScrapReasonName(row.name) }} style={{ background: '#1d1d1d', color: '#f59e0b', border: '1px solid #333', borderRadius: '9px', padding: '9px 13px', fontWeight: 900, cursor: 'pointer' }}>РЕДАГУВАТИ</button>
                    <button onClick={() => handleToggleScrapReason(row)} style={{ minWidth: '105px', background: row.is_active ? '#10b98118' : '#222', color: row.is_active ? '#10b981' : '#888', border: `1px solid ${row.is_active ? '#10b98155' : '#333'}`, borderRadius: '9px', padding: '9px 13px', fontWeight: 900, cursor: 'pointer' }}>{row.is_active ? 'АКТИВНА' : 'ВИМКНЕНА'}</button>
                  </>}
                </div>
              ))}
            </div>
          </div>
        )}

        {!showReasonCatalog && <>
        {/* Stats Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {[
            { cat: 1, label: 'Категорія 1', val: categorizedStats.cat1, color: '#10b981', desc: 'Мінімальний брак' },
            { cat: 2, label: 'Категорія 2', val: categorizedStats.cat2, color: '#eab308', desc: 'Середній брак' },
            { cat: 3, label: 'Категорія 3', val: categorizedStats.cat3, color: '#f97316', desc: 'Серйозний брак' },
            { cat: 4, label: 'Категорія 4', val: categorizedStats.cat4, color: '#ef4444', desc: 'Критичний брак' },
            { cat: 'restoration', label: 'Відновлення', val: categorizedStats.restoration, color: '#06b6d4', desc: 'Внутрішнє відновлення' },
          ].map(s => (
            <div key={s.label} 
              onClick={() => {
                setViewingCategory(s.cat === viewingCategory ? null : s.cat)
                setSelectedItem(null)
              }}
              className="glass-panel" 
              style={{ 
                background: viewingCategory === s.cat ? `${s.color}10` : 'rgba(20,20,20,0.6)', 
                borderRadius: '24px', padding: '24px', cursor: 'pointer',
                borderLeft: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderRight: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderBottom: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderTop: `4px solid ${s.color}`,
                transition: 'all 0.3s ease'
              }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{s.label}</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{s.val} <small style={{ fontSize: '0.9rem', opacity: 0.3 }}>шт</small></div>
              <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '10px', fontWeight: 600 }}>{s.desc}</div>
              {viewingCategory === s.cat && <div style={{ marginTop: '15px', fontSize: '0.6rem', color: s.color, fontWeight: 900 }}>ВІДКРИТО ДЕТАЛЬНИЙ ПЕРЕГЛЯД ↓</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
          
          {/* List of Pending Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950 }}>
                {viewingCategory ? `Деталі Категорії ${viewingCategory}` : 'Черга на класифікацію'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ background: viewingCategory ? '#444' : '#ef444415', padding: '8px 14px', borderRadius: '10px', color: viewingCategory ? '#fff' : '#ef4444', fontSize: '0.75rem', fontWeight: 1000 }}>
                  {viewingCategory ? `${itemsInCat.length} ПОЗИЦІЙ` : `${readyItems.length} ПОЗИЦІЙ`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!viewingCategory && readyItems.length === 0) && (
                <div style={{ 
                  background: '#0a0a0a', border: '2px dashed #1a1a1a', borderRadius: '24px', 
                  padding: '60px 40px', textAlign: 'center', color: '#444' 
                }}>
                  <CheckCircle2 size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Поки що браку немає</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>Як тільки Майстер перенесе брак з прийомки, він з'явиться тут</div>
                </div>
              )}

              {viewingCategory && itemsInCat.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#444', background: '#0a0a0a', borderRadius: '20px' }}>
                  Ця категорія порожня
                </div>
              )}

              {/* RENDER LIST: Either classifications OR category details */}
              {viewingCategory ? (
                itemsInCat.map(item => (
                  <div key={item.id} style={{ 
                    background: '#111', borderRadius: '20px', padding: '20px', border: '1px solid #1a1a1a',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px' }}>{item.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>Обліковується як: {item.type === 'scrap_restoration' ? 'Відновлення (ВКЯ)' : item.type}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                       <div style={{ textAlign: 'right', marginRight: '10px' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 1000 }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                       </div>
                       {viewingCategory === 'restoration' ? (
                         <>
                           <button 
                             onClick={() => handleRework(item, 'Пресування [ЦЕХ №2]')}
                             style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >ПРЕСУВАННЯ</button>
                           <button 
                             onClick={() => handleRework(item, 'Фарбування')}
                             style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >ФАРБУВАННЯ</button>
                         </>
                       ) : viewingCategory === 4 ? (
                         <button 
                           onClick={() => handleDispose(item)}
                           style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                         >СПИСАТИ</button>
                        ) : (
                          <>
                           <button 
                             onClick={() => handleRework(item, 'Доопрацювання')}
                             style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >НА ДООПРАЦЮВАННЯ</button>
                           <button 
                             onClick={() => handleSendToRestoration(item)}
                             style={{ background: '#06b6d4', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >НА ВІДНОВЛЕННЯ</button>
                         </>
                        )}
                    </div>
                  </div>
                ))
              ) : (
                readyItems.map(item => {
                  const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                  const isActive = selectedItem?.id === item.id
                  return (
                    <div key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedItem(item) }}
                      role="button"
                      tabIndex={0}
                      style={{ 
                        background: isActive ? 'rgba(239, 68, 68, 0.05)' : '#111', 
                        borderRadius: '20px', padding: '20px', cursor: 'pointer',
                        border: `1px solid ${isActive ? '#ef444450' : '#1a1a1a'}`,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isActive ? '0 10px 30px rgba(239, 68, 68, 0.1)' : 'none'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ 
                          background: '#000', width: '50px', height: '50px', borderRadius: '14px', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' 
                         }}>
                          <Package size={22} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px' }}>{nom?.name || item.name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: '5px', fontSize: '0.67rem', fontWeight: 850 }}>
                            <span style={{ color: '#f59e0b' }}>Наряд №{item.naryad_number}</span>
                            <span style={{ color: '#38bdf8' }}>Картка №{item.card_sequence || '—'}</span>
                            <span style={{ color: '#64748b' }} title={item.card_id ? String(item.card_id) : ''}>Системна #{item.card_number}</span>
                            <span style={{ color: '#666' }}>Отримано: {new Date(item.updated_at).toLocaleDateString('uk-UA')}</span>
                          </div>
                          {item.operator && <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800, marginTop: '3px' }}>Оператор: {item.operator} · Етап: {item.stage || '—'}</div>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#fff' }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                        {!isActive && <div style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 1000, textTransform: 'uppercase', marginTop: '5px' }}>Натисніть для класифікації</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Classification card: modal for queue items, inline info for category views */}
          {(selectedItem || viewingCategory) && (
          <div
            onClick={selectedItem ? () => setSelectedItem(null) : undefined}
            style={selectedItem ? {
              position: 'fixed', inset: 0, zIndex: 10040,
              background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(5px)',
              padding: '24px', overflowY: 'auto',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center'
            } : {}}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={selectedItem ? { width: '100%', maxWidth: '620px', margin: '20px auto' } : {}}
            >
              <h2 style={{ margin: '0 0 20px', fontSize: '1.4rem', fontWeight: 950 }}>{viewingCategory ? 'Довідка' : 'Обробка деталі'}</h2>
              
              <div style={{ 
                background: 'linear-gradient(145deg, #111 0%, #0a0a0a 100%)', 
                borderRadius: '30px', padding: '35px', border: '1px solid #1a1a1a', minHeight: selectedItem ? 'auto' : '400px',
                boxShadow: selectedItem ? '0 30px 90px rgba(0,0,0,0.65)' : 'none',
                display: 'flex', flexDirection: 'column', justifyContent: (selectedItem || viewingCategory) ? 'flex-start' : 'center',
                alignItems: (selectedItem || viewingCategory) ? 'stretch' : 'center', textAlign: (selectedItem || viewingCategory) ? 'left' : 'center'
              }}>
                {viewingCategory && !selectedItem && (
                   <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px', color: '#06b6d4' }}>
                        <Layers size={40} />
                      </div>
                      <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginBottom: '10px' }}>
                        {viewingCategory === 'restoration' ? 'Внутрішнє Відновлення ВКЯ' : `Аналіз Категорії ${viewingCategory}`}
                      </div>
                      <p style={{ color: '#555', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {viewingCategory === 'restoration'
                          ? 'У цій вкладці знаходяться деталі, які потребують складного відновлення фахівцями ВКЯ. Звідси ви можете запустити їх у Цех №2 на операції Пресування чи Фарбування.'
                          : viewingCategory === 4 
                            ? 'У цій категорії знаходиться безнадійний брак. Ви можете списати ці деталі, і вони будуть назавжди враховані як збитки у відповідному документі.' 
                            : 'Деталі у цій категорії підлягають легкому доопрацюванню. Ви можете створити наряд, який запустить ці деталі знову в роботу у цех 2.'}
                      </p>
                      <button 
                        onClick={() => setViewingCategory(null)}
                        style={{ marginTop: '30px', background: 'transparent', border: '1px solid #222', color: '#94a3b8', padding: '12px 25px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' }}
                      >ПОВЕРНУТИСЬ ДО КЛАСИФІКАЦІЇ</button>
                   </div>
                )}

                {!selectedItem && !viewingCategory && (
                  <>
                    <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '25px', color: '#222' }}>
                      <Info size={40} />
                    </div>
                    <div style={{ color: '#333', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Оберіть деталь з черги</div>
                    <p style={{ color: '#222', fontSize: '0.75rem', marginTop: '10px', maxWidth: '240px' }}>Кожна деталь браку має бути присвоєна певній категорії для коректного обліку та аналітики</p>
                  </>
                )}

                {selectedItem && (
                  <>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                       <div style={{ background: '#000', width: '64px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                          <AlertTriangle size={32} />
                       </div>
                       <div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 1000, lineHeight: 1.1 }}>{selectedItem.name}</div>
                          <div style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 1000, marginTop: '8px' }}>
                            {selectedItem.total_qty} шт до розподілу
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: '10px', fontSize: '0.7rem', fontWeight: 900 }}>
                            <span style={{ color: '#f59e0b' }}>Наряд №{selectedItem.naryad_number}</span>
                            <span style={{ color: '#38bdf8' }}>Картка №{selectedItem.card_sequence || '—'}</span>
                            <span style={{ color: '#64748b' }} title={selectedItem.card_id ? String(selectedItem.card_id) : ''}>Системна #{selectedItem.card_number}</span>
                          </div>
                          <div style={{ marginTop: '8px', color: '#a78bfa', fontSize: '0.72rem', fontWeight: 900 }}>
                            Оператор: {selectedItem.operator || 'Не вказаний'}
                          </div>
                       </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid #1a1a1a' }}>
                        <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '20px' }}>РОЗПОДІЛ ЗА КАТЕГОРІЯМИ:</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          {[
                            { cat: 1, label: 'Категорія 1', color: '#10b981', desc: 'Мінімальний брак (можна виправити)' },
                            { cat: 2, label: 'Категорія 2', color: '#eab308', desc: 'Середній брак (переробка)' },
                            { cat: 3, label: 'Категорія 3', color: '#f97316', desc: 'Серйозний брак (геометрія)' },
                            { cat: 4, label: 'Категорія 4', color: '#ef4444', desc: 'Критичний брак (брухт)' },
                          ].map(c => (
                            <div key={c.cat} style={{ 
                              background: '#0a0a0a', 
                              borderLeft: '1px solid #1a1a1a', 
                              borderRight: '1px solid #1a1a1a', 
                              borderBottom: '1px solid #1a1a1a', 
                              borderRadius: '18px', padding: '15px 20px', 
                              display: 'flex', alignItems: 'center', gap: '15px', 
                              position: 'relative', overflow: 'hidden' 
                            }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: c.color }}></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 1000, color: c.color }}>{c.label}</div>
                                  <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 600 }}>{c.desc}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <button 
                                     onClick={() => updateCategoryQty(c.cat, Number(distribution[c.cat]) - 1)}
                                     style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#111', border: '1px solid #222', color: '#fff', cursor: 'pointer' }}
                                   >-</button>
                                   <input 
                                      type="number"
                                      value={distribution[c.cat] === 0 ? '' : distribution[c.cat]}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        updateCategoryQty(c.cat, val === '' ? 0 : parseInt(val) || 0)
                                      }}
                                      placeholder="0"
                                      style={{ width: '50px', textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 1000, outline: 'none' }}
                                   />
                                   <button 
                                     onClick={() => updateCategoryQty(c.cat, Number(distribution[c.cat]) + 1)}
                                     style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#111', border: '1px solid #222', color: '#fff', cursor: 'pointer' }}
                                   >+</button>
                                </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ 
                          marginTop: '25px', padding: '15px', borderRadius: '15px', background: '#000', border: '1px solid #222',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                           <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#444' }}>ВИБРАНО: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#fff' }}>{totalDistributed} / {selectedItem.total_qty}</span></div>
                           <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#444' }}>ЗАЛИШОК: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#10b981' }}>{remainingInBatch} шт</span></div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid #1a1a1a' }}>
                      <div style={{ marginBottom: '18px' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#777', fontWeight: 950, textTransform: 'uppercase' }}>ПРИЧИНИ БРАКУ</div>
                          <div style={{ color: '#444', fontSize: '0.63rem', marginTop: '4px' }}>
                            {totalDistributed > 0 ? `Розподіліть за причинами ${totalDistributed} шт, вибраних вище` : 'Спочатку вкажіть кількість у категоріях вище'}
                          </div>
                        </div>
                      </div>
                      {totalDistributed === 0 ? (
                        <div style={{ padding: '22px', textAlign: 'center', background: '#090909', border: '1px dashed #292929', borderRadius: '13px', color: '#555', fontSize: '0.72rem', fontWeight: 800 }}>
                          Блок причин стане доступним після розподілу хоча б однієї деталі за категоріями
                        </div>
                      ) : <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {reasonAllocations.map((allocation, index) => (
                          <div key={index} style={{ background: '#090909', border: `1px solid ${Number(allocation.qty) > 0 && !allocation.reason ? '#ef444466' : '#1d1d1d'}`, borderRadius: '13px', padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#555', fontSize: '0.6rem', fontWeight: 900 }}>
                              <span>ПРИЧИНА {index + 1}</span><span>КІЛЬКІСТЬ</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '9px', alignItems: 'center' }}>
                            <select value={allocation.reason} onChange={event => setReasonAllocations(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                              style={{ minWidth: 0, width: '100%', background: '#050505', border: '1px solid #292929', color: allocation.reason ? '#fff' : '#666', padding: '11px', borderRadius: '9px', fontWeight: 800 }}>
                              <option value="">Оберіть причину...</option>
                              {activeScrapReasons.filter(reason => reason === allocation.reason || !reasonAllocations.some((item, itemIndex) => itemIndex !== index && item.reason === reason)).map(reason => <option key={reason} value={reason}>{reason}</option>)}
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button onClick={() => updateReasonQty(index, Number(allocation.qty) - 1)} disabled={Number(allocation.qty) <= 0}
                                style={{ width: '32px', height: '32px', background: '#151515', border: '1px solid #292929', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>−</button>
                              <input type="number" min="0" max={totalDistributed} value={allocation.qty || ''} placeholder="0"
                                onChange={event => updateReasonQty(index, event.target.value)}
                                style={{ width: '54px', background: 'transparent', border: 0, color: '#fff', textAlign: 'center', fontSize: '1rem', fontWeight: 950, outline: 'none' }} />
                              <button onClick={() => updateReasonQty(index, Number(allocation.qty) + 1)} disabled={totalReasonAllocated >= totalDistributed}
                                style={{ width: '32px', height: '32px', background: '#151515', border: '1px solid #292929', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>+</button>
                            </div>
                            <button onClick={() => setReasonAllocations(items => items.length === 1 ? [{ reason: '', qty: 0 }] : items.filter((_, itemIndex) => itemIndex !== index))}
                              title="Прибрати причину" style={{ width: '32px', height: '32px', background: '#ef444412', border: '1px solid #ef444433', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 900 }}>×</button>
                            </div>
                            {Number(allocation.qty) > 0 && !allocation.reason && (
                              <div style={{ color: '#ef4444', fontSize: '0.62rem', fontWeight: 900, marginTop: '8px' }}>Оберіть причину для цієї кількості</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setReasonAllocations(items => [...items, { reason: '', qty: 0 }])}
                        disabled={totalReasonAllocated >= totalDistributed || reasonAllocations.length >= activeScrapReasons.length}
                        style={{ width: '100%', marginTop: '11px', background: '#f59e0b12', color: '#f59e0b', border: '1px dashed #f59e0b55', borderRadius: '11px', padding: '11px', fontSize: '0.7rem', fontWeight: 950, cursor: 'pointer', opacity: totalReasonAllocated >= totalDistributed ? 0.35 : 1 }}>
                        + ДОДАТИ ЩЕ ОДНУ ПРИЧИНУ
                      </button>
                      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#000', border: `1px solid ${totalReasonAllocated === totalDistributed && totalDistributed > 0 ? '#10b98144' : '#292929'}`, borderRadius: '11px', fontSize: '0.7rem', fontWeight: 900 }}>
                        <span style={{ color: '#555' }}>ЗА ПРИЧИНАМИ: <b style={{ color: totalReasonAllocated === totalDistributed && totalDistributed > 0 ? '#10b981' : '#fff' }}>{totalReasonAllocated}</b></span>
                        <span style={{ color: '#555' }}>ЗАЛИШИЛОСЬ: <b style={{ color: totalReasonAllocated === totalDistributed ? '#10b981' : '#f59e0b' }}>{Math.max(0, totalDistributed - totalReasonAllocated)}</b></span>
                      </div>
                      </>}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        disabled={isProcessing || remainingInBatch < 0 || !isReasonDistributionValid}
                        onClick={handleBulkClassify}
                        style={{ flex: 2, background: '#8b5cf6', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: 1000, cursor: isReasonDistributionValid ? 'pointer' : 'not-allowed', opacity: (remainingInBatch < 0 || !isReasonDistributionValid) ? 0.3 : 1 }}
                      >
                        {isProcessing ? 'ОБРОБКА...' : 'ПІДТВЕРДИТИ РОЗПОДІЛ'}
                      </button>
                      <button 
                        onClick={() => setSelectedItem(null)}
                        style={{ flex: 1, background: 'transparent', border: '1px solid #222', color: '#444', padding: '15px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        СКАСУВАТИ
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
        </>}
      </div>

      {/* ── МОДАЛКА СКАНЕРА QR ── */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 900, fontSize: '0.9rem' }}>
                <Scan size={18} /> СКАНУВАННЯ КАРТКИ
              </div>
              <button onClick={() => setIsScanning(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: 0, position: 'relative', background: '#000', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div id="qc-reader" style={{ width: '100%', border: 'none' }} />
            </div>
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.75rem', color: '#666' }}>
              Наведіть камеру на QR-код виробничої картки
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА ОФОРМЛЕННЯ БРАКУ З КАРТКИ ── */}
      {scannedCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10060, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🛡️ ВІДДІЛ ВКЯ · ФІКСАЦІЯ БРАКУ
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
                  Замовлення №{orders?.find(o => o.id === scannedCard.order_id)?.order_num || '—'} · Картка #{scannedCard.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              <button onClick={() => setScannedCard(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>
                {(nomenclatures || []).find(n => n.id === scannedCard.nomenclature_id)?.name || 'Деталь'}
              </h3>

              {/* Інспектор ВКЯ */}
              <div>
                <label style={{ color: '#888', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>ПІБ Інспектора ВКЯ (або відповідального)</label>
                <input
                  type="text"
                  placeholder="Введіть ваше прізвище..."
                  value={qcInspector}
                  onChange={e => setQcInspector(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {/* Причина браку */}
              <div>
                <label style={{ color: '#888', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>Причина браку</label>
                <select
                  value={qcReason}
                  onChange={e => {
                    setQcReason(e.target.value)
                    if (e.target.value !== 'Інше (коментар)') {
                      setQcCustomReason('')
                    }
                  }}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                >
                  {scrapReasons.filter(reason => scrapReasonRows.find(row => row.name === reason)?.is_active !== false).map(reason => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </div>

              {/* Коментар до причини браку */}
              {qcReason === 'Інше (коментар)' && (
                <div>
                  <label style={{ color: '#888', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>Опишіть іншу причину браку</label>
                  <input
                    type="text"
                    placeholder="Введіть коментар..."
                    value={qcCustomReason}
                    onChange={e => setQcCustomReason(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              )}

              {/* Лічильник додаткового браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={scannedCard.quantity} value={qcScrapCount === 0 ? '' : qcScrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(scannedCard.quantity, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900, outline: 'none' }} />
                  <button onClick={() => setQcScrapCount(v => Math.min(scannedCard.quantity, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
                  Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (scannedCard.quantity || 0) - qcScrapCount)} шт</strong>
                </div>
              </div>

              <button onClick={handleQCScrapOverride} disabled={isProcessing || qcScrapCount <= 0}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px',
                  fontSize: '1.05rem', fontWeight: 1000, cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(239,68,68,0.3)',
                  opacity: (isProcessing || qcScrapCount <= 0) ? 0.5 : 1
                }}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ СПИСАТИ У БРАК ВКЯ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { backdrop-filter: blur(10px); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />
    </div>
  )
}
