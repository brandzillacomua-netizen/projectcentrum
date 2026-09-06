import React from 'react'
import { usePreparationDashboardData } from './Preparation/hooks/usePreparationDashboardData'
import PreparationDashboardHeader from './Preparation/components/PreparationDashboardHeader'
import PreparationDashboardKPIs from './Preparation/components/PreparationDashboardKPIs'
import PreparationQueuePanel from './Preparation/components/PreparationQueuePanel'
import PreparationBoxOrderPanel from './Preparation/components/PreparationBoxOrderPanel'
import PreparationDashboardAlerts from './Preparation/components/PreparationDashboardAlerts'

const PreparationDashboard = () => {
  const {
    now,
    prepPage,
    boxesPage,
    prepPages,
    boxesPages,
    totals,
    alerts,
    visiblePrep,
    visibleBoxOrders,
    activeBoxOrders,
    staleSeconds,
    toggleFullscreen
  } = usePreparationDashboardData()

  return (
    <div className="prep-tv">
      <PreparationDashboardHeader
        staleSeconds={staleSeconds}
        toggleFullscreen={toggleFullscreen}
        now={now}
      />

      <PreparationDashboardKPIs totals={totals} />

      <main className={`prep-tv__grid prep-tv__grid--boxes-${visibleBoxOrders.length}`}>
        <PreparationQueuePanel
          visiblePrep={visiblePrep}
          prepPage={prepPage}
          prepPages={prepPages}
          now={now}
        />

        <PreparationBoxOrderPanel
          visibleBoxOrders={visibleBoxOrders}
          activeBoxOrders={activeBoxOrders}
          boxesPage={boxesPage}
          boxesPages={boxesPages}
        />
      </main>

      <PreparationDashboardAlerts alerts={alerts} />

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
        .box-order__progress { position:relative; height:12px; border-radius:99px; background:#2e2c21; margin-right:52px; } .box-order__progress>i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#f59e0b,#22c55e); transition:width .5s ease; } .box-order__progress>strong { position:absolute; left:calc(100% + 8px); top:-5px; color:#f59e0b; font-size:17px; }
        .box-order__items { align-content:start; display:grid; grid-template-columns:1fr; gap:8px; min-height:0; } .box-order__items>div { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:center; padding:10px 13px; background:#1a1c15; border-radius:99px; border-left:5px solid #f59e0b; }
        .box-order__items>div.is-ready { border-left-color:#22c55e; background:#132018; } .box-order__items span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(13px,1.2vw,17px); font-weight:700; color:#e3e7e4; } .box-order__items b { font-size:clamp(16px,1.4vw,21px); color:#f59e0b; } .box-order__items b i { color:#776f58; font-size:.7em; font-style:normal; } .box-order__items .is-ready b { color:#22c55e; } .box-order__items small { color:#9b9271; font-size:12px; font-weight:700; padding-left:12px; }
        .box-order__slider { display:flex; align-items:center; justify-content:space-between; gap:14px; padding-top:8px; border-top:1px solid #2b2c24; } .box-order__slider>div { display:flex; gap:6px; flex-wrap:wrap; } .box-order__slider i { width:7px; height:7px; border-radius:99px; background:#3f4138; transition:.3s; } .box-order__slider i.is-active { width:25px; background:#f59e0b; } .box-order__slider span { color:#777f79; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap; }
        .prep-tv__empty { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#22c55e; gap:8px; } .prep-tv__empty strong { color:#dce5df; font-size:17px; } .prep-tv__empty span { color:#59645d; font-size:12px; }
        .prep-tv__alerts { min-width:0; display:grid; grid-template-columns:210px 1fr; align-items:center; padding:0 28px; background:#201805; border-top:1px solid #6b4b0b; color:#f59e0b; }
        .prep-tv__alerts.has-danger { background:#260c0c; border-color:#7f1d1d; color:#ef4444; } .prep-tv__alerts>div:first-child { display:flex; gap:10px; align-items:center; font-size:12px; letter-spacing:.04em; }
        .prep-tv__alerts-list { min-width:0; display:flex; gap:24px; overflow:hidden; } .prep-tv__alerts-list span { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; color:#f1d59c; } .prep-tv__alerts-list span+span:before { content:'•'; margin-right:24px; color:#705721; } .prep-tv__alerts-list .is-clear { color:#86c69e; }
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
        .prep-tv__grid--boxes-0 .prep-tv__panel--prep { grid-column:1 / -1; grid-row:1 / -1; }
        .prep-tv__grid--boxes-1 .prep-tv__panel--prep,
        .prep-tv__grid--boxes-2 .prep-tv__panel--prep { grid-row:1 / -1; }
        .prep-tv__grid--boxes-1 .prep-tv__panel--box { grid-row:1 / -1; }
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
