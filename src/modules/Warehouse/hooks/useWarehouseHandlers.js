import { supabase as supabaseClient } from '../../../supabase'
import { apiService } from '../../../services/apiDispatcher'
import { normalize, parseMaterialName } from './useWarehouseComputed'

export const useWarehouseHandlers = ({
  nomenclatures,
  inventory,
  tasks,
  purchaseRequests,
  receptionDocs,
  machineOperations,
  activeTab,
  fetchData,
  refreshTable,
  issueMaterialsBatch,
  createPurchaseRequest,
  approveWarehouse,
  setIsScanning,
  setScannedCard,
  setScannedRequests,
  setKittingBoxItem,
  setCameraError,
  setManualCardInput,
  setIsProcessing,
  setProcessingTasks,
  setProcessingDocs,
  setShortages,
  setNewItem,
  setShowAdd,
  setEditingQty,
  setSavingQty,
  setEditingInvId,
  setEditingInvTotal,
  setEditingInvReserved,
  setSavingInv,
  checkedCutters,
  setCheckedCutters,
  editingQty,
  savingQty,
  editingInvTotal,
  editingInvReserved,
  savingInv,
  scannedRequests,
  shortages,
  isProcessing,
  newItem
}) => {

  const handleToggleCutterCheck = (cardId, nomId) => {
    setCheckedCutters(prev => {
      const cardState = prev[cardId] || {}
      return {
        ...prev,
        [cardId]: {
          ...cardState,
          [nomId]: !cardState[nomId]
        }
      }
    })
  }

  const handlePrepareBox = async (boxItem, boxNumber = null) => {
    setIsProcessing(true)
    try {
      const { card, cutters } = boxItem
      for (const cutter of cutters) {
        const { data: matchedInventory, error: invErr } = await supabaseClient
          .from('inventory')
          .select('*')
          .eq('nomenclature_id', cutter.nomenclature_id)
        
        if (invErr) throw invErr

        const invItem = (matchedInventory || []).find(i => i.warehouse === 'operational' || !i.warehouse) 
          || (matchedInventory || [])[0]

        const qtyToDeduct = cutter.qty

        if (invItem) {
          const nextTotal = Math.max(0, (Number(invItem.total_qty) || 0) - qtyToDeduct)
          await supabaseClient.from('inventory')
            .update({ 
              total_qty: nextTotal, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', invItem.id)
        }

        const { data: existingReq } = await supabaseClient
          .from('material_requests')
          .select('*')
          .eq('card_id', card.id)
          .eq('nomenclature_id', cutter.nomenclature_id)
          .maybeSingle()

        if (existingReq) {
          await supabaseClient.from('material_requests')
            .update({ quantity: qtyToDeduct, status: 'completed' })
            .eq('id', existingReq.id)
        } else {
          const cardLabel = card.card_info?.split(' ')[0] || `№${card.id.substring(0, 8)}`
          await supabaseClient.from('material_requests').insert({
            order_id: card.order_id,
            task_id: card.task_id,
            card_id: card.id,
            nomenclature_id: cutter.nomenclature_id,
            quantity: qtyToDeduct,
            status: 'completed',
            details: `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ): ${cutter.name} — ${qtyToDeduct} шт.`
          })
        }
      }

      const nextCardInfo = `${card.card_info || ''} [BOX_PREPARED:true]`.trim()
      const { error: cardUpdateErr } = await supabaseClient
        .from('work_cards')
        .update({ 
          card_info: nextCardInfo,
          box_number: boxNumber ? String(boxNumber) : card.box_number
        })
        .eq('id', card.id)

      if (cardUpdateErr) throw cardUpdateErr

      alert('Бокс фрез успішно укомплектовано та списано!')
      if (typeof fetchData === 'function') {
        fetchData(['inventory', 'material_requests', 'work_cards'])
      }
    } catch (err) {
      alert('Помилка підготовки боксу: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCardScan = async (cardId) => {
    try {
      let card = null
      const cleanVal = String(cardId).trim()

      const isBoxScan = 
        cleanVal.toUpperCase().startsWith('BOX-') || 
        cleanVal.toUpperCase().includes('BOX') || 
        (/^\d+$/.test(cleanVal) && Number(cleanVal) >= 1 && Number(cleanVal) <= 1000)

      if (isBoxScan) {
        const boxNum = cleanVal.replace(/BOX-/gi, '').replace(/^0+/, '')
        const { data: matchedCards, error: searchErr } = await supabaseClient
          .from('work_cards')
          .select('*')
          .or(`box_number.eq.${boxNum},box_number.eq.${cleanVal}`)
          .neq('status', 'completed')
          .limit(1)

        if (searchErr || !matchedCards || matchedCards.length === 0) {
          alert(`Картку для боксу "${cleanVal}" не знайдено або наряд вже завершено!`)
          return
        }
        card = matchedCards[0]
      } else {
        const { data: cardData, error: cardErr } = await supabaseClient
          .from('work_cards')
          .select('*')
          .eq('id', cleanVal)
          .single()
        
        if (cardErr || !cardData) {
          alert('Картку не знайдено!')
          return
        }
        card = cardData
      }

      const { data: reqs, error: reqsErr } = await supabaseClient
        .from('material_requests')
        .select('*')
        .or(`card_id.eq.${card.id},and(task_id.eq.${card.task_id},card_id.is.null)`)

      if (reqsErr) {
        alert('Помилка завантаження матеріалів: ' + reqsErr.message)
        return
      }

      if (!reqs || reqs.length === 0) {
        alert('Для цієї картки немає зареєстрованих запитів на матеріали.')
        return
      }

      const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
      const unitsPerSheet = Number(nom?.units_per_sheet) || 1
      const cardSheets = Math.ceil(Number(card.quantity) / unitsPerSheet)

      const normStr = str => str ? str.toLowerCase().replace(/[^a-z0-9а-яєіїґ]/g, '') : ''

      const resolveMachineType = (machineName) => {
        if (!machineName) return null
        const normMac = machineName.toLowerCase()
        if (normMac.includes('3050(16)x1600') || normMac.includes('3050(16)х1600') || normMac.includes('3050(16)') || normMac.includes('16x16') || normMac.includes('16х16') || normMac.includes('3050x1600') || normMac.includes('3050х1600') || normMac.includes('3050')) {
          return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
        } else if (normMac.includes('дракон') || normMac.includes('60x20') || normMac.includes('6000x2000') || normMac.includes('6000х2000')) {
          return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
        } else if (normMac.includes('малий') || normMac.includes('12x8') || normMac.includes('1200x800') || normMac.includes('12х8') || normMac.includes('1200х800')) {
          return 'CNC 1200x800 - 4 листи (Малий)'
        } else if (normMac.includes('три головий') || normMac.includes('триголовий') || normMac.includes('3060') || normMac.includes('30x16') || normMac.includes('30х16')) {
          return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
        } else if (normMac.includes('фея') || normMac.includes('ke xin')) {
          return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
        }
        return machineName
      }

      const cardMac = card.machine || card.machine_name
      const opType = resolveMachineType(cardMac)
      const ops = (machineOperations || []).find(o => 
        String(o.nomenclature_id) === String(card.nomenclature_id) && 
        (normStr(o.machine_type) === normStr(opType) || String(o.machine_id) === String(cardMac))
      )

      const cuttersRates = {}
      if (ops && Array.isArray(ops.side2_cut_ops)) {
        ops.side2_cut_ops.forEach(op => {
          if (op.startsWith('__CUTTER__Reference:')) return
          if (op.startsWith('__CUTTER__:')) {
            const parts = op.split(':')
            const cNomId = parts[1]
            const cQty = parseFloat(parts[2]) || 0
            if (cNomId && cQty > 0) {
              cuttersRates[cNomId] = cQty
            }
          }
        })
      }

      const getDisplayMaterial = (partNom, snapshot) => {
        const baseMat = partNom?.material_type || '—'
        if (!snapshot) return baseMat
        const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
        const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0

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
        }
        return baseMat
      }

      const task = (tasks || []).find(t => t.id === card.task_id)
      const snapshotPart = task?.plan_snapshot?.[card.nomenclature_id]
      const activeMaterial = getDisplayMaterial(nom, snapshotPart)

      const isSheetMatchingPart = (req, activeMaterial, partNom) => {
        if (!activeMaterial) return false
        const reqNom = nomenclatures.find(n => n.id === req.nomenclature_id)
        const reqName = reqNom?.name || req.details || ''
        const reqMatNorm = normStr(reqName)
        const activeMaterials = activeMaterial.split('+').map(m => normStr(m.trim()))

        if (activeMaterials.some(act => reqMatNorm.includes(act) || act.includes(reqMatNorm))) {
          return true
        }
        
        const reqDetails = req.details || ''
        if (partNom && normStr(reqDetails).includes(normStr(partNom.name))) {
          return true
        }
        
        return false
      }

      const isSheetRequest = (req) => {
        const reqNom = nomenclatures.find(n => n.id === req.nomenclature_id)
        const name = reqNom?.name || req.details || ''
        const lowerName = name.toLowerCase()
        return lowerName.includes('лист') || lowerName.includes('sheet')
      }

      const matchedSheets = reqs.filter(req => !req.card_id && isSheetRequest(req) && isSheetMatchingPart(req, activeMaterial, nom)).map(req => ({
        ...req,
        displayQty: cardSheets,
        isSheet: true
      }))

      let matchedCutters = []
      if (ops && Object.keys(cuttersRates).length > 0) {
        for (const [rateNomId, rateQty] of Object.entries(cuttersRates)) {
          const existingCutterReq = reqs.find(req => {
            if (!req.card_id) return false
            if (req.nomenclature_id === rateNomId) return true
            
            const reqNom = nomenclatures.find(n => n.id === req.nomenclature_id)
            const reqName = reqNom ? reqNom.name : (req.details || '')
            const rateNom = nomenclatures.find(n => n.id === rateNomId)
            if (!rateNom) return false
            
            const getDiameter = (name) => {
              const clean = name.toLowerCase().replace(/,/g, '.')
              const match = clean.match(/(?:фреза|ф|d|d=|діаметр|діаметром)?\s*([0-9]+(?:[.,][0-9]+)?)/)
              return match ? parseFloat(match[1]) : null
            }
            const reqD = getDiameter(reqName)
            const rateD = getDiameter(rateNom.name)
            return reqD !== null && rateD !== null && reqD === rateD
          })

          if (existingCutterReq) {
            matchedCutters.push({
              ...existingCutterReq,
              displayQty: Math.ceil(rateQty * cardSheets),
              isSheet: false,
              isSynthetic: false
            })
          } else {
            const rateNom = nomenclatures.find(n => n.id === rateNomId)
            const cardLabel = card.card_info?.split(' ')[0] || `№${card.id.substring(0, 8)}`
            matchedCutters.push({
              id: `synthetic-${rateNomId}-${cardId}`,
              nomenclature_id: rateNomId,
              quantity: Math.ceil(rateQty * cardSheets),
              displayQty: Math.ceil(rateQty * cardSheets),
              status: 'pending',
              details: `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ): ${rateNom?.name || ''} — ${Math.ceil(rateQty * cardSheets)} шт.`,
              card_id: cardId,
              task_id: card.task_id,
              order_id: card.order_id,
              isSheet: false,
              isSynthetic: true
            })
          }
        }
      } else {
        matchedCutters = reqs.filter(req => req.card_id).map(req => ({
          ...req,
          displayQty: Number(req.quantity),
          isSheet: false
        }))
      }

      const processedReqs = [...matchedSheets, ...matchedCutters]

      // Check if this card has a physical box assigned
      const isBoxPrepared = (card.card_info || '').includes('[BOX_PREPARED:true]')
      const hasBox = !!card.box_number

      if (!hasBox && !isBoxPrepared) {
        const preparedCutters = []
        for (const [cNomId, rate] of Object.entries(cuttersRates)) {
          const cNom = nomenclatures.find(n => n.id === cNomId)
          let cutterName = cNom?.name || 'Фреза'
          let finalNomId = cNomId

          const getDiameter = (name) => {
            if (!name) return null
            const clean = name.toLowerCase().replace(/,/g, '.')
            const exactMatch = clean.match(/(?:фреза|ф|d|d=|діаметр|діаметром)?\s*([0-9]+(?:[.,][0-9]+)?)/)
            return exactMatch ? parseFloat(exactMatch[1]) : null
          }

          const targetD = getDiameter(cNom?.name)
          if (targetD !== null) {
            const exactReq = (reqs || []).find(r => {
              const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
              const rName = rNom ? rNom.name : (r.details || '')
              const rD = getDiameter(rName)
              return rD !== null && rD === targetD
            })

            if (exactReq) {
              const exactNom = nomenclatures.find(n => n.id === exactReq.nomenclature_id)
              if (exactNom) {
                cutterName = exactNom.name
                finalNomId = exactNom.id
              }
            }
          }

          preparedCutters.push({
            nomenclature_id: finalNomId,
            name: cutterName,
            qty: Math.ceil(rate * cardSheets)
          })
        }

        setKittingBoxItem({
          card,
          cutters: preparedCutters,
          activeMaterialName: activeMaterial,
          cardSheets
        })
        return
      }

      setScannedCard(card)
      setScannedRequests(processedReqs)
    } catch (e) {
      alert('Помилка: ' + e.message)
    }
  }

  const handleIssueCardMaterials = async () => {
    setIsProcessing(true)
    try {
      const pendingReqs = scannedRequests.filter(r => r.status === 'pending' || r.status === 'issued')
      
      for (const req of pendingReqs) {
        const { data: matchedInventory, error: invErr } = await supabaseClient
          .from('inventory')
          .select('*')
          .or(`id.eq.${req.inventory_id || 0},nomenclature_id.eq.${req.nomenclature_id || 0}`)
        
        if (invErr) throw invErr

        const invItem = (matchedInventory || []).find(i => i.warehouse === 'operational' || !i.warehouse) 
          || (matchedInventory || [])[0]

        const qtyToDeduct = req.displayQty ?? Number(req.quantity) ?? 0

        if (invItem) {
          const nextTotal = Math.max(0, (Number(invItem.total_qty) || 0) - qtyToDeduct)
          const wasReserved = req.status === 'issued'
          const nextReserved = wasReserved 
            ? Math.max(0, (Number(invItem.reserved_qty) || 0) - qtyToDeduct)
            : (Number(invItem.reserved_qty) || 0)

          await supabaseClient.from('inventory')
            .update({ 
              total_qty: nextTotal, 
              reserved_qty: nextReserved, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', invItem.id)
        }

        if (req.isSheet) {
          const nextQty = Math.max(0, (Number(req.quantity) || 0) - qtyToDeduct)
          const nextStatus = nextQty === 0 ? 'completed' : req.status
          await supabaseClient.from('material_requests')
            .update({ quantity: nextQty, status: nextStatus })
            .eq('id', req.id)
        } else {
          if (req.isSynthetic) {
            await supabaseClient.from('material_requests').insert({
              order_id: req.order_id,
              task_id: req.task_id,
              card_id: req.card_id,
              nomenclature_id: req.nomenclature_id,
              quantity: qtyToDeduct,
              status: 'completed',
              details: req.details
            })
          } else {
            await supabaseClient.from('material_requests')
              .update({ quantity: qtyToDeduct, status: 'completed' })
              .eq('id', req.id)
          }
        }
      }

      alert('Матеріали успішно списано та видано!')
      setScannedCard(null)
      setScannedRequests([])
      setIsScanning(false)
      if (typeof fetchData === 'function') fetchData(['inventory', 'material_requests'])
    } catch (err) {
      alert('Помилка видачі: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveConsumableQty = async (reqId) => {
    const newVal = parseFloat(editingQty[reqId])
    if (isNaN(newVal) || newVal < 0) return
    setSavingQty(prev => new Set(prev).add(reqId))
    try {
      await supabaseClient.from('material_requests').update({ quantity: newVal }).eq('id', reqId)
      if (typeof fetchData === 'function') fetchData(['material_requests'])
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSavingQty(prev => { const n = new Set(prev); n.delete(reqId); return n })
      setEditingQty(prev => { const n = { ...prev }; delete n[reqId]; return n })
    }
  }

  const handleDeleteRequest = async (reqId) => {
    if (!window.confirm('Ви впевнені, що хочете повністю видалити цей запит з бази даних?')) return
    try {
      const { error } = await supabaseClient
        .from('material_requests')
        .delete()
        .eq('id', reqId)
      if (error) throw error
      alert('Запит успішно видалено!')
      if (typeof fetchData === 'function') {
        fetchData(['material_requests'])
      }
    } catch (e) {
      console.error(e)
      alert('Помилка видалення запиту: ' + e.message)
    }
  }

  const handleDeleteEntireRequest = async (reqList, displayNum) => {
    if (!window.confirm(`Ви впевнені, що хочете повністю видалити весь запит для НАРЯДУ #${displayNum} з бази даних? (${reqList.length} позицій)`)) return
    try {
      const ids = reqList.map(r => r.id)
      const { error } = await supabaseClient
        .from('material_requests')
        .delete()
        .in('id', ids)
      if (error) throw error
      alert('Запит для наряду успішно видалено!')
      if (typeof fetchData === 'function') {
        fetchData(['material_requests'])
      }
    } catch (e) {
      console.error(e)
      alert('Помилка видалення запиту: ' + e.message)
    }
  }

  const handleSaveInventoryQty = async (itemId) => {
    const totalVal = parseFloat(editingInvTotal)
    const reservedVal = parseFloat(editingInvReserved)
    if (isNaN(totalVal) || totalVal < 0 || isNaN(reservedVal) || reservedVal < 0) {
      alert('Будь ласка, введіть коректні числа (>= 0)')
      return
    }
    setSavingInv(true)
    try {
      await supabaseClient.from('inventory').update({
        total_qty: totalVal,
        reserved_qty: reservedVal,
        updated_at: new Date().toISOString()
      }).eq('id', itemId)
      if (typeof fetchData === 'function') fetchData(['inventory'])
      setEditingInvId(null)
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSavingInv(false)
    }
  }

  const handleAddInventory = async (e) => {
    e.preventDefault()
    if (isProcessing) return
    if (activeTab === 'pocket' && !newItem.pocket_owner) {
      alert('Будь ласка, оберіть майстра для кишені!')
      return
    }
    setIsProcessing(true)
    try {
      await apiService.submitInventory(newItem, async (data) => {
        const normInput = normalize(data.name)
        const matchedNom = nomenclatures.find(n => {
          const fullName = `${n.name}${n.material_type ? ` (${n.material_type})` : ''}`
          return normalize(fullName) === normInput || normalize(n.name) === normInput
        })

        const itemType = matchedNom ? (matchedNom.type || 'raw') : (data.type || 'raw')
        const targetNomId = matchedNom ? matchedNom.id : null
        const targetName = matchedNom ? `${matchedNom.name}${matchedNom.material_type ? ` (${matchedNom.material_type})` : ''}` : data.name

        const targetWh = activeTab === 'pocket' ? 'pocket' : 'operational'
        const existing = (inventory || []).find(i => 
          i.warehouse === targetWh &&
          i.type === itemType &&
          (targetWh !== 'pocket' || i.pocket_owner === data.pocket_owner) &&
          (
            (targetNomId && i.nomenclature_id === targetNomId) ||
            (!targetNomId && normalize(i.name) === normInput)
          )
        )

        if (existing) {
          await supabaseClient.from('inventory')
            .update({
              total_qty: (Number(existing.total_qty) || 0) + (Number(data.total_qty) || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        } else {
          await supabaseClient.from('inventory').insert([{
            nomenclature_id: targetNomId,
            name: targetName,
            unit: data.unit || matchedNom?.unit || 'шт',
            total_qty: Number(data.total_qty) || 0,
            reserved_qty: 0,
            type: itemType,
            warehouse: targetWh,
            pocket_owner: targetWh === 'pocket' ? data.pocket_owner : null
          }])
        }
      })
      setShowAdd(false)
      setNewItem({ name: '', unit: 'шт', total_qty: '', type: activeTab, pocket_owner: '' })
      if (typeof fetchData === 'function') fetchData(['inventory'])
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReserveOrder = (taskId, orderId, orderNum, reqList) => {
    const hasActivePR = (purchaseRequests || []).some(
      pr => (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && 
            ['pending', 'accepted', 'ordered'].includes(pr.status)
    )
    if (hasActivePR) return

    const missingItems = []
    reqList.forEach(req => {
      const parsedName = parseMaterialName(req.details)
      const nameLower = parsedName.toLowerCase()
      
      const matching = (inventory || []).filter(i => {
        if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
        if (i.id === req.inventory_id) return true
        if (parsedName) {
          const normName = normalize(i.name)
          const normParsed = normalize(parsedName)
          if (normName === normParsed) return true
          if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
          const normNameNoParens = normalize(i.name.replace(/\s*\([^)]*\)$/, ''))
          if (normNameNoParens === normParsed) return true
        }
        return false
      })
      
      const nom = req.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(req.nomenclature_id)) : null
      const isSgp = (
        nom?.type === 'part' || 
        nom?.type === 'product' || 
        nameLower.startsWith('іп-') || 
        nameLower.startsWith('ip-') || 
        nameLower.startsWith('kr-') || 
        nameLower.startsWith('kh-') || 
        (nameLower.includes('іп') && !nameLower.includes('кріплення') && !nameLower.includes('друк') && !nameLower.includes('3д')) ||
        nameLower.includes('ip') ||
        matching.some(i => i.type === 'finished' || i.type === 'semi' || i.type === 'part')
      )
      if (isSgp) return

      const operationalItems = matching.filter(i => i.warehouse === 'operational' || !i.warehouse)
      const available = operationalItems.reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
      const invItem = operationalItems[0] || matching[0]
      
      const globalAvailable = (inventory || []).filter(i => {
        if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
        if (parsedName) {
          const normName = normalize(i.name)
          const normParsed = normalize(parsedName)
          if (normName === normParsed) return true
          if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
        }
        return false
      }).reduce((acc, i) => acc + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)

      const needed = Number(req.quantity)
      if (available < needed) {
        const missingAmount = needed - available
        const nomenclature_id = invItem?.nomenclature_id ||
          (nomenclatures || []).find(n => normalize(n.name) === normalize(parsedName))?.id || 
          req.nomenclature_id || null
        
        const existing = missingItems.find(it => (it.nomenclature_id && it.nomenclature_id === nomenclature_id) || normalize(it.name) === normalize(parsedName))
        
        if (existing) {
          existing.missingAmount += missingAmount
          existing.needed += needed
        } else {
          missingItems.push({
            reqDetails: parsedName,
            missingAmount,
            globalAvailable,
            inventory_id: invItem?.id || req.inventory_id,
            nomenclature_id,
            needed,
            name: parsedName
          })
        }
      }
    })

    setProcessingTasks(prev => new Set(prev).add(taskId))
    apiService.submitReserveBatch(orderId, reqList, taskId, issueMaterialsBatch).then(() => {
      setProcessingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      
      const nonPreparedMissing = missingItems.filter(item => {
        const nameLower = (item.name || item.reqDetails || '').toLowerCase()
        return !(nameLower.includes('лист') && nameLower.includes('підготовлений'))
      })
      if (nonPreparedMissing.length > 0) {
        setShortages({ orderId, orderNum, taskId, items: nonPreparedMissing, reqList })
      } else if (missingItems.length > 0) {
        // Only prepared sheets missing, wait
      } else {
        alert('Наряд повністю зарезервовано та погоджено!')
      }
    }).catch(err => {
      setProcessingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      alert('Помилка резервування: ' + err.message)
    })
  }

  const sendPurchaseRequest = async () => {
    if (!shortages || isProcessing) return
    
    const alreadySent = (purchaseRequests || []).some(
      pr => (shortages.taskId ? String(pr.task_id) === String(shortages.taskId) : String(pr.order_id) === String(shortages.orderId)) && 
            ['pending', 'accepted', 'ordered'].includes(pr.status)
    )
    if (alreadySent) {
      alert('Запит для цього наряду вже був надісланий раніше.')
      setShortages(null)
      return
    }

    setIsProcessing(true)
    try {
      const itemsToRequest = shortages.items.filter(item => {
         const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
         return !(nom && nom.name.includes('[Підготовлений]'))
      })
      
      if (itemsToRequest.length === 0) {
         alert('Усі дефіцитні позиції — це підготовлені листи. Створіть наряд на підготовку замість запиту на СВ.')
         setShortages(null)
         return
      }
      
      await apiService.submitPurchaseRequest(
        shortages.orderId,
        shortages.orderNum,
        itemsToRequest,
        shortages.taskId,
        createPurchaseRequest
      )
      
      alert('Запит на дефіцит відправлено до СВ! Ви зможете видати наряд, коли матеріали надійдуть на склад.')
      setShortages(null)
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    handleToggleCutterCheck,
    handlePrepareBox,
    handleCardScan,
    handleIssueCardMaterials,
    handleSaveConsumableQty,
    handleDeleteRequest,
    handleDeleteEntireRequest,
    handleSaveInventoryQty,
    handleAddInventory,
    handleReserveOrder,
    sendPurchaseRequest
  }
}
