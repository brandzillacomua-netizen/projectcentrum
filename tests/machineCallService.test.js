import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { supabase } from '../src/supabase'
import { createMachineCall, fetchPublicMachineCallContext } from '../src/services/machineCallService'

describe('machineCallService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads only the public RPC context', async () => {
    supabase.rpc.mockResolvedValue({
      data: { machine: { id: 'machine-1' }, users: null, calls: [{ id: 'call-1' }] },
      error: null
    })
    await expect(fetchPublicMachineCallContext('machine-1')).resolves.toEqual({
      machine: { id: 'machine-1' }, users: [], calls: [{ id: 'call-1' }]
    })
    expect(supabase.rpc).toHaveBeenCalledWith('rpc_public_machine_call_context', {
      p_machine_id: 'machine-1'
    })
  })

  it('normalizes an employee id before creating a call', async () => {
    supabase.rpc.mockResolvedValue({ data: { created: true }, error: null })
    await createMachineCall({ machineId: 'machine-1', role: 'engineer', operatorName: '  Олена  ', employeeId: '42' })
    expect(supabase.rpc).toHaveBeenCalledWith('rpc_public_create_machine_call', {
      p_machine_id: 'machine-1', p_called_role: 'engineer',
      p_operator_name: 'Олена', p_called_employee_id: 42
    })
  })

  it('rejects an unsupported role without calling the database', async () => {
    await expect(createMachineCall({ machineId: 'machine-1', role: 'admin' }))
      .rejects.toThrow('Некоректний тип виклику')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
