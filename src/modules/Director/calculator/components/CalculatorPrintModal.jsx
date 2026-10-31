import React from 'react'
import { X, Printer } from 'lucide-react'

export function CalculatorPrintModal({
  isOpen,
  onClose,
  productName,
  quantity,
  rows = [],
  totals,
  materials = [],
  thicknesses = []
}) {
  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="calc-modal-overlay" onClick={onClose}>
      <div className="calc-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header no-print">
          <div className="calc-modal-title">
            <Printer size={18} className="text-orange" />
            <span>ДРУК КАЛЬКУЛЯЦІЇ ВИРОБУ</span>
          </div>
          <div className="calc-modal-header-actions">
            <button type="button" className="calc-btn-print" onClick={handlePrint}>
              <Printer size={16} />
              <span>Роздрукувати</span>
            </button>
            <button type="button" className="calc-btn-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Paper Document */}
        <div className="calc-print-paper">
          {/* Header */}
          <div className="print-header-block">
            <div className="print-title-row">
              <span className="print-brand">CENTRUM MES</span>
              <span className="print-badge">КАЛЬКУЛЯЦІЯ ГОТОВОГО ВИРОБУ</span>
            </div>
            <div className="print-meta-grid">
              <div><strong>Виріб:</strong> {productName}</div>
              <div><strong>Партія:</strong> {quantity.toLocaleString()} шт</div>
              <div><strong>Дата:</strong> {new Date().toLocaleDateString('uk-UA')}</div>
              <div><strong>Всього листів:</strong> {totals.totalSheets.toLocaleString()}</div>
            </div>
          </div>

          {/* Breakdown Table */}
          <table className="print-table">
            <thead>
              <tr>
                <th>ДЕТАЛЬ В РОЗКРІЙ</th>
                <th>ПОТРЕБА</th>
                <th>СГП</th>
                <th>ПЛАН</th>
                <th>МАТЕРІАЛ</th>
                <th>ШТ/Л</th>
                <th>ЛИСТІВ</th>
                <th>Т300</th>
                <th>Т700</th>
                <th>БЗ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{r.name}</strong>
                    {r.code && <small> ({r.code})</small>}
                  </td>
                  <td className="text-center">{r.totalNeeded}</td>
                  <td className="text-center">{r.inStockBZ}</td>
                  <td className="text-center"><strong>{r.planQty}</strong></td>
                  <td>{r.material}</td>
                  <td className="text-center">{r.unitsPerSheet}</td>
                  <td className="text-center"><strong>{r.totalSheets}</strong></td>
                  <td className="text-center">{r.sheetsT300}</td>
                  <td className="text-center">{r.sheetsT700}</td>
                  <td className="text-center">+{r.bzSurplus}</td>
                </tr>
              ))}
              <tr className="print-totals-row">
                <td><strong>ЗАГАЛЬНИЙ ПІДСУМОК:</strong></td>
                <td className="text-center">{totals.totalNeeded}</td>
                <td className="text-center">{totals.totalInStock}</td>
                <td className="text-center"><strong>{totals.totalPlan}</strong></td>
                <td colSpan="2"></td>
                <td className="text-center"><strong>{totals.totalSheets}</strong></td>
                <td className="text-center">{totals.sheetsT300}</td>
                <td className="text-center">{totals.sheetsT700}</td>
                <td className="text-center">+{totals.bzSurplus}</td>
              </tr>
            </tbody>
          </table>

          {/* Materials Summary */}
          <div className="print-materials-block">
            <h4 className="print-section-h">ВІДОМІСТЬ МАТЕРІАЛІВ:</h4>
            <div className="print-materials-grid">
              {materials.map((m, idx) => (
                <div key={idx} className="print-mat-item">
                  <span className="print-mat-name">{m.name}:</span>
                  <span className="print-mat-val">{m.sheets} листів</span>
                  <span className="print-mat-sub">(Склад: {m.stockAvailable})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Thickness Summary */}
          <div className="print-materials-block">
            <h4 className="print-section-h">ЗВЕДЕННЯ ПО МІЛІМЕТРАХ:</h4>
            <div className="print-thickness-grid">
              {thicknesses.map((t, idx) => (
                <div key={idx} className="print-thick-item">
                  <strong>{t.thickness} мм:</strong> {t.sheets} листів ({t.partsCount} типорозмірів)
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

