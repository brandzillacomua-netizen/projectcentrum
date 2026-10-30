import { useState } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'
import { useV2NomenclaturesData, isTaskFullyEngineerApproved } from '../utils/engineerHelpers.jsx'

export function useEngineerData() {
  const { tasks, orders, currentUser, machineCalls } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)
  const [activeTab, setActiveTab] = useState('tasks')

  const pendingTasks = (tasks || []).filter(t => 
    (t.status === 'waiting' || t.status === 'in-progress' || t.status === 'in_progress') && 
    !t.step?.includes('Пресування') &&
    !isTaskFullyEngineerApproved(t, orders, nomenclatures)
  )
  const approvedCount = (tasks || []).filter(t => 
    (t.status === 'waiting' || t.status === 'in-progress' || t.status === 'in_progress') && 
    !t.step?.includes('Пресування') &&
    isTaskFullyEngineerApproved(t, orders, nomenclatures)
  ).length

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    c.called_role === 'engineer' && 
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Інженер ЧПК'
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

  return {
    activeTab,
    setActiveTab,
    pendingTasks,
    approvedCount,
    activeCalls,
    handleResolveCall
  }
}
