import { describe, it, expect } from 'vitest'
import {
  classifyV2Type,
  autoClassify,
  TYPE_COLORS,
  TYPE_LABELS
} from '../src/modules/Engineer/utils/engineerHelpers.jsx'

describe('Engineer V2.0 Nomenclature Classification & Badges', () => {
  describe('classifyV2Type', () => {
    it('classifies carbon plates and sheets as raw material (raw), NOT consumable/метиз', () => {
      const plate = {
        name: 'Карбонова пластина Т300 500*600 2мм (преференція)',
        group_id: 'grp_carbon_t300',
        rule_type: 'carbon'
      }
      expect(classifyV2Type(plate)).toBe('raw')
    })

    it('classifies screws, nuts, and standoffs as hardware (метизи)', () => {
      const screwBlack = {
        name: 'Гвинт DIN7985 М3*45 (чорний)',
        group_id: 'grp_screws_black',
        rule_type: 'screw_black'
      }
      const screwIso = {
        name: 'Гвинт ISO7380 M3*9 (чорний)',
        group_id: 'grp_screws_black',
        rule_type: 'screw'
      }
      const nut = {
        name: 'Прес гайка М4, вуглецева сталь',
        group_id: 'grp_press_nuts',
        rule_type: 'press_nut'
      }
      const standoff = {
        name: 'Стійка M3x20',
        group_id: 'grp_standoffs',
        rule_type: 'standoff'
      }

      expect(classifyV2Type(screwBlack)).toBe('hardware')
      expect(classifyV2Type(screwIso)).toBe('hardware')
      expect(classifyV2Type(nut)).toBe('hardware')
      expect(classifyV2Type(standoff)).toBe('hardware')
    })

    it('classifies mills / cutters as cutter', () => {
      const mill = {
        name: 'Фреза спіральна 3.175х12',
        group_id: 'grp_mills',
        rule_type: 'mill'
      }
      expect(classifyV2Type(mill)).toBe('cutter')
    })

    it('classifies frames as product and structural parts as part', () => {
      const frame = {
        name: 'Рама Марк 4 7 дюймів',
        group_id: 'grp_production_frames',
        rule_type: 'full_frame'
      }
      const part = {
        name: 'Луч передній 7 дюймів',
        group_id: 'cat_parts',
        rule_type: 'frame_part'
      }

      expect(classifyV2Type(frame)).toBe('product')
      expect(classifyV2Type(part)).toBe('part')
    })
  })

  describe('TYPE_LABELS and TYPE_COLORS mapping', () => {
    it('maps hardware to Метиз with red color', () => {
      expect(TYPE_LABELS['hardware']).toBe('Метиз')
      expect(TYPE_COLORS['hardware']).toBe('#dc2626')
    })

    it('maps raw to Сировина with green color', () => {
      expect(TYPE_LABELS['raw']).toBe('Сировина')
      expect(TYPE_COLORS['raw']).toBe('#059669')
    })

    it('maps part to Деталь with blue color', () => {
      expect(TYPE_LABELS['part']).toBe('Деталь')
      expect(TYPE_COLORS['part']).toBe('#2563eb')
    })

    it('maps product to Виріб with amber color', () => {
      expect(TYPE_LABELS['product']).toBe('Виріб')
      expect(TYPE_COLORS['product']).toBe('#d97706')
    })

    it('maps consumable to Метиз with red color (no such thing as витратне)', () => {
      expect(TYPE_LABELS['consumable']).toBe('Метиз')
      expect(TYPE_COLORS['consumable']).toBe('#dc2626')
    })
  })

  describe('autoClassify logic', () => {
    it('classifies carbon plate as Сировина (Листи, Труби), NOT Деталі', () => {
      const nom = {
        name: 'Карбонова пластина Т300 500*600 2мм (преференція)',
        type: 'raw'
      }
      expect(autoClassify(nom)).toBe('Сировина (Листи, Труби)')
    })

    it('classifies screws and nuts as Метизи', () => {
      const nom = {
        name: 'Гвинт ISO7380 M3*9 (чорний)',
        type: 'hardware'
      }
      expect(autoClassify(nom)).toBe('Метизи')
    })
  })

  describe('BOM candidate filtering', () => {
    it('strictly excludes raw materials (carbon plates) and cutters from BOM components list', () => {
      const list = [
        { id: 1, name: 'Карбонова пластина Т300 1000*800 3мм', type: 'raw' },
        { id: 2, name: 'Фреза спіральна 3.175', type: 'cutter' },
        { id: 3, name: 'Гвинт DIN7985 M3*45 (чорний)', type: 'hardware' },
        { id: 4, name: 'Промінь передній 7"', type: 'part' },
        { id: 5, name: 'Вузол підвісу камери', type: 'assembly' }
      ]
      const bomCandidates = list.filter(n => n.type !== 'raw' && n.type !== 'cutter')
      expect(bomCandidates).toHaveLength(3)
      expect(bomCandidates.map(n => n.name)).toEqual([
        'Гвинт DIN7985 M3*45 (чорний)',
        'Промінь передній 7"',
        'Вузол підвісу камери'
      ])
    })
  })
})
