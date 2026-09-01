import { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'

export const useEconomyData = () => {
  const { nomenclatures = [], bomItems = [], orders = [] } = useMES()

  // 1. Price lists state (persisted in localStorage + Supabase sync)
  const [pricesMap, setPricesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_nomenclature_prices_v1')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // 2. Standard Operation Rates state (rates per process step or machine hour)
  const [costRates, setCostRates] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_cost_rates_v1')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      cuttingRatePerHour: 140,     // Розкрій металу (грн/год)
      tumblingRatePerHour: 90,     // Галтовка (грн/год)
      brazingRatePerHour: 180,      // Пайка/Зварювання (грн/год)
      grindingRatePerHour: 320,     // Заточування & ЧПК шліфування (грн/год)
      packagingRatePerHour: 110,    // Пакування & Маркування (грн/год)
      overheadPercentage: 15,       // Накладні витрати цеху (%)
      targetMarginPercentage: 35,   // Цільова маржинальність (%)
      retailMarkupPercentage: 25,   // Націнка Роздрібу (%)
      dealerDiscountPercentage: 10  // Знижка Дилера (%)
    }
  })

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('centrum_nomenclature_prices_v1', JSON.stringify(pricesMap))
    } catch (e) {}
  }, [pricesMap])

  useEffect(() => {
    try {
      localStorage.setItem('centrum_cost_rates_v1', JSON.stringify(costRates))
    } catch (e) {}
  }, [costRates])

  // 3. Fetch Nomenclature V2 items & catalog groups from Supabase
  const [v2Items, setV2Items] = useState([])
  const [v2Groups, setV2Groups] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('nomenclatures_v2').select('*'),
      supabase.from('nomenclature_catalog_groups').select('*')
    ]).then(([resItems, resGroups]) => {
      if (active) {
        if (resItems.data) setV2Items(resItems.data)
        if (resGroups.data) setV2Groups(resGroups.data)
      }
    }).catch(() => {})

    return () => { active = false }
  }, [])

  // Default ERP Groups definition matching NomenclatureV2
  const DEFAULT_GROUPS = useMemo(() => [
    { id: 'cat_raw', code: 'RAW', name: '01. Сировина та матеріали', parent_id: null },
    { id: 'grp_carbon_sheets', code: 'RAW.CARBON', name: 'Карбонові листи', parent_id: 'cat_raw' },
    { id: 'grp_carbon_t300', code: 'RAW.CARBON.T300', name: 'Карбонова пластина Т300', parent_id: 'grp_carbon_sheets', rule_type: 'carbon' },
    { id: 'grp_carbon_t700', code: 'RAW.CARBON.T700', name: 'Карбонова пластина Т700', parent_id: 'grp_carbon_sheets', rule_type: 'carbon' },
    { id: 'grp_carbon_t800', code: 'RAW.CARBON.T800', name: 'Карбонова пластина Т800', parent_id: 'grp_carbon_sheets', rule_type: 'carbon' },
    { id: 'grp_rubber', code: 'RAW.RUBBER', name: 'Гума еластична листова', parent_id: 'cat_raw', rule_type: 'rubber' },
    { id: 'grp_paint', code: 'RAW.PAINT', name: 'Лакофарбові матеріали', parent_id: 'cat_raw', rule_type: 'paint' },
    { id: 'grp_mills', code: 'RAW.MILL', name: 'Фрези', parent_id: 'cat_raw', rule_type: 'mill' },

    { id: 'cat_hw', code: 'HW', name: '02. Комплектуючі та Метизи', parent_id: null },
    { id: 'grp_hardware_main', code: 'HW.FASTENERS', name: 'Метизи', parent_id: 'cat_hw' },
    { id: 'grp_screws_black', code: 'HW.SCREW.BLACK', name: 'Гвинт (чорний)', parent_id: 'grp_hardware_main', rule_type: 'screw_black' },
    { id: 'grp_screws_silver', code: 'HW.SCREW.SILVER', name: 'Гвинти (срібні)', parent_id: 'grp_hardware_main', rule_type: 'screw_silver' },
    { id: 'grp_nuts', code: 'HW.NUT', name: 'Гайки', parent_id: 'grp_hardware_main', rule_type: 'nut' },
    { id: 'grp_press_nuts', code: 'HW.PRESS_NUT', name: 'Гайки запресовочні', parent_id: 'grp_hardware_main', rule_type: 'press_nut' },
    { id: 'grp_components_main', code: 'HW.COMPONENTS', name: 'Комплектуючі', parent_id: 'cat_hw' },
    { id: 'grp_standoffs', code: 'HW.STANDOFF', name: 'Стійки міжплатні', parent_id: 'grp_components_main', rule_type: 'standoff' },

    { id: 'cat_parts', code: 'PARTS', name: '03. Деталі', parent_id: null, rule_type: 'frame_part' },

    { id: 'cat_fg', code: 'FG', name: '04. Готова продукція', parent_id: null, rule_type: 'full_frame' },
    { id: 'grp_production_frames', code: 'FG.PRODUCTION', name: 'Продакшн', parent_id: 'cat_fg', rule_type: 'full_frame' },
    { id: 'grp_test_samples', code: 'FG.TEST_SAMPLE', name: 'Тестові зразки', parent_id: 'cat_fg', rule_type: 'full_frame' }
  ], [])

  // Enriched Nomenclatures - Strictly V2 Catalog Items with exact V2 Category Names
  const enrichedNomenclatures = useMemo(() => {
    const allGroups = [...DEFAULT_GROUPS, ...v2Groups]
    const groupById = new Map(allGroups.map(g => [g.id, g]))

    // Helper to resolve exact category name assigned in Nomenclature v2.0
    const resolveCategory = (v2) => {
      // 1. Direct group lookup from v2.group_id
      const g = groupById.get(v2.group_id)
      if (g && g.name) {
        return g.name
      }

      // 2. Rule type lookup
      const rType = v2.rule_type || g?.rule_type
      if (rType === 'carbon') return 'Карбонові листи'
      if (rType === 'rubber') return 'Гума еластична листова'
      if (rType === 'paint') return 'Лакофарбові матеріали'
      if (rType === 'mill') return 'Фрези'
      if (rType === 'screw' || rType === 'screw_black' || rType === 'screw_silver' || rType === 'nut' || rType === 'press_nut') return 'Метизи'
      if (rType === 'standoff') return 'Комплектуючі'
      if (rType === 'frame_part') return '03. Деталі'
      if (rType === 'full_frame' || rType === 'element_kit') return '04. Готова продукція'

      // 3. Name-based fallback
      const nameLower = (v2.name || '').toLowerCase()
      if (nameLower.includes('карбон') || nameLower.includes('пластина') || nameLower.includes('т300') || nameLower.includes('т700') || nameLower.includes('т800') || nameLower.includes('лист')) return 'Карбонові листи'
      if (nameLower.includes('гума')) return 'Гума еластична листова'
      if (nameLower.includes('фрез') || nameLower.includes('свердл')) return 'Фрези'
      if (nameLower.includes('гвинт') || nameLower.includes('гайка') || nameLower.includes('шайба') || nameLower.includes('метиз') || nameLower.includes('din') || nameLower.includes('iso')) return 'Метизи'
      if (nameLower.includes('стійка')) return 'Комплектуючі'
      if (nameLower.includes('рама') || nameLower.includes('комплект рами') || nameLower.includes('kharak') || nameLower.includes('drozd') || nameLower.includes('bita')) return '04. Готова продукція'
      if (nameLower.includes('kr-') || nameLower.includes('кн-') || nameLower.includes('деталь')) return '03. Деталі'

      return '01. Сировина та матеріали'
    }

    if (v2Items && v2Items.length > 0) {
      return v2Items.map(v2 => ({
        id: v2.id,
        code: v2.code || `V2-${v2.id}`,
        name: v2.name,
        category: resolveCategory(v2),
        unit: v2.unit || 'шт',
        v2GroupId: v2.group_id,
        v2RuleType: v2.rule_type,
        price: v2.price || 0
      }))
    }

    // Fallback if V2 table is loading or offline
    return (nomenclatures || []).map(item => ({
      ...item,
      category: resolveCategory(item)
    }))
  }, [DEFAULT_GROUPS, nomenclatures, v2Items, v2Groups])

  // Fetch saved prices from Supabase DB on mount if table exists
  useEffect(() => {
    let active = true
    supabase.from('nomenclature_prices').select('*').then(({ data, error }) => {
      if (!error && Array.isArray(data) && active && data.length > 0) {
        const map = {}
        data.forEach(item => {
          map[item.nomenclature_id] = {
            wholesalePrice: item.wholesale_price || 0,
            retailPrice: item.retail_price || 0,
            dealerPrice: item.dealer_price || 0,
            minPrice: item.min_price || 0,
            rawMaterialCost: item.raw_material_cost || 0,
            currency: item.currency || 'UAH',
            updatedAt: item.updated_at
          }
        })
        setPricesMap(prev => ({ ...map, ...prev }))
      }
    }).catch(() => {})

    return () => { active = false }
  }, [])

  // Calculate detailed COGS (Собівартість) for a nomenclature item
  const calculateItemCost = (nomenclatureId, depth = 0) => {
    if (depth > 5) return { materialCost: 0, directLaborCost: 0, overheadCost: 0, totalUnitCost: 0, recommendedPrice: 0, marginAmount: 0, marginPercentage: 0, materialsBreakdown: [], isAutoCalculated: false }

    const item = enrichedNomenclatures.find(n => String(n.id) === String(nomenclatureId))
    if (!item) return null

    const pRecord = pricesMap[nomenclatureId] || {}

    // 1. Direct Material Cost from BOM items
    const relatedBom = bomItems.filter(b => String(b.parent_id || b.nomenclature_id) === String(nomenclatureId))
    
    let materialCost = 0
    let isAutoCalculated = false

    const materialsBreakdown = relatedBom.map(b => {
      const childId = b.child_id || b.component_id || b.child_nomenclature_id
      const childItem = enrichedNomenclatures.find(n => String(n.id) === String(childId))
      const priceRecord = pricesMap[childId] || {}
      
      const qty = Number(b.quantity || b.quantity_per_parent || b.qty || 1)

      // Check if child itself has BOM (multi-level assembly)
      const childBomExists = bomItems.some(sub => String(sub.parent_id || sub.nomenclature_id) === String(childId))
      
      let unitCost = 0
      if (childBomExists) {
        const childCosting = calculateItemCost(childId, depth + 1)
        unitCost = childCosting?.totalUnitCost || childCosting?.materialCost || 0
      } else {
        unitCost = Number(priceRecord.rawMaterialCost || priceRecord.wholesalePrice || childItem?.price || 0)
      }

      const total = unitCost * qty
      materialCost += total
      isAutoCalculated = true

      return {
        id: b.id,
        name: childItem ? childItem.name : (b.component_name || 'Компонент / Метиз'),
        code: childItem?.code || '—',
        category: childItem?.category || 'Деталь/Метиз/Сировина',
        quantity: qty,
        unitCost,
        total
      }
    })

    // If no BOM items found, check V2 rule_params (e.g. unitsPerSheet for parts)
    if (materialsBreakdown.length === 0) {
      const ruleParams = item.v2RuleParams || item.rule_params || {}
      const unitsPerSheet = Number(ruleParams.unitsPerSheet || ruleParams.parts_per_sheet || 0)
      
      if (unitsPerSheet > 0) {
        // Find matching raw sheet item (e.g. Sheet T300)
        const sheetGrade = ruleParams.sheetGrade || ruleParams.grade || 'Т300'
        const sheetThick = ruleParams.sheetThickness || ruleParams.thickness || ''
        
        const rawSheet = enrichedNomenclatures.find(n => {
          const nameL = (n.name || '').toLowerCase()
          return nameL.includes('лист') || nameL.includes('карбон') || (nameL.includes(sheetGrade.toLowerCase()) && (!sheetThick || nameL.includes(sheetThick)))
        })

        if (rawSheet) {
          const sheetPrice = Number(pricesMap[rawSheet.id]?.rawMaterialCost || pricesMap[rawSheet.id]?.wholesalePrice || rawSheet.price || 2000)
          materialCost = Math.round(sheetPrice / unitsPerSheet)
          isAutoCalculated = true
          materialsBreakdown.push({
            id: `sheet-${rawSheet.id}`,
            name: `${rawSheet.name} (1/${unitsPerSheet} листа)`,
            code: rawSheet.code,
            category: 'Сировина (Карбоновий лист)',
            quantity: Number((1 / unitsPerSheet).toFixed(4)),
            unitCost: sheetPrice,
            total: materialCost
          })
        }
      }
    }

    // Fallback to manually saved raw material cost or item price if available
    if (materialCost === 0) {
      materialCost = Number(pRecord.rawMaterialCost || item.price || 0)
    }

    // 2. Operational & Labor Cost (Calculated only if material cost > 0 or BOM exists)
    let directLaborCost = 0
    if (materialCost > 0 && (item.category?.includes('Детал') || item.category?.includes('Продакшн') || item.category?.includes('Готова'))) {
      const cuttingCost = (15 / 60) * costRates.cuttingRatePerHour      // 15 хв на розкрій
      const tumblingCost = (20 / 60) * costRates.tumblingRatePerHour    // 20 хв на галтовку
      const grindingCost = (35 / 60) * costRates.grindingRatePerHour    // 35 хв на шліфування
      const packagingCost = (10 / 60) * costRates.packagingRatePerHour  // 10 хв на пакування
      directLaborCost = Math.round(cuttingCost + tumblingCost + grindingCost + packagingCost)
    }

    // 3. Overhead Expense (Накладні витрати)
    const overheadCost = (materialCost > 0 || directLaborCost > 0) ? Math.round((materialCost + directLaborCost) * (costRates.overheadPercentage / 100)) : 0

    // Total Unit COGS (Загальна собівартість)
    const totalUnitCost = (materialCost > 0 || directLaborCost > 0) ? Math.round(materialCost + directLaborCost + overheadCost) : 0

    // Recommended Price based on target margin
    const targetMarginRatio = costRates.targetMarginPercentage / 100
    const recommendedPrice = totalUnitCost > 0 ? (targetMarginRatio < 1 ? Math.round(totalUnitCost / (1 - targetMarginRatio)) : Math.round(totalUnitCost * 1.5)) : 0
    const marginAmount = recommendedPrice - totalUnitCost
    const marginPercentage = recommendedPrice > 0 ? Math.round((marginAmount / recommendedPrice) * 100) : 0

    return {
      nomenclatureId,
      name: item.name,
      code: item.code,
      category: item.category || 'Готова Продукція',
      materialCost,
      directLaborCost,
      overheadCost,
      totalUnitCost,
      recommendedPrice,
      marginAmount,
      marginPercentage,
      materialsBreakdown,
      isAutoCalculated
    }
  }

  // Update item prices
  const updateItemPrice = async (nomenclatureId, priceData) => {
    setPricesMap(prev => ({
      ...prev,
      [nomenclatureId]: {
        ...(prev[nomenclatureId] || {}),
        ...priceData,
        updatedAt: new Date().toISOString()
      }
    }))

    // Try async save to Supabase
    try {
      await supabase.from('nomenclature_prices').upsert({
        nomenclature_id: nomenclatureId,
        wholesale_price: priceData.wholesalePrice,
        retail_price: priceData.retailPrice,
        dealer_price: priceData.dealerPrice,
        min_price: priceData.minPrice,
        raw_material_cost: priceData.rawMaterialCost,
        currency: priceData.currency || 'UAH',
        updated_at: new Date().toISOString()
      })
    } catch (e) {
      console.warn('Failed to upsert price to DB:', e)
    }
  }

  // Bulk update prices by category percentage
  const bulkUpdateCategoryPrices = (category, percentChange, field = 'wholesalePrice') => {
    const targetItems = nomenclatures.filter(n => !category || category === 'all' || n.category === category)
    const multiplier = 1 + (percentChange / 100)

    setPricesMap(prev => {
      const nextMap = { ...prev }
      targetItems.forEach(item => {
        const currentVal = nextMap[item.id]?.[field] || item.price || 100
        const newVal = Math.round(currentVal * multiplier)
        nextMap[item.id] = {
          ...(nextMap[item.id] || {}),
          [field]: newVal,
          updatedAt: new Date().toISOString()
        }
      })
      return nextMap
    })
  }

  return {
    nomenclatures: enrichedNomenclatures,
    bomItems,
    orders,
    pricesMap,
    costRates,
    setCostRates,
    calculateItemCost,
    updateItemPrice,
    bulkUpdateCategoryPrices
  }
}
