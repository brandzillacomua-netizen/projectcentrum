import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  LayoutDashboard,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Info,
  Settings,
  X,
  Search,
  User,
  Package,
  Clock,
  Pencil,
  FileText,
  Sparkles,
  Lock,
  AlertCircle,
  FolderPlus,
  CheckCircle2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { nomenclatureService } from '../services/nomenclatureService'
import { supabase } from '../supabase'

const ProductSearchSelect = ({ products = [], value, onChange, onCreateNewProduct, placeholder = "Введіть назву або код виробу..." }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  const selectedProduct = products.find(p => String(p.id) === String(value))

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredProducts = products.filter(p => {
    if (!query.trim()) return true
    const q = query.toLowerCase().trim()
    const nameMatch = (p.name || '').toLowerCase().includes(q)
    const codeMatch = (p.code || '').toLowerCase().includes(q)
    const descMatch = (p.description || '').toLowerCase().includes(q)
    return nameMatch || codeMatch || descMatch
  })

  const handleSelect = (product) => {
    onChange(product.id)
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className="input-wrapper"
        style={{
          borderColor: isOpen ? '#ff9000' : (value ? 'rgba(255,144,0,0.3)' : 'var(--glass-border, rgba(255,255,255,0.1))'),
          background: value ? 'rgba(255,144,0,0.03)' : 'var(--card-bg, rgba(0,0,0,0.3))',
        }}
      >
        <Layers size={16} style={{ color: value ? '#ff9000' : '#888' }} />
        <input
          type="text"
          value={isOpen ? query : (selectedProduct ? `${selectedProduct.name}${selectedProduct.code ? ` (${selectedProduct.code})` : ''}` : query)}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
          }}
          placeholder={selectedProduct ? `${selectedProduct.name}${selectedProduct.code ? ` (${selectedProduct.code})` : ''}` : placeholder}
          style={{ paddingRight: '32px' }}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            title="Очистити вибір"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              right: '10px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#888'}
          >
            <X size={15} />
          </button>
        ) : (
          <Search size={15} style={{ position: 'absolute', right: '12px', color: isOpen ? '#ff9000' : '#888', pointerEvents: 'none' }} />
        )}
      </div>

      {isOpen && (
        <div
          className="hints-dropdown"
          style={{
            maxHeight: '280px',
            overflowY: 'auto',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,144,0,0.3)',
            background: 'var(--card-bg, #ffffff)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(p => {
                const isSelected = String(p.id) === String(value)
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className="hint-item"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isSelected ? 'rgba(255,144,0,0.12)' : undefined,
                      color: isSelected ? '#ff9000' : '#fff',
                      fontWeight: isSelected ? 800 : 400
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{p.name}</span>
                      {p.code && <span style={{ fontSize: '0.72rem', color: '#888' }}>Код / Арт: {p.code}</span>}
                    </div>
                    {isSelected && <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900 }}>✓</span>}
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '14px', fontSize: '0.82rem', color: '#666', textAlign: 'center' }}>
                Нічого не знайдено за запитом &quot;{query}&quot;
              </div>
            )}
          </div>

          {/* "+ Створити новий готовий виріб" Button */}
          {onCreateNewProduct && (
            <div
              onClick={() => {
                setIsOpen(false)
                onCreateNewProduct(query)
              }}
              style={{
                padding: '12px 16px',
                background: 'rgba(255,144,0,0.08)',
                borderTop: '1px solid rgba(255,144,0,0.2)',
                color: '#ff9000',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,144,0,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,144,0,0.08)'}
            >
              <Plus size={16} />
              <span>+ Створити новий готовий виріб</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const CreateProductModal = ({ isOpen, onClose, onCreated, initialQuery = '', nomenclatures = [] }) => {
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
      // Check if item with exact same name already exists in nomenclatures
      const normName = generatedName.toLowerCase().replace(/\s+/g, '')
      const existingNom = nomenclatures.find(n => (n.name || '').toLowerCase().replace(/\s+/g, '') === normName)

      let newNom = existingNom

      if (!existingNom) {
        // 1. Insert into nomenclatures table if not already present
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

      // 2. Insert into nomenclatures_v2 table
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

      // 3. Refresh context tables
      if (typeof refreshTable === 'function') {
        refreshTable('nomenclatures')
      }

      // 4. Callback with new item ID
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
        
        {/* Modal Header */}
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
          
          {/* Category Selector (READ ONLY / LOCKED TO PRODUCTION) */}
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

          {/* Live Preview Card */}
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

          {/* Form Fields */}
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

          {/* Action Buttons */}
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

const ManagerModule = () => {
  const { nomenclatures, addOrder, updateOrder, deleteOrder, superDeleteOrder, orders, fetchOrders, hasMoreOrders, searchCustomers, currentUser, loading, getOrderProductionProgress, refreshTable } = useMES()
  const [localCustomers, setLocalCustomers] = useState([])
  const searchTimeout = useRef(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Product Creation Modal State
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false)
  const [createProductQuery, setCreateProductQuery] = useState('')
  const [targetProductField, setTargetProductField] = useState('registration')

  // Batch Schedule Modal State
  const [isBatchScheduleOpen, setIsBatchScheduleOpen] = useState(false)
  const [batchScheduleList, setBatchScheduleList] = useState([])
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  
  // Filtering & Pagination State
  const [dateFilter, setDateFilter] = useState('month')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const handleBatchScheduleInit = (order) => {
    let existing = []
    try {
      const parsed = typeof order.report === 'string' ? JSON.parse(order.report) : (order.report || {})
      existing = Array.isArray(parsed.batch_schedule) ? parsed.batch_schedule : []
    } catch (e) {}

    if (existing.length === 0) {
      existing = [
        { batch_num: 1, quantity: order.quantity || 0, deadline: order.deadline || '' }
      ]
    }
    setBatchScheduleList(existing)
    setIsBatchScheduleOpen(true)
  }

  const handleAddBatchItem = () => {
    setBatchScheduleList(prev => [
      ...prev,
      { batch_num: prev.length + 1, quantity: 0, deadline: selectedOrder?.deadline || '' }
    ])
  }

  const handleRemoveBatchItem = (index) => {
    setBatchScheduleList(prev => prev.filter((_, i) => i !== index).map((b, idx) => ({ ...b, batch_num: idx + 1 })))
  }

  const handleUpdateBatchItem = (index, field, value) => {
    setBatchScheduleList(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
  }

  const handleSaveBatchSchedule = async () => {
    if (!selectedOrder) return
    setIsSavingSchedule(true)
    try {
      let currentReport = {}
      try {
        currentReport = typeof selectedOrder.report === 'string' ? JSON.parse(selectedOrder.report) : (selectedOrder.report || {})
      } catch (e) {}

      const updatedReport = {
        ...currentReport,
        batch_schedule: batchScheduleList.map((b, idx) => ({
          batch_num: idx + 1,
          quantity: Number(b.quantity) || 0,
          deadline: b.deadline || ''
        }))
      }

      const { error } = await supabase
        .from('orders')
        .update({ report: JSON.stringify(updatedReport) })
        .eq('id', selectedOrder.id)

      if (error) throw error

      alert('Календар партій успішно збережено!')
      setIsBatchScheduleOpen(false)
      fetchOrders(currentPage, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка збереження календаря партій: ' + err.message)
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const generateNextOrderNum = () => {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;

    const yyyy = today.getFullYear();
    const legacyPrefixFull = `${dd}${mm}${yyyy}`;
    const legacyPrefixShort = `${dd}${mm}${yy}`;

    const todayOrders = (orders || []).filter(o => {
      const num = o.order_num || '';
      const cleanNum = num.replace(/^№/, '');
      return (
        cleanNum.startsWith(datePrefix) ||
        cleanNum.startsWith(legacyPrefixFull) ||
        cleanNum.startsWith(legacyPrefixShort)
      );
    });

    let maxSeq = 0;
    todayOrders.forEach(o => {
      const num = o.order_num || '';
      const cleanNum = num.replace(/^№/, '');
      const parts = cleanNum.split('-');
      if (parts.length >= 2) {
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `${datePrefix}-${nextSeq}`;
  }

  const [orderHeader, setOrderHeader] = useState({ 
    orderDate: new Date().toISOString().split('T')[0],
    orderNum: '',
    invoiceNum: '',
    customer: '',
    official_customer: '',
    nomenclature_id: '',
    unit: 'шт',
    quantity: 1,
    deadline: '',
    source: 'Виробництво'
  })

  useEffect(() => {
    setOrderHeader(prev => {
      if (!prev.orderNum) {
        return { ...prev, orderNum: generateNextOrderNum() };
      }
      return prev;
    });
  }, [orders]);
  
  const clientOrders = (orders || []).filter(o => {
    const num = o.order_num || ''
    return !num.startsWith('ВБ') && !num.startsWith('VB') && num !== '14082026-01' && num !== '10082026-01' && num !== '260821-1'
  })

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showCustomerHints, setShowCustomerHints] = useState(false)
  const [rustProducts, setRustProducts] = useState([])
  const [rustOrders, setRustOrders] = useState([])
  const [rustCounterparties, setRustCounterparties] = useState([])
  // Map: characteristic_id → nomenclature_name  (built once on load, O(1) lookup)
  const [charToNomMap, setCharToNomMap] = useState(new Map())
  // Map: customer_id → customer_name
  const [custMap, setCustMap] = useState(new Map())
  const [activeTab, setActiveTab] = useState('supabase') // 'supabase' or 'rust'
  const [isRustLoading, setIsRustLoading] = useState(false)

  // Edit / Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingOrderHeader, setEditingOrderHeader] = useState({
    customer: '',
    official_customer: '',
    invoice_num: '',
    nomenclature_id: '',
    quantity: 1,
    deadline: ''
  })
  
  const handleEditInit = (order) => {
    setSelectedOrder(order)
    setIsEditMode(true)
    const nom = nomenclatures.find(n => n.id === order.nomenclature_id || n.accessories === order.accessories)
    setEditingOrderHeader({
      customer: order.customer || '',
      official_customer: order.official_customer || '',
      invoice_num: order.invoice_num || '',
      nomenclature_id: order.nomenclature_id || '',
      quantity: order.quantity || 1,
      deadline: order.deadline ? order.deadline.split('T')[0] : ''
    })
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editingOrderHeader.customer || !editingOrderHeader.nomenclature_id || !editingOrderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }

    setIsSubmitting(true)
    try {
      const selectedProduct = nomenclatures.find(p => String(p.id) === String(editingOrderHeader.nomenclature_id))
      const headerWithInfo = {
        customer: editingOrderHeader.customer,
        official_customer: editingOrderHeader.official_customer,
        invoice_num: editingOrderHeader.invoice_num,
        deadline: editingOrderHeader.deadline,
        quantity: editingOrderHeader.quantity,
        productName: selectedProduct?.name || ''
      }
      const items = [{ nomenclature_id: editingOrderHeader.nomenclature_id, quantity: editingOrderHeader.quantity }]
      
      await updateOrder(selectedOrder.id, headerWithInfo, items)
      alert('Замовлення успішно оновлено!')
      setIsEditMode(false)
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при оновленні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити це замовлення? Усі пов’язані наряди, матеріальні запити та робочі картки також будуть видалені!')) {
      return
    }
    setIsSubmitting(true)
    try {
      await deleteOrder(orderId)
      alert('Замовлення успішно видалено!')
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при видаленні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuperDeleteClick = async (orderId) => {
    if (!window.confirm('УВАГА! Це повне СУПЕР-ВИДАЛЕННЯ.\n\nВсі запити, резерви та робочі картки будуть видалені, а використані матеріали ПОВЕРНУТЬСЯ НА СКЛАДИ.\n\nВи впевнені, що хочете це зробити?')) {
      return
    }
    if (!window.confirm('ПІДТВЕРДІТЬ ЩЕ РАЗ: відновити склади та видалити замовлення повністю?')) {
      return
    }
    setIsSubmitting(true)
    try {
      await superDeleteOrder(orderId)
      alert('Замовлення та всі пов’язані дані повністю видалено з автоматичним поверненням матеріалів!')
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при супер-видаленні: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch orders when filters change
  useEffect(() => {
    setCurrentPage(0)
    fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
  }, [dateFilter, searchQuery])

  // Rust data loading disabled as per user request
  /*
  const loadRustData = async () => {
    ...
  };

  useEffect(() => {
    loadRustData();
  }, []);
  */

  const getStatusLabel = (s) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'in-progress': 'В РОБОТІ',
      'completed': 'ВІДВАНТАЖЕНО',
      'shipped': 'ВІДВАНТАЖЕНО',
      'packaged': 'ОЧІКУЄ ВІДВАНТАЖЕННЯ',
      'shop1': 'ЦЕХ №1',
      'shop2': 'ЦЕХ №2',
      'packaging': 'НА ПАКУВАННІ'
    }
    return map[s] || s?.toUpperCase()
  }

  const handleCustomerChange = async (val) => {
    setOrderHeader(prev => ({ ...prev, customer: val }))
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }
    
    if (val.length > 1) {
      setShowCustomerHints(true)
      searchTimeout.current = setTimeout(async () => {
        const results = await searchCustomers(val)
        setOrderHeader(currentHeader => {
          if (currentHeader.customer === val && results) {
            setLocalCustomers(results)
          }
          return currentHeader
        })
      }, 250)
    } else {
      setShowCustomerHints(false)
      setLocalCustomers([])
    }
  }

  const selectCustomer = (c) => {
    setOrderHeader({ ...orderHeader, customer: c.name, official_customer: c.official_name || '' })
    setShowCustomerHints(false)
  }

  const handleOrderSubmit = async (e) => {
    e.preventDefault()
    if (!orderHeader.customer || !orderHeader.orderNum || !orderHeader.nomenclature_id || !orderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, Номер замовлення, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }
    
    setIsSubmitting(true)
    try {
      const selectedProduct = nomenclatures.find(p => String(p.id) === String(orderHeader.nomenclature_id));
      const headerWithInfo = { ...orderHeader, productName: selectedProduct?.name || '' };
      
      const items = [{ nomenclature_id: orderHeader.nomenclature_id, quantity: orderHeader.quantity }]
      await apiService.submitOrder(headerWithInfo, items, addOrder, currentUser?.token)
      
      // Refresh customers list so the newly saved customer appears in dropdown
      refreshTable('customers')
      
      setOrderHeader({ 
        ...orderHeader,
        orderNum: '',
        invoiceNum: '',
        customer: '',
        official_customer: '',
        nomenclature_id: '',
        quantity: 1,
        deadline: ''
      })
      alert('Замовлення успішно додано!')
      // Refresh list to show the new order
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при додаванні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadMore = () => {
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    fetchOrders(nextPage, true, { searchQuery, dateRange: dateFilter })
  }

  return (
    <div className="manager-module-modern" style={{ background: 'var(--bg, #050505)', minHeight: '100vh', color: 'var(--text, #fff)', display: 'flex', flexDirection: 'column', fontFamily: '"Outfit", sans-serif' }}>
      
      {/* Header Overlay */}
      <nav className="glass-nav" style={{ 
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 25px 12px 75px', background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <Link to="/" className="back-btn-modern">
          <ArrowLeft size={18} /> <span>НАЗАД</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutDashboard className="text-orange" size={24} />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>MANAGER <span className="text-dim">CONSOLE</span></h1>
          <span className="pillar-badge-crm" style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
            CRM & ERP Pillar
          </span>
        </div>
      </nav>

      <div className="content-scrollbox" style={{ padding: '30px',maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {/* NEW ORDER SECTION */}
        <section className="registration-section" style={{ marginBottom: '60px' }}>
          <div className="glass-card main-registration-card">
            <div className="registration-header-group">
               <div className="icon-badge">
                  <Plus className="text-orange" size={24} />
               </div>
               <h2 className="registration-title">РЕЄСТРАЦІЯ ЗАМОВЛЕННЯ</h2>
            </div>

            <form onSubmit={handleOrderSubmit} className="order-form-grid-modern">
              <div className="form-group-modern">
                <label>№ ЗАМОВЛЕННЯ</label>
                <div className="input-wrapper" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <Package size={16} />
                  <input value={orderHeader.orderNum} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} placeholder="Генерується автоматично..." />
                </div>
              </div>

              <div className="form-group-modern">
                <label>№ РАХУНКУ (ОПЦІОНАЛЬНО)</label>
                <div className="input-wrapper">
                  <FileText size={16} />
                  <input value={orderHeader.invoiceNum} onChange={e => setOrderHeader({...orderHeader, invoiceNum: e.target.value})} placeholder="Введіть № рахунку..." />
                </div>
              </div>

              <div className="form-group-modern">
                <label>ЗАМОВНИК (ПОШУК)</label>
                <div className="input-wrapper">
                  <User size={16} />
                  <input value={orderHeader.customer} onChange={e => handleCustomerChange(e.target.value)} onBlur={() => setTimeout(() => setShowCustomerHints(false), 200)} placeholder="Почніть вводити назву..." />
                  {showCustomerHints && localCustomers.length > 0 && (
                    <div className="hints-dropdown">
                      {localCustomers.map(c => <div key={c.id} onClick={() => selectCustomer(c)} className="hint-item">{c.name}</div>)}
                    </div>
                  )}
                </div>
              </div>

               <div className="form-group-modern">
                <label>ГОТОВИЙ ВИРІБ (ПОШУК)</label>
                <ProductSearchSelect
                  products={nomenclatures.filter(n => n.type === 'product')}
                  value={orderHeader.nomenclature_id}
                  onChange={id => setOrderHeader({ ...orderHeader, nomenclature_id: id })}
                  onCreateNewProduct={(q) => {
                    setCreateProductQuery(q)
                    setTargetProductField('registration')
                    setIsCreateProductOpen(true)
                  }}
                />
              </div>

              <div className="form-group-modern quantity-deadline-group">
                <div className="qty-subgroup">
                  <label>КІЛЬКІСТЬ</label>
                  <div className="input-wrapper">
                    <input type="number" value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} />
                  </div>
                </div>
                <div className="deadline-subgroup">
                  <label>ДЕДЛАЙН</label>
                  <div className="input-wrapper">
                    <Calendar size={16} />
                    <input 
                      type="date" 
                      onClick={(e) => e.target.showPicker()} 
                      min={new Date().toISOString().split('T')[0]}
                      value={orderHeader.deadline} 
                      onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button type="submit" disabled={isSubmitting} className="btn-primary-modern">
                  {isSubmitting ? 'ОБРОБКА...' : 'ЗАРЕЄСТРУВАТИ ЗАМОВЛЕННЯ'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* REGISTRY SECTION */}
        <section className="registry-section-modern">
          <div className="registry-header-modern">
             <div className="registry-title-group">
                <Layers className="text-orange" size={28} />
                <h3>РЕЄСТР ЗАМОВЛЕНЬ</h3>
             </div>

             <div className="filters-container-modern">
                <div className="period-filters">
                   {['today', 'week', 'month', 'quarter', 'all'].map(p => (
                     <button key={p} onClick={() => setDateFilter(p)} className={`filter-chip ${dateFilter === p ? 'active' : ''}`}>
                       {p === 'today' ? 'СЬОГОДНІ' : p === 'week' ? 'ТИЖДЕНЬ' : p === 'month' ? 'МІСЯЦЬ' : p === 'quarter' ? 'КВАРТАЛ' : 'УСІ'}
                     </button>
                   ))}
                </div>
                
                <div className="search-box-modern">
                   <Search size={18} />
                   <input placeholder="Пошук номеру, рахунку або клієнта..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
             </div>
          </div>

          <div className="glass-card table-glass" style={{ padding: '0', borderRadius: '24px', background: 'rgba(15,15,15,0.4)', border: '1px solid rgba(255,144,0,0.05)', overflow: 'hidden' }}>
             <div className="table-responsive-container hide-mobile">
                <table className="modern-table">
                   <thead>
                     <tr>
                        <th>№ ЗАМОВЛЕННЯ</th>
                        <th>№ РАХУНКУ</th>
                        <th>ЗАМОВНИК</th>
                        <th>ВИРІБ</th>
                        <th>КІЛЬКІСТЬ</th>
                        <th>ТЕРМІН</th>
                        <th>СТАТУС</th>
                        <th style={{ textAlign: 'right', width: '60px' }}>ДІЇ</th>
                     </tr>
                   </thead>
                   <tbody>
                         {clientOrders.map(order => {
                           const nom = nomenclatures.find(n => String(n.id) === String(order.nomenclature_id));
                           const prodName = nom ? nom.name : (order.accessories || '—');
                           const ordQty = order.quantity || 0;
                           const prog = getOrderProductionProgress(order.id);
                           const inWorkQty = Math.max(0, prog.planned - prog.packaged);
                           return (
                             <tr key={order.id} onClick={() => setSelectedOrder(order)}>
                               <td className="order-num-cell">#{order.order_num}</td>
                               <td className="invoice-num-cell" style={{ color: order.invoice_num ? '#3b82f6' : '#555', fontWeight: 600, fontSize: '0.88rem' }}>
                                 {order.invoice_num ? `№ ${order.invoice_num}` : '—'}
                               </td>
                               <td className="customer-cell">{order.customer}</td>
                               <td className="product-cell">{prodName}</td>
                               <td className="qty-cell">
                                 <strong>{prog.packaged}</strong>
                                 {inWorkQty > 0 && (
                                   <span style={{ color: '#ff9000', fontSize: '0.85rem', fontWeight: '500', marginLeft: '5px', marginRight: '5px' }} title="В роботі">
                                     (в роботі: {inWorkQty})
                                   </span>
                                 )}
                                 <strong> / {ordQty}</strong> шт
                               </td>
                               <td className="date-cell">{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</td>
                               <td><span className={`status-pill ${prog.status}`}>{getStatusLabel(prog.status)}</span></td>
                               <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={() => handleEditInit(order)}
                                    style={{
                                      background: 'rgba(255,144,0,0.1)',
                                      border: '1px solid rgba(255,144,0,0.25)',
                                      borderRadius: '10px',
                                      width: '36px',
                                      height: '36px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ff9000',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    title="Швидке редагування"
                                    className="quick-edit-btn"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                </td>
                             </tr>
                           )
                         })}
                   </tbody>
                </table>
             </div>

             {/* Mobile Registry View (Cards) */}
             <div className="mobile-registry-cards mobile-only">
                {clientOrders.map(order => {
                  const nom = nomenclatures.find(n => String(n.id) === String(order.nomenclature_id));
                  const prodName = nom ? nom.name : (order.accessories || '—');
                  const ordQty = order.quantity || 0;
                  const prog = getOrderProductionProgress(order.id);
                  const inWorkQty = Math.max(0, prog.planned - prog.packaged);
                  return (
                    <div key={order.id} onClick={() => setSelectedOrder(order)} className="mobile-order-card">
                       <div className="card-top">
                          <span className="card-order-num">#{order.order_num}</span>
                          <span className={`status-pill ${prog.status}`}>{getStatusLabel(prog.status)}</span>
                       </div>
                       <div className="card-customer">{order.customer}</div>
                       <div className="card-product">{prodName}</div>
                       <div className="card-footer">
                          <span>
                            <strong>{prog.packaged}</strong>
                            {inWorkQty > 0 && (
                              <span style={{ color: '#ff9000', fontSize: '0.8rem', fontWeight: '500', marginLeft: '4px', marginRight: '4px' }}>
                                (в роботі: {inWorkQty})
                              </span>
                            )}
                            <strong> / {ordQty}</strong> шт
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             <span className="card-deadline"><Calendar size={12} /> {order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</span>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleEditInit(order);
                               }}
                               style={{
                                 background: 'rgba(255,144,0,0.1)',
                                 border: '1px solid rgba(255,144,0,0.25)',
                                 borderRadius: '8px',
                                 width: '30px',
                                 height: '30px',
                                 display: 'inline-flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 color: '#ff9000',
                                 cursor: 'pointer'
                               }}
                               title="Швидке редагування"
                             >
                               <Pencil size={13} />
                             </button>
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>

             {clientOrders.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#444', fontSize: '1rem' }}>Замовлень не знайдено</div>
             )}
          </div>

          {hasMoreOrders && (
             <div style={{ textAlign: 'center', padding: '40px' }}>
                <button onClick={loadMore} className="btn-load-more">ПОКАЗАТИ БІЛЬШЕ</button>
             </div>
          )}
        </section>
      </div>

      {/* DETAIL & EDIT MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop-modern">
           <div className="glass-card modal-content-modern anim-slide-up">
              <div className="modal-header-modern">
                 <h2>{isEditMode ? 'РЕДАГУВАННЯ ЗАМОВЛЕННЯ' : 'ДЕТАЛІ'} <span className="text-orange">#{selectedOrder.order_num}</span></h2>
                 <button onClick={() => { setSelectedOrder(null); setIsEditMode(false); }} className="btn-close-modal"><X size={24} /></button>
              </div>
              
              {isEditMode ? (
                <form onSubmit={handleUpdateSubmit} className="modal-body-modern" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group-modern">
                    <label>ЗАМОВНИК</label>
                    <div className="input-wrapper">
                      <User size={16} />
                      <input value={editingOrderHeader.customer} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, customer: e.target.value })} required />
                    </div>
                  </div>
                  
                  <div className="form-group-modern">
                    <label>ОФІЦІЙНА НАЗВА ЗАМОВНИКА</label>
                    <div className="input-wrapper">
                      <User size={16} />
                      <input value={editingOrderHeader.official_customer} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, official_customer: e.target.value })} />
                    </div>
                  </div>

                  <div className="form-group-modern">
                    <label>№ РАХУНКУ (ОПЦІОНАЛЬНО)</label>
                    <div className="input-wrapper">
                      <FileText size={16} />
                      <input value={editingOrderHeader.invoice_num} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, invoice_num: e.target.value })} placeholder="Вкажіть номер рахунку..." />
                    </div>
                  </div>

                  <div className="form-group-modern">
                    <label>ГОТОВИЙ ВИРІБ (ПОШУК)</label>
                    <ProductSearchSelect
                      products={nomenclatures.filter(n => n.type === 'product')}
                      value={editingOrderHeader.nomenclature_id}
                      onChange={id => setEditingOrderHeader({ ...editingOrderHeader, nomenclature_id: id })}
                      onCreateNewProduct={(q) => {
                        setCreateProductQuery(q)
                        setTargetProductField('edit')
                        setIsCreateProductOpen(true)
                      }}
                    />
                  </div>

                  <div className="form-group-modern quantity-deadline-group" style={{ display: 'flex', gap: '20px' }}>
                    <div className="qty-subgroup" style={{ flex: 1 }}>
                      <label>КІЛЬКІСТЬ</label>
                      <div className="input-wrapper">
                        <input type="number" value={editingOrderHeader.quantity} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, quantity: Number(e.target.value) })} required />
                      </div>
                    </div>
                    <div className="deadline-subgroup" style={{ flex: 1 }}>
                      <label>ДЕДЛАЙН</label>
                      <div className="input-wrapper">
                        <Calendar size={16} />
                        <input type="date" value={editingOrderHeader.deadline} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, deadline: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button type="button" onClick={() => setIsEditMode(false)} className="btn-load-more" style={{ padding: '12px 24px' }}>СКАСУВАТИ</button>
                    <button type="submit" disabled={isSubmitting} className="btn-primary-modern" style={{ padding: '12px 24px', boxShadow: 'none', marginTop: 0 }}>
                      {isSubmitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ЗМІНИ'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="modal-body-modern">
                   <div className="details-grid-modern">
                      <div className="detail-item">
                         <label>ЗАМОВНИК</label>
                         <div>{selectedOrder.customer}</div>
                      </div>
                      <div className="detail-item">
                         <label>№ РАХУНКУ</label>
                         <div style={{ color: selectedOrder.invoice_num ? '#3b82f6' : '#555', fontWeight: 700 }}>
                           {selectedOrder.invoice_num ? `№ ${selectedOrder.invoice_num}` : '—'}
                         </div>
                      </div>
                      <div className="detail-item">
                         <label>ТЕРМІН</label>
                         <div className="text-orange">{selectedOrder.deadline ? new Date(selectedOrder.deadline).toLocaleDateString() : '—'}</div>
                      </div>
                      <div className="detail-item">
                         <label>СТАТУС</label>
                         <div className={`status-text ${selectedOrder.status}`}>{getStatusLabel(selectedOrder.status)}</div>
                      </div>
                      <div className="detail-item">
                         <label>ОФІЦІЙНА НАЗВА</label>
                         <div style={{ fontSize: '0.9rem', color: '#888' }}>{selectedOrder.official_customer || '—'}</div>
                      </div>
                   </div>
                   
                   <h4 className="section-subtitle-modern">СКЛАД ЗАМОВЛЕННЯ</h4>
                   <div className="order-items-list" style={{ marginBottom: '30px' }}>
                      {selectedOrder.order_items?.map((item, idx) => (
                         <div key={idx} className="item-row-modern">
                            <Package size={16} className="text-dim" />
                            <span className="item-name">{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</span>
                            <span className="spacer"></span>
                            <strong className="item-qty">{item.quantity} шт</strong>
                         </div>
                      ))}
                      {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                         <div className="item-row-modern">
                            <Package size={16} className="text-dim" />
                            <span className="item-name">{selectedOrder.accessories || 'Не вказано'}</span>
                            <span className="spacer"></span>
                            <strong className="item-qty">{selectedOrder.quantity} шт</strong>
                         </div>
                      )}
                   </div>

                   {/* Action Buttons: Edit, Batch Schedule, and Delete */}
                   <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', flexWrap: 'wrap' }}>
                      {currentUser?.login === 'admin@workshop.local' && (
                        <button onClick={() => handleSuperDeleteClick(selectedOrder.id)} disabled={isSubmitting} className="btn-primary-modern" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', border: 'none', padding: '12px 20px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(239,68,68,0.4)' }}>
                          <Trash2 size={16} /> СУПЕР-ВИДАЛЕННЯ
                        </button>
                      )}
                      <button onClick={() => handleDeleteClick(selectedOrder.id)} disabled={isSubmitting} className="btn-load-more" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Trash2 size={16} /> ВИДАЛИТИ
                      </button>
                      <button onClick={() => handleBatchScheduleInit(selectedOrder)} className="btn-primary-modern" style={{ background: 'linear-gradient(135deg, #ff9000, #e67e00)', color: '#000', boxShadow: '0 4px 14px rgba(255,144,0,0.3)', padding: '12px 20px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '900' }}>
                        <Calendar size={16} /> КАЛЕНДАР ПАРТІЙ
                      </button>
                      <button onClick={() => handleEditInit(selectedOrder)} className="btn-primary-modern" style={{ background: '#3b82f6', color: '#fff', boxShadow: 'none', padding: '12px 20px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔧 РЕДАГУВАТИ
                      </button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* BATCH SCHEDULE MODAL */}
      {isBatchScheduleOpen && selectedOrder && (
        <div className="modal-backdrop-modern">
          <div className="glass-card modal-content-modern anim-slide-up" style={{ maxWidth: '650px' }}>
            <div className="modal-header-modern">
              <h2>📅 КАЛЕНДАР ПАРТІЙ <span className="text-orange">#{selectedOrder.order_num}</span></h2>
              <button onClick={() => setIsBatchScheduleOpen(false)} className="btn-close-modal"><X size={24} /></button>
            </div>
            
            <div className="modal-body-modern" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.2)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: '800', letterSpacing: '1px' }}>ЗАГАЛЬНИЙ ТИРАЖ ЗАМОВЛЕННЯ</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ff9000' }}>{selectedOrder.quantity || 0} шт</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: '800', letterSpacing: '1px' }}>РОЗПОДІЛЕНО / ЗАЛИШОК</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '900', color: batchScheduleList.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0) === (selectedOrder.quantity || 0) ? '#22c55e' : '#ef4444' }}>
                    {batchScheduleList.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0)} / {(selectedOrder.quantity || 0) - batchScheduleList.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0)} шт
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                {batchScheduleList.map((batch, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontWeight: '900', color: '#ff9000', minWidth: '85px', fontSize: '0.9rem' }}>
                      Партія №{idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', fontWeight: '800', marginBottom: '4px' }}>КІЛЬКІСТЬ (ШТ)</label>
                      <input
                        type="number"
                        value={batch.quantity}
                        onChange={e => handleUpdateBatchItem(idx, 'quantity', e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '10px', width: '100%', outline: 'none', fontWeight: '700' }}
                        placeholder="Кількість..."
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', fontWeight: '800', marginBottom: '4px' }}>ДЕДЛАЙН</label>
                      <input
                        type="date"
                        value={batch.deadline}
                        onChange={e => handleUpdateBatchItem(idx, 'deadline', e.target.value)}
                        onClick={e => e.target.showPicker()}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '10px', width: '100%', outline: 'none', fontWeight: '700' }}
                      />
                    </div>
                    {batchScheduleList.length > 1 && (
                      <button
                        onClick={() => handleRemoveBatchItem(idx)}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '16px' }}
                        title="Видалити партію"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddBatchItem}
                className="btn-load-more"
                style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderStyle: 'dashed' }}
              >
                <Plus size={16} /> ДОДАТИ ПАРТІЮ В ГРАФІК
              </button>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => setIsBatchScheduleOpen(false)} className="btn-load-more" style={{ padding: '12px 24px' }}>СКАСУВАТИ</button>
                <button
                  onClick={handleSaveBatchSchedule}
                  disabled={isSavingSchedule}
                  className="btn-primary-modern"
                  style={{ padding: '12px 24px', marginTop: 0 }}
                >
                  {isSavingSchedule ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ КАЛЕНДАР ПАРТІЙ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');

        .text-orange { color: #ff9000; }
        .text-dim { color: #555; }
        
        .back-btn-modern {
          display: flex; gap: 8px; align-items: center; color: #888;
          text-decoration: none; font-weight: 800; font-size: 0.8rem;
          padding: 8px 16px; border-radius: 12px; transition: all 0.3s;
          border: 1px solid transparent;
        }
        .back-btn-modern:hover { color: #fff; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }

        .order-form-grid-modern {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;
        }

        .form-group-modern label {
          display: block; font-size: 0.65rem; color: #555; font-weight: 900;
          letter-spacing: 1px; margin-bottom: 10px;
        }

        .input-wrapper {
          position: relative; display: flex; align-items: center;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; padding: 4px 15px; transition: border-color 0.3s;
        }
        .input-wrapper:focus-within { border-color: #ff9000; }
        .input-wrapper input, .input-wrapper select {
          background: transparent; border: none; color: #fff; padding: 10px;
          flex: 1; outline: none; font-size: 0.9rem; width: 100%;
        }
        .input-wrapper select option {
          background: #111;
          color: #fff;
        }
        .input-wrapper svg { color: #444; flex-shrink: 0; }

        .btn-primary-modern {
          background: #ff9000; color: #000; border: none; padding: 16px 32px;
          border-radius: 16px; font-weight: 900; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 10px 20px -5px rgba(255,144,0,0.4);
        }
        .btn-primary-modern:hover { transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(255,144,0,0.6); }
        .btn-primary-modern:active { transform: translateY(0); }

        .hints-dropdown {
          position: absolute; top: 100%; left: 0; right: 0; background: #111;
          border: 1px solid #222; border-radius: 0 0 14px 14px; z-index: 50; overflow: hidden;
        }
        .hint-item { padding: 12px; font-size: 0.85rem; cursor: pointer; }
        .hint-item:hover { background: #1a1a1a; color: #ff9000; }

        .registry-header-modern {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 25px; flex-wrap: wrap; gap: 20px;
        }
        .registry-title-group { display: flex; align-items: center; gap: 15px; }
        .registry-title-group h3 { font-size: 1.4rem; font-weight: 900; margin: 0; }
        .count-badge { font-size: 0.8rem; color: #555; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; vertical-align: middle; }

        .filters-container-modern { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; width: 100%; }
        .period-filters { display: flex; background: rgba(255,255,255,0.03); padding: 5px; border-radius: 16px; gap: 5px; overflow-x: auto; max-width: 100%; }
        .filter-chip {
          background: transparent; border: none; color: #555; padding: 8px 16px;
          border-radius: 12px; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: all 0.3s;
          white-space: nowrap;
        }
        .filter-chip.active { background: #ff9000; color: #000; }

        .search-box-modern {
          display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05);
          padding: 8px 20px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.05);
          flex: 1; min-width: 250px;
        }
        .search-box-modern input { background: transparent; border: none; color: #fff; outline: none; width: 100%; font-size: 0.85rem; }

        .modern-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .modern-table th { padding: 15px 20px; color: #444; font-size: 0.7rem; font-weight: 900; text-align: left; text-transform: uppercase; }
        .modern-table tbody tr { background: rgba(255,255,255,0.02); cursor: pointer; transition: transform 0.2s, background 0.2s; }
        .modern-table tbody tr:hover { background: rgba(255,255,255,0.04); transform: scale(1.005); }
        .modern-table td { padding: 18px 20px; }
        .order-num-cell { font-weight: 900; color: #ff9000; border-radius: 16px 0 0 16px; font-size: 1.1rem; }
        .customer-cell { font-weight: 600; }
        .product-cell { color: #888; font-size: 0.85rem; }
        .qty-cell strong { font-size: 1rem; }
        .date-cell { color: #444; font-size: 0.85rem; }
        .status-pill {
          display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 0.65rem;
          font-weight: 900; color: #fff; text-transform: uppercase;
        }
        .status-pill.pending { background: rgba(100,100,100,0.1); color: #888; border: 1px solid rgba(100,100,100,0.2); }
        .status-pill.in-progress { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
        .status-pill.completed { background: rgba(59,130,246,0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.2); }
        .status-pill.packaged { background: rgba(168,85,247,0.1); color: #a855f7; border: 1px solid rgba(168,85,247,0.2); }
        .status-pill.shipped { background: rgba(255,144,0,0.1); color: #ff9000; border: 1px solid rgba(255,144,0,0.2); }

        .main-registration-card {
           padding: 40px; border-radius: 32px; 
           background: linear-gradient(135deg, rgba(20,20,20,0.4) 0%, rgba(10,10,10,0.6) 100%); 
           border: 1px solid rgba(255,255,255,0.05); 
           box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .registration-header-group { display: flex; alignItems: center; gap: 15px; margin-bottom: 35px; }
        .icon-badge { width: 48px; height: 48px; min-width: 48px; border-radius: 16px; background: rgba(255,144,0,0.1); display: flex; alignItems: center; justifyContent: center; }
        .registration-title { fontSize: 1.8rem; fontWeight: 900; margin: 0; }

        .form-group-modern { width: 100%; min-width: 0; }
        .quantity-deadline-group { 
          display: flex; 
          gap: 20px; 
          grid-column: span 1;
          flex-wrap: nowrap;
        }
        @media (min-width: 1200px) {
          .quantity-deadline-group { grid-column: span 1; }
        }
        .qty-subgroup, .deadline-subgroup { flex: 1; min-width: 0; }

        .mobile-order-card {
           background: rgba(255,255,255,0.03); padding: 18px; border-radius: 20px;
           border: 1px solid rgba(255,255,255,0.05); margin-bottom: 15px;
        }
        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .card-order-num { color: #ff9000; font-weight: 900; font-size: 1.1rem; }
        .card-customer { font-weight: 600; margin-bottom: 4px; }
        .card-product { font-size: 0.8rem; color: #666; margin-bottom: 12px; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #888; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 12px; }
        .card-deadline { display: flex; align-items: center; gap: 5px; color: #ff9000; font-weight: 600; }

        .btn-load-more {
          background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #444;
          padding: 12px 36px; border-radius: 30px; font-weight: 800; cursor: pointer; transition: all 0.3s;
        }
        .btn-load-more:hover { border-color: #ff9000; color: #ff9000; background: rgba(255,144,0,0.05); }

        .modal-backdrop-modern {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
          backdrop-filter: blur(20px);
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .modal-content-modern { 
          width: 100%; 
          maxWidth: 600px; 
          background: rgba(15, 15, 18, 0.75); 
          border: 1px solid rgba(255, 144, 0, 0.15); 
          border-radius: 28px; 
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.05); 
          overflow: hidden;
        }
        
        .modal-header-modern { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 24px 32px; 
          border-bottom: 1px solid rgba(255,255,255,0.04); 
          background: rgba(255, 255, 255, 0.01);
        }
        
        .modal-header-modern h2 { 
          margin: 0; 
          font-size: 1.25rem; 
          font-weight: 900; 
          letter-spacing: -0.5px; 
          text-transform: uppercase;
        }
        
        .btn-close-modal { 
          background: rgba(255,255,255,0.03); 
          border: 1px solid rgba(255,255,255,0.05); 
          color: #888; 
          cursor: pointer; 
          width: 38px; 
          height: 38px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          transition: all 0.2s; 
        }
        .btn-close-modal:hover { color: #fff; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }
        
        .modal-body-modern { padding: 32px; }
        
        .details-grid-modern { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px 32px; 
          margin-bottom: 32px; 
          background: rgba(0,0,0,0.2); 
          padding: 20px 24px; 
          border-radius: 20px; 
          border: 1px solid rgba(255,255,255,0.02);
        }
        
        .detail-item label { 
          display: block; 
          font-size: 0.62rem; 
          color: #555; 
          font-weight: 950; 
          letter-spacing: 1.5px; 
          margin-bottom: 6px; 
          text-transform: uppercase;
        }
        
        .detail-item div { 
          font-size: 1.05rem; 
          font-weight: 800; 
          color: #eee;
        }
        
        .section-subtitle-modern { 
          font-size: 0.72rem; 
          color: #444; 
          font-weight: 950; 
          margin-bottom: 16px; 
          letter-spacing: 1px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .item-row-modern { 
          display: flex; 
          align-items: center; 
          gap: 15px; 
          padding: 16px 20px; 
          background: rgba(255,255,255,0.01); 
          border: 1px solid rgba(255,255,255,0.03); 
          border-radius: 16px; 
          margin-bottom: 12px; 
          transition: border-color 0.2s;
        }
        .item-row-modern:hover { border-color: rgba(255, 144, 0, 0.15); }
        
        .item-name { 
          flex: 1; 
          font-weight: 700; 
          font-size: 0.92rem; 
          color: #ddd; 
        }
        
        .item-qty { 
          color: #ff9000; 
          font-size: 1.15rem; 
          font-weight: 900;
        }

        .anim-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .main-registration-card { padding: 20px; border-radius: 20px; }
          .registration-header-group { gap: 12px; margin-bottom: 25px; }
          .registration-title { font-size: 1.3rem; }
          .icon-badge { width: 36px; height: 36px; min-width: 36px; border-radius: 10px; }
          .icon-badge svg { width: 18px; height: 18px; }

          .order-form-grid-modern { grid-template-columns: 1fr; gap: 12px; }
          .quantity-deadline-group { flex-direction: column; gap: 12px; }
          
          .registry-header-modern { flex-direction: column; align-items: flex-start; }
          .filters-container-modern { flex-direction: column; align-items: stretch; }
          .search-box-modern { min-width: 100%; order: -1; }
          .period-filters { width: 100%; }
        }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        initialQuery={createProductQuery}
        nomenclatures={nomenclatures}
        onCreated={(newId) => {
          if (!newId) return
          if (targetProductField === 'edit') {
            setEditingOrderHeader(prev => ({ ...prev, nomenclature_id: newId }))
          } else {
            setOrderHeader(prev => ({ ...prev, nomenclature_id: newId }))
          }
        }}
      />
    </div>
  )
}

export default ManagerModule

