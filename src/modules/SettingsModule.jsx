import React, { useState, useMemo } from 'react'
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
  FileCode,
  Users as UsersIcon,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const SettingsModule = () => {
  const { 
    nomenclatures, upsertNomenclature, deleteNomenclature, 
    bomItems, saveBOM, removeBOM,
    systemUsers, currentUser, upsertUser, deleteUser, logout
  } = useMES()

  // Tabs: users, add_nom, bom, list_nom
  const [activeTab, setActiveTab] = useState('users') 
  const { 
    fortnetUrl, updateFortnetUrl, accessLogs
  } = useMES()
  const [tempFortnetUrl, setTempFortnetUrl] = useState(fortnetUrl)
  
  // User Form State
  const [userForm, setUserForm] = useState({
    id: null,
    login: '',
    password: '',
    first_name: '',
    last_name: '',
    position: 'Оператор',
    department: 'Цех №1',
    shift: 'Зміна 1',
    access_rights: {
      manager: false, master: false, warehouse: false, engineer: false, 
      director: false, foreman: false, operator: true, shipping: false, 
      supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, packaging: false, kanban: false
    }
  })
  const [userSearch, setUserSearch] = useState('')

  // Nom Form State
  const [newNom, setNewNom] = useState({ name: '', units_per_sheet: '', time_per_unit: '', material_type: '', cnc_program: '' })
  const [selectedParent, setSelectedParent] = useState('')
  const [bomPart, setBomPart] = useState({ child_id: '', qty: 1 })
  const [searchTerm, setSearchTerm] = useState('')

  const handleSaveNom = (e) => {
    e.preventDefault()
    if (!newNom.name) return
    apiService.submitNomenclature(newNom, upsertNomenclature)
    setNewNom({ name: '', units_per_sheet: '', time_per_unit: '', material_type: '', cnc_program: '' })
  }

  const handleAddBOM = (e) => {
    e.preventDefault()
    if (!selectedParent || !bomPart.child_id) return
    saveBOM(selectedParent, bomPart.child_id, bomPart.qty)
    setBomPart({ ...bomPart, child_id: '' })
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!userForm.login || !userForm.password) return
    
    // Single point of sync via upsertUser (which calls apiService.submitUserAction)
    await upsertUser(userForm)
    
    setUserForm({
      id: null, login: '', password: '', first_name: '', last_name: '', 
      position: 'Оператор', department: 'Цех №1', shift: 'Зміна 1',
      access_rights: { manager: false, master: false, warehouse: false, engineer: false, director: false, foreman: false, operator: true, shipping: false, supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, kanban: false }
    })
  }

  const editUser = (user) => {
    setUserForm({ ...user, access_rights: user.access_rights || {} })
    setActiveTab('users')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleRight = (key) => {
    setUserForm(prev => ({
      ...prev,
      access_rights: {
        ...prev.access_rights,
        [key]: !prev.access_rights[key]
      }
    }))
  }

  const filteredNoms = nomenclatures.filter(n => 
    n.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (n.material_type && n.material_type.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredUsers = systemUsers.filter(u => 
    u.login.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.first_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.last_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.position.toLowerCase().includes(userSearch.toLowerCase())
  )

  const moduleList = [
    { id: 'kanban', label: 'Задачі (Внутрішні)' },
    { id: 'manager', label: 'Менеджер' },
    { id: 'master', label: 'Мастер (Цех)' },
    { id: 'warehouse', label: 'Склад Оперативний' },
    { id: 'engineer', label: 'Інженер' },
    { id: 'director', label: 'Директор' },
    { id: 'foreman', label: 'Майстер дільниці' },
    { id: 'operator', label: 'Термінал оператора' },
    { id: 'shop1', label: 'Цех №1 (Розкрій→Прийомка)' },
    { id: 'packaging', label: 'Пакування' },
    { id: 'shipping', label: 'Логістика' },
    { id: 'supply', label: 'Склад Виробництва' },
    { id: 'procurement', label: 'Постачання (Закупівля)' },
    { id: 'shop2', label: 'Цех №2 (Черга)' },
    { id: 'nomenclature', label: 'База номенклатур (Old)' },
    { id: 'nomenclature_v2', label: 'Номенклатура (Нова)' },
    { id: 'machines', label: 'Налаштування станків' },
    { id: 'access', label: 'Система Доступу' },
    { id: 'settings', label: 'Система (Адмін)' }
  ]

  const isAdmin = currentUser?.position === 'Адмін'

  return (
    <div className="settings-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '0 20px', 
        height: '70px', 
        background: '#000', 
        borderBottom: '1px solid #222',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck className="text-secondary" size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Панель Адміністратора</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1 }} className="hide-mobile">
            <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase' }}>{currentUser?.position}</div>
          </div>
          <button onClick={logout} style={{ background: '#111', border: '1px solid #222', color: '#ef4444', padding: '8px 15px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>ВИЙТИ</button>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        
        {/* Navigation Tabs */}
        <div className="settings-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '16px', marginBottom: '25px', gap: '5px', maxWidth: '800px' }}>
           {isAdmin && <button onClick={() => setActiveTab('users')} className={`tab-btn-v2 ${activeTab === 'users' ? 'active' : ''}`}><UsersIcon size={16} /> КОРИСТУВАЧІ</button>}
           <button onClick={() => setActiveTab('add_nom')} className={`tab-btn-v2 ${activeTab === 'add_nom' ? 'active' : ''}`}><Plus size={16} /> НОВА НОМЕНКЛАТУРА</button>
           <button onClick={() => setActiveTab('bom')} className={`tab-btn-v2 ${activeTab === 'bom' ? 'active' : ''}`}><Layers size={16} /> СПЕЦИФІКАЦІЇ (BOM)</button>
           <button onClick={() => setActiveTab('list_nom')} className={`tab-btn-v2 ${activeTab === 'list_nom' ? 'active' : ''}`}><BarChart3 size={16} /> РЕЄСТР</button>
           {isAdmin && <button onClick={() => setActiveTab('system')} className={`tab-btn-v2 ${activeTab === 'system' ? 'active' : ''}`}><Cpu size={16} /> СИСТЕМА</button>}
        </div>

        {activeTab === 'users' && isAdmin && (
          <div className="admin-users-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 400px) 1fr', gap: '30px' }}>
            <section className="glass-panel" style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                {userForm.id ? 'РЕДАГУВАТИ КОРИСТУВАЧА' : 'НОВИЙ ПРАЦІВНИК'}
              </h3>
              <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label className="form-label">ЛОГІН</label>
                    <input style={inputStyle} value={userForm.login} onChange={e => setUserForm({...userForm, login: e.target.value})} placeholder="ivanov_p" required />
                  </div>
                  <div>
                    <label className="form-label">ПАРОЛЬ</label>
                    <input type="text" style={inputStyle} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="pass123" required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label className="form-label">ІМ'Я</label>
                    <input style={inputStyle} value={userForm.first_name} onChange={e => setUserForm({...userForm, first_name: e.target.value})} placeholder="Петро" />
                  </div>
                  <div>
                    <label className="form-label">ПРІЗВИЩЕ</label>
                    <input style={inputStyle} value={userForm.last_name} onChange={e => setUserForm({...userForm, last_name: e.target.value})} placeholder="Іванов" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label className="form-label">ЦЕХ / ВІДДІЛ</label>
                    <select style={inputStyle} value={userForm.department} onChange={e => setUserForm({...userForm, department: e.target.value})}>
                      <option value="Цех №1">Цех №1</option>
                      <option value="Цех №2">Цех №2</option>
                      <option value="Склад">Склад</option>
                      <option value="Керівництво">Керівництво</option>
                      <option value="Контроль браку">Контроль браку</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">ЗМІНА</label>
                    <select style={inputStyle} value={userForm.shift} onChange={e => setUserForm({...userForm, shift: e.target.value})}>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">ПОСАДА / РОЛЬ</label>
                  <select style={inputStyle} value={userForm.position} onChange={e => setUserForm({...userForm, position: e.target.value})}>
                    <option value="Директор виробництва">Директор виробництва</option>
                    <option value="Начальник цеху">Начальник цеху</option>
                    <option value="Майстер цеху">Майстер цеху</option>
                    <option value="Оператор">Оператор</option>
                    <option value="Галтовщик">Галтовщик (Ц-1)</option>
                    <option value="Працівник складу">Працівник складу</option>
                    <option value="Контроль браку">Контроль браку</option>
                    <option value="Менеджер">Менеджер</option>
                    <option value="Інженер">Інженер</option>
                    <option value="Адмін">Адмін</option>
                  </select>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label className="form-label" style={{ marginBottom: '15px', color: '#ff9000' }}>ПРАВА ДОСТУПУ (МОДУЛІ):</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {moduleList.map(mod => (
                      <div key={mod.id} 
                        onClick={() => toggleRight(mod.id)}
                        style={{ 
                          padding: '10px', 
                          background: userForm.access_rights[mod.id] ? 'rgba(255,144,0,0.1)' : '#000', 
                          border: userForm.access_rights[mod.id] ? '1px solid #ff9000' : '1px solid #1a1a1a',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          transition: '0.2s'
                        }}
                      >
                        {userForm.access_rights[mod.id] ? <CheckCircle2 size={16} color="#ff9000" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #222' }}></div>}
                        <span style={{ color: userForm.access_rights[mod.id] ? '#fff' : '#444', fontWeight: userForm.access_rights[mod.id] ? 700 : 500 }}>{mod.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" style={{ 
                  background: '#ff9000', 
                  color: '#000', 
                  border: 'none', 
                  padding: '15px', 
                  borderRadius: '12px', 
                  fontWeight: 950, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '10px', 
                  fontSize: '0.9rem',
                  marginTop: '10px'
                }}>
                  <Save size={20} /> {userForm.id ? 'ОНОВИТИ ДАНІ' : 'СТВОРИТИ КОРИСТУВАЧА'}
                </button>
                {userForm.id && (
                  <button type="button" onClick={() => setUserForm({ id: null, login: '', password: '', first_name: '', last_name: '', position: 'Оператор', department: 'Цех №1', shift: 'Зміна 1', access_rights: {} })} style={{ background: '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>СКАСУВАТИ</button>
                )}
              </form>
            </section>

            <section className="registry-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}><UsersIcon size={18} /> РЕЄСТР КОРИСТУВАЧІВ ({systemUsers.length})</h3>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
                  <input style={{ background: '#000', border: '1px solid #222', borderRadius: '10px', padding: '8px 10px 8px 35px', color: '#fff', fontSize: '0.8rem', width: '200px' }} placeholder="Пошук..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                </div>
              </div>
              <div className="table-responsive-container" style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #222', color: '#444', background: '#000' }}>
                      <th style={{ padding: '15px' }}>ПРАЦІВНИК</th>
                      <th style={{ padding: '15px' }}>ЦЕХ / ЗМІНА</th>
                      <th style={{ padding: '15px' }}>РОЛЬ</th>
                      <th style={{ padding: '15px' }}>ДОСТУП</th>
                      <th style={{ padding: '15px', textAlign: 'right' }}>ДІЯ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '15px' }}>
                          <div style={{ fontWeight: 800 }}>{u.first_name} {u.last_name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#444' }}>ID: {u.id}</div>
                        </td>
                        <td style={{ padding: '15px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff9000' }}>{u.department || '—'}</div>
                          <div style={{ fontSize: '0.7rem', color: '#555' }}>{u.shift || '—'}</div>
                        </td>
                        <td style={{ padding: '15px' }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '4px 10px', 
                            background: u.position === 'Адмін' ? '#ff9000' : '#1a1a1a', 
                            color: u.position === 'Адмін' ? '#000' : '#888',
                            borderRadius: '20px',
                            fontWeight: 900
                          }}>{u.position}</span>
                        </td>
                        <td style={{ padding: '15px' }}>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                            {Object.entries(u.access_rights || {}).filter(([k,v]) => v === true).map(([k]) => (
                               <div key={k} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff9000' }} title={k}></div>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                             <button onClick={() => editUser(u)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><FileCode size={16} /></button>
                             <button onClick={() => window.confirm(`Видалити?`) && deleteUser(u.id)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'add_nom' && (
          <section className="settings-panel glass-panel" style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222', maxWidth: '600px' }}>
             <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}><Plus size={20} /> НОВА ПОЗИЦІЯ НОМЕНКЛАТУРИ</h3>
             <form onSubmit={handleSaveNom} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                   <label className="form-label">НАЗВА ДЕТАЛІ / ВИРОБУ</label>
                   <input style={inputStyle} value={newNom.name} onChange={e => setNewNom({...newNom, name: e.target.value})} placeholder="напр. КРОНШТЕЙН K-10" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                   <div>
                      <label className="form-label">МЕТАЛ / ТОВЩИНА (ДЛЯ RAW)</label>
                      <input style={inputStyle} value={newNom.material_type} onChange={e => setNewNom({...newNom, material_type: e.target.value})} placeholder="напр. S355 4мм" />
                   </div>
                   <div>
                      <label className="form-label">ПРОГРАМА ЧПК</label>
                      <input style={inputStyle} value={newNom.cnc_program} onChange={e => setNewNom({...newNom, cnc_program: e.target.value})} placeholder="cut_file.dxf" />
                   </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                   <div>
                      <label className="form-label">ДЕТАЛЕЙ НА ЛИСТ</label>
                      <input type="number" style={inputStyle} value={newNom.units_per_sheet} onChange={e => setNewNom({...newNom, units_per_sheet: e.target.value})} />
                   </div>
                   <div>
                      <label className="form-label">ЧАС НА ОДИН. (хв)</label>
                      <input type="number" style={inputStyle} value={newNom.time_per_unit} onChange={e => setNewNom({...newNom, time_per_unit: e.target.value})} />
                   </div>
                </div>
                <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem' }}>
                   <Save size={20} /> ЗБЕРЕГТИ НОМЕНКЛАТУРУ
                </button>
             </form>
          </section>
        )}

        {activeTab === 'bom' && (
          <section className="settings-panel glass-panel" style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222', maxWidth: '700px' }}>
             <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}><Layers size={20} /> РЕДАКТОР СПЕЦИФІКАЦІЙ (BOM)</h3>
             <div style={{ marginBottom: '25px' }}>
                <label className="form-label">Оберіть Готовий Виріб</label>
                <select style={inputStyle} value={selectedParent} onChange={e => setSelectedParent(e.target.value)}>
                   <option value="">Пошук виробу для редагування...</option>
                   {nomenclatures.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
             </div>
             {selectedParent && (
                <div style={{ animation: 'fadeIn 0.3s forwards' }}>
                   <label className="form-label">Додати деталь у склад виробу:</label>
                   <form onSubmit={handleAddBOM} style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: '10px', marginBottom: '20px' }}>
                      <select style={inputStyle} value={bomPart.child_id} onChange={e => setBomPart({...bomPart, child_id: e.target.value})}>
                         <option value="">Оберіть деталь...</option>
                         {nomenclatures.filter(n => n.id !== selectedParent).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                      <input type="number" style={inputStyle} value={bomPart.qty} onChange={e => setBomPart({...bomPart, qty: e.target.value})} min="1" />
                      <button type="submit" style={{ background: '#222', color: '#ff9000', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 900 }}><Plus size={20} /></button>
                   </form>
                   <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '18px', border: '1px solid #1a1a1a' }}>
                      <h4 style={{ fontSize: '0.65rem', color: '#444', textTransform: 'uppercase', marginBottom: '15px' }}>Поточний склад виробу:</h4>
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

        {activeTab === 'list_nom' && (
          <section className="registry-area">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}><BarChart3 size={18} /> ГЛОБАЛЬНИЙ РЕЄСТР НОМЕНКЛАТУРИ</h3>
                <div style={{ position: 'relative' }}>
                   <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
                   <input style={{ background: '#000', border: '1px solid #222', borderRadius: '10px', padding: '8px 10px 8px 35px', color: '#fff', fontSize: '0.8rem', width: '200px' }} placeholder="Пошук..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
             </div>
             <div className="table-responsive-container" style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                   <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #222', color: '#444', background: '#000' }}>
                         <th style={{ padding: '15px' }}>НАЗВА</th>
                         <th style={{ padding: '15px' }}>МАТЕРІАЛ</th>
                         <th style={{ padding: '15px' }}>ПРОГРАМА</th>
                         <th style={{ padding: '15px' }}>ШТ/ЛИСТ</th>
                         <th style={{ padding: '15px' }}>НОРМА ЧАСУ</th>
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
          </section>
        )}

        {activeTab === 'system' && isAdmin && (
          <section className="settings-panel glass-panel" style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222', maxWidth: '600px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
              <Cpu size={20} /> КОНФІГУРАЦІЯ СИСТЕМИ
            </h3>
            
            <div style={{ marginBottom: '30px' }}>
              <label className="form-label">АДРЕСА СЕРВЕРА FORTNET (API)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  style={inputStyle} 
                  value={tempFortnetUrl} 
                  onChange={e => setTempFortnetUrl(e.target.value)} 
                  placeholder="http://192.168.1.100:8090" 
                />
                <button 
                  onClick={() => {
                    updateFortnetUrl(tempFortnetUrl)
                    alert('Адресу оновлено!')
                  }}
                  style={{ 
                    background: '#ff9000', 
                    color: '#000', 
                    border: 'none', 
                    padding: '0 20px', 
                    borderRadius: '12px', 
                    fontWeight: 950, 
                    cursor: 'pointer' 
                  }}
                >
                  ЗБЕРЕГТИ
                </button>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#444', marginTop: '10px' }}>
                Ця адреса використовується для синхронізації подій проходу працівників через картки.
              </p>
            </div>

            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#333', marginBottom: '15px' }}>СТАТУС СИНХРОНІЗАЦІЇ</h4>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                Останніх подій у базі: <strong style={{ color: '#fff' }}>{accessLogs.length}</strong>
              </div>
            </div>
          </section>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .form-label { display: block; font-size: 0.65rem; color: #555; text-transform: uppercase; margin-bottom: 8px; font-weight: 900; letter-spacing: 0.05em; }
        .tab-btn-v2 { padding: 10px 15px; border: none; background: transparent; color: #555; font-weight: 950; font-size: 0.72rem; border-radius: 12px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px; }
        .tab-btn-v2.active { background: #222; color: #ff9000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .tab-btn-v2:hover:not(.active) { color: #fff; background: rgba(255,255,255,0.05); }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
      `}} />
    </div>
  )
}

const inputStyle = { width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px 15px', borderRadius: '12px', fontSize: '0.9rem', outline: 'none' }

export default SettingsModule
