// ── Default Hierarchical Tree of Groups for ERP Accounting ─────────────────
export const DEFAULT_ERP_GROUPS = [
  { id: 'cat_raw', code: 'RAW', name: '01. Сировина та матеріали', parent_id: null, sort_order: 10 },
  { id: 'grp_carbon_sheets', code: 'RAW.CARBON', name: 'Карбонові листи', parent_id: 'cat_raw', sort_order: 11 },
  { id: 'grp_carbon_t300', code: 'RAW.CARBON.T300', name: 'Карбонова пластина Т300', parent_id: 'grp_carbon_sheets', sort_order: 12, rule_type: 'carbon' },
  { id: 'grp_carbon_t700', code: 'RAW.CARBON.T700', name: 'Карбонова пластина Т700', parent_id: 'grp_carbon_sheets', sort_order: 13, rule_type: 'carbon' },
  { id: 'grp_carbon_t800', code: 'RAW.CARBON.T800', name: 'Карбонова пластина Т800', parent_id: 'grp_carbon_sheets', sort_order: 14, rule_type: 'carbon' },
  { id: 'grp_rubber', code: 'RAW.RUBBER', name: 'Гума еластична листова', parent_id: 'cat_raw', sort_order: 14, rule_type: 'rubber' },
  { id: 'grp_paint', code: 'RAW.PAINT', name: 'Лакофарбові матеріали', parent_id: 'cat_raw', sort_order: 15, rule_type: 'paint' },
  { id: 'grp_mills', code: 'RAW.MILL', name: 'Фрези', parent_id: 'cat_raw', sort_order: 16, rule_type: 'mill' },

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
      { key: 'sheetGrade', label: 'Марка сировини (Т300/Т700)', required: true },
      { key: 'sheetThickness', label: 'Товщина листа (мм)', required: true },
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
