import { useMemo } from 'react'

export const normalize = (s) => (s || '').toLowerCase().trim()
  .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
  .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
  .replace(/[хx]/g, 'x')
  .replace(/[іi]/g, 'i')
  .replace(/[уy]/g, 'y')
  .replace(/[кk]/g, 'k')
  .replace(/[мm]/g, 'm')
  .replace(/[нn]/g, 'n')
  .replace(/[вv]/g, 'v')
  .replace(/[и]/g, 'y')
  .replace(/[зz]/g, 'z')
  .replace(/\s/g, '')

export const parseMaterialName = (details) => {
  if (!details) return ''
  if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
    const match = details.match(/:\s*(.+)\s*—/)
    return match ? match[1].trim() : details
  }
  return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
}

export const isPrepRequest = (r, tasks) => {
  if (r.details && (r.details.includes('ПІДГОТОВ') || r.details.includes('ЗАПИТ НА ПІДГОТОВКУ'))) return true
  if (r.task_id) {
    const task = (tasks || []).find(t => t.id === r.task_id)
    if (task && task.step === 'Підготовка') return true
  }
  return false
}

export const getMaterialType = (r, nomenclatures, inventory) => {
  // Packaging requests are displayed in the Finished Goods queue regardless
  // of the physical warehouse from which an item will be issued. The issuing
  // logic separately chooses SO for consumables and BZ/SGP for components.
  if (r.details && (r.details.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') || r.details.includes('ПАКУВАННЯ'))) {
    return 'finished'
  }

  const parsedName = parseMaterialName(r.details)
  const nameLower = parsedName.toLowerCase()
  const nom = r.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(r.nomenclature_id)) : null
  
  if (nom?.type === 'part') return 'finished'
  if (nom?.type === 'product') return 'finished'

  const isSgp = (
    nameLower.startsWith('іп-') || 
    nameLower.startsWith('ip-') || 
    nameLower.startsWith('kr-') || 
    nameLower.startsWith('kh-') || 
    (nameLower.includes('іп') && !nameLower.includes('кріплення') && !nameLower.includes('друк') && !nameLower.includes('3д')) ||
    nameLower.includes('ip')
  )
  if (isSgp) {
    return 'finished'
  }
  
  return 'raw'
}

export const useWarehouseComputed = ({
  inventory,
  requests,
  nomenclatures,
  receptionDocs,
  tasks,
  workCards,
  machineOperations,
  activeTab,
  searchQuery,
  selectedPocketOwner
}) => {
  const cardsWithBoxes = useMemo(() => {
    const list = []
    const activeCards = (workCards || []).filter(c => 
      (c.status === 'new' || c.status === 'waiting-materials') && 
      (!c.operation || c.operation === 'Нова' || c.operation === 'Розкрій')
    )
    
    activeCards.forEach(card => {
      const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
      if (!nom) return

      const task = (tasks || []).find(t => t.id === card.task_id)
      if (!task) return
      if (task.step !== 'Розкрій' && task.step !== 'Підготовка') return

      const cardMac = card.machine || card.machine_name
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
      const opType = resolveMachineType(cardMac)
      const ops = (machineOperations || []).find(o => 
        String(o.nomenclature_id) === String(card.nomenclature_id) && 
        (normalize(o.machine_type) === normalize(opType) || String(o.machine_id) === String(cardMac))
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

      if (Object.keys(cuttersRates).length === 0) return

      const unitsPerSheet = Number(nom.units_per_sheet) || 1
      const cardSheets = Math.ceil(Number(card.quantity) / unitsPerSheet)
      const getDisplayMaterial = (partNom, snapshot) => {
        const baseMat = partNom?.material_type || '—'
        if (!snapshot) return baseMat
        const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
        const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0
        
        const hasT300 = (baseMat || '').toLowerCase().includes('т300') || (baseMat || '').toLowerCase().includes('t300')
        const hasT700 = (baseMat || '').toLowerCase().includes('т700') || (baseMat || '').toLowerCase().includes('t700')

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
        }
        return baseMat
      }
      const snapshotPart = task?.plan_snapshot?.[card.nomenclature_id]
      const activeMaterialName = getDisplayMaterial(nom, snapshotPart)

      const preparedCutters = []
      for (const [cNomId, rate] of Object.entries(cuttersRates)) {
        const cNom = nomenclatures.find(n => n.id === cNomId)
        let cutterName = cNom?.name || 'Фреза'
        let finalNomId = cNomId

        const getCutterSignature = (name) => {
          if (!name) return null
          const clean = name.toLowerCase().replace(/,/g, '.')
          const exactMatch = clean.match(/(?:фреза|ф|d|d=|діаметр|діаметром)?\s*([0-9]+(?:[.,][0-9]+)?)/)
          if (!exactMatch) return null
          const angleMatch = clean.match(/(?:\(|x|х|×|\s)(90|120)\s*(?:°|град|\))/)
          return {
            diameter: parseFloat(exactMatch[1]),
            angle: angleMatch ? Number(angleMatch[1]) : null
          }
        }

        // The warehouse choice saved with the task is authoritative. This is
        // important for cutters with the same diameter but different angles.
        const selectedInvId = task?.plan_snapshot?.selectedCutters?.[cNom?.name] ||
          task?.plan_snapshot?.selectedCutters?.[cNom?.name?.toLowerCase()]
        const selectedInv = selectedInvId
          ? (inventory || []).find(i => String(i.id) === String(selectedInvId))
          : null
        const selectedNom = selectedInv
          ? nomenclatures.find(n => String(n.id) === String(selectedInv.nomenclature_id))
          : null

        if (selectedNom) {
          cutterName = selectedNom.name
          finalNomId = selectedNom.id
        } else {
          const targetSignature = getCutterSignature(cNom?.name)
          if (targetSignature !== null) {
            const exactReq = (requests || []).find(r => {
              if (String(r.task_id || r.order_id) !== String(card.task_id || card.order_id)) return false
              const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
              const rName = rNom ? rNom.name : (r.details || '')
              const requestSignature = getCutterSignature(rName)
              if (!requestSignature || requestSignature.diameter !== targetSignature.diameter) return false
              return targetSignature.angle === null || requestSignature.angle === targetSignature.angle
            })

            if (exactReq) {
              const exactNom = nomenclatures.find(n => n.id === exactReq.nomenclature_id)
              if (exactNom) {
                cutterName = exactNom.name
                finalNomId = exactNom.id
              }
            }
          }
        }

        preparedCutters.push({
          nomenclature_id: finalNomId,
          name: cutterName,
          qty: Math.ceil(rate * cardSheets)
        })
      }

      list.push({
        card,
        nom,
        task,
        cardSheets,
        activeMaterialName,
        cutters: preparedCutters,
        isPrepared: (card.card_info || '').includes('[BOX_PREPARED:true]')
      })
    })

    return list
  }, [workCards, tasks, nomenclatures, machineOperations, requests, inventory])

  const filteredInventory = useMemo(() => {
    return (inventory || []).filter(i => {
      const normName = (i.name || '').toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '')
      const normSearch = searchQuery.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '')
      const matchesSearch = normName.includes(normSearch)
      
      if (activeTab === 'pocket') {
        const matchesOwner = !selectedPocketOwner || i.pocket_owner === selectedPocketOwner
        return i.warehouse === 'pocket' && matchesSearch && matchesOwner
      }

      const isOperational = i.warehouse === 'operational' || !i.warehouse
      if (!isOperational) return false

      const nomenclature = (nomenclatures || []).find(n => String(n.id) === String(i.nomenclature_id))
      const itemName = i.name || nomenclature?.name || ''
      const isSheet = /(?:^|\s)лист(?:\s|$)/i.test(itemName)
      if ((Number(i.total_qty) || 0) <= 0 && !isSheet) return false

      const itemType = i.type || 'raw'

      if (activeTab === 'bz') return itemType === 'bz' && matchesSearch
      if (activeTab === 'scrap') return itemType.startsWith('scrap') && matchesSearch
      
      if (activeTab === 'raw') {
        return (itemType === 'raw' || itemType === 'consumable' || itemType === 'hardware') && matchesSearch
      }
      if (activeTab === 'semi') {
        return (itemType === 'semi' || itemType === 'part') && matchesSearch
      }
      if (activeTab === 'finished') {
        return (itemType === 'finished' || itemType === 'product') && matchesSearch
      }

      return itemType === activeTab && matchesSearch
    })
  }, [inventory, activeTab, searchQuery, selectedPocketOwner])

  const groupedPocketInventory = useMemo(() => {
    if (activeTab !== 'pocket') return {}
    return filteredInventory.reduce((acc, item) => {
      const owner = item.pocket_owner || 'Не визначено'
      if (!acc[owner]) acc[owner] = []
      acc[owner].push(item)
      return acc
    }, {})
  }, [filteredInventory, activeTab])

  const pendingRequests = useMemo(() => {
    return (requests || []).filter(r => {
      if (r.status !== 'pending' && r.status !== 'issued') return false
      if (r.card_id) {
        const card = (workCards || []).find(c => String(c.id) === String(r.card_id))
        const isReissue = !!card && (card.is_rework || String(card.card_info || '').includes('[REDO]'))
        const isMachineChange = String(r.details || '').includes('[BALANCED_MACHINE_CHANGE]')
        // Initial work cards belong to the one consolidated task request.
        // Only explicit reissues and machine changes get their own warehouse tile.
        if (!isReissue && !isMachineChange) return false
      }
      if (r.status === 'issued') {
        const task = tasks.find(t => t.id === r.task_id)
        if (!task || task.warehouse_conf === 'true' || task.warehouse_conf === 'partial') return false
      }
      if (isPrepRequest(r, tasks)) return false
      return getMaterialType(r, nomenclatures, inventory) === activeTab
    })
  }, [requests, tasks, nomenclatures, inventory, workCards, activeTab])

  const groupedRequests = useMemo(() => {
    return pendingRequests.reduce((acc, req) => {
      const key = req.card_id
        ? `card-${req.card_id}`
        : (req.task_id || `order-${req.order_id}`)
      if (!acc[key]) acc[key] = []
      acc[key].push(req)
      return acc
    }, {})
  }, [pendingRequests])

  return {
    cardsWithBoxes,
    filteredInventory,
    groupedPocketInventory,
    pendingRequests,
    groupedRequests
  }
}
