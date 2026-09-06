import React, { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export const renderCutterListEditorShared = (cutters, setCutters, nomenclatures) => {
  const cutterNoms = Array.from(new Map((nomenclatures || [])
    .filter(n => {
      const name = String(n.name || '').toLowerCase()
      return n.type === 'cutter_type' || name.includes('фреза') || name.match(/^ф\s*[0-9]/) || name.match(/^f\s*[0-9]/)
    })
    .map(n => [String(n.id), n])
  ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'))
  return (
    <div style={{ flex: 1, minWidth: '280px', background: 'var(--card-header-bg, #f8fafc)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color, #cbd5e1)' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>⚙️ Витрата фрез на лист</span>
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cutters.map((c, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
            <select 
              value={c.nomId} 
              onChange={e => {
                const copy = [...cutters]
                copy[idx].nomId = e.target.value
                setCutters(copy)
              }}
              style={{ flex: 2, padding: '8px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '6px', fontSize: '0.8rem' }}
            >
              <option value="">-- Оберіть фрезу --</option>
              {cutterNoms.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <input 
              type="number"
              min="0.001"
              step="any"
              placeholder="к-сть"
              value={c.qty !== undefined && c.qty !== null ? c.qty : ''}
              onChange={e => {
                const copy = [...cutters]
                copy[idx].qty = e.target.value
                setCutters(copy)
              }}
              style={{ width: '70px', padding: '8px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: '#f59e0b', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800 }}
            />
            <button 
              onClick={() => setCutters(cutters.filter((_, i) => i !== idx))}
              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 10px', cursor: 'pointer' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button 
          onClick={() => setCutters([...cutters, { nomId: '', qty: 1 }])}
          style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border-color, #cbd5e1)', color: '#10b981', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}
        >
          + Додати фрезу до витрат
        </button>
      </div>
    </div>
  )
}

export const combineOps = (f2Arr, f15Arr) => {
  const maxLen = Math.max(f2Arr.length, f15Arr.length)
  const combined = []
  for (let i = 0; i < maxLen; i++) {
    const valF2 = (f2Arr[i] || "").trim()
    const valF15 = (f15Arr[i] || "").trim()
    if (valF15) {
      combined.push(`${valF2} | ${valF15}`)
    } else if (valF2) {
      combined.push(valF2)
    }
  }
  return combined.filter(Boolean)
}

export const useV2NomenclaturesData = (supabase) => {
  const [v2Noms, setV2Noms] = useState([])
  const fetchV2 = async () => {
    try {
      const { data } = await supabase.from('nomenclatures_v2').select('*').order('name')
      if (data) {
        const mapped = data.map(v => ({
          ...v,
          id: v.id,
          name: v.name,
          code: v.code || '',
          type: (v.group_id === 'grp_production_frames' || v.group_id === 'grp_test_samples' || v.group_id === 'cat_fg' || v.rule_type === 'full_frame' || (v.name || '').toLowerCase().includes('рама'))
            ? 'product'
            : (v.rule_type === 'frame_part' ? 'part' : 'consumable'),
          unit: v.unit || 'шт',
          category: v.category || 'Загальна'
        }))
        setV2Noms(mapped)
      }
    } catch (e) {
      console.error('Error loading V2 items:', e)
    }
  }
  useEffect(() => {
    fetchV2()
  }, [])
  return v2Noms
}

export const autoClassify = (nom) => {
  if (!nom) return 'Деталі'
  const type = nom.type
  const name = (nom.name || '').toLowerCase()

  if (type === 'part' || name.includes('деталь') || name.includes('пластина') || name.includes('проставка') || name.includes('профіль') || name.includes('рейка')) return 'Деталі'
  if (type === 'consumable') {
    if (name.includes('гвинт') || name.includes('гайка') || name.includes('шайба') || name.includes('шпилька') || name.includes('заклепка') || name.includes('стійка')) return 'Метизи'
    if (name.includes('фреза')) return 'Інструмент (Фрези)'
    if (name.includes('лист') || name.includes('карбон') || name.includes('труба') || name.includes('пруток') || name.includes('склотекстоліт')) return 'Сировина (Листи, Труби)'
    return 'Витратні матеріали'
  }
  if (type === 'assembly') return 'Комплектуючі'

  return 'Інше'
}
