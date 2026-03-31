import React, { useState } from 'react'
import { 
  Settings as SettingsIcon, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Layers,
  Search,
  Cpu,
  BarChart3,
  X,
  FileCode
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const SettingsModule = () => {
  const { nomenclatures, upsertNomenclature, deleteNomenclature, bomItems, saveBOM, removeBOM } = useMES()
  const [activeTab, setActiveTab] = useState('add') // add, bom, list
  const [newNom, setNewNom] = useState({ name: '', units_per_sheet: '', time_per_unit: '', material_type: '', cnc_program: '' })
  const [selectedParent, setSelectedParent] = useState('')
  const [bomPart, setBomPart] = useState({ child_id: '', qty: 1 })
  const [searchTerm, setSearchTerm] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    if (!newNom.name) return
    upsertNomenclature({
      name: newNom.name,
      units_per_sheet: Number(newNom.units_per_sheet),
      time_per_unit: Number(newNom.time_per_unit),
      material_type: newNom.material_type,
      cnc_program: newNom.cnc_program
    })
    setNewNom({ name: '', units_per_sheet: '', time_per_unit: '', material_type: '', cnc_program: '' })
    alert('Номенклатуру збережено!')
  }

  const handleAddBOM = (e) => {
    e.preventDefault()
    if (!selectedParent || !bomPart.child_id) return
    saveBOM(selectedParent, bomPart.child_id, bomPart.qty)
    setBomPart({ ...bomPart, child_id: '' })
  }

  const filteredNoms = nomenclatures.filter(n => 
    n.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (n.material_type && n.material_type.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="settings-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <SettingsIcon className="text-secondary" size={24} />
          <h1 className="hide-mobile">Конструктор Номенклатури</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>НАЛАШТУВАННЯ</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        
        {/* Mobile Section Tabs */}
        <div className="mobile-only settings-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px' }}>
           <button onClick={() => setActiveTab('add')} className={`tab-btn-m ${activeTab === 'add' ? 'active' : ''}`}>НОВИЙ</button>
           <button onClick={() => setActiveTab('bom')} className={`tab-btn-m ${activeTab === 'bom' ? 'active' : ''}`}>BOM</button>
           <button onClick={() => setActiveTab('list')} className={`tab-btn-m ${activeTab === 'list' ? 'active' : ''}`}>РЕЄСТР</button>
        </div>

        <div className="settings-grid-layout" style={{ display: 'grid', gridTemplateColumns: activeTab === 'list' ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
           
           {/* FORM: ADD NOMENCLATURE */}
           {(activeTab === 'add' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="settings-panel glass-panel" style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}><Plus size={20} /> НОВА ПОЗИЦІЯ</h3>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div>
                      <label className="form-label">НАЗВА ДЕТАЛІ</label>
                      <input style={inputStyle} value={newNom.name} onChange={e => setNewNom({...newNom, name: e.target.value})} placeholder="напр. KHARAK 10.0" />
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                         <label className="form-label">МЕТАЛ / ТОВЩИНА</label>
                         <input style={inputStyle} value={newNom.material_type} onChange={e => setNewNom({...newNom, material_type: e.target.value})} placeholder="T300-3" />
                      </div>
                      <div>
                         <label className="form-label">ПРОГРАМА ЧПК</label>
                         <input style={inputStyle} value={newNom.cnc_program} onChange={e => setNewNom({...newNom, cnc_program: e.target.value})} placeholder="cut.dxf" />
                      </div>
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                         <label className="form-label">ДЕТАЛЕЙ НА ЛИСТ</label>
                         <input type="number" style={inputStyle} value={newNom.units_per_sheet} onChange={e => setNewNom({...newNom, units_per_sheet: e.target.value})} />
                      </div>
                      <div>
                         <label className="form-label">ЧАС НА ДЕТАЛЬ (хв)</label>
                         <input type="number" style={inputStyle} value={newNom.time_per_unit} onChange={e => setNewNom({...newNom, time_per_unit: e.target.value})} />
                      </div>
                   </div>
                   <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <Save size={20} /> ЗБЕРЕГТИ ПОЗИЦІЮ
                   </button>
                </form>
             </section>
           )}

           {/* BOM EDITOR */}
           {(activeTab === 'bom' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="settings-panel glass-panel" style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}><Layers size={20} /> РЕДАКТОР СПЕЦИФІКАЦІЙ</h3>
                
                <div style={{ marginBottom: '25px' }}>
                   <label className="form-label">Оберіть Готовий Виріб</label>
                   <select style={inputStyle} value={selectedParent} onChange={e => setSelectedParent(e.target.value)}>
                      <option value="">Пошук виробу...</option>
                      {nomenclatures.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                   </select>
                </div>

                {selectedParent && (
                   <div style={{ animation: 'fadeIn 0.3s forwards' }}>
                      <label className="form-label">Додати деталь у склад:</label>
                      <form onSubmit={handleAddBOM} style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: '10px', marginBottom: '20px' }}>
                         <select style={inputStyle} value={bomPart.child_id} onChange={e => setBomPart({...bomPart, child_id: e.target.value})}>
                            <option value="">Оберіть деталь...</option>
                            {nomenclatures.filter(n => n.id !== selectedParent).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                         </select>
                         <input type="number" style={inputStyle} value={bomPart.qty} onChange={e => setBomPart({...bomPart, qty: e.target.value})} min="1" />
                         <button type="submit" style={{ background: '#222', color: '#ff9000', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 900 }}><Plus size={20} /></button>
                      </form>

                      <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '18px', border: '1px solid #1a1a1a' }}>
                         <h4 style={{ fontSize: '0.65rem', color: '#444', textTransform: 'uppercase', marginBottom: '15px' }}>Склад виробу:</h4>
                         {bomItems.filter(b => b.parent_id === selectedParent).map(b => {
                            const child = nomenclatures.find(n => n.id === b.child_id)
                            return (
                               <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111' }}>
                                  <span style={{ fontSize: '0.85rem' }}>{child?.name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                     <strong style={{ color: '#ff9000' }}>{b.quantity_per_parent} шт</strong>
                                     <button onClick={() => removeBOM(b.id)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                  </div>
                               </div>
                            )
                         })}
                      </div>
                   </div>
                )}
             </section>
           )}

           {/* REGISTRY TABLE / CARDS */}
           {(activeTab === 'list' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="registry-area">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                   <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}><BarChart3 size={18} /> ГЛОБАЛЬНИЙ РЕЄСТР</h3>
                   <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
                      <input style={{ background: '#000', border: '1px solid #222', borderRadius: '10px', padding: '8px 10px 8px 35px', color: '#fff', fontSize: '0.8rem', width: '180px' }} placeholder="Пошук..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
                </div>

                <div className="table-responsive-container hide-mobile">
                   <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                         <tr style={{ textAlign: 'left', borderBottom: '1px solid #222', color: '#444' }}>
                            <th style={{ padding: '15px' }}>НАЗВА</th>
                            <th style={{ padding: '15px' }}>МАТЕРІАЛ</th>
                            <th style={{ padding: '15px' }}>ПРОГРАМА</th>
                            <th style={{ padding: '15px' }}>ШТ/ЛИСТ</th>
                            <th style={{ padding: '15px' }}>ЧАС</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>ДІЯ</th>
                         </tr>
                      </thead>
                      <tbody>
                         {filteredNoms.map(n => (
                           <tr key={n.id} style={{ borderBottom: '1px solid #111' }}>
                              <td style={{ padding: '15px', fontWeight: 800 }}>{n.name}</td>
                              <td style={{ padding: '15px', color: '#888' }}>{n.material_type || '—'}</td>
                              <td style={{ padding: '15px', color: '#3b82f6', fontFamily: 'monospace' }}>{n.cnc_program || '—'}</td>
                              <td style={{ padding: '15px' }}>{n.units_per_sheet}</td>
                              <td style={{ padding: '15px' }}>{n.time_per_unit} хв</td>
                              <td style={{ padding: '15px', textAlign: 'right' }}>
                                 <button onClick={() => window.confirm(`Видалити?`) && deleteNomenclature(n.id)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                <div className="mobile-only nom-cards-grid" style={{ display: 'grid', gap: '15px' }}>
                   {filteredNoms.map(n => (
                     <div key={n.id} style={{ background: '#111', padding: '20px', borderRadius: '24px', border: '1px solid #222' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                           <strong style={{ fontSize: '1.2rem' }}>{n.name}</strong>
                           <button onClick={() => deleteNomenclature(n.id)} style={{ background: 'transparent', border: 'none', color: '#444' }}><Trash2 size={18} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '15px' }}>
                           <div><label style={{ fontSize: '0.6rem', color: '#444' }}>МАТЕРІАЛ</label><div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{n.material_type || '—'}</div></div>
                           <div><label style={{ fontSize: '0.6rem', color: '#444' }}>ПРОГРАМА</label><div style={{ fontSize: '0.7rem', color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.cnc_program || '—'}</div></div>
                           <div><label style={{ fontSize: '0.6rem', color: '#444' }}>НОРМА</label><div style={{ fontSize: '0.8rem' }}>{n.units_per_sheet} шт/л</div></div>
                           <div><label style={{ fontSize: '0.6rem', color: '#444' }}>ЧАС</label><div style={{ fontSize: '0.8rem' }}>{n.time_per_unit} хв</div></div>
                        </div>
                     </div>
                   ))}
                </div>
             </section>
           )}

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .form-label { display: block; fontSize: 0.65rem; color: #555; textTransform: uppercase; marginBottom: 8px; fontWeight: 900; letterSpacing: 0.05em; }
        .tab-btn-m { flex: 1; padding: 12px; border: none; background: transparent; color: #444; font-weight: 900; font-size: 0.7rem; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .tab-btn-m.active { background: #222; color: #ff9000; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

const inputStyle = { width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px 15px', borderRadius: '12px', fontSize: '0.9rem' }

export default SettingsModule
