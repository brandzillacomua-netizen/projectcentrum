import { describe, expect, it } from 'vitest'
import {
  VKYA_STAMP_ASSIGNMENTS,
  STAMP_OPTIONS,
  resolveUserQcStamp,
  getInspectorNameForStamp
} from '../src/modules/Shop1/utils/vkyaStampHelpers.js'

describe('vkyaStampHelpers', () => {
  it('has 8 standard stamp options from ВКЯ 1 to ВКЯ 8', () => {
    expect(STAMP_OPTIONS).toEqual([
      'ВКЯ 1', 'ВКЯ 2', 'ВКЯ 3', 'ВКЯ 4', 'ВКЯ 5', 'ВКЯ 6', 'ВКЯ 7', 'ВКЯ 8'
    ])
  })

  it('correctly maps inspector names for stamps', () => {
    expect(getInspectorNameForStamp('ВКЯ 1')).toBe('Хлібишин М.')
    expect(getInspectorNameForStamp('ВКЯ 2')).toBe('Оріхівський О.')
    expect(getInspectorNameForStamp('ВКЯ 3')).toBe('Балабас М.')
    expect(getInspectorNameForStamp('ВКЯ 4')).toBe('Цар М.')
    expect(getInspectorNameForStamp('ВКЯ 5')).toBe('Карпінець Тарас')
    expect(getInspectorNameForStamp('ВКЯ 6')).toBe('')
  })

  it('resolves stamp by user login', () => {
    expect(resolveUserQcStamp({ login: 'hlibyshyn.m' })).toBe('ВКЯ 1')
    expect(resolveUserQcStamp({ login: 'm.khlibyshyn' })).toBe('ВКЯ 1')
    expect(resolveUserQcStamp({ login: 'orihivskiy.o' })).toBe('ВКЯ 2')
    expect(resolveUserQcStamp({ login: 'balabas.m' })).toBe('ВКЯ 3')
    expect(resolveUserQcStamp({ login: 'tsar.m' })).toBe('ВКЯ 4')
    expect(resolveUserQcStamp({ login: 'taras.vkya' })).toBe('ВКЯ 5')
  })

  it('resolves stamp by user name and surname', () => {
    expect(resolveUserQcStamp({ first_name: 'М.', last_name: 'Хлібишин' })).toBe('ВКЯ 1')
    expect(resolveUserQcStamp({ first_name: 'О.', last_name: 'Оріхівський' })).toBe('ВКЯ 2')
    expect(resolveUserQcStamp({ first_name: 'М.', last_name: 'Балабас' })).toBe('ВКЯ 3')
    expect(resolveUserQcStamp({ first_name: 'М.', last_name: 'Цар' })).toBe('ВКЯ 4')
    expect(resolveUserQcStamp({ first_name: 'Тарас', last_name: 'Карпінець' })).toBe('ВКЯ 5')
  })

  it('resolves stamp by explicit inspector name string', () => {
    expect(resolveUserQcStamp(null, [], 'Хлібишин М.')).toBe('ВКЯ 1')
    expect(resolveUserQcStamp(null, [], 'Оріхівський О.')).toBe('ВКЯ 2')
    expect(resolveUserQcStamp(null, [], 'Балабас М.')).toBe('ВКЯ 3')
    expect(resolveUserQcStamp(null, [], 'Цар М.')).toBe('ВКЯ 4')
    expect(resolveUserQcStamp(null, [], 'Карпінець Тарас')).toBe('ВКЯ 5')
  })

  it('honors custom profile stamp override if present in access_rights', () => {
    const customUser = {
      login: 'custom.user',
      access_rights: { qc_stamp: 'ВКЯ 7' }
    }
    expect(resolveUserQcStamp(customUser)).toBe('ВКЯ 7')
  })

  it('returns null for generic users without QC stamp', () => {
    expect(resolveUserQcStamp({ login: 'operator1', name: 'Іван Оператор' })).toBe(null)
  })
})

