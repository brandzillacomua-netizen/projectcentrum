import { useState } from 'react'
import { ArrowLeft, Check, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useScrapReasons } from '../hooks/useScrapReasons'
import { useRestorationStages } from '../hooks/useRestorationStages'
import { supabase } from '../supabase'

function CatalogEditor({ table, rows, reload, accent, singular, addPlaceholder }) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const maxSort = rows.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0)
    const { error } = await supabase.from(table).insert({ name, sort_order: maxSort + 10 })
    setSaving(false)
    if (error) return alert(`Не вдалося додати ${singular}: ${error.message}`)
    setNewName('')
    await reload()
  }

  const save = async row => {
    const name = editingName.trim()
    if (!name) return
    setSaving(true)
    const { error } = await supabase.from(table).update({ name, updated_at: new Date().toISOString() }).eq('id', row.id)
    setSaving(false)
    if (error) return alert(`Не вдалося перейменувати ${singular}: ${error.message}`)
    setEditingId(null)
    await reload()
  }

  const toggle = async row => {
    const { error } = await supabase.from(table).update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) return alert(`Не вдалося змінити ${singular}: ${error.message}`)
    await reload()
  }

  const remove = async row => {
    if (!window.confirm(`Видалити «${row.name}»?`)) return
    const { data, error } = await supabase.from(table).delete().eq('id', row.id).select('id')
    if (error || !data?.length) {
      const { error: archiveError } = await supabase.from(table).update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id)
      if (archiveError) return alert(`Не вдалося видалити ${singular}: ${archiveError.message}`)
      alert('Запис уже використовується в історії, тому його вимкнено.')
    }
    await reload()
  }

  return <div>
    <div style={{ background: '#080808', border: '1px solid #222', borderRadius: 16, padding: 16, marginBottom: 18 }}>
      <div style={{ color: '#888', fontSize: '.68rem', fontWeight: 950, marginBottom: 10 }}>ДОДАТИ НОВИЙ ЗАПИС</div>
      <div style={{ display: 'flex', gap: 10 }}><input value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => event.key === 'Enter' && add()} placeholder={addPlaceholder} style={{ flex: 1, minWidth: 0, background: '#000', border: '1px solid #333', borderRadius: 11, color: '#fff', padding: '13px 15px' }}/><button onClick={add} disabled={saving || !newName.trim()} style={{ background: accent, border: 0, borderRadius: 11, padding: '0 20px', fontWeight: 1000, cursor: 'pointer' }}><Plus size={17}/></button></div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{rows.map(row => <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#111', border: '1px solid #222', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: row.is_active ? '#10b981' : '#444', flexShrink: 0 }}/>
      {editingId === row.id ? <input autoFocus value={editingName} onChange={event => setEditingName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save(row); if (event.key === 'Escape') setEditingId(null) }} style={{ flex: 1, minWidth: 0, background: '#050505', border: `1px solid ${accent}`, borderRadius: 9, color: '#fff', padding: 9 }}/> : <div style={{ flex: 1, minWidth: 0, color: row.is_active ? '#fff' : '#666', fontWeight: 850, overflowWrap: 'anywhere' }}>{row.name}</div>}
      {editingId === row.id ? <><button onClick={() => save(row)} style={iconButton('#10b981')}><Check size={16}/></button><button onClick={() => setEditingId(null)} style={iconButton('#777')}><X size={16}/></button></> : <><button onClick={() => { setEditingId(row.id); setEditingName(row.name) }} style={iconButton(accent)} title="Редагувати"><Pencil size={15}/></button><button onClick={() => toggle(row)} style={{ background: row.is_active ? '#10b98118' : '#222', color: row.is_active ? '#10b981' : '#888', border: '1px solid #333', borderRadius: 9, padding: '8px 11px', fontWeight: 900, cursor: 'pointer' }}>{row.is_active ? 'АКТИВНИЙ' : 'ВИМКНЕНО'}</button><button onClick={() => remove(row)} style={iconButton('#ef4444')} title="Видалити"><Trash2 size={15}/></button></>}
    </div>)}</div>
  </div>
}

const iconButton = color => ({ background: `${color}18`, color, border: `1px solid ${color}44`, borderRadius: 9, padding: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' })

export default function VKYASettings() {
  const [tab, setTab] = useState('reasons')
  const reasons = useScrapReasons({ includeInactive: true })
  const stages = useRestorationStages({ includeInactive: true })
  return <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '28px clamp(16px, 3vw, 42px)' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}><Link to="/brak" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', fontWeight: 850 }}><ArrowLeft size={18}/> ВКЯ</Link><div style={{ width: 1, height: 32, background: '#222' }}/><Settings color="#f59e0b"/><div><div style={{ fontSize: '1.45rem', fontWeight: 1000 }}>Налаштування ВКЯ</div><div style={{ color: '#666', fontSize: '.75rem', marginTop: 3 }}>Керування робочими довідниками</div></div></header>
    <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}><button onClick={() => setTab('reasons')} style={tabButton(tab === 'reasons', '#f59e0b')}>ПРИЧИНИ БРАКУ ({reasons.rows.filter(row => row.is_active).length})</button><button onClick={() => setTab('stages')} style={tabButton(tab === 'stages', '#06b6d4')}>ЕТАПИ ВІДНОВЛЕННЯ ({stages.rows.filter(row => row.is_active).length})</button></div>
    <section style={{ maxWidth: 920, background: '#0d0d0d', border: `1px solid ${tab === 'reasons' ? '#f59e0b33' : '#06b6d433'}`, borderRadius: 22, padding: 'clamp(16px, 3vw, 26px)' }}><h2 style={{ margin: '0 0 6px' }}>{tab === 'reasons' ? 'Довідник причин браку' : 'Етапи терміналу відновлення'}</h2><p style={{ color: '#666', fontSize: '.78rem', margin: '0 0 22px' }}>{tab === 'reasons' ? 'Значення для класифікації та виробничих терміналів.' : 'Тільки активні етапи доступні під час створення нової карти.'}</p>{tab === 'reasons' ? <CatalogEditor table="scrap_reasons" rows={reasons.rows} reload={reasons.reload} accent="#f59e0b" singular="причину" addPlaceholder="Наприклад: Невірний розмір деталі"/> : <CatalogEditor table="vkya_restoration_stages" rows={stages.rows} reload={stages.reload} accent="#06b6d4" singular="етап" addPlaceholder="Назва нового етапу відновлення"/>}</section>
  </div>
}

const tabButton = (active, color) => ({ background: active ? color : '#111', color: active ? '#050505' : '#aaa', border: '1px solid #2a2a2a', borderRadius: 11, padding: '11px 18px', fontWeight: 1000, cursor: 'pointer' })
