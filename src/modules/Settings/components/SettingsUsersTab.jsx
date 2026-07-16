import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Save, Search, X, Users as UsersIcon, ShieldCheck, CheckCircle2, UserPlus, Upload, Download, RefreshCw, Eye } from 'lucide-react'

export function SettingsUsersTab({
  systemUsers,
  currentUser,
  upsertUser,
  deleteUser,
  companyStructure,
  companyPositions,
  userForm,
  setUserForm,
  userSearch,
  setUserSearch,
  filterDepartment,
  setFilterDepartment,
  filterPosition,
  setFilterPosition,
  filterShift,
  setFilterShift,
  filterOnlyOnline,
  setFilterOnlyOnline,
  isImportModalOpen,
  setIsImportModalOpen,
  csvFile,
  setCsvFile,
  csvDelimiter,
  setCsvDelimiter,
  csvHeaders,
  setCsvHeaders,
  csvRows,
  setCsvRows,
  columnMapping,
  setColumnMapping,
  defaultValues,
  setDefaultValues,
  duplicatePolicy,
  setDuplicatePolicy,
  importStatus,
  setImportStatus,
  importLog,
  setImportLog,
  handleSaveUser,
  editUser,
  toggleRight,
  handleFileChange,
  handleDelimiterChange,
  executeImport,
  toggleDefaultRight,
  previewData,
  moduleList,
  formatLastSeen,
  renderUserAvatar,
  getRoleStyle,
  availableFilterPositions,
  availableFormPositions,
  filteredUsers,
  downloadTemplateExcel
}) {
  const inputStyle = { width: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
  const filterSelectStyle = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '6px 12px', color: '#ccc', fontSize: '0.72rem', fontWeight: 700, outline: 'none', cursor: 'pointer' }

  return (
    <div className="admin-users-layout" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '30px', alignItems: 'start' }}>
      {/* Left Column: Form Editor */}
      <section className="glass-panel" style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', position: 'sticky', top: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000', letterSpacing: '0.02em' }}>
          <UserPlus size={18} /> {userForm.id ? 'РЕДАГУВАННЯ ДОСЬЄ' : 'СТВОРИТИ НОВОГО ПРАЦІВНИКА'}
        </h3>
        
        <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>ЛОГІН (англ)</label>
              <input style={inputStyle} value={userForm.login} onChange={e => setUserForm({...userForm, login: e.target.value})} placeholder="ivanov_p" required />
            </div>
            <div>
              <label style={labelStyle}>ПАРОЛЬ</label>
              <input type="text" style={inputStyle} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={userForm.id ? "новий пароль (опціонально)..." : "пароль..."} required={!userForm.id} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>ІМ'Я</label>
              <input style={inputStyle} value={userForm.first_name} onChange={e => setUserForm({...userForm, first_name: e.target.value})} placeholder="Петро" />
            </div>
            <div>
              <label style={labelStyle}>ПРІЗВИЩЕ</label>
              <input style={inputStyle} value={userForm.last_name} onChange={e => setUserForm({...userForm, last_name: e.target.value})} placeholder="Іванов" />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>ЦЕХ / СКЛАД / ВІДДІЛ</label>
              <select style={inputStyle} value={userForm.department} onChange={e => {
                const deptName = e.target.value
                const deptNode = (companyStructure || []).find(d => d.name === deptName)
                const availableForNewDept = (companyPositions || []).filter(p => !p.department_id || (deptNode && p.department_id === deptNode.id))
                const isCurrentPosValid = availableForNewDept.some(p => p.name === userForm.position)
                setUserForm({
                  ...userForm,
                  department: deptName,
                  position: isCurrentPosValid ? userForm.position : (availableForNewDept[0]?.name || '')
                })
              }}>
                {(companyStructure || []).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>РОБОЧА ЗМІНА</label>
              <select style={inputStyle} value={userForm.shift || 'Без зміни'} onChange={e => setUserForm({...userForm, shift: e.target.value})}>
                <option value="Зміна 1">Зміна 1</option>
                <option value="Зміна 2">Зміна 2</option>
                <option value="Зміна 3">Зміна 3</option>
                <option value="Зміна 4">Зміна 4</option>
                <option value="Без зміни">Без зміни</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>ШТАТНА ПОСАДА / РОЛЬ</label>
            <select style={inputStyle} value={userForm.position} onChange={e => setUserForm({...userForm, position: e.target.value})}>
              {(availableFormPositions || []).map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '6px' }}>
            <label style={{ ...labelStyle, marginBottom: '12px', color: '#ff9000', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} /> ДОСТУПНІ МОДУЛІ В МЕС:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
              {moduleList.map(mod => (
                <div key={mod.id} 
                  onClick={() => toggleRight(mod.id)}
                  style={{ 
                    padding: '8px 10px', 
                    background: userForm.access_rights[mod.id] ? 'rgba(255,144,0,0.08)' : '#000', 
                    border: userForm.access_rights[mod.id] ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    transition: '0.15s'
                  }}
                  className="permission-item"
                >
                  {userForm.access_rights[mod.id] ? <CheckCircle2 size={14} color="#ff9000" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}></div>}
                  <span style={{ color: userForm.access_rights[mod.id] ? '#fff' : '#666', fontWeight: userForm.access_rights[mod.id] ? 700 : 500 }}>{mod.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
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
              transition: '0.2s',
              boxShadow: '0 4px 15px rgba(255,144,0,0.2)'
            }} className="primary-btn">
              <Save size={18} /> {userForm.id ? 'ОНОВИТИ КАРТКУ' : 'ЗБЕРЕГТИ ПРАЦІВНИКА'}
            </button>
            {userForm.id && (
              <button type="button" 
                onClick={() => setUserForm({ id: null, login: '', password: '', first_name: '', last_name: '', position: companyPositions?.[0]?.name || 'Оператор', department: companyStructure?.[0]?.name || 'Цех №1', shift: 'Без зміни', access_rights: { dashboard: false, foreman_dashboard: false, manager: false, master: false, warehouse: false, preparation_dashboard: false, engineer: false, director: false, foreman: false, foreman2: false, operator: true, prep_terminal: false, shipping: false, supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, kanban: false, reports: false, tumbling_terminal: false, tumbling_dashboard: false, reception_terminal: false, sorting_terminal: false, painting_terminal: false, pressing_terminal: false } })}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
              >
                СКАСУВАТИ
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Right Column: Dossier Card Registry */}
      <section className="registry-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="glass-panel" style={{ background: '#0e0e11', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#888', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UsersIcon size={18} color="#ff9000" /> КАРТОТЕКА ПРАЦІВНИКІВ ({systemUsers.length})
              </h3>
              <button 
                onClick={() => {
                  setCsvFile(null)
                  setCsvHeaders([])
                  setCsvRows([])
                  setImportStatus('idle')
                  setIsImportModalOpen(true)
                }}
                style={{ 
                  background: 'rgba(255,144,0,0.1)', 
                  border: '1px solid rgba(255,144,0,0.2)', 
                  color: '#ff9000', 
                  padding: '6px 12px', 
                  borderRadius: '8px', 
                  fontSize: '0.72rem', 
                  fontWeight: 800, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  transition: '0.2s'
                }}
                className="import-csv-btn"
                type="button"
              >
                <Upload size={14} /> Імпорт з CSV
              </button>
            </div>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
              <input 
                style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '8px 12px 8px 36px', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none' }} 
                placeholder="Пошук по імені, логіну..." 
                value={userSearch} 
                onChange={e => setUserSearch(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
            <select style={filterSelectStyle} value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
              <option value="all">Всі цехи / склади ({companyStructure.length})</option>
              {(companyStructure || []).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>

            <select style={filterSelectStyle} value={filterPosition} onChange={e => setFilterPosition(e.target.value)}>
              <option value="all">Всі посади ({availableFilterPositions.length})</option>
              {(availableFilterPositions || []).map(pos => (
                <option key={pos.id} value={pos.name}>{pos.name}</option>
              ))}
            </select>

            <select style={filterSelectStyle} value={filterShift} onChange={e => setFilterShift(e.target.value)}>
              <option value="all">Всі зміни</option>
              <option value="Зміна 1">Зміна 1</option>
              <option value="Зміна 2">Зміна 2</option>
              <option value="Зміна 3">Зміна 3</option>
              <option value="Зміна 4">Зміна 4</option>
              <option value="Без зміни">Без зміни</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: filterOnlyOnline ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', border: filterOnlyOnline ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.72rem', color: filterOnlyOnline ? '#34d399' : '#888', transition: '0.2s' }}>
              <input type="checkbox" checked={filterOnlyOnline} onChange={e => setFilterOnlyOnline(e.target.checked)} style={{ accentColor: '#10b981', cursor: 'pointer' }} />
              Тільки онлайн
            </label>

            {(filterDepartment !== 'all' || filterPosition !== 'all' || filterShift !== 'all' || userSearch !== '' || filterOnlyOnline) && (
              <button onClick={() => { setFilterDepartment('all'); setFilterPosition('all'); setFilterShift('all'); setUserSearch(''); setFilterOnlyOnline(false) }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#aaa', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={12} /> скинути
              </button>
            )}
          </div>
        </div>

        <div className="dossier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
          {filteredUsers.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', background: '#0e0e11', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '24px', color: '#555' }}>
              <UsersIcon size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Нікого не знайдено</div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Спробуйте змінити параметри пошуку або фільтри</div>
            </div>
          ) : (
            filteredUsers.map(user => {
              const roleStyle = getRoleStyle(user.position)
              const allowedModulesCount = Object.values(user.access_rights || {}).filter(Boolean).length
              const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 120000)

              return (
                <div key={user.id} className="dossier-card" style={{ 
                  background: '#0e0e11', 
                  border: userForm.id === user.id ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '20px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '15px',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  boxShadow: userForm.id === user.id ? '0 0 20px rgba(255,144,0,0.1)' : 'none',
                  cursor: 'pointer'
                }} onClick={() => editUser(user)}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <div style={{ position: 'relative' }}>
                      {renderUserAvatar(user)}
                      <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', borderRadius: '50%', background: isOnline ? '#10b981' : '#6b7280', border: '2px solid #0e0e11' }} />
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>ID: {user.id || 'new'}</span>
                        <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 600 }}>@{user.login}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Без імені'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#6b7280' }} />
                      <span style={{ fontSize: '0.72rem', color: isOnline ? '#34d399' : '#888', fontWeight: 600 }}>
                        {isOnline ? 'В мережі' : `Візит: ${formatLastSeen(user.last_seen)}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: roleStyle.bg, color: roleStyle.color, border: roleStyle.border }}>
                        {user.position || 'Робітник'}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', color: '#aaa', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {user.department || 'Без відділу'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 600 }}>
                      Модулів MES: <strong style={{ color: '#fff' }}>{allowedModulesCount}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={(e) => { e.stopPropagation(); editUser(user) }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }} title="Редагувати"><ShieldCheck size={16} /></button>
                      <button onClick={async (e) => { e.stopPropagation(); if (window.confirm(`Ви дійсно бажаєте безповоротно видалити користувача ${user.login}?`)) { await deleteUser(user.id) } }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Видалити"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: '#16161a', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#ff9000' }}>ІМПОРТ СПИСКУ КОРИСТУВАЧІВ З CSV / EXCEL</h3>
              <button onClick={() => setIsImportModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {importStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', padding: '40px 20px', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                  <Upload size={40} color="#555" />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Оберіть CSV або Excel файл (.csv, .xlsx, .xls)</div>
                    <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '4px' }}>Файл має містити колонки з логінами, паролями, ПІБ, відділом, посадою та зміною</div>
                  </div>
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} id="csv-file-input" />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label htmlFor="csv-file-input" style={{ background: '#ff9000', color: '#000', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}>ОБРАТИ ФАЙЛ</label>
                    <button onClick={downloadTemplateExcel} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Скачати шаблон Excel</button>
                  </div>
                </div>
              )}

              {importStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Mapping options */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', background: '#09090b', padding: '16px', borderRadius: '16px' }}>
                    {Object.keys(columnMapping).map(key => (
                      <div key={key}>
                        <label style={{ ...labelStyle, color: '#ff9000' }}>Колонка для {key}</label>
                        <select 
                          style={inputStyle} 
                          value={columnMapping[key]} 
                          onChange={e => setColumnMapping({...columnMapping, [key]: parseInt(e.target.value)})}
                        >
                          <option value={-1}>-- Пропустити --</option>
                          {csvHeaders.map((h, i) => (
                            <option key={i} value={i}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Settings row */}
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                      <label style={labelStyle}>Політика при дублюванні логіна</label>
                      <select style={inputStyle} value={duplicatePolicy} onChange={e => setDuplicatePolicy(e.target.value)}>
                        <option value="skip">Пропустити (залишити стару картку)</option>
                        <option value="update">Оновити (записати нові дані з файлу)</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#16161a', color: '#888' }}>
                          <th style={{ padding: '10px' }}>ЛОГІН</th>
                          <th style={{ padding: '10px' }}>ІМ'Я</th>
                          <th style={{ padding: '10px' }}>ВІДДІЛ</th>
                          <th style={{ padding: '10px' }}>ПОСАДА</th>
                          <th style={{ padding: '10px' }}>СТАТУС</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map(row => (
                          <tr key={row.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '10px', fontWeight: 700 }}>{row.login}</td>
                            <td style={{ padding: '10px' }}>{row.first_name} {row.last_name}</td>
                            <td style={{ padding: '10px' }}>{row.department}</td>
                            <td style={{ padding: '10px' }}>{row.position}</td>
                            <td style={{ padding: '10px', color: row.status === 'error' ? '#ef4444' : row.status === 'skip' ? '#555' : '#10b981' }}>{row.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setImportStatus('idle')} style={{ background: 'transparent', color: '#aaa', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.85rem' }}>Назад до вибору файлу</button>
                    <button onClick={executeImport} style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}>ВИКОНАТИ ІМПОРТ ({previewData.filter(r => r.status==='insert'||r.status==='update').length} користувачів)</button>
                  </div>
                </div>
              )}

              {(importStatus === 'importing' || importStatus === 'success' || importStatus === 'error') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 700 }}>
                    {importStatus === 'importing' && <RefreshCw className="anim-spin" color="#ff9000" />}
                    {importStatus === 'success' && <span style={{ color: '#10b981' }}>✓ Імпорт завершено!</span>}
                    {importStatus === 'error' && <span style={{ color: '#ef4444' }}>❌ Помилка імпорту</span>}
                  </div>
                  <textarea readOnly value={importLog} style={{ width: '100%', height: '240px', background: '#050507', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', color: '#34d399', fontFamily: 'monospace', padding: '15px', fontSize: '0.75rem', outline: 'none' }} />
                  {importStatus !== 'importing' && (
                    <button onClick={() => setIsImportModalOpen(false)} style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>ЗАКРИТИ ВІКНО</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
