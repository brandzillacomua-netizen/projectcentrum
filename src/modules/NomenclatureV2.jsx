import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Menu, 
  Search, 
  Plus, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Edit2,
  Edit3, 
  Save, 
  X, 
  FolderPlus, 
  Type,
  Activity,
  Check,
  AlertCircle,
  Clock,
  Loader2,
  Folder,
  FolderOpen,
  Package,
  Wrench,
  Cpu,
  Sparkles,
  Info,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { useMES } from '../MESContext';

// ── Default Hierarchical Tree of Groups for ERP Accounting ─────────────────
const DEFAULT_ERP_GROUPS = [
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
      { key: 'unitsPerSheet', label: 'Норма деталей з 1 листа (шт/л)', required: true }
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
      // Rule: Гвинт {Standard} М{Diameter}*{Length} [({Color})] [{ThreadType}]
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
      // Rule: Стійка {Type: TFF/TFM} М{Thread}*{Length}[+{Tail}] [{OuterDia}] {Material}
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
      // Rule: Фреза {Type} {d}х{D}х{l}х{L} or Фреза фасочна {D}х{L}х{Angle}°
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
      // Rule: Гайка [{SpecialType}] М{Diameter} [{DIN}] [({Color})]
      const spec = params.specialType === 'custom' ? (params.customSpecialType || '').trim() : (params.specialType || '').trim();
      const dia = params.diameter === 'custom' ? (params.customDiameter || '3').trim() : (params.diameter || '3').trim();
      const din = params.din === 'custom' ? (params.customDin || 'DIN 934').trim() : (params.din || 'DIN 934').trim();
      const col = params.isBlack ? '(чорний)' : '';
      const prefix = spec ? `Гайка ${spec}` : 'Гайка';
      return `${prefix} М${dia} ${din}${col ? ' ' + col : ''}`.replace(/\s+/g, ' ').trim();
    }
    case 'press_nut': {
      // Rule: Гайка запресовочна M{Diameter}*{Thickness} [({Color})]
      const dia = params.diameter === 'custom' ? (params.customDiameter || '3').trim() : (params.diameter || '3').trim();
      const thick = (params.thickness || '1').trim();
      const col = params.isBlack ? '(чорний)' : '';
      return `Гайка запресовочна M${dia}*${thick}${col ? ' ' + col : ''}`.replace(/\s+/g, ' ').trim();
    }
    case 'carbon': {
      // Rule: Карбонова пластина {Grade} {Dimensions} {Thickness}мм[ ({Extra})]
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
      // Rule: Гума еластична листова {Dimensions: 500*500}*{Thickness}мм
      const dims = (params.dimensions || '500*500').trim();
      const thick = (params.thickness || '2').trim();
      return `Гума еластична листова ${dims}*${thick}мм`.trim();
    }
    case 'paint': {
      // Rule: Фарба/Затверджувач/Розчинник ...
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

// ── Tree Item Component ─────────────────────────────────────────────────────
const GroupTreeNode = ({ group, allGroups, activeGroupId, onSelectGroup, onAddSubgroup, onEditGroup, onDeleteGroup, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const children = useMemo(() => allGroups.filter(g => g.parent_id === group.id), [allGroups, group.id]);
  const hasChildren = children.length > 0;
  const isSelected = activeGroupId === group.id;

  const handleNodeClick = () => {
    onSelectGroup(group);
    if (hasChildren) {
      setIsOpen(prev => !prev);
    }
  };

  return (
    <div className="tree-node-wrap" style={{ marginLeft: depth * 12 }}>
      <div 
        onClick={handleNodeClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '8px 10px', 
          background: isSelected ? 'rgba(255, 144, 0, 0.15)' : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent', 
          borderRadius: '10px', 
          border: isSelected ? '1px solid rgba(255, 144, 0, 0.4)' : '1px solid transparent',
          marginBottom: '3px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          {hasChildren ? (
            <div style={{ color: '#ff9000', display: 'flex', alignItems: 'center' }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          ) : (
            <div style={{ width: '14px' }} />
          )}

          {hasChildren ? (
            isOpen ? <FolderOpen size={16} color="#ff9000" /> : <Folder size={16} color="#e58300" />
          ) : (
            <Folder size={15} color={isSelected ? '#ff9000' : '#888'} />
          )}

          <span style={{ 
            fontWeight: isSelected || depth === 0 ? 800 : 600, 
            fontSize: depth === 0 ? '0.85rem' : '0.8rem', 
            color: isSelected ? '#ff9000' : depth === 0 ? '#eee' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {group.name}
          </span>
        </div>

        {group.code && !isHovered && (
          <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900, fontFamily: 'monospace' }}>
            {group.code}
          </span>
        )}

        {/* Hover Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', opacity: isHovered || isSelected ? 1 : 0, transition: 'opacity 0.2s' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); onAddSubgroup(group); }} 
            title="Додати підкатегорію сюди" 
            style={{ background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '6px', color: '#ff9000', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
          >
            <FolderPlus size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEditGroup(group); }} 
            title="Редагувати категорію" 
            style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
          >
            <Edit2 size={12} />
          </button>
          {!hasChildren && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }} 
              title="Видалити категорію" 
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className="tree-node-children">
          {children.map(child => (
            <GroupTreeNode 
              key={child.id} 
              group={child} 
              allGroups={allGroups} 
              activeGroupId={activeGroupId}
              onSelectGroup={onSelectGroup}
              onAddSubgroup={onAddSubgroup}
              onEditGroup={onEditGroup}
              onDeleteGroup={onDeleteGroup}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main NomenclatureV2 Component ───────────────────────────────────────────
const NomenclatureV2 = () => {
  const { currentUser } = useMES();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const INITIAL_PREFIXES = ['Комплект карбонової рами', 'Комплект карбонових елементів', 'Складова рами'];
  const INITIAL_SERIES = ['F', 'KHARAK', 'Drozd', 'BITA'];

  const [prefixList, setPrefixList] = useState(() => {
    try {
      const raw = localStorage.getItem('centrum_nom_prefixes');
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
    } catch (e) {}
    return INITIAL_PREFIXES;
  });

  const [seriesList, setSeriesList] = useState(() => {
    try {
      const raw = localStorage.getItem('centrum_nom_series');
      if (raw) { const s = JSON.parse(raw); if (Array.isArray(s) && s.length > 0) return s; }
    } catch (e) {}
    return INITIAL_SERIES;
  });

  const [showPrefixManage, setShowPrefixManage] = useState(false);
  const [showSeriesManage, setShowSeriesManage] = useState(false);

  const isDirector = !!(currentUser?.rights?.director || currentUser?.access_rights?.director || ['адмін', 'директор', 'керівник'].some(w => (currentUser?.position || '').toLowerCase().includes(w)));

  const removePrefixItem = (itemToRemove) => {
    const updated = prefixList.filter(i => i !== itemToRemove);
    setPrefixList(updated);
    try { localStorage.setItem('centrum_nom_prefixes', JSON.stringify(updated)); } catch (e) {}
  };

  const removeSeriesItem = (itemToRemove) => {
    const updated = seriesList.filter(i => i !== itemToRemove);
    setSeriesList(updated);
    try { localStorage.setItem('centrum_nom_series', JSON.stringify(updated)); } catch (e) {}
  };
  
  const [groups, setGroups] = useState(DEFAULT_ERP_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [items, setItems] = useState([]);
  
  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Wizard State
  const [wizardGroup, setWizardGroup] = useState(null);
  const [wizardRuleType, setWizardRuleType] = useState('screw');
  const [wizardParams, setWizardParams] = useState({
    // Screws
    standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
    // Standoffs
    type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
    // Mills
    cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
    // Nuts
    specialType: '', din: 'DIN 934', thickness: '1',
    // Carbon/Rubber
    grade: 'Т300', dimensions: '500*600', extra: '',
    // Frames
    projType: 'RND', projNum: '', name: '',
    // Custom
    customName: '', unit: 'шт'
  });

  const [newGroup, setNewGroup] = useState({ name: '', code: '', parent_id: null, rule_type: 'generic' });
  const [toastMessage, setToastMessage] = useState('');

  const flattenedGroups = useMemo(() => {
    return buildFlattenedGroupOptions(groups);
  }, [groups]);

  // Dynamic Self-Learning Reference Dictionaries
  const [refDicts, setRefDicts] = useState(() => {
    const saved = localStorage.getItem('v2_erp_ref_dictionaries_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      grades: ['Т300', 'Т700'],
      thicknesses: ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '10'],
      extras: ['(преференція)'],
      screwStandards: ['DIN912', 'DIN7991', 'ISO7380', 'DIN7985', 'DIN913'],
      screwDiameters: ['1,6', '2', '2,5', '3', '4', '5', '6', '8', '10', '12', '14'],
      nutDins: ['DIN 934', 'DIN 6923', 'DIN 985', 'DIN 439', 'DIN 1587'],
      nutSpecialTypes: ['з фланцем', 'з нейлоновим кільцем', 'низька', 'ковпачкова'],
      millTypes: ['кукурудза', 'двопера', 'чотирьохпера', 'фасочна', 'сферична по алюмінію'],
      millCutDias: ['1', '1,2', '1,5', '2', '2,5', '3', '3,175', '4', '6', '8'],
      millShankDias: ['3,175', '4', '6', '8', '10', '12'],
      millCutLengths: ['4', '6', '8', '12', '15', '17', '22', '25', '32'],
      millTotalLengths: ['38', '45', '50', '55', '60', '75', '100']
    };
  });

  const registerCustomValue = (key, val) => {
    if (!val || !val.trim()) return;
    const clean = val.trim();
    setRefDicts(prev => {
      const list = prev[key] || [];
      if (list.includes(clean)) return prev;
      const updated = { ...prev, [key]: [...list, clean] };
      localStorage.setItem('v2_erp_ref_dictionaries_v2', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load custom catalog groups from DB if any
      const { data: dbGroups } = await supabase.from('nomenclature_catalog_groups').select('*').order('sort_order');
      if (dbGroups && dbGroups.length > 0) {
        const rootIdMap = {
          'RAW': 'cat_raw',
          'HW': 'cat_hw',
          'TOOL': 'cat_raw',
          'PART': 'cat_parts',
          'PARTS': 'cat_parts',
          'FG': 'cat_fg'
        };
        const validRootIds = new Set(['cat_raw', 'cat_hw', 'cat_parts', 'cat_fg']);

        const redundantSubGroupNames = new Set(['деталі', 'деталь', 'сировина', 'метизи', 'інструмент', 'інструменти та розхідники']);
        const sanitizedDb = dbGroups.map(g => {
          const nameLower = String(g.name || '').trim().toLowerCase();
          const codeUpper = String(g.code || '').trim().toUpperCase();

          if (!g.parent_id && !validRootIds.has(g.id)) {
            let parentId = rootIdMap[codeUpper];
            if (!parentId) {
              if (nameLower.includes('сировин') || nameLower.includes('інструм') || nameLower.includes('розхід')) parentId = 'cat_raw';
              else if (nameLower.includes('метиз')) parentId = 'cat_hw';
              else if (nameLower.includes('детал') || nameLower.includes('напівфабр')) parentId = 'cat_parts';
              else if (nameLower.includes('готов') || nameLower.includes('рам')) parentId = 'cat_fg';
            }
            if (parentId) {
              if (redundantSubGroupNames.has(nameLower)) return null;
              return { ...g, parent_id: parentId };
            }
            return null; // Exclude orphan duplicate root groups
          }

          if (g.id === 'grp_drills' || g.code === 'TOOL.DRILL' || nameLower.includes('свердл') || g.id === 'grp_bushings' || g.code === 'HW.BUSHING' || nameLower.includes('втулк')) {
            return null;
          }

          if (g.parent_id === 'cat_parts' || g.parent_id === 'grp_frame_parts' || g.parent_id === 'grp_element_kits' || g.parent_id === 'cat_fg' || g.parent_id === 'grp_full_frames') {
            return null;
          }

          if (redundantSubGroupNames.has(nameLower) && validRootIds.has(g.parent_id)) {
            return null;
          }
          return g;
        }).filter(Boolean);

        const mergedMap = new Map();
        DEFAULT_ERP_GROUPS.forEach(g => mergedMap.set(g.id, g));
        sanitizedDb.forEach(g => {
          if (!mergedMap.has(g.id)) {
            mergedMap.set(g.id, g);
          }
        });
        setGroups(Array.from(mergedMap.values()));
      }

      // 2. Load strictly V2 catalog items from dedicated nomenclatures_v2 table
      const { data: v2Data, error: v2Err } = await supabase
        .from('nomenclatures_v2')
        .select('*')
        .order('created_at', { ascending: false });

      if (!v2Err && v2Data) {
        setItems(v2Data.map(row => ({
          id: row.id,
          code: row.code,
          name: row.name,
          group_id: row.group_id,
          unit: row.unit || 'шт',
          status: row.status || 'active',
          rule_type: row.rule_type,
          rule_params: row.rule_params,
          created_at: row.created_at
        })));
      } else {
        // Fallback: load profiles if table is awaiting migration
        const { data: profiles } = await supabase
          .from('nomenclature_catalog_profiles')
          .select('*, nomenclature:nomenclatures(*)')
          .eq('migration_state', 'verified');

        if (profiles) {
          setItems(profiles.map(p => ({
            id: p.nomenclature_id,
            code: p.catalog_code || 'V2-' + p.nomenclature_id.substring(0, 5),
            name: p.display_name || p.nomenclature?.name || 'Номенклатура V2',
            group_id: p.group_id,
            unit: p.base_unit_id || p.nomenclature?.unit || 'шт',
            status: p.lifecycle_status || 'active',
            created_at: p.created_at
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to load V2 catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generated Real-time Name
  const generatedName = useMemo(() => {
    return generateStandardName(wizardRuleType, wizardParams);
  }, [wizardRuleType, wizardParams]);

  // Duplicate Check
  const isDuplicate = useMemo(() => {
    if (!generatedName) return false;
    const norm = generatedName.toLowerCase().replace(/\s+/g, '');
    return items.some(it => (!editingItem || it.id !== editingItem.id) && it.name.toLowerCase().replace(/\s+/g, '') === norm);
  }, [generatedName, items, editingItem]);

  const handleOpenWizard = (groupOverride = null, itemToEdit = null) => {
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      const targetGroup = groups.find(g => g.id === itemToEdit.group_id) || selectedGroup || groups[1];
      const rType = itemToEdit.rule_type || targetGroup?.rule_type || 'generic';
      setWizardGroup(targetGroup);
      setWizardRuleType(rType);
      setWizardParams({
        standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
        type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
        cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
        specialType: '', din: 'DIN 934', thickness: '1',
        grade: 'Т300', dimensions: '500*600', extra: '',
        projType: 'RND', projNum: '', name: '',
        customName: itemToEdit.name || '', unit: itemToEdit.unit || 'шт',
        ...(itemToEdit.rule_params || {})
      });
    } else {
      setEditingItem(null);
      const targetGroup = groupOverride || selectedGroup || groups[1];
      const rType = targetGroup?.rule_type || 'generic';
      setWizardGroup(targetGroup);
      setWizardRuleType(rType);
      setWizardParams(prev => ({
        ...prev,
        isBlack: rType === 'screw_black' ? true : rType === 'screw_silver' ? false : prev.isBlack
      }));
    }
    setIsWizardOpen(true);
  };

  const [editingGroup, setEditingGroup] = useState(null);

  const handleOpenCreateGroup = (parentId = null) => {
    setEditingGroup(null);
    const parentGroup = groups.find(g => g.id === parentId);
    const parentCode = parentGroup?.code || '';
    const parentRuleType = parentGroup?.rule_type || 'generic';

    setNewGroup({ 
      name: '', 
      code: parentCode ? `${parentCode}.` : '', 
      parent_id: parentId, 
      rule_type: parentRuleType 
    });
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group) => {
    setEditingGroup(group);
    setNewGroup({
      name: group.name,
      code: group.code || '',
      parent_id: group.parent_id || null,
      rule_type: group.rule_type || 'generic'
    });
    setIsGroupModalOpen(true);
  };

  const handleDeleteGroup = async (group) => {
    const hasSubs = groups.some(g => g.parent_id === group.id);
    if (hasSubs) {
      alert(`Неможливо видалити категорію «${group.name}», оскільки вона містить підкатегорії!`);
      return;
    }
    const hasItems = items.some(it => it.group_id === group.id);
    if (hasItems) {
      alert(`Неможливо видалити категорію «${group.name}», оскільки вона містить позиції номенклатури!`);
      return;
    }
    if (!window.confirm(`Видалити категорію «${group.name}»?`)) return;

    try {
      await supabase.from('nomenclature_catalog_groups').delete().eq('id', group.id);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      if (selectedGroup?.id === group.id) setSelectedGroup(null);
      showToast(`Категорію «${group.name}» видалено`);
    } catch (err) {
      alert('Помилка видалення: ' + err.message);
    }
  };

  const handleSaveGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const parentGroup = groups.find(g => g.id === (newGroup.parent_id || null));
      let cleanCode = newGroup.code.toUpperCase().trim();
      
      // Auto-prefix parent code if creating subcategory and prefix isn't included yet
      if (parentGroup && parentGroup.code) {
        const pCode = parentGroup.code.toUpperCase();
        if (!cleanCode.startsWith(pCode + '.')) {
          const rawSub = cleanCode.startsWith(pCode) ? cleanCode.slice(pCode.length) : cleanCode;
          cleanCode = `${pCode}.${rawSub.replace(/^[.\s]+/, '')}`;
        }
      }

      if (!cleanCode || cleanCode.endsWith('.')) {
        cleanCode = (parentGroup?.code ? `${parentGroup.code}.` : 'GRP.') + Math.floor(Math.random() * 1000);
      }

      if (editingGroup) {
        // Edit existing group
        const payload = {
          name: newGroup.name.trim(),
          code: cleanCode,
          parent_id: newGroup.parent_id || null,
          rule_type: newGroup.rule_type
        };
        const { error } = await supabase
          .from('nomenclature_catalog_groups')
          .update(payload)
          .eq('id', editingGroup.id);

        if (error) console.warn('Group update DB fallback:', error);

        setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, ...payload } : g));
        showToast(`✅ Категорію «${newGroup.name}» оновлено!`);
      } else {
        // Create new group
        const gId = 'grp_' + Date.now();
        const payload = {
          id: gId,
          code: cleanCode,
          name: newGroup.name.trim(),
          parent_id: newGroup.parent_id || null,
          is_active: true,
          sort_order: groups.length + 10,
          rule_type: newGroup.rule_type
        };

        const { error } = await supabase.from('nomenclature_catalog_groups').insert([payload]);
        if (error && !error.message.includes('404')) {
          console.warn('Group DB insert fallback to local state:', error);
        }

        setGroups(prev => [...prev, payload]);
        showToast(`✅ Нову категорію «${newGroup.name}» створено!`);
      }

      setIsGroupModalOpen(false);
      setEditingGroup(null);
      setNewGroup({ name: '', code: '', parent_id: null, rule_type: 'generic' });
    } catch (err) {
      alert('Помилка збереження групи: ' + err.message);
    }
  };

  const handleCreateItemSubmit = async (e) => {
    e.preventDefault();
    if (!generatedName) {
      alert('Будь ласка, заповніть параметри для формування назви!');
      return;
    }

    try {
      // Auto-register any new custom reference values into persistent dictionaries
      if (wizardParams.grade === 'custom' && wizardParams.customGrade) registerCustomValue('grades', wizardParams.customGrade);
      if (wizardParams.thickness === 'custom' && wizardParams.customThickness) registerCustomValue('thicknesses', wizardParams.customThickness);
      if (wizardParams.extra === 'custom' && wizardParams.customExtra) registerCustomValue('extras', wizardParams.customExtra);
      if (wizardParams.standard === 'custom' && wizardParams.customStandard) registerCustomValue('screwStandards', wizardParams.customStandard);
      if (wizardParams.diameter === 'custom' && wizardParams.customDiameter) registerCustomValue('screwDiameters', wizardParams.customDiameter);
      if (wizardParams.din === 'custom' && wizardParams.customDin) registerCustomValue('nutDins', wizardParams.customDin);
      if (wizardParams.specialType === 'custom' && wizardParams.customSpecialType) registerCustomValue('nutSpecialTypes', wizardParams.customSpecialType);
      if (wizardParams.type === 'custom' && wizardParams.customMillType) registerCustomValue('millTypes', wizardParams.customMillType);
      if (wizardParams.cutDia === 'custom' && wizardParams.customCutDia) registerCustomValue('millCutDias', wizardParams.customCutDia);
      if (wizardParams.shankDia === 'custom' && wizardParams.customShankDia) registerCustomValue('millShankDias', wizardParams.customShankDia);
      if (wizardParams.cutLength === 'custom' && wizardParams.customCutLength) registerCustomValue('millCutLengths', wizardParams.customCutLength);
      if (wizardParams.totalLength === 'custom' && wizardParams.customTotalLength) registerCustomValue('millTotalLengths', wizardParams.customTotalLength);

      if (editingItem) {
        // Edit mode: Update existing nomenclature item
        const v2Payload = {
          name: generatedName,
          group_id: wizardGroup?.id || null,
          unit: wizardParams.unit || 'шт',
          rule_type: wizardRuleType,
          rule_params: wizardParams
        };

        const { error: updateErr } = await supabase
          .from('nomenclatures_v2')
          .update(v2Payload)
          .eq('id', editingItem.id);

        if (updateErr) {
          console.warn('DB update fallback:', updateErr);
        }

        await supabase
          .from('nomenclature_catalog_profiles')
          .update({
            display_name: generatedName,
            group_id: wizardGroup?.id || null,
            base_unit_id: wizardParams.unit || 'шт'
          })
          .eq('nomenclature_id', editingItem.id);

        setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, ...v2Payload } : it));
        setIsWizardOpen(false);
        setEditingItem(null);
        showToast(`✨ Позицію «${generatedName}» оновлено в каталозі!`);
        return;
      }

      // Create Mode: Insert new nomenclature item
      const nextCode = items.reduce((max, it) => {
        const num = parseInt(String(it.code).replace(/\D/g, ''));
        return num > max ? num : max;
      }, 90000) + 1;

      const v2Payload = {
        code: `V2-${nextCode}`,
        name: generatedName,
        group_id: wizardGroup?.id || null,
        unit: wizardParams.unit || 'шт',
        rule_type: wizardRuleType,
        rule_params: wizardParams,
        status: 'active'
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('nomenclatures_v2')
        .insert([v2Payload])
        .select()
        .single();

      if (insertErr) {
        console.warn('DB insert fallback:', insertErr);
      }

      const newItemObj = inserted || {
        id: 'v2-' + Date.now(),
        ...v2Payload,
        created_at: new Date().toISOString()
      };

      setItems(prev => [newItemObj, ...prev]);
      setIsWizardOpen(false);
      showToast(`✨ Позицію «${generatedName}» збережено в таблицю nomenclatures_v2!`);
    } catch (err) {
      alert('Помилка збереження позиції: ' + err.message);
    }
  };

  const handleOpenEditItem = (item) => {
    handleOpenWizard(null, item);
  };

  const handleSaveEditItemSubmit = async (e) => {
    e.preventDefault();
    if (!editItem) return;

    try {
      const payload = {
        name: editItem.editName.trim(),
        group_id: editItem.editGroupId || null,
        unit: editItem.editUnit || 'шт'
      };

      const { error } = await supabase
        .from('nomenclatures_v2')
        .update(payload)
        .eq('id', editItem.id);

      if (error) {
        console.warn('DB update fallback:', error);
      }

      await supabase
        .from('nomenclature_catalog_profiles')
        .update({
          display_name: editItem.editName.trim(),
          group_id: editItem.editGroupId || null,
          base_unit_id: editItem.editUnit || 'шт'
        })
        .eq('nomenclature_id', editItem.id);

      setItems(prev => prev.map(it => it.id === editItem.id ? { ...it, ...payload } : it));
      setIsEditModalOpen(false);
      setEditItem(null);
      showToast(`✅ Позицію «${payload.name}» оновлено!`);
    } catch (err) {
      alert('Помилка оновлення: ' + err.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Видалити цю позицію з V2 каталогу?')) return;
    try {
      await supabase.from('nomenclatures_v2').delete().eq('id', itemId);
      await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', itemId);
      setItems(prev => prev.filter(it => it.id !== itemId));
      showToast('Позицію видалено');
    } catch (err) {
      alert('Помилка: ' + err.message);
    }
  };

  // Filtered items
  const visibleItems = useMemo(() => {
    let list = items;
    if (selectedGroup) {
      // Include child groups
      const getChildIds = (pId) => {
        const subs = groups.filter(g => g.parent_id === pId);
        return [pId, ...subs.flatMap(s => getChildIds(s.id))];
      };
      const allowedGroupIds = new Set(getChildIds(selectedGroup.id));
      list = list.filter(it => allowedGroupIds.has(it.group_id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(it => it.name.toLowerCase().includes(q) || String(it.code).toLowerCase().includes(q));
    }
    return list;
  }, [items, selectedGroup, groups, searchQuery]);

  return (
    <div className="nomenclature-v2-container" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999, background: '#10b981', color: '#000', padding: '14px 24px', borderRadius: '14px', fontWeight: 900, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '10px', animation: 'slideIn 0.3s ease' }}>
          <CheckCircle2 size={20} /> {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <header style={{ height: '70px', background: '#080808', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', sticky: 'top', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
            <ArrowLeft size={18} /> Назад
          </Link>
          <div style={{ height: '24px', width: '1px', background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,144,0,0.15)', border: '1px solid rgba(255,144,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9000' }}>
              <Layers size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, letterSpacing: '0.5px' }}>Номенклатура ERP v2.0</h1>
              <span style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 800 }}>Окремий стандарт каталогу</span>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setIsGroupModalOpen(true)}
            style={{ background: '#141414', color: '#ccc', border: '1px solid #282828', borderRadius: '12px', padding: '10px 16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}
          >
            <FolderPlus size={16} /> СТВОРИТИ ГРУПУ
          </button>

          <button 
            onClick={() => handleOpenWizard()}
            style={{ background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', padding: '10px 20px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(255,144,0,0.25)' }}
          >
            <Plus size={18} /> СТВОРИТИ ПОЗИЦІЮ
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebar: Hierarchical Tree */}
        <aside style={{ width: '320px', background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 20px 15px', borderBottom: '1px solid #141414', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>ДЕРЕВО КАТЕГОРІЙ</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={() => handleOpenCreateGroup(null)}
                style={{ background: 'rgba(255,144,0,0.15)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', borderRadius: '8px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Створити нову головну категорію"
              >
                <FolderPlus size={13} /> + Категорія
              </button>
              {selectedGroup && (
                <button 
                  onClick={() => setSelectedGroup(null)}
                  style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Скинути
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: '15px 12px', flex: 1, overflowY: 'auto' }}>
            {groups.filter(g => !g.parent_id).map(rootGroup => (
              <GroupTreeNode 
                key={rootGroup.id}
                group={rootGroup}
                allGroups={groups}
                activeGroupId={selectedGroup?.id}
                onSelectGroup={g => setSelectedGroup(g)}
                onAddSubgroup={g => handleOpenCreateGroup(g.id)}
                onEditGroup={g => handleOpenEditGroup(g)}
                onDeleteGroup={g => handleDeleteGroup(g)}
              />
            ))}
          </div>

          <div style={{ padding: '15px 20px', background: '#0a0a0a', borderTop: '1px solid #141414', fontSize: '0.75rem', color: '#555', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Каталог V2:</span>
            <span style={{ color: '#ff9000', fontWeight: 900 }}>{items.length} позицій</span>
          </div>
        </aside>

        {/* Right Main Area: Items Table / Workbench */}
        <main style={{ flex: 1, padding: '25px', overflowY: 'auto', background: '#050505', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Info & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>
                <span>Каталог</span>
                <ChevronRight size={14} />
                <span style={{ color: selectedGroup ? '#ff9000' : '#eee', fontWeight: 800 }}>
                  {selectedGroup ? selectedGroup.name : 'Усі позиції'}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
                {selectedGroup ? selectedGroup.name : 'Реєстр номенклатури v2'}
              </h2>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', width: '360px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} size={18} />
              <input 
                type="text"
                placeholder="Швидкий пошук у V2 за назвою чи кодом..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '11px 15px 11px 44px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          </div>

          {/* Table Container */}
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '20px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, width: '120px' }}>Код V2</th>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900 }}>Стандартизована Назва</th>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, width: '160px' }}>Матеріал (Лист)</th>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, width: '130px' }}>Норма на листі</th>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, width: '180px' }}>Категорія / Група</th>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, width: '90px' }}>Од. вим.</th>
                  <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, width: '100px', textAlign: 'right' }}>Дії</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '60px', textAlign: 'center', color: '#444' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Package size={48} color="#222" />
                        <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 700 }}>
                          {searchQuery ? 'За вашим запитом нічого не знайдено' : 'У цьому розділі V2 каталогу ще немає позицій'}
                        </span>
                        <button 
                          onClick={() => handleOpenWizard()}
                          style={{ background: 'rgba(255,144,0,0.1)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '10px', padding: '10px 18px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}
                        >
                          <Plus size={16} /> Додати першу позицію за правилами ERP
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : visibleItems.map(item => {
                  const grp = groups.find(g => g.id === item.group_id);
                  const rawMat = item.rule_params?.rawSheet || item.material_type || '—';
                  const normQty = item.rule_params?.unitsPerSheet || item.units_per_sheet || null;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #111', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '16px 20px', fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {item.code}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 800, fontSize: '0.9rem', color: '#eee' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#38bdf8', fontWeight: 700, fontSize: '0.82rem' }}>
                        {rawMat}
                      </td>
                      <td style={{ padding: '16px 20px', color: normQty ? '#22c55e' : '#555', fontWeight: 800, fontSize: '0.85rem' }}>
                        {normQty ? `${normQty} шт/л` : '—'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ background: '#141414', color: '#aaa', border: '1px solid #222', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {grp ? grp.name : '01. Загальна'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#888', fontWeight: 700, fontSize: '0.85rem' }}>
                        {item.unit || 'шт'}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => handleOpenEditItem(item)}
                          style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', padding: '6px 8px', marginRight: '6px', transition: 'all 0.15s' }}
                          title="Редагувати номенклатуру"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', transition: 'all 0.15s' }}
                          title="Видалити позицію"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ── MODAL: Smart Naming Rules Wizard ─────────────────────────────────── */}
      {isWizardOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={22} color="#ff9000" />
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>
                  {editingItem ? `Редагування позиції (${editingItem.code})` : 'Конструктор Номенклатури ERP'}
                </h3>
              </div>
              <button onClick={() => { setIsWizardOpen(false); setEditingItem(null); }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Category Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#777', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>КАТЕГОРІЯ НОМЕНКЛАТУРИ</label>
                <select 
                  value={wizardGroup?.id || ''} 
                  onChange={e => {
                    const g = groups.find(it => it.id === e.target.value);
                    const rType = g?.rule_type || 'generic';
                    setWizardGroup(g);
                    setWizardRuleType(rType);
                    setWizardParams(prev => ({
                      ...prev,
                      isBlack: rType === 'screw_black' ? true : rType === 'screw_silver' ? false : prev.isBlack
                    }));
                  }}
                  style={{ width: '100%', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '12px', color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}
                >
                  {flattenedGroups.map(g => (
                    <option 
                      key={g.id} 
                      value={g.id}
                      style={{
                        fontWeight: g.depth === 0 ? 900 : g.hasSubs ? 800 : 400,
                        color: g.depth === 0 ? '#ff9000' : '#fff',
                        background: '#141414'
                      }}
                    >
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Preview Card */}
              <div style={{ background: 'rgba(255,144,0,0.06)', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '16px', padding: '18px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', marginBottom: '6px' }}>АВТОМАТИЧНО СГЕНЕРОВАНА НАЗВА:</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', wordBreak: 'break-word' }}>
                  {generatedName || <span style={{ color: '#777', fontStyle: 'italic', fontWeight: 600 }}>{wizardRuleType === 'frame_part' ? 'Введіть назву деталі у поле нижче (напр. KR-10(218)-П-7-60)...' : 'Заповніть параметри нижче...'}</span>}
                </div>

                {isDuplicate && (
                  <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> Увага: Позиція з такою назвою вже існує у V2 каталозі!
                  </div>
                )}
              </div>

              {/* Category Rules & Dictionaries Badge */}
              {ERP_CATEGORY_SCHEMAS[wizardRuleType] && (
                <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '14px', padding: '12px 16px', fontSize: '0.75rem' }}>
                  <div style={{ color: '#aaa', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                    📋 Обов'язкові довідникові параметри для {ERP_CATEGORY_SCHEMAS[wizardRuleType].title}:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ERP_CATEGORY_SCHEMAS[wizardRuleType].fields.map(f => (
                      <span key={f.key} style={{ background: '#1e1e1e', color: '#ff9000', border: '1px solid rgba(255,144,0,0.2)', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.7rem' }}>
                        ✓ {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Rule Form Fields */}
              <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* SCREWS */}
                {(wizardRuleType === 'screw' || wizardRuleType === 'screw_black' || wizardRuleType === 'screw_silver') && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>СТАНДАРТ (DIN / ISO)</label>
                        <select value={wizardParams.standard} onChange={e => setWizardParams({...wizardParams, standard: e.target.value})} style={inputStyle}>
                          <option value="DIN912">DIN 912 (Циліндрична)</option>
                          <option value="DIN7991">DIN 7991 (Потай)</option>
                          <option value="ISO7380">ISO 7380 (Напівкругла)</option>
                          <option value="DIN7985">DIN 7985 (Сочевиця)</option>
                          <option value="DIN913">DIN 913 (Установчий)</option>
                          <option value="ISO10642">ISO 10642</option>
                          <option value="custom">✏️ + Власний стандарт (ввести свій)...</option>
                        </select>
                        {wizardParams.standard === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customStandard || ''} 
                            onChange={e => setWizardParams({...wizardParams, customStandard: e.target.value})} 
                            placeholder="напр. DIN 84 або ISO 14581" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>РІЗЬБА (М)</label>
                        <select value={wizardParams.diameter} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                          <option value="1,6">М1.6</option>
                          <option value="2">М2</option>
                          <option value="2,5">М2.5</option>
                          <option value="3">М3</option>
                          <option value="4">М4</option>
                          <option value="5">М5</option>
                          <option value="6">М6</option>
                          <option value="8">М8</option>
                          <option value="10">М10</option>
                          <option value="12">М12</option>
                          <option value="14">М14</option>
                          <option value="custom">✏️ + Власна різьба (ввести свою)...</option>
                        </select>
                        {wizardParams.diameter === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customDiameter || ''} 
                            onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} 
                            placeholder="напр. 3,5 або 16" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ДОВЖИНА ГВИНТА (мм)</label>
                      <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 10, 16, 25" style={inputStyle} />
                    </div>

                    <div style={{ display: 'flex', gap: '20px', paddingTop: '5px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                        <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                        Чорний колір (чорний)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                        <input type="checkbox" checked={wizardParams.isPartialThread} onChange={e => setWizardParams({...wizardParams, isPartialThread: e.target.checked})} />
                        Неповна різьба
                      </label>
                    </div>
                  </>
                )}

                {/* NUTS */}
                {wizardRuleType === 'nut' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>СТАНДАРТ (DIN)</label>
                        <select value={wizardParams.din || 'DIN 934'} onChange={e => setWizardParams({...wizardParams, din: e.target.value})} style={inputStyle}>
                          <option value="DIN 934">DIN 934 (Шестигранна)</option>
                          <option value="DIN 6923">DIN 6923 (З фланцем)</option>
                          <option value="DIN 985">DIN 985 (З нейлоном)</option>
                          <option value="DIN 439">DIN 439 (Низька)</option>
                          <option value="DIN 1587">DIN 1587 (Ковпачкова)</option>
                          <option value="custom">✏️ + Власний DIN...</option>
                        </select>
                        {wizardParams.din === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customDin || ''} 
                            onChange={e => setWizardParams({...wizardParams, customDin: e.target.value})} 
                            placeholder="напр. DIN 557" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>РІЗЬБА (М)</label>
                        <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                          <option value="2">М2</option>
                          <option value="2,5">М2.5</option>
                          <option value="3">М3</option>
                          <option value="4">М4</option>
                          <option value="5">М5</option>
                          <option value="6">М6</option>
                          <option value="8">М8</option>
                          <option value="10">М10</option>
                          <option value="12">М12</option>
                          <option value="custom">✏️ + Власна різьба...</option>
                        </select>
                        {wizardParams.diameter === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customDiameter || ''} 
                            onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} 
                            placeholder="напр. 3,5" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>СПЕЦІАЛЬНИЙ ТИП (ОПЦІОНАЛЬНО)</label>
                      <select value={wizardParams.specialType || ''} onChange={e => setWizardParams({...wizardParams, specialType: e.target.value})} style={inputStyle}>
                        <option value="">Стандартна (без спец-типу)</option>
                        <option value="з фланцем">з фланцем</option>
                        <option value="з нейлоновим кільцем">з нейлоновим кільцем</option>
                        <option value="низька">низька</option>
                        <option value="ковпачкова">ковпачкова</option>
                        <option value="custom">✏️ + Свій тип...</option>
                      </select>
                      {wizardParams.specialType === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customSpecialType || ''} 
                          onChange={e => setWizardParams({...wizardParams, customSpecialType: e.target.value})} 
                          placeholder="напр. корончаста" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div style={{ paddingTop: '5px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                        <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                        Чорний колір (чорний)
                      </label>
                    </div>
                  </>
                )}

                {/* PRESS NUTS */}
                {wizardRuleType === 'press_nut' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>РІЗЬБА (М)</label>
                        <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                          <option value="2">М2</option>
                          <option value="2,5">М2.5</option>
                          <option value="3">М3</option>
                          <option value="4">М4</option>
                          <option value="5">М5</option>
                          <option value="6">М6</option>
                          <option value="custom">✏️ + Власна різьба...</option>
                        </select>
                        {wizardParams.diameter === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customDiameter || ''} 
                            onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} 
                            placeholder="напр. 3,5" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ТОЩИНА ЗАПРЕСОВКИ (код / мм)</label>
                        <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                          <option value="0">0 (0.8 мм)</option>
                          <option value="1">1 (1.0 мм)</option>
                          <option value="2">2 (1.4 мм)</option>
                          <option value="3">3 (2.3 мм)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ paddingTop: '5px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                        <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                        Чорний колір (чорний)
                      </label>
                    </div>
                  </>
                )}

                {/* STANDOFFS */}
                {wizardRuleType === 'standoff' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ТИП СТІЙКИ</label>
                        <select value={wizardParams.type} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                          <option value="TFF">TFF (Мама-Мама)</option>
                          <option value="TFM">TFM (Тато-Мама)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>РІЗЬБА (М)</label>
                        <select value={wizardParams.thread} onChange={e => setWizardParams({...wizardParams, thread: e.target.value})} style={inputStyle}>
                          <option value="3">М3</option>
                          <option value="4">М4</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ДОВЖИНА СТІЙКИ (мм)</label>
                        <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 20" style={inputStyle} />
                      </div>
                      {wizardParams.type === 'TFM' && (
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ХВОСТОВИК (мм)</label>
                          <input type="text" value={wizardParams.tailLength} onChange={e => setWizardParams({...wizardParams, tailLength: e.target.value})} placeholder="напр. 6" style={inputStyle} />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ЗОВНІШНІЙ ДІАМЕТР</label>
                        <select value={wizardParams.outerDiameter} onChange={e => setWizardParams({...wizardParams, outerDiameter: e.target.value})} style={inputStyle}>
                          <option value="">Шестигранна (без d)</option>
                          <option value="5">5мм (кругла)</option>
                          <option value="6">6мм (кругла)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>МАТЕРІАЛ</label>
                        <select value={wizardParams.material} onChange={e => setWizardParams({...wizardParams, material: e.target.value})} style={inputStyle}>
                          <option value="Алюміній">Алюміній</option>
                          <option value="Латунь">Латунь</option>
                          <option value="Цинк S5">Цинк S5</option>
                          <option value="Цинк S5.5">Цинк S5.5</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* MILLS */}
                {wizardRuleType === 'mill' && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ТИП ФРЕЗИ</label>
                      <select value={wizardParams.type || 'кукурудза'} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                        {(refDicts.millTypes || ['кукурудза', 'двопера', 'чотирьохпера', 'фасочна', 'сферична по алюмінію']).map(m => (
                          <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                        ))}
                        <option value="custom">✏️ + Власний тип фрези...</option>
                      </select>
                      {wizardParams.type === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customMillType || ''} 
                          onChange={e => setWizardParams({...wizardParams, customMillType: e.target.value})} 
                          placeholder="напр. трипера чи конусна" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    {wizardParams.type === 'фасочна' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ЦАНГА D (мм)</label>
                          <select value={wizardParams.shankDia || '6'} onChange={e => setWizardParams({...wizardParams, shankDia: e.target.value})} style={inputStyle}>
                            {(refDicts.millShankDias || ['3,175', '4', '6', '8', '10', '12']).map(v => (
                              <option key={v} value={v}>{v} мм</option>
                            ))}
                            <option value="custom">✏️ + Своя цанга...</option>
                          </select>
                          {wizardParams.shankDia === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customShankDia || ''} 
                              onChange={e => setWizardParams({...wizardParams, customShankDia: e.target.value})} 
                              placeholder="напр. 6,35" 
                              style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ДОВЖИНА L (мм)</label>
                          <select value={wizardParams.totalLength || '50'} onChange={e => setWizardParams({...wizardParams, totalLength: e.target.value})} style={inputStyle}>
                            {(refDicts.millTotalLengths || ['38', '45', '50', '55', '60', '75', '100']).map(v => (
                              <option key={v} value={v}>{v} мм</option>
                            ))}
                            <option value="custom">✏️ + Своя довжина...</option>
                          </select>
                          {wizardParams.totalLength === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customTotalLength || ''} 
                              onChange={e => setWizardParams({...wizardParams, customTotalLength: e.target.value})} 
                              placeholder="напр. 65" 
                              style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>КУТ (°)</label>
                          <select value={wizardParams.angle || '90'} onChange={e => setWizardParams({...wizardParams, angle: e.target.value})} style={inputStyle}>
                            <option value="60">60°</option>
                            <option value="90">90°</option>
                            <option value="120">120°</option>
                            <option value="custom">✏️ + Свій кут...</option>
                          </select>
                          {wizardParams.angle === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customAngle || ''} 
                              onChange={e => setWizardParams({...wizardParams, customAngle: e.target.value})} 
                              placeholder="напр. 45" 
                              style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>d (різ, мм)</label>
                          <select value={wizardParams.cutDia || '1,5'} onChange={e => setWizardParams({...wizardParams, cutDia: e.target.value})} style={inputStyle}>
                            {(refDicts.millCutDias || ['1', '1,2', '1,5', '2', '2,5', '3', '3,175', '4', '6', '8']).map(v => (
                              <option key={v} value={v}>{v} мм</option>
                            ))}
                            <option value="custom">✏️ + Свій d...</option>
                          </select>
                          {wizardParams.cutDia === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customCutDia || ''} 
                              onChange={e => setWizardParams({...wizardParams, customCutDia: e.target.value})} 
                              placeholder="напр. 1,8" 
                              style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>D (цанга, мм)</label>
                          <select value={wizardParams.shankDia || '3,175'} onChange={e => setWizardParams({...wizardParams, shankDia: e.target.value})} style={inputStyle}>
                            {(refDicts.millShankDias || ['3,175', '4', '6', '8', '10', '12']).map(v => (
                              <option key={v} value={v}>{v} мм</option>
                            ))}
                            <option value="custom">✏️ + Своя D...</option>
                          </select>
                          {wizardParams.shankDia === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customShankDia || ''} 
                              onChange={e => setWizardParams({...wizardParams, customShankDia: e.target.value})} 
                              placeholder="напр. 6,35" 
                              style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>l (різ, мм)</label>
                          <select value={wizardParams.cutLength || '8'} onChange={e => setWizardParams({...wizardParams, cutLength: e.target.value})} style={inputStyle}>
                            {(refDicts.millCutLengths || ['4', '6', '8', '12', '15', '17', '22', '25', '32']).map(v => (
                              <option key={v} value={v}>{v} мм</option>
                            ))}
                            <option value="custom">✏️ + Своє l...</option>
                          </select>
                          {wizardParams.cutLength === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customCutLength || ''} 
                              onChange={e => setWizardParams({...wizardParams, customCutLength: e.target.value})} 
                              placeholder="напр. 10" 
                              style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>L (заг, мм)</label>
                          <select value={wizardParams.totalLength || '38'} onChange={e => setWizardParams({...wizardParams, totalLength: e.target.value})} style={inputStyle}>
                            {(refDicts.millTotalLengths || ['38', '45', '50', '55', '60', '75', '100']).map(v => (
                              <option key={v} value={v}>{v} мм</option>
                            ))}
                            <option value="custom">✏️ + Своє L...</option>
                          </select>
                          {wizardParams.totalLength === 'custom' && (
                            <input 
                              type="text" 
                              value={wizardParams.customTotalLength || ''} 
                              onChange={e => setWizardParams({...wizardParams, customTotalLength: e.target.value})} 
                              placeholder="напр. 40" 
                              style={{ ...inputStyle, marginTop: '6px', border: '1px solid #ff9000' }} 
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* CARBON SHEETS */}
                {wizardRuleType === 'carbon' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>МАРКА СИРОВИНИ</label>
                        <select value={wizardParams.grade || 'Т300'} onChange={e => setWizardParams({...wizardParams, grade: e.target.value})} style={inputStyle}>
                          {(refDicts.grades || ['Т300', 'Т700']).map(g => (
                            <option key={g} value={g}>Карбон {g}</option>
                          ))}
                          <option value="custom">✏️ + Власна марка...</option>
                        </select>
                        {wizardParams.grade === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customGrade || ''} 
                            onChange={e => setWizardParams({...wizardParams, customGrade: e.target.value})} 
                            placeholder="напр. Т1000" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ФОРМАТ (мм)</label>
                        <select value={wizardParams.dimensions || '500*600'} onChange={e => setWizardParams({...wizardParams, dimensions: e.target.value})} style={inputStyle}>
                          <option value="500*600">500*600</option>
                          <option value="1000*600">1000*600</option>
                          <option value="500*500">500*500</option>
                          <option value="custom">✏️ + Свій формат...</option>
                        </select>
                        {wizardParams.dimensions === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customDimensions || ''} 
                            onChange={e => setWizardParams({...wizardParams, customDimensions: e.target.value})} 
                            placeholder="напр. 400*500" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ТОВЩИНА (мм)</label>
                        <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                          {(refDicts.thicknesses || ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']).map(t => (
                            <option key={t} value={t}>{t} мм</option>
                          ))}
                          <option value="custom">✏️ + Власна товщина...</option>
                        </select>
                        {wizardParams.thickness === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customThickness || ''} 
                            onChange={e => setWizardParams({...wizardParams, customThickness: e.target.value})} 
                            placeholder="напр. 3,5" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>СПЕЦ. ПОЗНАЧКА</label>
                        <select value={wizardParams.extra || ''} onChange={e => setWizardParams({...wizardParams, extra: e.target.value})} style={inputStyle}>
                          <option value="">— Немає</option>
                          {(refDicts.extras || ['(преференція)', '(0/45/90)']).map(ex => (
                            <option key={ex} value={ex}>{ex}</option>
                          ))}
                          <option value="custom">✏️ + Своя позначка...</option>
                        </select>
                        {wizardParams.extra === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customExtra || ''} 
                            onChange={e => setWizardParams({...wizardParams, customExtra: e.target.value})} 
                            placeholder="напр. (спеціальне)" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* FULL FRAME & KITS */}
                {(wizardRuleType === 'full_frame' || wizardRuleType === 'element_kit') && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, margin: 0 }}>ПОЧАТОК НАЗВИ / ТИП ВИРОБУ</label>
                        {isDirector && (
                          <button
                            type="button"
                            onClick={() => setShowPrefixManage(!showPrefixManage)}
                            style={{ background: 'none', border: 'none', color: '#ff9000', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                          >
                            ⚙️ {showPrefixManage ? 'Сховати' : 'Редагувати список'}
                          </button>
                        )}
                      </div>

                      {showPrefixManage && isDirector && (
                        <div style={{ background: '#161616', border: '1px solid #333', borderRadius: '10px', padding: '10px 12px', marginTop: '4px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900, marginBottom: '6px' }}>ВИДАЛЕННЯ ЗІ СПИСКУ (АДМІН/КЕРІВНИК):</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {prefixList.map(item => (
                              <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#ddd' }}>
                                <span>{item}</span>
                                <button
                                  type="button"
                                  onClick={() => removePrefixItem(item)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}
                                  title="Видалити зі списку"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <select 
                        value={wizardParams.prefixChoice || (wizardRuleType === 'element_kit' ? 'Комплект карбонових елементів' : 'Комплект карбонової рами')} 
                        onChange={e => setWizardParams({...wizardParams, prefixChoice: e.target.value})} 
                        style={inputStyle}
                      >
                        {prefixList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option value="custom">✏️ + Свій варіант...</option>
                      </select>
                      {wizardParams.prefixChoice === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customPrefix || ''} 
                          onChange={e => setWizardParams({...wizardParams, customPrefix: e.target.value})} 
                          placeholder="напр. Набір карбонових деталей" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ТИП ПРОЄКТУ</label>
                        <select value={wizardParams.projType || 'SERIAL'} onChange={e => setWizardParams({...wizardParams, projType: e.target.value})} style={inputStyle}>
                          <option value="SERIAL">Серійний виріб (без дужок / без тегу)</option>
                          <option value="RND">Серія RND</option>
                          <option value="IP">Індивідуальний проєкт (ІП)</option>
                          <option value="CUSTOM">✏️ + Свій тип проєкту...</option>
                        </select>
                        {wizardParams.projType === 'CUSTOM' && (
                          <input 
                            type="text" 
                            value={wizardParams.customProjType || ''} 
                            onChange={e => setWizardParams({...wizardParams, customProjType: e.target.value})} 
                            placeholder="напр. Спецпроєкт" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>НОМЕР ПРОЄКТУ</label>
                        <input type="text" value={wizardParams.projNum || ''} onChange={e => setWizardParams({...wizardParams, projNum: e.target.value})} placeholder="напр. 52 або 176" style={inputStyle} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, margin: 0 }}>ТИП СЕРІЇ</label>
                        {isDirector && (
                          <button
                            type="button"
                            onClick={() => setShowSeriesManage(!showSeriesManage)}
                            style={{ background: 'none', border: 'none', color: '#ff9000', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                          >
                            ⚙️ {showSeriesManage ? 'Сховати' : 'Редагувати список'}
                          </button>
                        )}
                      </div>

                      {showSeriesManage && isDirector && (
                        <div style={{ background: '#161616', border: '1px solid #333', borderRadius: '10px', padding: '10px 12px', marginTop: '4px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900, marginBottom: '6px' }}>ВИДАЛЕННЯ ЗІ СПИСКУ (АДМІН/КЕРІВНИК):</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {seriesList.map(item => (
                              <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#ddd' }}>
                                <span>{item}</span>
                                <button
                                  type="button"
                                  onClick={() => removeSeriesItem(item)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 6px' }}
                                  title="Видалити зі списку"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <select value={wizardParams.seriesType || ''} onChange={e => setWizardParams({...wizardParams, seriesType: e.target.value})} style={inputStyle}>
                        <option value="">— Не вказано (без серії)</option>
                        {seriesList.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="custom">✏️ + Своя серія (ввести свою)...</option>
                      </select>
                      {wizardParams.seriesType === 'custom' && (
                        <input 
                          type="text" 
                          value={wizardParams.customSeries || ''} 
                          onChange={e => setWizardParams({...wizardParams, customSeries: e.target.value})} 
                          placeholder="напр. Серія Марун" 
                          style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>НАЗВА МОДЕЛІ / МОДИФІКАЦІЯ</label>
                      <input type="text" value={wizardParams.name || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value})} placeholder="напр. Drozd Interceptor" style={inputStyle} />
                    </div>
                  </>
                )}

                {/* FRAME PART (ДЕТАЛІ ЛАЗЕР) */}
                {wizardRuleType === 'frame_part' && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>НАЗВА ДЕТАЛІ</label>
                      <input type="text" value={wizardParams.name || wizardParams.customName || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value, customName: e.target.value})} placeholder="напр. KR-10(218)-П-7-60" style={inputStyle} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>МАРКА СИРОВИНИ</label>
                        <select 
                          value={wizardParams.sheetGrade || 'Т300'} 
                          onChange={e => {
                            const grade = e.target.value;
                            const thick = wizardParams.sheetThickness || '3';
                            const gLabel = grade === 'custom' ? (wizardParams.customGrade || 'Т300') : grade;
                            const tLabel = thick === 'custom' ? (wizardParams.customThickness || '3') : thick;
                            const raw = `Лист ${gLabel} (${tLabel}мм)`;
                            setWizardParams({...wizardParams, sheetGrade: grade, rawSheet: raw});
                          }} 
                          style={inputStyle}
                        >
                          {(refDicts.grades || ['Т300', 'Т700']).map(g => (
                            <option key={g} value={g}>Карбон {g}</option>
                          ))}
                          <option value="custom">✏️ + Власна марка...</option>
                        </select>
                        {wizardParams.sheetGrade === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customGrade || ''} 
                            onChange={e => setWizardParams({...wizardParams, customGrade: e.target.value})} 
                            placeholder="напр. Т1000" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ТОВЩИНА (мм)</label>
                        <select 
                          value={wizardParams.sheetThickness || '3'} 
                          onChange={e => {
                            const thick = e.target.value;
                            const grade = wizardParams.sheetGrade || 'Т300';
                            const gLabel = grade === 'custom' ? (wizardParams.customGrade || 'Т300') : grade;
                            const tLabel = thick === 'custom' ? (wizardParams.customThickness || '3') : thick;
                            const raw = `Лист ${gLabel} (${tLabel}мм)`;
                            setWizardParams({...wizardParams, sheetThickness: thick, rawSheet: raw});
                          }} 
                          style={inputStyle}
                        >
                          {(refDicts.thicknesses || ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '10']).map(t => (
                            <option key={t} value={t}>{t} мм</option>
                          ))}
                          <option value="custom">✏️ + Власна товщина...</option>
                        </select>
                        {wizardParams.sheetThickness === 'custom' && (
                          <input 
                            type="text" 
                            value={wizardParams.customThickness || ''} 
                            onChange={e => setWizardParams({...wizardParams, customThickness: e.target.value})} 
                            placeholder="напр. 3,5" 
                            style={{ ...inputStyle, marginTop: '8px', border: '1px solid #ff9000' }} 
                          />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>НОРМА (шт/л)</label>
                        <input type="number" value={wizardParams.unitsPerSheet || 1} onChange={e => setWizardParams({...wizardParams, unitsPerSheet: Number(e.target.value) || 1})} placeholder="60" style={inputStyle} />
                      </div>
                    </div>
                  </>
                )}

                {/* GENERIC / CUSTOM */}
                {wizardRuleType === 'generic' && (
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ПОВНА НАЗВА ПОЗИЦІЇ</label>
                    <input type="text" value={wizardParams.customName} onChange={e => setWizardParams({...wizardParams, customName: e.target.value})} placeholder="Введіть стандартизовану назву..." style={inputStyle} />
                  </div>
                )}

                {/* Unit selector */}
                <div style={{ borderTop: '1px solid #222', paddingTop: '15px' }}>
                  <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800 }}>ОДИНИЦЯ ВИМІРУ</label>
                  <select value={wizardParams.unit} onChange={e => setWizardParams({...wizardParams, unit: e.target.value})} style={inputStyle}>
                    <option value="шт">Штуки (шт)</option>
                    <option value="компл.">Комплекти (компл.)</option>
                    <option value="лист">Листи (лист)</option>
                    <option value="кг">Кілограми (кг)</option>
                    <option value="м">Метри (м)</option>
                    <option value="м²">Квадратні метри (м²)</option>
                    <option value="л">Літри (л)</option>
                  </select>
                </div>

              </div>

              <button 
                type="submit" 
                disabled={isDuplicate || !generatedName}
                style={{ 
                  background: isDuplicate || !generatedName ? '#333' : '#ff9000', 
                  color: isDuplicate || !generatedName ? '#777' : '#000', 
                  border: 'none', 
                  borderRadius: '14px', 
                  padding: '16px', 
                  fontWeight: 900, 
                  fontSize: '0.95rem', 
                  cursor: isDuplicate || !generatedName ? 'not-allowed' : 'pointer',
                  boxShadow: isDuplicate || !generatedName ? 'none' : '0 5px 20px rgba(255,144,0,0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {editingItem ? 'ЗБЕРЕГТИ ЗМІНИ ПОЗИЦІЇ' : 'ЗБЕРЕГТИ ДО V2 КАТАЛОГУ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Create / Edit Category Group ─────────────────────────────── */}
      {isGroupModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#ff9000' }}>
                {editingGroup ? `Редагування категорії: ${editingGroup.name}` : 'Нова категорія (група)'}
              </h3>
              <button onClick={() => { setIsGroupModalOpen(false); setEditingGroup(null); }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>НАЗВА КАТЕГОРІЇ</label>
                <input value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} required placeholder="напр. Заклепки" style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>КОД ГРУПИ</label>
                <input value={newGroup.code} onChange={e => setNewGroup({...newGroup, code: e.target.value})} placeholder="напр. HW.RIVET" style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>БАТЬКІВСЬКА ГРУПА</label>
                <select value={newGroup.parent_id || ''} onChange={e => setNewGroup({...newGroup, parent_id: e.target.value || null})} style={inputStyle}>
                  <option value="">-- Корінь (Верхній рівень) --</option>
                  {flattenedGroups.filter(g => !editingGroup || g.id !== editingGroup.id).map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>ТИП ПРАВИЛ НАЙМЕНУВАННЯ</label>
                <select value={newGroup.rule_type} onChange={e => setNewGroup({...newGroup, rule_type: e.target.value})} style={inputStyle}>
                  <option value="generic">Звичайний (без спеціальних полів)</option>
                  <option value="screw">Гвинти (Стандарт, М, Довжина, Колір)</option>
                  <option value="standoff">Стійки міжплатні (TFF/TFM, М, Довжина, Матеріал)</option>
                  <option value="mill">Фрези (Тип, dхDхlхL)</option>
                  <option value="carbon">Карбонові листи (Марка, Товщина, Позначка)</option>
                  <option value="frame_part">Деталі (Лазерне різання, Назва, Лист, Норма)</option>
                  <option value="full_frame">Рами карбонові (RND/ІП, Модель)</option>
                </select>
              </div>

              <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: 900, cursor: 'pointer', marginTop: '10px' }}>
                {editingGroup ? 'ЗБЕРЕГТИ ЗМІНИ КАТЕГОРІЇ' : 'СТВОРИТИ КАТЕГОРІЮ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Item ────────────────────────────────────────────── */}
      {isEditModalOpen && editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: '24px', width: '100%', maxWidth: '520px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900, fontFamily: 'monospace' }}>{editItem.code}</span>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>Редагувати номенклатуру</h3>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setEditItem(null); }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveEditItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>СТАНДАРТИЗОВАНА НАЗВА</label>
                <input 
                  type="text" 
                  value={editItem.editName} 
                  onChange={e => setEditItem({ ...editItem, editName: e.target.value })} 
                  required 
                  style={inputStyle} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>КАТЕГОРІЯ / ГРУПА КАТАЛОГУ</label>
                <select 
                  value={editItem.editGroupId || ''} 
                  onChange={e => setEditItem({ ...editItem, editGroupId: e.target.value })} 
                  style={inputStyle}
                >
                  <option value="">-- Без групи (01. Загальна) --</option>
                  {flattenedGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#777', fontWeight: 900 }}>ОДИНИЦЯ ВИМІРУ</label>
                <select 
                  value={editItem.editUnit || 'шт'} 
                  onChange={e => setEditItem({ ...editItem, editUnit: e.target.value })} 
                  style={inputStyle}
                >
                  <option value="шт">Штуки (шт)</option>
                  <option value="компл.">Комплекти (компл.)</option>
                  <option value="лист">Листи (лист)</option>
                  <option value="кг">Кілограми (кг)</option>
                  <option value="м">Метри (м)</option>
                  <option value="м²">Квадратні метри (м²)</option>
                  <option value="л">Літри (л)</option>
                </select>
              </div>

              <button 
                type="submit" 
                style={{ 
                  background: '#ff9000', 
                  color: '#000', 
                  border: 'none', 
                  borderRadius: '12px', 
                  padding: '14px', 
                  fontWeight: 900, 
                  fontSize: '0.9rem',
                  cursor: 'pointer', 
                  marginTop: '10px',
                  boxShadow: '0 4px 15px rgba(255,144,0,0.3)'
                }}
              >
                ЗБЕРЕГТИ ЗМІНИ НОМЕНКЛАТУРИ
              </button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover { background: #121212 !important; }
        .tree-item-hover:hover { background: rgba(255,144,0,0.08) !important; }
      `}} />
    </div>
  );
};

const inputStyle = {
  width: '100%',
  background: '#161616',
  border: '1px solid #282828',
  borderRadius: '10px',
  padding: '10px 14px',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 700,
  outline: 'none',
  marginTop: '4px'
};

export default NomenclatureV2;
