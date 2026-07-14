import React, { useMemo } from 'react'
import AdminCardDeletePanel from '../../../Foreman2/features/admin-card-delete/AdminCardDeletePanel.jsx'
import { useAdminCardDelete } from '../../../Foreman2/features/admin-card-delete/useAdminCardDelete.js'

const uniqueById = (rows = []) => {
  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

export default function ForemanAdminCardDeletePanel({
  task,
  workCards = [],
  archiveCards = [],
  nomenclatures = [],
  currentUser,
  fetchData,
  onDeleted
}) {
  const model = useMemo(() => {
    if (!task?.id) return null

    const taskCards = uniqueById([
      ...(workCards || []).filter(card => String(card.task_id) === String(task.id)),
      ...(archiveCards || []).filter(card => String(card.task_id) === String(task.id))
    ])

    const planPartIds = Object.keys(task.plan_snapshot || {})
      .filter(key => {
        if (key.startsWith('_')) return false
        const nom = nomenclatures.find(item => String(item.id) === String(key))
        return nom?.type === 'part'
      })

    const cardPartIds = taskCards.map(card => String(card.nomenclature_id)).filter(Boolean)
    const partIds = Array.from(new Set([...planPartIds.map(String), ...cardPartIds]))

    return {
      id: task.id,
      task,
      parts: partIds.map(nomId => {
        const nom = nomenclatures.find(item => String(item.id) === String(nomId))
        return {
          nomId,
          name: nom?.name || `Деталь ${nomId}`,
          code: nom?.code || '',
          cards: taskCards.filter(card => String(card.nomenclature_id) === String(nomId))
        }
      }).filter(part => part.cards.length > 0)
    }
  }, [archiveCards, nomenclatures, task, workCards])

  const adminCardDelete = useAdminCardDelete({
    currentUser,
    fetchData,
    onDeleted
  })

  if (!adminCardDelete.isSuperAdmin || !model) return null

  return (
    <AdminCardDeletePanel
      model={model}
      currentUser={currentUser}
      onDeleteCards={adminCardDelete.deleteCards}
      isDeleting={adminCardDelete.isDeleting}
      error={adminCardDelete.error}
      lastResult={adminCardDelete.lastResult}
    />
  )
}
