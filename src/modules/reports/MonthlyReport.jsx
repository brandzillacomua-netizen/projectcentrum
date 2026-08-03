import React, { useCallback, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, ChevronDown, ChevronRight, Download, FileBarChart, Loader2, Package, RefreshCw, Scissors, TriangleAlert } from 'lucide-react'
import { supabase } from '../../supabase'
import './monthly-report.css'
import './monthly-drilldown.css'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const number = value => Number(value) || 0
const formatQty = value => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(number(value))
const formatDate = value => value ? new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—'

const downloadCsv = (report, month) => {
  const rows = [['Місяць', month], [], ['Наряд', 'Замовник', 'Виріб', 'Виготовлено', 'Брак', 'Фрези', 'Матеріал', 'Кількість']]
  ;(report?.naryads || []).forEach(naryad => {
    const materials = naryad.materials?.length ? naryad.materials : [{ name: '—', quantity: 0 }]
    materials.forEach((material, index) => rows.push([
      index === 0 ? naryad.naryad_number : '', index === 0 ? naryad.customer : '', index === 0 ? naryad.product_name : '',
      index === 0 ? naryad.produced_qty : '', index === 0 ? naryad.scrap_qty : '',
      index === 0 ? naryad.cutters_used : '', material.name, material.quantity
    ]))
  })
  rows.push([], ['Зведення матеріалів'], ['Категорія', 'Матеріал', 'Кількість'])
  ;(report?.materials || []).forEach(item => rows.push([item.category, item.name, item.quantity]))
  const csv = '\uFEFF' + rows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `misiachnyi-zvit-${month}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

const StatCard = ({ icon, label, value, accent = '#ff9000', hint }) => (
  <div className="monthly-stat" style={{ '--accent': accent }}>
    <div className="monthly-stat-icon">{icon}</div>
    <div><div className="monthly-stat-label">{label}</div><div className="monthly-stat-value">{value}</div>{hint && <div className="monthly-stat-hint">{hint}</div>}</div>
  </div>
)

export default function MonthlyReport() {
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [drilldowns, setDrilldowns] = useState({})
  const [drilldownLoading, setDrilldownLoading] = useState(new Set())
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!month) return
    const request = ++requestRef.current
    setLoading(true)
    setError('')
    setDrilldowns({})
    setExpanded(new Set())
    try {
      const { data, error: rpcError } = await supabase.rpc('mes_monthly_report', { p_month: `${month}-01` })
      if (rpcError) throw rpcError
      if (request === requestRef.current) setReport(data || { summary: {}, naryads: [], materials: [] })
    } catch (err) {
      if (request === requestRef.current) setError(err?.message || 'Не вдалося сформувати місячний звіт')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [month])

  const groupedMaterials = useMemo(() => {
    const result = { sheets: [], cutters: [], other: [] }
    ;(report?.materials || []).forEach(item => (result[item.category] || result.other).push(item))
    return result
  }, [report])

  const loadDrilldown = useCallback(async (naryad, key) => {
    setDrilldownLoading(previous => new Set(previous).add(key))
    try {
      const { data, error: detailError } = await supabase.rpc('mes_monthly_naryad_detail', {
        p_month: `${month}-01`,
        p_order_id: naryad.order_id,
        p_batch_index: naryad.batch_index ?? null
      })
      if (detailError) throw detailError
      setDrilldowns(previous => ({ ...previous, [key]: data || { details: [], cutters: [] } }))
    } catch (detailError) {
      setDrilldowns(previous => ({ ...previous, [key]: { details: [], cutters: [], error: detailError?.message || 'Не вдалося завантажити деталізацію' } }))
    } finally {
      setDrilldownLoading(previous => {
        const next = new Set(previous)
        next.delete(key)
        return next
      })
    }
  }, [month])

  const toggle = (key, naryad) => {
    const isOpening = !expanded.has(key)
    setExpanded(previous => {
      const next = new Set(previous)
      isOpening ? next.add(key) : next.delete(key)
      return next
    })
    if (isOpening && !drilldowns[key] && !drilldownLoading.has(key)) loadDrilldown(naryad, key)
  }

  const summary = report?.summary || {}
  return (
    <section className="monthly-report">
      <div className="monthly-hero">
        <div>
          <div className="monthly-eyebrow"><FileBarChart size={15} /> Управлінський звіт MES</div>
          <h2>Місячний звіт виробництва</h2>
          <p>Наряди, створені у вибраному місяці. Фактичний період робіт може виходити за його межі.</p>
        </div>
        <div className="monthly-actions">
          <label className="monthly-picker"><CalendarDays size={17} /><span>Місяць</span><input type="month" value={month} max={currentMonth()} onChange={event => { setMonth(event.target.value); setReport(null); setError(''); setExpanded(new Set()); setDrilldowns({}) }} /></label>
          <button className="monthly-button generate" onClick={load} disabled={loading || !month}><RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Формуємо…' : 'Сформувати звіт'}</button>
          <button className="monthly-button export" onClick={() => downloadCsv(report, month)} disabled={loading || !report}><Download size={16} /> Експорт CSV</button>
        </div>
      </div>

      {error && <div className="monthly-error"><AlertCircle size={19} /><div><b>Звіт не сформовано</b><span>{error}</span></div><button onClick={load}>Повторити</button></div>}
      {loading ? <div className="monthly-loading"><Loader2 size={30} className="spin" /><b>Агрегуємо дані за місяць…</b><span>Запит виконується на сервері без завантаження повної історії.</span></div> : error ? null : !report ? <div className="monthly-start"><FileBarChart size={34} /><b>Звіт ще не сформовано</b><span>Оберіть календарний місяць і натисніть «Сформувати звіт».</span><button onClick={load} disabled={!month}><FileBarChart size={16} /> Сформувати звіт</button></div> : <>
        <div className="monthly-stats">
          <StatCard icon={<FileBarChart size={20} />} label="Нарядів" value={formatQty(summary.naryad_count)} hint={`${formatQty(summary.card_count)} робочих карт`} />
          <StatCard icon={<Package size={20} />} label="Виготовлено" value={`${formatQty(summary.produced_qty)} шт`} accent="#22c55e" />
          <StatCard icon={<TriangleAlert size={20} />} label="Брак" value={`${formatQty(summary.scrap_qty)} шт`} accent="#ef4444" hint={`${formatQty(summary.scrap_rate)}% від обсягу`} />
          <StatCard icon={<Scissors size={20} />} label="Використано фрез" value={`${formatQty(summary.cutters_used)} шт`} accent="#3b82f6" />
        </div>

        <div className="monthly-layout">
          <div className="monthly-panel orders-panel">
            <div className="monthly-panel-head"><div><h3>Наряди за місяць</h3><span>Розгорніть рядок для перегляду всіх матеріалів</span></div><strong>{report?.naryads?.length || 0}</strong></div>
            <div className="monthly-table-wrap"><table className="monthly-table"><thead><tr><th>Наряд</th><th>Замовник</th><th>Виріб</th><th>Період робіт</th><th className="num">Виготовлено</th><th className="num">Брак</th><th className="num">Фрези</th></tr></thead><tbody>
              {(report?.naryads || []).map(naryad => {
                const key = `${naryad.order_id}-${naryad.batch_index ?? ''}`
                const isOpen = expanded.has(key)
                const drilldown = drilldowns[key]
                return <React.Fragment key={key}><tr className="monthly-order-row" onClick={() => toggle(key, naryad)}><td><button className="chevron">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><b>№ {naryad.naryad_number}</b></td><td>{naryad.customer || '—'}</td><td className="product-cell" title={naryad.product_name || ''}>{naryad.product_name || '—'}</td><td>{formatDate(naryad.first_activity)} — {formatDate(naryad.last_activity)}</td><td className="num good">{formatQty(naryad.produced_qty)}</td><td className={`num ${number(naryad.scrap_qty) ? 'bad' : ''}`}>{formatQty(naryad.scrap_qty)}</td><td className="num">{formatQty(naryad.cutters_used)}</td></tr>
                {isOpen && <tr className="monthly-detail-row"><td colSpan="7"><div className="monthly-drilldown">
                  {drilldownLoading.has(key) && <div className="drilldown-loading"><Loader2 size={18} className="spin" /> Завантажуємо склад наряду…</div>}
                  {drilldown?.error && <div className="drilldown-error"><AlertCircle size={15} />{drilldown.error}<button onClick={() => loadDrilldown(naryad, key)}>Повторити</button></div>}
                  {drilldown && !drilldown.error && <>
                    <div className="monthly-detail-section"><div className="detail-title">Деталі наряду <span>{drilldown.details?.length || 0} позицій</span></div>
                      {drilldown.details?.length ? <div className="part-table-wrap"><table className="part-table"><thead><tr><th>Деталь</th><th>План</th><th>Факт</th><th>БЗ за фактом розкрою</th><th>Брак</th></tr></thead><tbody>{drilldown.details.map(part => <tr key={part.nomenclature_id}><td>{part.name}</td><td>{formatQty(part.planned_qty)}</td><td className="actual">{formatQty(part.actual_cut_qty)}</td><td className="bz">+{formatQty(Math.max(0, number(part.actual_cut_qty) - number(part.planned_qty)))}</td><td className={number(part.scrap_qty) ? 'scrap' : ''}>{formatQty(part.scrap_qty)}</td></tr>)}</tbody></table></div> : <div className="empty-inline">Склад деталей у плані наряду не знайдений.</div>}
                    </div>
                    <div className="monthly-detail-section"><div className="detail-title">Фактично використані фрези <span>{drilldown.cutters?.length || 0} типів</span></div>
                      {drilldown.cutters?.length ? <div className="cutter-grid">{drilldown.cutters.map(cutter => <div key={cutter.name}><Scissors size={14} /><span>{cutter.name}</span><b>{formatQty(cutter.quantity)} шт</b></div>)}</div> : <div className="empty-inline">Використання фрез за типами не зафіксовано.</div>}
                    </div>
                  </>}
                  <div className="monthly-detail-section"><div className="detail-title">Використані матеріали <span>{naryad.materials?.length || 0} позицій</span></div>{naryad.materials?.length ? <div className="detail-grid">{naryad.materials.map(item => <div key={`${item.category}-${item.name}`}><span className={`material-dot ${item.category}`} /> <span>{item.name}</span><b>{formatQty(item.quantity)} {item.unit || 'шт'}</b></div>)}</div> : <div className="empty-inline">Видані матеріали для цього наряду не зафіксовані.</div>}</div>
                </div></td></tr>}</React.Fragment>
              })}
              {!report?.naryads?.length && <tr><td colSpan="7"><div className="monthly-empty"><FileBarChart size={34} />За обраний місяць завершених операцій не знайдено.</div></td></tr>}
            </tbody></table></div>
          </div>

          <aside className="monthly-panel materials-panel"><div className="monthly-panel-head"><div><h3>Матеріали за місяць</h3><span>Загальне фактичне використання</span></div></div>
            {[['sheets', 'Листи', Package], ['cutters', 'Фрези', Scissors], ['other', 'Інші матеріали', Package]].map(([key, title, Icon]) => groupedMaterials[key].length > 0 && <div className="material-group" key={key}><h4><Icon size={15} />{title}<span>{groupedMaterials[key].length}</span></h4>{groupedMaterials[key].map(item => <div className="material-total" key={item.name}><div><b>{item.name}</b><span>{item.naryad_count} нарядів</span></div><strong>{formatQty(item.quantity)} <small>{item.unit || 'шт'}</small></strong></div>)}</div>)}
            {!report?.materials?.length && <div className="monthly-empty small">Матеріалів не зафіксовано.</div>}
          </aside>
        </div>
      </>}
    </section>
  )
}
