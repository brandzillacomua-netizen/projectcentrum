import { useState, useMemo, useCallback, useEffect } from 'react'
import { useMES } from '../../../../MESContext'
import { useStore } from '../../../../store/index.js'
import {
  getFinishedProducts,
  calculateProductBreakdown,
  calculateMaterialSummary
} from '../utils/calculatorHelpers.js'

export function useProductCalculator() {
  const mes = useMES() || {}

  const storeNomenclatures = useStore(state => state.nomenclatures) || []
  const mesNomenclatures = mes.nomenclatures || []
  const nomenclatures = mesNomenclatures.length > 0 ? mesNomenclatures : storeNomenclatures

  const storeBomItems = useStore(state => state.bomItems) || []
  const mesBomItems = mes.bomItems || []
  const rawBomItems = mesBomItems.length > 0 ? mesBomItems : storeBomItems

  const storeInventory = useStore(state => state.inventory) || []
  const mesInventory = mes.inventory || []
  const inventory = mesInventory.length > 0 ? mesInventory : storeInventory

  // Ensure fresh bom_items and inventory are loaded
  useEffect(() => {
    if (mes.fetchData) {
      mes.fetchData(['nomenclatures', 'bom_items', 'inventory']).catch(() => {})
    }
  }, [mes.fetchData])

  const [extraBomItems, setExtraBomItems] = useState([])

  // Combined BOM items
  const bomItems = useMemo(() => {
    if (extraBomItems.length === 0) return rawBomItems
    const map = new Map(rawBomItems.map(i => [i.id || `${i.parent_id}_${i.child_id}`, i]))
    extraBomItems.forEach(i => map.set(i.id || `${i.parent_id}_${i.child_id}`, i))
    return Array.from(map.values())
  }, [rawBomItems, extraBomItems])

  // All finished products
  const products = useMemo(() => {
    return getFinishedProducts(nomenclatures, bomItems)
  }, [nomenclatures, bomItems])

  // Active product selection & batch quantity
  const [selectedProductId, setSelectedProductId] = useState(() => {
    return products[0]?.id || null
  })

  // Synchronize when products load if nothing was selected
  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  // If BOM for the selected product isn't in memory yet, query Supabase directly
  useEffect(() => {
    if (!selectedProductId || !mes.supabase) return
    const prod = nomenclatures.find(n => String(n.id) === String(selectedProductId))
    const ids = [
      String(selectedProductId),
      ...(prod?.legacy_ids || []).map(String),
      ...(prod?.nomenclature_code ? [String(prod.nomenclature_code)] : [])
    ].filter(Boolean)

    const hasInCurrentBOM = bomItems.some(b => ids.includes(String(b.parent_id)))
    if (!hasInCurrentBOM) {
      mes.supabase
        .from('bom_items')
        .select('*')
        .in('parent_id', ids)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setExtraBomItems(prev => {
              const map = new Map(prev.map(i => [i.id || `${i.parent_id}_${i.child_id}`, i]))
              data.forEach(i => map.set(i.id || `${i.parent_id}_${i.child_id}`, i))
              return Array.from(map.values())
            })
          }
        })
        .catch(() => {})
    }
  }, [selectedProductId, mes.supabase, bomItems, nomenclatures])

  const [quantity, setQuantity] = useState(1000)
  const [useSGPStock, setUseSGPStock] = useState(false)
  const [materialSplits, setMaterialSplits] = useState({})

  // Multi-item scenario queue (planning multiple products together)
  const [scenarioQueue, setScenarioQueue] = useState([])
  const [isScenarioMode, setIsScenarioMode] = useState(false)

  // Table filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedThickness, setSelectedThickness] = useState('all')

  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProductId)) || null
  }, [products, selectedProductId])

  // Active items to calculate
  const activeCalculationItems = useMemo(() => {
    if (isScenarioMode && scenarioQueue.length > 0) {
      return scenarioQueue.map(item => ({
        productNom: nomenclatures.find(n => String(n.id) === String(item.productId)),
        quantity: item.quantity
      })).filter(i => i.productNom && i.quantity > 0)
    }

    if (selectedProduct && quantity > 0) {
      return [{ productNom: selectedProduct, quantity }]
    }

    return []
  }, [isScenarioMode, scenarioQueue, selectedProduct, quantity, nomenclatures])

  // Breakdown rows & totals
  const { rows, totals } = useMemo(() => {
    return calculateProductBreakdown({
      items: activeCalculationItems,
      useSGPStock,
      inventory,
      bomItems,
      nomenclatures,
      materialSplits
    })
  }, [activeCalculationItems, useSGPStock, inventory, bomItems, nomenclatures, materialSplits])

  // Materials & Thicknesses summary
  const { materials, thicknesses } = useMemo(() => {
    return calculateMaterialSummary(rows, inventory)
  }, [rows, inventory])

  // Filtered rows for the table view
  const filteredRows = useMemo(() => {
    let result = rows

    if (selectedThickness && selectedThickness !== 'all') {
      result = result.filter(r => String(r.thickness) === String(selectedThickness))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(r =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.code && r.code.toLowerCase().includes(q)) ||
        (r.material && r.material.toLowerCase().includes(q))
      )
    }

    return result
  }, [rows, selectedThickness, searchQuery])

  // Handlers
  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id)
    setMaterialSplits({})
  }, [])

  const handleUpdateSplit = useCallback((nomId, t300, t700) => {
    setMaterialSplits(prev => ({
      ...prev,
      [nomId]: { t300: Number(t300) || 0, t700: Number(t700) || 0 }
    }))
  }, [])

  const handleAddCurrentToScenario = useCallback(() => {
    if (!selectedProduct || quantity <= 0) return
    setScenarioQueue(prev => {
      const existingIdx = prev.findIndex(item => String(item.productId) === String(selectedProduct.id))
      if (existingIdx >= 0) {
        const next = [...prev]
        next[existingIdx].quantity += quantity
        return next
      }
      return [...prev, {
        id: `sc_${Date.now()}_${selectedProduct.id}`,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity
      }]
    })
    setIsScenarioMode(true)
  }, [selectedProduct, quantity])

  const handleRemoveFromScenario = useCallback((id) => {
    setScenarioQueue(prev => prev.filter(i => i.id !== id))
  }, [])

  const handleClearScenario = useCallback(() => {
    setScenarioQueue([])
    setIsScenarioMode(false)
  }, [])

  return {
    products,
    selectedProductId,
    selectedProduct,
    quantity,
    setQuantity,
    useSGPStock,
    setUseSGPStock,
    materialSplits,
    handleUpdateSplit,
    isScenarioMode,
    setIsScenarioMode,
    scenarioQueue,
    handleAddCurrentToScenario,
    handleRemoveFromScenario,
    handleClearScenario,
    rows,
    filteredRows,
    totals,
    materials,
    thicknesses,
    searchQuery,
    setSearchQuery,
    selectedThickness,
    setSelectedThickness,
    handleSelectProduct
  }
}

