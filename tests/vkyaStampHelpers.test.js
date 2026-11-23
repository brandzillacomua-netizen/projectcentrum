import { describe, expect, it } from 'vitest'
import {
  VKYA_STAMP_ASSIGNMENTS,
  getInspectorNameForStamp,
  resolveUserQcStamp
} from '../src/modules/Shop1/utils/vkyaStampHelpers.js'

describe('VKYA stamp assignments & historical resolution', () => {
  it('assigns ВКЯ 3 to Лоза Р. from 2026-11-23 onwards and Балабас М. before 2026-11-23', () => {
    const vkya3 = VKYA_STAMP_ASSIGNMENTS.find(a => a.stamp === 'ВКЯ 3')
    expect(vkya3?.name).toBe('Лоза Р.')
    expect(vkya3?.shortName).toBe('Лоза Р.')

    expect(getInspectorNameForStamp('ВКЯ 3')).toBe('Лоза Р.')
    expect(getInspectorNameForStamp('ВКЯ 3', '2026-11-22T23:59:59+02:00')).toBe('Балабас М.')
    expect(getInspectorNameForStamp('ВКЯ 3', '2026-11-23T00:00:00+02:00')).toBe('Лоза Р.')
    expect(getInspectorNameForStamp('ВКЯ 3', '2026-11-25T12:00:00+02:00')).toBe('Лоза Р.')
  })

  it('resolves Лоза Р. to ВКЯ 3', () => {
    expect(resolveUserQcStamp({ login: 'loza.r' })).toBe('ВКЯ 3')
    expect(resolveUserQcStamp({ last_name: 'Лоза', first_name: 'Р.' })).toBe('ВКЯ 3')
  })
})
