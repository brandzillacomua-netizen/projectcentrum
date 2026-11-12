import { useMemo, useState } from 'react'
import { supabase } from '../../../../supabase.js'
import { calculateGeneratedSheetTotal } from '../shortage/shortageCalculations.js'
import { isSafeCardToDelete } from '../admin-card-delete/useAdminCardDelete.js'

const CLOSED_REQUEST_STATUSES = new Set(['completed', 'cancelled', 'rejected'])
const OPTIONAL_CARD_LINKED_TABLES = ['scrap_classifications', 'material_requests', 'work_card_history']

const isMissingOptionalRelation = (error) => {
  const message = String(error?.message || error?.details || '')
  return /does not exist|schema cache|Could not find|column .* does not exist/i.test(message)
}

export const analyzePartCardsForCorrection = (targetPart) => {
  const cards = targetPart?.productionCards || []
  const safeNewCards = cards.filter(isSafeCardToDelete)
  const activeLockedCards = cards.filter(card => !isSafeCardToDelete(card))
  const totalPlannedSheets = Math.max(0, Number(targetPart?.plannedSheets) || 0)
  const usedSheets = calculateGeneratedSheetTotal(
    activeLockedCards,
    Number(targetPart?.unitsPerSheet) || 1,
    totalPlannedSheets
  )
  const remainingSheets = Math.max(0, totalPlannedSheets - usedSheets)
  return { safeNewCards, activeLockedCards, totalPlannedSheets, usedSheets, remainingSheets }
}

const canCorrectMaterial = user => {
  const position = String(user?.position || '').toLocaleLowerCase('uk')
  return user?.role === 'admin' ||
    position.includes('адмін') ||
    position.includes('начальник цеху') ||
    user?.access_rights?.shop1_foreman === true
}

const normalize = value => String(value || '').toLowerCase().trim()
  .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
  .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
  .replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[кk]/g, 'k')
  .replace(/[мm]/g, 'm').replace(/\s+/g, '')

export const extractRequestMaterialName = (details) => {
  const text = String(details || '')
  if (!text) return ''
  const afterColon = text.includes(': ') ? text.split(': ').slice(1).join(': ') : text
  const beforeDash = afterColon.split(' — ')[0]?.trim() || afterColon.trim()
  if (beforeDash.includes('→')) {
    return beforeDash.split('→').pop()?.trim() || beforeDash
  }
  return beforeDash
}

export const findMatchingOldRequests = ({ requests = [], oldEntry = null, oldKey = '', oldMaterial = '', nomenclatures = [] }) => {
  const oldNomIds = new Set()
  if (oldEntry?.nomenclature_id) oldNomIds.add(String(oldEntry.nomenclature_id))
  if (oldKey && !String(oldKey).startsWith('virtual-')) {
    const strippedKey = String(oldKey).replace(/-[тt](?:300|700)$/i, '')
    if (strippedKey) oldNomIds.add(strippedKey)
  }

  const oldMatNorm = normalize(oldEntry?.matName || oldMaterial)
  for (const nom of nomenclatures || []) {
    const nomId = String(nom?.id || '')
    const legacyList = (nom?.legacy_ids || []).map(String)
    const idOverlap = (nomId && oldNomIds.has(nomId)) || legacyList.some(id => oldNomIds.has(id))
    const nameMatch = Boolean(oldMatNorm && normalize(nom?.name) === oldMatNorm)
    if (idOverlap || nameMatch) {
      if (nomId) oldNomIds.add(nomId)
      legacyList.forEach(id => oldNomIds.add(id))
    }
  }

  const oldInvId = oldEntry?.inventory_id ? String(oldEntry.inventory_id) : null

  const statusPriority = (status) => (status === 'pending' ? 0 : status === 'issued' ? 2 : 1)

  return (requests || [])
    .filter(request => {
      if (!request || request.card_id || CLOSED_REQUEST_STATUSES.has(request.status)) return false
      if (request.nomenclature_id && oldNomIds.has(String(request.nomenclature_id))) return true
      if (oldInvId && request.inventory_id && String(request.inventory_id) === oldInvId) return true
      if (oldMatNorm) {
        const reqMatNorm = normalize(extractRequestMaterialName(request.details))
        if (reqMatNorm && reqMatNorm === oldMatNorm) return true
      }
      return false
    })
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status))
}

export const isSheetMaterial = nom => {
  const rawText = `${nom?.name || ''} ${nom?.material_type || ''} ${nom?.characteristic || ''}`.toLowerCase()
  if (rawText.includes('непідготовлений')) return false
  const excludedTypes = new Set(['part', 'product', 'hardware', 'fg'])
  if (nom?.type && excludedTypes.has(String(nom.type).toLowerCase())) return false
  return (rawText.includes('лист') || rawText.includes('sheet')) &&
    /[тt]\s*(?:300|700)/i.test(rawText)
}

export const getOperationalStockForNom = (nom, inventory = []) => {
  const idSet = new Set([String(nom?.id || '')].filter(Boolean))
  ;(nom?.legacy_ids || []).forEach(id => {
    if (id != null && id !== '') idSet.add(String(id))
  })
  const normName = normalize(nom?.name)
  const matchingRows = (inventory || []).filter(row => {
    if (!row || row.warehouse !== 'operational') return false
    if (row.nomenclature_id && idSet.has(String(row.nomenclature_id))) return true
    if (normName && normalize(row.name) === normName) return true
    return false
  })
  const available = matchingRows.reduce(
    (sum, row) => sum + Math.max(0, (Number(row.total_qty) ?? Number(row.quantity) ?? 0) - (Number(row.reserved_qty) || 0)),
    0
  )
  return {
    inventory_id: matchingRows[0]?.id || null,
    available
  }
}

const getThickness = value => {
  const text = String(value || '').toLowerCase()
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*мм/)
  return match ? match[1].replace(',', '.') : ''
}

const mentionsPart = (entry, part) => {
  const partName = normalize(part?.name)
  return (entry?.components || []).some(component => normalize(component).includes(partName))
}

export function useMaterialCorrection({ currentUser, nomenclatures = [], inventory = [], fetchData, onCorrected } = {}) {
  const [part, setPart] = useState(null)
  const [task, setTask] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const canCorrect = canCorrectMaterial(currentUser)

  const materialOptions = useMemo(() => {
    if (!part) return []
    const currentThickness = getThickness(part.material)
    const allSheets = nomenclatures.filter(isSheetMaterial)
    const sameThickness = currentThickness
      ? allSheets.filter(nom => getThickness(`${nom.name} ${nom.material_type || ''} ${nom.characteristic || ''}`) === currentThickness)
      : allSheets
    const candidates = sameThickness.length > 0 ? sameThickness : allSheets
    return candidates
      .map(nom => {
        const stock = getOperationalStockForNom(nom, inventory)
        return { ...nom, inventory_id: stock.inventory_id, available: stock.available }
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'uk'))
  }, [part, nomenclatures, inventory])

  const open = (nextTask, nextPart) => {
    setError(null)
    if (!canCorrect) {
      window.alert('Виправляти матеріал може адміністратор або начальник цеху №1.')
      return
    }
    const analysis = analyzePartCardsForCorrection(nextPart)
    if (analysis.remainingSheets <= 0 && analysis.safeNewCards.length === 0) {
      window.alert('По цій деталі весь плановий обсяг уже запущено в роботу або виконано — змінювати матеріал на залишок неможливо.')
      return
    }
    setTask(nextTask)
    setPart({ ...nextPart, correctionAnalysis: analysis })
  }

  const close = () => {
    if (isSaving) return
    setPart(null)
    setTask(null)
    setError(null)
  }

  const save = async material => {
    if (!task || !part || !material) return
    setIsSaving(true)
    setError(null)

    const originalSnapshot = task.plan_snapshot || {}
    const snapshot = structuredClone(originalSnapshot)
    const partKey = String(part.nomId)
    const partSnapshot = { ...(snapshot[partKey] || {}) }
    const analysis = part.correctionAnalysis || analyzePartCardsForCorrection(part)
    const totalSheets = Math.max(0, Number(partSnapshot.sheets) || analysis.totalPlannedSheets || Number(part.plannedSheets) || 0)
    const usedSheets = Math.min(totalSheets, analysis.usedSheets)
    const sheetQty = Math.max(0, totalSheets - usedSheets)
    if (sheetQty <= 0) {
      setError('Немає залишку листів для заміни матеріалу.')
      setIsSaving(false)
      return
    }
    const oldMaterial = partSnapshot.material || part.material || ''
    const oldIsT700 = /[тt]\s*700/i.test(oldMaterial)
    const newIsT700 = /[тt]\s*700/i.test(`${material.name} ${material.material_type || ''}`)

    partSnapshot.material = material.name
    partSnapshot.sheets_t300 = (newIsT700 ? 0 : sheetQty) + (usedSheets > 0 && !oldIsT700 ? usedSheets : 0)
    partSnapshot.sheets_t700 = (newIsT700 ? sheetQty : 0) + (usedSheets > 0 && oldIsT700 ? usedSheets : 0)
    snapshot[partKey] = partSnapshot

    const summary = { ...(snapshot.materialSummary || {}) }
    const oldEntryPair = Object.entries(summary).find(([, entry]) =>
      mentionsPart(entry, part) && /[тt]\s*(?:300|700)|лист|sheet/i.test(entry?.matName || '')
    )
    const oldKey = oldEntryPair?.[0]
    const oldEntry = oldEntryPair?.[1]
    const componentIndex = oldEntry?.components?.findIndex(component => normalize(component).includes(normalize(part.name))) ?? -1
    const movedComponent = usedSheets > 0
      ? `${part.name}: залишок ${sheetQty} л.`
      : (componentIndex >= 0 ? oldEntry.components[componentIndex] : `${part.name}: ${part.plan}шт`)

    if (oldEntry && oldKey) {
      const remainingSheetsInOld = Math.max(0, (Number(oldEntry.sheets) || 0) - sheetQty)
      const nextComponents = usedSheets > 0
        ? (oldEntry.components || []).map((comp, index) =>
            index === componentIndex ? `${part.name}: в роботі ${usedSheets} л.` : comp
          )
        : (oldEntry.components || []).filter((_, index) => index !== componentIndex)
      if (remainingSheetsInOld === 0 || nextComponents.length === 0) delete summary[oldKey]
      else summary[oldKey] = { ...oldEntry, sheets: remainingSheetsInOld, components: nextComponents }
    }

    const newKey = String(material.id)
    const existingNew = summary[newKey]
    const movedUnits = totalSheets > 0
      ? Math.round((Number(part.plan) || 0) * (sheetQty / totalSheets))
      : (Number(part.plan) || 0)
    summary[newKey] = {
      ...(existingNew || {}),
      matName: material.name,
      sheets: (Number(existingNew?.sheets) || 0) + sheetQty,
      totalUnits: (Number(existingNew?.totalUnits) || 0) + movedUnits,
      components: [...(existingNew?.components || []), movedComponent],
      inventory_id: material.inventory_id,
      nomenclature_id: material.id,
      unit: 'ЛИСТІВ',
      partType: material.type || 'raw'
    }
    snapshot.materialSummary = summary

    const requestBackups = []
    const insertedIds = []
    const inventoryBackups = new Map()
    try {
      // 1. Safely delete any unstarted (`new` / `waiting-*`) cards for this part
      const safeIds = (analysis.safeNewCards || []).map(c => c.id).filter(Boolean)
      if (safeIds.length > 0) {
        for (const table of OPTIONAL_CARD_LINKED_TABLES) {
          const { error: relErr } = await supabase.from(table).delete().in('card_id', safeIds)
          if (relErr && !isMissingOptionalRelation(relErr)) throw relErr
        }
        const { error: delCardsErr } = await supabase.from('work_cards').delete().in('id', safeIds)
        if (delCardsErr) throw delCardsErr
      }

      const requestQuery = supabase.from('material_requests').select('*')
      const { data: requests, error: requestReadError } = task.order_id
        ? await requestQuery.or(`task_id.eq.${task.id},and(task_id.is.null,order_id.eq.${task.order_id})`)
        : await requestQuery.eq('task_id', task.id)
      if (requestReadError) throw requestReadError

      const matchingOldRequests = findMatchingOldRequests({
        requests,
        oldEntry,
        oldKey,
        oldMaterial,
        nomenclatures
      })

      const releaseIssuedInventory = async (invId, qtyToRelease) => {
        if (!invId || qtyToRelease <= 0) return
        const key = String(invId)
        let currentInv = inventoryBackups.get(key)
        if (!currentInv) {
          const { data: fetchedInv, error: inventoryError } = await supabase
            .from('inventory')
            .select('id,total_qty,reserved_qty')
            .eq('id', invId)
            .maybeSingle()
          if (inventoryError) throw inventoryError
          if (!fetchedInv) return
          inventoryBackups.set(key, fetchedInv)
          currentInv = fetchedInv
        }
        const nextReserved = Math.max(0, (Number(currentInv.reserved_qty) || 0) - qtyToRelease)
        const { error: releaseError } = await supabase
          .from('inventory')
          .update({ reserved_qty: nextReserved })
          .eq('id', currentInv.id)
        if (releaseError) throw releaseError
        inventoryBackups.set(key, { ...currentInv, reserved_qty: nextReserved })
      }

      const correctionDetails = `ВИПРАВЛЕНО В НАРЯДІ: ${oldMaterial} → ${material.name} — ${sheetQty} л. [MATERIAL_CORRECTION:${part.nomId}]`
      const targetTaskId = matchingOldRequests[0] ? matchingOldRequests[0].task_id : task.id

      if (matchingOldRequests.length === 1 && (Number(matchingOldRequests[0].quantity) || 0) <= sheetQty) {
        const singleOld = matchingOldRequests[0]
        requestBackups.push(singleOld)
        if (singleOld.status === 'issued') {
          await releaseIssuedInventory(singleOld.inventory_id, Math.min(sheetQty, Number(singleOld.quantity) || 0))
        }
        const { error: updateError } = await supabase.from('material_requests').update({
          nomenclature_id: material.id,
          inventory_id: material.inventory_id,
          quantity: sheetQty,
          status: 'pending',
          category: 'sheet',
          target_warehouse: 'operational',
          details: correctionDetails
        }).eq('id', singleOld.id)
        if (updateError) throw updateError
      } else {
        let remainingToTransfer = sheetQty
        for (const oldReq of matchingOldRequests) {
          if (remainingToTransfer <= 0) break
          const oldReqQty = Number(oldReq.quantity) || 0
          const take = Math.min(oldReqQty, remainingToTransfer)
          if (take <= 0) continue

          requestBackups.push(oldReq)
          if (oldReq.status === 'issued') {
            await releaseIssuedInventory(oldReq.inventory_id, take)
          }

          const leftQty = Math.max(0, oldReqQty - take)
          const patch = leftQty === 0
            ? { quantity: 0, status: 'cancelled' }
            : { quantity: leftQty }
          const { error: reduceError } = await supabase
            .from('material_requests')
            .update(patch)
            .eq('id', oldReq.id)
          if (reduceError) throw reduceError

          remainingToTransfer -= take
        }

        const { data: inserted, error: insertError } = await supabase.from('material_requests').insert({
          order_id: task.order_id,
          task_id: targetTaskId,
          quantity: sheetQty,
          status: 'pending',
          inventory_id: material.inventory_id,
          nomenclature_id: material.id,
          category: 'sheet',
          target_warehouse: 'operational',
          details: correctionDetails
        }).select('id').single()
        if (insertError) throw insertError
        insertedIds.push(inserted.id)
      }

      const { error: taskError } = await supabase.from('tasks').update({ plan_snapshot: snapshot }).eq('id', task.id)
      if (taskError) throw taskError

      await fetchData?.(['tasks', 'work_cards', 'material_requests', 'inventory'])
      await onCorrected?.()
      close()
    } catch (saveError) {
      for (const backup of requestBackups) {
        await supabase.from('material_requests').update({
          nomenclature_id: backup.nomenclature_id,
          inventory_id: backup.inventory_id,
          quantity: backup.quantity,
          status: backup.status,
          details: backup.details
        }).eq('id', backup.id)
      }
      if (insertedIds.length > 0) await supabase.from('material_requests').delete().in('id', insertedIds)
      for (const backup of inventoryBackups.values()) {
        await supabase.from('inventory').update({ reserved_qty: backup.reserved_qty }).eq('id', backup.id)
      }
      setError(saveError.message || 'Не вдалося виправити матеріал.')
    } finally {
      setIsSaving(false)
    }
  }

  return { canCorrect, part, task, materialOptions, isSaving, error, open, close, save }
}
