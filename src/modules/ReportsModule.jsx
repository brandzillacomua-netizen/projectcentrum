import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  BarChart2, 
  Warehouse, 
  Users, 
  AlertTriangle, 
  PieChart,
  Calendar,
  Filter,
  Download,
  TrendingUp,
  PackageCheck,
  Search,
  X
} from 'lucide-react'
import { useMES } from '../MESContext'

const ReportsModule = () => {
  const { 
    inventory, 
    systemUsers, 
    workCardHistory: initialHistory, 
    tasks, 
    orders, 
    nomenclatures,
    accessLogs,
    fetchHistoryRange
  } = useMES()

  const [activeTab, setActiveTab] = useState('warehouse')
  const [dateRange, setDateRange] = useState('all') // all, month, week, today
  const [searchQuery, setSearchQuery] = useState('')
  const [workCardHistory, setWorkCardHistory] = useState(initialHistory)
  const [isSyncing, setIsSyncing] = useState(false)

  // Функція для завантаження даних за період (ОПТИМІЗАЦІЯ ДЛЯ 10к-20к записів)
  const syncHistory = async (range) => {
    setIsSyncing(true)
    let start = null
    const now = new Date()
    if (range === 'today') start = new Date(now.setHours(0,0,0,0)).toISOString()
    if (range === 'week') start = new Date(now.setDate(now.getDate() - 7)).toISOString()
    if (range === 'month') start = new Date(now.setMonth(now.getMonth() - 1)).toISOString()
    
    const data = await fetchHistoryRange(start, null)
    setWorkCardHistory(data)
    setIsSyncing(false)
  }

  // Слідкуємо за зміною періоду
  React.useEffect(() => {
    if (dateRange !== 'all') {
      syncHistory(dateRange)
    } else {
      setWorkCardHistory(initialHistory)
    }
  }, [dateRange, initialHistory])

  // Date Filtering Logic
  const filterByDate = (dateString) => {
    if (dateRange === 'all') return true;
    if (!dateString) return false;
    const d = new Date(dateString);
    const now = new Date();
    if (dateRange === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (dateRange === 'week') {
      const pastWeek = new Date(now.setDate(now.getDate() - 7));
      return d >= pastWeek;
    }
    if (dateRange === 'month') {
      const pastMonth = new Date(now.setMonth(now.getMonth() - 1));
      return d >= pastMonth;
    }
    return true;
  }

  // --- WAREHOUSE REPORT BUILDER STATE ---
  const [whFilter, setWhFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [itemFilter, setItemFilter] = useState('all')
  const [itemSearchText, setItemSearchText] = useState('')
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false)
  const [generatedReport, setGeneratedReport] = useState(null)

  // Options for Dropdowns
  const warehouseOptions = useMemo(() => {
    const whs = new Set(['operational', 'production', 'sgp', 'sz', 'scrap'])
    inventory.forEach(i => {
      if (i.warehouse) whs.add(i.warehouse)
      else if (i.type === 'bz') whs.add('sz')
      else if (i.type === 'finished' || i.type === 'product') whs.add('sgp')
      else if (i.type === 'raw') whs.add('production')
    })
    return Array.from(whs)
  }, [inventory])

  const typeNameMap = {
    raw: 'Сировина (Листи)',
    part: 'Деталі (Напівфабрикати)',
    product: 'Готові вироби',
    hardware: 'Метизи / Фурнітура',
    consumable: 'Витратні матеріали',
    bz: 'Буферний запас'
  }

  const typeOptions = useMemo(() => {
    const types = new Set()
    nomenclatures.forEach(n => {
      if (n.type) types.add(n.type)
    })
    return Array.from(types).filter(Boolean)
  }, [nomenclatures])

  const itemOptions = useMemo(() => {
    let noms = nomenclatures
    if (typeFilter !== 'all') {
      noms = noms.filter(n => n.type === typeFilter)
    }
    return noms.sort((a,b) => a.name.localeCompare(b.name))
  }, [nomenclatures, typeFilter])

  const filteredItems = useMemo(() => {
    if (!itemSearchText) return itemOptions
    const lower = itemSearchText.toLowerCase()
    return itemOptions.filter(i => 
      i.name.toLowerCase().includes(lower) || 
      String(i.base_code || '').includes(lower) ||
      String(i.id).includes(lower)
    )
  }, [itemOptions, itemSearchText])

  const handleGenerateReport = () => {
    let data = inventory.map(i => ({...i})) // clone

    // Apply Warehouse Filter
    if (whFilter !== 'all') {
      data = data.filter(i => {
        let w = i.warehouse
        // Якщо склад не вказаний, визначаємо за типом
        if (!w) {
          if (i.type === 'bz') w = 'sz'
          else if (i.type === 'finished' || i.type === 'product') w = 'sgp'
          else if (i.type === 'raw') w = 'production'
          else if (i.type?.startsWith('scrap')) w = 'scrap'
          else w = 'operational'
        } else {
          // Пріоритетні мапінги для звітів
          if (i.type === 'bz') w = 'sz'
          if (i.type === 'finished' || i.type === 'product') w = 'sgp'
          if (i.type?.startsWith('scrap')) w = 'scrap'
        }
        return w === whFilter
      })
    }

    // Apply Type Filter
    if (typeFilter !== 'all') {
      data = data.filter(i => {
        const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id))
        const itemType = (nom && nom.type) ? nom.type : i.type
        return itemType === typeFilter
      })
    }

    // Apply Item Filter
    if (itemFilter !== 'all') {
      data = data.filter(i => String(i.nomenclature_id) === String(itemFilter))
    }

    // Прибираємо нулі (щоб не засмічувати звіт), 
    // але залишаємо ті, де є резерв, навіть якщо фізично 0 (на всяк випадок)
    data = data.filter(i => (Number(i.total_qty) || 0) > 0 || (Number(i.reserved_qty) || 0) > 0)

    // Grouping by Warehouse -> Type for a professional view
    const grouped = {}
    let totalQtyAll = 0
    let totalResAll = 0

    data.forEach(item => {
      let w = item.warehouse
      if (!w) {
        if (item.type === 'bz') w = 'sz'
        else if (item.type === 'finished' || item.type === 'product') w = 'sgp'
        else if (item.type?.startsWith('scrap')) w = 'scrap'
        else if (item.type === 'raw') w = 'production'
        else w = 'operational'
      } else {
        if (item.type === 'bz') w = 'sz'
        if (item.type === 'finished' || item.type === 'product') w = 'sgp'
        if (item.type?.startsWith('scrap')) w = 'scrap'
      }

      const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
      const t = (nom && nom.type) ? nom.type : (item.type || 'Без групи')

      if (!grouped[w]) grouped[w] = { name: w, total: 0, reserved: 0, groups: {} }
      if (!grouped[w].groups[t]) grouped[w].groups[t] = { name: t, total: 0, reserved: 0, items: [] }

      const qty = Number(item.total_qty) || 0
      const res = Number(item.reserved_qty) || 0

      grouped[w].total += qty
      grouped[w].reserved += res
      grouped[w].groups[t].total += qty
      grouped[w].groups[t].reserved += res
      grouped[w].groups[t].items.push({...item, nom_name: nom?.name || item.name})

      totalQtyAll += qty
      totalResAll += res
    })

    setGeneratedReport({
      timestamp: new Date(),
      totalItems: data.length,
      totalQtyAll,
      totalResAll,
      grouped
    })
  }

  // 2. Employee Report
  const employeeStats = useMemo(() => {
    const stats = {};
    
    // Initialize stats
    systemUsers.forEach(u => {
      stats[u.login] = { 
        name: `${u.first_name} ${u.last_name}`, 
        position: u.position, 
        department: u.department,
        produced: 0, 
        scrap: 0, 
        operations: 0 
      };
    });

    // Add Work Card History
    workCardHistory.filter(h => filterByDate(h.completed_at)).forEach(h => {
      // Match by exact login or try to match name loosely
      const user = systemUsers.find(u => u.login === h.operator_name || `${u.first_name} ${u.last_name}` === h.operator_name);
      const key = user ? user.login : h.operator_name;
      
      if (!stats[key]) {
        stats[key] = { name: key, position: 'Невідомо', department: '-', produced: 0, scrap: 0, operations: 0 };
      }
      
      stats[key].produced += Number(h.qty_completed) || 0;
      stats[key].scrap += Number(h.scrap_qty) || 0;
      stats[key].operations += 1;
    });

    return Object.values(stats)
      .filter(s => s.operations > 0 || (searchQuery && s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.produced - a.produced);
  }, [systemUsers, workCardHistory, dateRange, searchQuery])

  // 3. Scrap Report
  const scrapStats = useMemo(() => {
    const list = workCardHistory
      .filter(h => Number(h.scrap_qty) > 0 && filterByDate(h.completed_at))
      .map(h => {
        const nom = nomenclatures.find(n => n.id === h.nomenclature_id);
        return {
          ...h,
          nom_name: nom ? nom.name : 'Невідома деталь'
        };
      })
      .filter(h => !searchQuery || h.nom_name.toLowerCase().includes(searchQuery.toLowerCase()) || h.operator_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    const totalScrap = list.reduce((acc, curr) => acc + Number(curr.scrap_qty), 0);
    
    const byStage = list.reduce((acc, curr) => {
      acc[curr.stage_name] = (acc[curr.stage_name] || 0) + Number(curr.scrap_qty);
      return acc;
    }, {});

    return { list, totalScrap, byStage };
  }, [workCardHistory, nomenclatures, dateRange, searchQuery])

  // 4. General Analytics
  const generalStats = useMemo(() => {
    const filteredTasks = tasks.filter(t => filterByDate(t.created_at));
    const filteredOrders = orders.filter(o => filterByDate(o.created_at));
    
    const totalSets = filteredTasks.reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);
    const completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
    
    const producedParts = workCardHistory
      .filter(h => filterByDate(h.completed_at))
      .reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0);

    return {
      totalOrders: filteredOrders.length,
      activeOrders: filteredOrders.filter(o => o.status !== 'completed').length,
      totalTasks: filteredTasks.length,
      completedTasks,
      totalSets,
      producedParts
    };
  }, [tasks, orders, workCardHistory, dateRange])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'warehouse':
        const whNameMap = { 
          operational: 'Оперативний (СО)', 
          production: 'Склад Виробництва (СВ)', 
          sgp: 'СГП (Склад Готової Продукції)',
          sz: 'СЗ (Склад Залишків)',
          scrap: 'СБ (Брак / Ізолятор)', 
          other: 'Інше' 
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* BUILDER PANEL */}
            <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
              <h3 style={{ margin: '0 0 20px', color: '#ff9000', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Filter size={20} /> Конструктор звіту по складах
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Вибір складу</label>
                  <select value={whFilter} onChange={e => setWhFilter(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none' }}>
                    <option value="all">-- Всі склади --</option>
                    {warehouseOptions.map(w => <option key={w} value={w}>{whNameMap[w] || w}</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Група / Тип матеріалу</label>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none' }}>
                    <option value="all">-- Всі групи --</option>
                    {typeOptions.map(t => <option key={t} value={t}>{typeNameMap[t] || t}</option>)}
                  </select>
                </div>

                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Конкретна деталь (Пошук)</label>
                  <div 
                    onClick={() => setIsItemDropdownOpen(true)}
                    style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '11px 12px', display: 'flex', alignItems: 'center', cursor: 'text' }}
                  >
                    <Search size={16} color="#555" style={{ marginRight: '8px' }} />
                    <input 
                      type="text" 
                      placeholder="Введіть назву або код..."
                      value={itemSearchText}
                      onChange={e => {
                        setItemSearchText(e.target.value)
                        setIsItemDropdownOpen(true)
                        if (itemFilter !== 'all') setItemFilter('all')
                      }}
                      onFocus={() => setIsItemDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsItemDropdownOpen(false), 200)}
                      style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.9rem' }}
                    />
                    {itemFilter !== 'all' && (
                      <X size={16} color="#888" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setItemFilter('all'); setItemSearchText(''); }} />
                    )}
                  </div>
                  
                  {isItemDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: '10px', maxHeight: '250px', overflowY: 'auto', zIndex: 10, marginTop: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                      <div 
                        style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #222', color: '#888', fontSize: '0.85rem' }}
                        onClick={() => { setItemFilter('all'); setItemSearchText(''); setIsItemDropdownOpen(false); }}
                      >
                        -- Всі деталі --
                      </div>
                      {filteredItems.slice(0, 100).map(i => (
                        <div 
                          key={i.id} 
                          style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #222', color: itemFilter === i.id ? '#ff9000' : '#ddd', background: itemFilter === i.id ? 'rgba(255,144,0,0.1)' : 'transparent', fontSize: '0.85rem' }}
                          onClick={() => { setItemFilter(i.id); setItemSearchText(i.name); setIsItemDropdownOpen(false); }}
                        >
                          {i.name} {i.base_code && <span style={{ color: '#555', fontSize: '0.75rem', marginLeft: '10px' }}>#{i.base_code}</span>}
                        </div>
                      ))}
                      {filteredItems.length === 0 && <div style={{ padding: '10px 15px', color: '#555', fontSize: '0.85rem' }}>Нічого не знайдено</div>}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={handleGenerateReport}
                  style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px 30px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <BarChart2 size={18} /> СФОРМУВАТИ ЗВІТ
                </button>
              </div>
            </div>

            {/* GENERATED REPORT */}
            {generatedReport && (
              <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '16px', border: '1px solid #1a1a1a', animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 10px', fontSize: '1.6rem', color: '#fff', fontWeight: 900 }}>Зведена відомість по залишках</h2>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>
                      Сформовано: {generatedReport.timestamp.toLocaleString('uk-UA')} <br/>
                      Фільтри: Склад ({whFilter === 'all' ? 'Всі' : (whNameMap[whFilter] || whFilter)}) | Група ({typeFilter === 'all' ? 'Всі' : (typeNameMap[typeFilter] || typeFilter)}) | Деталь ({itemFilter === 'all' ? 'Всі' : 'Вибрана'})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', gap: '30px', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>Фізичний залишок</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#fff', lineHeight: 1.2 }}>{generatedReport.totalQtyAll}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>В резерві</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#ff9000', lineHeight: 1.2 }}>{generatedReport.totalResAll}</div>
                    </div>
                    <div style={{ paddingLeft: '20px', borderLeft: '1px solid #222' }}>
                      <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>ДОСТУПНО (ВІЛЬНО)</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#22c55e', lineHeight: 1 }}>{generatedReport.totalQtyAll - generatedReport.totalResAll}</div>
                    </div>
                  </div>
                </div>

                {Object.keys(generatedReport.grouped).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: '0.9rem' }}>За вказаними фільтрами даних не знайдено.</div>
                ) : (
                  Object.values(generatedReport.grouped).map(wh => (
                    <div key={wh.name} style={{ marginBottom: '35px' }}>
                      <h3 style={{ fontSize: '1.2rem', color: '#ff9000', borderBottom: '2px solid #222', paddingBottom: '10px', marginBottom: '15px', textTransform: 'uppercase' }}>
                        Склад: {whNameMap[wh.name] || wh.name}
                      </h3>
                      
                      {Object.values(wh.groups).map(group => (
                        <div key={group.name} style={{ marginBottom: '20px', paddingLeft: '15px', borderLeft: '3px solid #333' }}>
                          <h4 style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Група: {typeNameMap[group.name] || group.name}</span>
                            <span style={{ color: '#555' }}>Всього: {group.total - group.reserved} вільних / {group.reserved} рез.</span>
                          </h4>
                          
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: '#111', color: '#666', textAlign: 'left' }}>
                                <th style={{ padding: '10px 15px', borderBottom: '1px solid #222', width: '50%' }}>Номенклатура</th>
                                <th style={{ padding: '10px 15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Фізично (всього)</th>
                                <th style={{ padding: '10px 15px', textAlign: 'center', borderBottom: '1px solid #222' }}>В резерві</th>
                                <th style={{ padding: '10px 15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#22c55e' }}>Доступно</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,255,255,0.01)' }}>
                                  <td style={{ padding: '12px 15px', fontWeight: 700, color: '#ddd' }}>{item.nom_name}</td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center', color: '#888' }}>{item.total_qty || 0}</td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center', color: '#ff9000' }}>{item.reserved_qty || 0}</td>
                                  <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: '#22c55e' }}>
                                    {(Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      
      case 'employees':
        return (
          <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#0a0a0a', color: '#666', textAlign: 'left' }}>
                  <th style={{ padding: '15px', borderBottom: '1px solid #222' }}>Працівник</th>
                  <th style={{ padding: '15px', borderBottom: '1px solid #222' }}>Цех / Посада</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Операцій</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Вироблено (шт)</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Брак (шт)</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Ефективність</th>
                </tr>
              </thead>
              <tbody>
                {employeeStats.map((emp, idx) => {
                  const totalProcessed = emp.produced + emp.scrap;
                  const efficiency = totalProcessed > 0 ? ((emp.produced / totalProcessed) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '15px', fontWeight: 800, color: '#fff' }}>{emp.name}</td>
                      <td style={{ padding: '15px', color: '#888' }}>{emp.department} <span style={{ color: '#555' }}>({emp.position})</span></td>
                      <td style={{ padding: '15px', textAlign: 'center', color: '#bbb' }}>{emp.operations}</td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#22c55e' }}>{emp.produced}</td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: emp.scrap > 0 ? '#ef4444' : '#555' }}>{emp.scrap}</td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                           <div style={{ width: '50px', height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${efficiency}%`, height: '100%', background: Number(efficiency) > 95 ? '#22c55e' : (Number(efficiency) > 80 ? '#ff9000' : '#ef4444') }}></div>
                           </div>
                           <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{efficiency}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        );

      case 'scrap':
        return (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
                <h3 style={{ margin: '0 0 15px', color: '#ef4444', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} /> Загальний облік браку
                </h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#fff', lineHeight: 1 }}>{scrapStats.totalScrap} <span style={{ fontSize: '1rem', color: '#666', fontWeight: 600 }}>од.</span></div>
              </div>

              <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
                 <h4 style={{ margin: '0 0 15px', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Брак по етапах</h4>
                 {Object.entries(scrapStats.byStage).map(([stage, count]) => (
                   <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', padding: '10px', background: '#0a0a0a', borderRadius: '8px' }}>
                     <span style={{ color: '#ccc', fontSize: '0.85rem' }}>{stage}</span>
                     <strong style={{ color: '#ef4444' }}>{count} од.</strong>
                   </div>
                 ))}
              </div>
            </div>

            <div className="glass-panel" style={{ flex: 2, background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
              <h4 style={{ margin: '0 0 15px', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Деталізація випадків</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: '#555', textAlign: 'left', borderBottom: '1px solid #222' }}>
                    <th style={{ padding: '10px' }}>Дата</th>
                    <th style={{ padding: '10px' }}>Деталь</th>
                    <th style={{ padding: '10px' }}>Оператор</th>
                    <th style={{ padding: '10px' }}>Етап</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>К-сть</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapStats.list.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '10px', color: '#888' }}>{new Date(h.completed_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: 700 }}>{h.nom_name}</td>
                      <td style={{ padding: '10px', color: '#aaa' }}>{h.operator_name}</td>
                      <td style={{ padding: '10px', color: '#aaa' }}>{h.stage_name}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#ef4444', fontWeight: 900 }}>{h.scrap_qty}</td>
                    </tr>
                  ))}
                  {scrapStats.list.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#555' }}>Брак відсутній за обраний період</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Нові Замовлення</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.totalOrders}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>Активних: <strong style={{ color: '#3b82f6' }}>{generalStats.activeOrders}</strong></div>
            </div>
            
            <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #ff9000' }}>
              <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Наряди (Партії)</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.totalTasks}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>Завершено: <strong style={{ color: '#22c55e' }}>{generalStats.completedTasks}</strong></div>
            </div>

            <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Заплановано комплектів</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.totalSets}</div>
            </div>

            <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Вироблено деталей</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.producedParts}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>Загалом по всіх етапах</div>
            </div>
          </div>
        );
        
      default: return null;
    }
  }

  return (
    <div className="reports-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ padding: '0 20px', height: '70px', background: '#000', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> Назад
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 className="text-secondary" size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Центр Звітів</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button style={{ background: 'rgba(255,144,0,0.1)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.2)', padding: '8px 15px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={14} /> ЕКСПОРТ
          </button>
        </div>
      </nav>

      <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
        
        {/* Top Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          
          <div className="tabs-container" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '12px', border: '1px solid #222' }}>
            <button onClick={() => setActiveTab('warehouse')} className={`report-tab ${activeTab === 'warehouse' ? 'active' : ''}`} style={tabStyle(activeTab === 'warehouse')}>
              <Warehouse size={16} /> СКЛАД
            </button>
            <button onClick={() => setActiveTab('employees')} className={`report-tab ${activeTab === 'employees' ? 'active' : ''}`} style={tabStyle(activeTab === 'employees')}>
              <Users size={16} /> ПРАЦІВНИКИ
            </button>
            <button onClick={() => setActiveTab('scrap')} className={`report-tab ${activeTab === 'scrap' ? 'active' : ''}`} style={tabStyle(activeTab === 'scrap')}>
              <AlertTriangle size={16} /> БРАК
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`report-tab ${activeTab === 'analytics' ? 'active' : ''}`} style={tabStyle(activeTab === 'analytics')}>
              <TrendingUp size={16} /> АНАЛІТИКА
            </button>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Фільтр по назві..."
                style={{ background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '10px 15px 10px 35px', borderRadius: '10px', fontSize: '0.85rem', width: '200px' }}
              />
            </div>
            {/* Date Range */}
            {activeTab !== 'warehouse' && (
              <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '10px', border: '1px solid #222', overflow: 'hidden' }}>
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', padding: '10px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="all">За весь час</option>
                  <option value="month">За місяць</option>
                  <option value="week">За тиждень</option>
                  <option value="today">Сьогодні</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Content */}
        <div style={{ flex: 1 }}>
          {renderTabContent()}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .report-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .report-tab { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border: none; background: transparent; color: #555; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 0.75rem; transition: 0.2s; }
        .report-tab:hover:not(.active) { color: #fff; background: rgba(255,255,255,0.05); }
        .report-tab.active { background: #222; color: #ff9000; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      `}} />
    </div>
  )
}

const tabStyle = (isActive) => ({
  // Handled by CSS classes mostly
})

export default ReportsModule
