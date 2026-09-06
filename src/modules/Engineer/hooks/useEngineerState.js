import { useState } from 'react'
import { useMES } from '../../../MESContext'
import { useV2NomenclaturesData } from '../utils/engineerHelpers.jsx'

export function useEngineerState() {
  const mesContext = useMES()
  const { 
    tasks, 
    orders, 
    approveEngineer, 
    machineCalls, 
    machines, 
    currentUser, 
    supabase 
  } = mesContext

  const nomenclatures = useV2NomenclaturesData(supabase)
  
  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || 
    currentUser?.position === 'Адмін' || 
    currentUser?.access_rights?.director

  const [activeTab, setActiveTab] = useState('tasks')

  const pendingTasks = (tasks || []).filter(t => 
    t.status === 'waiting' && 
    !t.engineer_conf && 
    !t.step?.includes('Пресування')
  )

  const approvedCount = (tasks || []).filter(t => 
    t.status === 'waiting' && 
    t.engineer_conf
  ).length

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    c.called_role === 'engineer' && 
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser 
      ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() 
      : 'Інженер ЧПК'

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
    ...mesContext,
    nomenclatures,
    isSuperAdmin,
    activeTab,
    setActiveTab,
    pendingTasks,
    approvedCount,
    activeCalls,
    handleResolveCall
  }
}
