import React, { useMemo, useState } from 'react'
import { PackageCheck, Layers, X, FileText, ChevronRight, Scissors, AlertCircle, CheckCircle2 } from 'lucide-react'

export const parseSheetInfo = (rawName) => {
  const name = (rawName || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();

  // Extract grade / mark (e.g. T300, T700, КР)
  let grade = null;
  const gradeMatch = name.match(/(Т300|Т700|T300|T700|КР|KR)/i);
  if (gradeMatch) {
    grade = gradeMatch[0].toUpperCase().replace('Т', 'T');
  }

  // Extract thickness in mm (sheet thickness is realistically between 0.2mm and 30mm)
  let thickness = 9999;
  
  // 1. Explicit thickness marker: e.g. "(2.5мм)", "(2мм)", "2.5 мм", "3mm"
  let thickMatch = name.match(/(\d+(?:[\.,]\d+)?)\s*(?:мм|mm)\b/i);
  
  // 2. Thickness in parentheses or right after grade, e.g. "T300 (2.5)", "T700 (3)", "T300 2.5"
  if (!thickMatch) {
    thickMatch = name.match(/(?:Т300|Т700|T300|T700|КР|KR)[\s\-\(]*(\d+(?:[\.,]\d+)?)/i);
  }

  if (thickMatch && thickMatch[1]) {
    const val = parseFloat(thickMatch[1].replace(',', '.'));
    // Sheet thickness must be in realistic range (0.2mm to 30mm)
    if (!isNaN(val) && val > 0.1 && val <= 30) {
      thickness = val;
    }
  }

  return { name, grade: grade || 'ІНШЕ', thickness };
};

export const getBaseName = (name) => {
  if (!name) return '';
  const parsed = parseSheetInfo(name);
  
  // Only generate "Лист T300 (Xмм)" if grade is known OR thickness is valid (<= 30mm)
  if (parsed && parsed.thickness !== 9999) {
    const brand = parsed.grade !== 'ІНШЕ' ? parsed.grade.replace('T', 'Т') : '';
    return brand ? `Лист ${brand} (${parsed.thickness}мм)` : `Лист (${parsed.thickness}мм)`;
  }

  // Fallback to original clean nomenclature name without [Непідготовлений]/[Підготовлений]
  return (name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();
};

/**
 * Resolves the corresponding Sheet base name (e.g. "Лист Т300 (2мм)") from
 * a detail part, sheet nomenclature, inventory row, or task snapshot.
 */
export const resolveSheetBaseName = (target, { nomenclatures = [], tasks = [], inventory = [] } = {}) => {
  if (!target) return null;

  // 1. If string name
  if (typeof target === 'string') {
    const parsed = parseSheetInfo(target);
    if (parsed.thickness !== 9999) return getBaseName(target);
  }

  // 2. If object or ID
  let nom = typeof target === 'object' && target.name ? target : (nomenclatures || []).find(n => String(n.id) === String(target));
  if (!nom && typeof target === 'string') {
    const inv = (inventory || []).find(i => String(i.id) === String(target));
    if (inv) {
      const parsed = parseSheetInfo(inv.name);
      if (parsed.thickness !== 9999) return getBaseName(inv.name);
      if (inv.nomenclature_id) {
        nom = (nomenclatures || []).find(n => String(n.id) === String(inv.nomenclature_id));
      }
    }
  }

  if (!nom) return null;

  // If already a raw sheet / plate nomenclature
  if (nom.type === 'raw' || (nom.name && (nom.name.toLowerCase().includes('лист') || nom.name.toLowerCase().includes('карбон')))) {
    return getBaseName(nom.name);
  }

  // 3. nom.rule_params?.rawSheet
  if (nom.rule_params?.rawSheet) {
    const bName = getBaseName(nom.rule_params.rawSheet);
    if (bName) return bName;
  }

  // 4. nom.default_material_id
  const defaultMatId = nom.default_material_id || nom.rule_params?.default_material_id;
  if (defaultMatId) {
    const matNom = (nomenclatures || []).find(n => String(n.id) === String(defaultMatId));
    if (matNom) return getBaseName(matNom.name);
    const inv = (inventory || []).find(i => String(i.id) === String(defaultMatId) || String(i.nomenclature_id) === String(defaultMatId));
    if (inv) return getBaseName(inv.name);
  }

  // 5. nom.material_type or nom.material
  const matType = nom.material_type || nom.material || nom.rule_params?.material;
  if (matType) {
    const parsed = parseSheetInfo(matType);
    if (parsed.thickness !== 9999) {
      const brand = parsed.grade !== 'ІНШЕ' ? parsed.grade.replace('T', 'Т') : 'Т300';
      return `Лист ${brand} (${parsed.thickness}мм)`;
    }
  }

  // 6. Parse thickness and grade directly from detail part code/name (e.g. "F415-421-ІП27-В-3-26", "KF-Пластинка-3-162")
  const parsedName = parseSheetInfo(nom.name);
  let thickness = parsedName.thickness;
  let grade = parsedName.grade !== 'ІНШЕ' ? parsedName.grade : null;

  if (thickness === 9999) {
    // Check standard CENTRUM part pattern: Name-Thickness-UnitsPerSheet (e.g. "Перемичка-2-66", "Верх-2-34", "Низ-3-26")
    const twoNumberMatch = nom.name.match(/[-_](\d+(?:[.,]\d+)?)[-_](\d+)$/);
    if (twoNumberMatch && twoNumberMatch[1]) {
      const val = parseFloat(twoNumberMatch[1].replace(',', '.'));
      if (val > 0.1 && val <= 30) thickness = val;
    }
  }

  if (thickness === 9999) {
    const m = nom.name.match(/[-_](\d+(?:[.,]\d+)?)(?:[-_][A-Za-z0-9а-яєіїґ]+)?$/i) ||
              nom.name.match(/[-_](\d+(?:[.,]\d+)?)(?:[-_]|$)/);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > 0.1 && val <= 30) thickness = val;
    }
  }

  if (!grade) {
    if (/700/i.test(nom.name)) grade = 'T700';
    else grade = 'T300';
  }

  if (thickness !== 9999) {
    return `Лист ${grade.replace('T', 'Т')} (${thickness}мм)`;
  }

  return null;
};

/**
 * Checks whether an item / request / inventory row represents a genuine sheet material
 * and NOT a finished manufactured part (e.g. drone crosses, brackets, screws).
 */
export const isSheetNomenclatureOrInv = (item, nom = null) => {
  if (!item && !nom) return false;
  const name = (item?.name || nom?.name || item?.details || '').toLowerCase();
  const type = item?.type || nom?.type || '';
  const category = item?.category || nom?.category || '';
  const groupId = item?.group_id || nom?.group_id || '';

  // Finished parts and assemblies are NEVER sheets
  if (type === 'part' || type === 'assembly' || category === 'part') return false;
  if (name.includes('хрестик') || name.includes('пластинка') || name.includes('кронштейн') || name.includes('пропелер') || name.includes('луч')) {
    return false;
  }

  // Explicit sheet categorization
  if (category === 'sheet') return true;
  if (groupId === 'grp_raw_sheets' || groupId === 'grp_prepared_sheets') return true;
  if (name.includes('лист') || name.includes('карбонова пластина')) return true;
  if (type === 'raw' && (name.includes('т300') || name.includes('т700') || name.includes('t300') || name.includes('t700'))) return true;

  return false;
};

/**
 * Calculates real-time cutting progress for a specific task and sheet base name
 * directly from work cards.
 */
export const getTaskCuttingProgressForSheet = (taskId, targetSheetBaseName, { workCards = [], nomenclatures = [], tasks = [], inventory = [] } = {}) => {
  if (!taskId || !targetSheetBaseName) return null;

  const taskObj = (tasks || []).find(t => String(t.id) === String(taskId));
  const taskCards = (workCards || []).filter(c => 
    String(c.task_id || '').trim() === String(taskId || '').trim() ||
    (c.order_id && taskObj?.order_id && String(c.order_id).trim() === String(taskObj.order_id).trim())
  );
  if (taskCards.length === 0) return null;

  // Filter cards associated with this sheet
  const sheetCards = taskCards.filter(c => {
    const op = String(c.operation || '').toLowerCase();
    // Exclude cards that are buffer reservations or SGP finished goods
    if (op.includes('склад бз') || op.includes('склад сгп') || op.includes('пакування')) return false;
    if (String(c.card_info || '').includes('[BZ_RESERVATION') && !String(c.card_info || '').includes('[SHEETS:')) return false;

    // 1. Check card_info for [SHEET:...] tag
    const sheetTagMatch = (c.card_info || '').match(/\[SHEET:([^\]]+)\]/i);
    if (sheetTagMatch && getBaseName(sheetTagMatch[1]) === targetSheetBaseName) return true;

    // 2. Check nomenclature of the card
    const bName = resolveSheetBaseName(c.nomenclature_id, { nomenclatures, tasks, inventory });
    if (bName && bName === targetSheetBaseName) return true;

    // 3. Check directly in task plan_snapshot parts
    if (taskObj?.plan_snapshot) {
      let snap = taskObj.plan_snapshot;
      if (typeof snap === 'string') {
        try { snap = JSON.parse(snap); } catch (e) { snap = {}; }
      }
      const partEntry = snap[c.nomenclature_id] || Object.values(snap).find(p => p && typeof p === 'object' && (String(p.nomenclature_id) === String(c.nomenclature_id) || String(p.id) === String(c.nomenclature_id)));
      if (partEntry) {
        const mat = getBaseName(partEntry.material || partEntry.sheet || partEntry.rawSheet || partEntry.matName || '');
        if (mat === targetSheetBaseName) return true;
      }

      // Check task plan_snapshot.materialSummary
      if (snap.materialSummary) {
        const list = Object.values(snap.materialSummary || {});
        const matchedMat = list.find(m => {
          const mName = getBaseName(m.matName || m.name || '');
          return mName === targetSheetBaseName;
        });
        if (matchedMat) {
          const nom = (nomenclatures || []).find(n => String(n.id) === String(c.nomenclature_id));
          if (nom?.name && Array.isArray(matchedMat.components) && matchedMat.components.some(comp => String(comp).toLowerCase().includes(nom.name.toLowerCase()))) {
            return true;
          }
        }
      }
    }

    return false;
  });

  if (sheetCards.length === 0) return null;

  let totalSheetsPlanned = 0;
  let cutSheets = 0;
  let inProgressSheets = 0;
  let newSheets = 0;

  let cutCardsCount = 0;
  let inProgressCardsCount = 0;
  let newCardsCount = 0;

  sheetCards.forEach(c => {
    let sheets = Number(c.actual_sheets ?? c.actualSheets ?? 0);
    if (!sheets) {
      const match = (c.card_info || '').match(/\[SHEETS:(\d+(?:[.,]\d+)?)\]/i) ||
                    (c.card_info || '').match(/\((\d+(?:[.,]\d+)?)\s*л\.?\)/i);
      if (match && match[1]) sheets = parseFloat(match[1].replace(',', '.'));
    }
    if (!sheets) {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(c.nomenclature_id));
      const unitsPerSheet = Number(nom?.rule_params?.unitsPerSheet) || Number(nom?.units_per_sheet) || 1;
      const qty = Number(c.quantity || 0);
      sheets = qty > 0 ? Math.ceil(qty / unitsPerSheet) : 0;
    }

    totalSheetsPlanned += sheets;

    const op = String(c.operation || '').toLowerCase();
    const status = String(c.status || '').toLowerCase();
    const info = String(c.card_info || '');

    // Card cutting is finished if:
    // - Card progressed to next operation (tumbling, CNC milling, buffer, etc.)
    // - Card status is buffer or completed
    // - Card has [SHEETS_DEDUCTED:true]
    // - Card recorded completed parts
    const isCuttingFinished = 
      (!op.includes('розкрій') && !op.includes('cnc') && !op.includes('порізка') && !op.includes('лазер') && !op.includes('плазма')) ||
      ['at-buffer', 'waiting-buffer', 'completed'].includes(status) ||
      info.includes('[SHEETS_DEDUCTED:true]') ||
      (Number(c.qty_completed) > 0);

    if (isCuttingFinished) {
      cutSheets += sheets;
      cutCardsCount += 1;
    } else if (status === 'in-progress' || status === 'active') {
      inProgressSheets += sheets;
      inProgressCardsCount += 1;
    } else {
      newSheets += sheets;
      newCardsCount += 1;
    }
  });

  return {
    totalCardsCount: sheetCards.length,
    cutCardsCount,
    inProgressCardsCount,
    newCardsCount,
    totalSheetsPlanned,
    cutSheets,
    inProgressSheets,
    newSheets
  };
};

export const isPlaceholderMachine = (val) => {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  return (
    s === '' ||
    s === '—' ||
    s === '-' ||
    s === 'не вказано' ||
    s === 'не призначено' ||
    s === 'не вибрано' ||
    s === 'null' ||
    s === 'undefined'
  );
};

export const resolveCardMachineName = (cardEntry, cardObj, taskObj, machines = [], nomObj = null) => {
  // 1. Direct machine_name or machine on work_card_history
  let m = cardEntry?.machine_name || cardEntry?.machine;
  if (m && !isPlaceholderMachine(m)) {
    return String(m).trim();
  }

  // 2. Direct machine or machine_name on card object
  m = cardObj?.machine || cardObj?.machine_name;
  if (m && !isPlaceholderMachine(m)) {
    return String(m).trim();
  }

  // 3. Resolve from machine_id if present on cardEntry or cardObj
  const machId = cardEntry?.machine_id || cardObj?.machine_id;
  if (machId) {
    const foundMach = (machines || []).find(mach => String(mach.id) === String(machId));
    if (foundMach?.name && !isPlaceholderMachine(foundMach.name)) {
      return String(foundMach.name).trim();
    }
  }

  // 4. Extract machine from card operation or history stage name (e.g. "Розкрій - CNC KE XIN - ФЕЯ №12" -> "CNC KE XIN - ФЕЯ №12")
  const op = cardObj?.operation || cardEntry?.stage_name || '';
  if (op.includes(' - ')) {
    const parts = op.split(' - ').map(s => s.trim());
    if (parts.length > 1) {
      const extracted = parts.slice(1).join(' - ');
      if (extracted && !isPlaceholderMachine(extracted)) {
        return extracted;
      }
    }
  }

  // 4b. Match any known machine name in stage_name or operation
  if (machines?.length > 0 && op) {
    const lowerOp = op.toLowerCase();
    const found = machines.find(mach => mach?.name && !isPlaceholderMachine(mach.name) && lowerOp.includes(mach.name.toLowerCase()));
    if (found) return String(found.name).trim();
  }

  // 5. Check card_info for [MACHINE:...] tag or known machine names
  const info = cardEntry?.card_info || cardObj?.card_info || '';
  if (info) {
    const machTagMatch = info.match(/\[MACHINE(?:_NAME)?:([^\]]+)\]/i);
    if (machTagMatch && machTagMatch[1]) {
      const extracted = machTagMatch[1].trim();
      if (extracted && !isPlaceholderMachine(extracted)) {
        return extracted;
      }
    }
    if (machines?.length > 0) {
      const lowerInfo = info.toLowerCase();
      const found = machines.find(mach => mach?.name && !isPlaceholderMachine(mach.name) && lowerInfo.includes(mach.name.toLowerCase()));
      if (found) return String(found.name).trim();
    }
  }

  // 6. Check task plan_snapshot for the part's assigned machine
  const nomId = cardEntry?.nomenclature_id || cardObj?.nomenclature_id || nomObj?.id;
  if (taskObj?.plan_snapshot) {
    let snap = taskObj.plan_snapshot;
    if (typeof snap === 'string') {
      try { snap = JSON.parse(snap); } catch (e) { snap = {}; }
    }
    if (snap && typeof snap === 'object') {
      // 6.1 Match specific part entry
      const partEntry = (nomId ? snap[nomId] : null) || Object.values(snap).find(p => p && typeof p === 'object' && (
        (nomId && (String(p.nomenclature_id) === String(nomId) || String(p.id) === String(nomId) || String(p.nomId) === String(nomId))) ||
        (nomObj?.name && String(p.name || '').trim().toLowerCase() === String(nomObj.name).trim().toLowerCase()) ||
        (nomObj?.code && String(p.code || '').trim().toLowerCase() === String(nomObj.code).trim().toLowerCase()) ||
        (nomObj?.nomenclature_code && String(p.nomenclature_code || '').trim().toLowerCase() === String(nomObj.nomenclature_code).trim().toLowerCase())
      ));

      if (partEntry) {
        const partMach = partEntry.selected_machine || partEntry.machine || partEntry.selectedMachine || partEntry.rowMachineName || partEntry.machine_name;
        if (partMach && !isPlaceholderMachine(partMach)) {
          return String(partMach).trim();
        }
        if (Array.isArray(partEntry.splits)) {
          const splitMach = partEntry.splits.find(s => s?.machine && !isPlaceholderMachine(s.machine))?.machine;
          if (splitMach) return String(splitMach).trim();
        }
        if (partEntry.machine_id) {
          const found = (machines || []).find(mach => String(mach.id) === String(partEntry.machine_id));
          if (found?.name && !isPlaceholderMachine(found.name)) return String(found.name).trim();
        }
      }

      // 6.2 Check customRowMachines in snap
      if (snap.customRowMachines && nomId && snap.customRowMachines[nomId]) {
        const cMach = snap.customRowMachines[nomId];
        if (!isPlaceholderMachine(cMach)) return String(cMach).trim();
      }

      // 6.3 Fallback to any part's machine in this task's plan_snapshot
      for (const [key, p] of Object.entries(snap)) {
        if (key.startsWith('_') || ['materialSummary', 'consumables', 'arrivals', 'nomenclatures', 'selectedCutters'].includes(key)) continue;
        if (p && typeof p === 'object') {
          const pm = p.selected_machine || p.machine || p.selectedMachine || p.rowMachineName || p.machine_name;
          if (pm && !isPlaceholderMachine(pm)) {
            return String(pm).trim();
          }
          if (Array.isArray(p.splits)) {
            const splitMach = p.splits.find(s => s?.machine && !isPlaceholderMachine(s.machine))?.machine;
            if (splitMach) return String(splitMach).trim();
          }
          if (p.machine_id) {
            const found = (machines || []).find(mach => String(mach.id) === String(p.machine_id));
            if (found?.name && !isPlaceholderMachine(found.name)) return String(found.name).trim();
          }
        }
      }
    }
  }

  // 7. Task-level machine properties
  if (taskObj?.machine_name && !isPlaceholderMachine(taskObj.machine_name)) {
    return String(taskObj.machine_name).trim();
  }
  if (taskObj?.machine && !isPlaceholderMachine(taskObj.machine)) {
    return String(taskObj.machine).trim();
  }
  if (taskObj?.selected_machine && !isPlaceholderMachine(taskObj.selected_machine)) {
    return String(taskObj.selected_machine).trim();
  }
  if (taskObj?.machine_id) {
    const foundMach = (machines || []).find(mach => String(mach.id) === String(taskObj.machine_id));
    if (foundMach?.name && !isPlaceholderMachine(foundMach.name)) {
      return String(foundMach.name).trim();
    }
  }

  // 8. If machines list has only 1 CNC / cutting machine, fallback to it
  if (machines?.length > 0) {
    const cncMachines = machines.filter(m => m?.name && !isPlaceholderMachine(m.name) && (
      (m.type && String(m.type).toLowerCase().includes('cnc')) ||
      m.name.toLowerCase().includes('cnc') ||
      m.name.toLowerCase().includes('фея') ||
      m.name.toLowerCase().includes('розкрій')
    ));
    if (cncMachines.length === 1) {
      return String(cncMachines[0].name).trim();
    }
  }

  return 'Не вказано';
};

const SheetsReport = ({
  nomenclatures = [],
  tasks = [],
  orders = [],
  receptionDocs = [],
  workCardHistory = [],
  requests = [],
  inventory = [],
  workCards = [],
  machines = [],
  startDate,
  endDate,
  searchQuery = '',
  filterByDate = () => true
}) => {
  const [selectedSheetForReserve, setSelectedSheetForReserve] = useState(null);
  const [selectedSheetForUsed, setSelectedSheetForUsed] = useState(null);

  const sheetsStats = useMemo(() => {
    const stats = {};

    // Initialize all known sheet nomenclatures
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
            matchingNomIds: [],
            usedRecords: []
          };
        }
        if (n.id && !stats[baseName].matchingNomIds.includes(n.id)) {
          stats[baseName].matchingNomIds.push(n.id);
        }
      });

    // Also register any sheets present in inventory
    (inventory || []).forEach(inv => {
      const isSheet = (inv.name || '').toLowerCase().includes('лист') || (inv.name || '').toLowerCase().includes('карбон');
      if (isSheet) {
        const baseName = getBaseName(inv.name);
        if (baseName && !stats[baseName]) {
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
            matchingNomIds: inv.nomenclature_id ? [inv.nomenclature_id] : [],
            usedRecords: []
          };
        }
      }
    });

    // ── 1. НА ПІДГОТУВАННІ (активні незавершені наряди підготовки) ──
    (tasks || [])
      .filter(t => t.step === 'Підготовка' && t.status !== 'completed' && t.status !== 'cancelled' && t.warehouse_conf === 'true')
      .forEach(t => {
        if (t.plan_snapshot) {
          let snapshot = t.plan_snapshot;
          if (typeof snapshot === 'string') {
            try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
          }
          if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            Object.values(snapshot).forEach(item => {
              const bName = getBaseName(item.name || item.nom_name || '');
              if (bName && stats[bName]) {
                stats[bName].in_prep += Number(item.plan || item.qty || item.quantity || item.need || 0);
              }
            });
          }
        }
      });

    // ── 2. БРАК ПІДГОТОВКИ (в межах обраного періоду) ──
    (tasks || [])
      .filter(t => t.step === 'Підготовка')
      .forEach(t => {
        if (t.plan_snapshot) {
          let snapshot = t.plan_snapshot;
          if (typeof snapshot === 'string') {
            try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
          }
          if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            Object.values(snapshot).forEach(item => {
              const itemDate = item.completed_at || t.completed_at || t.created_at;
              if (itemDate && filterByDate(itemDate)) {
                const bName = getBaseName(item.name || item.nom_name || '');
                if (bName && stats[bName]) {
                  stats[bName].scrap += Number(item.total_scrap || item.actual_scrap || 0);
                }
              }
            });
          }
        }
      });

    // ── 3. ОТРИМАНО НА СВ & ПІДГОТОВЛЕНО (НА СО) ──
    // З актів прийому/надходження за обраний період
    (receptionDocs || []).filter(d => (d.status === 'completed' || d.status === 'shipped') && filterByDate(d.created_at || d.date)).forEach(doc => {
      (doc.items || []).forEach(item => {
        const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id));
        const bName = resolveSheetBaseName(nom || item.name, { nomenclatures, tasks, inventory });
        if (bName && stats[bName]) {
          const qty = Number(item.qty || item.quantity || item.needed || 0);
          if (doc.task_id || nom?.name?.includes('[Підготовлений]') || nom?.group_id === 'grp_prepared_sheets' || /^\s*лист\s*(?:т|t)(?:300|700)/i.test(nom?.name || '')) {
            stats[bName].prepared += qty;
          } else if (!doc.source_warehouse && (nom?.type === 'raw' || nom?.name?.includes('[Непідготовлений]') || nom?.name?.includes('Карбонова пластина'))) {
            stats[bName].supplied += qty;
          }
        }
      });
    });

    // Додатково перевіряємо виконані наряди підготовки за період (якщо на них не сформовано окремий doc)
    const prepDocsTaskIds = new Set((receptionDocs || []).filter(d => d.task_id).map(d => String(d.task_id)));
    (tasks || []).filter(t => t.step === 'Підготовка' && !prepDocsTaskIds.has(String(t.id))).forEach(t => {
      if (t.plan_snapshot) {
        let snapshot = t.plan_snapshot;
        if (typeof snapshot === 'string') {
          try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
        }
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
          Object.values(snapshot).forEach(item => {
            const itemDate = item.completed_at || t.completed_at;
            if ((item.status === 'completed' || t.status === 'completed') && itemDate && filterByDate(itemDate)) {
              const bName = getBaseName(item.name || item.nom_name || '');
              if (bName && stats[bName]) {
                stats[bName].prepared += Number(item.total_good || item.actual_complete || item.plan || 0);
              }
            }
          });
        }
      }
    });

    // ── 4. ВИТРАЧЕНО (ФАКТИЧНИЙ РОЗКРІЙ ЛИСТІВ ЗА ПЕРІОД) ──
    // Рахуємо суворо за завершеними картками розкрою з work_card_history у вибраному періоді
    const cuttingCardsMap = new Map();

    (workCardHistory || []).forEach(h => {
      const isCutting = h.stage_name && (h.stage_name.toLowerCase().includes('розкрій') || h.stage_name.toLowerCase().includes('чпк'));
      if (!isCutting) return;

      const eventDate = h.completed_at || h.created_at;
      if (!eventDate || !filterByDate(eventDate)) return;

      const cardKey = h.card_id ? String(h.card_id) : `hist_${h.id}`;
      if (!cuttingCardsMap.has(cardKey)) {
        cuttingCardsMap.set(cardKey, {
          card_id: h.card_id,
          task_id: h.task_id,
          nomenclature_id: h.nomenclature_id,
          operator_name: h.operator_name,
          completed_at: h.completed_at,
          created_at: h.created_at,
          qty_completed: 0,
          scrap_qty: 0,
          card_info: h.card_info || '',
          machine_name: h.machine_name || h.machine || null,
          machine_id: h.machine_id || null,
          stage_name: h.stage_name || null
        });
      }
      const entry = cuttingCardsMap.get(cardKey);
      entry.qty_completed += Number(h.qty_completed || 0);
      entry.scrap_qty += Number(h.scrap_qty || 0);
      if (h.card_info && (!entry.card_info || entry.card_info.length < h.card_info.length)) {
        entry.card_info = h.card_info;
      }
      if (h.task_id && !entry.task_id) entry.task_id = h.task_id;
      if (h.nomenclature_id && !entry.nomenclature_id) entry.nomenclature_id = h.nomenclature_id;
      if (isPlaceholderMachine(entry.machine_name)) {
        const candidateMach = h.machine_name || h.machine;
        if (candidateMach && !isPlaceholderMachine(candidateMach)) {
          entry.machine_name = candidateMach;
        }
      }
      if (!entry.machine_id && h.machine_id) {
        entry.machine_id = h.machine_id;
      }
      if (!entry.stage_name && h.stage_name) {
        entry.stage_name = h.stage_name;
      }
      if ((!entry.operator_name || entry.operator_name === 'Не вказано') && h.operator_name && h.operator_name !== 'Не вказано') {
        entry.operator_name = h.operator_name;
      }
    });

    cuttingCardsMap.forEach(cardEntry => {
      // Ігноруємо технічні паузи без виготовлення деталей та без тегу списання
      if (cardEntry.qty_completed === 0 && cardEntry.scrap_qty === 0 && !cardEntry.card_info?.includes('[SHEETS_DEDUCTED:true]')) {
        return;
      }

      const cardObj = (workCards || []).find(c => String(c.id) === String(cardEntry.card_id));
      const taskObj = (tasks || []).find(t => String(t.id) === String(cardEntry.task_id || cardObj?.task_id));
      const nomId = cardEntry.nomenclature_id || cardObj?.nomenclature_id;
      const nomObj = (nomenclatures || []).find(n => String(n.id) === String(nomId));

      // 4.1. Визначаємо назву листа
      let baseName = null;

      // З мітки [SHEET:...] у card_info якщо є
      const infoSheetMatch = (cardEntry.card_info || cardObj?.card_info || '').match(/\[SHEET:([^\]]+)\]/i);
      if (infoSheetMatch && infoSheetMatch[1]) {
        baseName = getBaseName(infoSheetMatch[1]);
      }

      // З task.plan_snapshot.materialSummary
      if (!baseName && taskObj?.plan_snapshot?.materialSummary) {
        let matSummary = taskObj.plan_snapshot.materialSummary;
        if (typeof matSummary === 'string') {
          try { matSummary = JSON.parse(matSummary); } catch (e) { matSummary = {}; }
        }
        const list = Object.values(matSummary || {});
        if (list.length === 1 && list[0]?.matName) {
          baseName = getBaseName(list[0].matName);
        } else if (nomObj?.name) {
          const found = list.find(m => Array.isArray(m.components) && m.components.some(c => String(c).toLowerCase().includes(nomObj.name.toLowerCase())));
          if (found?.matName) baseName = getBaseName(found.matName);
        }
      }

      // З номенклатури деталі (товщина, марка, default_material_id)
      if (!baseName && nomObj) {
        baseName = resolveSheetBaseName(nomObj, { nomenclatures, tasks, inventory });
      }

      // З номенклатури завдання
      if (!baseName && taskObj?.nomenclature_id) {
        const tNom = (nomenclatures || []).find(n => String(n.id) === String(taskObj.nomenclature_id));
        if (tNom) baseName = resolveSheetBaseName(tNom, { nomenclatures, tasks, inventory });
      }

      if (!baseName || !stats[baseName]) return;

      // 4.2. Визначаємо кількість списаних листів для картки
      let sheetsCount = 0;

      // З [SHEETS:X] або (X л.) в card_info
      const sMatch = (cardEntry.card_info || cardObj?.card_info || '').match(/\[SHEETS:(\d+(?:[.,]\d+)?)\]/i) ||
                     (cardEntry.card_info || cardObj?.card_info || '').match(/\((\d+(?:[.,]\d+)?)\s*л\.?\)/i);
      if (sMatch && sMatch[1]) {
        sheetsCount = parseFloat(sMatch[1].replace(',', '.'));
      }

      // З властивості actual_sheets самої картки
      if (!sheetsCount && cardObj) {
        sheetsCount = Number(cardObj.actual_sheets || cardObj.actualSheets || cardObj.sheets || 0);
      }

      // Пропорційний розрахунок за нормою виходу деталей з листа
      if (!sheetsCount) {
        const partSnap = taskObj?.plan_snapshot?.[nomId] || {};
        const unitsPerSheet = Number(nomObj?.rule_params?.unitsPerSheet) ||
                              Number(nomObj?.units_per_sheet) ||
                              Number(partSnap?.units_per_sheet) || 1;
        const totalUnits = cardEntry.qty_completed + cardEntry.scrap_qty;
        sheetsCount = Math.ceil(totalUnits / unitsPerSheet);
      }

      if (!sheetsCount && (cardEntry.qty_completed > 0 || cardEntry.scrap_qty > 0)) {
        sheetsCount = 1;
      }

      if (sheetsCount > 0) {
        stats[baseName].used += sheetsCount;

        // Resolve details for used modal
        let orderNum = taskObj?.naryad_number || taskObj?.task_number || '—';
        let ord = null;
        if (taskObj?.order_id) ord = (orders || []).find(o => String(o.id) === String(taskObj.order_id));
        if (orderNum === '—' && ord) orderNum = ord.order_num || `№ ${ord.id.slice(0, 6)}`;

        let customer = taskObj?.customer || taskObj?.customer_name || taskObj?.client || ord?.customer || ord?.customer_name || '—';

        const prodNomId = ord?.nomenclature_id || ord?.order_items?.[0]?.nomenclature_id || taskObj?.nomenclature_id;
        const prodNom = prodNomId ? (nomenclatures || []).find(n => String(n.id) === String(prodNomId)) : null;
        let productName = prodNom?.name || ord?.product_name || ord?.nomenclature?.name || taskObj?.product_name || taskObj?.target_product || taskObj?.plan_snapshot?.productName || '—';

        let dateFormatted = '—';
        const d = cardEntry.completed_at || cardEntry.created_at;
        if (d) {
          const dt = new Date(d);
          dateFormatted = `${dt.toLocaleDateString('uk-UA')} ${dt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
        }

        let cardDisplay = cardObj?.id ? String(cardObj.id).slice(0, 8).toUpperCase() : (cardEntry.card_id ? String(cardEntry.card_id).slice(0, 8).toUpperCase() : '—');
        const seqMatch = (cardEntry.card_info || cardObj?.card_info || '').match(/(?:№|#)?\s*(\d+(?:\/\d+)?)/);
        if (seqMatch && seqMatch[1]) {
          cardDisplay = `№${seqMatch[1]} (${cardDisplay})`;
        }

        const machineName = resolveCardMachineName(cardEntry, cardObj, taskObj, machines, nomObj);

        stats[baseName].usedRecords.push({
          id: cardEntry.card_id || Math.random(),
          cardDisplay,
          cardInfo: cardEntry.card_info || cardObj?.card_info || '',
          orderNum,
          customer,
          productName,
          partName: nomObj?.name || '—',
          partCode: nomObj?.code || nomObj?.nomenclature_code || '',
          operatorName: cardEntry.operator_name || cardObj?.operator_name || '—',
          machineName,
          completedAt: d,
          dateFormatted,
          sheetsCount,
          qtyCompleted: cardEntry.qty_completed,
          scrapQty: cardEntry.scrap_qty
        });
      }

      // Брак при розкрої
      if (cardEntry.scrap_qty > 0) {
        const partSnap = taskObj?.plan_snapshot?.[nomId] || {};
        const unitsPerSheet = Number(nomObj?.rule_params?.unitsPerSheet) ||
                              Number(nomObj?.units_per_sheet) ||
                              Number(partSnap?.units_per_sheet) || 1;
        const scrapSheets = Math.max(1, Math.round(cardEntry.scrap_qty / unitsPerSheet));
        stats[baseName].scrap += scrapSheets;
      }
    });

    Object.values(stats).forEach(s => {
      if (s.usedRecords && s.usedRecords.length > 0) {
        s.usedRecords.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
      }
    });

    // ── 5. ФАКТИЧНИЙ ФІЗИЧНИЙ ЗАЛИШОК НА СКЛАДАХ ──
    // Склад Виробництва (СВ) - тільки сировинні непідготовлені листи/пластини
    (inventory || []).filter(i => i.warehouse === 'production').forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (!isSheetNomenclatureOrInv(i, nom)) return;
      if (nom?.name?.includes('[Підготовлений]') || i.name?.includes('[Підготовлений]')) return;

      const bName = getBaseName(nom?.name || i.name);
      if (bName && stats[bName]) {
        stats[bName].actual_sv += Number(i.total_qty || 0);
      }
    });

    // Склад Оперативний (СО) - тільки підготовлені робочі листи
    (inventory || []).filter(i => i.warehouse === 'operational' || !i.warehouse).forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id));
      if (!isSheetNomenclatureOrInv(i, nom)) return;

      const bName = getBaseName(nom?.name || i.name);
      if (bName && stats[bName]) {
        stats[bName].actual_so += Number(i.total_qty || 0);
      }
    });

    // ── 6. РЕЗЕРВИ НА СО (Підготовлені робочі листи, видані/зарезервовані під наряди розкрою) ──
    (requests || [])
      .filter(r => (r.status === 'approved' || r.status === 'reserved' || r.status === 'issued') && Number(r.quantity) > 0)
      .forEach(r => {
        const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id));
        const inv = inventory.find(i => String(i.id) === String(r.inventory_id));
        if (!isSheetNomenclatureOrInv(r, nom) && !isSheetNomenclatureOrInv(inv)) return;

        const targetName = inv?.name || nom?.name || r.details || '';
        const bName = getBaseName(targetName);
        if (bName && stats[bName]) {
          stats[bName].reserved_so += Number(r.quantity || 0);
        }
      });

    // ── 7. РЕЗЕРВИ НА СВ (Непідготовлені листи, зарезервовані нерозпочатими нарядами підготовки) ──
    (tasks || [])
      .filter(t => t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true')
      .forEach(t => {
        if (t.plan_snapshot) {
          let snapshot = t.plan_snapshot;
          if (typeof snapshot === 'string') {
            try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
          }
          if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            Object.values(snapshot).forEach(item => {
              const bName = getBaseName(item.name || item.nom_name || '');
              if (bName && stats[bName]) {
                const qty = Number(item.plan || item.qty || item.quantity || item.need || 0);
                if (qty > 0) {
                  stats[bName].reserved_sv += qty;
                }
              }
            });
          }
        }
      });

    // Фільтрація активних листів та сортування: товщина за зростанням -> марка -> назва
    return Object.values(stats)
      .filter(s => 
        (s.supplied > 0 || s.used > 0 || s.prepared > 0 || s.scrap > 0 || s.actual_sv > 0 || s.actual_so > 0 || s.in_prep > 0 || s.reserved_sv > 0 || s.reserved_so > 0) &&
        (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
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

  }, [receptionDocs, requests, workCardHistory, inventory, nomenclatures, tasks, workCards, machines, filterByDate, searchQuery]);

  // Overall total reserves calculation
  const totalReservedSV = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.reserved_sv || 0), 0), [sheetsStats]);
  const totalReservedSO = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.reserved_so || 0), 0), [sheetsStats]);
  const totalStockSO = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.actual_so || 0), 0), [sheetsStats]);
  const totalUsed = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.used || 0), 0), [sheetsStats]);
  const totalPrepared = useMemo(() => sheetsStats.reduce((sum, s) => sum + (s.prepared || 0), 0), [sheetsStats]);

  // Compute reserve details for the selected sheet modal
  const modalReserveDetails = useMemo(() => {
    if (!selectedSheetForReserve) return [];

    const sheet = selectedSheetForReserve;
    const targetNomIds = sheet.matchingNomIds || [];
    const details = [];

    // 1. From material requests for sheets (status 'approved', 'reserved', 'issued', 'pending')
    (requests || []).forEach(r => {
      if (!['approved', 'reserved', 'issued', 'pending'].includes(r.status)) return;
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id));
      const inv = inventory.find(i => String(i.id) === String(r.inventory_id));

      // MUST be a genuine sheet request, never a finished part (like drone crosses/screws)
      if (!isSheetNomenclatureOrInv(r, nom) && !isSheetNomenclatureOrInv(inv)) return;

      const targetName = inv?.name || nom?.name || r.details || '';
      const bName = getBaseName(targetName);
      const matchByInventory = inventory.find(i => String(i.id) === String(r.inventory_id) && targetNomIds.includes(String(i.nomenclature_id)));
      const matchByNom = targetNomIds.includes(String(r.nomenclature_id));
      const matchByName = bName === sheet.name;

      if (matchByInventory || matchByNom || matchByName) {
        let orderNum = '—';
        let customer = '—';
        let productName = '—';
        let partName = '';

        const taskObj = r.task_id ? tasks.find(t => String(t.id) === String(r.task_id)) : null;

        // Try resolving order from r.order_id, taskObj.order_id, or taskObj.naryad_number
        let ord = null;
        if (r.order_id) {
          ord = orders.find(o => String(o.id) === String(r.order_id));
        }
        if (!ord && taskObj?.order_id) {
          ord = orders.find(o => String(o.id) === String(taskObj.order_id));
        }

        if (taskObj) {
          orderNum = taskObj.naryad_number || taskObj.task_number || '—';
        }
        if (orderNum === '—' && ord) {
          orderNum = ord.order_num || `№ ${ord.id.slice(0, 6)}`;
        }
        if (orderNum === '—' && r.order_id) {
          orderNum = `№ ${String(r.order_id).slice(0, 6)}`;
        }

        // Customer
        if (taskObj?.customer || taskObj?.customer_name || taskObj?.client) {
          customer = taskObj.customer || taskObj.customer_name || taskObj.client;
        } else if (ord?.customer || ord?.customer_name) {
          customer = ord.customer || ord.customer_name;
        }

        // Product name
        const prodNomId = ord?.nomenclature_id || ord?.order_items?.[0]?.nomenclature_id || taskObj?.nomenclature_id;
        const prodNom = prodNomId ? nomenclatures.find(n => String(n.id) === String(prodNomId)) : null;
        if (prodNom?.name) {
          productName = prodNom.name;
        } else if (ord?.product_name || ord?.nomenclature?.name) {
          productName = ord.product_name || ord.nomenclature?.name;
        } else if (taskObj?.product_name || taskObj?.target_product || taskObj?.plan_snapshot?.productName) {
          productName = taskObj.product_name || taskObj.target_product || taskObj.plan_snapshot?.productName;
        }

        // Detail part if request has one
        if (r.details && r.details !== targetName && !r.details.toLowerCase().includes('лист')) {
          partName = r.details;
        }

        // Real-time cutting card progress for this task and sheet
        const taskProgress = taskObj ? getTaskCuttingProgressForSheet(taskObj.id, sheet.name, { workCards, nomenclatures, tasks, inventory }) : null;

        // Extract original planned sheets for this naryad/task from plan_snapshot if no card progress
        let planQty = taskProgress?.totalSheetsPlanned || null;
        if (!planQty && taskObj?.plan_snapshot) {
          let snap = taskObj.plan_snapshot;
          if (typeof snap === 'string') {
            try { snap = JSON.parse(snap); } catch (e) { snap = {}; }
          }
          if (snap.materialSummary) {
            const list = Object.values(snap.materialSummary || {});
            const matchedMat = list.find(m => {
              const mName = getBaseName(m.matName || m.name || '');
              return mName === sheet.name || (m.nomenclature_id && targetNomIds.includes(String(m.nomenclature_id)));
            });
            if (matchedMat?.sheets) {
              planQty = Number(matchedMat.sheets);
            }
          }
          if (!planQty) {
            let sumPartSheets = 0;
            Object.values(snap).forEach(p => {
              if (p && typeof p === 'object' && !Array.isArray(p)) {
                const pName = getBaseName(p.material || p.rawSheet || p.matName || '');
                if (pName === sheet.name && p.sheets) {
                  sumPartSheets += Number(p.sheets);
                }
              }
            });
            if (sumPartSheets > 0) planQty = sumPartSheets;
          }
        }

        const whName = r.warehouse === 'operational' || matchByInventory?.warehouse === 'operational' || targetName.includes('[Підготовлений]') ? 'Склад Оперативний (СО)' : 'Склад Виробництва (СВ)';

        let statusText = 'Очікує видачі';
        if (taskProgress && taskProgress.cutSheets >= taskProgress.totalSheetsPlanned && taskProgress.totalSheetsPlanned > 0) {
          statusText = 'Розкрій завершено';
        } else if (taskProgress && taskProgress.inProgressSheets > 0) {
          statusText = `В розкрої (${taskProgress.inProgressCardsCount} к.)`;
        } else if (r.status === 'issued') {
          statusText = 'Видано на лінію (очікує розкрою)';
        } else if (r.status === 'approved' || r.status === 'reserved') {
          statusText = 'Закомплектовано';
        }

        details.push({
          id: `req-${r.id}`,
          source: 'Складський бокс',
          orderNum,
          customer,
          productName,
          partName,
          warehouse: whName,
          quantity: Number(r.quantity) || 0,
          planQty: planQty,
          taskProgress,
          date: r.created_at ? new Date(r.created_at).toLocaleDateString('uk-UA') : '—',
          status: statusText
        });
      }
    });

    // 2. From active preparation tasks (raw sheet reserves on SV)
    (tasks || [])
      .filter(t => t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true')
      .forEach(t => {
        if (t.plan_snapshot) {
          let snapshot = t.plan_snapshot;
          if (typeof snapshot === 'string') {
            try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
          }
          if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            Object.values(snapshot).forEach(item => {
              const nomId = String(item.nomenclature_id || item.child_id || '');
              const bName = getBaseName(item.name || item.nom_name || '');

              if (targetNomIds.includes(nomId) || bName === sheet.name) {
                let orderNum = t.naryad_number || t.task_number || '—';
                let customer = '—';
                let ord = t.order_id ? orders.find(o => String(o.id) === String(t.order_id)) : null;
                if (!ord && orderNum !== '—') ord = orders.find(o => o.order_num === orderNum || o.id === orderNum);
                if (ord) {
                  if (orderNum === '—') orderNum = ord.order_num || `№ ${ord.id.slice(0, 6)}`;
                  customer = ord.customer || ord.customer_name || '—';
                }

                let productName = '—';
                const prodNomId = ord?.nomenclature_id || ord?.order_items?.[0]?.nomenclature_id || t.nomenclature_id;
                const prodNom = prodNomId ? nomenclatures.find(n => String(n.id) === String(prodNomId)) : null;
                if (prodNom?.name) {
                  productName = prodNom.name;
                } else if (ord?.product_name || ord?.nomenclature?.name) {
                  productName = ord.product_name || ord.nomenclature?.name;
                } else if (t.product_name || t.target_product || t.plan_snapshot?.productName) {
                  productName = t.product_name || t.target_product || t.plan_snapshot?.productName;
                }

                const reservedQty = Number(item.plan || item.need || item.quantity || 0);
                if (reservedQty > 0) {
                  details.push({
                    id: `task-${t.id}-${item.id || nomId}`,
                    source: `Наряд (Підготовка)`,
                    orderNum,
                    customer,
                    productName,
                    partName: item.name || '',
                    warehouse: 'Склад Виробництва (СВ)',
                    quantity: reservedQty,
                    date: t.created_at ? new Date(t.created_at).toLocaleDateString('uk-UA') : '—',
                    status: 'Очікує підготовки'
                  });
                }
              }
            });
          }
        }
      });

    return details;
  }, [selectedSheetForReserve, requests, tasks, orders, inventory, nomenclatures, workCards]);

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      
      {/* LEFT PANEL: 32% WIDTH - РЕЗЕРВИ ЛИСТІВ */}
      <div 
        className="glass-panel sheets-card" 
        style={{ 
          flex: '0 0 32%', 
          minWidth: '320px'
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
        <div className="sheets-summary-card">
          <div style={{ textAlign: 'center' }}>
            <div className="sheets-text-muted" style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СВ</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#3b82f6', marginTop: '2px' }}>{totalReservedSV}</div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(120, 120, 120, 0.2)', borderRight: '1px solid rgba(120, 120, 120, 0.2)' }}>
            <div className="sheets-text-muted" style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СО</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#10b981', marginTop: '2px' }}>{totalReservedSO}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="sheets-text-muted" style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 900 }}>Всього рез.</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#ff9000', marginTop: '2px' }}>{totalReservedSV + totalReservedSO}</div>
          </div>
        </div>

        {/* Reserve List by Sheet */}
        <div style={{ maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr className="sheets-table-header" style={{ textAlign: 'left' }}>
                <th style={{ padding: '8px 6px', fontWeight: 900 }}>Матеріал</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 900, color: '#3b82f6' }}>СВ</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 900, color: '#10b981' }}>СО</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }}>Разом</th>
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
                    className="sheets-table-row"
                    style={{ 
                      background: hasReserve ? 'rgba(59, 130, 246, 0.04)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 6px', fontWeight: 800 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="sheets-text-primary" style={{ fontSize: '0.82rem' }}>{stat.name}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {parsed.thickness !== 9999 && (
                            <span style={{ fontSize: '0.62rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>
                              {parsed.thickness} мм
                            </span>
                          )}
                          {parsed.grade !== 'ІНШЕ' && (
                            <span style={{ fontSize: '0.62rem', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>
                              {parsed.grade}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      <span style={{ color: stat.reserved_sv > 0 ? '#3b82f6' : 'var(--text-muted)', fontWeight: 900 }}>
                        {stat.reserved_sv}
                      </span>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      <span style={{ color: stat.reserved_so > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 900 }}>
                        {stat.reserved_so}
                      </span>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSheetForReserve(stat)}
                        style={{
                          background: hasReserve ? 'rgba(255, 144, 0, 0.15)' : 'rgba(120, 120, 120, 0.1)',
                          border: `1px solid ${hasReserve ? 'rgba(255, 144, 0, 0.4)' : 'rgba(120, 120, 120, 0.2)'}`,
                          color: hasReserve ? '#ff9000' : 'var(--text-muted)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontWeight: 950,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {totalRes}
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT PANEL: 65% WIDTH - ДАШБОРД РУХУ ЛИСТІВ */}
      <div 
        className="glass-panel sheets-card" 
        style={{ 
          flex: '1 1 65%', 
          minWidth: '600px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#10b981', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
              <PackageCheck size={24} color="#10b981" /> ДАШБОРД РУХУ ЛИСТІВ (МАТЕРІАЛІВ)
            </h3>
            <div style={{ display: 'flex', gap: '15px', marginTop: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
              <span style={{ color: '#f59e0b' }}>
                Витрачено на розкрої: <strong>{totalUsed} л.</strong>
              </span>
              <span style={{ color: '#10b981' }}>
                Підготовлено: <strong>{totalPrepared} л.</strong>
              </span>
              <span style={{ color: '#3b82f6' }}>
                На СО всього: <strong>{totalStockSO} л.</strong>
              </span>
            </div>
          </div>

          <div className="sheets-badge-pill">
            Посортовано: товщина (від найменшої до найбільшої) → марка
          </div>
        </div>

        <div className="sheets-table-box">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr className="sheets-table-header" style={{ textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Матеріал (Номенклатура)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6' }}>Отримано на СВ</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b5cf6' }}>На підготуванні</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981' }}>Підготовлено (На СО)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>Витрачено (Розкрій)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444' }}>Брак</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(59, 130, 246, 0.06)', color: '#3b82f6' }}>Залишок СВ (Непідгот.)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>Залишок СО (Підгот.)</th>
              </tr>
            </thead>
            <tbody>
              {sheetsStats.map((stat, idx) => {
                const parsed = parseSheetInfo(stat.name);
                const availSV = Math.max(0, stat.actual_sv - stat.reserved_sv);
                const availSO = Math.max(0, stat.actual_so - stat.reserved_so);

                return (
                  <tr key={idx} className="sheets-table-row" style={{ background: 'transparent' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 900, fontSize: '0.92rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="sheets-text-primary">{stat.name}</span>
                        {parsed.thickness !== 9999 && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '2px 6px', borderRadius: '6px', fontWeight: 900 }}>
                            {parsed.thickness} мм
                          </span>
                        )}
                        {parsed.grade !== 'ІНШЕ' && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', padding: '2px 6px', borderRadius: '6px', fontWeight: 900 }}>
                            {parsed.grade}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.supplied > 0 ? (
                        <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                          {stat.supplied}
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.in_prep > 0 ? (
                        <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                          {stat.in_prep}
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.prepared > 0 ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                          {stat.prepared}
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {stat.used > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSheetForUsed(stat)}
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: '#f59e0b',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            fontWeight: 950,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: '60px'
                          }}
                          title={`Витрачено: ${stat.used} л. Натисніть для перегляду карток та нарядів`}
                        >
                          <span style={{ lineHeight: 1.2 }}>{stat.used}</span>
                          <span style={{ fontSize: '0.62rem', opacity: 0.85, fontWeight: 800, textTransform: 'uppercase', marginTop: '1px' }}>
                            {stat.usedRecords?.length || 0} карт.
                          </span>
                        </button>
                      ) : (
                        <span style={{ color: '#888', fontWeight: 700 }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {stat.scrap > 0 ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                          {stat.scrap}
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>0</span>
                      )}
                    </td>
                    
                    {/* ЗАЛИШОК СВ: Фізичний залишок з деталізацією доступних і зарезервованих */}
                    <td style={{ padding: '10px 16px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.02)' }}>
                      {stat.actual_sv === 0 && stat.reserved_sv === 0 ? (
                        <span style={{ color: '#888', fontWeight: 700 }}>0</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedSheetForReserve(stat)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            color: '#3b82f6',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: '70px'
                          }}
                          title={`Всього на СВ: ${stat.actual_sv} л | Вільних: ${availSV} л | В резерві: ${stat.reserved_sv} л (натисніть для деталей)`}
                        >
                          <span style={{ fontSize: '1rem', fontWeight: 950, color: '#3b82f6', lineHeight: 1.2 }}>
                            {stat.actual_sv}
                          </span>
                          {stat.reserved_sv > 0 ? (
                            <span style={{ fontSize: '0.66rem', color: '#ff9000', fontWeight: 800 }}>
                              {availSV} вільн ({stat.reserved_sv} рез)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.66rem', color: '#3b82f6', fontWeight: 700 }}>
                              вільно
                            </span>
                          )}
                        </button>
                      )}
                    </td>

                    {/* ЗАЛИШОК СО: Фізичний залишок з деталізацією доступних і зарезервованих */}
                    <td style={{ padding: '10px 16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>
                      {stat.actual_so === 0 && stat.reserved_so === 0 ? (
                        <span style={{ color: '#888', fontWeight: 700 }}>0</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedSheetForReserve(stat)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10b981',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: '70px'
                          }}
                          title={`Всього на СО: ${stat.actual_so} л | Вільних: ${availSO} л | В резерві: ${stat.reserved_so} л (натисніть для деталей)`}
                        >
                          <span style={{ fontSize: '1.05rem', fontWeight: 950, color: '#10b981', lineHeight: 1.2 }}>
                            {stat.actual_so}
                          </span>
                          {stat.reserved_so > 0 ? (
                            <span style={{ fontSize: '0.66rem', color: '#ff9000', fontWeight: 800 }}>
                              {availSO} вільн ({stat.reserved_so} рез)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 700 }}>
                              вільно
                            </span>
                          )}
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })}
              {sheetsStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="sheets-text-muted" style={{ padding: '40px', textAlign: 'center', fontSize: '0.9rem' }}>
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
          className="sheets-modal-overlay"
          onClick={() => setSelectedSheetForReserve(null)}
        >
          <div 
            className="sheets-modal-panel"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(120, 120, 120, 0.2)', paddingBottom: '15px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#ff9000', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.5px' }}>
                  ДЕТАЛІЗАЦІЯ ЗАРЕЗЕРВОВАНИХ МАТЕРІАЛІВ
                </div>
                <h3 className="sheets-text-primary" style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 950 }}>
                  {selectedSheetForReserve.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedSheetForReserve(null)}
                style={{ background: 'rgba(120,120,120,0.1)', border: '1px solid rgba(120,120,120,0.2)', color: '#888', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Reserve Summary Info Badges */}
            <div className="sheets-modal-summary">
              <div>
                <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Залишок СО: </span>
                <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{selectedSheetForReserve.actual_so} л.</strong>
              </div>
              <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(120, 120, 120, 0.2)' }}>
                <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СО: </span>
                <strong style={{ color: '#ff9000', fontSize: '1.1rem' }}>{selectedSheetForReserve.reserved_so} л.</strong>
              </div>
              <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(120, 120, 120, 0.2)' }}>
                <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Вільний залишок СО: </span>
                <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                  {Math.max(0, selectedSheetForReserve.actual_so - selectedSheetForReserve.reserved_so)} л.
                </strong>
              </div>
              {selectedSheetForReserve.reserved_sv > 0 && (
                <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(120, 120, 120, 0.2)' }}>
                  <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Резерв СВ: </span>
                  <strong style={{ color: '#3b82f6', fontSize: '1.1rem' }}>{selectedSheetForReserve.reserved_sv} л.</strong>
                </div>
              )}
            </div>

            {/* Modal Content Table */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '5px' }}>
              {modalReserveDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'rgba(120,120,120,0.05)', border: '1px dashed rgba(120,120,120,0.2)', borderRadius: '16px' }}>
                  <FileText size={32} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <div className="sheets-text-primary" style={{ fontWeight: 800, fontSize: '0.95rem' }}>Деталізовані записи нарядів відсутні.</div>
                  <div className="sheets-text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Загальний резерв: {selectedSheetForReserve.reserved_sv + selectedSheetForReserve.reserved_so} л.
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr className="sheets-table-header">
                      <th style={{ padding: '12px' }}>ДЖЕРЕЛО / НАРЯД</th>
                      <th style={{ padding: '12px' }}>ВИРІБ (ПРОДУКЦІЯ)</th>
                      <th style={{ padding: '12px' }}>СКЛАД</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>ЗАРЕЗЕРВОВАНО</th>
                      <th style={{ padding: '14px', textAlign: 'right' }}>СТАТУС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalReserveDetails.map((detail, idx) => (
                      <tr key={detail.id || idx} className="sheets-table-row">
                        <td style={{ padding: '12px', fontWeight: 900 }}>
                          <div style={{ color: '#ff9000', fontSize: '0.9rem' }}>{detail.orderNum}</div>
                          <div className="sheets-text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>{detail.source}</div>
                        </td>
                        <td className="sheets-text-primary" style={{ padding: '12px', fontWeight: 800 }}>
                          <div>{detail.productName}</div>
                          {detail.partName && <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '2px' }}>Деталь: {detail.partName}</div>}
                          {detail.customer !== '—' && <div className="sheets-text-muted" style={{ fontSize: '0.72rem', marginTop: '1px' }}>Клієнт: {detail.customer}</div>}
                        </td>
                        <td style={{ padding: '12px', color: detail.warehouse.includes('СВ') ? '#3b82f6' : '#10b981', fontWeight: 800, fontSize: '0.8rem' }}>
                          {detail.warehouse}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontWeight: 950, color: '#ff9000', fontSize: '1.05rem' }}>
                              {detail.quantity} <span className="sheets-text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>л.</span>
                            </span>
                            {detail.taskProgress ? (
                              <div style={{ marginTop: '4px', textAlign: 'center', lineHeight: 1.3 }}>
                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800 }}>
                                  План наряду: {detail.taskProgress.totalSheetsPlanned || detail.planQty} л.
                                </div>
                                <div style={{ fontSize: '0.66rem', marginTop: '2px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
                                  {detail.taskProgress.cutSheets > 0 && (
                                    <span style={{ color: '#10b981', fontWeight: 900 }}>
                                      ✓ {detail.taskProgress.cutSheets} л. розкроєно ({detail.taskProgress.cutCardsCount} к.)
                                    </span>
                                  )}
                                  {detail.taskProgress.inProgressSheets > 0 && (
                                    <span style={{ color: '#f59e0b', fontWeight: 900 }}>
                                      ⚙ {detail.taskProgress.inProgressSheets} л. в роботі ({detail.taskProgress.inProgressCardsCount} к.)
                                    </span>
                                  )}
                                  {detail.taskProgress.newSheets > 0 && (
                                    <span style={{ color: '#888', fontWeight: 700 }}>
                                      ⏳ {detail.taskProgress.newSheets} л. черга ({detail.taskProgress.newCardsCount} к.)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : detail.planQty ? (
                              <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 800, marginTop: '2px' }}>
                                План наряду: {detail.planQty} л.
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span style={{ 
                            background: detail.status.includes('завершено') ? 'rgba(16,185,129,0.12)' : detail.status.includes('В розкрої') ? 'rgba(234,179,8,0.15)' : 'rgba(255,144,0,0.12)', 
                            color: detail.status.includes('завершено') ? '#10b981' : detail.status.includes('В розкрої') ? '#f59e0b' : '#ff9000', 
                            border: `1px solid ${detail.status.includes('завершено') ? 'rgba(16,185,129,0.3)' : detail.status.includes('В розкрої') ? 'rgba(234,179,8,0.3)' : 'rgba(255,144,0,0.3)'}`, 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.72rem', 
                            fontWeight: 900 
                          }}>
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
            <div style={{ borderTop: '1px solid rgba(120,120,120,0.2)', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSheetForReserve(null)}
                style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 950, fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s' }}
              >
                ЗАКРИТИ
              </button>
            </div>

          </div>
        </div>
      )}

      {/* USED / CUT SHEETS DETAILS MODAL */}
      {selectedSheetForUsed && (
        <div 
          className="sheets-modal-overlay"
          onClick={() => setSelectedSheetForUsed(null)}
        >
          <div 
            className="sheets-modal-panel"
            style={{ maxWidth: '1000px', width: '95%' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(120, 120, 120, 0.2)', paddingBottom: '15px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Scissors size={14} color="#f59e0b" /> ДЕТАЛІЗАЦІЯ ВИТРАЧЕНИХ МАТЕРІАЛІВ (РОЗКРІЙ)
                </div>
                <h3 className="sheets-text-primary" style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 950 }}>
                  {selectedSheetForUsed.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedSheetForUsed(null)}
                style={{ background: 'rgba(120,120,120,0.1)', border: '1px solid rgba(120,120,120,0.2)', color: '#888', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Summary Badges */}
            <div className="sheets-modal-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div>
                <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Витрачено за період: </span>
                <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{selectedSheetForUsed.used} л.</strong>
              </div>
              <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(120, 120, 120, 0.2)' }}>
                <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Розкроєно карток: </span>
                <strong style={{ color: '#3b82f6', fontSize: '1.1rem' }}>{selectedSheetForUsed.usedRecords?.length || 0} к.</strong>
              </div>
              <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(120, 120, 120, 0.2)' }}>
                <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Деталей виготовлено: </span>
                <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                  {selectedSheetForUsed.usedRecords?.reduce((s, r) => s + (r.qtyCompleted || 0), 0)} шт.
                </strong>
              </div>
              {selectedSheetForUsed.usedRecords?.reduce((s, r) => s + (r.scrapQty || 0), 0) > 0 && (
                <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(120, 120, 120, 0.2)' }}>
                  <span className="sheets-text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900 }}>Брак деталей: </span>
                  <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>
                    {selectedSheetForUsed.usedRecords?.reduce((s, r) => s + (r.scrapQty || 0), 0)} шт.
                  </strong>
                </div>
              )}
            </div>

            {/* Used Table */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '5px', maxHeight: '550px' }}>
              {!selectedSheetForUsed.usedRecords || selectedSheetForUsed.usedRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'rgba(120,120,120,0.05)', border: '1px dashed rgba(120,120,120,0.2)', borderRadius: '16px' }}>
                  <FileText size={32} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <div className="sheets-text-primary" style={{ fontWeight: 800, fontSize: '0.95rem' }}>За обраний період розкроєних карток не знайдено.</div>
                  <div className="sheets-text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Перевірте обраний діапазон дат у фільтрі звіту.
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr className="sheets-table-header">
                      <th style={{ padding: '12px' }}>НАРЯД / ЗАМОВНИК</th>
                      <th style={{ padding: '12px' }}>ВИРІБ (ПРОДУКЦІЯ)</th>
                      <th style={{ padding: '12px' }}>ДЕТАЛЬ В РОЗКРІЙ</th>
                      <th style={{ padding: '12px' }}>КАРТКА / ВЕРСТАТ</th>
                      <th style={{ padding: '12px' }}>ОПЕРАТОР / ДАТА</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>ВИТРАЧЕНО</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>РЕЗУЛЬТАТ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSheetForUsed.usedRecords.map((rec, idx) => (
                      <tr key={rec.id || idx} className="sheets-table-row">
                        <td style={{ padding: '12px', fontWeight: 900 }}>
                          <div style={{ color: '#ff9000', fontSize: '0.9rem' }}>{rec.orderNum}</div>
                          {rec.customer !== '—' && (
                            <div className="sheets-text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                              {rec.customer}
                            </div>
                          )}
                        </td>
                        <td className="sheets-text-primary" style={{ padding: '12px', fontWeight: 800 }}>
                          <div>{rec.productName}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 900, color: '#3b82f6', fontSize: '0.88rem' }}>
                            {rec.partName}
                          </div>
                          {rec.partCode && (
                            <div className="sheets-text-muted" style={{ fontSize: '0.68rem', marginTop: '1px' }}>
                              {rec.partCode}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 900, color: 'var(--text-strong)' }}>
                            {rec.cardDisplay}
                          </div>
                          {rec.machineName && !isPlaceholderMachine(rec.machineName) ? (
                            <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 800, marginTop: '2px' }}>
                              {rec.machineName}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>
                              Верстат не вказано
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>
                            {rec.operatorName}
                          </div>
                          <div className="sheets-text-muted" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                            {rec.dateFormatted}
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 950, color: '#f59e0b', fontSize: '1.05rem' }}>
                            {rec.sheetsCount} <span className="sheets-text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>л.</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 900, color: '#10b981', fontSize: '0.9rem' }}>
                            {rec.qtyCompleted} шт.
                          </div>
                          {rec.scrapQty > 0 && (
                            <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>
                              Брак: {rec.scrapQty} шт.
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid rgba(120,120,120,0.2)', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSheetForUsed(null)}
                style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 950, fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s' }}
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
