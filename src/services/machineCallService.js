import { supabase } from '../supabase'

const ensureArray = value => Array.isArray(value) ? value : []

export async function fetchPublicMachineCallContext(machineId) {
  if (!machineId) throw new Error('Не вказано ідентифікатор верстата')
  const { data, error } = await supabase.rpc('rpc_public_machine_call_context', {
    p_machine_id: machineId
  })
  if (error) throw error
  return {
    machine: data?.machine || null,
    users: ensureArray(data?.users),
    calls: ensureArray(data?.calls)
  }
}

export async function createMachineCall({ machineId, role, operatorName, employeeId = null }) {
  if (!machineId) throw new Error('Не вказано ідентифікатор верстата')
  if (!['master', 'engineer', 'quality'].includes(role)) throw new Error('Некоректний тип виклику')

  const normalizedEmployeeId = employeeId === '' || employeeId == null ? null : Number(employeeId)
  if (normalizedEmployeeId !== null && !Number.isSafeInteger(normalizedEmployeeId)) {
    throw new Error('Некоректний ідентифікатор працівника')
  }

  const { data, error } = await supabase.rpc('rpc_public_create_machine_call', {
    p_machine_id: machineId,
    p_called_role: role,
    p_operator_name: String(operatorName || '').trim() || null,
    p_called_employee_id: normalizedEmployeeId
  })
  if (error) throw error
  return data
}

