import React from 'react'
import { PackageCheck, CheckCircle2, Clock, Wrench, ChevronLeft, ChevronRight, Pause, Play, Box } from 'lucide-react'
import { BOX_PAGE_SIZE } from '../hooks/usePreparationDashboardData'

export default function PreparationBoxOrderPanel({
  visibleBoxOrders,
  activeBoxOrders,
  boxesPage,
  boxesPages,
  setBoxesPage,
  isPaused,
  setIsPaused
}) {
  return (
    <section className="prep-tv__panel prep-tv__panel--boxes">
      <div className="prep-tv__panel-head">
        <div className="prep-tv__head-title">
          <PackageCheck size={20} className="prep-tv__head-icon" />
          <div>
            <strong>КОМПЛЕКТАЦІЯ БОКСІВ ФРЕЗ</strong>
            <span className="prep-tv__head-sub">Інструмент та оснастка під наряди</span>
          </div>
        </div>
        <div className="prep-tv__head-actions">
          {setIsPaused && (
            <button
              type="button"
              className={`prep-tv__ctrl-btn ${isPaused ? 'is-paused' : ''}`}
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Відновити автогортання' : 'Призупинити'}
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
          )}
          {setBoxesPage && (
            <div className="prep-tv__nav-btns">
              <button
                type="button"
                className="prep-tv__ctrl-btn"
                onClick={() => setBoxesPage(p => (p - 1 + boxesPages) % boxesPages)}
                title="Попередня сторінка"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="prep-tv__page-badge">
                {boxesPage + 1} / {boxesPages}
              </span>
              <button
                type="button"
                className="prep-tv__ctrl-btn"
                onClick={() => setBoxesPage(p => (p + 1) % boxesPages)}
                title="Наступна сторінка"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="prep-tv__box-list">
        {visibleBoxOrders.map(order => {
          const isComplete = order.pending === 0
          const statusClass = isComplete ? 'is-complete' : 'is-pending'

          return (
            <article key={order.id} className={`box-order-card ${statusClass}`}>
              {/* Header: Order info & status pill */}
              <div className="box-order-card__header">
                <div className="box-order-card__order">
                  <span className="box-order-card__label">НАРЯД</span>
                  <strong className="box-order-card__number">№{order.orderNum}</strong>
                </div>

                <div className="box-order-card__status-pill">
                  {isComplete ? (
                    <span className="pill pill--emerald">
                      <CheckCircle2 size={13} /> УСІ БОКСИ ГОТОВІ ({order.total}/{order.total})
                    </span>
                  ) : (
                    <span className="pill pill--amber">
                      <Clock size={13} /> ПОТРІБНО ЗІБРАТИ {order.pending} БОКС{order.pending === 1 ? '' : 'И'}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="box-order-card__stats">
                <div className="stat-block stat-block--main">
                  <span className="stat-label">ЗІБРАНО БОКСІВ</span>
                  <div className="stat-value">
                    <strong>{order.prepared}</strong>
                    <span className="stat-total">/ {order.total}</span>
                    <span className="stat-unit">боксів</span>
                  </div>
                </div>

                <div className="stat-block stat-block--pending">
                  <span className="stat-label">ЗАЛИШИЛОСЬ ЗІБРАТИ</span>
                  <div className="stat-pending-val">
                    {order.pending > 0 ? (
                      <span className="pending-badge pending-badge--amber">
                        {order.pending} бокс{order.pending === 1 ? '' : 'и'}
                      </span>
                    ) : (
                      <span className="ready-badge">0 (Готово)</span>
                    )}
                  </div>
                </div>

                <div className="stat-block stat-block--percent">
                  <span className="stat-label">ГОТОВНІСТЬ</span>
                  <div className="stat-percent-val">{order.percent}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="box-order-card__progress">
                <div
                  className={`box-order-card__progress-fill ${statusClass}`}
                  style={{ width: `${order.percent}%` }}
                />
              </div>

              {/* Cutters & Tooling Breakdown (Які фрези та скільки треба наповнити) */}
              <div className="box-order-card__cutters">
                <div className="cutters-header">
                  <Wrench size={13} />
                  <span>НЕОБХІДНИЙ ІНСТРУМЕНТ (ФРЕЗИ):</span>
                </div>
                <div className="cutters-grid">
                  {(order.cutters || []).length > 0 ? (
                    order.cutters.map(cutter => (
                      <div key={cutter.id} className="cutter-pill">
                        <span className="cutter-pill__name" title={cutter.name}>
                          {cutter.name}
                        </span>
                        <span className="cutter-pill__qty">
                          {cutter.qty} шт.
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="cutters-empty">Спеціальні фрези не задіяні (стандартний набір)</div>
                  )}
                </div>
              </div>

              {/* Individual Box Cards Status */}
              {(order.boxes || []).length > 0 && (
                <div className="box-order-card__boxes-strip">
                  <div className="boxes-strip-title">
                    <Box size={12} />
                    <span>СТАТУС ПО БОКСАХ:</span>
                  </div>
                  <div className="boxes-chips">
                    {order.boxes.slice(0, 6).map((b, idx) => (
                      <span
                        key={b.id || idx}
                        className={`box-chip ${b.isPrepared ? 'is-ready' : 'is-waiting'}`}
                        title={`${b.partName} (${b.sheets} л.)`}
                      >
                        {b.seq} {b.isPrepared ? '✓' : '…'}
                      </span>
                    ))}
                    {order.boxes.length > 6 && (
                      <span className="box-chip-more">+{order.boxes.length - 6}</span>
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })}

        {visibleBoxOrders.length === 0 && (
          <div className="prep-tv__empty">
            <CheckCircle2 size={54} />
            <strong>Всі бокси фрез зібрані</strong>
            <span>Очікуючих на збірку нарядів немає</span>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="prep-tv__panel-footer">
        <div className="prep-tv__dots">
          {Array.from({ length: boxesPages }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`dot ${idx === boxesPage ? 'is-active' : ''}`}
              onClick={() => setBoxesPage && setBoxesPage(idx)}
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
