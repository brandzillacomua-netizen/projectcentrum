import React, { useState, useMemo, useEffect } from 'react'
import { Sparkles, AlertCircle, X, Clock } from 'lucide-react'
import { 
  DEFAULT_ERP_GROUPS, 
  ERP_CATEGORY_SCHEMAS, 
  generateStandardName, 
  buildFlattenedGroupOptions 
} from '../../NomenclatureV2'
import { generateNextV2Code } from '../../../utils/codeGenerator'

import { mapV2ToStandardNom } from '../utils/engineerHelpers.jsx'
import { NomenclatureWizardModal } from '../../Nomenclature/components/NomenclatureWizardModal'

export const NomCreateModal = ({ onClose, onCreated, supabase, refreshTable, prefilledName = '' }) => {
  const [groups, setGroups] = useState(DEFAULT_ERP_GROUPS)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [wizardGroup, setWizardGroup] = useState(null)
  const [wizardRuleType, setWizardRuleType] = useState('generic')
  const DEFAULT_LOAD_TIMINGS = { '2': '', '4': '', '8': '', '16': '', '32': '', '64': '' }

  const [wizardParams, setWizardParams] = useState({
    standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
    type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
    cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
    specialType: '', din: 'DIN 934', thickness: '1',
    grade: 'Т300', dimensions: '500*600', extra: '',
    projType: 'SERIAL', projNum: '', name: prefilledName || '',
    customName: prefilledName || '', unit: 'шт',
    sheetGrade: 'Т300', sheetThickness: '3', unitsPerSheet: 24,
    default_material_id: '',
    loadTimings: { ...DEFAULT_LOAD_TIMINGS }
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadCatalogData = async () => {
      try {
        const { data: gData } = await supabase.from('nomenclature_catalog_groups').select('*').order('sort_order', { ascending: true })
        if (gData && gData.length > 0 && isMounted) {
          const groupMap = new Map(DEFAULT_ERP_GROUPS.map(g => [g.id, g]))
          gData.forEach(g => {
            if (groupMap.has(g.id)) {
              const existing = groupMap.get(g.id)
              groupMap.set(g.id, { ...existing, ...g, rule_type: g.rule_type || existing.rule_type })
            }
          })
          setGroups(Array.from(groupMap.values()))
        } else if (isMounted) {
          setGroups(DEFAULT_ERP_GROUPS)
        }

        const { data: nData } = await supabase.from('nomenclatures_v2').select('*')
        if (nData && isMounted) {
          setItems(nData)
        }
      } catch (err) {
        console.warn('V2 wizard data load warning:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadCatalogData()
    return () => { isMounted = false }
  }, [supabase])

  const flattenedGroups = useMemo(() => {
    return buildFlattenedGroupOptions(groups)
  }, [groups])

  const preparedSheets = useMemo(() => {
    return (items || []).filter(it => {
      if (it.status === 'archived') return false;
      const isSheetGroup = it.group_id === 'grp_prepared_sheets' || it.group_id === 'cat_sheets' || String(it.code || '').startsWith('RAW.PREP');
      const isSheetName = String(it.name || '').toLowerCase().includes('лист') && (it.name?.includes('Т300') || it.name?.includes('Т700') || it.name?.includes('Т800'));
      return isSheetGroup || isSheetName;
    }).map(it => {
      const name = it.name || '';
      let grade = 'Інші';
      let gradeOrder = 99;
      if (name.includes('Т300')) { grade = 'Т300'; gradeOrder = 1; }
      else if (name.includes('Т700')) { grade = 'Т700'; gradeOrder = 2; }
      else if (name.includes('Т800')) { grade = 'Т800'; gradeOrder = 3; }
      const thickMatch = name.match(/\((\d+(?:[.,]\d+)?)мм\)/);
      const thickness = thickMatch ? parseFloat(thickMatch[1].replace(',', '.')) : 0;
      return { ...it, _grade: grade, _gradeOrder: gradeOrder, _thickness: thickness };
    }).sort((a, b) => {
      if (a._gradeOrder !== b._gradeOrder) return a._gradeOrder - b._gradeOrder;
      if (a._thickness !== b._thickness) return a._thickness - b._thickness;
      return (a.name || '').localeCompare(b.name || '', 'uk-UA');
    });
  }, [items])

  useEffect(() => {
    if (groups.length > 0 && !wizardGroup) {
      const defaultG = groups.find(g => g.id === 'grp_carbon_t300') || groups.find(g => g.id === 'grp_carbon_sheets') || groups[0]
      setWizardGroup(defaultG)
      setWizardRuleType(defaultG?.rule_type || 'carbon')
    }
  }, [groups, wizardGroup])

  const generatedName = useMemo(() => {
    return generateStandardName(wizardRuleType, wizardParams)
  }, [wizardRuleType, wizardParams])

  const isDuplicate = useMemo(() => {
    if (!generatedName) return false
    const norm = generatedName.toLowerCase().replace(/\s+/g, '')
    return items.some(it => (it.name || '').toLowerCase().replace(/\s+/g, '') === norm)
  }, [generatedName, items])

  const inputStyle = { 
    width: '100%', 
    background: 'var(--input-bg, #ffffff)', 
    border: '1px solid var(--border-color, #cbd5e1)', 
    borderRadius: '12px', 
    padding: '10px 14px', 
    color: 'var(--text-main, #0f172a)', 
    fontWeight: 700, 
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none'
  }

  const labelStyle = { 
    fontSize: '0.72rem', 
    fontWeight: 900, 
    color: 'var(--text-muted, #64748b)', 
    textTransform: 'uppercase', 
    marginBottom: '6px', 
    display: 'block' 
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!generatedName) {
      return alert('Будь ласка, заповніть параметри для формування назви!')
    }
    if (isDuplicate) {
      return alert('Позиція з такою назвою вже існує у V2 каталозі!')
    }
    if (wizardRuleType === 'frame_part' && !wizardParams.default_material_id) {
      return alert('Оберіть робочий лист із каталогу, щоб прив\'язати деталь за ID!')
    }

    setSaving(true)
    try {
      const codeStr = await generateNextV2Code(supabase, items)

      const inferredType = (wizardRuleType === 'frame_part' || wizardGroup?.id === 'cat_parts' || wizardGroup?.id === 'grp_frame_parts')
        ? 'part'
        : (wizardRuleType === 'full_frame' || wizardRuleType === 'element_kit' || wizardGroup?.id === 'grp_production_frames' || wizardGroup?.id === 'grp_test_samples' || wizardGroup?.id === 'cat_fg')
          ? 'product'
          : (wizardRuleType === 'assembly' || wizardGroup?.id === 'grp_assemblies')
            ? 'assembly'
            : (wizardRuleType === 'screw' || wizardRuleType === 'screw_black' || wizardRuleType === 'screw_silver' || wizardRuleType === 'nut' || wizardRuleType === 'press_nut' || wizardRuleType === 'standoff' || wizardGroup?.id?.startsWith('cat_hw'))
              ? 'hardware'
              : 'consumable'
      const v2Payload = {
        code: codeStr,
        barcode: codeStr,
        qr_code: codeStr,
        name: generatedName,
        group_id: wizardGroup?.id || null,
        unit: wizardParams.unit || 'шт',
        rule_type: wizardRuleType,
        rule_params: {
          ...wizardParams,
          category: wizardGroup?.name || 'V2 Номенклатура',
          type: inferredType
        },
        default_material_id: wizardParams.default_material_id || null,
        status: 'active'
      }

      let { data: inserted, error: insertErr } = await supabase
        .from('nomenclatures_v2')
        .insert([v2Payload])
        .select()
        .single()

      if (insertErr && insertErr.code === '42703') {
        const { barcode, qr_code, ...legacyPayload } = v2Payload
        const retry = await supabase.from('nomenclatures_v2').insert([legacyPayload]).select().single()
        inserted = retry.data
        insertErr = retry.error
      }

      if (insertErr) throw insertErr

      await refreshTable('nomenclatures_v2')
      await refreshTable('nomenclatures')
      const mappedInserted = mapV2ToStandardNom(inserted) || inserted
      if (onCreated) onCreated(mappedInserted)
      onClose()
      alert(`✅ Позицію «${generatedName}» успішно збережено до V2 каталогу!`)
    } catch (err) {
      alert('Помилка збереження до V2 каталогу: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const refDicts = {
    millTypes: ['кукурудза', 'двопера', 'чотирьохпера', 'фасочна', 'сферична по алюмінію'],
    millShankDias: ['3,175', '4', '6', '8', '10', '12'],
    millCutDias: ['1', '1,2', '1,5', '2', '2,5', '3', '3,175', '4', '6', '8'],
    millCutLengths: ['4', '6', '8', '12', '15', '17', '22', '25', '32'],
    millTotalLengths: ['38', '45', '50', '55', '60', '75', '100'],
    grades: ['Т300', 'Т700'],
    thicknesses: ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    extras: ['(преференція)', '(0/45/90)']
  }

  const prefixList = ['Комплект карбонової рами', 'Комплект карбонових елементів', 'Набір деталей рами']

  return (
    <NomenclatureWizardModal
      items={items}
      editingItem={null}
      isWizardOpen={true}
      setIsWizardOpen={(val) => { if(!val) onClose(); }}
      setEditingItem={() => {}}
      handleCreateItemSubmit={handleCreateSubmit}
      wizardGroup={wizardGroup}
      setWizardGroup={setWizardGroup}
      wizardRuleType={wizardRuleType}
      setWizardRuleType={setWizardRuleType}
      wizardParams={wizardParams}
      setWizardParams={setWizardParams}
      groups={groups}
      flattenedGroups={flattenedGroups}
      generatedName={generatedName}
      isDuplicate={isDuplicate}
      refDicts={refDicts}
      isDirector={false}
      prefixList={prefixList}
      DEFAULT_LOAD_TIMINGS={DEFAULT_LOAD_TIMINGS}
      saving={saving}
    />
  )
}
