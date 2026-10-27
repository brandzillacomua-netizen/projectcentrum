import React from 'react'
import { FileSpreadsheet, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { SHEET_PAGE_SIZE } from '../hooks/usePreparationDashboardData'

export default function PreparationSheetOrdersPanel({
  visibleSheetOrders,
  activeSheetOrders,
  sheetPage,
  sheetPages,
  setSheetPage,
  isPaused,
  setIsPaused
}) {
  return (
    <section className="prep-tv__panel prep-tv__panel--sheets">
      <div className="prep-tv__panel-head">
        <div className="prep-tv__head-title">
          <FileSpreadsheet size={20} className="prep-tv__head-icon" />
          <div>
            <strong>ВИДАЧА ЛИСТІВ З СО ПІД НАРЯДИ</strong>
            <span className="prep-tv__head-sub">Склад Оперативний ➔ Розкрій</span>
          </div>
        </div>
        <div className="prep-tv__head-actions">
          <button
            type="button"
            className={`prep-tv__ctrl-btn ${isPaused ? 'is-paused' : ''}`}
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Відновити автогортання' : 'Призупинити'}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <div className="prep-tv__nav-btns">
            <button
              type="button"
              className="prep-tv__ctrl-btn"
              onClick={() => setSheetPage(p => (p - 1 + sheetPages) % sheetPages)}
              title="Попередня сторінка"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="prep-tv__page-badge">
              {sheetPage + 1} / {sheetPages}
            </span>
            <button
              type="button"
              className="prep-tv__ctrl-btn"
              onClick={() => setSheetPage(p => (p + 1) % sheetPages)}
              title="Наступна сторінка"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="prep-tv__sheet-list">
        {visibleSheetOrders.map(order => {
          const isComplete = order.pendingSheets === 0
          const isPartial = order.issuedSheets > 0 && !isComplete
          const statusClass = isComplete ? 'is-complete' : (isPartial ? 'is-partial' : 'is-waiting')

          return (
            <article key={order.id} className={`sheet-order-card ${statusClass}`}>
              {/* Header: Order badge & status pill */}
              <div className="sheet-order-card__header">
                <div className="sheet-order-card__order">
                  <span className="sheet-order-card__label">НАРЯД</span>
                  <strong className="sheet-order-card__number">№{order.orderNum}</strong>
                </div>

                <div className="sheet-order-card__status-pill">
                  {isComplete ? (
                    <span className="pill pill--emerald">
                      <CheckCircle2 size={13} /> ВИДАНО ПОВНІСТЮ
                    </span>
                  ) : isPartial ? (
                    <span className="pill pill--amber">
                      <Clock size={13} /> В ПРОЦЕСІ ВИДАЧІ (ЗАЛИШОК {order.pendingSheets} л.)
                    </span>
                  ) : (
                    <span className="pill pill--rose">
                      <AlertCircle size={13} /> ОЧІКУЄ ВИДАЧІ (ДЕФІЦИТ {order.totalSheets} л.)
                    </span>
                  )}
                </div>
              </div>

              {/* Big metrics row: issued vs needed */}
              <div className="sheet-order-card__stats">
                <div className="stat-block stat-block--main">
                  <span className="stat-label">ВИДАНО ЗІ СКЛАДУ</span>
                  <div className="stat-value">
                    <strong>{order.issuedSheets}</strong>
                    <span className="stat-total">/ {order.totalSheets}</span>
                    <span className="stat-unit">листів</span>
                  </div>
                </div>

                <div className="stat-block stat-block--pending">
                  <span className="stat-label">ЗАЛИШИЛОСЬ ВИДАТИ</span>
                  <div className="stat-pending-val">
                    {order.pendingSheets > 0 ? (
                      <span className="pending-badge">+{order.pendingSheets} л.</span>
                    ) : (
                      <span className="ready-badge">0 л. (100%)</span>
                    )}
                  </div>
                </div>

                <div className="stat-block stat-block--percent">
                  <span className="stat-label">ПРОГРЕС</span>
                  <div className="stat-percent-val">{order.percent}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="sheet-order-card__progress">
                <div
                  className={`sheet-order-card__progress-fill ${statusClass}`}
                  style={{ width: `${order.percent}%` }}
                />
              </div>

              {/* Breakdown of materials (Листи за типами) */}
              <div className="sheet-order-card__materials">
                <span className="materials-title">НОМЕНКЛАТУРА ЛИСТІВ:</span>
                <div className="materials-grid">
                  {order.materials.map((mat, idx) => {
                    const matComplete = mat.pending === 0
                    return (
                      <div key={idx} className={`material-pill ${matComplete ? 'is-complete' : ''}`}>
                        <span className="material-pill__name" title={mat.name}>
                          {mat.name}
                        </span>
                        <div className="material-pill__qty">
                          <strong>{mat.issued}</strong> / {mat.needed} л.
                          {mat.pending > 0 && (
                            <span className="material-pill__deficit">(-{mat.pending})</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </article>
          )
        })}

        {visibleSheetOrders.length === 0 && (
          <div className="prep-tv__empty">
            <CheckCircle2 size={54} />
            <strong>Всі листи під наряди видано</strong>
            <span>Дефіцитів на складі СО наразі немає</span>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="prep-tv__panel-footer">
        <div className="prep-tv__dots">
          {Array.from({ length: sheetPages }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`dot ${idx === sheetPage ? 'is-active' : ''}`}
              onClick={() => setSheetPage(idx)}
              title={`Сторінка ${idx + 1}`}
            />
          ))}
        </div>
        <span className="prep-tv__timer-note">
          {isPaused ? 'Автогортання призупинено' : 'Оновлення кожні 12 с'}
        </span>
      </div>
    </section>
  )
}
