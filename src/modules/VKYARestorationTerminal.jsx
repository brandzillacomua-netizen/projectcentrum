import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, CornerUpLeft, Play, RefreshCw, Search, ShieldCheck, Wrench, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { useRestorationStages } from '../hooks/useRestorationStages'
import { returnRestorationToRoute } from './VKYA/quality-hold/qualityHoldService'

const STATUS = {
  new: { label: 'ОЧІКУЄ', color: '#f59e0b' },
  in_progress: { label: 'В РОБОТІ', color: '#06b6d4' },
  completed: { label: 'ЗАВЕРШЕНО', color: '#10b981' }
}

const userName = user => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || user?.login || ''

export default function VKYARestorationTerminal() {
  const { currentUser } = useMES()
  const [cards, setCards] = useState([])
  const [legacyItems, setLegacyItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [selectedCard, setSelectedCard] = useState(null)
  const [operator, setOperator] = useState(userName(currentUser))
  const [completedQty, setCompletedQty] = useState('')
  const [finalScrapQty, setFinalScrapQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [legacyDraft, setLegacyDraft] = useState(null)
  const [legacyQuantity, setLegacyQuantity] = useState('')
  const [legacyStageId, setLegacyStageId] = useState('')
  const { rows: restorationStages } = useRestorationStages()

  const loadCards = useCallback(async () => {
    setLoading(true)
    const [cardsResult, legacyResult] = await Promise.all([
      supabase.from('vkya_restoration_cards').select('*').order('created_at', { ascending: true }),
      supabase.from('inventory').select('id,nomenclature_id,name,unit,total_qty,type,updated_at').eq('type', 'scrap_restoration').gt('total_qty', 0).order('updated_at', { ascending: true })
    ])
    const loadError = cardsResult.error || legacyResult.error
    if (loadError) setError(loadError.message)
    else { setCards(cardsResult.data || []); setLegacyItems(legacyResult.data || []); setError('') }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadCards, 0)
    return () => window.clearTimeout(timer)
  }, [loadCards])

  const visibleCards = useMemo(() => cards.filter(card => {
    const matchesTab = tab === 'awaiting_action'
      ? card.status === 'completed' && !card.shop2_card_id && !card.route_card_id && Number(card.completed_quantity) > 0
      : tab === 'completed'
        ? card.status === 'completed' && (Boolean(card.shop2_card_id) || Boolean(card.route_card_id) || Number(card.completed_quantity) === 0)
        : card.status !== 'completed'
    const haystack = `${card.card_number} ${card.nomenclature_name} ${card.restoration_stage} ${card.operator_name || ''}`.toLowerCase()
    return matchesTab && haystack.includes(query.trim().toLowerCase())
  }), [cards, query, tab])

  const startCard = async () => {
    if (!selectedCard || !operator.trim()) return
    setSaving(true)
    const { error: updateError } = await supabase.from('vkya_restoration_cards').update({
      status: 'in_progress', operator_name: operator.trim(), started_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', selectedCard.id).eq('status', 'new')
    setSaving(false)
    if (updateError) return setError(updateError.message)
    setSelectedCard(null)
    await loadCards()
  }

  const completeCard = async () => {
    const scrapQty = Number(finalScrapQty)
    const qty = Number(selectedCard?.quantity || 0) - scrapQty
    if (!selectedCard || !Number.isInteger(scrapQty) || scrapQty < 0 || scrapQty > Number(selectedCard.quantity)) return
    setSaving(true)
    const { error: updateError } = await supabase.rpc('complete_vkya_restoration_card', {
      p_card_id: selectedCard.id,
      p_completed_quantity: qty,
      p_final_scrap_quantity: scrapQty
    })
    setSaving(false)
    if (updateError) return setError(updateError.message)
    setSelectedCard(null)
    setCompletedQty('')
    setFinalScrapQty('')
    await loadCards()
    alert(`Карту завершено: ${qty} шт. відновлено, ${scrapQty} шт. переведено в Утиль.`)
  }

  const openCard = card => {
    setSelectedCard(card)
    setOperator(card.operator_name || userName(currentUser))
    setCompletedQty(String(card.quantity))
    setFinalScrapQty('0')
  }

  const returnToSourceRoute = async () => {
    if (!selectedCard || selectedCard.status !== 'completed' || selectedCard.route_card_id) return
    if (!window.confirm(`Повернути ${selectedCard.completed_quantity} ${selectedCard.unit || 'шт'} у початковий наряд (в Буфер Цеху №2)?`)) return
    setSaving(true)
    try {
      await returnRestorationToRoute(supabase, {
        restorationCardId: selectedCard.id,
        userName: userName(currentUser) || selectedCard.operator_name || null
      })
      setSelectedCard(null)
      await loadCards()
      alert(`✅ ${selectedCard.completed_quantity} шт. повернено у Буфер Цеху №2 початкового наряду.`)
    } catch (returnError) {
      setError(returnError.message)
    } finally {
      setSaving(false)
    }
  }

  const returnLegacyToBZ = async () => {
    if (!selectedCard || selectedCard.status !== 'completed' || selectedCard.route_card_id) return
    if (!window.confirm(`Повернути ${selectedCard.completed_quantity} ${selectedCard.unit || 'шт'} безпосередньо у Базовий залишок (БЗ)?`)) return
    setSaving(true)
    try {
      const { error: returnError } = await supabase.rpc('return_legacy_restoration_to_bz', {
        p_restoration_card_id: selectedCard.id,
        p_returned_by: userName(currentUser) || selectedCard.operator_name || null
      })
      if (returnError) throw returnError
      setSelectedCard(null)
      await loadCards()
      alert(`✅ ${selectedCard.completed_quantity} шт. успішно зараховано у Базовий залишок на склад.`)
    } catch (retError) {
      setError(retError.message)
    } finally {
      setSaving(false)
    }
  }

  const dispatchToShop2 = async (stage) => {
    if (!selectedCard || selectedCard.status !== 'completed' || selectedCard.shop2_card_id) return
    if (!window.confirm(`Передати ${selectedCard.completed_quantity} ${selectedCard.unit || 'шт'} у Цех №2 (${stage})?`)) return
    setSaving(true)
    try {
      const { data, error: dispatchError } = await supabase.rpc('dispatch_vkya_restoration_to_shop2', {
        p_restoration_card_id: selectedCard.id,
        p_shop2_stage: stage
      })
      if (dispatchError) throw dispatchError
      setSelectedCard(null)
      await loadCards()
      alert(`✅ Деталі успішно передано в Цех №2 (${stage}).`)
    } catch (dispatchErr) {
      setError(dispatchErr.message)
    } finally {
      setSaving(false)
    }
  }

  const assignLegacyItem = async () => {
    const quantity = Number(legacyQuantity)
    if (!legacyDraft || !legacyStageId || !Number.isInteger(quantity) || quantity <= 0 || quantity > Number(legacyDraft.total_qty)) return
    setSaving(true)
    const { error: assignError } = await supabase.rpc('assign_legacy_vkya_restoration_card', {
      p_inventory_id: legacyDraft.id,
      p_quantity: quantity,
      p_restoration_stage_id: legacyStageId,
      p_created_by_user_id: currentUser?.id || null,
      p_created_by_name: userName(currentUser) || null
    })
    setSaving(false)
    if (assignError) return setError(assignError.message)
    setLegacyDraft(null)
    setLegacyQuantity('')
    setLegacyStageId('')
    await loadCards()
  }

  return <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '28px clamp(16px, 3vw, 42px)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/brak" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', textDecoration: 'none', gap: '7px', fontWeight: 800 }}><ArrowLeft size={18}/> ВКЯ</Link>
        <div style={{ width: 1, height: 32, background: '#222' }}/>
        <div><div style={{ fontSize: '1.45rem', fontWeight: 1000 }}>Термінал відновлення ВКЯ</div><div style={{ color: '#64748b', fontSize: '.75rem', marginTop: 4 }}>Карти внутрішнього відновлення деталей</div></div>
      </div>
      <button onClick={loadCards} disabled={loading} style={{ background: '#111', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 12, padding: '11px 15px', cursor: 'pointer' }}><RefreshCw size={17}/></button>
    </header>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
      {[
        ['Очікують', cards.filter(c => c.status === 'new').length, '#f59e0b', Clock3],
        ['В роботі', cards.filter(c => c.status === 'in_progress').length, '#06b6d4', Wrench],
        ['Завершено', cards.filter(c => c.status === 'completed').length, '#10b981', CheckCircle2]
      ].map(([label, value, color, Icon]) => <div key={label} style={{ background: '#0d0d0d', border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 18, padding: 18 }}><Icon size={19} color={color}/><div style={{ fontSize: '1.8rem', fontWeight: 1000, marginTop: 10 }}>{value}</div><div style={{ color: '#666', fontSize: '.72rem', fontWeight: 850 }}>{label}</div></div>)}
    </div>

    {legacyItems.length > 0 && <section style={{ background: '#0d0d0d', border: '1px solid #f59e0b44', borderRadius: 20, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}><div><div style={{ color: '#f59e0b', fontSize: '.7rem', fontWeight: 1000 }}>СТАРИЙ ОБЛІК ВІДНОВЛЕННЯ</div><h2 style={{ margin: '6px 0 3px', fontSize: '1.15rem' }}>Нерозподілений залишок</h2><div style={{ color: '#666', fontSize: '.72rem' }}>Виберіть позицію, кількість та етап — система створить звичайну карту.</div></div><div style={{ color: '#f59e0b', fontWeight: 1000 }}>{legacyItems.reduce((sum, item) => sum + Number(item.total_qty || 0), 0)} шт</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{legacyItems.map(item => <button key={item.id} onClick={() => { setLegacyDraft(item); setLegacyQuantity(''); setLegacyStageId('') }} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', textAlign: 'left', background: '#111', color: '#fff', border: '1px solid #252525', borderRadius: 13, padding: '13px 15px', cursor: 'pointer' }}><span style={{ fontWeight: 850, overflowWrap: 'anywhere' }}>{item.name}</span><span style={{ color: '#f59e0b', fontWeight: 1000, whiteSpace: 'nowrap' }}>{item.total_qty} {item.unit || 'шт'}</span></button>)}</div>
    </section>}

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {[['active', 'АКТИВНІ КАРТИ'], ['awaiting_action', 'ОЧІКУЮТЬ РІШЕННЯ'], ['completed', 'ЗАВЕРШЕНІ']].map(([value, label]) => <button key={value} onClick={() => setTab(value)} style={{ background: tab === value ? '#06b6d4' : '#111', color: tab === value ? '#001014' : '#aaa', border: '1px solid #222', padding: '10px 18px', borderRadius: 11, fontWeight: 950, cursor: 'pointer' }}>{label}</button>)}
      <label style={{ flex: 1, minWidth: 230, display: 'flex', alignItems: 'center', gap: 9, background: '#0d0d0d', border: '1px solid #222', borderRadius: 11, padding: '0 13px' }}><Search size={16} color="#666"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук за деталлю, етапом або картою" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: '#fff', padding: '11px 0' }}/></label>
    </div>

    {error && <div style={{ background: '#ef444418', border: '1px solid #ef444455', color: '#fca5a5', borderRadius: 12, padding: 14, marginBottom: 16 }}>Помилка: {error}</div>}
    {!loading && visibleCards.length === 0 && <div style={{ border: '2px dashed #222', borderRadius: 22, padding: 55, textAlign: 'center', color: '#555' }}>У цій черзі карт немає</div>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibleCards.map(card => { const meta = STATUS[card.status]; const canOpen = card.status !== 'completed' || (!card.shop2_card_id && !card.route_card_id); return <button key={card.id} onClick={() => canOpen && openCard(card)} style={{ textAlign: 'left', background: '#101010', color: '#fff', border: '1px solid #202020', borderRadius: 18, padding: 20, cursor: canOpen ? 'pointer' : 'default', display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(140px, .5fr) auto', gap: 20, alignItems: 'center' }}>
        <div><div style={{ color: '#06b6d4', fontSize: '.68rem', fontWeight: 950 }}>КАРТА ВІДНОВЛЕННЯ №{card.card_number}</div><div style={{ fontSize: '1.05rem', fontWeight: 950, marginTop: 6, overflowWrap: 'anywhere' }}>{card.nomenclature_name}</div><div style={{ color: '#666', fontSize: '.7rem', marginTop: 5 }}>Створено {new Date(card.created_at).toLocaleString('uk-UA')}</div></div>
        <div><div style={{ color: '#777', fontSize: '.65rem', fontWeight: 900 }}>ЕТАП ВІДНОВЛЕННЯ</div><div style={{ fontWeight: 900, marginTop: 5 }}>{card.restoration_stage}</div>{card.operator_name && <div style={{ color: '#888', fontSize: '.7rem', marginTop: 5 }}>{card.operator_name}</div>}</div>
        <div style={{ textAlign: 'right' }}><div style={{ color: meta.color, fontSize: '.68rem', fontWeight: 1000 }}>{card.route_card_id ? (card.route_card_id === '00000000-0000-0000-0000-000000000000' ? 'ПОВЕРНЕНО НА СКЛАД (БЗ)' : 'ПОВЕРНЕНО В НАРЯД') : card.shop2_card_id ? `ПЕРЕДАНО: ${card.shop2_stage}` : meta.label}</div><div style={{ fontSize: '1.65rem', fontWeight: 1000, marginTop: 5 }}>{card.status === 'completed' ? `${card.completed_quantity} / ` : ''}{card.quantity} <small style={{ fontSize: '.65rem', color: '#666' }}>{card.unit}</small></div>{card.status === 'completed' && !card.shop2_card_id && !card.route_card_id && Number(card.completed_quantity) > 0 && <div style={{ color: '#f59e0b', fontSize: '.62rem', fontWeight: 950, marginTop: 5 }}>{card.source_task_id ? 'ОЧІКУЄ ПОВЕРНЕННЯ В НАРЯД' : 'ОЧІКУЄ РІШЕННЯ'}</div>}</div>
      </button> })}
    </div>

    {selectedCard && <div onClick={() => !saving && setSelectedCard(null)} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,.86)', display: 'grid', placeItems: 'center', padding: 20 }}><div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 510, background: '#0d0d0d', border: '1px solid #292929', borderRadius: 24, padding: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15 }}><div><div style={{ color: '#06b6d4', fontSize: '.7rem', fontWeight: 950 }}>КАРТА №{selectedCard.card_number}</div><h2 style={{ margin: '8px 0 4px' }}>{selectedCard.nomenclature_name}</h2><div style={{ color: '#888' }}>{selectedCard.restoration_stage} · {selectedCard.quantity} {selectedCard.unit}</div></div><button onClick={() => setSelectedCard(null)} style={{ background: 'transparent', border: 0, color: '#777', cursor: 'pointer' }}><X/></button></div>
      {selectedCard.status === 'new' && <>
        <label style={{ display: 'block', color: '#888', fontSize: '.72rem', fontWeight: 900, margin: '25px 0 8px' }}>ПРАЦІВНИК ВКЯ</label>
        <input autoFocus value={operator} onChange={event => setOperator(event.target.value)} placeholder="Вкажіть працівника" style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: 12, color: '#fff', padding: 14 }}/>
        <button onClick={startCard} disabled={saving || !operator.trim()} style={{ width: '100%', marginTop: 20, background: '#06b6d4', border: 0, borderRadius: 13, padding: 14, color: '#001014', fontWeight: 1000, cursor: 'pointer' }}><Play size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ВЗЯТИ В РОБОТУ</button>
      </>}
      {selectedCard.status === 'in_progress' && <>
        <label style={{ display: 'block', color: '#ef4444', fontSize: '.72rem', fontWeight: 1000, margin: '25px 0 8px' }}>СКІЛЬКИ ДЕТАЛЕЙ ПЕРЕВЕСТИ В УТИЛЬ, {selectedCard.unit}</label>
        <input autoFocus type="number" min="0" max={selectedCard.quantity} value={finalScrapQty} onChange={event => {
          setFinalScrapQty(event.target.value)
          const scrap = Number(event.target.value)
          setCompletedQty(Number.isFinite(scrap) ? String(Math.max(0, Number(selectedCard.quantity) - scrap)) : '')
        }} style={{ boxSizing: 'border-box', width: '100%', background: '#160707', border: '1px solid #ef444466', borderRadius: 12, color: '#fff', padding: 14, fontSize: '1.15rem', fontWeight: 900 }}/>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, background: '#07140f', border: '1px solid #10b98144', borderRadius: 12, padding: 13 }}><span style={{ color: '#8a9a93', fontSize: '.75rem', fontWeight: 850 }}>БУДЕ ВІДНОВЛЕНО</span><strong style={{ color: '#10b981' }}>{completedQty || 0} {selectedCard.unit}</strong></div>
        <div style={{ color: '#777', fontSize: '.7rem', marginTop: 10 }}>Уся кількість карти має бути розподілена між відновленими деталями та остаточним утилем.</div>
        <button onClick={completeCard} disabled={saving || finalScrapQty === '' || !Number.isInteger(Number(finalScrapQty)) || Number(finalScrapQty) < 0 || Number(finalScrapQty) > Number(selectedCard.quantity)} style={{ width: '100%', marginTop: 20, background: '#10b981', border: 0, borderRadius: 13, padding: 14, color: '#00150e', fontWeight: 1000, cursor: 'pointer' }}><ShieldCheck size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ЗАВЕРШИТИ КАРТУ</button>
      </>}
      {selectedCard.status === 'completed' && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 15 }}>
          {selectedCard.source_history_id && selectedCard.source_task_id ? (
            <div style={{ background: '#10b98112', border: '1px solid #10b98144', borderRadius: 14, padding: 15 }}>
              <div style={{ color: '#10b981', fontSize: '.72rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ У БУФЕР ЦЕХУ №2</div>
              <div style={{ color: '#94a3b8', fontSize: '.7rem', marginTop: 7 }}>Відновлені деталі надійдуть у Буфер Цеху №2 початкового наряду. Начальник Цеху №2 зможе направити їх на потрібний етап (Пресування, Фарбування тощо).</div>
              <button onClick={returnToSourceRoute} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ width: '100%', marginTop: 14, background: '#10b981', border: 0, borderRadius: 12, padding: 14, color: '#00150e', fontWeight: 1000, cursor: 'pointer' }}><CornerUpLeft size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ПОВЕРНУТИ В НАРЯД (В БУФЕР ЦЕХУ №2) · {selectedCard.completed_quantity} {selectedCard.unit}</button>
            </div>
          ) : (
            <div style={{ background: '#f59e0b12', border: '1px solid #f59e0b44', borderRadius: 14, padding: 15 }}>
              <div style={{ color: '#f59e0b', fontSize: '.72rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ НА СКЛАД (В БАЗОВИЙ ЗАЛИШОК)</div>
              <div style={{ color: '#94a3b8', fontSize: '.7rem', marginTop: 7 }}>Ця карта створена зі старого обліку і не має зв'язку з активним нарядом. Відновлені деталі будуть зараховані безпосередньо в Базовий залишок (БЗ) на склад.</div>
              <button onClick={returnLegacyToBZ} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ width: '100%', marginTop: 14, background: '#f59e0b', border: 0, borderRadius: 12, padding: 14, color: '#170d00', fontWeight: 1000, cursor: 'pointer' }}><CornerUpLeft size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ПОВЕРНУТИ НА СКЛАД (БЗ) · {selectedCard.completed_quantity} {selectedCard.unit}</button>
            </div>
          )}

          <div style={{ background: '#06b6d412', border: '1px solid #06b6d444', borderRadius: 14, padding: 15 }}>
            <div style={{ color: '#06b6d4', fontSize: '.72rem', fontWeight: 1000 }}>ПЕРЕДАЧА В ЦЕХ №2</div>
            <div style={{ color: '#94a3b8', fontSize: '.7rem', marginTop: 7 }}>Ви можете передати ці відновлені деталі як нове завдання у Цех №2 для проходження додаткової обробки.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button onClick={() => dispatchToShop2('Пресування')} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ background: '#06b6d4', border: 0, borderRadius: 12, padding: 12, color: '#001014', fontWeight: 1000, cursor: 'pointer', fontSize: '.78rem' }}>🛠️ ПРЕСУВАННЯ</button>
              <button onClick={() => dispatchToShop2('Фарбування')} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ background: '#06b6d4', border: 0, borderRadius: 12, padding: 12, color: '#001014', fontWeight: 1000, cursor: 'pointer', fontSize: '.78rem' }}>🎨 ФАРБУВАННЯ</button>
            </div>
          </div>
        </div>
      )}
    </div></div>}
    {legacyDraft && <div onClick={() => !saving && setLegacyDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,.88)', display: 'grid', placeItems: 'center', padding: 20 }}><div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: '#0d0d0d', border: '1px solid #f59e0b55', borderRadius: 22, padding: 25 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><div><div style={{ color: '#f59e0b', fontSize: '.68rem', fontWeight: 1000 }}>РОЗПОДІЛИТИ У КАРТУ</div><h2 style={{ margin: '7px 0 3px', overflowWrap: 'anywhere' }}>{legacyDraft.name}</h2><div style={{ color: '#777' }}>Доступно: {legacyDraft.total_qty} {legacyDraft.unit || 'шт'}</div></div><button onClick={() => setLegacyDraft(null)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: '#777', cursor: 'pointer' }}><X/></button></div><label style={{ display: 'block', color: '#888', fontSize: '.7rem', fontWeight: 950, margin: '22px 0 7px' }}>КІЛЬКІСТЬ</label><input autoFocus type="number" min="1" max={legacyDraft.total_qty} value={legacyQuantity} onChange={event => setLegacyQuantity(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: 11, color: '#fff', padding: 13 }}/><label style={{ display: 'block', color: '#888', fontSize: '.7rem', fontWeight: 950, margin: '17px 0 7px' }}>ЕТАП ВІДНОВЛЕННЯ</label><select value={legacyStageId} onChange={event => setLegacyStageId(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: 11, color: '#fff', padding: 13 }}><option value="">Оберіть етап</option>{restorationStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select><button onClick={assignLegacyItem} disabled={saving || !legacyStageId || !Number.isInteger(Number(legacyQuantity)) || Number(legacyQuantity) <= 0 || Number(legacyQuantity) > Number(legacyDraft.total_qty)} style={{ width: '100%', marginTop: 21, background: '#f59e0b', color: '#170d00', border: 0, borderRadius: 12, padding: 14, fontWeight: 1000, cursor: 'pointer' }}>{saving ? 'СТВОРЕННЯ...' : 'СТВОРИТИ КАРТУ'}</button></div></div>}
  </div>
}
