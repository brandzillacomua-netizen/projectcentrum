import { describe, it, expect } from 'vitest'
import { parseMachineQRId } from '../src/utils/machineQrUtils.js'

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
