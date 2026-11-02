import { describe, it, expect } from 'vitest'
import { parseMachineQRId, resolveMachineFromScannedText } from '../src/utils/machineQrUtils.js'

describe('machineQrUtils - Strict Machine vs Work Card QR Separation', () => {
  const machineUuid = '43d5267b-4be8-4f65-8b01-a1d8fdcd4ca0'
  const cardUuid = 'd71c696e-7be1-4dfb-9db3-d6c507bcda4a'

  it('correctly extracts UUID from full machine URL', () => {
    expect(parseMachineQRId(`https://centrum.domain/machines/${machineUuid}`)).toBe(machineUuid)
    expect(parseMachineQRId(`http://localhost:5173/machines/${machineUuid}`)).toBe(machineUuid)
  })

  it('correctly extracts UUID from relative machine paths', () => {
    expect(parseMachineQRId(`/machines/${machineUuid}`)).toBe(machineUuid)
    expect(parseMachineQRId(`machines/${machineUuid}`)).toBe(machineUuid)
    expect(parseMachineQRId(`machine/${machineUuid}`)).toBe(machineUuid)
  })

  it('correctly extracts UUID from CENTRUM_MACHINE_ prefix', () => {
    expect(parseMachineQRId(`CENTRUM_MACHINE_${machineUuid}`)).toBe(machineUuid)
  })

  it('NEVER treats a bare work card UUID as a machine QR', () => {
    expect(parseMachineQRId(cardUuid)).toBeNull()
  })

  it('NEVER treats CENTRUM_CARD_ prefix as a machine QR', () => {
    expect(parseMachineQRId(`CENTRUM_CARD_${cardUuid}`)).toBeNull()
  })

  it('NEVER treats short card ID or order code as a machine QR', () => {
    expect(parseMachineQRId('#1234-5')).toBeNull()
    expect(parseMachineQRId('1234-5')).toBeNull()
    expect(parseMachineQRId('7be14dfb')).toBeNull()
  })

  it('handles empty or invalid inputs gracefully', () => {
    expect(parseMachineQRId('')).toBeNull()
    expect(parseMachineQRId(null)).toBeNull()
    expect(parseMachineQRId(undefined)).toBeNull()
  })
})

describe('resolveMachineFromScannedText', () => {
  const sampleMachines = [
    {
      id: '43d5267b-4be8-4f65-8b01-a1d8fdcd4ca0',
      name: 'CNC 1200x800 - 4 листи (Малий)',
      inventory_no: 'INV-1001',
      sequence_number: 1,
      type: 'CNC 1200×800 - 4 листи (Малий)'
    },
    {
      id: 'fa49bb77-f28a-40a8-b633-8a3d53bce7dc',
      name: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)',
      inventory_no: 'INV-2005',
      sequence_number: 5,
      type: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
    }
  ]

  it('resolves machine by full QR URL', () => {
    const match = resolveMachineFromScannedText('https://centrum.domain/machines/43d5267b-4be8-4f65-8b01-a1d8fdcd4ca0', sampleMachines)
    expect(match).toBeDefined()
    expect(match.id).toBe('43d5267b-4be8-4f65-8b01-a1d8fdcd4ca0')
  })

  it('resolves machine by public call URL', () => {
    const match = resolveMachineFromScannedText('http://localhost:5173/machines/fa49bb77-f28a-40a8-b633-8a3d53bce7dc/call', sampleMachines)
    expect(match).toBeDefined()
    expect(match.id).toBe('fa49bb77-f28a-40a8-b633-8a3d53bce7dc')
  })

  it('resolves machine by direct UUID', () => {
    const match = resolveMachineFromScannedText('43d5267b-4be8-4f65-8b01-a1d8fdcd4ca0', sampleMachines)
    expect(match).toBeDefined()
    expect(match.id).toBe('43d5267b-4be8-4f65-8b01-a1d8fdcd4ca0')
  })

  it('resolves machine by inventory number', () => {
    const match = resolveMachineFromScannedText('inv-1001', sampleMachines)
    expect(match).toBeDefined()
    expect(match.sequence_number).toBe(1)
  })

  it('resolves machine by sequence number with or without prefix', () => {
    const match1 = resolveMachineFromScannedText('5', sampleMachines)
    expect(match1).toBeDefined()
    expect(match1.id).toBe('fa49bb77-f28a-40a8-b633-8a3d53bce7dc')

    const match2 = resolveMachineFromScannedText('№5', sampleMachines)
    expect(match2).toBeDefined()
    expect(match2.id).toBe('fa49bb77-f28a-40a8-b633-8a3d53bce7dc')
  })

  it('resolves machine by exact name', () => {
    const match = resolveMachineFromScannedText('cnc ke xin - 4 - 16 листів (фея)', sampleMachines)
    expect(match).toBeDefined()
    expect(match.id).toBe('fa49bb77-f28a-40a8-b633-8a3d53bce7dc')
  })

  it('returns null when text does not match any machine', () => {
    expect(resolveMachineFromScannedText('UNKNOWN-999', sampleMachines)).toBeNull()
    expect(resolveMachineFromScannedText('', sampleMachines)).toBeNull()
    expect(resolveMachineFromScannedText(null, sampleMachines)).toBeNull()
  })
})
