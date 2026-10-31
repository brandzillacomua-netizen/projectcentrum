import React, { useState } from 'react'
import {
  Calculator,
  ArrowLeft,
  Sparkles,
  RefreshCw
} from 'lucide-react'

import { useProductCalculator } from './hooks/useProductCalculator.js'
import { CalculatorProductSelector } from './components/CalculatorProductSelector.jsx'
import { CalculatorBreakdownTable } from './components/CalculatorBreakdownTable.jsx'
import { CalculatorMaterialSummary } from './components/CalculatorMaterialSummary.jsx'
import { CalculatorStockStatus } from './components/CalculatorStockStatus.jsx'
import { CalculatorPrintModal } from './components/CalculatorPrintModal.jsx'
import './DirectorCalculatorStyles.css'

export function DirectorProductCalculator({ onBack }) {
  const {
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
  } = useProductCalculator()

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  const activeTitle = isScenarioMode
    ? `ЗВЕДЕНА ПАРТІЯ (${scenarioQueue.length} ВИРОБІВ)`
    : (selectedProduct?.name || 'ГОТОВИЙ ВИРІБ')

  return (
    <div className="calc-submodule-root">
      {/* Submodule Header */}
      <div className="calc-submodule-header">
        <div className="calc-submodule-title-group">
          <div className="calc-title-icon-badge">
            <Calculator size={22} className="text-orange" />
          </div>
          <div>
            <h2 className="calc-submodule-title">
              КАЛЬКУЛЯТОР ГОТОВИХ ВИРОБІВ
            </h2>
            <p className="calc-submodule-desc">
              Оперативний розрахунок потреби деталей, розкрою листів та матеріалів за специфікацією (BOM)
            </p>
          </div>
        </div>

        <div className="calc-header-actions">
          {onBack && (
            <button type="button" className="calc-btn-back" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>НАЗАД ДО ДАШБОРДУ</span>
            </button>
          )}
        </div>
      </div>

      {/* Product Selection & Calculation Controls */}
      <CalculatorProductSelector
        products={products}
        selectedProductId={selectedProductId}
        onSelectProduct={handleSelectProduct}
        quantity={quantity}
        onQuantityChange={setQuantity}
        useSGPStock={useSGPStock}
        onToggleSGPStock={setUseSGPStock}
        totals={totals}
        rowsCount={rows.length}
        isScenarioMode={isScenarioMode}
        onToggleScenarioMode={setIsScenarioMode}
        scenarioQueue={scenarioQueue}
        onAddToScenario={handleAddCurrentToScenario}
        onRemoveFromScenario={handleRemoveFromScenario}
        onClearScenario={handleClearScenario}
      />

      {/* Warehouse Stock Readiness & Quick Export Actions */}
      <CalculatorStockStatus
        productName={activeTitle}
        quantity={quantity}
        materials={materials}
        thicknesses={thicknesses}
        totals={totals}
        onPrint={() => setIsPrintModalOpen(true)}
      />

      {/* Materials Summary (Cards matching Image 2 & Millimeter breakdown) */}
      <CalculatorMaterialSummary
        materials={materials}
        thicknesses={thicknesses}
        totalSheets={totals.totalSheets}
      />

      {/* Detailed Parts Breakdown Table (Matching Image 2) */}
      <CalculatorBreakdownTable
        rows={filteredRows}
        totals={totals}
        thicknesses={thicknesses}
        selectedThickness={selectedThickness}
        onSelectThickness={setSelectedThickness}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUpdateSplit={handleUpdateSplit}
      />

      {/* Print / Export Modal */}
      <CalculatorPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        productName={activeTitle}
        quantity={quantity}
        rows={rows}
        totals={totals}
        materials={materials}
        thicknesses={thicknesses}
      />
    </div>
  )
}

export default DirectorProductCalculator

