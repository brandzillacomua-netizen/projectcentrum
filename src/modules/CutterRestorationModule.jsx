import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, Clock3, History, PackageCheck,
  Play, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Wrench
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMES } from '../MESContext'

const STATUS = {
  pending: { label: 'Очікує', color: '#f59e0b' },
  in_progress: { label: 'В роботі', color: '#38bdf8' },
  awaiting_reception: { label: 'На прийомці СО', color: '#a78bfa' },
  completed: { label: 'Завершено', color: '#22c55e' }
}

const formatDate = value => value
  ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—'

const userName = user =>
  [user?.last_name, user?.first_name].filter(Boolean).join(' ') || user?.login || 'Користувач'

export default function CutterRestorationModule() {
  const navigate = useNavigate()
  const { supabase, currentUser } = useMES()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState({ restored: '', rejected: '', note: '' })

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { error: syncError } = await supabase.rpc('reconcile_cutter_restoration_from_history')
    if (syncError && syncError.code !== 'PGRST202' && syncError.code !== '42883') {
      console.warn('[Cutter restoration] History synchronization failed:', syncError.message)
    }
    const { data, error } = await supabase
      .from('cutter_restoration_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      window.alert(`Не вдалося завантажити чергу: ${error.message}`)
    } else {
      setBatches(data || [])
    }
    if (!silent) setLoading(false)
  }, [supabase])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0)
    const channel = supabase
      .channel('cutter-restoration-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cutter_restoration_batches' }, () => load(true))
      .subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      supabase.removeChannel(channel)
    }
  }, [load, supabase])

  const counts = useMemo(() => ({
    pending: batches.filter(row => row.status === 'pending').length,
    inProgress: batches.filter(row => row.status === 'in_progress').length,
    reception: batches.filter(row => row.status === 'awaiting_reception').length,
    restored: batches.reduce((sum, row) => sum + Number(row.restored_qty || 0), 0)
  }), [batches])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return batches.filter(row => {
      if (filter === 'active' && !['pending', 'in_progress'].includes(row.status)) return false
      if (filter !== 'active' && filter !== 'all' && row.status !== filter) return false
      if (!needle) return true
      return [row.batch_number, row.cutter_name, row.source_machine, row.source_manager, row.assigned_user_name]
        .some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [batches, filter, search])

  const startBatch = async batch => {
    setWorking(true)
    const { data, error } = await supabase.rpc('start_cutter_restoration', {
      p_batch_id: batch.id,
      p_actor_id: currentUser?.id,
      p_actor_name: userName(currentUser)
    })
    setWorking(false)
    if (error) return window.alert(`Не вдалося взяти партію в роботу: ${error.message}`)
    const active = (Array.isArray(data) ? data[0] : data) || { ...batch, status: 'in_progress', assigned_user_id: currentUser?.id, assigned_user_name: userName(currentUser) }
    setSelected(active)
    setResult({ restored: String(active.received_qty), rejected: '0', note: '' })
    load(true)
  }

  const openFinish = batch => {
    setSelected(batch)
    setResult({ restored: String(batch.received_qty), rejected: '0', note: '' })
  }

  const finishBatch = async event => {
    event.preventDefault()
    const restored = Number(result.restored)
    const rejected = Number(result.rejected)
    if (!Number.isFinite(restored) || !Number.isFinite(rejected) || restored < 0 || rejected < 0) {
      return window.alert('Вкажіть коректну кількість.')
    }
    if (restored + rejected !== Number(selected.received_qty)) {
      return window.alert(`Потрібно розподілити всі ${selected.received_qty} шт.: відновлені + списані.`)
    }
    setWorking(true)
    const { error } = await supabase.rpc('finish_cutter_restoration', {
      p_batch_id: selected.id,
      p_restored_qty: restored,
      p_rejected_qty: rejected,
      p_actor_id: currentUser?.id,
      p_actor_name: userName(currentUser),
      p_note: result.note.trim() || null
    })
    setWorking(false)
    if (error) return window.alert(`Не вдалося завершити відновлення: ${error.message}`)
    setSelected(null)
    await load(true)
  }

  return (
    <div className="cutter-restoration">
      <header className="cr-header">
        <button className="cr-icon-button" onClick={() => navigate('/')} aria-label="Назад"><ArrowLeft size={20} /></button>
        <div className="cr-brand">
          <div className="cr-logo"><Wrench size={23} /></div>
          <div><h1>Відновлення фрез</h1><p>Заточування фасочних фрез · контроль партій</p></div>
        </div>
        <div className="cr-user"><ShieldCheck size={16} /><span>{userName(currentUser)}</span></div>
      </header>

      <main className="cr-main">
        <section className="cr-hero">
          <div>
            <span className="cr-eyebrow"><Sparkles size={14} /> Виробничий контур</span>
            <h2>Черга фасочних фрез на відновлення</h2>
            <p>Кожна партія створена автоматично з фактичної витрати після завершення розкрою.</p>
          </div>
          <button className="cr-refresh" onClick={() => load()} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Оновити</button>
        </section>

        <section className="cr-stats">
          <Stat icon={<Clock3 />} label="Очікує" value={counts.pending} color="#f59e0b" />
          <Stat icon={<Settings2 />} label="В роботі" value={counts.inProgress} color="#38bdf8" />
          <Stat icon={<PackageCheck />} label="На прийомці" value={counts.reception} color="#a78bfa" />
          <Stat icon={<CheckCircle2 />} label="Відновлено всього" value={counts.restored} color="#22c55e" suffix="шт" />
        </section>

        <section className="cr-toolbar">
          <div className="cr-tabs">
            {[
              ['active', 'Активні'],
              ['awaiting_reception', 'Прийомка'],
              ['completed', 'Історія'],
              ['all', 'Усі']
            ].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
          <label className="cr-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Партія, фреза, майстер..." /></label>
        </section>

        <section className="cr-grid">
          {loading ? <Empty icon={<RefreshCw className="spin" />} title="Завантаження черги..." /> : visible.length === 0
            ? <Empty icon={<CheckCircle2 />} title="У цій черзі партій немає" subtitle="Нові фасочні фрези з’являться тут після завершення розкрою." />
            : visible.map(batch => <BatchCard key={batch.id} batch={batch} currentUser={currentUser} working={working} onStart={startBatch} onFinish={openFinish} />)}
        </section>
      </main>

      {selected && (
        <div className="cr-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}>
          <form className="cr-modal" onSubmit={finishBatch}>
            <div className="cr-modal-title"><div><span>{selected.batch_number}</span><h3>Результат відновлення</h3></div><button type="button" onClick={() => setSelected(null)}>×</button></div>
            <div className="cr-cutter-summary"><Wrench size={22} /><div><strong>{selected.cutter_name}</strong><span>У партії: {selected.received_qty} шт.</span></div></div>
            <div className="cr-result-grid">
              <label><span>Відновлено, шт.</span><input type="number" min="0" step="1" value={result.restored} onChange={e => setResult(v => ({ ...v, restored: e.target.value }))} /></label>
              <label><span>Не підлягає відновленню, шт.</span><input type="number" min="0" step="1" value={result.rejected} onChange={e => setResult(v => ({ ...v, rejected: e.target.value }))} /></label>
            </div>
            <label className="cr-note"><span>Коментар</span><textarea rows="3" value={result.note} onChange={e => setResult(v => ({ ...v, note: e.target.value }))} placeholder="Стан фрез, причина списання..." /></label>
            <div className="cr-info"><PackageCheck size={18} /><span>Після підтвердження відновлена кількість створить документ прийомки на Склад Оперативний.</span></div>
            <button className="cr-primary" disabled={working}>{working ? 'Збереження...' : 'Завершити та передати на прийомку'}</button>
          </form>
        </div>
      )}
      <style>{styles}</style>
    </div>
  )
}

function Stat({ icon, label, value, color, suffix }) {
  return <div className="cr-stat" style={{ '--accent': color }}><div className="cr-stat-icon">{icon}</div><div><span>{label}</span><strong>{value} {suffix && <small>{suffix}</small>}</strong></div></div>
}

function Empty({ icon, title, subtitle }) {
  return <div className="cr-empty">{icon}<strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
}

function BatchCard({ batch, currentUser, working, onStart, onFinish }) {
  const state = STATUS[batch.status] || STATUS.pending
  const mine = String(batch.assigned_user_id || '') === String(currentUser?.id || '')
  return (
    <article className="cr-card" style={{ '--status': state.color }}>
      <div className="cr-card-head"><span className="cr-batch">{batch.batch_number}</span><span className="cr-status">{state.label}</span></div>
      <h3>{batch.cutter_name}</h3>
      <div className="cr-qty"><strong>{batch.received_qty}</strong><span>шт. у партії</span></div>
      <div className="cr-meta">
        <span><b>Створено</b>{formatDate(batch.created_at)}</span>
        <span><b>Верстат</b>{batch.source_machine || 'Не вказано'}</span>
        <span><b>Майстер</b>{batch.source_manager || 'Не вказано'}</span>
        {batch.assigned_user_name && <span><b>Виконавець</b>{batch.assigned_user_name}</span>}
      </div>
      {batch.status === 'pending' && <button className="cr-primary" disabled={working} onClick={() => onStart(batch)}><Play size={16} /> Взяти в роботу</button>}
      {batch.status === 'in_progress' && mine && <button className="cr-primary blue" disabled={working} onClick={() => onFinish(batch)}><CheckCircle2 size={16} /> Внести результат</button>}
      {batch.status === 'in_progress' && !mine && <div className="cr-locked"><Settings2 size={15} /> Партія закріплена за іншим працівником</div>}
      {batch.status === 'awaiting_reception' && <div className="cr-acceptance"><PackageCheck size={17} /><span>Відновлено {batch.restored_qty} · списано {batch.rejected_qty}<b>Очікує підтвердження складу</b></span></div>}
      {batch.status === 'completed' && <div className="cr-complete"><History size={16} /> Відновлено {batch.restored_qty} · списано {batch.rejected_qty}</div>}
    </article>
  )
}

const styles = `
  .cutter-restoration{min-height:100vh;background:#050606;color:#f5f7f8;font-family:Inter,system-ui,sans-serif}
  .cr-header{height:72px;padding:0 28px;border-bottom:1px solid #1c2224;background:rgba(8,10,11,.96);display:flex;align-items:center;gap:18px;position:sticky;top:0;z-index:20}
  .cr-icon-button{width:40px;height:40px;border:1px solid #293033;border-radius:11px;background:#101314;color:#aeb8bc;display:grid;place-items:center;cursor:pointer}
  .cr-brand{display:flex;align-items:center;gap:12px}.cr-logo{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#0e7490,#22d3ee);color:#001014;box-shadow:0 0 30px #22d3ee22}
  .cr-brand h1{font-size:17px;margin:0;font-weight:900}.cr-brand p{font-size:11px;color:#657176;margin:3px 0 0}.cr-user{margin-left:auto;display:flex;gap:8px;align-items:center;color:#8c999e;font-size:12px}
  .cr-main{max-width:1440px;margin:auto;padding:34px 32px 70px}.cr-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}
  .cr-eyebrow{display:inline-flex;align-items:center;gap:6px;color:#22d3ee;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em}
  .cr-hero h2{font-size:29px;margin:10px 0 7px;letter-spacing:-.03em}.cr-hero p{margin:0;color:#758187;font-size:13px}
  .cr-refresh{height:42px;padding:0 16px;border:1px solid #263034;border-radius:11px;background:#101415;color:#c7d0d3;display:flex;gap:8px;align-items:center;font-weight:800;cursor:pointer}
  .cr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:25px}.cr-stat{background:#0b0e0f;border:1px solid #1a2022;border-top:2px solid var(--accent);padding:18px;border-radius:15px;display:flex;align-items:center;gap:14px}
  .cr-stat-icon{width:38px;height:38px;border-radius:11px;background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent);display:grid;place-items:center}.cr-stat-icon svg{width:19px}
  .cr-stat span{display:block;color:#68757a;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.08em}.cr-stat strong{display:block;font-size:25px;margin-top:3px}.cr-stat small{font-size:11px;color:#677277}
  .cr-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px}.cr-tabs{display:flex;gap:5px;background:#0a0d0e;border:1px solid #191f21;padding:4px;border-radius:12px}
  .cr-tabs button{border:0;background:transparent;color:#647075;padding:9px 15px;border-radius:8px;font-weight:800;cursor:pointer}.cr-tabs button.active{background:#172024;color:#e8f9fc}
  .cr-search{width:330px;height:42px;border:1px solid #20282b;background:#0b0e0f;border-radius:11px;display:flex;align-items:center;gap:9px;padding:0 13px;color:#59666b}.cr-search input{border:0;outline:0;background:none;color:#e9eff1;width:100%}
  .cr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.cr-card{background:linear-gradient(160deg,#0d1112,#090b0c);border:1px solid #1c2325;border-top:2px solid var(--status);border-radius:16px;padding:18px;min-height:305px;display:flex;flex-direction:column}
  .cr-card-head{display:flex;justify-content:space-between;align-items:center}.cr-batch{font-family:ui-monospace,monospace;color:#7c898e;font-size:11px}.cr-status{font-size:10px;font-weight:900;color:var(--status);background:color-mix(in srgb,var(--status) 10%,transparent);padding:6px 9px;border-radius:20px}
  .cr-card h3{font-size:16px;margin:18px 0 5px;min-height:40px}.cr-qty{display:flex;align-items:baseline;gap:8px;margin-bottom:16px}.cr-qty strong{font-size:31px}.cr-qty span{font-size:11px;color:#69757a}
  .cr-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid #171d1f;padding-top:13px;margin-bottom:16px}.cr-meta span{color:#a4afb3;font-size:11px;overflow:hidden;text-overflow:ellipsis}.cr-meta b{display:block;color:#566267;font-size:9px;text-transform:uppercase;margin-bottom:3px}
  .cr-primary{margin-top:auto;width:100%;height:43px;border:0;border-radius:11px;background:linear-gradient(135deg,#0891b2,#22d3ee);color:#001014;font-weight:950;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.cr-primary.blue{background:linear-gradient(135deg,#0284c7,#38bdf8)}.cr-primary:disabled{opacity:.55;cursor:wait}
  .cr-locked,.cr-complete{margin-top:auto;border:1px solid #263034;background:#101415;border-radius:10px;padding:11px;color:#778489;font-size:11px;display:flex;gap:7px;align-items:center}.cr-complete{color:#4ade80;border-color:#164e32}
  .cr-acceptance{margin-top:auto;border:1px solid #4c1d9555;background:#2e106522;color:#c4b5fd;border-radius:11px;padding:10px;display:flex;gap:9px;font-size:11px}.cr-acceptance span{display:flex;flex-direction:column;gap:3px}.cr-acceptance b{color:#ddd6fe}
  .cr-empty{grid-column:1/-1;min-height:300px;border:1px dashed #20282b;border-radius:16px;color:#3d484c;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px}.cr-empty svg{width:35px;height:35px}.cr-empty strong{color:#707c81}.cr-empty span{font-size:12px}
  .cr-modal-backdrop{position:fixed;inset:0;background:#000c;backdrop-filter:blur(7px);z-index:50;display:grid;place-items:center;padding:20px}.cr-modal{width:min(560px,100%);background:#0d1112;border:1px solid #283236;border-radius:18px;padding:22px;box-shadow:0 30px 100px #000}
  .cr-modal-title{display:flex;justify-content:space-between}.cr-modal-title span{font:11px ui-monospace;color:#22d3ee}.cr-modal-title h3{margin:5px 0 0;font-size:21px}.cr-modal-title button{border:0;background:#171d1f;color:#8b989d;width:34px;height:34px;border-radius:9px;font-size:21px;cursor:pointer}
  .cr-cutter-summary{display:flex;gap:12px;align-items:center;background:#080a0b;border:1px solid #1b2224;border-radius:12px;padding:14px;margin:20px 0}.cr-cutter-summary div{display:flex;flex-direction:column;gap:4px}.cr-cutter-summary span{font-size:11px;color:#667277}
  .cr-result-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cr-result-grid label,.cr-note{display:flex;flex-direction:column;gap:7px}.cr-result-grid span,.cr-note span{font-size:10px;font-weight:900;color:#7a878c;text-transform:uppercase}
  .cr-result-grid input,.cr-note textarea{background:#070909;border:1px solid #273034;border-radius:10px;color:#fff;padding:12px;font:inherit;outline:none}.cr-result-grid input:focus,.cr-note textarea:focus{border-color:#0891b2}.cr-note{margin-top:13px}.cr-note textarea{resize:vertical}
  .cr-info{display:flex;gap:9px;align-items:flex-start;color:#a78bfa;background:#2e106522;border:1px solid #4c1d9555;border-radius:10px;padding:11px;font-size:11px;margin:14px 0}.cr-info svg{flex:0 0 auto}
  .spin{animation:cr-spin .8s linear infinite}@keyframes cr-spin{to{transform:rotate(360deg)}}
  @media(max-width:1000px){.cr-grid{grid-template-columns:repeat(2,1fr)}.cr-stats{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.cr-header{padding:0 14px}.cr-user span,.cr-brand p{display:none}.cr-main{padding:22px 14px 50px}.cr-hero{align-items:flex-start}.cr-hero h2{font-size:23px}.cr-refresh{font-size:0;padding:0 12px}.cr-stats{gap:8px}.cr-stat{padding:13px}.cr-stat strong{font-size:21px}.cr-toolbar{align-items:stretch;flex-direction:column}.cr-tabs{overflow:auto}.cr-tabs button{white-space:nowrap}.cr-search{width:auto}.cr-grid{grid-template-columns:1fr}.cr-result-grid{grid-template-columns:1fr}}
`
