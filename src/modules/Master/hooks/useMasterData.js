import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

export function useMasterData() {
  const {
    orders, tasks, nomenclatures, bomItems, inventory,
    totalProduced, totalScrapCount, createNaryad, fetchModuleData,
    machines, machineCalls, currentUser, machineOperations, requests
  } = useMES()

  useEffect(() => {
    fetchModuleData('master')
  }, [])

  const activeCalls = (machineCalls || []).filter(c =>
    c.status === 'pending' &&
    c.called_role === 'master' &&
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Майстер зміни'
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

  // Virtual and custom card states
  const [showCustomCardModal, setShowCustomCardModal] = useState(false)
  const [customCardNomId, setCustomCardNomId] = useState('')
  const [customCardQty, setCustomCardQty] = useState('')
  const [customCardMachine, setCustomCardMachine] = useState('')
  const [customCardDeadline, setCustomCardDeadline] = useState('')
  const [customCardSearch, setCustomCardSearch] = useState('')
  const [isSavingDraftOrder, setIsSavingDraftOrder] = useState(false)

  // Prep modal states
  const [showPrepModal, setShowPrepModal] = useState(false)
  const [prepQuantities, setPrepQuantities] = useState({})
  const [prepDeadline, setPrepDeadline] = useState('')

  // Search queue
  const [searchQuery, setSearchQuery] = useState('')

  return {
    activeCalls,
    handleResolveCall,
    showCustomCardModal, setShowCustomCardModal,
    customCardNomId, setCustomCardNomId,
    customCardQty, setCustomCardQty,
    customCardMachine, setCustomCardMachine,
    customCardDeadline, setCustomCardDeadline,
    customCardSearch, setCustomCardSearch,
    isSavingDraftOrder, setIsSavingDraftOrder,
    showPrepModal, setShowPrepModal,
    prepQuantities, setPrepQuantities,
    prepDeadline, setPrepDeadline,
    searchQuery, setSearchQuery
  }
}
