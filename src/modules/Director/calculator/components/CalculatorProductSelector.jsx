import React from 'react'
import {
  Package,
  Layers,
  Calculator,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Search
} from 'lucide-react'

import { CalculatorProductSearchSelect } from './CalculatorProductSearchSelect.jsx'

export function CalculatorProductSelector({
  products = [],
  selectedProductId,
  onSelectProduct,
  quantity,
  onQuantityChange,
  useSGPStock,
  onToggleSGPStock,
  totals,
  rowsCount,
  isScenarioMode,
  onToggleScenarioMode,
  scenarioQueue = [],
  onAddToScenario,
  onRemoveFromScenario,
  onClearScenario
}) {
  const quickQtys = [100, 500, 1000, 2500, 5000]

  return (
    <div className="calc-selector-card">
      <div className="calc-selector-top">
        {/* Left: Product Selector with fast search */}
        <div className="calc-product-select-group">
          <label className="calc-field-label">
            <Package size={14} className="text-orange" />
            <span>ОБЕРІТЬ ГОТОВИЙ ВИРІБ АБО ВВЕДІТЬ НАЗВУ / КОД:</span>
          </label>
          <CalculatorProductSearchSelect
            products={products}
            value={selectedProductId}
            onChange={onSelectProduct}
            disabled={isScenarioMode}
            placeholder="Швидкий пошук (напр. 610, KHARAК, назва або код)..."
          />
        </div>

        {/* Middle: Quantity Input with quick buttons */}
        <div className="calc-qty-group">
          <label className="calc-field-label">
            <Calculator size={14} className="text-orange" />
            <span>КІЛЬКІСТЬ ВИРОБІВ (ШТ):</span>
          </label>
          <div className="calc-qty-input-row">
            <input
              type="number"
              min="1"
              step="1"
              className="calc-qty-input"
              value={quantity}
              onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isScenarioMode}
            />
            <div className="calc-quick-chips">
              {quickQtys.map(q => (
                <button
                  key={q}
                  type="button"
                  className={`calc-quick-chip ${quantity === q && !isScenarioMode ? 'active' : ''}`}
                  onClick={() => onQuantityChange(q)}
                  disabled={isScenarioMode}
                >
                  +{q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: SGP Option & Scenario Button */}
        <div className="calc-options-group">
          <label className="calc-field-label">
            <Layers size={14} className="text-orange" />
            <span>НАЛАШТУВАННЯ:</span>
          </label>
          <div className="calc-options-row">
            <label className="calc-checkbox-label" title="Віднімати наявний складський залишок готових деталей від потреби">
              <input
                type="checkbox"
                checked={useSGPStock}
                onChange={(e) => onToggleSGPStock(e.target.checked)}
                style={{ display: 'none' }}
              />
              <span className={`calc-checkbox-box ${useSGPStock ? 'checked' : ''}`}>
                {useSGPStock ? <CheckSquare size={16} /> : <Square size={16} />}
              </span>
              <span className="calc-checkbox-text">Враховувати готові залишки з СГП</span>
            </label>

            <button
              type="button"
              className={`calc-btn-scenario ${isScenarioMode ? 'active' : ''}`}
              onClick={onAddToScenario}
              title="Додати цей виріб у зведений план розрахунку партії"
            >
              <Plus size={14} />
              <span>+ У партію</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scenario Queue Bar (if scenario mode active or has items) */}
      {scenarioQueue.length > 0 && (
        <div className="calc-scenario-bar">
          <div className="calc-scenario-header">
            <div className="calc-scenario-title">
              <Sparkles size={14} className="text-orange" />
              <span>ЗВЕДЕНИЙ ПЛАН РОЗРАХУНКУ ПАРТІЇ ({scenarioQueue.length} виробів):</span>
            </div>
            <div className="calc-scenario-actions">
              <button
                type="button"
                className={`calc-scenario-toggle ${isScenarioMode ? 'active' : ''}`}
                onClick={() => onToggleScenarioMode(!isScenarioMode)}
              >
                {isScenarioMode ? 'Розраховувати всю партію' : 'Тільки активний виріб'}
              </button>
              <button
                type="button"
                className="calc-scenario-clear"
                onClick={onClearScenario}
                title="Очистити список партії"
              >
                <Trash2 size={13} />
                <span>Очистити</span>
              </button>
            </div>
          </div>

          <div className="calc-scenario-chips">
            {scenarioQueue.map(item => (
              <div key={item.id} className="calc-scenario-chip">
                <span className="calc-scenario-name">{item.productName}</span>
                <span className="calc-scenario-qty">{item.quantity} шт</span>
                <button
                  type="button"
                  className="calc-scenario-remove"
                  onClick={() => onRemoveFromScenario(item.id)}
                  title="Видалити з партії"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick KPI Stat Bar */}
      <div className="calc-kpi-bar">
        <div className="calc-kpi-cell">
          <span className="calc-kpi-label">ПОТРЕБА ДЕТАЛЕЙ</span>
          <span className="calc-kpi-val text-orange">{totals.totalNeeded.toLocaleString()} <small>шт</small></span>
        </div>
        <div className="calc-kpi-divider" />
        <div className="calc-kpi-cell">
          <span className="calc-kpi-label">ЗАЛИШОК СГП</span>
          <span className="calc-kpi-val text-muted">{totals.totalInStock.toLocaleString()} <small>шт</small></span>
        </div>
        <div className="calc-kpi-divider" />
        <div className="calc-kpi-cell">
          <span className="calc-kpi-label">ПЛАН У РОЗКРІЙ</span>
          <span className="calc-kpi-val text-orange">{totals.totalPlan.toLocaleString()} <small>шт</small></span>
        </div>
        <div className="calc-kpi-divider" />
        <div className="calc-kpi-cell highlight-purple">
          <span className="calc-kpi-label">ЗАГАЛОМ ЛИСТІВ</span>
          <span className="calc-kpi-val text-purple">{totals.totalSheets.toLocaleString()} <small>листів</small></span>
        </div>
        <div className="calc-kpi-divider" />
        <div className="calc-kpi-cell">
          <span className="calc-kpi-label">ПЕРЕХІДНИЙ ЗАЛИШОК (БЗ)</span>
          <span className="calc-kpi-val text-yellow">+{totals.bzSurplus.toLocaleString()} <small>шт</small></span>
        </div>
        <div className="calc-kpi-divider" />
        <div className="calc-kpi-cell">
          <span className="calc-kpi-label">ТИПОРОЗМІРІВ ДЕТАЛЕЙ</span>
          <span className="calc-kpi-val text-dim">{rowsCount} <small>поз.</small></span>
        </div>
      </div>
    </div>
  )
}

