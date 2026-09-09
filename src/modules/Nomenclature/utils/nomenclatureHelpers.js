// ── Default Hierarchical Tree of Groups for ERP Accounting ─────────────────
export const DEFAULT_ERP_GROUPS = [
  { id: 'cat_raw', code: 'RAW', name: '01. Сировина та матеріали', parent_id: null, sort_order: 10 },
  { id: 'grp_carbon_sheets', code: 'RAW.CARBON', name: 'Вхідні карбонові пластини (СВ)', parent_id: 'cat_raw', sort_order: 11 },
  { id: 'grp_carbon_t300', code: 'RAW.CARBON.T300', name: 'Карбонова пластина Т300', parent_id: 'grp_carbon_sheets', sort_order: 12, rule_type: 'carbon' },
  { id: 'grp_carbon_t700', code: 'RAW.CARBON.T700', name: 'Карбонова пластина Т700', parent_id: 'grp_carbon_sheets', sort_order: 13, rule_type: 'carbon' },
  { id: 'grp_carbon_t800', code: 'RAW.CARBON.T800', name: 'Карбонова пластина Т800', parent_id: 'grp_carbon_sheets', sort_order: 14, rule_type: 'carbon' },
  { id: 'grp_prepared_sheets', code: 'RAW.PREP_SHEETS', name: 'Робочі листи для ЧПУ (СО)', parent_id: 'cat_raw', sort_order: 15, rule_type: 'generic' },
  { id: 'grp_rubber', code: 'RAW.RUBBER', name: 'Гума еластична листова', parent_id: 'cat_raw', sort_order: 16, rule_type: 'rubber' },
  { id: 'grp_paint', code: 'RAW.PAINT', name: 'Лакофарбові матеріали', parent_id: 'cat_raw', sort_order: 17, rule_type: 'paint' },
  { id: 'grp_mills', code: 'RAW.MILL', name: 'Фрези', parent_id: 'cat_raw', sort_order: 18, rule_type: 'mill' },

  { id: 'cat_hw', code: 'HW', name: '02. Комплектуючі та Метизи', parent_id: null, sort_order: 20 },
  { id: 'grp_hardware_main', code: 'HW.FASTENERS', name: 'Метизи', parent_id: 'cat_hw', sort_order: 21 },
  { id: 'grp_screws_black', code: 'HW.SCREW.BLACK', name: 'Гвинт (чорний)', parent_id: 'grp_hardware_main', sort_order: 22, rule_type: 'screw_black' },
  { id: 'grp_screws_silver', code: 'HW.SCREW.SILVER', name: 'Гвинти (срібні)', parent_id: 'grp_hardware_main', sort_order: 23, rule_type: 'screw_silver' },
  { id: 'grp_nuts', code: 'HW.NUT', name: 'Гайки', parent_id: 'grp_hardware_main', sort_order: 24, rule_type: 'nut' },
  { id: 'grp_press_nuts', code: 'HW.PRESS_NUT', name: 'Гайки запресовочні', parent_id: 'grp_hardware_main', sort_order: 25, rule_type: 'press_nut' },
  { id: 'grp_components_main', code: 'HW.COMPONENTS', name: 'Комплектуючі', parent_id: 'cat_hw', sort_order: 26 },
  { id: 'grp_standoffs', code: 'HW.STANDOFF', name: 'Стійки міжплатні', parent_id: 'grp_components_main', sort_order: 27, rule_type: 'standoff' },

  { id: 'cat_parts', code: 'PARTS', name: '03. Деталі', parent_id: null, sort_order: 30, rule_type: 'frame_part' },

  { id: 'cat_fg', code: 'FG', name: '04. Готова продукція', parent_id: null, sort_order: 40, rule_type: 'full_frame' },
  { id: 'grp_production_frames', code: 'FG.PRODUCTION', name: 'Продакшн', parent_id: 'cat_fg', sort_order: 41, rule_type: 'full_frame' },
  { id: 'grp_test_samples', code: 'FG.TEST_SAMPLE', name: 'Тестові зразки', parent_id: 'cat_fg', sort_order: 42, rule_type: 'full_frame' }
];

// ── ERP Category Rules & Reference Dictionaries Engine ──────────────────────
export const ERP_CATEGORY_SCHEMAS = {
  screw: {
    title: '02. Гвинти',
    fields: [
      { key: 'standard', label: 'Стандарт (DIN / ISO)', required: true },
      { key: 'diameter', label: 'Різьба (М)', required: true },
      { key: 'length', label: 'Довжина (мм)', required: true }
    ]
  },
  screw_black: {
    title: '02. Гвинти (чорні)',
    fields: [
      { key: 'standard', label: 'Стандарт (DIN / ISO)', required: true },
      { key: 'diameter', label: 'Різьба (М)', required: true },
      { key: 'length', label: 'Довжина (мм)', required: true }
    ]
  },
  screw_silver: {
    title: '02. Гвинти (срібні)',
    fields: [
      { key: 'standard', label: 'Стандарт (DIN / ISO)', required: true },
      { key: 'diameter', label: 'Різьба (М)', required: true },
      { key: 'length', label: 'Довжина (мм)', required: true }
    ]
  },
  nut: {
    title: '02. Гайки',
    fields: [
      { key: 'din', label: 'Стандарт (DIN)', required: true },
      { key: 'diameter', label: 'Різьба (М)', required: true }
    ]
  },
  press_nut: {
    title: '02. Гайки запресовочні',
    fields: [
      { key: 'diameter', label: 'Різьба (М)', required: true },
      { key: 'thickness', label: 'Товщина запресовки', required: true }
    ]
  },
  standoff: {
    title: '02. Стійки міжплатні',
    fields: [
      { key: 'type', label: 'Тип стійки (TFF/TFM)', required: true },
      { key: 'thread', label: 'Різьба (М)', required: true },
      { key: 'length', label: 'Довжина стійки (мм)', required: true },
      { key: 'material', label: 'Матеріал', required: true }
    ]
  },
  mill: {
    title: '01. Фрези',
    fields: [
      { key: 'type', label: 'Тип фрези', required: true },
      { key: 'shankDia', label: 'D цанги (мм)', required: true },
      { key: 'totalLength', label: 'L довжина (мм)', required: true }
    ]
  },
  carbon: {
    title: '01. Карбонові листи',
    fields: [
      { key: 'grade', label: 'Марка (Т300/Т700)', required: true },
      { key: 'dimensions', label: 'Формат (500*600)', required: true },
      { key: 'thickness', label: 'Товщина (мм)', required: true }
    ]
  },
  rubber: {
    title: '01. Гума еластична листова',
    fields: [
      { key: 'dimensions', label: 'Формат (500*500)', required: true },
      { key: 'thickness', label: 'Товщина (мм)', required: true }
    ]
  },
  paint: {
    title: '01. Лакофарбові матеріали',
    fields: [
      { key: 'category', label: 'Тип матеріалу', required: true },
      { key: 'code', label: 'Бренд / Маркування', required: true }
    ]
  },
  frame_part: {
    title: '03. Деталі (Лазерне різання)',
    fields: [
      { key: 'name', label: 'Назва деталі', required: true },
      { key: 'default_material_id', label: 'Робочий матеріал / лист ЧПК', required: true },
      { key: 'unitsPerSheet', label: 'Норма деталей з 1 листа (шт/л)', required: true },
      { key: 'loadTimings', label: 'Таймінги загрузок (2, 4, 8, 16, 32, 64 л.)', required: false }
    ]
  },
  full_frame: {
    title: '04. Готова продукція (Рами та Комплекти)',
    fields: [
      { key: 'name', label: 'Назва виробу / комплекту', required: true }
    ]
  }
};

// ── Smart Naming Rules Generator Engine ─────────────────────────────────────
export const generateStandardName = (ruleType, params) => {
  if (!params) return '';

  switch (ruleType) {
    case 'screw':
    case 'screw_black':
    case 'screw_silver': {
      const std = params.standard === 'custom' 
        ? (params.customStandard || 'DIN...').trim() 
        : (params.standard || 'DIN912').trim();
      const dia = params.diameter === 'custom' 
        ? (params.customDiameter || '3').trim() 
        : (params.diameter || '3').trim();
      const len = (params.length || '10').trim();
      const isBlack = params.isBlack;
      const col = isBlack ? '(чорний)' : '';
      const thread = params.isPartialThread ? 'неповна різьба' : '';
      return `Гвинт ${std} М${dia}*${len}${col ? ' ' + col : ''}${thread ? ' ' + thread : ''}`.replace(/\s+/g, ' ').trim();
    }
    case 'standoff': {
      const type = (params.type || 'TFF').trim();
      const thread = (params.thread || '3').trim();
      let len = (params.length || '20').trim();
      if (type === 'TFM' && params.tailLength) {
        len = `${len}+${params.tailLength.trim()}`;
      }
      const dia = params.outerDiameter ? `${params.outerDiameter.trim()}мм` : '';
      const mat = (params.material || 'Алюміній').trim();
      return `Стійка ${type} М${thread}*${len}${dia ? ' ' + dia : ''} ${mat}`.replace(/\s+/g, ' ').trim();
    }
    case 'mill': {
      const rawType = params.type === 'custom' ? (params.customMillType || 'кукурудза').trim() : (params.type || 'кукурудза').trim();
      const type = rawType.toLowerCase();
      const D = params.shankDia === 'custom' ? (params.customShankDia || '3,175').trim() : (params.shankDia || '3,175').trim();
      const L = params.totalLength === 'custom' ? (params.customTotalLength || '38').trim() : (params.totalLength || '38').trim();

      if (type === 'фасочна') {
        const angle = params.angle === 'custom' ? (params.customAngle || '90').trim() : (params.angle || '90').trim();
        return `Фреза фасочна ${D}х${L}х${angle}°`.trim();
      }
      if (type.includes('сферична')) {
        const dia = params.cutDia === 'custom' ? (params.customCutDia || '4').trim() : (params.cutDia || '4').trim();
        return `Фреза сферична по алюмінію ф ${dia}мм`.trim();
      }
      const d = params.cutDia === 'custom' ? (params.customCutDia || '1,5').trim() : (params.cutDia || '1,5').trim();
      const l = params.cutLength === 'custom' ? (params.customCutLength || '8').trim() : (params.cutLength || '8').trim();
      return `Фреза ${rawType} ${d}х${D}х${l}х${L}`.trim();
    }
    case 'nut': {
      const spec = params.specialType === 'custom' ? (params.customSpecialType || '').trim() : (params.specialType || '').trim();
      const dia = params.diameter === 'custom' ? (params.customDiameter || '3').trim() : (params.diameter || '3').trim();
      const din = params.din === 'custom' ? (params.customDin || 'DIN 934').trim() : (params.din || 'DIN 934').trim();
      const col = params.isBlack ? '(чорний)' : '';
      const prefix = spec ? `Гайка ${spec}` : 'Гайка';
      return `${prefix} М${dia} ${din}${col ? ' ' + col : ''}`.replace(/\s+/g, ' ').trim();
    }
    case 'press_nut': {
      const dia = params.diameter === 'custom' ? (params.customDiameter || '3').trim() : (params.diameter || '3').trim();
      const thick = (params.thickness || '1').trim();
      const col = params.isBlack ? '(чорний)' : '';
      return `Гайка запресовочна M${dia}*${thick}${col ? ' ' + col : ''}`.replace(/\s+/g, ' ').trim();
    }
    case 'carbon': {
      const grade = params.grade === 'custom' ? (params.customGrade || 'Т300').trim() : (params.grade || 'Т300').trim();
      const dims = params.dimensions === 'custom' ? (params.customDimensions || '500*600').trim() : (params.dimensions || '500*600').trim();
      const thick = params.thickness === 'custom' ? (params.customThickness || '1').trim() : (params.thickness || '1').trim();
      const extra = params.extra === 'custom' ? (params.customExtra || '').trim() : (params.extra || '').trim();
      
      let res = `Карбонова пластина ${grade} ${dims} ${thick}мм`;
      if (extra && extra !== '—') {
        const extraFormatted = extra.startsWith('(') ? extra : `(${extra})`;
        res += ` ${extraFormatted}`;
      }
      return res.replace(/\s+/g, ' ').trim();
    }
    case 'rubber': {
      const dims = (params.dimensions || '500*500').trim();
      const thick = (params.thickness || '2').trim();
      return `Гума еластична листова ${dims}*${thick}мм`.trim();
    }
    case 'paint': {
      const category = (params.category || 'Фарба поліуретанова').trim();
      const code = (params.code || '7525 SELEMIX').trim();
      const ral = (params.ral || 'RAL 7024').trim();
      if (category.includes('Фарба')) {
        return `${category} ${code} ${ral}`.trim();
      }
      return `${category} ${code}`.trim();
    }
    case 'full_frame':
    case 'element_kit': {
      const prefixChoice = params.prefixChoice || (ruleType === 'element_kit' ? 'Комплект карбонових елементів' : 'Комплект карбонової рами');
      const prefix = (prefixChoice === 'custom' ? params.customPrefix || '' : prefixChoice).trim();
      
      const projType = params.projType || 'SERIAL';
      const projNum = (params.projNum || '').trim();
      const customProjType = (params.customProjType || '').trim();
      
      const seriesType = params.seriesType || '';
      const seriesLabel = (seriesType === 'custom' ? params.customSeries || '' : seriesType).trim();
      
      const name = (params.name || '').trim();

      let tag = '';
      if (projType === 'RND' && projNum) tag = `(RND ${projNum})`;
      else if (projType === 'IP' && projNum) tag = `(ІП ${projNum})`;
      else if (projType === 'CUSTOM' && projNum) tag = customProjType ? `(${customProjType} ${projNum})` : `(${projNum})`;

      const seriesAndModel = (seriesLabel && name) ? `${seriesLabel}${name}` : (seriesLabel || name);

      let res = prefix || 'Комплект карбонової рами';
      if (tag) res += ` ${tag}`;
      if (seriesAndModel) res += ` ${seriesAndModel}`;
      return res.replace(/\s+/g, ' ').trim();
    }
    case 'frame_part': {
      const name = (params.name || params.customName || '').trim();
      return name;
    }
    default:
      return (params.customName || '').trim();
  }
};

// ── Helper to Flatten Tree into Indented Options for Select Dropdowns ───────
export const buildFlattenedGroupOptions = (allGroups) => {
  const result = [];
  const walk = (parentId, depth) => {
    const children = allGroups
      .filter(g => (g.parent_id || null) === parentId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    children.forEach(g => {
      const hasSubs = allGroups.some(c => c.parent_id === g.id);
      let prefix = '';
      if (depth === 1) prefix = '  ├─ ';
      else if (depth === 2) prefix = '      └─ ';
      else if (depth >= 3) prefix = '          └─ ';

      result.push({
        id: g.id,
        name: g.name,
        label: `${prefix}${g.name}`,
        depth,
        hasSubs,
        rule_type: g.rule_type
      });

      walk(g.id, depth + 1);
    });
  };

  walk(null, 0);
  return result;
};

export const inputStyle = {
  width: '100%',
  background: 'var(--input-bg, #161616)',
  border: '1px solid var(--border-color, #282828)',
  borderRadius: '10px',
  padding: '10px 14px',
  color: 'var(--text, #ffffff)',
  fontSize: '0.85rem',
  fontWeight: 700,
  outline: 'none',
  marginTop: '4px'
};

/**
 * Maps an input carbon plate (or legacy raw sheet) from Warehouse SV to the working sheet for Shop 1 CNC.
 * Calculates the conversion yield ratio (e.g. 1000*600 plate -> 2 sheets of 500*600, 500*600 -> 1 sheet).
 */
export const matchPlateToWorkingSheet = (rawName = '') => {
  if (!rawName) return null;
  const str = String(rawName).trim();
  
  // Extract grade / brand (Т300, Т700, Т800, etc.)
  const brandMatch = str.match(/(?:Т|T)(300|700|800|1000)/i);
  const brand = brandMatch ? `Т${brandMatch[1]}` : 'Т300';
  
  // Extract thickness (e.g. 3мм, 2.5мм, 2,5мм, 11мм)
  const thickMatch = str.match(/(\d+(?:[.,]\d+)?)\s*мм/i) || str.match(/\((\d+(?:[.,]\d+)?)\s*мм\)/i);
  const thickness = thickMatch ? thickMatch[1].replace(',', '.') : null;
  
  if (!thickness) return null;
  
  // Check geometry / dimensions (e.g. 1000*600, 1000x600, 500*600)
  const dimMatch = str.match(/(\d+)\s*[*xXхХ]\s*(\d+)/);
  let yieldRatio = 1;
  if (dimMatch) {
    const dim1 = parseInt(dimMatch[1], 10);
    const dim2 = parseInt(dimMatch[2], 10);
    const maxDim = Math.max(dim1, dim2);
    if (maxDim >= 950) {
      yieldRatio = 2; // e.g. 1000*600 yields 2 sheets of 500*600
    }
  } else if (str.includes('1000')) {
    yieldRatio = 2;
  }
  
  const workingSheetName = `Лист ${brand} (${thickness}мм)`;
  const legacyPrepName = `Лист ${brand} (${thickness}мм) [Підготовлений]`;
  
  return {
    brand,
    thickness,
    yieldRatio,
    workingSheetName,
    legacyPrepName
  };
};

export const classifyV2Type = (v) => {
  if (!v) return 'part';
  
  const gid = String(v.group_id || '').toLowerCase();
  const rule = String(v.rule_type || '').toLowerCase();
  const name = String(v.name || '').toLowerCase();

  // 1. Raw Materials (Сировина: карбонові пластини, труби, листи, смоли, гума, фарба)
  if (
    gid === 'grp_carbon_t300' ||
    gid === 'grp_carbon_t700' ||
    gid === 'grp_carbon_t800' ||
    gid === 'grp_carbon_sheets' ||
    gid === 'grp_prepared_sheets' ||
    gid === 'grp_rubber' ||
    gid === 'grp_paint' ||
    gid.startsWith('cat_raw') ||
    gid.startsWith('raw') ||
    rule === 'carbon' ||
    rule === 'rubber' ||
    rule === 'paint' ||
    name.includes('карбонов') ||
    name.includes('пластина т') ||
    name.includes('лист') ||
    name.includes('труба') ||
    name.includes('пруток') ||
    name.includes('склотекстоліт') ||
    name.includes('гума') ||
    name.includes('фарба')
  ) {
    return 'raw';
  }

  // 2. Mills / Cutters (Фрези)
  if (gid === 'grp_mills' || rule === 'mill' || name.includes('фреза')) {
    return 'cutter';
  }

  // 3. Products / Finished frames (Готові вироби)
  if (
    gid === 'grp_production_frames' ||
    gid === 'grp_test_samples' ||
    gid === 'cat_fg' ||
    rule === 'full_frame' ||
    name.includes('рама') ||
    name.includes('frame')
  ) {
    return 'product';
  }

  // 4. Assemblies (Вузли)
  if (gid === 'grp_assemblies' || v.type === 'assembly' || name.includes('вузол') || name.includes('комплект')) {
    return 'assembly';
  }

  // 5. Hardware / Fasteners (Метизи)
  if (
    gid === 'grp_nuts' ||
    gid === 'grp_press_nuts' ||
    gid === 'grp_screws_black' ||
    gid === 'grp_screws_silver' ||
    gid === 'grp_standoffs' ||
    gid === 'grp_hardware_main' ||
    gid.startsWith('cat_hw') ||
    gid.startsWith('hw') ||
    rule === 'screw' ||
    rule === 'screw_black' ||
    rule === 'screw_silver' ||
    rule === 'nut' ||
    rule === 'press_nut' ||
    rule === 'standoff' ||
    name.includes('гвинт') ||
    name.includes('гайка') ||
    name.includes('шайба') ||
    name.includes('шпилька') ||
    name.includes('заклепка') ||
    name.includes('стійка') ||
    name.includes('болт')
  ) {
    return 'hardware';
  }

  // 6. Frame parts (Деталі)
  if (
    rule === 'frame_part' ||
    gid === 'cat_parts' ||
    name.includes('деталь') ||
    name.includes('луч') ||
    name.includes('арм') ||
    name.includes('проставка') ||
    name.includes('рейка')
  ) {
    return 'part';
  }

  return v.type || 'part';
};

export const mapV2ToStandardNom = (v) => {
  if (!v) return null;
  const type = classifyV2Type(v);
  const rawUnitsPerSheet = Number(v.rule_params?.unitsPerSheet) || Number(v.units_per_sheet) || null;
  const rawMaterial = v.rule_params?.rawSheet || v.rule_params?.material || v.material_type || v.material || '';
  
  return {
    ...v,
    id: v.id,
    default_material_id: v.default_material_id || v.rule_params?.default_material_id || null,
    name: v.name,
    code: v.code || '',
    nomenclature_code: v.code || '',
    type,
    unit: v.unit || 'шт',
    units_per_sheet: rawUnitsPerSheet || 1,
    material_type: rawMaterial,
    material: rawMaterial,
    category: v.category || (String(v.group_id || '').startsWith('grp_carbon') || String(v.group_id || '').startsWith('cat_raw') ? 'Сировина' : 'Загальна')
  };
};

/**
 * Calculates free available stock on SGP warehouse for a given nomenclature item.
 * Supports V2 canonical ID, legacy V1 IDs, and normalized name fallback matching.
 * NOTE: type='bz' is intentionally EXCLUDED — it tracks parts transferred to Shop2 buffer,
 * not available stock for naryad planning.
 */
export const getAvailableSGPStock = (partNom, inventory) => {
  if (!partNom || !Array.isArray(inventory)) return 0;
  const partNomId = String(partNom.id || '');
  const partLegacyIds = new Set((partNom.legacy_ids || []).map(String));
  const normPartName = String(partNom.name || '').trim().toLowerCase();

  const matchingItems = inventory.filter(i => {
    if (!i) return false;
    const iNomId = String(i.nomenclature_id || '');
    const iName = String(i.name || '').trim().toLowerCase();

    const idMatch = iNomId && (iNomId === partNomId || partLegacyIds.has(iNomId));
    const nameMatch = Boolean(normPartName && iName === normPartName);

    // 'bz' is Shop2 buffer accounting — never count it as available SGP stock
    const isAvailableType = i.type === 'finished' || i.type === 'part' || i.warehouse === 'sgp';
    const isNotPocket = !i.pocket_owner || i.pocket_owner === 'Не вказано';

    return (idMatch || nameMatch) && isAvailableType && isNotPocket;
  });

  return matchingItems.reduce((acc, i) => acc + Math.max(0, (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0)), 0);
};

/**
 * Finds the primary matching inventory item on SGP warehouse for a given nomenclature.
 */
export const findMatchingSGPInventoryItem = (partNom, inventory) => {
  if (!partNom || !Array.isArray(inventory)) return null;
  const partNomId = String(partNom.id || '');
  const partLegacyIds = new Set((partNom.legacy_ids || []).map(String));
  const normPartName = String(partNom.name || '').trim().toLowerCase();

  return inventory.find(i => {
    if (!i) return false;
    const iNomId = String(i.nomenclature_id || '');
    const iName = String(i.name || '').trim().toLowerCase();

    const idMatch = iNomId && (iNomId === partNomId || partLegacyIds.has(iNomId));
    const nameMatch = Boolean(normPartName && iName === normPartName);

    const isAvailableType = i.type === 'bz' || i.type === 'finished' || i.type === 'part' || i.warehouse === 'sgp';
    const isNotPocket = !i.pocket_owner || i.pocket_owner === 'Не вказано';

    return (idMatch || nameMatch) && isAvailableType && isNotPocket;
  }) || null;
};

/**
 * Extracts numeric thickness (e.g. "7" or "2.5") from any label.
 */
export const extractThickness = (label) => {
  const str = String(label || '');
  const bracketMatch = str.match(/\((\d+(?:[.,]\d+)?)\s*мм\)/i);
  if (bracketMatch) return bracketMatch[1].replace(',', '.');
  const mmMatch = str.match(/(\d+(?:[.,]\d+)?)\s*мм/i);
  if (mmMatch) return mmMatch[1].replace(',', '.');
  const endMatch = str.match(/[-_\s](\d+(?:[.,]\d+)?)$/);
  if (endMatch) return endMatch[1].replace(',', '.');
  return null;
};

/**
 * Finds the working sheet for CNC cutting (Цех №1) from operational warehouse (СО).
 * Matches "Лист Т300 (Xмм)" or "Лист Т700 (Xмм)" (group_id = 'grp_prepared_sheets').
 * NEVER returns raw carbon plates ("Карбонова пластина...").
 */
export const findWorkingSheetNom = (typePrefix, thicknessLabel, nomenclatures = []) => {
  const normGrade = (typePrefix || 'Т300').toUpperCase().replace('T', 'Т');
  const thickNum = extractThickness(thicknessLabel);
  if (!thickNum) return null;

  return (nomenclatures || []).find(n => {
    const name = String(n.name || '').trim();
    // Strictly exclude raw carbon plates, rubber, or unfinished scrap
    if (name.toLowerCase().includes('пластина') || name.toLowerCase().includes('гума') || name.toLowerCase().includes('непідготовлений')) {
      return false;
    }
    const nameUpper = name.toUpperCase().replace('T', 'Т');
    const hasGrade = nameUpper.includes(normGrade);
    const hasSheetWord = nameUpper.startsWith('ЛИСТ') || n.group_id === 'grp_prepared_sheets' || n.rule_params?.type === 'working_sheet';
    if (!hasGrade || !hasSheetWord) return false;

    const nThick = extractThickness(name);
    return nThick && Math.abs(parseFloat(nThick) - parseFloat(thickNum)) < 0.05;
  }) || null;
};
