import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../../../../supabase.js'

const SAFE_DELETE_STATUSES = new Set(['new', 'waiting-materials', 'waiting-machines'])
const OPTIONAL_CARD_LINKED_TABLES = [
  'scrap_classifications',
  'material_requests',
  'work_card_history'
]

const chunk = (items, size = 100) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

const isMissingOptionalRelation = (error) => {
  const message = String(error?.message || error?.details || '')
  return /does not exist|schema cache|Could not find|column .* does not exist/i.test(message)
}

export const isForeman2CardDeleteAdmin = (user) => {
  const position = String(user?.position || '').toLowerCase()
  const department = String(user?.department || '').toLowerCase()
  const accessRights = user?.access_rights || {}
  const isAdmin = user?.role === 'admin' || position === 'адмін'
  const isShop1Head = position.includes('начальник цеху') && (
    /цех\s*(?:№|#)?\s*1\b/i.test(department) ||
    accessRights.shop1_foreman === true
  )

  return isAdmin || isShop1Head
}

export const isSafeCardToDelete = (card) => {
  return SAFE_DELETE_STATUSES.has(String(card?.status || ''))
}

const deleteByCardId = async (table, cardIds) => {
  const { error } = await supabase.from(table).delete().in('card_id', cardIds)
  if (error && !isMissingOptionalRelation(error)) throw error
}

export function useAdminCardDelete({ currentUser, fetchData, onDeleted } = {}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  const isSuperAdmin = useMemo(() => isForeman2CardDeleteAdmin(currentUser), [currentUser])

  const deleteCards = useCallback(async (cards, options = {}) => {
    setError(null)
    setLastResult(null)

    if (!isSuperAdmin) {
      throw new Error('Видалення робочих карток доступне тільки адміну або Начальнику цеху №1.')
    }

    const uniqueCards = Array.from(
      new Map((cards || []).filter(card => card?.id).map(card => [String(card.id), card])).values()
    )
    if (uniqueCards.length === 0) {
      throw new Error('Немає вибраних карток для видалення.')
    }

    const unsafeCards = uniqueCards.filter(card => !isSafeCardToDelete(card))
    if (unsafeCards.length > 0 && !options.allowUnsafe) {
      throw new Error('Є картки, які вже стартували або завершені. Їх не видаляємо з інтерфейсу, щоб не стерти виробничу історію.')
    }

    setIsDeleting(true)
    try {
      const ids = uniqueCards.map(card => card.id)
      for (const idChunk of chunk(ids)) {
        for (const table of OPTIONAL_CARD_LINKED_TABLES) {
          await deleteByCardId(table, idChunk)
        }

        const { error: deleteCardsError } = await supabase
          .from('work_cards')
          .delete()
          .in('id', idChunk)
        if (deleteCardsError) throw deleteCardsError
      }

      const result = { deletedCount: uniqueCards.length, deletedIds: ids }

      if (typeof fetchData === 'function') {
        await fetchData([
          'work_cards',
          'work_card_history',
          'work_card_scrap_totals',
          'work_card_flow_totals',
          'material_requests',
          'tasks'
        ]).catch(() => {})
      }
      if (typeof onDeleted === 'function') await onDeleted(result)

      setLastResult(result)
      return result
    } catch (err) {
      const message = err?.message || 'Не вдалося видалити робочі картки.'
      setError(message)
      throw err
    } finally {
      setIsDeleting(false)
    }
  }, [fetchData, isSuperAdmin, onDeleted])

  return {
    isSuperAdmin,
    isDeleting,
    error,
    lastResult,
    deleteCards
  }
}
