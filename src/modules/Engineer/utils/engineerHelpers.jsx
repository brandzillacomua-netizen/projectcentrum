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

export const TYPE_COLORS = {
  product: '#d97706',   // amber (Виріб)
  part: '#2563eb',      // blue (Деталь)
  raw: '#059669',       // green (Сировина)
  hardware: '#dc2626',   // red (Метиз)
  consumable: '#dc2626', // red (Метиз)
  cutter: '#10b981',    // emerald (Фреза)
  assembly: '#7c3aed'   // indigo (Вузол)
}

export const TYPE_LABELS = {
  product: 'Виріб',
  part: 'Деталь',
  raw: 'Сировина',
  hardware: 'Метиз',
  consumable: 'Метиз',
  cutter: 'Фреза',
  assembly: 'Вузол'
}

export const classifyV2Type = (v) => {
  if (!v) return 'part'
  
  const gid = String(v.group_id || '').toLowerCase()
  const rule = String(v.rule_type || '').toLowerCase()
  const name = String(v.name || '').toLowerCase()

  // 1. Raw Materials (Сировина: карбонові пластини, труби, листи, смоли, гума, фарба)
  // Перевіряємо першими, щоб сировина ніколи не класифікувалась як метиз або деталь
  if (
    gid === 'grp_carbon_t300' ||
    gid === 'grp_carbon_t700' ||
    gid === 'grp_carbon_t800' ||
    gid === 'grp_carbon_sheets' ||
    gid === 'grp_prepared_sheets' ||
    gid === 'grp_rubber' ||
    gid === 'grp_paint' ||
    gid.startsWith('cat_raw') ||
    gid.startsWith('raw') ||
    rule === 'carbon' ||
    rule === 'rubber' ||
    rule === 'paint' ||
    name.includes('карбонов') ||
    name.includes('пластина т') ||
    name.includes('лист') ||
    name.includes('труба') ||
    name.includes('пруток') ||
    name.includes('склотекстоліт') ||
    name.includes('гума') ||
    name.includes('фарба')
  ) {
    return 'raw'
  }

  // 2. Mills / Cutters (Фрези)
  if (gid === 'grp_mills' || rule === 'mill' || name.includes('фреза')) {
    return 'cutter'
  }

  // 3. Products / Finished frames (Готові вироби)
  if (
    gid === 'grp_production_frames' ||
    gid === 'grp_test_samples' ||
    gid === 'cat_fg' ||
    rule === 'full_frame' ||
    name.includes('рама') ||
    name.includes('frame')
  ) {
    return 'product'
  }

  // 4. Assemblies (Вузли)
  if (gid === 'grp_assemblies' || v.type === 'assembly' || name.includes('вузол') || name.includes('комплект')) {
    return 'assembly'
  }

  // 5. Hardware / Fasteners (Метизи)
  if (
    gid === 'grp_nuts' ||
    gid === 'grp_press_nuts' ||
    gid === 'grp_screws_black' ||
    gid === 'grp_screws_silver' ||
    gid === 'grp_standoffs' ||
    gid === 'grp_hardware_main' ||
    gid.startsWith('cat_hw') ||
    gid.startsWith('hw') ||
    rule === 'screw' ||
    rule === 'screw_black' ||
    rule === 'screw_silver' ||
    rule === 'nut' ||
    rule === 'press_nut' ||
    rule === 'standoff' ||
    name.includes('гвинт') ||
    name.includes('гайка') ||
    name.includes('шайба') ||
    name.includes('шпилька') ||
    name.includes('заклепка') ||
    name.includes('стійка') ||
    name.includes('болт')
  ) {
    return 'hardware'
  }

  // 6. Frame parts (Деталі)
  if (
    rule === 'frame_part' ||
    gid === 'cat_parts' ||
    name.includes('деталь') ||
    name.includes('луч') ||
    name.includes('арм') ||
    name.includes('проставка') ||
    name.includes('рейка')
  ) {
    return 'part'
  }

  return v.type || 'part'
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
          type: classifyV2Type(v),
          unit: v.unit || 'шт',
          category: v.category || (String(v.group_id || '').startsWith('grp_carbon') || String(v.group_id || '').startsWith('cat_raw') ? 'Сировина' : 'Загальна')
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

  // 1. Raw materials first (carbon sheets/plates must not be caught by "пластина")
  if (
    type === 'raw' ||
    name.includes('карбон') ||
    name.includes('лист') ||
    name.includes('труба') ||
    name.includes('пруток') ||
    name.includes('склотекстоліт') ||
    name.includes('гума')
  ) {
    return 'Сировина (Листи, Труби)'
  }

  // 2. Hardware / Fasteners
  if (
    type === 'hardware' ||
    name.includes('гвинт') ||
    name.includes('гайка') ||
    name.includes('шайба') ||
    name.includes('шпилька') ||
    name.includes('заклепка') ||
    name.includes('стійка') ||
    name.includes('болт')
  ) {
    return 'Метизи'
  }

  // 3. Cutters / Tools
  if (type === 'cutter' || name.includes('фреза')) {
    return 'Інструмент (Фрези)'
  }

  // 4. Parts
  if (
    type === 'part' ||
    name.includes('деталь') ||
    name.includes('пластина') ||
    name.includes('проставка') ||
    name.includes('профіль') ||
    name.includes('рейка') ||
    name.includes('луч') ||
    name.includes('арм')
  ) {
    return 'Деталі'
  }

  // 5. Assemblies
  if (type === 'assembly' || name.includes('вузол') || name.includes('комплект')) {
    return 'Комплектуючі'
  }

  if (type === 'consumable') {
    return 'Метизи'
  }

  return 'Метизи'
}
