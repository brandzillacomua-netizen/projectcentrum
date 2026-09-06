import React, { useState, useEffect, useMemo } from 'react'
import { Sparkles, X, Layers, Lock, AlertCircle, Trash2 } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'

export const CreateProductModal = ({ isOpen, onClose, onCreated, initialQuery = '', nomenclatures = [] }) => {
  const { refreshTable, currentUser } = useMES()

  const INITIAL_PREFIXES = ['Комплект карбонової рами', 'Комплект карбонових елементів', 'Складова рами']
  const INITIAL_SERIES = ['F', 'KHARAK', 'Drozd', 'BITA']

  const [prefixList, setPrefixList] = useState(() => {
    try {
      const raw = localStorage.getItem('centrum_nom_prefixes')
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
    } catch (e) {}
    return INITIAL_PREFIXES
  })

  const [seriesList, setSeriesList] = useState(() => {
    try {
      const raw = localStorage.getItem('centrum_nom_series')
      if (raw) { const s = JSON.parse(raw); if (Array.isArray(s) && s.length > 0) return s; }
    } catch (e) {}
    return INITIAL_SERIES
  })

  const [showPrefixManage, setShowPrefixManage] = useState(false)
  const [showSeriesManage, setShowSeriesManage] = useState(false)

  const isDirector = !!(currentUser?.rights?.director || currentUser?.access_rights?.director || ['адмін', 'директор', 'керівник'].some(w => (currentUser?.position || '').toLowerCase().includes(w)))

  const removePrefixItem = (itemToRemove) => {
    const updated = prefixList.filter(i => i !== itemToRemove)
    setPrefixList(updated)
    try { localStorage.setItem('centrum_nom_prefixes', JSON.stringify(updated)) } catch (e) {}
  }

  const removeSeriesItem = (itemToRemove) => {
    const updated = seriesList.filter(i => i !== itemToRemove)
    setSeriesList(updated)
    try { localStorage.setItem('centrum_nom_series', JSON.stringify(updated)) } catch (e) {}
  }

  const [prefixChoice, setPrefixChoice] = useState('Комплект карбонової рами')
  const [customPrefix, setCustomPrefix] = useState('')
  const [projType, setProjType] = useState('SERIAL')
  const [customProjType, setCustomProjType] = useState('')
  const [projNum, setProjNum] = useState('')
  const [seriesType, setSeriesType] = useState('')
  const [customSeries, setCustomSeries] = useState('')
  const [modelName, setModelName] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [unit, setUnit] = useState('шт')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      setIsSubmitting(false)
      const numMatch = initialQuery.match(/\d+/)
      if (numMatch) {
        setProjNum(numMatch[0])
        const cleanName = initialQuery.replace(/\d+/, '').trim()
        setModelName(cleanName)
      } else {
        setProjNum('')
        setModelName(initialQuery.trim())
      }
      setPrefixChoice('Комплект карбонової рами')
      setCustomPrefix('')
      setProjType('SERIAL')
      setCustomProjType('')
      setSeriesType('')
      setCustomSeries('')
      setCustomCode('')
      setUnit('шт')
    }
  }, [isOpen, initialQuery])

  const generatedName = useMemo(() => {
    const prefix = (prefixChoice === 'custom' ? customPrefix : prefixChoice).trim()

    let tag = ''
    const pNum = projNum.trim()
    if (projType === 'RND' && pNum) {
      tag = `(RND ${pNum})`
    } else if (projType === 'IP' && pNum) {
      tag = `(ІП ${pNum})`
    } else if (projType === 'CUSTOM' && pNum) {
      const pCustomType = customProjType.trim()
      tag = pCustomType ? `(${pCustomType} ${pNum})` : `(${pNum})`
    }

    const sLabel = (seriesType === 'custom' ? customSeries : seriesType).trim()
    const mName = modelName.trim()

    const seriesAndModel = (sLabel && mName) ? `${sLabel}${mName}` : (sLabel || mName)

    let res = prefix || 'Комплект карбонової рами'
    if (tag) res += ` ${tag}`
    if (seriesAndModel) res += ` ${seriesAndModel}`

    return res.replace(/\s+/g, ' ').trim()
  }, [prefixChoice, customPrefix, projType, customProjType, projNum, seriesType, customSeries, modelName])

  const isDuplicate = useMemo(() => {
    if (!generatedName) return false
    const norm = generatedName.toLowerCase().replace(/\s+/g, '')
    return nomenclatures.some(n => (n.name || '').toLowerCase().replace(/\s+/g, '') === norm)
  }, [generatedName, nomenclatures])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!generatedName || generatedName === 'Комплект карбонової рами') {
      setErrorMsg('Будь ласка, вкажіть номер проєкту або назву моделі!')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const normName = generatedName.toLowerCase().replace(/\s+/g, '')
      const existingNom = nomenclatures.find(n => (n.name || '').toLowerCase().replace(/\s+/g, '') === normName)

      let newNom = existingNom

      if (!existingNom) {
        const { data: inserted, error: insertNomErr } = await supabase
          .from('nomenclatures')
          .insert([{
            name: generatedName,
            type: 'product',
            unit: unit || 'шт'
          }])
          .select()
          .single()

        if (insertNomErr) throw insertNomErr
        newNom = inserted
      }

      const nextCode = nomenclatures.reduce((max, n) => {
        const num = parseInt(String(n.code || '').replace(/\D/g, ''))
        return !isNaN(num) && num > max ? num : max
      }, 90000) + 1

      const codeStr = customCode.trim() || `V2-${nextCode}`

      const v2Payload = {
        code: codeStr,
        name: generatedName,
        group_id: 'grp_production_frames',
        unit: unit || 'шт',
        rule_type: 'full_frame',
        rule_params: { projType, projNum: projNum.trim(), name: modelName.trim() },
        status: 'active'
      }

      try {
        const { error: v2Err } = await supabase.from('nomenclatures_v2').insert([v2Payload])
        if (v2Err) console.warn('nomenclatures_v2 insert warning:', v2Err)
      } catch (v2Ex) {
        console.warn('nomenclatures_v2 insert error:', v2Ex)
      }

      if (typeof refreshTable === 'function') {
        refreshTable('nomenclatures')
      }

      onCreated(newNom ? newNom.id : null)
      onClose()
    } catch (err) {
      console.error('Failed to create product:', err)
      setErrorMsg('Помилка створення виробу: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.9)', fontFamily: '"Outfit", sans-serif' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="#ff9000" />
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>
              Створення готового виробу (Продакшн)
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: '#777', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              КАТЕГОРІЯ (ФІКСОВАНА) <Lock size={12} color="#ff9000" />
            </label>
            <div style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '12px', padding: '12px 16px', color: '#ff9000', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={16} />
              <span>04. Готова продукція → Продакшн (FG.PRODUCTION)</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: '#666', marginTop: '4px', display: 'block' }}>Менеджеру дозволено створювати лише готові вироби у папку Продакшн</span>
          </div>

          <div style={{ background: 'rgba(255,144,0,0.08)', border: '1px solid rgba(255,144,0,0.35)', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
              ✨ СГЕНЕРОВАНА СТАНДАРТИЗОВАНА НАЗВА:
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', wordBreak: 'break-word' }}>
              {generatedName}
            </div>

            {isDuplicate && (
              <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} /> Увага: Виріб з такою назвою вже існує в базі!
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', color: '#ef4444', fontSize: '0.82rem', fontWeight: 800 }}>
              {errorMsg}
            </div>
          )}

          <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>ПОЧАТОК НАЗВИ / ТИП ВИРОБУ</label>
                {isDirector && (
                  <button
                    type="button"
                    onClick={() => setShowPrefixManage(!showPrefixManage)}
                    style={{ background: 'none', border: 'none', color: '#ff9000', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                  >
                    ⚙️ {showPrefixManage ? 'Сховати' : 'Редагувати список'}
                  </button>
                )}
              </div>

              {showPrefixManage && isDirector && (
                <div style={{ background: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900, marginBottom: '6px' }}>ВИДАЛЕННЯ ЗІ СПИСКУ (АДМІН/КЕРІВНИК):</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {prefixList.map(item => (
                      <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#ddd' }}>
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => removePrefixItem(item)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}
                          title="Видалити зі списку"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <select 
                value={prefixChoice} 
                onChange={e => setPrefixChoice(e.target.value)} 
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#fff', fontWeight: 700, outline: 'none' }}
              >
                {prefixList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="custom">✏️ + Свій варіант...</option>
              </select>
              {prefixChoice === 'custom' && (
                <input 
                  type="text" 
                  value={customPrefix} 
                  onChange={e => setCustomPrefix(e.target.value)} 
                  placeholder="напр. Набір карбонових деталей" 
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #ff9000', borderRadius: '12px', padding: '10px 12px', color: '#fff', marginTop: '8px', outline: 'none' }} 
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>ТИП ПРОЄКТУ</label>
                <select 
                  value={projType} 
                  onChange={e => setProjType(e.target.value)} 
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#fff', fontWeight: 700, outline: 'none' }}
                >
                  <option value="SERIAL">Серійний виріб (без дужок / без тегу)</option>
                  <option value="RND">Серія RND</option>
                  <option value="IP">Індивідуальний проєкт (ІП)</option>
                  <option value="CUSTOM">✏️ + Свій тип проєкту...</option>
                </select>
                {projType === 'CUSTOM' && (
                  <input 
                    type="text" 
                    value={customProjType} 
                    onChange={e => setCustomProjType(e.target.value)} 
                    placeholder="напр. Спецпроєкт" 
                    style={{ width: '100%', background: '#1a1a1a', border: '1px solid #ff9000', borderRadius: '12px', padding: '10px 12px', color: '#fff', marginTop: '8px', outline: 'none' }} 
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>НОМЕР ПРОЄКТУ</label>
                <input 
                  type="text" 
                  value={projNum} 
                  onChange={e => setProjNum(e.target.value)} 
                  placeholder="напр. 52, 176..." 
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#fff', outline: 'none' }} 
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>ТИП СЕРІЇ</label>
                {isDirector && (
                  <button
                    type="button"
                    onClick={() => setShowSeriesManage(!showSeriesManage)}
                    style={{ background: 'none', border: 'none', color: '#ff9000', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                  >
                    ⚙️ {showSeriesManage ? 'Сховати' : 'Редагувати список'}
                  </button>
                )}
              </div>

              {showSeriesManage && isDirector && (
                <div style={{ background: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900, marginBottom: '6px' }}>ВИДАЛЕННЯ ЗІ СПИСКУ (АДМІН/КЕРІВНИК):</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {seriesList.map(item => (
                      <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#ddd' }}>
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => removeSeriesItem(item)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}
                          title="Видалити зі списку"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <select 
                value={seriesType} 
                onChange={e => setSeriesType(e.target.value)} 
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#fff', fontWeight: 700, outline: 'none' }}
              >
                <option value="">— Не вказано (без серії)</option>
                {seriesList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="custom">✏️ + Своя серія...</option>
              </select>
              {seriesType === 'custom' && (
                <input 
                  type="text" 
                  value={customSeries} 
                  onChange={e => setCustomSeries(e.target.value)} 
                  placeholder="напр. Серія Марун" 
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #ff9000', borderRadius: '12px', padding: '10px 12px', color: '#fff', marginTop: '8px', outline: 'none' }} 
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>НАЗВА МОДЕЛІ / РАМИ</label>
              <input 
                type="text" 
                value={modelName} 
                onChange={e => setModelName(e.target.value)} 
                placeholder="напр. Drozd, Interceptor..." 
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#fff', outline: 'none' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>КОД / АРТИКУЛ (ОПЦІОНАЛЬНО)</label>
                <input 
                  type="text" 
                  value={customCode} 
                  onChange={e => setCustomCode(e.target.value)} 
                  placeholder="Автоматично (V2-XXXXX)" 
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#fff', outline: 'none' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#888', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>ОДИНИЦЯ ВИМІРУ</label>
                <input 
                  type="text" 
                  value={unit} 
                  onChange={e => setUnit(e.target.value)} 
                  readOnly 
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '10px 12px', color: '#888', outline: 'none', cursor: 'not-allowed' }} 
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-load-more" 
              style={{ padding: '12px 24px' }}
            >
              СКАСУВАТИ
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="btn-primary-modern" 
              style={{ padding: '12px 24px', boxShadow: 'none', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Sparkles size={16} />
              {isSubmitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ТА ОБРАТИ ВИРІБ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
