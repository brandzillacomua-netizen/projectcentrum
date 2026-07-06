import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  FileUp,
  Clock,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { nomenclatureService } from '../services/nomenclatureService';
import { useMES } from '../MESContext';
import { supabase } from '../supabase';

// Поки модуль розробляється, єдиним робочим джерелом змін лишається «БАЗА».
// Зняття цього прапорця потребує окремої перевірки сумісності зі складом,
// виробництвом, BOM, закупівлями та звітами.
const EXPERIMENTAL_READ_ONLY = true;

const LEGACY_CLASS_LABELS = {
  raw: 'Сировина',
  material: 'Сировина',
  hardware: 'Метизи',
  part: 'Деталі',
  tool: 'Інструмент',
  product: 'Вироби (сумісність)',
  assembly: 'Вироби (сумісність)'
};

const inferLegacyClass = (item) => {
  const type = String(item.type || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  if (type === 'consumable' && (name.includes('фрез') || name.includes('свердл'))) return 'Інструмент';
  return LEGACY_CLASS_LABELS[type] || 'Потребує визначення';
};

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
  const [allItems, setAllItems] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [migrationFilter, setMigrationFilter] = useState('all');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  const [newGroup, setNewGroup] = useState({ name: '', code: '', parent_id: null });
  const [newType, setNewType] = useState({ name: '', description: '' });
  const [newItem, setNewItem] = useState({ base_code: '', name: '', group_id: '', unit: 'шт' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const [importLogs, setImportLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsResult, classesResult, unitsResult, profilesResult, itemsResult] = await Promise.all([
        supabase.from('nomenclature_catalog_groups').select('*').order('sort_order').order('name'),
        supabase.from('nomenclature_classes').select('*').order('sort_order').order('name'),
        supabase.from('nomenclature_units').select('*'),
        supabase.from('nomenclature_catalog_profiles').select('*'),
        supabase.from('nomenclatures').select('*').limit(2000)
      ]);

      const firstError = [groupsResult, classesResult, unitsResult, profilesResult, itemsResult].find(result => result.error)?.error;
      if (firstError) throw firstError;

      const catalogGroups = groupsResult.data || [];
      const classes = classesResult.data || [];
      const units = unitsResult.data || [];
      const profilesByNomId = new Map((profilesResult.data || []).map(profile => [String(profile.nomenclature_id), profile]));
      const groupsById = new Map(catalogGroups.map(group => [String(group.id), group]));
      const classesById = new Map(classes.map(itemClass => [String(itemClass.id), itemClass]));
      const unitsById = new Map(units.map(unit => [String(unit.id), unit]));

      const catalogItems = (itemsResult.data || []).map(item => {
        const profile = profilesByNomId.get(String(item.id));
        return {
          ...item,
          catalog_profile: profile || null,
          catalog_group: profile?.group_id ? groupsById.get(String(profile.group_id)) : null,
          catalog_class: profile?.class_id ? classesById.get(String(profile.class_id)) : null,
          catalog_unit: profile?.base_unit_id ? unitsById.get(String(profile.base_unit_id)) : null
        };
      });

      setGroups(catalogGroups);
      setTypes(classes.map(itemClass => ({
        ...itemClass,
        description: itemClass.is_produced ? 'Виробляється у системі' : 'Обліковується як ресурс'
      })));
      setAllItems(catalogItems);
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
      setNewItem({ base_code: '', name: '', group_id: '', unit: 'шт' });
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('nomenclatures')
        .update({
          base_code: editItem.base_code ? Number(editItem.base_code) : null,
          name: editItem.name.trim(),
          group_id: editItem.group_id || null,
          unit: editItem.unit
        })
        .eq('id', editItem.id);

      if (error) throw error;
      setIsEditModalOpen(false);
      setEditItem(null);
      loadData();
    } catch (err) {
      alert('Помилка оновлення: ' + err.message);
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
  };

  const visibleItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('uk');
    return allItems.filter(item => {
      const matchesSearch = !normalizedQuery || [
        item.name,
        item.base_code,
        item.catalog_profile?.catalog_code,
        item.catalog_class?.name,
        item.catalog_group?.name
      ].some(value => String(value || '').toLocaleLowerCase('uk').includes(normalizedQuery));
      const matchesClass = classFilter === 'all' || String(item.catalog_class?.id || '') === classFilter;
      const matchesGroup = groupFilter === 'all' || String(item.catalog_group?.id || '') === groupFilter;
      const migrationState = item.catalog_profile?.migration_state || 'unclassified';
      const matchesMigration = migrationFilter === 'all' || migrationState === migrationFilter;
      return matchesSearch && matchesClass && matchesGroup && matchesMigration;
    });
  }, [allItems, searchQuery, classFilter, groupFilter, migrationFilter]);

  const availableFilterGroups = useMemo(() => {
    if (classFilter === 'all') return groups;
    return groups.filter(group => String(group.class_id || '') === classFilter);
  }, [groups, classFilter]);

  const resetRegistryFilters = () => {
    setSearchQuery('');
    setClassFilter('all');
    setGroupFilter('all');
    setMigrationFilter('all');
  };

  const parseSpecCSV = (text) => {
    const cleanedText = text.replace(/"([^"]*)"/g, (m, p1) => `"${p1.replace(/\r?\n/g, ' ')}"`)
    const lines = cleanedText.split(/\r?\n/).filter(line => line.trim() !== '')
    if (lines.length === 0) return null
    
    // First line is the spec name
    let specName = "Нова специфікація";
    const firstLineMatch = lines[0].match(/Специфікація\s+(.*)/i);
    if (firstLineMatch) {
      let content = firstLineMatch[1].trim();
      content = content.replace(/,+$/, '').trim();
      while (content.startsWith('"') || content.endsWith('"')) {
        if (content.startsWith('"')) content = content.substring(1);
        if (content.endsWith('"')) content = content.slice(0, -1);
        content = content.trim();
      }
      content = content.replace(/""/g, '"');
      if (content) {
        specName = content;
      }
    }
    
    const result = { productName: specName, components: [] }
    let currentGroupName = 'Деталі' // Default for structural parts

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue;
      
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))
      
      // Перевірка чи це заголовок групи (напр. "Метизи,,,,,,,")
      const isGroupHeader = cols[0] && isNaN(parseInt(cols[0])) && cols.slice(1).every(c => !c || c === '');
      if (isGroupHeader) {
        currentGroupName = cols[0];
        continue;
      }

      // Перевірка чи це рядок даних
      const indexNum = parseInt(cols[0])
      if (!isNaN(indexNum) && cols[1]) {
        const nomName = cols[1];
        const characteristics = cols[2] || '';
        const desc = cols[3] || '';
        const qty = parseFloat(cols[4]) || 1;

        let thickness = '';
        const thickMatch = desc.match(/(\d+(?:\.\d+)?)\s*мм/i);
        if (thickMatch) thickness = thickMatch[1];

        result.components.push({
          name: nomName,
          characteristics: characteristics,
          description: desc,
          qtyPerOne: qty,
          groupName: currentGroupName,
          thickness
        })
      }
    }
    return result
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsProcessing(true); setImportLogs(['⏳ Початок інтелектуального імпорту...'])
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target.result
        const parsed = parseSpecCSV(text)
        if (!parsed) throw new Error("Не вдалося розпізнати CSV")
        
        // 1. Попереднє завантаження груп
        const groupsRes = await nomenclatureService.getGroups();
        const currentGroups = groupsRes.items || groupsRes || [];
        const groupCache = {};
        currentGroups.forEach(g => groupCache[g.name.toLowerCase()] = g);

        // 2. Допоміжна функція для отримання/створення групи
        let groupCodeCounter = currentGroups.length + 1;
        const getGroup = async (name) => {
          const key = name.toLowerCase();
          if (groupCache[key]) return groupCache[key];
          
          setImportLogs(prev => [...prev, `📂 Створення групи: ${name}...`]);
          const newG = await nomenclatureService.createGroup({
            name: name,
            code: name.substring(0,3).toUpperCase() + String(groupCodeCounter++).padStart(3, '0'),
            parent_id: null
          });
          groupCache[key] = newG;
          return newG;
        };

        // 3. Завантаження існуючої номенклатури
        const itemsRes = await nomenclatureService.getNomenclature();
        const currentItems = itemsRes.items || itemsRes || [];

        // ── Послідовний лічильник: продовжуємо від максимального існуючого коду ──
        const maxExistingCode = currentItems.reduce((max, n) => {
          const c = Number(n.base_code) || 0;
          return c > max ? c : max;
        }, 0);
        let codeCounter = maxExistingCode + 1;

        // ── Helper: створити або знайти позицію (100% ідемпотентний) ─────────────
        // При 409 (код зайнятий) → пробуємо наступний код
        // При збігу імені → повертаємо існуючу позицію
        const normalizeName = (s) => {
          if (!s) return '';
          const mapper = {
            'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
            'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
            'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
          };
          return s.toLowerCase()
            .trim()
            .split('')
            .map(c => mapper[c] || c)
            .join('')
            .replace(/[^a-z0-9]/g, '');
        };

        const createOrFind = async (name, extraPayload) => {
          const normInput = normalizeName(name);
          // 0. Перевіряємо локальний кеш по імені
          const cached = currentItems.find(n => normalizeName(n.name) === normInput);
          if (cached) {
            setImportLogs(prev => [...prev, `✅ Вже є: ${name}`]);
            return cached;
          }

          // 1. Пробуємо створити зі збільшенням коду при конфлікті
          let attempt = 0;
          while (attempt < 200) {
            const currentCode = codeCounter++;
            try {
              const created = await nomenclatureService.createNomenclature({
                base_code: currentCode,
                name,
                ...extraPayload
              });
              setImportLogs(prev => [...prev, `🔍 [${currentCode}] Зареєстровано: ${name}`]);
              const newNomItem = created.nomenclature || created;
              if (newNomItem) {
                currentItems.push(newNomItem);
              }
              return newNomItem;
            } catch (err) {
              if (err.message.includes('409') || err.message.includes('вже існує')) {
                // Код зайнятий — шукаємо чи це наша позиція по імені
                try {
                  const searchRes = await nomenclatureService.searchNomenclature(name);
                  const found = (searchRes.items || searchRes || [])
                    .find(n => normalizeName(n.name) === normInput);
                  if (found) {
                    setImportLogs(prev => [...prev, `ℹ️ Знайдено існуючу: ${name}`]);
                    if (!currentItems.some(item => item.id === found.id)) {
                      currentItems.push(found);
                    }
                    return found;
                  }
                } catch (_) {}
                // Код зайнятий іншою позицією → пробуємо наступний
                attempt++;
                continue;
              }
              throw err; // інші помилки (422, 500...) — пробрасуємо
            }
          }
          throw new Error(`Не вдалося зареєструвати: ${name} (всі коди зайняті)`);
        };

        // 4. Імпорт компонентів
        const createdBOM = [];
        for (const comp of parsed.components) {
          const originalFullName = comp.characteristics ? `${comp.name} ${comp.characteristics}`.trim() : comp.name.trim();
          const targetGroup = await getGroup(comp.groupName);

          const typeKeyword = comp.groupName.includes('Метизи') ? 'Комплектуючі' : 'Деталь';
          const typeObj = types.find(t => t.name.includes(typeKeyword)) || types[0];

          let baseNomId;

          const isSheet = originalFullName.toLowerCase().includes('лист');
          const isPrepMaterial = isSheet && (
            originalFullName.toLowerCase().includes('карбон') || 
            originalFullName.toLowerCase().includes('скло') || 
            originalFullName.toLowerCase().includes('т300') ||
            originalFullName.toLowerCase().includes('t300')
          );

          if (isPrepMaterial) {
            const prepName = `${originalFullName} [Підготовлений]`;
            const rawName = `${originalFullName} [Непідготовлений]`;

            // 1. Create Raw
            const rawNom = await createOrFind(rawName, {
              group_id: targetGroup.id,
              nom_type_id: typeObj?.id,
              unit: 'шт'
            });
            await nomenclatureService.createCharacteristic(rawNom.id, { name: "Базова", code: "BASE", is_base: true }).catch(() => {});
            
            // 2. Create Prep
            const prepNom = await createOrFind(prepName, {
              group_id: targetGroup.id,
              nom_type_id: typeObj?.id,
              unit: 'шт'
            });
            await nomenclatureService.createCharacteristic(prepNom.id, { name: "Базова", code: "BASE", is_base: true }).catch(() => {});

            // 3. Link Prep -> Raw
            await supabase.from('bom_items').delete().eq('parent_id', prepNom.id);
            await supabase.from('bom_items').insert([{
              parent_id: prepNom.id,
              child_id: rawNom.id,
              quantity_per_parent: 1
            }]);

            baseNomId = prepNom.id;
          } else {
            const extraPayload = {
              group_id: targetGroup.id,
              nom_type_id: typeObj?.id,
              unit: 'шт'
            };
            
            if (comp.thickness && typeKeyword === 'Деталь') {
              extraPayload.material_type = `Лист Т300 (${comp.thickness}мм)`;
              
              // Automatically create prepared and unprepared sheets if they don't exist
              const thickStr = `${comp.thickness}мм`;
              const rawName = `Лист Т300 (${thickStr}) [Непідготовлений]`;
              const prepName = `Лист Т300 (${thickStr}) [Підготовлений]`;
              
              const sheetGroup = await getGroup("Сировина");
              const rawTypeObj = types.find(t => t.name.toLowerCase().includes('сировин') || t.name.toLowerCase().includes('raw')) || typeObj;
              
              const rawNom = await createOrFind(rawName, {
                group_id: sheetGroup.id,
                nom_type_id: rawTypeObj?.id,
                unit: 'шт',
                type: 'raw',
                material_type: thickStr
              });
              
              const prepNom = await createOrFind(prepName, {
                group_id: sheetGroup.id,
                nom_type_id: rawTypeObj?.id,
                unit: 'шт',
                type: 'raw',
                material_type: thickStr
              });
              
              if (rawNom && prepNom) {
                const { supabase } = await import('../supabase');
                await supabase.from('bom_items').delete().eq('parent_id', prepNom.id);
                await supabase.from('bom_items').insert([{
                  parent_id: prepNom.id,
                  child_id: rawNom.id,
                  quantity_per_parent: 1
                }]);
              }
            } else {
              extraPayload.material_type = comp.description || comp.characteristics || '';
            }

            const baseNom = await createOrFind(originalFullName, extraPayload);

            // ОБОВ'ЯЗКОВО створюємо базову характеристику
            await nomenclatureService.createCharacteristic(baseNom.id, {
              name: "Базова",
              code: "BASE",
              is_base: true
            }).catch(() => {}); // Ігноруємо якщо вже є
            
            baseNomId = baseNom.id;
          }
          
          createdBOM.push({ child_id: baseNomId, qty: comp.qtyPerOne });
        }

        // 5. Створення головного виробу
        const parentGroup = await getGroup("Готові вироби");
        const specName = parsed.productName;
        const typeObjParent = types.find(t => t.name.includes('Готовий')) || types[0];
        const parentNom = await createOrFind(specName, {
          group_id: parentGroup.id,
          nom_type_id: typeObjParent?.id,
          unit: 'шт'
        });

        await nomenclatureService.createCharacteristic(parentNom.id, {
          name: "Базова",
          code: "BASE",
          is_base: true
        }).catch(() => {});

        // АГРЕГУЄМО BOM ДЛЯ УНИКНЕННЯ 409 (CONFLICT) при однакових child_id
        const aggregatedBOM = [];
        createdBOM.forEach(item => {
          const existing = aggregatedBOM.find(it => it.child_id === item.child_id);
          if (existing) {
            existing.qty += item.qty;
          } else {
            aggregatedBOM.push({ ...item });
          }
        });

        setImportLogs(prev => [...prev, `🔗 Формування специфікації BOM...`]);
        await supabase.from('bom_items').delete().eq('parent_id', parentNom.id);
        if (aggregatedBOM.length > 0) {
          const payload = aggregatedBOM.map(it => ({
            parent_id: parentNom.id,
            child_id: it.child_id,
            quantity_per_parent: Number(it.qty) || 1
          }));
          const { error: bomErr } = await supabase.from('bom_items').insert(payload);
          if (bomErr) throw new Error("Помилка створення BOM: " + bomErr.message);
        }

        setImportLogs(prev => [...prev, '✅ ІМПОРТ ЗАВЕРШЕНО УСПІШНО!']);
        loadData();
      } catch (err) {
        setImportLogs(prev => [...prev, `❌ Помилка: ${err.message}`]);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
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
          {!EXPERIMENTAL_READ_ONLY && <button
             onClick={() => {
               if (activeTab === 'registry') setIsItemModalOpen(true);
               if (activeTab === 'groups') setIsGroupModalOpen(true);
               if (activeTab === 'types') setIsTypeModalOpen(true);
             }}
             style={{ background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', padding: '10px 18px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}
          >
            <Plus size={16} /> <span className="hide-mobile">СТВОРИТИ</span>
          </button>}
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
              {!EXPERIMENTAL_READ_ONLY && <button
                onClick={() => setActiveTab('import')}
                style={{ background: activeTab === 'import' ? 'rgba(255,144,0,0.1)' : 'transparent', color: activeTab === 'import' ? '#ff9000' : '#555', border: 'none', borderRadius: '12px', padding: '15px', textAlign: 'left', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: '0.3s' }}
              >
                <FileUp size={20} /> Імпорт CSV (Sync)
              </button>}
            </div>
          </div>
          <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a' }}>
             <p style={{ margin: 0, fontSize: '0.65rem', color: '#222', fontWeight: 900, textTransform: 'uppercase' }}>Industrial Control v2.0</p>
          </div>
        </aside>

        {/* Main Area */}
        <main style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#050505' }}>
           {EXPERIMENTAL_READ_ONLY && (
             <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '14px', border: '1px solid #8b5cf655', background: '#8b5cf612', color: '#c4b5fd', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.5 }}>
               Експериментальний модуль. Дані показуються для перевірки майбутньої структури, але робоче створення та редагування номенклатури виконується у модулі «БАЗА».
             </div>
           )}
           {/* Mobile Tabs */}
           <div className="mobile-only" style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto' }}>
              <button onClick={() => setActiveTab('registry')} style={{ flex: 1, background: activeTab === 'registry' ? '#ff9000' : '#111', color: activeTab === 'registry' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>РЕЄСТР</button>
              <button onClick={() => setActiveTab('groups')} style={{ flex: 1, background: activeTab === 'groups' ? '#ff9000' : '#111', color: activeTab === 'groups' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>ГРУПИ</button>
              <button onClick={() => setActiveTab('types')} style={{ flex: 1, background: activeTab === 'types' ? '#ff9000' : '#111', color: activeTab === 'types' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>ТИПИ</button>
              {!EXPERIMENTAL_READ_ONLY && <button onClick={() => setActiveTab('import')} style={{ flex: 1, background: activeTab === 'import' ? '#ff9000' : '#111', color: activeTab === 'import' ? '#000' : '#555', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.7rem', fontWeight: 900 }}>CSV</button>}
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'center', marginBottom: '18px' }}>
                  <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setGroupFilter('all'); }} style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '11px 14px', color: '#ccc', fontWeight: 700 }}>
                    <option value="all">Усі класи</option>
                    {types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                  <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '11px 14px', color: '#ccc', fontWeight: 700 }}>
                    <option value="all">Усі групи</option>
                    {availableFilterGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                  <select value={migrationFilter} onChange={e => setMigrationFilter(e.target.value)} style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '11px 14px', color: '#ccc', fontWeight: 700 }}>
                    <option value="all">Усі стани</option>
                    <option value="unclassified">Не розібрано</option>
                    <option value="suggested">Автокласифіковано</option>
                    <option value="verified">Перевірено</option>
                    <option value="conflict">Конфлікт</option>
                  </select>
                  <button onClick={resetRegistryFilters} style={{ background: '#171717', border: '1px solid #292929', borderRadius: '12px', padding: '11px 16px', color: '#888', fontWeight: 800, cursor: 'pointer' }}>СКИНУТИ</button>
                </div>

                <div style={{ marginBottom: '12px', color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>
                  Показано {visibleItems.length} із {allItems.length} позицій
                </div>

                <div className="table-container glass-panel" style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                         <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Код</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Назва</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Клас</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Група</th>
                            <th style={{ padding: '18px 25px', textAlign: 'left', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Од. вим.</th>
                            <th style={{ padding: '18px 25px', textAlign: 'center', fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', fontWeight: 900 }}>Міграція</th>
                         </tr>
                      </thead>
                      <tbody>
                         {visibleItems.length === 0 ? (
                           <tr>
                              <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: '#333', fontSize: '0.9rem' }}>
                                 {loading ? 'Завантаження...' : 'Порожньо'}
                              </td>
                           </tr>
                         ) : visibleItems.map(item => {
                           const isActive = item.status !== 'inactive'; // Assuming there's a status field
                           return (
                             <tr key={item.id} style={{ borderBottom: '1px solid #111', transition: '0.2s', opacity: isActive ? 1 : 0.4 }} className="table-row-hover">
                                <td style={{ padding: '18px 25px', fontWeight: 700, color: isActive ? '#ff9000' : '#444' }}>{item.base_code || item.id.substring(0,8)}</td>
                                <td style={{ padding: '18px 25px', fontWeight: 800 }}>{item.name}</td>
                                <td style={{ padding: '18px 25px', color: item.catalog_class ? '#c4b5fd' : '#eab308', fontWeight: 800 }}>{item.catalog_class?.name || inferLegacyClass(item)}</td>
                                <td style={{ padding: '18px 25px', color: '#666' }}>{item.catalog_group?.name || '—'}</td>
                                <td style={{ padding: '18px 25px', color: '#888' }}>{item.catalog_unit?.symbol || item.unit || 'шт'}</td>
                                <td style={{ padding: '18px 25px', textAlign: 'center' }}>
                                   {!EXPERIMENTAL_READ_ONLY && <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
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
                                      <button 
                                        onClick={() => {
                                          setEditItem({
                                            id: item.id,
                                            base_code: item.base_code || '',
                                            name: item.name || '',
                                            group_id: item.group_id || '',
                                            unit: item.unit || 'шт'
                                          });
                                          setIsEditModalOpen(true);
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}
                                      >
                                        <Edit3 size={18} />
                                      </button>
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
                                   </div>}
                                   {EXPERIMENTAL_READ_ONLY && (
                                     <span style={{ color: item.catalog_profile?.migration_state === 'verified' ? '#22c55e' : item.catalog_profile?.migration_state === 'conflict' ? '#ef4444' : item.catalog_profile ? '#3b82f6' : '#eab308', fontSize: '0.68rem', fontWeight: 900 }}>
                                       {item.catalog_profile?.migration_state === 'verified'
                                         ? 'ПЕРЕВІРЕНО'
                                         : item.catalog_profile?.migration_state === 'conflict'
                                           ? 'ПОТРЕБУЄ ПЕРЕВІРКИ'
                                           : item.catalog_profile
                                             ? 'АВТОКЛАСИФІКОВАНО'
                                             : 'НЕ РОЗІБРАНО'}
                                     </span>
                                   )}
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
                   {!EXPERIMENTAL_READ_ONLY && <button onClick={() => setIsGroupModalOpen(true)} style={{ background: 'rgba(255,144,0,0.1)', color: '#ff9000', border: '1px solid #ff900033', borderRadius: '10px', padding: '8px 15px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderPlus size={16} /> ДОДАТИ ГРУПУ
                   </button>}
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
                           {!EXPERIMENTAL_READ_ONLY && <button onClick={() => nomenclatureService.deleteType(type.id).then(loadData)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{type.description || 'Опис відсутній'}</p>
                     </div>
                   ))}
                </div>
             </div>
           )}

            {activeTab === 'import' && (
              <div className="view-import anim-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
                 <div className="glass-panel" style={{ padding: '60px', borderRadius: '24px', textAlign: 'center', border: '2px dashed #333', background: 'rgba(20,20,20,0.4)' }}>
                    <FileUp size={48} color="#ff9000" style={{ marginBottom: '20px', opacity: 0.5 }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '10px' }}>Імпорт на Rust-бекенд</h2>
                    <p style={{ color: '#555', marginBottom: '30px', fontSize: '0.9rem' }}>Завантажте CSV-файл. Система автоматично створить номенклатуру <br/> та базові характеристики для роботи із замовленнями.</p>
                    
                    <input 
                      type="file" 
                      accept=".csv" 
                      id="rust-csv-upload" 
                      hidden 
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                    <label htmlFor="rust-csv-upload" style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      background: '#ff9000', 
                      color: '#000', 
                      padding: '15px 35px', 
                      borderRadius: '14px', 
                      fontWeight: 900, 
                      cursor: isProcessing ? 'default' : 'pointer',
                      opacity: isProcessing ? 0.5 : 1
                    }}>
                      {isProcessing ? <Loader2 className="spin" size={20} /> : <Plus size={20} />} ОБРАТИ ФАЙЛ ДЛЯ СИНХРОНІЗАЦІЇ
                    </label>
                 </div>

                 {importLogs.length > 0 && (
                   <div style={{ marginTop: '30px', background: '#000', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                      <h4 style={{ margin: '0 0 15px', color: '#555', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16}/> Процес синхронізації:</h4>
                      {importLogs.map((log, i) => (
                        <div key={i} style={{ 
                          fontSize: '0.8rem', 
                          padding: '8px 0', 
                          borderBottom: '1px solid #111',
                          color: log.includes('✅') ? '#10b981' : log.includes('❌') ? '#ef4444' : '#888',
                          fontWeight: log.startsWith('📦') || log.startsWith('🔍') || log.startsWith('✨') ? 800 : 400
                        }}>
                          {log}
                        </div>
                      ))}
                   </div>
                 )}
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
               <input value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} required placeholder="напр. Склад Оперативний" />
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
               <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}>
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

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Редагування номенклатури">
         <form onSubmit={handleEditItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
               <label>БАЗОВИЙ КОД (ID)</label>
               <input type="number" value={editItem?.base_code || ''} onChange={e => setEditItem({...editItem, base_code: e.target.value})} required />
            </div>
            <div className="form-group">
               <label>НАЗВА ПОЗИЦІЇ</label>
               <input value={editItem?.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} required />
            </div>
            <div className="form-group">
               <label>ГРУПА</label>
               <select value={editItem?.group_id || ''} onChange={e => setEditItem({...editItem, group_id: e.target.value})} required>
                  <option value="">Оберіть групу...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
               </select>
            </div>
            <div className="form-group">
               <label>ОДИНИЦЯ ВИМІРУ</label>
               <select value={editItem?.unit || 'шт'} onChange={e => setEditItem({...editItem, unit: e.target.value})}>
                  <option value="шт">Штуки (шт)</option>
                  <option value="кг">Кілограми (кг)</option>
                  <option value="м">Метри (м)</option>
                  <option value="м2">Кв. метри (м2)</option>
                  <option value="л">Літри (л)</option>
               </select>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>ОНОВИТИ ПОЗИЦІЮ</button>
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
