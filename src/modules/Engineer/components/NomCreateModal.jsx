import React, { useState, useMemo, useEffect } from 'react'
import { Sparkles, AlertCircle, X, Clock } from 'lucide-react'
import { 
  DEFAULT_ERP_GROUPS, 
  ERP_CATEGORY_SCHEMAS, 
  generateStandardName, 
  buildFlattenedGroupOptions 
} from '../../NomenclatureV2'

export const NomCreateModal = ({ onClose, onCreated, supabase, refreshTable, prefilledName = '' }) => {
  const [groups, setGroups] = useState(DEFAULT_ERP_GROUPS)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [wizardGroup, setWizardGroup] = useState(null)
  const [wizardRuleType, setWizardRuleType] = useState('generic')
  const DEFAULT_LOAD_TIMINGS = { '2': '', '4': '', '8': '', '16': '', '32': '', '64': '' }

  const [wizardParams, setWizardParams] = useState({
    standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
    type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
    cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
    specialType: '', din: 'DIN 934', thickness: '1',
    grade: 'Т300', dimensions: '500*600', extra: '',
    projType: 'SERIAL', projNum: '', name: prefilledName || '',
    customName: prefilledName || '', unit: 'шт',
    sheetGrade: 'Т300', sheetThickness: '3', unitsPerSheet: 24,
    loadTimings: { ...DEFAULT_LOAD_TIMINGS }
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadCatalogData = async () => {
      try {
        const { data: gData } = await supabase.from('nomenclature_catalog_groups').select('*').order('sort_order', { ascending: true })
        if (gData && gData.length > 0 && isMounted) {
          const groupMap = new Map(DEFAULT_ERP_GROUPS.map(g => [g.id, g]))
          gData.forEach(g => {
            if (groupMap.has(g.id)) {
              const existing = groupMap.get(g.id)
              groupMap.set(g.id, { ...existing, ...g, rule_type: g.rule_type || existing.rule_type })
            }
          })
          setGroups(Array.from(groupMap.values()))
        } else if (isMounted) {
          setGroups(DEFAULT_ERP_GROUPS)
        }

        const { data: nData } = await supabase.from('nomenclatures_v2').select('*')
        if (nData && isMounted) {
          setItems(nData)
        }
      } catch (err) {
        console.warn('V2 wizard data load warning:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadCatalogData()
    return () => { isMounted = false }
  }, [supabase])

  const flattenedGroups = useMemo(() => {
    return buildFlattenedGroupOptions(groups)
  }, [groups])

  useEffect(() => {
    if (groups.length > 0 && !wizardGroup) {
      const defaultG = groups.find(g => g.id === 'grp_carbon_t300') || groups.find(g => g.id === 'grp_carbon_sheets') || groups[0]
      setWizardGroup(defaultG)
      setWizardRuleType(defaultG?.rule_type || 'carbon')
    }
  }, [groups, wizardGroup])

  const generatedName = useMemo(() => {
    return generateStandardName(wizardRuleType, wizardParams)
  }, [wizardRuleType, wizardParams])

  const isDuplicate = useMemo(() => {
    if (!generatedName) return false
    const norm = generatedName.toLowerCase().replace(/\s+/g, '')
    return items.some(it => (it.name || '').toLowerCase().replace(/\s+/g, '') === norm)
  }, [generatedName, items])

  const inputStyle = { 
    width: '100%', 
    background: 'var(--input-bg, #ffffff)', 
    border: '1px solid var(--border-color, #cbd5e1)', 
    borderRadius: '12px', 
    padding: '10px 14px', 
    color: 'var(--text-main, #0f172a)', 
    fontWeight: 700, 
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none'
  }

  const labelStyle = { 
    fontSize: '0.72rem', 
    fontWeight: 900, 
    color: 'var(--text-muted, #64748b)', 
    textTransform: 'uppercase', 
    marginBottom: '6px', 
    display: 'block' 
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!generatedName) {
      return alert('Будь ласка, заповніть параметри для формування назви!')
    }
    if (isDuplicate) {
      return alert('Позиція з такою назвою вже існує у V2 каталозі!')
    }

    setSaving(true)
    try {
      const nextCode = items.reduce((max, it) => {
        const num = parseInt(String(it.code || '').replace(/\D/g, ''))
        return num > max ? num : max
      }, 90000) + 1

      const v2Payload = {
        code: `V2-${nextCode}`,
        name: generatedName,
        group_id: wizardGroup?.id || null,
        category: wizardGroup?.name || 'V2 Номенклатура',
        type: wizardGroup?.id?.includes('frame') || wizardGroup?.id === 'cat_fg' ? 'product' : (wizardGroup?.id === 'cat_parts' ? 'part' : 'consumable'),
        unit: wizardParams.unit || 'шт',
        rule_type: wizardRuleType,
        rule_params: wizardParams,
        status: 'active'
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('nomenclatures_v2')
        .insert([v2Payload])
        .select()
        .single()

      if (insertErr) throw insertErr

      await refreshTable('nomenclatures')
      if (onCreated) onCreated(inserted)
      onClose()
      alert(`✅ Позицію «${generatedName}» успішно збережено до V2 каталогу!`)
    } catch (err) {
      alert('Помилка збереження до V2 каталогу: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const refDicts = {
    millTypes: ['кукурудза', 'двопера', 'чотирьохпера', 'фасочна', 'сферична по алюмінію'],
    millShankDias: ['3,175', '4', '6', '8', '10', '12'],
    millCutDias: ['1', '1,2', '1,5', '2', '2,5', '3', '3,175', '4', '6', '8'],
    millCutLengths: ['4', '6', '8', '12', '15', '17', '22', '25', '32'],
    millTotalLengths: ['38', '45', '50', '55', '60', '75', '100'],
    grades: ['Т300', 'Т700'],
    thicknesses: ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    extras: ['(преференція)', '(0/45/90)']
  }

  const prefixList = ['Комплект карбонової рами', 'Комплект карбонових елементів', 'Набір деталей рами']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="#ff9000" />
            <h3 style={{ margin: 0, fontWeight: 950, fontSize: '1.2rem', color: 'var(--text-main, #0f172a)' }}>
              Конструктор Номенклатури ERP
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={labelStyle}>КАТЕГОРІЯ НОМЕНКЛАТУРИ</label>
            <select 
              value={wizardGroup?.id || ''} 
              onChange={e => {
                const g = groups.find(it => it.id === e.target.value)
                const rType = g?.rule_type || 'generic'
                setWizardGroup(g)
                setWizardRuleType(rType)
                setWizardParams(prev => ({
                  ...prev,
                  isBlack: rType === 'screw_black' ? true : rType === 'screw_silver' ? false : prev.isBlack
                }))
              }}
              style={{ ...inputStyle, fontWeight: 800, fontSize: '0.9rem', padding: '12px' }}
            >
              {flattenedGroups.map(g => (
                <option 
                  key={g.id} 
                  value={g.id}
                  style={{
                    fontWeight: g.depth === 0 ? 900 : g.hasSubs ? 800 : 400
                  }}
                >
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ background: 'rgba(255,144,0,0.08)', border: '1px solid rgba(255,144,0,0.35)', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', textTransform: 'uppercase', marginBottom: '6px' }}>АВТОМАТИЧНО СГЕНЕРОВАНА НАЗВА:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 950, color: 'var(--text-main, #0f172a)', wordBreak: 'break-word' }}>
              {generatedName || <span style={{ color: '#777', fontStyle: 'italic', fontWeight: 600 }}>{wizardRuleType === 'frame_part' ? 'Введіть назву деталі у поле нижче...' : 'Заповніть параметри нижче...'}</span>}
            </div>

            {isDuplicate && (
              <div style={{ marginTop: '10px', color: '#dc2626', fontSize: '0.78rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} /> Увага: Позиція з такою назвою вже існує у V2 каталозі!
              </div>
            )}
          </div>

          {ERP_CATEGORY_SCHEMAS[wizardRuleType] && (
            <div style={{ background: 'var(--button-bg, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '14px', padding: '12px 16px', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                📋 Обов'язкові довідникові параметри для {ERP_CATEGORY_SCHEMAS[wizardRuleType].title}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ERP_CATEGORY_SCHEMAS[wizardRuleType].fields.map(f => (
                  <span key={f.key} style={{ background: 'rgba(217,119,6,0.12)', color: '#b45309', border: '1px solid rgba(217,119,6,0.3)', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.7rem' }}>
                    ✓ {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {(wizardRuleType === 'screw' || wizardRuleType === 'screw_black' || wizardRuleType === 'screw_silver') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>СТАНДАРТ (DIN / ISO)</label>
                    <select value={wizardParams.standard} onChange={e => setWizardParams({...wizardParams, standard: e.target.value})} style={inputStyle}>
                      <option value="DIN912">DIN 912 (Циліндрична)</option>
                      <option value="DIN7991">DIN 7991 (Потай)</option>
                      <option value="ISO7380">ISO 7380 (Напівкругла)</option>
                      <option value="DIN7985">DIN 7985 (Сочевиця)</option>
                      <option value="DIN913">DIN 913 (Установчий)</option>
                      <option value="ISO10642">ISO 10642</option>
                      <option value="custom">✏️ + Власний стандарт...</option>
                    </select>
                    {wizardParams.standard === 'custom' && (
                      <input type="text" value={wizardParams.customStandard || ''} onChange={e => setWizardParams({...wizardParams, customStandard: e.target.value})} placeholder="напр. DIN 84" style={{ ...inputStyle, marginTop: '8px' }} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="1,6">М1.6</option>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                      <option value="6">М6</option>
                      <option value="8">М8</option>
                      <option value="10">М10</option>
                      <option value="custom">✏️ + Власна різьба...</option>
                    </select>
                    {wizardParams.diameter === 'custom' && (
                      <input type="text" value={wizardParams.customDiameter || ''} onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} placeholder="напр. 3,5" style={{ ...inputStyle, marginTop: '8px' }} />
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>ДОВЖИНА ГВИНТА (мм)</label>
                  <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 10, 16, 25" style={inputStyle} />
                </div>

                <div style={{ display: 'flex', gap: '20px', paddingTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                    Чорний колір (чорний)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={wizardParams.isPartialThread} onChange={e => setWizardParams({...wizardParams, isPartialThread: e.target.checked})} />
                    Неповна різьба
                  </label>
                </div>
              </>
            )}

            {wizardRuleType === 'nut' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>СТАНДАРТ (DIN)</label>
                    <select value={wizardParams.din || 'DIN 934'} onChange={e => setWizardParams({...wizardParams, din: e.target.value})} style={inputStyle}>
                      <option value="DIN 934">DIN 934 (Шестигранна)</option>
                      <option value="DIN 6923">DIN 6923 (З фланцем)</option>
                      <option value="DIN 985">DIN 985 (З нейлоном)</option>
                      <option value="custom">✏️ + Власний DIN...</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                      <option value="6">М6</option>
                      <option value="custom">✏️ + Власна різьба...</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {wizardRuleType === 'press_nut' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ТОВЩИНА ЗАПРЕСОВКИ</label>
                    <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                      <option value="0">0 (0.8 мм)</option>
                      <option value="1">1 (1.0 мм)</option>
                      <option value="2">2 (1.4 мм)</option>
                      <option value="3">3 (2.3 мм)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {wizardRuleType === 'standoff' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>ТИП СТІЙКИ</label>
                    <select value={wizardParams.type} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                      <option value="TFF">TFF (Мама-Мама)</option>
                      <option value="TFM">TFM (Тато-Мама)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.thread} onChange={e => setWizardParams({...wizardParams, thread: e.target.value})} style={inputStyle}>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>ДОВЖИНА СТІЙКИ (мм)</label>
                    <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 20" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>МАТЕРІАЛ</label>
                    <select value={wizardParams.material} onChange={e => setWizardParams({...wizardParams, material: e.target.value})} style={inputStyle}>
                      <option value="Алюміній">Алюміній</option>
                      <option value="Латунь">Латунь</option>
                      <option value="Цинк S5">Цинк S5</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {wizardRuleType === 'mill' && (
              <>
                <div>
                  <label style={labelStyle}>ТИП ФРЕЗИ</label>
                  <select value={wizardParams.type || 'кукурудза'} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                    {refDicts.millTypes.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>d (різ, мм)</label>
                    <select value={wizardParams.cutDia || '1,5'} onChange={e => setWizardParams({...wizardParams, cutDia: e.target.value})} style={inputStyle}>
                      {refDicts.millCutDias.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>D (цанга)</label>
                    <select value={wizardParams.shankDia || '3,175'} onChange={e => setWizardParams({...wizardParams, shankDia: e.target.value})} style={inputStyle}>
                      {refDicts.millShankDias.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>l (різ, мм)</label>
                    <select value={wizardParams.cutLength || '8'} onChange={e => setWizardParams({...wizardParams, cutLength: e.target.value})} style={inputStyle}>
                      {refDicts.millCutLengths.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>L (заг, мм)</label>
                    <select value={wizardParams.totalLength || '38'} onChange={e => setWizardParams({...wizardParams, totalLength: e.target.value})} style={inputStyle}>
                      {refDicts.millTotalLengths.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {wizardRuleType === 'carbon' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>МАРКА СИРОВИНИ</label>
                    <select value={wizardParams.grade || 'Т300'} onChange={e => setWizardParams({...wizardParams, grade: e.target.value})} style={inputStyle}>
                      {refDicts.grades.map(g => <option key={g} value={g}>Карбон {g}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>ФОРМАТ (мм)</label>
                    <select value={wizardParams.dimensions || '500*600'} onChange={e => setWizardParams({...wizardParams, dimensions: e.target.value})} style={inputStyle}>
                      <option value="500*600">500*600</option>
                      <option value="1000*600">1000*600</option>
                      <option value="500*500">500*500</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>ТОВЩИНА (мм)</label>
                    <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                      {refDicts.thicknesses.map(t => <option key={t} value={t}>{t} мм</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>СПЕЦ. ПОЗНАЧКА</label>
                    <select value={wizardParams.extra || ''} onChange={e => setWizardParams({...wizardParams, extra: e.target.value})} style={inputStyle}>
                      <option value="">— Немає</option>
                      {refDicts.extras.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {(wizardRuleType === 'full_frame' || wizardRuleType === 'element_kit') && (
              <>
                <div>
                  <label style={labelStyle}>ПОЧАТОК НАЗВИ / ТИП ВИРОБУ</label>
                  <select value={wizardParams.prefixChoice || 'Комплект карбонової рами'} onChange={e => setWizardParams({...wizardParams, prefixChoice: e.target.value})} style={inputStyle}>
                    {prefixList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>ТИП ПРОЄКТУ</label>
                    <select value={wizardParams.projType || 'SERIAL'} onChange={e => setWizardParams({...wizardParams, projType: e.target.value})} style={inputStyle}>
                      <option value="SERIAL">Серійний виріб</option>
                      <option value="RND">Серія RND</option>
                      <option value="IP">Індивідуальний проєкт (ІП)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>НОМЕР ПРОЄКТУ</label>
                    <input type="text" value={wizardParams.projNum || ''} onChange={e => setWizardParams({...wizardParams, projNum: e.target.value})} placeholder="напр. 52 або 176" style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>НАЗВА МОДЕЛІ / МОДИФІКАЦІЯ</label>
                  <input type="text" value={wizardParams.name || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value})} placeholder="напр. Drozd Interceptor" style={inputStyle} />
                </div>
              </>
            )}

            {wizardRuleType === 'frame_part' && (
              <>
                <div>
                  <label style={labelStyle}>НАЗВА ДЕТАЛІ</label>
                  <input type="text" value={wizardParams.name || wizardParams.customName || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value, customName: e.target.value})} placeholder="напр. KR-10(218)-П-7-60" style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>МАРКА СИРОВИНИ</label>
                    <select value={wizardParams.sheetGrade || 'Т300'} onChange={e => setWizardParams({...wizardParams, sheetGrade: e.target.value})} style={inputStyle}>
                      {refDicts.grades.map(g => <option key={g} value={g}>Карбон {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ТОВЩИНА (мм)</label>
                    <select value={wizardParams.sheetThickness || '3'} onChange={e => setWizardParams({...wizardParams, sheetThickness: e.target.value})} style={inputStyle}>
                      {refDicts.thicknesses.map(t => <option key={t} value={t}>{t} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>НОРМА (шт/л)</label>
                    <input type="number" value={wizardParams.unitsPerSheet || 24} onChange={e => setWizardParams({...wizardParams, unitsPerSheet: Number(e.target.value) || 1})} placeholder="24" style={inputStyle} />
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.25)', borderRadius: '16px', padding: '16px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#d97706" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 950, color: 'var(--text-main, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ТАЙМІНГИ ОБРОБКИ ДЛЯ ВАРІАНТІВ ЗАГРУЗКИ (ХВИЛИНИ)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>Час виконання на партію</span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginBottom: '12px', lineHeight: '1.3' }}>
                    Вкажіть час обробки деталі (в хвилинах) для кожної кількості листів при завантаженні у верстат:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {['2', '4', '8', '16', '32', '64'].map(sheets => {
                      const val = wizardParams.loadTimings?.[sheets] ?? ''
                      return (
                        <div key={sheets} style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{sheets} {sheets === '2' || sheets === '4' || sheets === '32' || sheets === '64' ? 'листи' : 'листів'}:</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>хв</span>
                          </div>
                          <input 
                            type="number"
                            step="0.1"
                            min="0"
                            value={val}
                            onChange={e => {
                              const updatedVal = e.target.value
                              setWizardParams(prev => ({
                                ...prev,
                                loadTimings: {
                                  ...(prev.loadTimings || DEFAULT_LOAD_TIMINGS),
                                  [sheets]: updatedVal
                                }
                              }))
                            }}
                            placeholder="напр. 15"
                            style={{ 
                              ...inputStyle,
                              padding: '8px 10px',
                              fontSize: '0.88rem'
                            }} 
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {wizardRuleType === 'generic' && (
              <div>
                <label style={labelStyle}>ПОВНА НАЗВА ПОЗИЦІЇ</label>
                <input type="text" value={wizardParams.customName || ''} onChange={e => setWizardParams({...wizardParams, customName: e.target.value})} placeholder="Введіть стандартизовану назву..." style={inputStyle} />
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '15px' }}>
              <label style={labelStyle}>ОДИНИЦЯ ВИМІРУ</label>
              <select value={wizardParams.unit || 'шт'} onChange={e => setWizardParams({...wizardParams, unit: e.target.value})} style={inputStyle}>
                <option value="шт">Штуки (шт)</option>
                <option value="компл.">Комплекти (компл.)</option>
                <option value="лист">Листи (лист)</option>
                <option value="кг">Кілограми (кг)</option>
                <option value="м">Метри (м)</option>
                <option value="м²">Квадратні метри (м²)</option>
                <option value="л">Літри (л)</option>
              </select>
            </div>

          </div>

          <button 
            type="submit" 
            disabled={isDuplicate || !generatedName || saving}
            style={{ 
              background: isDuplicate || !generatedName ? 'var(--button-bg, #cbd5e1)' : 'linear-gradient(135deg, #10b981, #059669)', 
              color: isDuplicate || !generatedName ? '#777' : '#ffffff', 
              border: 'none', 
              borderRadius: '14px', 
              padding: '16px', 
              fontWeight: 950, 
              fontSize: '0.95rem', 
              cursor: isDuplicate || !generatedName || saving ? 'not-allowed' : 'pointer',
              boxShadow: isDuplicate || !generatedName ? 'none' : '0 5px 20px rgba(16,185,129,0.3)',
              transition: 'all 0.2s'
            }}
          >
            {saving ? 'ЗБЕРЕЖЕННЯ ДО V2 КАТАЛОГУ...' : 'ЗБЕРЕГТИ ДО V2 КАТАЛОГУ'}
          </button>
        </form>
      </div>
    </div>
  )
}
