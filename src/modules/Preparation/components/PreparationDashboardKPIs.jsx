import React from 'react'
import { FileSpreadsheet, Clock, PackageCheck, Box } from 'lucide-react'

export default function PreparationDashboardKPIs({ totals }) {
  const hasSheetDeficit = (totals.sheetsPending || 0) > 0
  const hasBoxDeficit = (totals.boxesPending || 0) > 0

  return (
    <div className="prep-tv__kpis">
      {/* 1. Sheets Issued / Total */}
      <div className="prep-kpi prep-kpi--sheets">
        <div className="prep-kpi__icon prep-kpi__icon--sky">
          <FileSpreadsheet size={24} />
        </div>
        <div className="prep-kpi__content">
          <span className="prep-kpi__label">ЛИСТІВ ВИДАНО (СО)</span>
          <div className="prep-kpi__value">
            <strong>{totals.sheetsIssued || 0}</strong>
            <span className="prep-kpi__total">/ {totals.sheetsTotal || 0}</span>
            <span className="prep-kpi__unit">л.</span>
          </div>
          <span className="prep-kpi__sub">прогрес видачі {totals.sheetsPercent || 0}%</span>
        </div>
      </div>

      {/* 2. Sheets Pending (Deficit) */}
      <div className={`prep-kpi ${hasSheetDeficit ? 'is-warning' : 'is-ready'}`}>
        <div className={`prep-kpi__icon ${hasSheetDeficit ? 'prep-kpi__icon--rose' : 'prep-kpi__icon--emerald'}`}>
          <Clock size={24} />
        </div>
        <div className="prep-kpi__content">
          <span className="prep-kpi__label">ЛИСТІВ ДО ВИДАЧІ</span>
          <div className="prep-kpi__value">
            <strong>{totals.sheetsPending || 0}</strong>
            <span className="prep-kpi__unit">л.</span>
          </div>
          <span className="prep-kpi__sub">
            {hasSheetDeficit ? 'дефіцит під розкрій' : 'усі листи видано'}
          </span>
        </div>
      </div>

      {/* 3. Boxes Prepared / Total */}
      <div className="prep-kpi prep-kpi--boxes">
        <div className="prep-kpi__icon prep-kpi__icon--emerald">
          <PackageCheck size={24} />
        </div>
        <div className="prep-kpi__content">
          <span className="prep-kpi__label">БОКСІВ ЗІБРАНО</span>
          <div className="prep-kpi__value">
            <strong>{totals.boxesPrepared || 0}</strong>
            <span className="prep-kpi__total">/ {totals.boxesTotal || 0}</span>
          </div>
          <span className="prep-kpi__sub">готовність {totals.boxesPercent || 0}%</span>
        </div>
      </div>

      {/* 4. Boxes Pending */}
      <div className={`prep-kpi ${hasBoxDeficit ? 'is-warning' : 'is-ready'}`}>
        <div className={`prep-kpi__icon ${hasBoxDeficit ? 'prep-kpi__icon--amber' : 'prep-kpi__icon--emerald'}`}>
          <Box size={24} />
        </div>
        <div className="prep-kpi__content">
          <span className="prep-kpi__label">БОКСІВ ДО ЗБІРКИ</span>
          <div className="prep-kpi__value">
            <strong>{totals.boxesPending || 0}</strong>
            <span className="prep-kpi__unit">шт.</span>
          </div>
          <span className="prep-kpi__sub">
            {hasBoxDeficit ? 'очікують комплектації' : 'усі бокси зібрано'}
          </span>
        </div>
      </div>
    </div>
  )
}
