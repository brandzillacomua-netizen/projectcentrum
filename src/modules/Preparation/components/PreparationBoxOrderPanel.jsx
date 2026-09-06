import React from 'react'
import { PackageCheck } from 'lucide-react'
import { BOX_PAGE_SIZE } from '../hooks/usePreparationDashboardData'

export default function PreparationBoxOrderPanel({
  visibleBoxOrders,
  activeBoxOrders,
  boxesPage,
  boxesPages
}) {
  return (
    <>
      {visibleBoxOrders.map((order, cardIndex) => {
        const orderPercent = order.total ? Math.round(order.prepared / order.total * 100) : 100
        return (
          <section className={`prep-tv__panel prep-tv__panel--box ${order.pending === 0 ? 'is-complete' : ''}`} key={order.id}>
            <div className="prep-tv__panel-head">
              <div><PackageCheck size={19} /><strong>БОКСИ ФРЕЗ · {cardIndex + 1}</strong></div>
              <span>група {boxesPage + 1}/{boxesPages}</span>
            </div>
            <article className="box-order">
              <div className="box-order__head">
                <div><span>НАРЯД</span><strong>№{order.orderNum}</strong></div>
                <div className="box-order__result">
                  <strong>{order.prepared}<i>/ {order.total}</i></strong>
                  <span>{order.pending ? `ЗАЛИШИЛОСЯ ${order.pending}` : 'УСІ БОКСИ ГОТОВІ'}</span>
                </div>
              </div>
              <div className="box-order__progress">
                <i style={{ width: `${orderPercent}%` }} />
                <strong>{orderPercent}%</strong>
              </div>
              <div className="box-order__items">
                {order.items.slice(0, 5).map(item => {
                  const ready = item.prepared === item.total
                  return (
                    <div key={item.id} className={ready ? 'is-ready' : ''}>
                      <span title={item.name}>{item.name}</span>
                      <b>{item.prepared}<i>/{item.total}</i></b>
                    </div>
                  )
                })}
                {order.items.length > 5 && <small>+ ще {order.items.length - 5} номенклатур</small>}
              </div>
              <div className="box-order__slider">
                <div>
                  {activeBoxOrders.map((_, index) => (
                    <i key={index} className={index >= boxesPage * BOX_PAGE_SIZE && index < (boxesPage + 1) * BOX_PAGE_SIZE ? 'is-active' : ''} />
                  ))}
                </div>
                <span>Оновлення через 12 с</span>
              </div>
            </article>
          </section>
        )
      })}
    </>
  )
}
