import React from 'react'
import { Building, Briefcase, Plus, Edit3, Save, Layers, Trash2 } from 'lucide-react'

export function SettingsStructureTab(props) {
  const {
    structureSubTab,
    setStructureSubTab,
    structureForm,
    setStructureForm,
    handleSaveStructure,
    editStructure,
    handleDeleteStructure,
    companyStructure,
    positionForm,
    setPositionForm,
    handleSavePosition,
    editPosition,
    handleDeletePosition,
    companyPositions,
    getStructureTypeIcon,
    typeLabels
  } = props

  const inputStyle = { width: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
        <button 
          onClick={() => setStructureSubTab('departments')}
          style={{
            background: structureSubTab === 'departments' ? 'rgba(255,144,0,0.08)' : 'transparent',
            color: structureSubTab === 'departments' ? '#ff9000' : '#888',
            border: structureSubTab === 'departments' ? '1px solid rgba(255,144,0,0.15)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: 'pointer',
            transition: '0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Building size={14} /> ПІДРОЗДІЛИ ТА ЦЕХИ
        </button>
        <button 
          onClick={() => setStructureSubTab('positions')}
          style={{
            background: structureSubTab === 'positions' ? 'rgba(255,144,0,0.08)' : 'transparent',
            color: structureSubTab === 'positions' ? '#ff9000' : '#888',
            border: structureSubTab === 'positions' ? '1px solid rgba(255,144,0,0.15)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: 'pointer',
            transition: '0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Briefcase size={14} /> ШТАТНІ ПОСАДИ
        </button>
      </div>

      {structureSubTab === 'departments' ? (
        <div className="admin-structure-layout" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', alignItems: 'start', animation: 'fadeIn 0.2s ease' }}>
          
          {/* Left: Add Structure Node Form */}
          <section className="glass-panel" style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
              {structureForm.id ? <Edit3 size={18} /> : <Plus size={18} />} {structureForm.id ? 'РЕДАГУВАТИ ПІДРОЗДІЛ' : 'ДОДАТИ ПІДРОЗДІЛ СТРУКТУРИ'}
            </h3>
            
            <form onSubmit={handleSaveStructure} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label className="form-label">НАЗВА ЦЕХУ / СКЛАДУ / ВІДДІЛУ</label>
                <input 
                  style={inputStyle} 
                  value={structureForm.name} 
                  onChange={e => setStructureForm({...structureForm, name: e.target.value})} 
                  placeholder="напр. Цех №3, Склад готової продукції" 
                  required 
                />
              </div>
              
              <div>
                <label className="form-label">ТИП ДІЛЬНИЦІ / ПІДРОЗДІЛУ</label>
                <select 
                  style={inputStyle} 
                  value={structureForm.type} 
                  onChange={e => setStructureForm({...structureForm, type: e.target.value})}
                >
                  <option value="shop">Цех (Виробництво / Порізка)</option>
                  <option value="warehouse">Склад (Оперативний / Сировини / СГП)</option>
                  <option value="tumbling">Дільниця</option>
                  <option value="quality">ВКЯ (Контроль якості / Браку)</option>
                  <option value="management">Керівництво (Офіс / Майстри)</option>
                  <option value="other">Інше</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button type="submit" style={{ 
                  background: 'linear-gradient(135deg, #ff9000, #ff6a00)', 
                  color: '#000', 
                  border: 'none', 
                  padding: '14px', 
                  borderRadius: '12px', 
                  fontWeight: 900, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  fontSize: '0.9rem',
                  marginTop: '10px'
                }}>
                  {structureForm.id ? <Save size={18} /> : <Plus size={18} />} {structureForm.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ДОДАТИ В СТРУКТУРУ'}
                </button>
                {structureForm.id && (
                  <button type="button" 
                    onClick={() => setStructureForm({ id: null, name: '', type: 'shop' })} 
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                  >
                    СКАСУВАТИ
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Right: Structure Nodes List */}
          <section className="structure-list-area">
            <h3 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#ff9000" /> ПОТОЧНА СТРУКТУРА ПІДПРИЄМСТВА ({companyStructure.length})
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
              {(companyStructure || []).map(node => (
                <div key={node.id} style={{ 
                  background: '#0e0e11', 
                  border: '1px solid rgba(255,255,255,0.04)', 
                  borderRadius: '16px', 
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }} className="structure-node-card">
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                      {getStructureTypeIcon(node.type)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{node.name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#555', fontWeight: 600, marginTop: '2px' }}>{typeLabels[node.type] || node.type}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button 
                      onClick={() => editStructure(node)}
                      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                      title="Редагувати підрозділ"
                      className="edit-node-btn"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDeleteStructure(node.id, node.name)}
                      style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                      title="Видалити підрозділ"
                      className="delete-node-btn"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="admin-structure-layout" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', alignItems: 'start', animation: 'fadeIn 0.2s ease' }}>
          
          {/* Left: Add Position Form */}
          <section className="glass-panel" style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
              {positionForm.id ? <Edit3 size={18} /> : <Plus size={18} />} {positionForm.id ? 'РЕДАГУВАТИ ПОСАДУ' : 'СТВОРЕННЯ ШТАТНОЇ ПОСАДИ'}
            </h3>
            
            <form onSubmit={handleSavePosition} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label className="form-label">НАЗВА ПОСАДИ</label>
                <input 
                  style={inputStyle} 
                  value={positionForm.name} 
                  onChange={e => setPositionForm({ ...positionForm, name: e.target.value })} 
                  placeholder="напр. Наладчик, Оператор ЧПУ, Конструктор" 
                  required 
                />
              </div>

              <div>
                <label className="form-label">ПРИВ'ЯЗКА ДО ВІДДІЛУ / ЦЕХУ</label>
                <select 
                  style={inputStyle} 
                  value={positionForm.department_id || ''} 
                  onChange={e => setPositionForm({ ...positionForm, department_id: e.target.value })}
                >
                  <option value="">Всі відділи / без прив'язки</option>
                  {(companyStructure || []).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button type="submit" style={{ 
                  background: 'linear-gradient(135deg, #ff9000, #ff6a00)', 
                  color: '#000', 
                  border: 'none', 
                  padding: '14px', 
                  borderRadius: '12px', 
                  fontWeight: 900, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  fontSize: '0.9rem',
                  marginTop: '10px'
                }}>
                  {positionForm.id ? <Save size={18} /> : <Plus size={18} />} {positionForm.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ДОДАТИ ПОСАДУ'}
                </button>
                {positionForm.id && (
                  <button type="button" 
                    onClick={() => setPositionForm({ id: null, name: '', department_id: '' })} 
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                  >
                    СКАСУВАТИ
                  </button>
                )}
              </div>
            </form>
          </section>
          
          {/* Right: Positions List */}
          <section className="structure-list-area">
            <h3 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={18} color="#ff9000" /> ПОТОЧНІ ШТАТНІ ПОСАДИ ({companyPositions.length})
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
              {(companyPositions || []).map(pos => {
                const linkedDept = pos.department_id ? (companyStructure || []).find(d => d.id === pos.department_id) : null
                return (
                  <div key={pos.id} style={{ 
                    background: '#0e0e11', 
                    border: '1px solid rgba(255,255,255,0.04)', 
                    borderRadius: '16px', 
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }} className="structure-node-card">
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <Briefcase size={16} color="#ff9000" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{pos.name}</div>
                        {linkedDept && (
                          <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase' }}>
                            {linkedDept.name}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button 
                        onClick={() => editPosition(pos)}
                        style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                        title="Редагувати посаду"
                        className="edit-node-btn"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeletePosition(pos.id, pos.name)}
                        style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                        title="Видалити посаду"
                        className="delete-node-btn"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
