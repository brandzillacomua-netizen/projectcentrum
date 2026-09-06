import React from 'react'
import { PlayCircle, Clock3, PackageCheck, Box } from 'lucide-react'

export default function PreparationDashboardKPIs({ totals }) {
  return (
    <div className="prep-tv__kpis">
      <div><PlayCircle /><span>У роботі</span><strong>{totals.prepActive}</strong></div>
      <div><Clock3 /><span>Очікують</span><strong>{totals.prepWaiting}</strong></div>
      <div><PackageCheck /><span>Боксів готово</span><strong>{totals.boxesPrepared}/{totals.boxesTotal}</strong></div>
      <div className={totals.boxesPending ? 'is-warning' : 'is-ready'}><Box /><span>Ще зібрати</span><strong>{totals.boxesPending}</strong></div>
    </div>
  )
}
