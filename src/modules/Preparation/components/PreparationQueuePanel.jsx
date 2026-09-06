import React from 'react'
import { PlayCircle, AlertTriangle, Clock3, CheckCircle2 } from 'lucide-react'
import { formatElapsed, getAgeMinutes } from '../hooks/usePreparationDashboardData'

export default function PreparationQueuePanel({
  visiblePrep,
  prepPage,
  prepPages,
  now
}) {
  return (
    <section className="prep-tv__panel prep-tv__panel--prep">
      <div className="prep-tv__panel-head">
        <div><PlayCircle size={21} /><strong>ПІДГОТОВКА МАТЕРІАЛІВ</strong></div>
        <span>сторінка {prepPage + 1}/{prepPages}</span>
      </div>
      <div className="prep-tv__list">
        {visiblePrep.map(item => {
          const active = item.status === 'in-progress'
          const overtime = active && getAgeMinutes(item.startedAt, now) >= 120
          return (
            <article key={item.id} className={`prep-task ${active ? 'is-active' : ''} ${overtime || item.hasScrap ? 'has-alert' : ''}`}>
              <div className="prep-task__status">{item.hasScrap ? <AlertTriangle /> : active ? <PlayCircle /> : <Clock3 />}</div>
              <div className="prep-task__main">
                <div><strong>{item.prepNum}</strong><span>Наряд №{item.orderNum}</span></div>
                <h3>{item.name}</h3>
                <small>{active ? `${item.operator} · ${item.shift}` : 'Очікує запуску'}</small>
              </div>
              <div className="prep-task__metric"><strong>{item.plan}</strong><span>шт.</span></div>
              <div className="prep-task__time"><strong>{active ? formatElapsed(item.startedAt, now) : '—'}</strong><span>{active ? 'в роботі' : 'час'}</span></div>
            </article>
          )
        })}
        {visiblePrep.length === 0 && (
          <div className="prep-tv__empty">
            <CheckCircle2 size={54} />
            <strong>Черга підготовки порожня</strong>
            <span>Активних завдань немає</span>
          </div>
        )}
      </div>
    </section>
  )
}
