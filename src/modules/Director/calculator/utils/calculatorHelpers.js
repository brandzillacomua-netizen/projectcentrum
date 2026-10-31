import { getAvailableSGPStock, extractThickness } from '../../../Nomenclature/utils/nomenclatureHelpers.js'
import { getNomUnitsPerSheet } from '../../../../utils/unitsHelper.js'

/**
 * Filter finished products that can be calculated.
 * Includes items with type='product' or type='assembly', or any item having children in bomItems.
 */
export const getFinishedProducts = (nomenclatures = [], bomItems = []) => {
  if (!Array.isArray(nomenclatures)) return []
  const parentIdsWithBOM = new Set((bomItems || []).map(b => String(b.parent_id)))

  return nomenclatures
    .filter(n => {
      if (!n) return false
      const type = String(n.type || '').toLowerCase()
      const isProductType = type === 'product' || type === 'assembly' || type === 'finished'
      const hasBOM = parentIdsWithBOM.has(String(n.id)) ||
        (Array.isArray(n.legacy_ids) && n.legacy_ids.some(lid => parentIdsWithBOM.has(String(lid))))
      return isProductType || hasBOM
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uk-UA'))
}

/**
 * Extracts BOM parts for a given nomenclature.
 * Flattens subassemblies if needed so all cutting parts are visible.
 * Supports canonical UUIDs, legacy_ids, and nomenclature_code matching.
 */
export const getBOMPartsForProduct = (productId, bomItems = [], nomenclatures = [], depth = 0) => {
  if (!productId || depth > 5) return []
  const productNom = (nomenclatures || []).find(n => String(n.id) === String(productId))
  
  const parentIds = new Set([
    String(productId),
    ...(productNom?.legacy_ids || []).map(String),
    ...(productNom?.nomenclature_code ? [String(productNom.nomenclature_code)] : [])
  ].filter(Boolean))

  // 1. Direct BOM items matching parent ID or any legacy ID
  const directBOM = (bomItems || []).filter(b => parentIds.has(String(b.parent_id)))

  if (directBOM.length === 0) {
    return productNom ? [{ nom: productNom, quantity_per_parent: 1 }] : []
  }

  const result = []
  directBOM.forEach(b => {
    const childNom = (nomenclatures || []).find(n =>
      String(n.id) === String(b.child_id) ||
      (Array.isArray(n.legacy_ids) && n.legacy_ids.map(String).includes(String(b.child_id))) ||
      (n.nomenclature_code && String(n.nomenclature_code) === String(b.child_id))
    )
    if (!childNom) return

    const qty = Number(b.quantity_per_parent) || 1
    const childType = String(childNom.type || '').toLowerCase()

    // If subassembly has its own children and is not a leaf part, expand it
    const subParentIds = new Set([
      String(childNom.id),
      ...(childNom.legacy_ids || []).map(String),
      ...(childNom.nomenclature_code ? [String(childNom.nomenclature_code)] : [])
    ].filter(Boolean))
    const subChildren = (bomItems || []).filter(sub => subParentIds.has(String(sub.parent_id)))

    if (subChildren.length > 0 && (childType === 'assembly' || childType === 'subassembly')) {
      const subParts = getBOMPartsForProduct(childNom.id, bomItems, nomenclatures, depth + 1)
      subParts.forEach(sp => {
        result.push({
          nom: sp.nom,
          quantity_per_parent: (Number(sp.quantity_per_parent) || 1) * qty,
          parentAssembly: childNom.name
        })
      })
    } else {
      result.push({
        nom: childNom,
        quantity_per_parent: qty
      })
    }
  })

  return result
}

/**
 * Calculates complete breakdown of parts, sheets, and materials for selected products.
 */
export const calculateProductBreakdown = ({
  items = [], // array of { productNom, quantity }
  useSGPStock = true,
  inventory = [],
  bomItems = [],
  nomenclatures = [],
  materialSplits = {}
}) => {
  const rows = []

  items.forEach(({ productNom, quantity }) => {
    if (!productNom || quantity <= 0) return

    const parts = getBOMPartsForProduct(productNom.id, bomItems, nomenclatures)

    parts.forEach(part => {
      const nom = part.nom
      if (!nom) return

      const nomType = String(nom.type || '').toLowerCase()
      // Skip pure non-cutting fasteners or standard hardware
      if (nomType === 'hardware' || nomType === 'fastener' || nomType === 'consumable') {
        return
      }

      const totalNeeded = Math.round(quantity * (Number(part.quantity_per_parent) || 1))
      const inStockBZ = useSGPStock ? getAvailableSGPStock(nom, inventory) : 0
      const planQty = useSGPStock ? Math.max(0, totalNeeded - inStockBZ) : totalNeeded

      const unitsPerSheet = Math.max(1, getNomUnitsPerSheet(nom))
      const totalSheets = Math.ceil(planQty / Math.max(1, unitsPerSheet))

      // Material type and grade default
      const matName = nom.material_type || nom.name || 'Лист (3мм)'
      const isDefaultT700 = matName.toLowerCase().includes('т700') || matName.toLowerCase().includes('t700')

      const split = materialSplits[nom.id] || {}
      const sheetsT300 = split.t300 !== undefined ? Number(split.t300) : (isDefaultT700 ? 0 : totalSheets)
      const sheetsT700 = split.t700 !== undefined ? Number(split.t700) : (isDefaultT700 ? totalSheets : 0)

      // Safe buffer surplus pieces from cutting full sheets
      const bzSurplus = Math.max(0, (totalSheets * unitsPerSheet) - planQty)

      const thickness = extractThickness(nom.material_type) || extractThickness(nom.name) || '3'

      rows.push({
        id: `${productNom.id}_${nom.id}`,
        productId: productNom.id,
        productName: productNom.name,
        nomId: nom.id,
        name: nom.name,
        code: nom.nomenclature_code || '',
        material: nom.material_type || `Лист (${thickness}мм)`,
        thickness,
        quantityPerParent: Number(part.quantity_per_parent) || 1,
        unitsPerSheet,
        totalNeeded,
        inStockBZ,
        planQty,
        totalSheets,
        sheetsT300,
        sheetsT700,
        bzSurplus
      })
    })
  })

  // Summary totals
  const totals = rows.reduce(
    (acc, r) => {
      acc.totalNeeded += r.totalNeeded
      acc.totalInStock += r.inStockBZ
      acc.totalPlan += r.planQty
      acc.totalSheets += r.totalSheets
      acc.sheetsT300 += r.sheetsT300
      acc.sheetsT700 += r.sheetsT700
      acc.bzSurplus += r.bzSurplus
      return acc
    },
    {
      totalNeeded: 0,
      totalInStock: 0,
      totalPlan: 0,
      totalSheets: 0,
      sheetsT300: 0,
      sheetsT700: 0,
      bzSurplus: 0
    }
  )

  return { rows, totals }
}

/**
 * Aggregates materials into distinct cards grouped by material name, grade, and thickness in mm.
 * Matches Image 2: "Лист Т300 (2мм)", "Лист Т300 (3мм)", "Лист Т300 (8мм)", etc.
 */
export const calculateMaterialSummary = (rows = [], inventory = []) => {
  const materialMap = new Map()
  const thicknessMap = new Map()

  rows.forEach(r => {
    if (r.totalSheets <= 0) return

    // 1. T300 sheets breakdown
    if (r.sheetsT300 > 0) {
      const matKeyT300 = `Лист Т300 (${r.thickness}мм)`
      if (!materialMap.has(matKeyT300)) {
        materialMap.set(matKeyT300, {
          name: matKeyT300,
          grade: 'Т300',
          thickness: r.thickness,
          sheets: 0
        })
      }
      materialMap.get(matKeyT300).sheets += r.sheetsT300
    }

    // 2. T700 sheets breakdown
    if (r.sheetsT700 > 0) {
      const matKeyT700 = `Лист Т700 (${r.thickness}мм)`
      if (!materialMap.has(matKeyT700)) {
        materialMap.set(matKeyT700, {
          name: matKeyT700,
          grade: 'Т700',
          thickness: r.thickness,
          sheets: 0
        })
      }
      materialMap.get(matKeyT700).sheets += r.sheetsT700
    }

    // Fallback if split is 0 on both but totalSheets > 0
    if (r.sheetsT300 === 0 && r.sheetsT700 === 0) {
      const matKeyDefault = `Лист Т300 (${r.thickness}мм)`
      if (!materialMap.has(matKeyDefault)) {
        materialMap.set(matKeyDefault, {
          name: matKeyDefault,
          grade: 'Т300',
          thickness: r.thickness,
          sheets: 0
        })
      }
      materialMap.get(matKeyDefault).sheets += r.totalSheets
    }

    // 3. Overall thickness breakdown (by millimeter)
    const mmKey = `${r.thickness} мм`
    if (!thicknessMap.has(mmKey)) {
      thicknessMap.set(mmKey, {
        thickness: r.thickness,
        label: mmKey,
        sheets: 0,
        partsCount: 0
      })
    }
    const tEntry = thicknessMap.get(mmKey)
    tEntry.sheets += r.totalSheets
    tEntry.partsCount += 1
  })

  // Cross-reference with raw warehouse stock
  const materials = Array.from(materialMap.values()).map(m => {
    const stockAvailable = findRawStockForMaterial(m.grade, m.thickness, inventory)
    const deficit = Math.max(0, m.sheets - stockAvailable)
    return {
      ...m,
      stockAvailable,
      deficit,
      hasEnough: stockAvailable >= m.sheets
    }
  })

  // Sort by thickness ascending
  materials.sort((a, b) => parseFloat(a.thickness || '0') - parseFloat(b.thickness || '0'))

  const thicknesses = Array.from(thicknessMap.values()).sort(
    (a, b) => parseFloat(a.thickness || '0') - parseFloat(b.thickness || '0')
  )

  return { materials, thicknesses }
}

/**
 * Searches raw warehouse inventory for sheets matching grade and thickness.
 */
export const findRawStockForMaterial = (grade = 'Т300', thickness = '3', inventory = []) => {
  if (!Array.isArray(inventory) || !thickness) return 0
  const normGrade = grade.toUpperCase().replace('T', 'Т')
  const thickNum = parseFloat(thickness)

  const matchingItems = inventory.filter(i => {
    if (!i) return false
    const name = String(i.name || '').toUpperCase().replace('T', 'Т')
    // Exclude finished products, pocket items, or scrap
    if (name.includes('ПЛАСТИНА') || name.includes('ВІДХОД') || name.includes('БРУХТ')) return false

    const hasGrade = name.includes(normGrade)
    const isSheet = name.includes('ЛИСТ') || String(i.type || '').toLowerCase() === 'raw'
    if (!hasGrade && !isSheet) return false

    const iThick = extractThickness(name)
    if (!iThick) return false
    return Math.abs(parseFloat(iThick) - thickNum) < 0.05
  })

  return matchingItems.reduce((sum, item) => {
    const qty = Number(item.total_qty) || 0
    const res = Number(item.reserved_qty) || 0
    return sum + Math.max(0, qty - res)
  }, 0)
}
