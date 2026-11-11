import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  getPartShop2RoutingFlags,
  mapV2ToStandardNom,
  isMissingColumnDbError,
  stripOptionalNomColumns
} from '../src/modules/Nomenclature/utils/nomenclatureHelpers.js'
import {
  getPaintingColorSwatch,
  isShop2CardTag,
  resolveShop2PartOrderRouting,
  resolveShop2CardDisplayInfo,
  resolveShop2BufferRowRouting,
  shouldCardGoToPaintingTerminal
} from '../src/utils/shop2RoutingUtils.js'

describe('Nomenclature Shop 2 Flags & Persistence Helpers', () => {
  it('extracts pressing and painting flags from top-level columns and rule_params', () => {
    expect(getPartShop2RoutingFlags(null)).toEqual({
      requiresPressing: false,
      requiresPainting: false,
      isConfigured: false
    })

    expect(getPartShop2RoutingFlags({
      id: 'n1',
      requires_pressing: true,
      requires_painting: false
    })).toEqual({
      requiresPressing: true,
      requiresPainting: false,
      isConfigured: true
    })

    expect(getPartShop2RoutingFlags({
      id: 'n2',
      rule_params: { requiresPressing: false, requiresPainting: true }
    })).toEqual({
      requiresPressing: false,
      requiresPainting: true,
      isConfigured: true
    })

    expect(getPartShop2RoutingFlags({
      id: 'n3',
      requiresPressing: true,
      requiresPainting: true
    })).toEqual({
      requiresPressing: true,
      requiresPainting: true,
      isConfigured: true
    })
  })

  it('maps nomenclatures_v2 rows with Shop 2 flags in both snake_case and camelCase', () => {
    const mapped = mapV2ToStandardNom({
      id: 'v2-part-1',
      code: 'V2-10001',
      name: 'Верхня пластина',
      rule_type: 'frame_part',
      rule_params: {
        requiresPressing: true,
        requiresPainting: true,
        unitsPerSheet: 24
      }
    })

    expect(mapped.requires_pressing).toBe(true)
    expect(mapped.requires_painting).toBe(true)
    expect(mapped.requiresPressing).toBe(true)
    expect(mapped.requiresPainting).toBe(true)
  })

  it('detects missing column errors and strips optional columns without mutating input', () => {
    expect(isMissingColumnDbError({ code: '42703', message: 'column does not exist' })).toBe(true)
    expect(isMissingColumnDbError({ code: 'PGRST204', message: 'schema cache' })).toBe(true)
    expect(isMissingColumnDbError({ code: '23505', message: 'duplicate key' })).toBe(false)

    const payload = {
      name: 'Деталь',
      requires_pressing: true,
      requires_painting: false,
      rule_params: { requiresPressing: true, requiresPainting: false }
    }
    const stripped = stripOptionalNomColumns(payload)
    expect(stripped).toEqual({
      name: 'Деталь',
      rule_params: { requiresPressing: true, requiresPainting: false }
    })
    expect(payload.requires_pressing).toBe(true)
  })
})

describe('Shop 2 Part x Order Routing & Painting Resolution', () => {
  const fullBlackOrangeOrder = {
    id: 'ord-full',
    order_num: '261110-1',
    report: JSON.stringify({
      painting: {
        type: 'full',
        color: 'Чорний (торці: Помаранчевий)',
        notes: 'Лакувати 2 шари'
      }
    })
  }

  const edgesRedOrder = {
    id: 'ord-edges',
    order_num: '261110-2',
    report: JSON.stringify({
      painting: {
        type: 'edges',
        color: 'Червоний',
        notes: ''
      }
    })
  }

  const unpaintedOrder = {
    id: 'ord-none',
    order_num: '261110-3',
    report: JSON.stringify({
      painting: { type: 'none', color: '', notes: '' }
    })
  }

  it('blocks painting when detail is pressing-only even if order requests full painting', () => {
    const pressingOnlyPart = {
      id: 'p-press',
      requires_pressing: true,
      requires_painting: false
    }
    const res = resolveShop2PartOrderRouting(pressingOnlyPart, fullBlackOrangeOrder)
    expect(res.requiresPressing).toBe(true)
    expect(res.requiresPainting).toBe(false)
    expect(res.shouldPaint).toBe(false)
    expect(res.paintBlockedByPartFlag).toBe(true)
    expect(res.recommendedStage).toBe('Пресування')
    expect(res.paintingDisplay).toBeNull()
  })

  it('recommends Фарбування directly and shows full base + edge colors for paint-only detail', () => {
    const paintOnlyPart = {
      id: 'p-paint',
      requires_pressing: false,
      requires_painting: true
    }
    const res = resolveShop2PartOrderRouting(paintOnlyPart, fullBlackOrangeOrder)
    expect(res.shouldPaint).toBe(true)
    expect(res.recommendedStage).toBe('Фарбування')
    expect(res.paintingDisplay).toMatchObject({
      type: 'full',
      typeLabel: 'Повне фарбування',
      baseColor: 'Чорний',
      edgeColor: 'Помаранчевий',
      notes: 'Лакувати 2 шари',
      summaryText: 'База: Чорний · Торці: Помаранчевий',
      baseSwatch: getPaintingColorSwatch('Чорний'),
      edgeSwatch: getPaintingColorSwatch('Помаранчевий')
    })
  })

  it('recommends Пресування first when both pressing and painting are enabled and order requests edges', () => {
    const bothPart = {
      id: 'p-both',
      requires_pressing: true,
      requires_painting: true
    }
    const res = resolveShop2PartOrderRouting(bothPart, edgesRedOrder)
    expect(res.requiresPressing).toBe(true)
    expect(res.shouldPaint).toBe(true)
    expect(res.recommendedStage).toBe('Пресування')
    expect(res.paintingDisplay).toMatchObject({
      type: 'edges',
      typeLabel: 'Фарбування торців',
      baseColor: '',
      edgeColor: 'Червоний',
      summaryText: 'Торці: Червоний',
      edgeSwatch: getPaintingColorSwatch('Червоний')
    })

    // Same part under order without painting
    const noPaintRes = resolveShop2PartOrderRouting(bothPart, unpaintedOrder)
    expect(noPaintRes.shouldPaint).toBe(false)
    expect(noPaintRes.paintSkippedByOrder).toBe(true)
    expect(noPaintRes.recommendedStage).toBe('Пресування')
  })

  it('recommends direct SGP transfer when configured detail requires neither pressing nor painting', () => {
    const cleanPart = {
      id: 'p-none',
      requires_pressing: false,
      requires_painting: false
    }
    const res = resolveShop2PartOrderRouting(cleanPart, fullBlackOrangeOrder)
    expect(res.isRoutingConfigured).toBe(true)
    expect(res.shouldPaint).toBe(false)
    expect(res.recommendedStage).toBe('Склад СГП (пряма передача)')
  })

  it('resolves buffer row painting variants deduplicated across active pools', () => {
    const nomenclatures = [
      { id: 'p-both', requires_pressing: true, requires_painting: true }
    ]
    const orders = [fullBlackOrangeOrder, edgesRedOrder, unpaintedOrder]
    const row = {
      nomId: 'p-both',
      ordersList: [
        { orderId: 'ord-full', orderNum: '261110-1', availableQty: 10 },
        { orderId: 'ord-edges', orderNum: '261110-2', availableQty: 5 },
        { orderId: 'ord-none', orderNum: '261110-3', availableQty: 20 }
      ]
    }
    const bufRouting = resolveShop2BufferRowRouting(row, nomenclatures, orders)
    expect(bufRouting.requiresPressing).toBe(true)
    expect(bufRouting.requiresPainting).toBe(true)
    expect(bufRouting.shouldPaintAny).toBe(true)
    expect(bufRouting.hasOrderWithoutPainting).toBe(true)
    expect(bufRouting.paintingSpecs).toHaveLength(2)
    expect(bufRouting.recommendedStage).toBe('Пресування')
  })

  it('filters Painting Terminal queue accurately for [SHOP:2] and [ЦЕХ №2] cards', () => {
    expect(isShop2CardTag('[SHOP:2] Деталь')).toBe(true)
    expect(isShop2CardTag('[ЦЕХ №2] Наряд №1')).toBe(true)
    expect(isShop2CardTag('[CNC] Різання')).toBe(false)

    const nomenclatures = [
      { id: 'p-both', requires_pressing: true, requires_painting: true },
      { id: 'p-press-only', requires_pressing: true, requires_painting: false }
    ]
    const orders = [fullBlackOrangeOrder, unpaintedOrder]

    // Pressed buffer card that requires painting & order wants full painting -> appears
    expect(shouldCardGoToPaintingTerminal({
      id: 'wc-1',
      card_info: '[SHOP:2] Деталь',
      nomenclature_id: 'p-both',
      order_id: 'ord-full',
      operation: 'Пресування',
      status: 'at-buffer'
    }, nomenclatures, orders)).toBe(true)

    // Pressed buffer card where detail allows painting, but order has Без фарбування -> excluded
    expect(shouldCardGoToPaintingTerminal({
      id: 'wc-2',
      card_info: '[SHOP:2] Деталь',
      nomenclature_id: 'p-both',
      order_id: 'ord-none',
      operation: 'Пресування',
      status: 'at-buffer'
    }, nomenclatures, orders)).toBe(false)

    // Pressed buffer card where detail is pressing-only -> excluded even if order paints other parts
    expect(shouldCardGoToPaintingTerminal({
      id: 'wc-3',
      card_info: '[SHOP:2] Деталь',
      nomenclature_id: 'p-press-only',
      order_id: 'ord-full',
      operation: 'Пресування',
      status: 'at-buffer'
    }, nomenclatures, orders)).toBe(false)

    // Explicit Painting card -> appears
    expect(shouldCardGoToPaintingTerminal({
      id: 'wc-4',
      card_info: '[SHOP:2] Деталь',
      nomenclature_id: 'p-both',
      order_id: 'ord-full',
      operation: 'Фарбування',
      status: 'new'
    }, nomenclatures, orders)).toBe(true)

    const displayInfo = resolveShop2CardDisplayInfo({
      id: 'wc-1',
      card_info: '[SHOP:2] Деталь',
      nomenclature_id: 'p-both',
      order_id: 'ord-full',
      operation: 'Пресування',
      status: 'at-buffer'
    }, nomenclatures, orders)
    expect(displayInfo.routing.shouldPaint).toBe(true)
    expect(displayInfo.routing.paintingDisplay?.edgeColor).toBe('Помаранчевий')
  })
})

describe('Shop 2 Operation Checkboxes & Display Wiring Verification', () => {
  it('verifies detail operation checkboxes exist in wizard and card edit modal', () => {
    const wizardSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Nomenclature/components/NomenclatureWizardModal.jsx'),
      'utf8'
    )
    const cardModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Nomenclature/components/NomenclatureCardModal/index.jsx'),
      'utf8'
    )
    const nomV2Src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/NomenclatureV2.jsx'),
      'utf8'
    )

    expect(wizardSrc).toContain('requiresPressing')
    expect(wizardSrc).toContain('requiresPainting')
    expect(cardModalSrc).toContain('requires_pressing')
    expect(cardModalSrc).toContain('requires_painting')
    expect(nomV2Src).toContain('requires_pressing')
    expect(nomV2Src).toContain('requires_painting')
  })

  it('verifies Shop 2 CardGen and Painting/Pressing/Shop2 terminals display routing & colors', () => {
    const genModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Shop2CardGen/components/GenerateShop2CardModal.jsx'),
      'utf8'
    )
    const activeCardsSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Shop2CardGen/components/Shop2ActiveCardsList.jsx'),
      'utf8'
    )
    const paintingListSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Painting/components/PaintingTerminalCardList.jsx'),
      'utf8'
    )
    const pressingListSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Pressing/components/PressingTerminalCardList.jsx'),
      'utf8'
    )
    const shop2DetailsSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/Shop2/components/Shop2CardDetails.jsx'),
      'utf8'
    )

    expect(genModalSrc).toContain('resolveShop2BufferRowRouting')
    expect(activeCardsSrc).toContain('resolveShop2CardDisplayInfo')
    expect(paintingListSrc).toContain('Shop2PaintingBadge')
    expect(pressingListSrc).toContain('Shop2PaintingBadge')
    expect(shop2DetailsSrc).toContain('Shop2PaintingBadge')
  })
})

