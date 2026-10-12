import { describe, expect, it } from 'vitest'
import { findMachineByName, getStandardMachineType } from '../src/modules/Foreman2/utils/foremanHelpers.js'
import { findMachineForReissue } from '../src/modules/Foreman2/features/reissue/reissueCalculations.js'

describe('small CNC capacity', () => {
  it('normalizes both legacy and current small-machine names to a 1-6 sheet range', () => {
    expect(getStandardMachineType('CNC 1200x800 - 4 листи (Малий)'))
      .toBe('CNC 1200x800 - 1-6 листів (Малий)')

    expect(findMachineByName('CNC 1200x800 - 4 листи (Малий)', [{
      name: 'CNC 1200x800 - 4 листи (Малий)',
      sheet_capacity: 4
    }])).toMatchObject({
      sheet_capacity: 6,
      min_capacity: 1,
      max_capacity: 6
    })
  })

  it('uses six sheets for small-machine reissue even with a legacy database capacity', () => {
    expect(findMachineForReissue('CNC 1200x800 - 4 листи (Малий)', [{
      name: 'CNC 1200x800 - 4 листи (Малий)',
      sheet_capacity: 4
    }])).toMatchObject({
      sheet_capacity: 6,
      min_capacity: 1,
      max_capacity: 6
    })
  })
})
