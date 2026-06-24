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
  X,
  Truck,
  Scissors
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
    fetchHistoryRange,
    receptionDocs,
    requests,
    normalize
  } = useMES()

  const [activeTab, setActiveTab] = useState('warehouse')
  const [searchQuery, setSearchQuery] = useState('')
  const [quickPeriod, setQuickPeriod] = useState('')

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [workCardHistory, setWorkCardHistory] = useState(initialHistory)
  const [isSyncing, setIsSyncing] = useState(false)

  // Функція для завантаження даних за період
  const syncHistory = async (startStr, endStr) => {
    setIsSyncing(true)
    let startIso = null
    let endIso = null
    
    if (startStr) {
      const d = new Date(startStr)
      d.setHours(0,0,0,0)
      startIso = d.toISOString()
    } else {
      // Default to 1 month ago if no start date to avoid fetching everything
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      startIso = d.toISOString()
    }
    
    if (endStr) {
      const d = new Date(endStr)
      d.setHours(23,59,59,999)
      endIso = d.toISOString()
    }
    
    const data = await fetchHistoryRange(startIso, endIso)
    setWorkCardHistory(data)
    setIsSyncing(false)
  }

  // Слідкуємо за зміною періоду
  React.useEffect(() => {
    if (startDate || endDate) {
      syncHistory(startDate, endDate)
    } else {
      setWorkCardHistory(initialHistory)
    }
  }, [startDate, endDate, initialHistory])

  // Date Filtering Logic
  const handleQuickDateSelect = (e) => {
    const val = e.target.value;
    if (!val) return;
    
    const today = new Date();
    const toISO = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = toISO(today);
    let startStr = '';
    let endStr = todayStr;

    if (val === 'today') {
      startStr = todayStr;
    } else if (val === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      startStr = toISO(yest);
      endStr = startStr;
    } else if (val === '3days') {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      startStr = toISO(d);
    } else if (val === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startStr = toISO(d);
    } else if (val === 'month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      startStr = toISO(d);
    } else if (val === 'quarter') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      startStr = toISO(d);
    } else if (val === 'halfyear') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      startStr = toISO(d);
    } else if (val === 'year') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      startStr = toISO(d);
    }

    setStartDate(startStr);
    setEndDate(endStr);
    setQuickPeriod(val);
  };

  const filterByDate = (dateString) => {
    if (!startDate && !endDate) return true;
    if (!dateString) return false;
    const d = new Date(dateString);
    
    if (startDate) {
      const s = new Date(startDate)
      s.setHours(0,0,0,0)
      if (d < s) return false;
    }
    if (endDate) {
      const e = new Date(endDate)
      e.setHours(23,59,59,999)
      if (d > e) return false;
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
        cat1: 0,
        cat2: 0,
        cat3: 0,
        cat4: 0,
        operations: 0 
      };
    });

    // Add Work Card History
    workCardHistory.filter(h => filterByDate(h.completed_at)).forEach(h => {
      // Match by exact login or try to match name loosely
      const user = systemUsers.find(u => u.login === h.operator_name || `${u.first_name} ${u.last_name}` === h.operator_name);
      const key = user ? user.login : h.operator_name;
      
      if (!stats[key]) {
        stats[key] = { name: key, position: 'Невідомо', department: '-', produced: 0, scrap: 0, cat1: 0, cat2: 0, cat3: 0, cat4: 0, operations: 0 };
      }
      
      stats[key].produced += Number(h.qty_completed) || 0;
      stats[key].scrap += Number(h.scrap_qty) || 0;
      stats[key].operations += 1;

      // Extract categories if present
      if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
        try {
          const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
          if (match) {
            const cats = JSON.parse(match[1]);
            stats[key].cat1 += Number(cats.cat1 || 0);
            stats[key].cat2 += Number(cats.cat2 || 0);
            stats[key].cat3 += Number(cats.cat3 || 0);
            stats[key].cat4 += Number(cats.cat4 || 0);
          }
        } catch (e) {}
      }
    });

    return Object.values(stats)
      .filter(s => s.operations > 0 || (searchQuery && s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.produced - a.produced);
  }, [systemUsers, workCardHistory, startDate, endDate, searchQuery])

  // 3. Scrap Report
  const scrapStats = useMemo(() => {
    const list = workCardHistory
      .filter(h => Number(h.scrap_qty) > 0 && filterByDate(h.completed_at))
      .map(h => {
        const nom = nomenclatures.find(n => n.id === h.nomenclature_id);
        
        let cat1 = 0, cat2 = 0, cat3 = 0, cat4 = 0;
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
            if (match) {
              const cats = JSON.parse(match[1]);
              cat1 = Number(cats.cat1 || 0);
              cat2 = Number(cats.cat2 || 0);
              cat3 = Number(cats.cat3 || 0);
              cat4 = Number(cats.cat4 || 0);
            }
          } catch (e) {}
        }
        
        const totalClassified = cat1 + cat2 + cat3 + cat4;
        const unclassified = Math.max(0, Number(h.scrap_qty) - totalClassified);

        return {
          ...h,
          nom_name: nom ? nom.name : 'Невідома деталь',
          cat1,
          cat2,
          cat3,
          cat4,
          unclassified
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
  }, [workCardHistory, nomenclatures, startDate, endDate, searchQuery])

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
  }, [tasks, orders, workCardHistory, startDate, endDate])

  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  // 5. Supply Report
  const supplyStats = useMemo(() => {
    const stats = {};
    
    // Process Reception Docs (Supplied) - Only External Supplies (where source_warehouse is empty)
    (receptionDocs || []).filter(d => d.status === 'completed' && !d.source_warehouse && filterByDate(d.created_at)).forEach(doc => {
      (doc.items || []).forEach(item => {
        const nomId = item.nomenclature_id || (nomenclatures.find(n => normalize(n.name) === normalize(item.name || parseMaterialName(item.reqDetails || item.details)))?.id);
        const name = nomenclatures.find(n => String(n.id) === String(nomId))?.name || item.name || parseMaterialName(item.reqDetails || item.details) || 'Невідомий матеріал';
        
        const key = nomId ? String(nomId) : normalize(name);
        if (!stats[key]) stats[key] = { id: nomId, name, supplied: 0, used: 0, actual: 0 };
        stats[key].supplied += Number(item.qty || item.quantity || item.needed || 0);
      });
    });

    // Process Requests (Used)
    (requests || []).filter(r => (r.status === 'issued' || r.status === 'completed') && filterByDate(r.created_at)).forEach(r => {
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id));
      const name = nom ? nom.name : parseMaterialName(r.details);
      
      const key = r.nomenclature_id ? String(r.nomenclature_id) : normalize(name || 'Невідомий матеріал');
      if (!stats[key]) stats[key] = { id: r.nomenclature_id, name: name || 'Невідомий матеріал', supplied: 0, used: 0, actual: 0 };
      stats[key].used += Number(r.quantity || 0);
    });

    // Calculate actual inventory balances
    Object.keys(stats).forEach(key => {
        const stat = stats[key];
        const invItems = (inventory || []).filter(i => {
          if (stat.id) return String(i.nomenclature_id) === String(stat.id);
          const nomName = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id))?.name || i.name || '';
          return normalize(nomName) === normalize(stat.name);
        });
        stat.actual = invItems.reduce((acc, curr) => acc + (Number(curr.total_qty) || 0), 0);
    });

    return Object.values(stats)
      .filter(s => (s.supplied > 0 || s.used > 0) && (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.supplied - a.supplied);
  }, [receptionDocs, requests, inventory, nomenclatures, startDate, endDate, searchQuery])

  // 6. Sheets Movement Report
  const sheetsStats = useMemo(() => {
    const stats = {};

    const getBaseName = (name) => name.replace(/\[(Непідготовлений|Підготовлений)\]/i, '').trim();

    nomenclatures.filter(n => n.type === 'raw' || n.name.toLowerCase().includes('лист') || n.name.toLowerCase().includes('карбон')).forEach(n => {
      const baseName = getBaseName(n.name);
      if (!stats[baseName]) {
        stats[baseName] = {
          name: baseName,
          in_prep: 0,
          prepared: 0,
          supplied: 0,
          used: 0,
          scrap: 0,
          actual_sv: 0,
          reserved_sv: 0,
          actual_so: 0,
          reserved_so: 0
        };
      }
    });

    // На підготуванні & Брак підготовки
    tasks.filter(t => t.step === 'Підготовка' && filterByDate(t.created_at)).forEach(t => {
      if (t.plan_snapshot) {
        let snapshot = t.plan_snapshot;
        if (typeof snapshot === 'string') {
          try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
        }
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
          Object.values(snapshot).forEach(item => {
            const bName = getBaseName(item.name || item.nom_name || '');
            if (stats[bName]) {
              if (t.status !== 'completed' && t.warehouse_conf === true) {
                stats[bName].in_prep += Number(item.plan || item.qty || item.quantity || item.need || 0);
              }
              stats[bName].scrap += Number(item.total_scrap || item.actual_scrap || 0);
            }
          });
        }
      }
    });

    (receptionDocs || []).filter(d => d.status === 'completed' && filterByDate(d.created_at)).forEach(doc => {
      (doc.items || []).forEach(item => {
        const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id));
        if (nom) {
          const bName = getBaseName(nom.name);
          if (stats[bName]) {
            if (doc.task_id && nom.name.includes('[Підготовлений]')) {
              stats[bName].prepared += Number(item.qty || item.quantity || item.needed || 0);
            } else if (!doc.source_warehouse && nom.name.includes('[Непідготовлений]')) {
              stats[bName].supplied += Number(item.qty || item.quantity || item.needed || 0);
            }
          }
        }
      });
    });

    // Брак з історії карток (якщо є)
    workCardHistory.filter(h => filterByDate(h.completed_at)).forEach(h => {
      const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id));
      if (nom) {
        const bName = getBaseName(nom.name);
        if (stats[bName]) {
          stats[bName].scrap += Number(h.scrap_qty || 0);
        }
      }
    });

    // Витрачено
    (requests || []).filter(r => (r.status === 'issued' || r.status === 'completed') && filterByDate(r.created_at)).forEach(r => {
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id));
      if (nom && nom.name.includes('[Підготовлений]')) {
        const bName = getBaseName(nom.name);
        if (stats[bName]) {
          stats[bName].used += Number(r.quantity || 0);
        }
      }
    });

    // Фактично на СВ (Непідготовлені)
    (inventory || []).filter(i => i.warehouse === 'production').forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (nom && nom.name.includes('[Непідготовлений]')) {
        const bName = getBaseName(nom.name);
        if (stats[bName]) {
          stats[bName].actual_sv += Number(i.total_qty || 0);
          stats[bName].reserved_sv += Number(i.reserved_qty || 0);
        }
      }
    });

    // Фактично на СО (Підготовлені)
    (inventory || []).filter(i => i.warehouse === 'operational').forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (nom && nom.name.includes('[Підготовлений]')) {
        const bName = getBaseName(nom.name);
        if (stats[bName]) {
          stats[bName].actual_so += Number(i.total_qty || 0);
          stats[bName].reserved_so += Number(i.reserved_qty || 0);
        }
      }
    });

    return Object.values(stats)
      .filter(s => (s.supplied > 0 || s.used > 0 || s.prepared > 0 || s.scrap > 0 || s.actual_sv > 0 || s.actual_so > 0 || s.in_prep > 0) && (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.supplied + b.prepared - a.supplied - a.prepared);

  }, [receptionDocs, requests, workCardHistory, inventory, nomenclatures, tasks, startDate, endDate, searchQuery]);

  // 7. Cutters Movement Report
  const cuttersStats = useMemo(() => {
    const stats = {};

    nomenclatures
      .filter(n => n.type === 'consumable' && n.name.trim().toLowerCase() !== 'фреза' && n.name.toLowerCase().includes('фреза'))
      .forEach(n => {
        const cleanName = n.name.trim();
        if (!stats[cleanName]) {
          stats[cleanName] = {
            id: n.id,
            name: cleanName,
            supplied: 0,
            used: 0,
            actual: 0,
            reserved: 0
          };
        }
      });

    // Отримано на склад (Поставки)
    (receptionDocs || []).filter(d => d.status === 'completed' && filterByDate(d.created_at)).forEach(doc => {
      (doc.items || []).forEach(item => {
        const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id));
        if (nom && nom.type === 'consumable' && nom.name.toLowerCase().includes('фреза')) {
          const cleanName = nom.name.trim();
          if (stats[cleanName]) {
            stats[cleanName].supplied += Number(item.qty || item.quantity || item.needed || 0);
          }
        }
      });
    });

    // Використано фрез з історії деталей
    workCardHistory.filter(h => filterByDate(h.completed_at)).forEach(h => {
      if (h.card_info && h.card_info.includes('[CUTTERS_BREAKDOWN:')) {
        try {
          const match = h.card_info.match(/\[CUTTERS_BREAKDOWN:({.*?})\]/);
          if (match && match[1]) {
            const breakdown = JSON.parse(match[1]);
            Object.entries(breakdown).forEach(([cutterName, qty]) => {
              const cleanCutterName = cutterName.trim();
              if (stats[cleanCutterName]) {
                stats[cleanCutterName].used += Number(qty) || 0;
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
    });

    // Фактично на Складі
    (inventory || []).forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (nom && nom.type === 'consumable' && nom.name.toLowerCase().includes('фреза')) {
        const cleanName = nom.name.trim();
        if (stats[cleanName]) {
          stats[cleanName].actual += Number(i.total_qty || 0);
          stats[cleanName].reserved += Number(i.reserved_qty || 0);
        }
      }
    });

    return Object.values(stats)
      .filter(s => (s.supplied > 0 || s.used > 0 || s.actual > 0) && (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.used - a.used);
  }, [receptionDocs, workCardHistory, inventory, nomenclatures, startDate, endDate, searchQuery]);

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
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#10b981' }}>Кат. 1</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#eab308' }}>Кат. 2</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#f97316' }}>Кат. 3</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#ef4444' }}>Кат. 4</th>
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
                      <td style={{ padding: '15px', textAlign: 'center', color: emp.cat1 > 0 ? '#10b981' : '#444', fontWeight: emp.cat1 > 0 ? '900' : '400' }}>{emp.cat1}</td>
                      <td style={{ padding: '15px', textAlign: 'center', color: emp.cat2 > 0 ? '#eab308' : '#444', fontWeight: emp.cat2 > 0 ? '900' : '400' }}>{emp.cat2}</td>
                      <td style={{ padding: '15px', textAlign: 'center', color: emp.cat3 > 0 ? '#f97316' : '#444', fontWeight: emp.cat3 > 0 ? '900' : '400' }}>{emp.cat3}</td>
                      <td style={{ padding: '15px', textAlign: 'center', color: emp.cat4 > 0 ? '#ef4444' : '#444', fontWeight: emp.cat4 > 0 ? '900' : '400' }}>{emp.cat4}</td>
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
                  <tr style={{ color: '#555', textAlign: 'left', borderBottom: '2px solid #222' }}>
                    <th style={{ padding: '10px' }}>Дата</th>
                    <th style={{ padding: '10px' }}>Деталь</th>
                    <th style={{ padding: '10px' }}>Оператор</th>
                    <th style={{ padding: '10px' }}>Етап</th>
                    <th style={{ padding: '10px', textAlign: 'center', color: '#10b981' }}>Кат. 1</th>
                    <th style={{ padding: '10px', textAlign: 'center', color: '#eab308' }}>Кат. 2</th>
                    <th style={{ padding: '10px', textAlign: 'center', color: '#f97316' }}>Кат. 3</th>
                    <th style={{ padding: '10px', textAlign: 'center', color: '#ef4444' }}>Кат. 4</th>
                    <th style={{ padding: '10px', textAlign: 'center', color: '#666' }}>Не класиф.</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Всього</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapStats.list.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '10px', color: '#888' }}>{new Date(h.completed_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: 700 }}>{h.nom_name}</td>
                      <td style={{ padding: '10px', color: '#aaa' }}>{h.operator_name}</td>
                      <td style={{ padding: '10px', color: '#aaa' }}>{h.stage_name}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: h.cat1 > 0 ? '#10b981' : '#444', fontWeight: h.cat1 > 0 ? '900' : '400' }}>{h.cat1 || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: h.cat2 > 0 ? '#eab308' : '#444', fontWeight: h.cat2 > 0 ? '900' : '400' }}>{h.cat2 || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: h.cat3 > 0 ? '#f97316' : '#444', fontWeight: h.cat3 > 0 ? '900' : '400' }}>{h.cat3 || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: h.cat4 > 0 ? '#ef4444' : '#444', fontWeight: h.cat4 > 0 ? '900' : '400' }}>{h.cat4 || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: h.unclassified > 0 ? '#888' : '#333', fontWeight: h.unclassified > 0 ? '700' : '400' }}>{h.unclassified || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#ef4444', fontWeight: 900 }}>{h.scrap_qty}</td>
                    </tr>
                  ))}
                  {scrapStats.list.length === 0 && (
                    <tr><td colSpan="10" style={{ padding: '20px', textAlign: 'center', color: '#555' }}>Брак відсутній за обраний період</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'supplies':
        return (
          <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
            <h3 style={{ margin: '0 0 20px', color: '#ff9000', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' }}>
              <Truck size={20} /> Рух матеріалів (Поставки та Витрати)
            </h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#0a0a0a', color: '#666', textAlign: 'left' }}>
                  <th style={{ padding: '15px', borderBottom: '1px solid #222', width: '35%' }}>Матеріал / Номенклатура</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Поставлено</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Витрачено</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Розрахунковий Залишок</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Фактично на Складі</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Розбіжність</th>
                </tr>
              </thead>
              <tbody>
                {supplyStats.map((stat, idx) => {
                  const calculatedBalance = stat.supplied - stat.used;
                  const diff = stat.actual - calculatedBalance;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '15px', fontWeight: 800, color: '#fff' }}>{stat.name}</td>
                      <td style={{ padding: '15px', textAlign: 'center', color: '#3b82f6', fontWeight: 900 }}>{stat.supplied > 0 ? `+${stat.supplied}` : 0}</td>
                      <td style={{ padding: '15px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{stat.used > 0 ? `-${stat.used}` : 0}</td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }}>{calculatedBalance}</td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#22c55e' }}>{stat.actual}</td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        {diff === 0 ? (
                          <span style={{ color: '#555', fontWeight: 700 }}>ОК</span>
                        ) : diff > 0 ? (
                          <span style={{ color: '#22c55e', fontWeight: 900, background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: '4px' }}>+{diff} (Надлишок)</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 900, background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '4px' }}>{diff} (Дефіцит)</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {supplyStats.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }}>
                      Немає даних про поставки або витрати матеріалів за обраний період.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );

      case 'sheets':
        return (
          <div className="glass-panel" style={{ background: '#09090b', padding: '30px', borderRadius: '24px', border: '1px solid #27272a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 25px', color: '#10b981', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '12px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
              <PackageCheck size={24} color="#10b981" /> ДАШБОРД РУХУ ЛИСТІВ (МАТЕРІАЛІВ)
            </h3>
            
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: '#09090b' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'left', borderBottom: '2px solid #27272a' }}>
                    <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Матеріал (Номенклатура)</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6' }}>Отримано на СВ</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b5cf6' }}>На підготуванні</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981' }}>Підготовлено (На СО)</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>Витрачено</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444' }}>Брак</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>Залишок СВ (Непідгот.)</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Залишок СО (Підгот.)</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetsStats.map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', background: 'transparent', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#18181b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '16px 20px', fontWeight: 900, color: '#f4f4f5', fontSize: '0.95rem' }}>{stat.name}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.supplied > 0 ? <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.supplied}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.in_prep > 0 ? <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.in_prep}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.prepared > 0 ? <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.prepared}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.used > 0 ? <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.used}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.scrap > 0 ? <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.scrap}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.02)' }}>
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '6px 14px', borderRadius: '10px', fontWeight: 950, fontSize: '1.05rem' }}>
                          {Math.max(0, stat.actual_sv - stat.reserved_sv)}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '6px 14px', borderRadius: '10px', fontWeight: 950, fontSize: '1.05rem' }}>
                          {Math.max(0, stat.actual_so - stat.reserved_so)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sheetsStats.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
                        Немає даних за обраний період або пошуковий запит
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'cutters':
        return (
          <div className="glass-panel" style={{ background: '#09090b', padding: '30px', borderRadius: '24px', border: '1px solid #27272a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 25px', color: '#ff9000', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '12px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
              <Scissors size={24} color="#ff9000" /> ДАШБОРД ВИКОРИСТАННЯ ФРЕЗ
            </h3>
            
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: '#09090b' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'left', borderBottom: '2px solid #27272a' }}>
                    <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Назва фрези (Розхідник)</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6' }}>Отримано на склад</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444' }}>Використано (шт)</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Фактично на Складі</th>
                  </tr>
                </thead>
                <tbody>
                  {cuttersStats.map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', background: 'transparent', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#18181b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '16px 20px', fontWeight: 900, color: '#f4f4f5', fontSize: '0.95rem' }}>{stat.name}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.supplied > 0 ? <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.supplied}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {stat.used > 0 ? <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.used}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '6px 14px', borderRadius: '10px', fontWeight: 950, fontSize: '1.05rem' }}>
                          {Math.max(0, stat.actual - stat.reserved)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {cuttersStats.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
                        Немає даних про використання фрез
                      </td>
                    </tr>
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
            <button onClick={() => setActiveTab('supplies')} className={`report-tab ${activeTab === 'supplies' ? 'active' : ''}`} style={tabStyle(activeTab === 'supplies')}>
              <Truck size={16} /> ПОСТАВКИ
            </button>
            <button onClick={() => setActiveTab('sheets')} className={`report-tab ${activeTab === 'sheets' ? 'active' : ''}`} style={tabStyle(activeTab === 'sheets')}>
              <PackageCheck size={16} /> ЛИСТИ
            </button>
            <button onClick={() => setActiveTab('cutters')} className={`report-tab ${activeTab === 'cutters' ? 'active' : ''}`} style={tabStyle(activeTab === 'cutters')}>
              <Scissors size={16} /> ФРЕЗИ
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
              <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0a', borderRadius: '10px', border: '1px solid #222', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 15px', borderRight: '1px solid #222' }}>
                  <Calendar size={14} color="#888" style={{ marginRight: '8px' }} />
                  <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>Період:</span>
                </div>
                <input 
                  type="date" 
                  value={startDate} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => { setStartDate(e.target.value); setQuickPeriod(''); }}
                  style={{ background: 'transparent', border: 'none', color: startDate ? '#fff' : '#555', padding: '10px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'dark' }}
                />
                <span style={{ color: '#555' }}>—</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => { setEndDate(e.target.value); setQuickPeriod(''); }}
                  style={{ background: 'transparent', border: 'none', color: endDate ? '#fff' : '#555', padding: '10px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'dark' }}
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); setQuickPeriod(''); }}
                    style={{ background: 'transparent', border: 'none', padding: '10px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444', borderLeft: '1px solid #222' }}
                    title="Очистити період"
                  >
                    <X size={14} />
                  </button>
                )}
                <select 
                  onChange={handleQuickDateSelect} 
                  value={quickPeriod}
                  style={{ background: '#0a0a0a', border: 'none', borderLeft: '1px solid #222', color: '#ff9000', padding: '10px 15px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase' }}
                >
                  <option value="" disabled hidden>ОБРАТИ ПЕРІОД</option>
                  <option value="today">Сьогодні</option>
                  <option value="yesterday">Вчора</option>
                  <option value="3days">Останні 3 дні</option>
                  <option value="week">Останній тиждень</option>
                  <option value="month">Останній місяць</option>
                  <option value="quarter">Останній квартал</option>
                  <option value="halfyear">Останні пів року</option>
                  <option value="year">Останній рік</option>
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
