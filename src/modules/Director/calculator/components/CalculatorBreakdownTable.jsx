import React from 'react'
import { Filter, Search, ArrowUpDown } from 'lucide-react'

export function CalculatorBreakdownTable({
  rows = [],
  totals,
  thicknesses = [],
  selectedThickness,
  onSelectThickness,
  searchQuery,
  onSearchChange,
  onUpdateSplit
}) {
  return (
    <div className="calc-table-section">
      {/* Table Toolbar: Thickness Pills & Search */}
      <div className="calc-table-toolbar">
        <div className="calc-thickness-pills">
          <button
            type="button"
            className={`calc-thickness-pill ${selectedThickness === 'all' ? 'active' : ''}`}
            onClick={() => onSelectThickness('all')}
          >
            <span>Всі товщини ({rows.length})</span>
          </button>
          {thicknesses.map(t => (
            <button
              key={t.thickness}
              type="button"
              className={`calc-thickness-pill ${selectedThickness === String(t.thickness) ? 'active' : ''}`}
              onClick={() => onSelectThickness(String(t.thickness))}
            >
              <span>{t.label} ({t.partsCount} дет. / {t.sheets} лист.)</span>
            </button>
          ))}
        </div>

        <div className="calc-search-box">
          <Search size={14} className="text-dim" />
          <input
            type="text"
            placeholder="Пошук деталі, коду або матеріалу..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="calc-search-input"
          />
        </div>
      </div>

      {/* Main Breakdown Table (Matching Image 2) */}
      <div className="calc-table-wrapper">
        <table className="calc-table">
          <thead>
            <tr>
              <th className="th-part">ДЕТАЛЬ В РОЗКРІЙ</th>
              <th className="th-center">ПОТРЕБА</th>
              <th className="th-center">ЗАЛИШОК СГП</th>
              <th className="th-center">ПЛАН</th>
              <th className="th-left">МАТЕРІАЛ</th>
              <th className="th-center">ШТ/Л</th>
              <th className="th-center highlight-col">ЗАГАЛОМ ЛИСТІВ</th>
              <th className="th-center">ЛИСТІВ T300</th>
              <th className="th-center">ЛИСТІВ T700</th>
              <th className="th-center">БЗ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="10" className="calc-empty-td">
                  Деталей за обраними критеріями не знайдено
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx} className={`calc-tr ${idx % 2 === 0 ? 'even' : 'odd'}`}>
                  {/* Detail name & code */}
                  <td className="td-part">
                    <div className="calc-part-name">{row.name}</div>
                    <div className="calc-part-meta">
                      {row.code && <span className="calc-part-code">{row.code}</span>}
                      {row.quantityPerParent > 1 && (
                        <span className="calc-part-ratio">×{row.quantityPerParent} на виріб</span>
                      )}
                    </div>
                  </td>

                  {/* Need */}
                  <td className="td-center td-need">
                    {row.totalNeeded.toLocaleString()}
                  </td>

                  {/* SGP In Stock */}
                  <td className="td-center td-stock">
                    {row.inStockBZ > 0 ? (
                      <span className="stock-badge">{row.inStockBZ.toLocaleString()}</span>
                    ) : (
                      <span className="stock-zero">0</span>
                    )}
                  </td>

                  {/* Plan */}
                  <td className="td-center td-plan">
                    {row.planQty.toLocaleString()}
                  </td>

                  {/* Material */}
                  <td className="td-left td-material">
                    <div className="material-pill-calc">
                      <span className="mat-dot" />
                      <span>{row.material}</span>
                    </div>
                  </td>

                  {/* Units per sheet */}
                  <td className="td-center td-units">
                    {row.unitsPerSheet}
                  </td>

                  {/* Total sheets */}
                  <td className="td-center td-sheets highlight-col">
                    {row.totalSheets.toLocaleString()}
                  </td>

                  {/* T300 sheets */}
                  <td className="td-center td-t300">
                    <input
                      type="number"
                      min="0"
                      max={row.totalSheets}
                      className="calc-split-input"
                      value={row.sheetsT300}
                      onChange={(e) => {
                        const val = Math.min(row.totalSheets, Math.max(0, parseInt(e.target.value) || 0))
                        onUpdateSplit(row.nomId, val, row.totalSheets - val)
                      }}
                    />
                  </td>

                  {/* T700 sheets */}
                  <td className="td-center td-t700">
                    <input
                      type="number"
                      min="0"
                      max={row.totalSheets}
                      className="calc-split-input"
                      value={row.sheetsT700}
                      onChange={(e) => {
                        const val = Math.min(row.totalSheets, Math.max(0, parseInt(e.target.value) || 0))
                        onUpdateSplit(row.nomId, row.totalSheets - val, val)
                      }}
                    />
                  </td>

                  {/* Safe buffer surplus */}
                  <td className="td-center td-bz">
                    <span className="bz-tag">+{row.bzSurplus}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Summary Totals Row (Matching Image 2) */}
          {rows.length > 0 && (
            <tfoot>
              <tr className="calc-summary-row">
                <td className="td-summary-title">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                <td className="td-center td-summary-val">{totals.totalNeeded.toLocaleString()}</td>
                <td className="td-center td-summary-dim">{totals.totalInStock.toLocaleString()}</td>
                <td className="td-center td-summary-val">{totals.totalPlan.toLocaleString()}</td>
                <td colSpan="2" className="td-empty" />
                <td className="td-center td-summary-sheets highlight-col">
                  {totals.totalSheets.toLocaleString()}
                </td>
                <td className="td-center td-summary-sky">{totals.sheetsT300.toLocaleString()}</td>
                <td className="td-center td-summary-sky">{totals.sheetsT700.toLocaleString()}</td>
                <td className="td-center td-summary-yellow">+{totals.bzSurplus.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

