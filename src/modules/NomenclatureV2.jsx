import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Menu, 
  Search, 
  Plus, 
  Layers, 
  Tag, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  FolderPlus, 
  Type,
  MoreVertical,
  Activity,
  Check,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { nomenclatureService } from '../services/nomenclatureService';

const GroupItem = ({ group, allGroups, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const subs = allGroups.filter(g => g.parent_id === group.id);
  const hasSubs = subs.length > 0;

  return (
    <div className="group-item-wrap" style={{ marginLeft: depth * 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', background: '#111', borderRadius: '12px', border: '1px solid #1a1a1a', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasSubs ? (
            <button onClick={() => setIsOpen(!isOpen)} style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', display: 'flex' }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <div style={{ width: '14px' }} />}
          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{group.name}</div>
          <span style={{ fontSize: '0.65rem', color: '#333', fontWeight: 900 }}>{group.code}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
           <button style={{ background: 'transparent', border: 'none', color: '#333', cursor: 'pointer' }}><Edit3 size={14} /></button>
        </div>
      </div>
      {isOpen && hasSubs && (
        <div className="group-subs" style={{ animation: 'slideIn 0.3s' }}>
          {subs.map(s => <GroupItem key={s.id} group={s} allGroups={allGroups} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zUnit: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', animation: 'scaleUp 0.3s' }}>
         <div style={{ padding: '25px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#ff9000' }}>{title}</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
         </div>
         <div style={{ padding: '25px' }}>{children}</div>
      </div>
    </div>
  );
};

const NomenclatureV2 = () => {
  const [activeTab, setActiveTab] = useState('registry'); // 'registry', 'groups', 'types'
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [groups, setGroups] = useState([]);
  const [types, setTypes] = useState([]);
  const [items, setItems] = useState([]);
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  const [newGroup, setNewGroup] = useState({ name: '', code: '', parent_id: null });
  const [newType, setNewType] = useState({ name: '', description: '' });
  const [newItem, setNewItem] = useState({ base_code: '', name: '', group_id: '', unit_of_measure: 'шт' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [g, t, i] = await Promise.all([
        nomenclatureService.getGroups(),
        nomenclatureService.getTypes(),
        nomenclatureService.getNomenclature()
      ]);
      setGroups(g);
      setTypes(t);
      setItems(i);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await nomenclatureService.createGroup(newGroup);
      setIsGroupModalOpen(false);
      setNewGroup({ name: '', code: '', parent_id: null });
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    try {
      await nomenclatureService.createType(newType);
      setIsTypeModalOpen(false);
      setNewType({ name: '', description: '' });
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      await nomenclatureService.createNomenclature({...newItem, base_code: Number(newItem.base_code)});
      setIsItemModalOpen(false);
      setNewItem({ base_code: '', name: '', group_id: '', unit_of_measure: 'шт' });
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 2) {
      try {
        const results = await nomenclatureService.searchNomenclature(q);
        setItems(results);
      } catch (err) {
        console.error('Search failed:', err);
      }
    } else if (q.length === 0) {
      loadData();
    }
  };

  return (
    <div className="nomenclature-v2-container" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="module-nav" style={{ height: '70px', background: '#000', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">Назад</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#ff9000' }}>
            <Menu size={24} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '1px' }}>Номенклатура</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
             onClick={() => {
               if (activeTab === 'registry') setIsItemModalOpen(true);
               if (activeTab === 'groups') setIsGroupModalOpen(true);
               if (activeTab === 'types') setIsTypeModalOpen(true);
             }}
             style={{ background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', padding: '10px 18px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}
          >
            <Plus size={16} /> <span className="hide-mobile">СТВОРИТИ</span>
          </button>
        </div>
      </nav>

      <div className="module-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar for Navigation */}
        <aside style={{ width: '280px', background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }} className="hide-mobile">
          <div style={{ padding: '25px', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => setActiveTab('registry')}
                style={{ background: activeTab === 'registry' ? 'rgba(255,144,0,0.1)' : 'transparent', color: activeTab === 'registry' ? '#ff9000' : '#555', border: 'none', borderRadius: '12px', padding: '15px', textAlign: 'left', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: '0.3s' }}
              >
                <Layers size={20} /> Реєстр позицій
              </button>
              <button 
                onClick={() => setActiveTab('groups')}
                style={{ background: activeTab === 'groups' ? 'rgba(255,144,0,0.1)' : 'transparent', color: activeTab === 'groups' ? '#ff9000' : '#555', border: 'none', borderRadius: '12px', padding: '15px', textAlign: 'left', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: '0.3s' }}
              >
                <FolderPlus size={20} /> Групи (Категорії)
              </button>
              <button 
                onClick={() => setActiveTab('types')}
                style={{ background: activeTab === 'types' ? 'rgba(255,144,0,0.1)' : 'transparent', color: activeTab === 'types' ? '#ff9000' : '#555', border: 'none', borderRadius: '12px', padding: '15px', textAlign: 'left', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: '0.3s' }}
              >
                <Type size={20} /> Типи номенклатури
              </button>
            </div>
          </div>
          <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a' }}>
             <p style={{ margin: 0, fontSize: '0.65rem', color: '#222', fontWeight: 900, textTransform: 'uppercase' }}>Industrial Control v2.0</p>
          </div>
        </aside>

        {/* Main Area */}
        <main style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#050505' }}>
           {/* Mobile Tabs */}
           <div className="mobile-only" style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              <button onClick={() => setActiveTab('registry')} style={{ flex: 1, background: activeTab === 'registry' ? '#ff9000' : '#111', color: activeTab === 'registry' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>РЕЄСТР</button>
              <button onClick={() => setActiveTab('groups')} style={{ flex: 1, background: activeTab === 'groups' ? '#ff9000' : '#111', color: activeTab === 'groups' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>ГРУПИ</button>
              <button onClick={() => setActiveTab('types')} style={{ flex: 1, background: activeTab === 'types' ? '#ff9000' : '#111', color: activeTab === 'types' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>ТИПИ</button>
           </div>

           {activeTab === 'registry' && (
             <div className="view-registry">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                   <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Реєстр номенклатури</h2>
                   <div style={{ position: 'relative', width: '350px' }}>
                      <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} size={18} />
                      <input 
                         type="text" 
                         placeholder="Пошук за назвою або кодом..." 
                         value={searchQuery}
                         onChange={handleSearch}
                         style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '14px', padding: '12px 15px 12px 45px', color: '#fff', fontSize: '0.9rem' }}
                      />
                   </div>
                </div>

                <div className="table-container glass-panel" style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                         <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Код</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Назва</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Група</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Од. вим.</th>
                            <th style={{ padding: '18px 25px', textAlign: 'center', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Дії</th>
                         </tr>
                      </thead>
                      <tbody>
                         {items.length === 0 ? (
                           <tr>
                              <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#333', fontSize: '0.9rem' }}>
                                 {loading ? 'Завантаження...' : 'Порожньо'}
                              </td>
                           </tr>
                         ) : items.map(item => {
                           const isActive = item.status !== 'inactive'; // Assuming there's a status field
                           return (
                             <tr key={item.id} style={{ borderBottom: '1px solid #111', transition: '0.2s', opacity: isActive ? 1 : 0.4 }} className="table-row-hover">
                                <td style={{ padding: '18px 25px', fontWeight: 700, color: isActive ? '#ff9000' : '#444' }}>{item.base_code || item.id.substring(0,8)}</td>
                                <td style={{ padding: '18px 25px', fontWeight: 800 }}>{item.name}</td>
                                <td style={{ padding: '18px 25px', color: '#666' }}>{groups.find(g => g.id === item.group_id)?.name || '—'}</td>
                                <td style={{ padding: '18px 25px', color: '#888' }}>{item.unit_of_measure || 'шт'}</td>
                                <td style={{ padding: '18px 25px', textAlign: 'center' }}>
                                   <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                      <button 
                                         onClick={() => {
                                           const action = isActive ? nomenclatureService.deactivate(item.id) : nomenclatureService.activate(item.id);
                                           action.then(loadData).catch(e => alert(e.message));
                                         }}
                                         style={{ background: 'transparent', border: 'none', color: isActive ? '#22c55e' : '#555', cursor: 'pointer' }}
                                         title={isActive ? 'Деактивувати' : 'Активувати'}
                                      >
                                         <Activity size={18} />
                                      </button>
                                      <button style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><Edit3 size={18} /></button>
                                      <button 
                                         onClick={() => {
                                           if (window.confirm('Видалити цю позицію?')) {
                                             nomenclatureService.deleteNomenclature(item.id).then(loadData).catch(e => alert(e.message));
                                           }
                                         }}
                                         style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                      >
                                         <Trash2 size={18} />
                                      </button>
                                   </div>
                                </td>
                             </tr>
                           );
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
           )}

           {activeTab === 'groups' && (
             <div className="view-groups" style={{ animation: 'fadeIn 0.5s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                   <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Групи номенклатури</h2>
                   <button onClick={() => setIsGroupModalOpen(true)} style={{ background: 'rgba(255,144,0,0.1)', color: '#ff9000', border: '1px solid #ff900033', borderRadius: '10px', padding: '8px 15px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderPlus size={16} /> ДОДАТИ ГРУПУ
                   </button>
                </div>

                <div className="groups-tree-container glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '24px', border: '1px solid #1a1a1a' }}>
                   {groups.filter(g => !g.parent_id).length === 0 ? (
                     <p style={{ color: '#333', textAlign: 'center' }}>Груп не знайдено</p>
                   ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {groups.filter(g => !g.parent_id).map(group => (
                          <GroupItem key={group.id} group={group} allGroups={groups} onAddSub={() => {}} />
                        ))}
                     </div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'types' && (
             <div className="view-types">
                <h2 style={{ margin: '0 0 30px', fontSize: '1.5rem', fontWeight: 900 }}>Типи номенклатури</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                   {types.map(type => (
                     <div key={type.id} className="glass-panel" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '18px', border: '1px solid #1a1a1a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                           <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>{type.name}</span>
                           <button onClick={() => nomenclatureService.deleteType(type.id).then(loadData)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{type.description || 'Опис відсутній'}</p>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </main>
      </div>

      {/* --- MODALS --- */}
      <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title="Створення групи">
         <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
               <label>НАЗВА ГРУПИ</label>
               <input value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} required />
            </div>
            <div className="form-group">
               <label>КОД ГРУПИ</label>
               <input value={newGroup.code} onChange={e => setNewGroup({...newGroup, code: e.target.value})} placeholder="напр. 001" />
            </div>
            <div className="form-group">
               <label>БАТЬКІВСЬКА ГРУПА</label>
               <select value={newGroup.parent_id || ''} onChange={e => setNewGroup({...newGroup, parent_id: e.target.value || null})}>
                  <option value="">-- Корінь (немає) --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
               </select>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>ЗБЕРЕГТИ ГРУПУ</button>
         </form>
      </Modal>

      <Modal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} title="Створення типу">
         <form onSubmit={handleCreateType} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
               <label>НАЗВА ТИПУ</label>
               <input value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} required placeholder="напр. Сировина" />
            </div>
            <div className="form-group">
               <label>ОПИС</label>
               <textarea value={newType.description} onChange={e => setNewType({...newType, description: e.target.value})} style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', color: '#fff', padding: '10px', minHeight: '100px' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>ЗБЕРЕГТИ ТИП</button>
         </form>
      </Modal>

      <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title="Нова позиція номенклатури">
         <form onSubmit={handleCreateItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
               <label>БАЗОВИЙ КОД (ID)</label>
               <input type="number" value={newItem.base_code} onChange={e => setNewItem({...newItem, base_code: e.target.value})} required />
            </div>
            <div className="form-group">
               <label>НАЗВА ПОЗИЦІЇ</label>
               <input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
            </div>
            <div className="form-group">
               <label>ГРУПА</label>
               <select value={newItem.group_id} onChange={e => setNewItem({...newItem, group_id: e.target.value})} required>
                  <option value="">Оберіть групу...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
               </select>
            </div>
            <div className="form-group">
               <label>ОДИНИЦЯ ВИМІРУ</label>
               <select value={newItem.unit_of_measure} onChange={e => setNewItem({...newItem, unit_of_measure: e.target.value})}>
                  <option value="шт">Штуки (шт)</option>
                  <option value="кг">Кілограми (кг)</option>
                  <option value="м">Метри (м)</option>
                  <option value="м2">Кв. метри (м2)</option>
                  <option value="л">Літри (л)</option>
               </select>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>ЗБЕРЕГТИ ПОЗИЦІЮ</button>
         </form>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover { background: #0c0c0c !important; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .module-content { flex-direction: column; overflow-y: auto; }
          main { padding: 20px !important; }
        }
      `}} />
    </div>
  );
};

export default NomenclatureV2;
