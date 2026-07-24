import { useMemo, useState } from 'react'
import { supabase } from '../../../../supabase.js'

const CLOSED_REQUEST_STATUSES = new Set(['completed', 'cancelled', 'rejected'])

const canCorrectMaterial = user => {
  const position = String(user?.position || '').toLocaleLowerCase('uk')
  return user?.role === 'admin' ||
    position.includes('адмін') ||
    position.includes('начальник цеху') ||
    user?.access_rights?.shop1_foreman === true
}

const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, '')

const isSheetMaterial = nom => {
  const text = normalize(`${nom?.name || ''} ${nom?.material_type || ''}`)
  const isPrepared = text.includes('[підготовлений]') || (
    text.includes('підготовлений') && !text.includes('непідготовлений')
  )
  return (nom?.type === 'raw' || nom?.type === 'material') &&
    isPrepared &&
    (text.includes('лист') || text.includes('sheet')) &&
    /[тt]\s*(?:300|700)/i.test(text)
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
    return nomenclatures
      .filter(isSheetMaterial)
      .filter(nom => !currentThickness || getThickness(`${nom.name} ${nom.material_type}`) === currentThickness)
      .map(nom => {
        const inv = inventory.find(row =>
          String(row.nomenclature_id) === String(nom.id) && row.warehouse === 'operational'
        ) || inventory.find(row => String(row.nomenclature_id) === String(nom.id))
        return { ...nom, inventory_id: inv?.id || null, available: Number(inv?.quantity) || 0 }
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'uk'))
  }, [part, nomenclatures, inventory])

  const open = (nextTask, nextPart) => {
    setError(null)
    if (!canCorrect) {
      window.alert('Виправляти матеріал може адміністратор або начальник цеху №1.')
      return
    }
    if ((nextPart?.productionCards || []).length > 0) {
      window.alert('По цій деталі вже згенеровані робочі картки. Спочатку безпечно скасуйте незапущені картки; запущене виробництво змінювати не можна.')
      return
    }
    setTask(nextTask)
    setPart(nextPart)
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
    const sheetQty = Math.max(0, Number(partSnapshot.sheets) || Number(part.plannedSheets) || 0)
    const oldMaterial = partSnapshot.material || part.material || ''
    const newIsT700 = /[тt]\s*700/i.test(`${material.name} ${material.material_type || ''}`)

    partSnapshot.material = material.name
    partSnapshot.sheets_t300 = newIsT700 ? 0 : sheetQty
    partSnapshot.sheets_t700 = newIsT700 ? sheetQty : 0
    snapshot[partKey] = partSnapshot

    const summary = { ...(snapshot.materialSummary || {}) }
    const oldEntryPair = Object.entries(summary).find(([, entry]) =>
      mentionsPart(entry, part) && /[тt]\s*(?:300|700)|лист|sheet/i.test(entry?.matName || '')
    )
    const oldKey = oldEntryPair?.[0]
    const oldEntry = oldEntryPair?.[1]
    const componentIndex = oldEntry?.components?.findIndex(component => normalize(component).includes(normalize(part.name))) ?? -1
    const movedComponent = componentIndex >= 0 ? oldEntry.components[componentIndex] : `${part.name}: ${part.plan}шт`

    if (oldEntry && oldKey) {
      const remainingComponents = oldEntry.components.filter((_, index) => index !== componentIndex)
      const remainingSheets = Math.max(0, (Number(oldEntry.sheets) || 0) - sheetQty)
      if (remainingSheets === 0 || remainingComponents.length === 0) delete summary[oldKey]
      else summary[oldKey] = { ...oldEntry, sheets: remainingSheets, components: remainingComponents }
    }

    const newKey = String(material.id)
    const existingNew = summary[newKey]
    summary[newKey] = {
      ...(existingNew || {}),
      matName: material.name,
      sheets: (Number(existingNew?.sheets) || 0) + sheetQty,
      totalUnits: (Number(existingNew?.totalUnits) || 0) + (Number(part.plan) || 0),
      components: [...(existingNew?.components || []), movedComponent],
      inventory_id: material.inventory_id,
      nomenclature_id: material.id,
      unit: 'ЛИСТІВ',
      partType: material.type || 'raw'
    }
    snapshot.materialSummary = summary

    const requestBackups = []
    const insertedIds = []
    try {
      const { data: requests, error: requestReadError } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', task.id)
      if (requestReadError) throw requestReadError

      const oldRequest = (requests || []).find(request =>
        !request.card_id &&
        !CLOSED_REQUEST_STATUSES.has(request.status) &&
        oldEntry?.nomenclature_id &&
        String(request.nomenclature_id) === String(oldEntry.nomenclature_id)
      )

      if (oldRequest) {
        requestBackups.push(oldRequest)
        const oldEntrySheets = Number(oldEntry?.sheets) || Number(oldRequest.quantity) || 0
        if (oldEntrySheets <= sheetQty) {
          const { error: updateError } = await supabase.from('material_requests').update({
            nomenclature_id: material.id,
            inventory_id: material.inventory_id,
            quantity: sheetQty,
            details: `ВИПРАВЛЕНО В НАРЯДІ: ${oldMaterial} → ${material.name} — ${sheetQty} л.`
          }).eq('id', oldRequest.id)
          if (updateError) throw updateError
        } else {
          const { error: reduceError } = await supabase.from('material_requests')
            .update({ quantity: Math.max(0, Number(oldRequest.quantity) - sheetQty) })
            .eq('id', oldRequest.id)
          if (reduceError) throw reduceError
          const { data: inserted, error: insertError } = await supabase.from('material_requests').insert({
            order_id: task.order_id,
            task_id: task.id,
            quantity: sheetQty,
            status: 'pending',
            inventory_id: material.inventory_id,
            nomenclature_id: material.id,
            details: `ВИПРАВЛЕНО В НАРЯДІ: ${oldMaterial} → ${material.name} — ${sheetQty} л.`
          }).select('id').single()
          if (insertError) throw insertError
          insertedIds.push(inserted.id)
        }
      } else {
        const { data: inserted, error: insertError } = await supabase.from('material_requests').insert({
          order_id: task.order_id,
          task_id: task.id,
          quantity: sheetQty,
          status: 'pending',
          inventory_id: material.inventory_id,
          nomenclature_id: material.id,
          details: `ВИПРАВЛЕНО В НАРЯДІ: ${oldMaterial} → ${material.name} — ${sheetQty} л.`
        }).select('id').single()
        if (insertError) throw insertError
        insertedIds.push(inserted.id)
      }

      const { error: taskError } = await supabase.from('tasks').update({ plan_snapshot: snapshot }).eq('id', task.id)
      if (taskError) throw taskError

      await fetchData?.(['tasks', 'material_requests', 'inventory'])
      await onCorrected?.()
      close()
    } catch (saveError) {
      for (const backup of requestBackups) {
        await supabase.from('material_requests').update({
          nomenclature_id: backup.nomenclature_id,
          inventory_id: backup.inventory_id,
          quantity: backup.quantity,
          details: backup.details
        }).eq('id', backup.id)
      }
      if (insertedIds.length > 0) await supabase.from('material_requests').delete().in('id', insertedIds)
      setError(saveError.message || 'Не вдалося виправити матеріал.')
    } finally {
      setIsSaving(false)
    }
  }

  return { canCorrect, part, task, materialOptions, isSaving, error, open, close, save }
}
