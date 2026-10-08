import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

export function usePrepOrder(nomenclatures, fetchData) {
  const [showPrepModal, setShowPrepModal] = useState(false)
  const [prepQuantities, setPrepQuantities] = useState({})
  const [prepDeadline, setPrepDeadline] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (showPrepModal && typeof fetchData === 'function') {
      fetchData(['inventory'])
    }
  }, [showPrepModal, fetchData])

  const handleCreatePrepOrder = async () => {
    const itemsToCreate = Object.entries(prepQuantities).filter(([_, qty]) => Number(qty) > 0)
    if (itemsToCreate.length === 0) return alert('Введіть кількість хоча б для одного листа!')

    setIsSubmitting(true)
    try {
      const planSnapshot = {}
      let totalSheets = 0
      for (const [materialId, qty] of itemsToCreate) {
        const nom = (nomenclatures || []).find(n => String(n.id) === String(materialId))
        planSnapshot[materialId] = {
          name: nom?.name || 'Лист',
          need: qty,
          stock: 0,
          plan: qty
        }
        totalSheets += Number(qty)
      }

      const { count, error: countErr } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('step', 'Підготовка')

      if (countErr) throw countErr

      const nextNum = (count || 0) + 1
      const prepNum = `НП${String(nextNum).padStart(6, '0')}`
      planSnapshot._prep_num = prepNum

      const { data: newTask, error: errTask } = await supabase.from('tasks').insert({
        step: 'Підготовка',
        status: 'new',
        machine_name: 'PREP-TERM',
        planned_sets: totalSheets,
        planned_deadline: prepDeadline || null,
        plan_snapshot: planSnapshot,
        engineer_conf: true,
        director_conf: true
      }).select().single()

      if (errTask) throw errTask

      const requestsToInsert = itemsToCreate.map(([materialId, qty]) => {
        const nom = (nomenclatures || []).find(n => String(n.id) === String(materialId))
        return {
          task_id: newTask.id,
          nomenclature_id: materialId,
          quantity: Number(qty),
          status: 'pending',
          inventory_id: null,
          details: `ЗАПИТ НА ПІДГОТОВКУ (${prepNum}): ${nom?.name || 'Лист'} — ${qty} шт.`
        }
      })
      const { error: reqErr } = await supabase.from('material_requests').insert(requestsToInsert)
      if (reqErr) throw reqErr

      alert(`Наряд ${prepNum} успішно створено!`)
      setPrepQuantities({})
      setShowPrepModal(false)
      setPrepDeadline('')
      if (fetchData) fetchData(['tasks', 'material_requests'], { force: true })
    } catch (err) {
      console.error(err)
      alert('Помилка при створенні наряду: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    showPrepModal,
    setShowPrepModal,
    prepQuantities,
    setPrepQuantities,
    prepDeadline,
    setPrepDeadline,
    handleCreatePrepOrder,
    isSubmitting
  }
}
