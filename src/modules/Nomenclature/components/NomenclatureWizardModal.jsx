import React from 'react'
import { Sparkles, X, AlertCircle, Trash2, Clock } from 'lucide-react'
import { ERP_CATEGORY_SCHEMAS, inputStyle } from '../utils/nomenclatureHelpers'

export const NomenclatureWizardModal = ({
  editingItem,
  isWizardOpen,
  setIsWizardOpen,
  setEditingItem,
  handleCreateItemSubmit,
  wizardGroup,
  setWizardGroup,
  wizardRuleType,
  setWizardRuleType,
  wizardParams,
  setWizardParams,
  groups,
  flattenedGroups,
  generatedName,
  isDuplicate,
  refDicts,
  isDirector,
  showPrefixManage,
  setShowPrefixManage,
  prefixList,
  removePrefixItem,
  showSeriesManage,
  setShowSeriesManage,
  seriesList,
  removeSeriesItem,
  DEFAULT_LOAD_TIMINGS
}) => {
  if (!isWizardOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="packaging-modal-window" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: 'var(--shadow, 0 20px 50px rgba(0,0,0,0.2))' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="#ff9000" />
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: 'var(--text, #0f172a)' }}>
              {editingItem ? `Редагування позиції (${editingItem.code})` : 'Конструктор Номенклатури ERP'}
            </h3>
          </div>
          <button onClick={() => { setIsWizardOpen(false); setEditingItem(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleCreateItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Category Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>КАТЕГОРІЯ НОМЕНКЛАТУРИ</label>
            <select 
              value={wizardGroup?.id || ''} 
              onChange={e => {
                const g = groups.find(it => it.id === e.target.value);
                const rType = g?.rule_type || 'generic';
                setWizardGroup(g);
                setWizardRuleType(rType);
                setWizardParams(prev => ({
                  ...prev,
                  isBlack: rType === 'screw_black' ? true : rType === 'screw_silver' ? false : prev.isBlack
                }));
              }}
              style={{ ...inputStyle, fontWeight: 800, fontSize: '0.9rem' }}
            >
              {flattenedGroups.map(g => (
                <option 
                  key={g.id} 
                  value={g.id}
                  style={{
                    fontWeight: g.depth === 0 ? 900 : g.hasSubs ? 800 : 400,
                    color: g.depth === 0 ? '#ff9000' : 'var(--text, #0f172a)'
                  }}
                >
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Live Preview Card */}
          <div style={{ background: 'rgba(255,144,0,0.06)', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#d97706', textTransform: 'uppercase', marginBottom: '6px' }}>АВТОМАТИЧНО СГЕНЕРОВАНА НАЗВА:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text, #0f172a)', wordBreak: 'break-word' }}>
              {generatedName || <span style={{ color: 'var(--text-muted, #64748b)', fontStyle: 'italic', fontWeight: 600 }}>{wizardRuleType === 'frame_part' ? 'Введіть назву деталі у поле нижче (напр. KR-10(218)-П-7-60)...' : 'Заповніть параметри нижче...'}</span>}
            </div>

            {isDuplicate && (
              <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} /> Увага: Позиція з такою назвою вже існує у V2 каталозі!
              </div>
            )}
          </div>

          {/* Category Rules & Dictionaries Badge */}
          {ERP_CATEGORY_SCHEMAS[wizardRuleType] && (
            <div style={{ background: 'var(--card-header-bg, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '14px', padding: '12px 16px', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                📋 Обов'язкові довідникові параметри для {ERP_CATEGORY_SCHEMAS[wizardRuleType].title}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ERP_CATEGORY_SCHEMAS[wizardRuleType].fields.map(f => (
                  <span key={f.key} style={{ background: 'rgba(255,144,0,0.1)', color: '#d97706', border: '1px solid rgba(255,144,0,0.25)', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.7rem' }}>
                    ✓ {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Rule Form Fields */}
          <div style={{ background: 'var(--card-header-bg, #f8fafc)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* SCREWS */}
            {(wizardRuleType === 'screw' || wizardRuleType === 'screw_black' || wizardRuleType === 'screw_silver') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СТАНДАРТ (DIN / ISO)</label>
                    <select value={wizardParams.standard} onChange={e => setWizardParams({...wizardParams, standard: e.target.value})} style={inputStyle}>
                      <option value="DIN912">DIN 912 (Циліндрична)</option>
                      <option value="DIN7991">DIN 7991 (Потай)</option>
                      <option value="ISO7380">ISO 7380 (Напівкругла)</option>
                      <option value="DIN7985">DIN 7985 (Сочевиця)</option>
                      <option value="DIN913">DIN 913 (Установчий)</option>
                      <option value="ISO10642">ISO 10642</option>
                      <option value="custom">✏️ + Власний стандарт (ввести свій)...</option>
                    </select>
                    {wizardParams.standard === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customStandard || ''} 
                        onChange={e => setWizardParams({...wizardParams, customStandard: e.target.value})} 
                        placeholder="напр. DIN 84 або ISO 14581" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>РІЗЬБА (М)</label>
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
                      <option value="12">М12</option>
                      <option value="14">М14</option>
                      <option value="custom">✏️ + Власна різьба (ввести свою)...</option>
                    </select>
                    {wizardParams.diameter === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customDiameter || ''} 
                        onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} 
                        placeholder="напр. 3,5 або 16" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ДОВЖИНА ГВИНТА (мм)</label>
                  <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 10, 16, 25" style={inputStyle} />
                </div>

                <div style={{ display: 'flex', gap: '20px', paddingTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                    Чорний колір (чорний)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    <input type="checkbox" checked={wizardParams.isPartialThread} onChange={e => setWizardParams({...wizardParams, isPartialThread: e.target.checked})} />
                    Неповна різьба
                  </label>
                </div>
              </>
            )}

            {/* NUTS */}
            {wizardRuleType === 'nut' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СТАНДАРТ (DIN)</label>
                    <select value={wizardParams.din || 'DIN 934'} onChange={e => setWizardParams({...wizardParams, din: e.target.value})} style={inputStyle}>
                      <option value="DIN 934">DIN 934 (Шестигранна)</option>
                      <option value="DIN 6923">DIN 6923 (З фланцем)</option>
                      <option value="DIN 985">DIN 985 (З нейлоном)</option>
                      <option value="DIN 439">DIN 439 (Низька)</option>
                      <option value="DIN 1587">DIN 1587 (Ковпачкова)</option>
                      <option value="custom">✏️ + Власний DIN...</option>
                    </select>
                    {wizardParams.din === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customDin || ''} 
                        onChange={e => setWizardParams({...wizardParams, customDin: e.target.value})} 
                        placeholder="напр. DIN 557" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                      <option value="6">М6</option>
                      <option value="8">М8</option>
                      <option value="10">М10</option>
                      <option value="12">М12</option>
                      <option value="custom">✏️ + Власна різьба...</option>
                    </select>
                    {wizardParams.diameter === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customDiameter || ''} 
                        onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} 
                        placeholder="напр. 3,5" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СПЕЦІАЛЬНИЙ ТИП (ОПЦІОНАЛЬНО)</label>
                  <select value={wizardParams.specialType || ''} onChange={e => setWizardParams({...wizardParams, specialType: e.target.value})} style={inputStyle}>
                    <option value="">Стандартна (без спец-типу)</option>
                    <option value="з фланцем">з фланцем</option>
                    <option value="з нейлоновим кільцем">з нейлоновим кільцем</option>
                    <option value="низька">низька</option>
                    <option value="ковпачкова">ковпачкова</option>
                    <option value="custom">✏️ + Свій тип...</option>
                  </select>
                  {wizardParams.specialType === 'custom' && (
                    <input 
                      type="text" 
                      value={wizardParams.customSpecialType || ''} 
                      onChange={e => setWizardParams({...wizardParams, customSpecialType: e.target.value})} 
                      placeholder="напр. корончаста" 
                      style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                    />
                  )}
                </div>

                <div style={{ paddingTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                    Чорний колір (чорний)
                  </label>
                </div>
              </>
            )}

            {/* PRESS NUTS */}
            {wizardRuleType === 'press_nut' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                      <option value="6">М6</option>
                      <option value="custom">✏️ + Власна різьба...</option>
                    </select>
                    {wizardParams.diameter === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customDiameter || ''} 
                        onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} 
                        placeholder="напр. 3,5" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ТОКЩИНА ЗАПРЕСОВКИ (код / мм)</label>
                    <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                      <option value="0">0 (0.8 мм)</option>
                      <option value="1">1 (1.0 мм)</option>
                      <option value="2">2 (1.4 мм)</option>
                      <option value="3">3 (2.3 мм)</option>
                    </select>
                  </div>
                </div>

                <div style={{ paddingTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                    Чорний колір (чорний)
                  </label>
                </div>
              </>
            )}

            {/* STANDOFFS */}
            {wizardRuleType === 'standoff' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ТИП СТІЙКИ</label>
                    <select value={wizardParams.type} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                      <option value="TFF">TFF (Мама-Мама)</option>
                      <option value="TFM">TFM (Тато-Мама)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>РІЗЬБА (М)</label>
                    <select value={wizardParams.thread} onChange={e => setWizardParams({...wizardParams, thread: e.target.value})} style={inputStyle}>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ДОВЖИНА (мм)</label>
                    <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 20" style={inputStyle} />
                  </div>
                  {wizardParams.type === 'TFM' && (
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ДОВЖИНА ХВОСТА (мм)</label>
                      <input type="text" value={wizardParams.tailLength} onChange={e => setWizardParams({...wizardParams, tailLength: e.target.value})} placeholder="напр. 6" style={inputStyle} />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>МАТЕРІАЛ</label>
                  <select value={wizardParams.material} onChange={e => setWizardParams({...wizardParams, material: e.target.value})} style={inputStyle}>
                    <option value="Алюміній">Алюміній</option>
                    <option value="Латунь">Латунь</option>
                    <option value="Сталь">Сталь</option>
                    <option value="Нейлон">Нейлон</option>
                  </select>
                </div>
              </>
            )}

            {/* MILLS */}
            {wizardRuleType === 'mill' && (
              <>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ТИП ФРЕЗИ</label>
                  <select value={wizardParams.type || 'кукурудза'} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                    <option value="кукурудза">Кукурудза</option>
                    <option value="двопера">Двопера</option>
                    <option value="чотирьохпера">Чотирьохпера</option>
                    <option value="фасочна">Фасочна</option>
                    <option value="сферична по алюмінію">Сферична по алюмінію</option>
                    <option value="custom">✏️ + Свій тип фрези...</option>
                  </select>
                  {wizardParams.type === 'custom' && (
                    <input 
                      type="text" 
                      value={wizardParams.customMillType || ''} 
                      onChange={e => setWizardParams({...wizardParams, customMillType: e.target.value})} 
                      placeholder="напр. трипера чи конусна" 
                      style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                    />
                  )}
                </div>

                {wizardParams.type === 'фасочна' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ЦАНГА D (мм)</label>
                      <select value={wizardParams.shankDia || '6'} onChange={e => setWizardParams({...wizardParams, shankDia: e.target.value})} style={inputStyle}>
                        {(refDicts.millShankDias || ['3,175', '4', '6', '8', '10', '12']).map(v => (
                          <option key={v} value={v}>{v} мм</option>
                        ))}
                        <option value="custom">✏️ + Своя цанга...</option>
                      </select>
                      {wizardParams.shankDia === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customShankDia || ''} 
                          onChange={e => setWizardParams({...wizardParams, customShankDia: e.target.value})} 
                          placeholder="напр. 6,35" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ДОВЖИНА L (мм)</label>
                      <select value={wizardParams.totalLength || '50'} onChange={e => setWizardParams({...wizardParams, totalLength: e.target.value})} style={inputStyle}>
                        {(refDicts.millTotalLengths || ['38', '45', '50', '55', '60', '75', '100']).map(v => (
                          <option key={v} value={v}>{v} мм</option>
                        ))}
                        <option value="custom">✏️ + Своя довжина...</option>
                      </select>
                      {wizardParams.totalLength === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customTotalLength || ''} 
                          onChange={e => setWizardParams({...wizardParams, customTotalLength: e.target.value})} 
                          placeholder="напр. 65" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>КУТ (°)</label>
                      <select value={wizardParams.angle || '90'} onChange={e => setWizardParams({...wizardParams, angle: e.target.value})} style={inputStyle}>
                        <option value="60">60°</option>
                        <option value="90">90°</option>
                        <option value="120">120°</option>
                        <option value="custom">✏️ + Свій кут...</option>
                      </select>
                      {wizardParams.angle === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customAngle || ''} 
                          onChange={e => setWizardParams({...wizardParams, customAngle: e.target.value})} 
                          placeholder="напр. 45" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>d (різ, мм)</label>
                      <select value={wizardParams.cutDia || '1,5'} onChange={e => setWizardParams({...wizardParams, cutDia: e.target.value})} style={inputStyle}>
                        {(refDicts.millCutDias || ['1', '1,2', '1,5', '2', '2,5', '3', '3,175', '4', '6', '8']).map(v => (
                          <option key={v} value={v}>{v} мм</option>
                        ))}
                        <option value="custom">✏️ + Свій d...</option>
                      </select>
                      {wizardParams.cutDia === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customCutDia || ''} 
                          onChange={e => setWizardParams({...wizardParams, customCutDia: e.target.value})} 
                          placeholder="напр. 1,8" 
                          style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>D (цанга, мм)</label>
                      <select value={wizardParams.shankDia || '3,175'} onChange={e => setWizardParams({...wizardParams, shankDia: e.target.value})} style={inputStyle}>
                        {(refDicts.millShankDias || ['3,175', '4', '6', '8', '10', '12']).map(v => (
                          <option key={v} value={v}>{v} мм</option>
                        ))}
                        <option value="custom">✏️ + Своя D...</option>
                      </select>
                      {wizardParams.shankDia === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customShankDia || ''} 
                          onChange={e => setWizardParams({...wizardParams, customShankDia: e.target.value})} 
                          placeholder="напр. 6,35" 
                          style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>l (різ, мм)</label>
                      <select value={wizardParams.cutLength || '8'} onChange={e => setWizardParams({...wizardParams, cutLength: e.target.value})} style={inputStyle}>
                        {(refDicts.millCutLengths || ['4', '6', '8', '12', '15', '17', '22', '25', '32']).map(v => (
                          <option key={v} value={v}>{v} мм</option>
                        ))}
                        <option value="custom">✏️ + Своє l...</option>
                      </select>
                      {wizardParams.cutLength === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customCutLength || ''} 
                          onChange={e => setWizardParams({...wizardParams, customCutLength: e.target.value})} 
                          placeholder="напр. 10" 
                          style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>L (заг, мм)</label>
                      <select value={wizardParams.totalLength || '38'} onChange={e => setWizardParams({...wizardParams, totalLength: e.target.value})} style={inputStyle}>
                        {(refDicts.millTotalLengths || ['38', '45', '50', '55', '60', '75', '100']).map(v => (
                          <option key={v} value={v}>{v} мм</option>
                        ))}
                        <option value="custom">✏️ + Своє L...</option>
                      </select>
                      {wizardParams.totalLength === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customTotalLength || ''} 
                          onChange={e => setWizardParams({...wizardParams, customTotalLength: e.target.value})} 
                          placeholder="напр. 40" 
                          style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>
                  </div>
                )}

              </>
            )}

            {/* CARBON SHEETS */}
            {wizardRuleType === 'carbon' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>МАРКА СИРОВИНИ</label>
                    <select value={wizardParams.grade || 'Т300'} onChange={e => setWizardParams({...wizardParams, grade: e.target.value})} style={inputStyle}>
                      {(refDicts.grades || ['Т300', 'Т700']).map(g => (
                        <option key={g} value={g}>Карбон {g}</option>
                      ))}
                      <option value="custom">✏️ + Власна марка...</option>
                    </select>
                    {wizardParams.grade === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customGrade || ''} 
                        onChange={e => setWizardParams({...wizardParams, customGrade: e.target.value})} 
                        placeholder="напр. Т1000" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ФОРМАТ (мм)</label>
                    <select value={wizardParams.dimensions || '500*600'} onChange={e => setWizardParams({...wizardParams, dimensions: e.target.value})} style={inputStyle}>
                      <option value="500*600">500*600</option>
                      <option value="1000*600">1000*600</option>
                      <option value="500*500">500*500</option>
                      <option value="custom">✏️ + Свій формат...</option>
                    </select>
                    {wizardParams.dimensions === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customDimensions || ''} 
                        onChange={e => setWizardParams({...wizardParams, customDimensions: e.target.value})} 
                        placeholder="напр. 400*500" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ТОВЩИНА (мм)</label>
                    <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                      {(refDicts.thicknesses || ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']).map(t => (
                        <option key={t} value={t}>{t} мм</option>
                      ))}
                      <option value="custom">✏️ + Власна товщина...</option>
                    </select>
                    {wizardParams.thickness === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customThickness || ''} 
                        onChange={e => setWizardParams({...wizardParams, customThickness: e.target.value})} 
                        placeholder="напр. 3,5" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СПЕЦ. ПОЗНАЧКА</label>
                    <select value={wizardParams.extra || ''} onChange={e => setWizardParams({...wizardParams, extra: e.target.value})} style={inputStyle}>
                      <option value="">— Немає</option>
                      {(refDicts.extras || ['(преференція)', '(0/45/90)']).map(ex => (
                        <option key={ex} value={ex}>{ex}</option>
                      ))}
                      <option value="custom">✏️ + Своя позначка...</option>
                    </select>
                    {wizardParams.extra === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customExtra || ''} 
                        onChange={e => setWizardParams({...wizardParams, customExtra: e.target.value})} 
                        placeholder="напр. (спеціальне)" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* FULL FRAME & KITS */}
            {(wizardRuleType === 'full_frame' || wizardRuleType === 'element_kit') && (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, margin: 0 }}>ПОЧАТОК НАЗВИ / ТИП ВИРОБУ</label>
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
                    <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', padding: '10px 12px', marginTop: '4px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 900, marginBottom: '6px' }}>ВИДАЛЕННЯ ЗІ СПИСКУ (АДМІН/КЕРІВНИК):</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {prefixList.map(item => (
                          <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text, #0f172a)' }}>
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() => removePrefixItem(item)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}
                              title="Видалити зі списку"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <select 
                    value={wizardParams.prefixChoice || (wizardRuleType === 'element_kit' ? 'Комплект карбонових елементів' : 'Комплект карбонової рами')} 
                    onChange={e => setWizardParams({...wizardParams, prefixChoice: e.target.value})} 
                    style={inputStyle}
                  >
                    {prefixList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="custom">✏️ + Свій варіант...</option>
                  </select>
                  {wizardParams.prefixChoice === 'custom' && (
                    <input 
                      type="text" 
                      value={wizardParams.customPrefix || ''} 
                      onChange={e => setWizardParams({...wizardParams, customPrefix: e.target.value})} 
                      placeholder="напр. Набір карбонових деталей" 
                      style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ТИП ПРОЄКТУ</label>
                    <select value={wizardParams.projType || 'SERIAL'} onChange={e => setWizardParams({...wizardParams, projType: e.target.value})} style={inputStyle}>
                      <option value="SERIAL">Серійний виріб (без дужок / без тегу)</option>
                      <option value="RND">Серія RND</option>
                      <option value="IP">Індивідуальний проєкт (ІП)</option>
                      <option value="CUSTOM">✏️ + Свій тип проєкту...</option>
                    </select>
                    {wizardParams.projType === 'CUSTOM' && (
                      <input 
                        type="text" 
                        value={wizardParams.customProjType || ''} 
                        onChange={e => setWizardParams({...wizardParams, customProjType: e.target.value})} 
                        placeholder="напр. Спецпроєкт" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>НОМЕР ПРОЄКТУ</label>
                    <input type="text" value={wizardParams.projNum || ''} onChange={e => setWizardParams({...wizardParams, projNum: e.target.value})} placeholder="напр. 52 або 176" style={inputStyle} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, margin: 0 }}>ТИП СЕРІЇ</label>
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
                    <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', padding: '10px 12px', marginTop: '4px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 900, marginBottom: '6px' }}>ВИДАЛЕННЯ ЗІ СПИСКУ (АДМІН/КЕРІВНИК):</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {seriesList.map(item => (
                          <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text, #0f172a)' }}>
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() => removeSeriesItem(item)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}
                              title="Видалити зі списку"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <select value={wizardParams.seriesType || ''} onChange={e => setWizardParams({...wizardParams, seriesType: e.target.value})} style={inputStyle}>
                    <option value="">— Не вказано (без серії)</option>
                    {seriesList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="custom">✏️ + Своя серія (ввести свою)...</option>
                  </select>
                  {wizardParams.seriesType === 'custom' && (
                    <input 
                      type="text" 
                      value={wizardParams.customSeries || ''} 
                      onChange={e => setWizardParams({...wizardParams, customSeries: e.target.value})} 
                      placeholder="напр. Серія Марун" 
                      style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                    />
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>НАЗВА МОДЕЛІ / МОДИФІКАЦІЯ</label>
                  <input type="text" value={wizardParams.name || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value})} placeholder="напр. Drozd Interceptor" style={inputStyle} />
                </div>
              </>
            )}

            {/* FRAME PART (ДЕТАЛІ ЛАЗЕР) */}
            {wizardRuleType === 'frame_part' && (
              <>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>НАЗВА ДЕТАЛІ</label>
                  <input type="text" value={wizardParams.name || wizardParams.customName || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value, customName: e.target.value})} placeholder="напр. KR-10(218)-П-7-60" style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>МАРКА СИРОВИНИ</label>
                    <select 
                      value={wizardParams.sheetGrade || 'Т300'} 
                      onChange={e => {
                        const grade = e.target.value;
                        const thick = wizardParams.sheetThickness || '3';
                        const gLabel = grade === 'custom' ? (wizardParams.customGrade || 'Т300') : grade;
                        const tLabel = thick === 'custom' ? (wizardParams.customThickness || '3') : thick;
                        const raw = `Лист ${gLabel} (${tLabel}мм)`;
                        setWizardParams({...wizardParams, sheetGrade: grade, rawSheet: raw});
                      }} 
                      style={inputStyle}
                    >
                      {(refDicts.grades || ['Т300', 'Т700']).map(g => (
                        <option key={g} value={g}>Карбон {g}</option>
                      ))}
                      <option value="custom">✏️ + Власна марка...</option>
                    </select>
                    {wizardParams.sheetGrade === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customGrade || ''} 
                        onChange={e => setWizardParams({...wizardParams, customGrade: e.target.value})} 
                        placeholder="напр. Т1000" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ТОВЩИНА (мм)</label>
                    <select 
                      value={wizardParams.sheetThickness || '3'} 
                      onChange={e => {
                        const thick = e.target.value;
                        const grade = wizardParams.sheetGrade || 'Т300';
                        const gLabel = grade === 'custom' ? (wizardParams.customGrade || 'Т300') : grade;
                        const tLabel = thick === 'custom' ? (wizardParams.customThickness || '3') : thick;
                        const raw = `Лист ${gLabel} (${tLabel}мм)`;
                        setWizardParams({...wizardParams, sheetThickness: thick, rawSheet: raw});
                      }} 
                      style={inputStyle}
                    >
                      {(refDicts.thicknesses || ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '10']).map(t => (
                        <option key={t} value={t}>{t} мм</option>
                      ))}
                      <option value="custom">✏️ + Власна товщина...</option>
                    </select>
                    {wizardParams.sheetThickness === 'custom' && (
                      <input 
                        type="text" 
                        value={wizardParams.customThickness || ''} 
                        onChange={e => setWizardParams({...wizardParams, customThickness: e.target.value})} 
                        placeholder="напр. 3,5" 
                        style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>НОРМА (шт/л)</label>
                    <input type="number" value={wizardParams.unitsPerSheet || 1} onChange={e => setWizardParams({...wizardParams, unitsPerSheet: Number(e.target.value) || 1})} placeholder="60" style={inputStyle} />
                  </div>
                </div>

                {/* LOAD TIMINGS SECTION */}
                <div style={{ background: 'rgba(255,144,0,0.06)', border: '1px solid rgba(255,144,0,0.25)', borderRadius: '16px', padding: '16px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#ff9000" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                      const val = wizardParams.loadTimings?.[sheets] ?? '';
                      return (
                        <div key={sheets} style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '10px 12px' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{sheets} {sheets === '2' || sheets === '4' || sheets === '32' || sheets === '64' ? 'листи' : 'листів'}:</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)' }}>хв</span>
                          </div>
                          <input 
                            type="number"
                            step="0.1"
                            min="0"
                            value={val}
                            onChange={e => {
                              const updatedVal = e.target.value;
                              setWizardParams(prev => ({
                                ...prev,
                                loadTimings: {
                                  ...(prev.loadTimings || DEFAULT_LOAD_TIMINGS),
                                  [sheets]: updatedVal
                                }
                              }));
                            }}
                            placeholder="напр. 15"
                            style={{ 
                              width: '100%', 
                              background: 'var(--input-bg, #f8fafc)', 
                              border: '1px solid var(--border-color, #cbd5e1)', 
                              borderRadius: '8px', 
                              padding: '8px 10px', 
                              color: 'var(--text, #0f172a)', 
                              fontSize: '0.88rem', 
                              fontWeight: 800,
                              boxSizing: 'border-box',
                              outline: 'none'
                            }} 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* GENERIC / CUSTOM */}
            {wizardRuleType === 'generic' && (
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ПОВНА НАЗВА ПОЗИЦІЇ</label>
                <input type="text" value={wizardParams.customName} onChange={e => setWizardParams({...wizardParams, customName: e.target.value})} placeholder="Введіть стандартизовану назву..." style={inputStyle} />
              </div>
            )}

            {/* Unit selector */}
            <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '15px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ОДИНИЦЯ ВИМІРУ</label>
              <select value={wizardParams.unit} onChange={e => setWizardParams({...wizardParams, unit: e.target.value})} style={inputStyle}>
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
            disabled={isDuplicate || !generatedName}
            style={{ 
              background: isDuplicate || !generatedName ? 'var(--border-color, #cbd5e1)' : '#ff9000', 
              color: isDuplicate || !generatedName ? 'var(--text-muted, #64748b)' : '#ffffff', 
              border: 'none', 
              borderRadius: '14px', 
              padding: '16px', 
              fontWeight: 900, 
              fontSize: '0.95rem', 
              cursor: isDuplicate || !generatedName ? 'not-allowed' : 'pointer',
              boxShadow: isDuplicate || !generatedName ? 'none' : '0 5px 20px rgba(255,144,0,0.3)',
              transition: 'all 0.2s'
            }}
          >
            {editingItem ? 'ЗБЕРЕГТИ ЗМІНИ ПОЗИЦІЇ' : 'ЗБЕРЕГТИ ДО V2 КАТАЛОГУ'}
          </button>
        </form>
      </div>
    </div>
  )
}
