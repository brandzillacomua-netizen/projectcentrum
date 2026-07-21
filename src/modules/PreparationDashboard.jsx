import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Box, CheckCircle2, Clock3,
  Layers3, Maximize2, PackageCheck, PlayCircle, RefreshCw
} from 'lucide-react'
import { useMES } from '../MESContext'
import { useWarehouseComputed } from './Warehouse/hooks/useWarehouseComputed'

const PREP_PAGE_SIZE = 4
const BOX_PAGE_SIZE = 3
const ROTATION_MS = 12000

const formatElapsed = (start, now) => {
  if (!start) return '—'
  const seconds = Math.max(0, Math.floor((now - new Date(start)) / 1000))
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const getAgeMinutes = (start, now) => {
  if (!start) return 0
  return Math.max(0, Math.floor((now - new Date(start)) / 60000))
}

const PreparationDashboard = () => {
  const {
    tasks, nomenclatures, requests, inventory, receptionDocs,
    machineOperations, workCards, orders
  } = useMES()
  const [now, setNow] = useState(new Date())
  const [prepPage, setPrepPage] = useState(0)
  const [boxesPage, setBoxesPage] = useState(0)
  const [lastDataChange, setLastDataChange] = useState(new Date())

  const { cardsWithBoxes } = useWarehouseComputed({
    requests, tasks, receptionDocs, nomenclatures, inventory,
    activeTab: 'boxes', machineOperations, workCards, searchQuery: ''
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setLastDataChange(new Date())
  }, [tasks, workCards, requests, inventory])

  const orderById = useMemo(() => new Map((orders || []).map(order => [String(order.id), order])), [orders])

  const prepQueue = useMemo(() => {
    const queue = []
    ;(tasks || [])
      .filter(task => task.step === 'Підготовка' && task.status !== 'completed' && (
        task.warehouse_conf === 'true' ||
        Object.values(task.plan_snapshot || {}).some(item => item?.status === 'in-progress' || item?.status === 'completed')
      ))
      .forEach(task => {
        const snapshot = task.plan_snapshot || {}
        Object.entries(snapshot).forEach(([nomenclatureId, item]) => {
          if (nomenclatureId.startsWith('_') || item?.status === 'completed') return
          const order = orderById.get(String(task.order_id))
          queue.push({
            id: `${task.id}_${nomenclatureId}`,
            prepNum: snapshot._prep_num || 'НП------',
            orderNum: order?.order_num || '—',
            name: item?.name || nomenclatures.find(n => String(n.id) === String(nomenclatureId))?.name || 'Матеріал',
            plan: Number(item?.plan || item?.need || 0),
            status: item?.status || 'new',
            operator: item?.operator || 'Не призначено',
            shift: item?.shift || '—',
            startedAt: item?.started_at || task.started_at,
            hasScrap: Number(item?.total_scrap || item?.actual_scrap || 0) > 0
          })
        })
      })

    return queue.sort((a, b) => {
      if (a.hasScrap !== b.hasScrap) return a.hasScrap ? -1 : 1
      if (a.status !== b.status) return a.status === 'in-progress' ? -1 : 1
      return String(a.prepNum).localeCompare(String(b.prepNum), 'uk')
    })
  }, [tasks, nomenclatures, orderById])

  const boxOrders = useMemo(() => {
    const grouped = new Map()
    ;(cardsWithBoxes || []).forEach(item => {
      const orderId = String(item.card.order_id || item.task?.order_id || '')
      const order = orderById.get(orderId)
      const orderNum = order?.order_num || 'Без наряду'
      if (!grouped.has(orderId)) grouped.set(orderId, { id: orderId, orderNum, items: new Map(), total: 0, prepared: 0 })
      const orderGroup = grouped.get(orderId)
      const nomKey = String(item.nom?.id || item.card.nomenclature_id || item.nom?.name || 'unknown')
      if (!orderGroup.items.has(nomKey)) {
        orderGroup.items.set(nomKey, { id: nomKey, name: item.nom?.name || 'Без номенклатури', total: 0, prepared: 0 })
      }
      const nomGroup = orderGroup.items.get(nomKey)
      nomGroup.total += 1
      orderGroup.total += 1
      if (item.isPrepared) {
        nomGroup.prepared += 1
        orderGroup.prepared += 1
      }
    })

    return Array.from(grouped.values()).map(group => ({
      ...group,
      items: Array.from(group.items.values()).sort((a, b) => (a.prepared / a.total) - (b.prepared / b.total)),
      pending: group.total - group.prepared
    })).sort((a, b) => b.pending - a.pending || String(a.orderNum).localeCompare(String(b.orderNum), 'uk'))
  }, [cardsWithBoxes, orderById])

  const totals = useMemo(() => {
    const boxesTotal = boxOrders.reduce((sum, order) => sum + order.total, 0)
    const boxesPrepared = boxOrders.reduce((sum, order) => sum + order.prepared, 0)
    return {
      prepActive: prepQueue.filter(item => item.status === 'in-progress').length,
      prepWaiting: prepQueue.filter(item => item.status !== 'in-progress').length,
      boxesTotal,
      boxesPrepared,
      boxesPending: boxesTotal - boxesPrepared
    }
  }, [prepQueue, boxOrders])

  const alerts = useMemo(() => {
    const result = []
    prepQueue.forEach(item => {
      const age = getAgeMinutes(item.startedAt, now)
      if (item.hasScrap) result.push({ level: 'danger', text: `${item.prepNum}: зафіксовано брак — потрібна повторна підготовка` })
      else if (item.status === 'in-progress' && age >= 120) result.push({ level: 'warning', text: `${item.prepNum}: ${item.name} у роботі вже ${formatElapsed(item.startedAt, now)}` })
    })
    boxOrders.filter(order => order.pending > 0).slice(0, 3).forEach(order => {
      result.push({ level: order.pending >= 5 ? 'danger' : 'warning', text: `Наряд №${order.orderNum}: потрібно зібрати ще ${order.pending} боксів` })
    })
    return result.slice(0, 4)
  }, [prepQueue, boxOrders, now])

  const prepPages = Math.max(1, Math.ceil(prepQueue.length / PREP_PAGE_SIZE))
  const boxesPages = Math.max(1, Math.ceil(boxOrders.length / BOX_PAGE_SIZE))

  useEffect(() => {
    const timer = setInterval(() => {
      setPrepPage(page => (page + 1) % prepPages)
      setBoxesPage(page => (page + 1) % boxesPages)
    }, ROTATION_MS)
    return () => clearInterval(timer)
  }, [prepPages, boxesPages])

  useEffect(() => setPrepPage(page => Math.min(page, prepPages - 1)), [prepPages])
  useEffect(() => setBoxesPage(page => Math.min(page, boxesPages - 1)), [boxesPages])

  const visiblePrep = prepQueue.slice(prepPage * PREP_PAGE_SIZE, prepPage * PREP_PAGE_SIZE + PREP_PAGE_SIZE)
  const visibleBoxOrders = boxOrders.slice(boxesPage * BOX_PAGE_SIZE, boxesPage * BOX_PAGE_SIZE + BOX_PAGE_SIZE)
  const staleSeconds = Math.floor((now - lastDataChange) / 1000)

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch (error) {}
  }

  return (
    <div className="prep-tv">
      <header className="prep-tv__header">
        <div className="prep-tv__brand">
          <Link to="/" className="prep-tv__back"><ArrowLeft size={20} /></Link>
          <div className="prep-tv__logo"><Layers3 size={24} /></div>
          <div><strong>ВІДДІЛ ПІДГОТОВКИ</strong><span>оперативний екран зміни</span></div>
        </div>
        <div className="prep-tv__header-status">
          <span className={staleSeconds > 120 ? 'is-stale' : ''}><RefreshCw size={15} /> Дані актуальні</span>
          <button type="button" onClick={toggleFullscreen} title="На весь екран"><Maximize2 size={20} /></button>
          <div className="prep-tv__clock"><strong>{now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</strong><span>{now.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' })}</span></div>
        </div>
      </header>

      <div className="prep-tv__kpis">
        <div><PlayCircle /><span>У роботі</span><strong>{totals.prepActive}</strong></div>
        <div><Clock3 /><span>Очікують</span><strong>{totals.prepWaiting}</strong></div>
        <div><PackageCheck /><span>Боксів готово</span><strong>{totals.boxesPrepared}/{totals.boxesTotal}</strong></div>
        <div className={totals.boxesPending ? 'is-warning' : 'is-ready'}><Box /><span>Ще зібрати</span><strong>{totals.boxesPending}</strong></div>
      </div>

      <main className="prep-tv__grid">
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
            {visiblePrep.length === 0 && <div className="prep-tv__empty"><CheckCircle2 size={54} /><strong>Черга підготовки порожня</strong><span>Активних завдань немає</span></div>}
          </div>
        </section>

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
                  <div className="box-order__result"><strong>{order.prepared}<i>/ {order.total}</i></strong><span>{order.pending ? `ЗАЛИШИЛОСЯ ${order.pending}` : 'УСІ БОКСИ ГОТОВІ'}</span></div>
                </div>
                <div className="box-order__progress"><i style={{ width: `${orderPercent}%` }} /><strong>{orderPercent}%</strong></div>
                <div className="box-order__items">
                  {order.items.slice(0, 5).map(item => {
                    const ready = item.prepared === item.total
                    return <div key={item.id} className={ready ? 'is-ready' : ''}><span title={item.name}>{item.name}</span><b>{item.prepared}<i>/{item.total}</i></b></div>
                  })}
                  {order.items.length > 5 && <small>+ ще {order.items.length - 5} номенклатур</small>}
                </div>
                <div className="box-order__slider">
                  <div>{boxOrders.map((_, index) => <i key={index} className={index >= boxesPage * BOX_PAGE_SIZE && index < (boxesPage + 1) * BOX_PAGE_SIZE ? 'is-active' : ''} />)}</div>
                  <span>Оновлення через 12 с</span>
                </div>
              </article>
          </section>
        )})}
        {Array.from({ length: Math.max(0, BOX_PAGE_SIZE - visibleBoxOrders.length) }).map((_, index) => (
          <section className="prep-tv__panel prep-tv__panel--box is-empty" key={`empty-box-${index}`}>
            <div className="prep-tv__panel-head"><div><PackageCheck size={19} /><strong>БОКСИ ФРЕЗ</strong></div></div>
            <div className="prep-tv__empty"><CheckCircle2 size={42} /><strong>Усі доступні бокси готові</strong><span>Очікуємо наступний наряд</span></div>
          </section>
        ))}
      </main>

      <footer className={`prep-tv__alerts ${alerts.some(a => a.level === 'danger') ? 'has-danger' : ''}`}>
        <div><AlertTriangle size={22} /><strong>ПОТРЕБУЄ УВАГИ</strong></div>
        <div className="prep-tv__alerts-list">{alerts.length ? alerts.map((alert, index) => <span key={`${alert.text}_${index}`}>{alert.text}</span>) : <span className="is-clear">Критичних затримок немає — відділ працює за планом</span>}</div>
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        .prep-tv { min-height:100vh; height:100vh; overflow:hidden; background:#070908; color:#f8fafc; font-family:Inter,system-ui,sans-serif; display:grid; grid-template-rows:74px 92px 1fr 58px; }
        .prep-tv__header { display:flex; align-items:center; justify-content:space-between; padding:0 28px; border-bottom:1px solid #202522; background:#0b0e0c; }
        .prep-tv__brand,.prep-tv__header-status,.prep-tv__brand>div { display:flex; align-items:center; gap:13px; }
        .prep-tv__brand>div:last-child { align-items:flex-start; flex-direction:column; gap:2px; }
        .prep-tv__brand strong { font-size:18px; letter-spacing:.06em; } .prep-tv__brand span { color:#647068; font-size:11px; text-transform:uppercase; letter-spacing:.16em; }
        .prep-tv__logo { width:42px; height:42px; justify-content:center; border-radius:12px; background:#10281d; color:#22c55e; }
        .prep-tv__back { color:#59645d; display:grid; place-items:center; } .prep-tv__header-status>span { display:flex; gap:7px; align-items:center; color:#22c55e; font-size:12px; font-weight:800; }
        .prep-tv__header-status>span.is-stale { color:#f59e0b; } .prep-tv__header-status button { border:1px solid #29312c; background:#121714; color:#94a39a; border-radius:10px; width:40px; height:40px; display:grid; place-items:center; cursor:pointer; }
        .prep-tv__clock { display:flex; flex-direction:column; align-items:flex-end; margin-left:6px; } .prep-tv__clock strong { font:900 27px/1 monospace; color:#fff; } .prep-tv__clock span { color:#68736c; font-size:11px; margin-top:4px; }
        .prep-tv__kpis { padding:14px 28px; display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .prep-tv__kpis>div { min-width:0; border:1px solid #202622; background:#0e1210; border-radius:14px; padding:11px 16px; display:grid; grid-template-columns:30px 1fr auto; align-items:center; gap:8px; color:#22c55e; }
        .prep-tv__kpis svg { width:22px; } .prep-tv__kpis span { color:#79847d; font-size:12px; font-weight:800; text-transform:uppercase; } .prep-tv__kpis strong { font-size:25px; color:#fff; }
        .prep-tv__kpis .is-warning { color:#f59e0b; border-color:#3b2a13; } .prep-tv__kpis .is-ready { color:#22c55e; }
        .prep-tv__grid { min-height:0; padding:0 28px 14px; display:grid; grid-template-columns:minmax(0,1.03fr) minmax(0,.97fr); gap:14px; }
        .prep-tv__panel { min-height:0; border:1px solid #202622; background:#0d100e; border-radius:18px; overflow:hidden; display:grid; grid-template-rows:51px 1fr; }
        .prep-tv__panel--prep { border-top:3px solid #22c55e; } .prep-tv__panel--boxes { border-top:3px solid #f59e0b; grid-template-rows:56px 82px 1fr; }
        .prep-tv__panel-head { display:flex; justify-content:space-between; align-items:center; padding:0 17px; border-bottom:1px solid #1c211e; }
        .prep-tv__panel-head>div { display:flex; align-items:center; gap:9px; color:#22c55e; } .prep-tv__panel--boxes .prep-tv__panel-head>div { color:#f59e0b; } .prep-tv__panel-head strong { font-size:15px; letter-spacing:.06em; } .prep-tv__panel-head>span { color:#7b887f; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
        .prep-tv__list { min-height:0; padding:10px; display:flex; flex-direction:column; gap:8px; }
        .prep-task { flex:1; min-height:64px; display:grid; grid-template-columns:40px minmax(0,1fr) 60px 72px; align-items:center; gap:10px; border:1px solid #1e2420; border-radius:12px; padding:8px 11px; background:#111512; }
        .prep-task.is-active { border-left:4px solid #3b82f6; } .prep-task.has-alert { border-color:#7f1d1d; background:#190f0f; }
        .prep-task__status { width:36px; height:36px; border-radius:10px; background:#18201b; color:#eab308; display:grid; place-items:center; } .is-active .prep-task__status { color:#60a5fa; background:#101e32; } .has-alert .prep-task__status { color:#f87171; background:#321414; }
        .prep-task__status svg { width:19px; } .prep-task__main { min-width:0; } .prep-task__main>div { display:flex; gap:10px; align-items:center; } .prep-task__main>div strong { font-size:12px; color:#22c55e; } .prep-task__main>div span { color:#657068; font-size:10px; }
        .prep-task h3 { margin:3px 0; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .prep-task small { color:#7d8981; font-size:10px; }
        .prep-task__metric,.prep-task__time { display:flex; flex-direction:column; align-items:flex-end; } .prep-task__metric strong,.prep-task__time strong { font-size:17px; } .prep-task__metric span,.prep-task__time span { color:#5e6862; font-size:9px; text-transform:uppercase; }
        .boxes-summary { margin:11px 14px 5px; padding:9px 16px; display:grid; grid-template-columns:88px 1fr 88px; align-items:center; gap:16px; border-radius:13px; background:#15160f; border:1px solid #39331b; }
        .boxes-summary>div:not(.boxes-summary__bar) { display:flex; flex-direction:column; } .boxes-summary>div:last-child { align-items:flex-end; } .boxes-summary strong { font-size:23px; line-height:1; color:#f59e0b; } .boxes-summary span { color:#8d866b; font-size:10px; font-weight:800; text-transform:uppercase; margin-top:4px; }
        .boxes-summary__bar { height:11px; background:#302e21; border-radius:99px; overflow:hidden; } .boxes-summary__bar i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#f59e0b,#22c55e); transition:width .5s ease; }
        .box-orders { min-height:0; padding:8px 14px 12px; display:flex; flex-direction:column; }
        .box-order { flex:1; min-height:0; border:1px solid #343124; border-radius:15px; background:linear-gradient(145deg,#151711,#10120f); padding:16px 18px 12px; overflow:hidden; display:grid; grid-template-rows:auto 24px 1fr auto; gap:11px; }
        .box-order.is-complete { border-color:#214d34; background:linear-gradient(145deg,#111b14,#0e120f); }
        .box-order__head { display:flex; justify-content:space-between; align-items:center; padding-bottom:11px; border-bottom:1px solid #302e24; } .box-order__head>div:first-child { display:flex; flex-direction:column; align-items:flex-start; gap:2px; }
        .box-order__head span { color:#8f876a; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; } .box-order__head>div:first-child strong { color:#f8fafc; font-size:clamp(24px,2.2vw,34px); line-height:1.05; }
        .box-order__result { display:flex; flex-direction:column; align-items:flex-end; gap:3px; } .box-order__result strong { color:#f59e0b; font-size:clamp(28px,2.6vw,40px); line-height:1; } .box-order.is-complete .box-order__result strong { color:#22c55e; }
        .box-order__result strong i { color:#857d61; font-size:.55em; font-style:normal; } .box-order__result span { color:#f59e0b; } .box-order.is-complete .box-order__result span { color:#22c55e; }
        .box-order__progress { position:relative; height:12px; border-radius:99px; background:#2e2c21; margin-right:52px; } .box-order__progress>i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#f59e0b,#22c55e); transition:width .5s ease; } .box-order__progress>strong { position:absolute; left:calc(100% + 10px); top:-5px; color:#f59e0b; font-size:17px; }
        .box-order__items { align-content:start; display:grid; grid-template-columns:1fr; gap:8px; min-height:0; } .box-order__items>div { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:center; padding:10px 13px; background:#1a1c15; border-radius:9px; border-left:5px solid #f59e0b; }
        .box-order__items>div.is-ready { border-left-color:#22c55e; background:#132018; } .box-order__items span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(13px,1.2vw,17px); font-weight:700; color:#e3e7e4; } .box-order__items b { font-size:clamp(16px,1.4vw,21px); color:#f59e0b; } .box-order__items b i { color:#776f58; font-size:.7em; font-style:normal; } .box-order__items .is-ready b { color:#22c55e; } .box-order__items small { color:#9b9271; font-size:12px; font-weight:700; padding-left:12px; }
        .box-order__slider { display:flex; align-items:center; justify-content:space-between; gap:14px; padding-top:8px; border-top:1px solid #2b2c24; } .box-order__slider>div { display:flex; gap:6px; flex-wrap:wrap; } .box-order__slider i { width:7px; height:7px; border-radius:99px; background:#3f4138; transition:.3s; } .box-order__slider i.is-active { width:25px; background:#f59e0b; } .box-order__slider span { color:#777f79; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap; }
        .prep-tv__empty { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#22c55e; gap:8px; } .prep-tv__empty strong { color:#dce5df; font-size:17px; } .prep-tv__empty span { color:#59645d; font-size:12px; }
        .prep-tv__alerts { min-width:0; display:grid; grid-template-columns:210px 1fr; align-items:center; padding:0 28px; background:#201805; border-top:1px solid #6b4b0b; color:#f59e0b; }
        .prep-tv__alerts.has-danger { background:#260c0c; border-color:#7f1d1d; color:#ef4444; } .prep-tv__alerts>div:first-child { display:flex; gap:10px; align-items:center; font-size:12px; letter-spacing:.04em; }
        .prep-tv__alerts-list { min-width:0; display:flex; gap:24px; overflow:hidden; } .prep-tv__alerts-list span { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; color:#f1d59c; } .prep-tv__alerts-list span+span:before { content:'•'; margin-right:24px; color:#705721; } .prep-tv__alerts-list .is-clear { color:#86c69e; }
        /* Compact 1200×800 TV layout: one preparation quadrant + three box quadrants. */
        .prep-tv { grid-template-rows:58px 68px 1fr 44px; }
        .prep-tv__header { padding:0 18px; }
        .prep-tv__logo { width:36px; height:36px; border-radius:10px; }
        .prep-tv__clock strong { font-size:23px; }
        .prep-tv__kpis { padding:8px 18px; gap:8px; }
        .prep-tv__kpis>div { border-radius:10px; padding:7px 12px; grid-template-columns:25px 1fr auto; gap:6px; }
        .prep-tv__kpis svg { width:19px; }
        .prep-tv__kpis span { font-size:10px; }
        .prep-tv__kpis strong { font-size:20px; }
        .prep-tv__grid { padding:0 18px 10px; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); gap:10px; }
        .prep-tv__panel { border-radius:13px; grid-template-rows:38px 1fr; }
        .prep-tv__panel--box { border-top:3px solid #f59e0b; }
        .prep-tv__panel--box.is-complete { border-top-color:#22c55e; }
        .prep-tv__panel-head { padding:0 12px; }
        .prep-tv__panel-head>div { gap:7px; }
        .prep-tv__panel--box .prep-tv__panel-head>div { color:#f59e0b; }
        .prep-tv__panel-head strong { font-size:12px; }
        .prep-tv__panel-head>span { font-size:9px; }
        .prep-tv__list { padding:7px; gap:5px; }
        .prep-task { min-height:48px; grid-template-columns:32px minmax(0,1fr) 52px 62px; gap:7px; border-radius:9px; padding:5px 8px; }
        .prep-task__status { width:29px; height:29px; border-radius:8px; }
        .prep-task h3 { margin:2px 0; font-size:12px; }
        .prep-task small { font-size:9px; }
        .prep-task__metric strong,.prep-task__time strong { font-size:14px; }
        .prep-task__metric span,.prep-task__time span { font-size:8px; }
        .box-order { border:0; border-radius:0; background:linear-gradient(145deg,#151711,#10120f); padding:9px 12px 7px; grid-template-rows:auto 15px 1fr auto; gap:6px; }
        .prep-tv__panel--box.is-complete .box-order { background:linear-gradient(145deg,#111b14,#0e120f); }
        .box-order__head { padding-bottom:6px; }
        .box-order__head>div:first-child strong { font-size:19px; }
        .box-order__result strong { font-size:22px; }
        .prep-tv__panel--box.is-complete .box-order__result strong,
        .prep-tv__panel--box.is-complete .box-order__result span { color:#22c55e; }
        .box-order__progress { height:8px; margin-right:42px; }
        .box-order__progress>strong { left:calc(100% + 8px); top:-5px; font-size:13px; }
        .box-order__items { gap:4px; }
        .box-order__items>div { gap:10px; padding:5px 8px; border-radius:6px; border-left-width:3px; }
        .box-order__items span { font-size:11px; }
        .box-order__items b { font-size:13px; }
        .box-order__items small { font-size:9px; padding-left:8px; }
        .box-order__slider { gap:8px; padding-top:5px; }
        .box-order__slider>div { gap:4px; }
        .box-order__slider i { width:5px; height:5px; }
        .box-order__slider i.is-active { width:14px; }
        .box-order__slider span { font-size:8px; }
        .prep-tv__alerts { grid-template-columns:180px 1fr; padding:0 18px; }
        @media (max-width:700px) { .prep-tv { height:auto; min-height:100vh; overflow:auto; grid-template-rows:auto auto auto auto; } .prep-tv__grid { grid-template-columns:1fr; grid-template-rows:none; } .prep-tv__panel { min-height:330px; } .prep-tv__kpis { grid-template-columns:1fr 1fr; } .prep-tv__alerts { min-height:60px; } }
      `}</style>
    </div>
  )
}

export default PreparationDashboard
