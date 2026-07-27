import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useMES } from '../../../MESContext'
import { supabase, getCurrentTime } from '../../../supabase'

const cyrillicToLatinMap = {
  'й':'q', 'ц':'w', 'у':'e', 'к':'r', 'е':'t', 'н':'y', 'г':'u', 'ш':'i', 'щ':'o', 'з':'p', 'х':'[', 'ї':']',
  'ф':'a', 'ы':'s', 'і':'s', 'в':'d', 'а':'f', 'п':'g', 'р':'h', 'о':'j', 'л':'k', 'д':'l', 'ж':';', 'є':'\'',
  'я':'z', 'ч':'x', 'с':'c', 'м':'v', 'и':'b', 'т':'n', 'ь':'m', 'б':',', 'ю':'.', '.':'/',
  'Й':'Q', 'Ц':'W', 'У':'E', 'К':'R', 'Е':'T', 'Н':'Y', 'Г':'U', 'Ш':'I', 'Щ':'O', 'З':'P', 'Х':'{', 'Ї':'}',
  'Ф':'A', 'Ы':'S', 'І':'S', 'В':'D', 'А':'F', 'П':'G', 'Р':'H', 'О':'J', 'Л':'K', 'Д':'L', 'Ж':':', 'Є':'"',
  'Я':'Z', 'Ч':'X', 'С':'C', 'М':'V', 'И':'B', 'Т':'N', 'Ь':'M', 'Б':'<', 'Ю':'>', ',':'?',
  '?':'/', 'ё':'`', 'Ё':'~', '№':'#'
}

export const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

export const CHAIN = [
  'Розкрій',
  'Галтовка (Вібростіл)',
  'Галтовка (Мийка)',
  'Галтовка (Галтовка)',
  'Галтовка (Сушка)',
  'Прийомка',
  'Сортування'
]

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export function useShop1Data({
  selectedCardId,
  setSelectedCardId,
  selectedOperator,
  setSelectedOperator,
  selectedMachine,
  setSelectedMachine,
  machineNumber,
  setMachineNumber,
  selectedManager,
  setSelectedManager,
  selectedShift,
  setSelectedShift,
  setScrapOperator,
  setScrapCount,
  setReworkCount,
  setQcScrapCount,
  setQcInspector,
  setCuttersUsed,
  setCuttersBreakdown,
  setGaltPriority,
  setScanError,
  setScannedIds,
  scannedIds,
  queueSectionFilter,
  setQueueSectionFilter,
  manualId,
  setManualId,
  selectedTaskFilter,
  selectedNomFilter,
  setSelectedNomFilter,
  showAlert,
  isScanning,
  setIsScanning,
  setIsSyncing,
  setShowManualInput,
  currentTime,
  setCurrentTime
}) {
  const {
    workCards,
    nomenclatures,
    workCardHistory,
    tasks,
    orders,
    currentUser,
    machines,
    systemUsers,
    machineOperations,
    inventory,
    fetchData,
    formatUserName,
    requests
  } = useMES()

  // Auto-detect role filter when operator is selected
  useEffect(() => {
    if (!selectedOperator) return
    const lower = selectedOperator.toLowerCase()
    if (lower.includes('розкрій') || lower.includes('різальн')) {
      setQueueSectionFilter('Розкрій')
    } else if (lower.includes('галтовка') || lower.includes('галтовщ')) {
      setQueueSectionFilter('Галтовка')
    } else if (lower.includes('прийомка') || lower.includes('приймальн')) {
      setQueueSectionFilter('Прийомка')
    } else if (lower.includes('сортування') || lower.includes('сортувал')) {
      setQueueSectionFilter('Сортування')
    }
  }, [selectedOperator, setQueueSectionFilter])

  // Auto-detect role filter when currentUser is loaded
  useEffect(() => {
    if (!currentUser) return
    const pos = String(currentUser.position || '').toLowerCase()
    const name = (String(currentUser.first_name || '') + ' ' + String(currentUser.last_name || '')).toLowerCase()
    const login = String(currentUser.login || '').toLowerCase()

    if (pos.includes('сортув') || name.includes('сортув') || login.includes('sort')) {
      setQueueSectionFilter('Сортування')
    } else if (pos.includes('прийом') || name.includes('прийом') || login.includes('recept')) {
      setQueueSectionFilter('Прийомка')
    } else if (pos.includes('галтов') || name.includes('галтов') || login.includes('tumb')) {
      setQueueSectionFilter('Галтовка')
    } else if (pos.includes('розкрій') || pos.includes('різальн') || name.includes('розкрій') || login.includes('cut')) {
      setQueueSectionFilter('Розкрій')
    }
  }, [currentUser, setQueueSectionFilter])

  const getNom = (card) => nomenclatures.find(n => n.id === card?.nomenclature_id)

  const parseDBTime = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d
  }

  const getCardTimeMetrics = (card) => {
    if (!card) return { totalSec: 0, currentSec: 0 }
    const nowMs = currentTime.getTime()
    const isGaltCurrent = card.operation?.startsWith('Галтовка')

    let totalHistorySec = 0
    if (workCardHistory && workCardHistory.length > 0) {
      const cardHistory = workCardHistory.filter(h => {
        if (String(h.card_id) !== String(card.id)) return false
        if (isGaltCurrent) {
          return h.stage_name?.startsWith('Галтовка') || (h.stage_name?.startsWith('Буфер') && h.stage_name !== 'Буфер Розкрою')
        } else {
          return h.stage_name === 'Розкрій' || h.stage_name === 'Буфер Розкрою' || h.stage_name === 'Розкрій (перезмінка)'
        }
      })
      cardHistory.forEach(h => {
        if (h.started_at && h.completed_at) {
          if (String(h.stage_name).includes('пауза') || String(h.stage_name).includes('зупинка')) return
          const s = parseDBTime(h.started_at)?.getTime() || 0
          const c = parseDBTime(h.completed_at)?.getTime() || 0
          if (s && c) {
            totalHistorySec += Math.max(0, Math.floor((c - s) / 1000))
          }
        }
      })
    }

    let currentSec = 0
    if (card.status === 'in-progress') {
      const s = parseDBTime(card.started_at)?.getTime() || 0
      currentSec = s ? Math.max(0, Math.floor((nowMs - s) / 1000)) : 0
    } else if (card.status === 'at-buffer') {
      const bufferStart = card.completed_at || card.started_at
      const s = parseDBTime(bufferStart)?.getTime() || 0
      currentSec = s ? Math.max(0, Math.floor((nowMs - s) / 1000)) : 0
    }

    return { totalSec: totalHistorySec + currentSec, currentSec }
  }

  const getCuttersForCard = (card) => {
    if (!card) return []
    const task = tasks?.find(t => String(t.id) === String(card.task_id))
    const targetMachine = task?.machine_name || card.machine || ''
    
    const configuredCutters = []

    if (task && task.plan_snapshot) {
      Object.entries(task.plan_snapshot).forEach(([key, val]) => {
        const isPartEntry = !key.startsWith('_') &&
          !['materialSummary', 'selectedCutters', 'consumables'].includes(key) &&
          val && typeof val === 'object' && val.id
        const isCurrentCardPart = String(val?.id || key) === String(card.nomenclature_id)
        if (isPartEntry && isCurrentCardPart) {
          const partNomId = val.id
          const partMachine = val.selected_machine || targetMachine
          
          const opData = machineOperations?.find(o => {
            const nomIdMatch = String(o.nomenclature_id) === String(partNomId)
            if (!nomIdMatch) return false
            const cleanPartMachine = String(partMachine || '').split(' - ')[0].trim().toLowerCase()
            const cleanOpMachineType = String(o.machine_type || '').split(' - ')[0].trim().toLowerCase()
            const cleanOpMachineId = String(o.machine_id || '').split(' - ')[0].trim().toLowerCase()
            return (
              cleanOpMachineType === cleanPartMachine ||
              cleanOpMachineId === cleanPartMachine ||
              (o.machine_type && cleanPartMachine.startsWith(cleanOpMachineType)) ||
              (o.machine_id && cleanPartMachine.startsWith(cleanOpMachineId))
            )
          })
          
          if (opData && opData.side2_cut_ops) {
            const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
            cutterOps.forEach(op => {
              const parts = op.split(':')
              const cutterNomId = parts[1]
              if (cutterNomId) {
                const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
                if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
                  const genericName = cutterNom.name.trim()
                  let resolvedName = genericName
                  if (task.plan_snapshot.selectedCutters) {
                    const invId = task.plan_snapshot.selectedCutters[genericName] || task.plan_snapshot.selectedCutters[genericName.toLowerCase()]
                    if (invId) {
                      const inv = (inventory || []).find(i => String(i.id) === String(invId))
                      if (inv) {
                        const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
                        if (nom) resolvedName = nom.name.trim()
                        else if (inv.name) resolvedName = inv.name.trim()
                      }
                    }
                  }
                  if (!configuredCutters.includes(resolvedName)) {
                    configuredCutters.push(resolvedName)
                  }
                }
              }
            })
          }
        }
      })
    }

    if (configuredCutters.length === 0) {
      const opData = machineOperations?.find(o => {
        const nomIdMatch = String(o.nomenclature_id) === String(card.nomenclature_id)
        if (!nomIdMatch) return false
        const cleanTargetMachine = String(targetMachine || '').split(' - ')[0].trim().toLowerCase()
        const cleanOpMachineType = String(o.machine_type || '').split(' - ')[0].trim().toLowerCase()
        const cleanOpMachineId = String(o.machine_id || '').split(' - ')[0].trim().toLowerCase()
        return (
          cleanOpMachineType === cleanTargetMachine ||
          cleanOpMachineId === cleanTargetMachine ||
          (o.machine_type && cleanTargetMachine.startsWith(cleanOpMachineType)) ||
          (o.machine_id && cleanTargetMachine.startsWith(cleanOpMachineId))
        )
      })
      if (opData && opData.side2_cut_ops) {
        const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
        cutterOps.forEach(op => {
          const parts = op.split(':')
          const cutterNomId = parts[1]
          if (cutterNomId) {
            const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
            if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
              const genericName = cutterNom.name.trim()
              let resolvedName = genericName
              if (task?.plan_snapshot?.selectedCutters) {
                const invId = task.plan_snapshot.selectedCutters[genericName] || task.plan_snapshot.selectedCutters[genericName.toLowerCase()]
                if (invId) {
                  const inv = (inventory || []).find(i => String(i.id) === String(invId))
                  if (inv) {
                    const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
                    if (nom) resolvedName = nom.name.trim()
                    else if (inv.name) resolvedName = inv.name.trim()
                  }
                }
              }
              if (!configuredCutters.includes(resolvedName)) {
                configuredCutters.push(resolvedName)
              }
            }
          }
        })
      }
    }

    if (configuredCutters.length > 0) return configuredCutters

    if (task && task.plan_snapshot) {
      const snapshotCutters = []
      const replacedGenericNames = []
      if (task.plan_snapshot.selectedCutters && typeof task.plan_snapshot.selectedCutters === 'object') {
        Object.entries(task.plan_snapshot.selectedCutters).forEach(([genericName, invId]) => {
          if (invId) replacedGenericNames.push(genericName.trim().toLowerCase())
        })
      }
      if (Array.isArray(task.plan_snapshot.consumables)) {
        task.plan_snapshot.consumables.forEach(c => {
          if (c.name && c.name.toLowerCase().includes('фреза')) {
            const cleanName = c.name.trim()
            if (cleanName.toLowerCase() !== 'фреза') {
              if (replacedGenericNames.includes(cleanName.toLowerCase())) return
              if (!snapshotCutters.includes(cleanName)) snapshotCutters.push(cleanName)
            }
          }
        })
      }
      if (task.plan_snapshot.selectedCutters && typeof task.plan_snapshot.selectedCutters === 'object') {
        Object.values(task.plan_snapshot.selectedCutters).forEach(invId => {
          if (invId) {
            const inv = (inventory || []).find(i => String(i.id) === String(invId))
            if (inv) {
              const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id))
              const name = nom ? nom.name : inv.name
              if (name && name.toLowerCase().includes('фреза') && name.toLowerCase() !== 'фреза') {
                const cleanName = name.trim()
                if (!snapshotCutters.includes(cleanName)) snapshotCutters.push(cleanName)
              }
            }
          }
        })
      }
      if (snapshotCutters.length > 0) return snapshotCutters
    }

    const fallbackCutters = []
    if (nomenclatures) {
      nomenclatures
        .filter(n => n.type === 'consumable' && n.name.trim().toLowerCase() !== 'фреза' && n.name.toLowerCase().includes('фреза'))
        .forEach(n => {
          const cleanName = n.name.trim()
          if (!fallbackCutters.includes(cleanName)) fallbackCutters.push(cleanName)
        })
    }
    return fallbackCutters
  }

  const queueTasksOptions = useMemo(() => {
    const list = []
    const seen = new Set()
    workCards.forEach(c => {
      if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return
      const info = String(c.card_info || '')
      if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return
      
      const nom = nomenclatures?.find(n => n.id === c.nomenclature_id)
      if (nom && nom.type && nom.type !== 'part') return

      const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
      if (parentTask) {
        if (parentTask.status === 'completed') return
        if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return
      }

      const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій')
      const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation)
      const isScanned = scannedIds.includes(c.id)

      if (isNewForShop1 || isInBufferForShop1 || isScanned) {
        const order = orders?.find(o => o.id === c.order_id)
        const orderNum = order?.order_num || ''
        const batchSuffix = parentTask?.batch_index ? `/${parentTask.batch_index}` : ''
        const displayLabel = `Наряд №${orderNum}${batchSuffix}`
        const valueKey = c.task_id ? String(c.task_id) : `order-${c.order_id}`
        
        if (valueKey && !seen.has(valueKey)) {
          seen.add(valueKey)
          list.push({ value: valueKey, label: displayLabel, orderNum })
        }
      }
    })
    return list.sort((a, b) => String(a.orderNum).localeCompare(String(b.orderNum)))
  }, [workCards, nomenclatures, tasks, orders, scannedIds])

  const queueNomOptions = useMemo(() => {
    const list = []
    const seen = new Set()
    workCards.forEach(c => {
      if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return
      const info = String(c.card_info || '')
      if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return
      
      const nom = nomenclatures?.find(n => n.id === c.nomenclature_id)
      if (nom && nom.type && nom.type !== 'part') return

      const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
      if (parentTask) {
        if (parentTask.status === 'completed') return
        if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return
      }

      if (selectedTaskFilter !== 'all') {
        if (selectedTaskFilter.startsWith('order-')) {
          const orderId = selectedTaskFilter.replace('order-', '')
          if (String(c.order_id) !== orderId) return
        } else {
          if (String(c.task_id) !== selectedTaskFilter) return
        }
      }

      const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій')
      const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation)
      const isScanned = scannedIds.includes(c.id)

      if (isNewForShop1 || isInBufferForShop1 || isScanned) {
        if (nom && !seen.has(nom.id)) {
          seen.add(nom.id)
          list.push(nom)
        }
      }
    })
    return list.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [workCards, nomenclatures, tasks, selectedTaskFilter, scannedIds])

  const queueCards = useMemo(() => {
    return workCards.filter(c => {
      if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return false
      
      const info = String(c.card_info || '')
      if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false
  
      const nom = nomenclatures.find(n => n.id === c.nomenclature_id)
      if (nom && nom.type && nom.type !== 'part') return false
  
      const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
      if (parentTask) {
        if (parentTask.status === 'completed') return false
        if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false
      }
  
      const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій')
      const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation)
      const isScanned = scannedIds.includes(c.id)
  
      let matchesSection = true
      if (queueSectionFilter === 'Розкрій') {
        matchesSection = c.status === 'new' && (c.operation === 'Розкрій' || !c.operation || c.operation === 'Нова')
      } else if (queueSectionFilter === 'Галтовка') {
        matchesSection = c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation?.startsWith('Галтовка'))
      } else if (queueSectionFilter === 'Прийомка') {
        matchesSection = c.status === 'at-buffer' && c.operation === 'Прийомка'
      } else if (queueSectionFilter === 'Сортування') {
        matchesSection = c.status === 'at-buffer' && (c.operation === 'Сортування' || c.operation === 'Прийомка')
      }
  
      let matchesSearch = true
      if (manualId && manualId.trim()) {
        const q = translateCyrillic(manualId.trim()).toLowerCase()
        
        const seqMatch = (c.card_info || '').match(/(\d+)\/(\d+)/)
        const seqStr = seqMatch ? seqMatch[1] : ''
        const seqFull = seqMatch ? `${seqMatch[1]}/${seqMatch[2]}` : ''
        
        if (/^\d{1,4}$/.test(q)) {
          matchesSearch = seqStr === q
        } else if (/^\d+\/\d*$/.test(q)) {
          matchesSearch = seqFull.startsWith(q)
        } else {
          const cardInfoLower = String(c.card_info || '').toLowerCase()
          const matchesId = c.id.toLowerCase().includes(q)
          const matchesInfo = cardInfoLower.includes(q)
          const matchesNom = nom?.name.toLowerCase().includes(q)
          const matchesOrder = orders?.find(o => o.id === c.order_id)?.order_num?.toString().toLowerCase().includes(q)
          matchesSearch = matchesId || matchesInfo || matchesNom || matchesOrder
        }
      }
  
      let matchesTask = true
      if (selectedTaskFilter !== 'all') {
        if (selectedTaskFilter.startsWith('order-')) {
          const orderId = selectedTaskFilter.replace('order-', '')
          matchesTask = String(c.order_id) === orderId
        } else {
          matchesTask = String(c.task_id) === selectedTaskFilter
        }
      }
  
      let matchesNom = true
      if (selectedNomFilter !== 'all') {
        matchesNom = String(c.nomenclature_id) === selectedNomFilter
      }
  
      return (isNewForShop1 || isInBufferForShop1 || isScanned) && matchesSection && matchesSearch && matchesTask && matchesNom
    }).sort((a, b) => {
      const aIsGaltBuf = a.status === 'at-buffer' && a.operation === 'Розкрій'
      const bIsGaltBuf = b.status === 'at-buffer' && b.operation === 'Розкрій'
  
      if (aIsGaltBuf && bIsGaltBuf) {
        const aPri = a.galt_priority || 2
        const bPri = b.galt_priority || 2
        if (aPri !== bPri) return aPri - bPri
      } else if (aIsGaltBuf) {
        return -1
      } else if (bIsGaltBuf) {
        return 1
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }, [workCards, nomenclatures, tasks, selectedTaskFilter, selectedNomFilter, queueSectionFilter, manualId, scannedIds, orders])

  const checkCardMaterials = (card) => {
    if (!card) return false
    if (card.status !== 'waiting_material') return false

    const pendingReqs = (requests || []).filter(r => 
      (String(r.card_id) === String(card.id) || String(r.task_id) === String(card.task_id)) && 
      r.status === 'pending'
    )
    if (pendingReqs.length > 0) {
      const materialList = pendingReqs.map((r, idx) => {
        return `${idx + 1}. ${r.details || 'Матеріали'}`
      }).join('\n')
      showAlert(
        `Дана картка очікує забезпечення матеріалами від складу:\n\n${materialList}\n\nБудь ласка, зверніться до працівника складу для підтвердження видачі перед початком роботи.`,
        `⏳ Очікування забезпечення матеріалів`
      )
      return true
    }
    return false
  }

  return {
    queueTasksOptions,
    queueNomOptions,
    queueCards,
    getNom,
    parseDBTime,
    getCardTimeMetrics,
    getCuttersForCard,
    checkCardMaterials,
    // MES contexts exposed
    workCards,
    nomenclatures,
    workCardHistory,
    tasks,
    orders,
    currentUser,
    machines,
    systemUsers,
    machineOperations,
    inventory,
    fetchData,
    formatUserName,
    requests
  }
}
