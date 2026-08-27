import React, { useMemo, useState } from 'react'
import { PackageCheck, Layers, X, Eye, FileText, ChevronRight } from 'lucide-react'

export const parseSheetInfo = (rawName) => {
  const name = (rawName || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();

  // Extract grade / mark (e.g. T300, T700, КР)
  let grade = 'ІНШЕ';
  const gradeMatch = name.match(/(Т300|Т700|T300|T700|КР|KR)/i);
  if (gradeMatch) {
    grade = gradeMatch[0].toUpperCase().replace('Т', 'T');
  }

  // Extract thickness in mm
  let thickness = 9999;
  let thickMatch = name.match(/(\d+(?:[\.,]\d+)?)\s*(?:мм|mm)/i);
  if (!thickMatch) {
    thickMatch = name.match(/(?:Т300|Т700|T300|T700|КР|KR|\()[\s\-]*(\d+(?:[\.,]\d+)?)/i);
  }
  if (!thickMatch) {
    thickMatch = name.match(/(\d+(?:[\.,]\d+)?)\s*[хx\*]/i);
  }
  if (!thickMatch) {
    thickMatch = name.match(/(\d+(?:[\.,]\d+)?)/);
  }

  if (thickMatch && thickMatch[1]) {
    const val = parseFloat(thickMatch[1].replace(',', '.'));
    if (!isNaN(val)) {
      thickness = val;
    }
  }

  return { name, grade, thickness };
};

export const getBaseName = (name) => (name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();

const SheetsReport = ({
  nomenclatures = [],
  tasks = [],
  orders = [],
  receptionDocs = [],
  workCardHistory = [],
  requests = [],
  inventory = [],
  startDate,
  endDate,
  searchQuery = '',
  filterByDate = () => true
}) => {
  const [selectedSheetForReserve, setSelectedSheetForReserve] = useState(null);

  const sheetsStats = useMemo(() => {
    const stats = {};

    nomenclatures
      .filter(n => n.type === 'raw' || (n.name && (n.name.toLowerCase().includes('лист') || n.name.toLowerCase().includes('карбон'))))
      .forEach(n => {
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
            reserved_so: 0,
            matchingNomIds: []
          };
        }
        if (n.id && !stats[baseName].matchingNomIds.includes(n.id)) {
          stats[baseName].matchingNomIds.push(n.id);
        }
      });

    // На підготуванні & Брак підготовки
    (tasks || []).filter(t => t.step === 'Підготовка' && filterByDate(t.created_at)).forEach(t => {
      if (t.plan_snapshot) {
        let snapshot = t.plan_snapshot;
        if (typeof snapshot === 'string') {
          try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
        }
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
          Object.values(snapshot).forEach(item => {
            const bName = getBaseName(item.name || item.nom_name || '');
            if (stats[bName]) {
              if (t.status !== 'completed' && t.warehouse_conf === 'true') {
                stats[bName].in_prep += Number(item.plan || item.qty || item.quantity || item.need || 0);
              }
              stats[bName].scrap += Number(item.total_scrap || item.actual_scrap || 0);
            }
          });
        }
      }
    });

    // Отримано на СВ & Підготовлено
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

    // Брак з історії карток
    (workCardHistory || []).filter(h => filterByDate(h.completed_at)).forEach(h => {
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

    // Фактично на СВ (Непідготовлені листи)
    (inventory || []).filter(i => i.warehouse === 'production').forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (nom && nom.name.includes('[Непідготовлений]')) {
        const bName = getBaseName(nom.name);
        if (stats[bName]) {
          stats[bName].actual_sv += Number(i.total_qty || 0);
          // Статичне i.reserved_qty не додаємо, щоб уникнути застарілих фантомних резервів СВ
        }
      }
    });

    // Фактично на СО (Підготовлені листи)
    (inventory || []).filter(i => i.warehouse === 'operational').forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (nom && nom.name.includes('[Підготовлений]')) {
        const bName = getBaseName(nom.name);
        if (stats[bName]) {
          stats[bName].actual_so += Number(i.total_qty || 0);
        }
      }
    });

    // Резерв на СО (Підготовлені листи) від ПОГОДЖЕНИХ нарядів та запитів складських боксів
    (requests || []).filter(r => r.status === 'approved' || r.status === 'reserved' || r.status === 'issued').forEach(r => {
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id));
      const inv = inventory.find(i => String(i.id) === String(r.inventory_id));
      const targetName = nom?.name || inv?.name || '';
      if (targetName && targetName.includes('[Підготовлений]')) {
        const bName = getBaseName(targetName);
        if (stats[bName]) {
          stats[bName].reserved_so += Number(r.quantity || 0);
        }
      }
    });

    // Резерв на СВ (Непідготовлені листи) - ТІЛЬКИ НЕРОЗПОЧАТІ активні наряди підготовки (status === 'pending')
    (tasks || []).filter(t => t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true').forEach(t => {
      if (t.plan_snapshot) {
        let snapshot = t.plan_snapshot;
        if (typeof snapshot === 'string') {
          try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
        }
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
          Object.values(snapshot).forEach(item => {
            const bName = getBaseName(item.name || item.nom_name || '');
            if (stats[bName]) {
              const qty = Number(item.plan || item.qty || item.quantity || item.need || 0);
              if (qty > 0) {
                stats[bName].reserved_sv += qty;
              }
            }
          });
        }
      }
    });

    // Filter active items and sort by thickness ascending, then grade, then name
    return Object.values(stats)
      .filter(s => (s.supplied > 0 || s.used > 0 || s.prepared > 0 || s.scrap > 0 || s.actual_sv > 0 || s.actual_so > 0 || s.in_prep > 0 || s.reserved_sv > 0 || s.reserved_so > 0) && (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => {
        const infoA = parseSheetInfo(a.name);
        const infoB = parseSheetInfo(b.name);

        if (infoA.thickness !== infoB.thickness) {
          return infoA.thickness - infoB.thickness;
        }
        if (infoA.grade !== infoB.grade) {
          return infoA.grade.localeCompare(infoB.grade, 'uk-UA');
        }
        return infoA.name.localeCompare(infoB.name, 'uk-UA');
      });

  }, [receptionDocs, requests, workCardHistory, inventory, nomenclatures, tasks, filterByDate, searchQuery]);

  // Overall total reserves calculation
  const totalReservedSV = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.reserved_sv || 0), 0), [sheetsStats]);
  const totalReservedSO = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.reserved_so || 0), 0), [sheetsStats]);

  // Compute reserve details for the selected sheet modal
  const modalReserveDetails = useMemo(() => {
    if (!selectedSheetForReserve) return [];

    const sheet = selectedSheetForReserve;
    const targetNomIds = sheet.matchingNomIds || [];
    const details = [];

    // 1. From material requests (status 'approved', 'reserved', 'issued', 'pending')
    (requests || []).forEach(r => {
      const matchByInventory = inventory.find(i => String(i.id) === String(r.inventory_id) && targetNomIds.includes(String(i.nomenclature_id)));
      const matchByNom = targetNomIds.includes(String(r.nomenclature_id));
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id));
      const inv = inventory.find(i => String(i.id) === String(r.inventory_id));
      const targetName = nom?.name || inv?.name || r.details || '';
      const bName = getBaseName(targetName);
      const matchByName = bName === sheet.name;

      if ((matchByInventory || matchByNom || matchByName) && (r.status === 'approved' || r.status === 'reserved' || r.status === 'issued' || r.status === 'pending')) {
        let orderNum = '—';
        let customer = '—';
        let productName = '—';

        if (r.order_id) {
          const ord = orders.find(o => String(o.id) === String(r.order_id));
          if (ord) {
            orderNum = ord.order_num || `№ ${ord.id.slice(0, 6)}`;
            customer = ord.customer_name || '—';
          }
        }

        if (r.task_id) {
          const task = tasks.find(t => String(t.id) === String(r.task_id));
          if (task) {
            if (orderNum === '—') {
              orderNum = task.naryad_number || task.task_number || '—';
              if (orderNum === '—' && task.order_id) {
                const ord = orders.find(o => String(o.id) === String(task.order_id));
                if (ord) {
                  orderNum = ord.order_num || `№ ${ord.id.slice(0, 6)}`;
                  customer = ord.customer_name || '—';
                }
              }
            }
            if (task.nomenclature_id) {
              const nomObj = nomenclatures.find(n => String(n.id) === String(task.nomenclature_id));
              if (nomObj) productName = nomObj.name;
            }
          }
        }

        const whName = r.warehouse === 'operational' || matchByInventory?.warehouse === 'operational' || targetName.includes('[Підготовлений]') ? 'Склад Оперативний (СО)' : 'Склад Виробництва (СВ)';

        let statusText = 'Очікує видачі';
        if (r.status === 'issued') statusText = 'Видано';
        if (r.status === 'approved' || r.status === 'reserved') statusText = 'Закомплектовано';

        details.push({
          id: `req-${r.id}`,
          source: 'Складський бокс',
          orderNum,
          customer,
          productName,
          warehouse: whName,
          quantity: Number(r.quantity) || 0,
          date: r.created_at ? new Date(r.created_at).toLocaleDateString('uk-UA') : '—',
          status: statusText
        });
      }
    });

    // 2. From active tasks in progress / pending
    (tasks || []).filter(t => t.status !== 'completed' && t.status !== 'cancelled').forEach(t => {
      // For preparation step: ONLY unstarted pending tasks (t.status === 'pending' && t.warehouse_conf === 'true')
      if (t.step === 'Підготовка') {
        if (t.status !== 'pending' || t.warehouse_conf !== 'true') return;
      }
      if (t.plan_snapshot) {
        let snapshot = t.plan_snapshot;
        if (typeof snapshot === 'string') {
          try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
        }
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
          Object.values(snapshot).forEach(item => {
            const nomId = String(item.nomenclature_id || item.child_id || '');
            const bName = (item.name || item.nom_name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();

            if (targetNomIds.includes(nomId) || bName === sheet.name) {
              let orderNum = t.naryad_number || t.task_number || '—';
              let customer = '—';
              if (t.order_id) {
                const ord = orders.find(o => String(o.id) === String(t.order_id));
                if (ord) {
                  if (orderNum === '—') orderNum = ord.order_num || `№ ${ord.id.slice(0, 6)}`;
                  customer = ord.customer_name || '—';
                }
              }

              let productName = t.product_name || '—';
              if (productName === '—' && t.nomenclature_id) {
                const nom = nomenclatures.find(n => String(n.id) === String(t.nomenclature_id));
                if (nom) productName = nom.name;
              }

              const reservedQty = Number(item.sheets || item.plan || item.need || item.quantity || 0);
              if (reservedQty > 0) {
                details.push({
                  id: `task-${t.id}-${item.id || nomId}`,
                  source: `Наряд (${t.step || 'Виробництво'})`,
                  orderNum,
                  customer,
                  productName,
                  warehouse: t.step === 'Підготовка' ? 'Склад Виробництва (СВ)' : 'Склад Оперативний (СО)',
                  quantity: reservedQty,
                  date: t.created_at ? new Date(t.created_at).toLocaleDateString('uk-UA') : '—',
                  status: t.status === 'in-progress' ? 'В роботі' : 'Очікує'
                });
              }
            }
          });
        }
      }
    });

    return details;
  }, [selectedSheetForReserve, requests, tasks, orders, inventory, nomenclatures]);

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      
      {/* LEFT PANEL: 30% WIDTH - РЕЗЕРВИ ЛИСТІВ */}
      <div 
        className="glass-panel" 
        style={{ 
          flex: '0 0 32%', 
          minWidth: '320px', 
          background: '#09090b', 
          padding: '24px', 
          borderRadius: '24px', 
          border: '1px solid #27272a', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#3b82f6', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
            <Layers size={22} color="#3b82f6" /> РЕЗЕРВИ ЛИСТІВ
          </h3>
          <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '3px 10px', borderRadius: '8px', fontWeight: 900 }}>
            {sheetsStats.filter(s => (s.reserved_sv + s.reserved_so) > 0).length} поз. в резерві
          </span>
        </div>

        {/* Reserves Summary Card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px', background: '#121215', padding: '12px', borderRadius: '16px', border: '1px solid #1e1e22' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СВ</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#3b82f6', marginTop: '2px' }}>{totalReservedSV}</div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid #222', borderRight: '1px solid #222' }}>
            <div style={{ fontSize: '0.62rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СО</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#10b981', marginTop: '2px' }}>{totalReservedSO}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 900 }}>Всього</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#ff9000', marginTop: '2px' }}>{totalReservedSV + totalReservedSO}</div>
          </div>
        </div>

        {/* Reserve List by Sheet */}
        <div style={{ maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ color: '#71717a', borderBottom: '1px solid #222', textAlign: 'left' }}>
                <th style={{ padding: '8px 4px', fontWeight: 900 }}>Матеріал</th>
                <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 900, color: '#3b82f6' }}>СВ</th>
                <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 900, color: '#10b981' }}>СО</th>
                <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }}>Разом</th>
              </tr>
            </thead>
            <tbody>
              {sheetsStats.map((stat, idx) => {
                const parsed = parseSheetInfo(stat.name);
                const totalRes = stat.reserved_sv + stat.reserved_so;
                const hasReserve = totalRes > 0;

                return (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderBottom: '1px solid #1a1a1a', 
                      background: hasReserve ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                      transition: '0.2s'
                    }}
                  >
                    <td style={{ padding: '10px 4px', fontWeight: 800, color: '#f4f4f5' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.82rem' }}>{stat.name}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {parsed.thickness !== 9999 && (
                            <span style={{ fontSize: '0.62rem', background: '#27272a', color: '#10b981', padding: '1px 4px', borderRadius: '4px', fontWeight: 900 }}>
                              {parsed.thickness} мм
                            </span>
                          )}
                          {parsed.grade !== 'ІНШЕ' && (
                            <span style={{ fontSize: '0.62rem', background: '#27272a', color: '#3b82f6', padding: '1px 4px', borderRadius: '4px', fontWeight: 900 }}>
                              {parsed.grade}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                      <span style={{ color: stat.reserved_sv > 0 ? '#3b82f6' : '#3f3f46', fontWeight: 900 }}>
                        {stat.reserved_sv}
                      </span>
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                      <span style={{ color: stat.reserved_so > 0 ? '#10b981' : '#3f3f46', fontWeight: 900 }}>
                        {stat.reserved_so}
                      </span>
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSheetForReserve(stat)}
                        style={{
                          background: hasReserve ? 'rgba(255, 144, 0, 0.15)' : '#18181b',
                          border: `1px solid ${hasReserve ? 'rgba(255, 144, 0, 0.4)' : '#27272a'}`,
                          color: hasReserve ? '#ff9000' : '#555',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontWeight: 950,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        title={hasReserve ? 'Натисніть для перегляду деталей резерву під наряди' : 'Немає зарезервованих листів'}
                      >
                        <span>{totalRes}</span>
                        {hasReserve && <ChevronRight size={12} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT PANEL: 70% WIDTH - ДАШБОРД РУХУ ЛИСТІВ */}
      <div 
        className="glass-panel" 
        style={{ 
          flex: '1 1 65%', 
          minWidth: '600px', 
          background: '#09090b', 
          padding: '24px', 
          borderRadius: '24px', 
          border: '1px solid #27272a', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0, color: '#10b981', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
            <PackageCheck size={24} color="#10b981" /> ДАШБОРД РУХУ ЛИСТІВ (МАТЕРІАЛІВ)
          </h3>
          <div style={{ fontSize: '0.78rem', color: '#71717a', background: '#18181b', padding: '6px 14px', borderRadius: '10px', border: '1px solid #27272a', fontWeight: 800 }}>
            Посортовано: товщина (від найменшої до найбільшої) → марка
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: '#09090b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'left', borderBottom: '2px solid #27272a' }}>
                <th style={{ padding: '14px 16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Матеріал (Номенклатура)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6' }}>Отримано на СВ</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b5cf6' }}>На підготуванні</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981' }}>Підготовлено (На СО)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>Витрачено</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444' }}>Брак</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>Залишок СВ (Непідгот.)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Залишок СО (Підгот.)</th>
              </tr>
            </thead>
            <tbody>
              {sheetsStats.map((stat, idx) => {
                const parsed = parseSheetInfo(stat.name);
                const availSV = Math.max(0, stat.actual_sv - stat.reserved_sv);
                const availSO = Math.max(0, stat.actual_so - stat.reserved_so);

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', background: 'transparent', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#18181b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', fontWeight: 900, color: '#f4f4f5', fontSize: '0.92rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{stat.name}</span>
                        {parsed.thickness !== 9999 && (
                          <span style={{ fontSize: '0.7rem', background: '#27272a', color: '#10b981', padding: '2px 6px', borderRadius: '6px', fontWeight: 900 }}>
                            {parsed.thickness} мм
                          </span>
                        )}
                        {parsed.grade !== 'ІНШЕ' && (
                          <span style={{ fontSize: '0.7rem', background: '#27272a', color: '#3b82f6', padding: '2px 6px', borderRadius: '6px', fontWeight: 900 }}>
                            {parsed.grade}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.supplied > 0 ? <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.supplied}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.in_prep > 0 ? <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.in_prep}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.prepared > 0 ? <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.prepared}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.used > 0 ? <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.used}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.scrap > 0 ? <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>{stat.scrap}</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.02)' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSheetForReserve(stat)}
                        style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          color: '#3b82f6',
                          padding: '5px 12px',
                          borderRadius: '10px',
                          fontWeight: 950,
                          fontSize: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title={`Вільних: ${availSV} л | В резерві: ${stat.reserved_sv} л (натисніть для деталей)`}
                      >
                        {availSV}
                        {stat.reserved_sv > 0 && (
                          <span style={{ fontSize: '0.72rem', color: '#ff9000', marginLeft: '4px', fontWeight: 800 }}>
                            ({stat.reserved_sv} рез)
                          </span>
                        )}
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSheetForReserve(stat)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          padding: '5px 12px',
                          borderRadius: '10px',
                          fontWeight: 950,
                          fontSize: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title={`Вільних: ${availSO} л | В резерві: ${stat.reserved_so} л (натисніть для деталей)`}
                      >
                        {availSO}
                        {stat.reserved_so > 0 && (
                          <span style={{ fontSize: '0.72rem', color: '#ff9000', marginLeft: '4px', fontWeight: 800 }}>
                            ({stat.reserved_so} рез)
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      {/* RESERVES DETAILS MODAL */}
      {selectedSheetForReserve && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.85)', 
            zIndex: 9999, 
            display: 'flex', 
            alignItems: 'center', 
            justify: 'center', 
            padding: '20px', 
            backdropFilter: 'blur(6px)' 
          }}
          onClick={() => setSelectedSheetForReserve(null)}
        >
          <div 
            style={{ 
              background: '#09090b', 
              border: '1px solid #27272a', 
              borderRadius: '24px', 
              padding: '30px', 
              width: '100%', 
              maxWidth: '750px', 
              maxHeight: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #27272a', paddingBottom: '15px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#ff9000', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.5px' }}>
                  ДЕТАЛІЗАЦІЯ ЗАРЕЗЕРВОВАНИХ МАТЕРІАЛІВ
                </div>
                <h3 style={{ color: '#fff', margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 950 }}>
                  {selectedSheetForReserve.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedSheetForReserve(null)}
                style={{ background: '#18181b', border: '1px solid #27272a', color: '#aaa', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#27272a'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#18181b'; e.currentTarget.style.color = '#aaa' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Reserve Summary Info Badges */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: '#121215', padding: '14px 18px', borderRadius: '16px', border: '1px solid #1e1e22' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СВ: </span>
                <strong style={{ color: '#3b82f6', fontSize: '1.1rem' }}>{selectedSheetForReserve.reserved_sv} л.</strong>
              </div>
              <div style={{ paddingLeft: '15px', borderLeft: '1px solid #222' }}>
                <span style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СО: </span>
                <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{selectedSheetForReserve.reserved_so} л.</strong>
              </div>
              <div style={{ paddingLeft: '15px', borderLeft: '1px solid #222' }}>
                <span style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 900 }}>Разом в резерві: </span>
                <strong style={{ color: '#ff9000', fontSize: '1.1rem' }}>{selectedSheetForReserve.reserved_sv + selectedSheetForReserve.reserved_so} л.</strong>
              </div>
            </div>

            {/* Modal Content Table */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '5px' }}>
              {modalReserveDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#71717a', background: '#121215', border: '1px dashed #27272a', borderRadius: '16px' }}>
                  <FileText size={32} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <div style={{ fontWeight: 800, color: '#f4f4f5', fontSize: '0.95rem' }}>Деталізовані записи замовлень відсутні.</div>
                  <div style={{ fontSize: '0.8rem', color: '#71717a', marginTop: '4px' }}>
                    Резерв зафіксований в системі загальним обсягом ({selectedSheetForReserve.reserved_sv + selectedSheetForReserve.reserved_so} л).
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #27272a', color: '#71717a', fontWeight: 900 }}>
                      <th style={{ padding: '12px' }}>ДЖЕРЕЛО / НАРЯД</th>
                      <th style={{ padding: '12px' }}>ВИРІБ (ПРОДУКЦІЯ)</th>
                      <th style={{ padding: '12px' }}>СКЛАД</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>ЗАРЕЗЕРВОВАНО</th>
                      <th style={{ padding: '14px', textAlign: 'right' }}>СТАТУС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalReserveDetails.map((detail, idx) => (
                      <tr key={detail.id || idx} style={{ borderBottom: '1px solid #1a1a1a', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '12px', fontWeight: 900 }}>
                          <div style={{ color: '#ff9000', fontSize: '0.9rem' }}>{detail.orderNum}</div>
                          <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '2px' }}>{detail.source}</div>
                        </td>
                        <td style={{ padding: '12px', color: '#f4f4f5', fontWeight: 800 }}>
                          <div>{detail.productName}</div>
                          {detail.customer !== '—' && <div style={{ fontSize: '0.72rem', color: '#71717a' }}>Клієнт: {detail.customer}</div>}
                        </td>
                        <td style={{ padding: '12px', color: detail.warehouse.includes('СВ') ? '#3b82f6' : '#10b981', fontWeight: 800, fontSize: '0.8rem' }}>
                          {detail.warehouse}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 950, color: '#ff9000', fontSize: '1rem' }}>
                          {detail.quantity} <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>л.</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span style={{ background: 'rgba(255,144,0,0.12)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900 }}>
                            {detail.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid #27272a', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSheetForReserve(null)}
                style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 950, fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
              >
                ЗАКРИТИ
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SheetsReport;
