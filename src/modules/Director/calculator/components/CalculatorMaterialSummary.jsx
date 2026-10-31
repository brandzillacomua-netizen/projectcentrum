import React from 'react'
import { Layers, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'

export function CalculatorMaterialSummary({
  materials = [],
  thicknesses = [],
  totalSheets = 0
}) {
  return (
    <div className="calc-materials-section">
      {/* 1. Header & Materials Cards matching Image 2 */}
      <div className="calc-materials-header">
        <div className="calc-materials-title-group">
          <span className="calc-materials-accent-bar" />
          <h3 className="calc-materials-title">ВІДОМІСТЬ МАТЕРІАЛІВ:</h3>
        </div>
        <div className="calc-materials-meta">
          <span>Всього: <strong>{totalSheets.toLocaleString()}</strong> листів</span>
        </div>
      </div>

      <div className="calc-materials-grid">
        {materials.length === 0 ? (
          <div className="calc-materials-empty">Матеріалів не розраховано</div>
        ) : (
          materials.map((m, idx) => {
            const hasStock = m.stockAvailable > 0
            const isDeficit = m.deficit > 0

            return (
              <div key={idx} className="calc-mat-card">
                <div className="calc-mat-name">{m.name}</div>
                <div className="calc-mat-val-row">
                  <span className="calc-mat-val">{m.sheets.toLocaleString()}</span>
                  <span className="calc-mat-unit">листів</span>
                </div>

                {/* Warehouse Stock Comparison Pill */}
                <div className={`calc-stock-badge ${isDeficit ? 'deficit' : 'ok'}`}>
                  {isDeficit ? (
                    <>
                      <AlertTriangle size={12} />
                      <span>На складі: {m.stockAvailable} (Дефіцит: -{m.deficit})</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} />
                      <span>На складі: {m.stockAvailable} {hasStock ? '(вистачає)' : ''}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 2. Millimeter Thickness Consolidation (по міліметрах) */}
      <div className="calc-mm-section">
        <div className="calc-mm-header">
          <Layers size={14} className="text-orange" />
          <h4>ЗВЕДЕННЯ ПО ТОВЩИНАХ (МІЛІМЕТРАХ):</h4>
        </div>
        <div className="calc-mm-row">
          {thicknesses.map(t => {
            const pct = totalSheets > 0 ? Math.round((t.sheets / totalSheets) * 100) : 0
            return (
              <div key={t.thickness} className="calc-mm-pill">
                <div className="calc-mm-badge">
                  <span className="calc-mm-val">{t.thickness}</span>
                  <span className="calc-mm-unit">мм</span>
                </div>
                <div className="calc-mm-info">
                  <div className="calc-mm-sheets">
                    <strong>{t.sheets.toLocaleString()}</strong> листів
                  </div>
                  <div className="calc-mm-parts">
                    <span>{t.partsCount} типорозмірів</span>
                    <span className="calc-mm-pct">({pct}%)</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

