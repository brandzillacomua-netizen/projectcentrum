import React, { useState } from 'react'
import { Package, Clock, Boxes, Archive, Search, RefreshCw } from 'lucide-react'
import { ConsumablesQueue } from './ConsumablesQueue'
import './WarehouseIssueWorkspace.css'

export const filterIssueGroups = (groups, query, orders = [], tasks = [], nomenclatures = []) => {
  const search = query.trim().toLocaleLowerCase('uk')
  if (!search) return groups
  return Object.fromEntries(Object.entries(groups).filter(([, requests]) => requests.some(request => {
    const task = tasks.find(t => String(t.id) === String(request.task_id))
    const order = orders.find(o => String(o.id) === String(request.order_id || task?.order_id))
    const nom = nomenclatures.find(n => String(n.id) === String(request.nomenclature_id))
    return [order?.order_num, order?.customer, request.details, nom?.name]
      .filter(value => typeof value === 'string').join(' ').toLocaleLowerCase('uk').includes(search)
  })))
}

export function WarehouseIssueWorkspace({ onOpenStock, onOpenBoxes, onRefresh, boxesCount, ...queueProps }) {
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const { groupedRequests, inventory, orders, tasks, nomenclatures } = queueProps
  const groups = Object.values(groupedRequests)
  const naryads = new Set(groups.flat().map(r => r.task_id || `order-${r.order_id}`)).size
  const positions = groups.reduce((count, rows) => count + new Set(rows.map(r => r.inventory_id || r.nomenclature_id || r.details || r.id)).size, 0)
  const stockCount = (inventory || []).filter(i => i.warehouse === 'operational' || !i.warehouse).length
  const visibleGroups = filterIssueGroups(groupedRequests, query, orders, tasks, nomenclatures)
  const refresh = async () => {
    setRefreshing(true)
    setError('')
    try { await onRefresh() } catch { setError('Не вдалося оновити чергу. Спробуйте ще раз.') }
    finally { setRefreshing(false) }
  }
  return <section className="so-issue-workspace" aria-label="Видача на наряди">
    <div className="so-issue-metrics">
      <div className="so-issue-metric"><Package size={22} /><div><small>Нарядів у черзі</small><strong>{naryads}</strong></div></div>
      <div className="so-issue-metric"><Clock size={22} /><div><small>Позицій у заявках</small><strong>{positions}</strong></div></div>
      <button className="so-issue-metric" onClick={onOpenBoxes}><Boxes size={22} /><div><small>Боксів фрез до підготовки</small><strong>{boxesCount}</strong></div><span>Перейти →</span></button>
      <button className="so-issue-metric" onClick={onOpenStock}><Archive size={22} /><div><small>Записів на СО</small><strong>{stockCount}</strong></div><span>Залишки →</span></button>
    </div>
    <div className="so-issue-toolbar">
      <div><h2>Видача на наряди</h2><p>Заявки на матеріали та комплектування</p></div>
      <label className="so-issue-search"><Search size={16} /><input aria-label="Пошук заявок на наряди" placeholder="Наряд або матеріал…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button className="so-issue-refresh" onClick={refresh} disabled={refreshing}><RefreshCw size={14} />{refreshing ? 'Оновлення…' : 'Оновити'}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {Object.keys(visibleGroups).length ? <ConsumablesQueue {...queueProps} groupedRequests={visibleGroups} /> :
      <div className="so-issue-empty"><Package size={28} /><h3>{query ? 'За пошуком заявок немає' : 'Немає заявок на видачу'}</h3><p>{query ? 'Спробуйте інший номер наряду або назву матеріалу.' : 'Нові заявки з’являться тут. Залишки доступні в окремому перегляді.'}</p>{query && <button className="so-issue-refresh" onClick={() => setQuery('')}>Скинути пошук</button>}</div>}
  </section>
}
