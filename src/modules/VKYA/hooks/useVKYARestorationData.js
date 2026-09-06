import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import { useRestorationStages } from '../../../hooks/useRestorationStages'
import { returnRestorationToRoute } from '../quality-hold/qualityHoldService'

const PAGE_SIZE = 20

const userName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || user?.login || ''

export const useVKYARestorationData = () => {
  const { currentUser } = useMES()
  const [cards, setCards] = useState([])
  const [legacyItems, setLegacyItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState(null)
  const [operator, setOperator] = useState(userName(currentUser))
  const [completedQty, setCompletedQty] = useState('')
  const [finalScrapQty, setFinalScrapQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [legacyDraft, setLegacyDraft] = useState(null)
  const [legacyQuantity, setLegacyQuantity] = useState('')
  const [legacyStageId, setLegacyStageId] = useState('')
  const { rows: restorationStages } = useRestorationStages()

  const loadCards = useCallback(async () => {
    setLoading(true)
    const [cardsResult, legacyResult] = await Promise.all([
      supabase.from('vkya_restoration_cards').select('*').order('created_at', { ascending: true }),
      supabase.from('inventory').select('id,nomenclature_id,name,unit,total_qty,type,updated_at').eq('type', 'scrap_restoration').gt('total_qty', 0).order('updated_at', { ascending: true })
    ])
    const loadError = cardsResult.error || legacyResult.error
    if (loadError) setError(loadError.message)
    else { setCards(cardsResult.data || []); setLegacyItems(legacyResult.data || []); setError('') }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadCards, 0)
    return () => window.clearTimeout(timer)
  }, [loadCards])

  useEffect(() => {
    setCurrentPage(1)
  }, [tab, query])

  const visibleCards = useMemo(() => cards.filter(card => {
    const matchesTab = tab === 'awaiting_action'
      ? card.status === 'completed' && !card.shop2_card_id && !card.route_card_id && Number(card.completed_quantity) > 0
      : tab === 'completed'
        ? card.status === 'completed' && (Boolean(card.shop2_card_id) || Boolean(card.route_card_id) || Number(card.completed_quantity) === 0)
        : card.status !== 'completed'
    const haystack = `${card.card_number} ${card.nomenclature_name} ${card.restoration_stage} ${card.operator_name || ''}`.toLowerCase()
    return matchesTab && haystack.includes(query.trim().toLowerCase())
  }), [cards, query, tab])

  const totalPages = Math.ceil(visibleCards.length / PAGE_SIZE) || 1

  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return visibleCards.slice(start, start + PAGE_SIZE)
  }, [visibleCards, currentPage])

  const startCard = async () => {
    if (!selectedCard || !operator.trim()) return
    setSaving(true)
    const { error: updateError } = await supabase.from('vkya_restoration_cards').update({
      status: 'in_progress', operator_name: operator.trim(), started_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', selectedCard.id).eq('status', 'new')
    setSaving(false)
    if (updateError) return setError(updateError.message)
    setSelectedCard(null)
    await loadCards()
  }

  const completeCard = async () => {
    const scrapQty = Number(finalScrapQty)
    const qty = Number(selectedCard?.quantity || 0) - scrapQty
    if (!selectedCard || !Number.isInteger(scrapQty) || scrapQty < 0 || scrapQty > Number(selectedCard.quantity)) return
    setSaving(true)
    const { error: updateError } = await supabase.rpc('complete_vkya_restoration_card', {
      p_card_id: selectedCard.id,
      p_completed_quantity: qty,
      p_final_scrap_quantity: scrapQty
    })
    setSaving(false)
    if (updateError) return setError(updateError.message)
    setSelectedCard(null)
    setCompletedQty('')
    setFinalScrapQty('')
    await loadCards()
    alert(`Карту завершено: ${qty} шт. відновлено, ${scrapQty} шт. переведено в Утиль.`)
  }

  const openCard = card => {
    setSelectedCard(card)
    setOperator(card.operator_name || userName(currentUser))
    setCompletedQty(String(card.quantity))
    setFinalScrapQty('0')
  }

  const returnToSourceRoute = async () => {
    if (!selectedCard || selectedCard.status !== 'completed' || selectedCard.route_card_id) return
    if (!window.confirm(`Повернути ${selectedCard.completed_quantity} ${selectedCard.unit || 'шт'} у початковий наряд (в Буфер Цеху №2)?`)) return
    setSaving(true)
    try {
      await returnRestorationToRoute(supabase, {
        restorationCardId: selectedCard.id,
        userName: userName(currentUser) || selectedCard.operator_name || null
      })
      setSelectedCard(null)
      await loadCards()
      alert(`✅ ${selectedCard.completed_quantity} шт. повернено у Буфер Цеху №2 початкового наряду.`)
    } catch (returnError) {
      setError(returnError.message)
    } finally {
      setSaving(false)
    }
  }

  const returnLegacyToBZ = async () => {
    if (!selectedCard || selectedCard.status !== 'completed' || selectedCard.route_card_id) return
    if (!window.confirm(`Повернути ${selectedCard.completed_quantity} ${selectedCard.unit || 'шт'} безпосередньо у Базовий залишок (БЗ)?`)) return
    setSaving(true)
    try {
      const { error: returnError } = await supabase.rpc('return_legacy_restoration_to_bz', {
        p_restoration_card_id: selectedCard.id,
        p_returned_by: userName(currentUser) || selectedCard.operator_name || null
      })
      if (returnError) throw returnError
      setSelectedCard(null)
      await loadCards()
      alert(`✅ ${selectedCard.completed_quantity} шт. успішно зараховано у Базовий залишок на склад.`)
    } catch (retError) {
      setError(retError.message)
    } finally {
      setSaving(false)
    }
  }

  const dispatchToShop2 = async (stage) => {
    if (!selectedCard || selectedCard.status !== 'completed' || selectedCard.shop2_card_id) return
    if (!window.confirm(`Передати ${selectedCard.completed_quantity} ${selectedCard.unit || 'шт'} у Цех №2 (${stage})?`)) return
    setSaving(true)
    try {
      const { data, error: dispatchError } = await supabase.rpc('dispatch_vkya_restoration_to_shop2', {
        p_restoration_card_id: selectedCard.id,
        p_shop2_stage: stage
      })
      if (dispatchError) throw dispatchError
      setSelectedCard(null)
      await loadCards()
      alert(`✅ Деталі успішно передано в Цех №2 (${stage}).`)
    } catch (dispatchErr) {
      setError(dispatchErr.message)
    } finally {
      setSaving(false)
    }
  }

  const assignLegacyItem = async () => {
    const quantity = Number(legacyQuantity)
    if (!legacyDraft || !legacyStageId || !Number.isInteger(quantity) || quantity <= 0 || quantity > Number(legacyDraft.total_qty)) return
    setSaving(true)
    const { error: assignError } = await supabase.rpc('assign_legacy_vkya_restoration_card', {
      p_inventory_id: legacyDraft.id,
      p_quantity: quantity,
      p_restoration_stage_id: legacyStageId,
      p_created_by_user_id: currentUser?.id || null,
      p_created_by_name: userName(currentUser) || null
    })
    setSaving(false)
    if (assignError) return setError(assignError.message)
    setLegacyDraft(null)
    setLegacyQuantity('')
    setLegacyStageId('')
    await loadCards()
  }

  return {
    PAGE_SIZE,
    cards,
    legacyItems,
    loading,
    error,
    tab,
    setTab,
    query,
    setQuery,
    currentPage,
    setCurrentPage,
    selectedCard,
    setSelectedCard,
    operator,
    setOperator,
    completedQty,
    setCompletedQty,
    finalScrapQty,
    setFinalScrapQty,
    saving,
    legacyDraft,
    setLegacyDraft,
    legacyQuantity,
    setLegacyQuantity,
    legacyStageId,
    setLegacyStageId,
    restorationStages,
    loadCards,
    visibleCards,
    totalPages,
    paginatedCards,
    startCard,
    completeCard,
    openCard,
    returnToSourceRoute,
    returnLegacyToBZ,
    dispatchToShop2,
    assignLegacyItem
  }
}
