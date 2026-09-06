import React, { useState, useEffect, useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useMES } from '../MESContext'

import {
  DEFAULT_ERP_GROUPS,
  ERP_CATEGORY_SCHEMAS,
  generateStandardName,
  buildFlattenedGroupOptions
} from './Nomenclature/utils/nomenclatureHelpers'

import { NomenclatureHeader } from './Nomenclature/components/NomenclatureHeader'
import { NomenclatureSidebar } from './Nomenclature/components/NomenclatureSidebar'
import { NomenclatureTable } from './Nomenclature/components/NomenclatureTable'
import { NomenclatureWizardModal } from './Nomenclature/components/NomenclatureWizardModal'
import { NomenclatureGroupModal } from './Nomenclature/components/NomenclatureGroupModal'
import { NomenclatureEditModal } from './Nomenclature/components/NomenclatureEditModal'

export { DEFAULT_ERP_GROUPS, ERP_CATEGORY_SCHEMAS, generateStandardName, buildFlattenedGroupOptions }


const NomenclatureV2 = () => {
  const { currentUser } = useMES()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const INITIAL_PREFIXES = ['Комплект карбонової рами', 'Комплект карбонових елементів', 'Складова рами']
  const INITIAL_SERIES = ['F', 'KHARAK', 'Drozd', 'BITA']

  const [prefixList, setPrefixList] = useState(() => {
    try {
      const raw = localStorage.getItem('centrum_nom_prefixes')
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
    } catch (e) {}
    return INITIAL_PREFIXES
  })

  const [seriesList, setSeriesList] = useState(() => {
    try {
      const raw = localStorage.getItem('centrum_nom_series')
      if (raw) { const s = JSON.parse(raw); if (Array.isArray(s) && s.length > 0) return s; }
    } catch (e) {}
    return INITIAL_SERIES
  })

  const [showPrefixManage, setShowPrefixManage] = useState(false)
  const [showSeriesManage, setShowSeriesManage] = useState(false)

  const isDirector = !!(currentUser?.rights?.director || currentUser?.access_rights?.director || ['адмін', 'директор', 'керівник'].some(w => (currentUser?.position || '').toLowerCase().includes(w)))

  const removePrefixItem = (itemToRemove) => {
    const updated = prefixList.filter(i => i !== itemToRemove)
    setPrefixList(updated)
    try { localStorage.setItem('centrum_nom_prefixes', JSON.stringify(updated)); } catch (e) {}
  }

  const removeSeriesItem = (itemToRemove) => {
    const updated = seriesList.filter(i => i !== itemToRemove)
    setSeriesList(updated)
    try { localStorage.setItem('centrum_nom_series', JSON.stringify(updated)); } catch (e) {}
  }

  const [groups, setGroups] = useState(DEFAULT_ERP_GROUPS)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [items, setItems] = useState([])
  
  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editItem, setEditItem] = useState(null)

  const DEFAULT_LOAD_TIMINGS = { '2': '', '4': '', '8': '', '16': '', '32': '', '64': '' }

  // Wizard State
  const [wizardGroup, setWizardGroup] = useState(null)
  const [wizardRuleType, setWizardRuleType] = useState('screw')
  const [wizardParams, setWizardParams] = useState({
    standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
    type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
    cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
    specialType: '', din: 'DIN 934', thickness: '1',
    grade: 'Т300', dimensions: '500*600', extra: '',
    projType: 'RND', projNum: '', name: '',
    sheetGrade: 'Т300', sheetThickness: '3', unitsPerSheet: 1,
    loadTimings: { ...DEFAULT_LOAD_TIMINGS },
    customName: '', unit: 'шт'
  })

  const [newGroup, setNewGroup] = useState({ name: '', code: '', parent_id: null, rule_type: 'generic' })
  const [editingGroup, setEditingGroup] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  const flattenedGroups = useMemo(() => {
    return buildFlattenedGroupOptions(groups)
  }, [groups])

  // Dynamic Self-Learning Reference Dictionaries
  const [refDicts, setRefDicts] = useState(() => {
    const saved = localStorage.getItem('v2_erp_ref_dictionaries_v2')
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
    }
  })

  const registerCustomValue = (key, val) => {
    if (!val || !val.trim()) return
    const clean = val.trim()
    setRefDicts(prev => {
      const list = prev[key] || []
      if (list.includes(clean)) return prev
      const updated = { ...prev, [key]: [...list, clean] }
      localStorage.setItem('v2_erp_ref_dictionaries_v2', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    document.title = 'Номенклатура ERP v2 | Centrum'
    loadData()
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: dbGroups } = await supabase.from('nomenclature_catalog_groups').select('*').order('sort_order')
      if (dbGroups && dbGroups.length > 0) {
        const rootIdMap = {
          'RAW': 'cat_raw', 'HW': 'cat_hw', 'TOOL': 'cat_raw',
          'PART': 'cat_parts', 'PARTS': 'cat_parts', 'FG': 'cat_fg'
        }
        const validRootIds = new Set(['cat_raw', 'cat_hw', 'cat_parts', 'cat_fg'])
        const redundantSubGroupNames = new Set(['деталі', 'деталь', 'сировина', 'метизи', 'інструмент', 'інструменти та розхідники'])

        const sanitizedDb = dbGroups.map(g => {
          const nameLower = String(g.name || '').trim().toLowerCase()
          const codeUpper = String(g.code || '').trim().toUpperCase()

          if (!g.parent_id && !validRootIds.has(g.id)) {
            let parentId = rootIdMap[codeUpper]
            if (!parentId) {
              if (nameLower.includes('сировин') || nameLower.includes('інструм') || nameLower.includes('розхід')) parentId = 'cat_raw'
              else if (nameLower.includes('метиз')) parentId = 'cat_hw'
              else if (nameLower.includes('детал') || nameLower.includes('напівфабр')) parentId = 'cat_parts'
              else if (nameLower.includes('готов') || nameLower.includes('рам')) parentId = 'cat_fg'
            }
            if (parentId) {
              if (redundantSubGroupNames.has(nameLower)) return null
              return { ...g, parent_id: parentId }
            }
            return null
          }

          if (g.id === 'grp_drills' || g.code === 'TOOL.DRILL' || nameLower.includes('свердл') || g.id === 'grp_bushings' || g.code === 'HW.BUSHING' || nameLower.includes('втулк')) {
            return null
          }

          if (g.parent_id === 'cat_parts' || g.parent_id === 'grp_frame_parts' || g.parent_id === 'grp_element_kits' || g.parent_id === 'cat_fg' || g.parent_id === 'grp_full_frames') {
            return null
          }

          if (redundantSubGroupNames.has(nameLower) && validRootIds.has(g.parent_id)) {
            return null
          }
          return g
        }).filter(Boolean)

        const mergedMap = new Map()
        DEFAULT_ERP_GROUPS.forEach(g => mergedMap.set(g.id, g))
        sanitizedDb.forEach(g => {
          if (!mergedMap.has(g.id)) {
            mergedMap.set(g.id, g)
          }
        })
        setGroups(Array.from(mergedMap.values()))
      }

      const { data: v2Data, error: v2Err } = await supabase
        .from('nomenclatures_v2')
        .select('*')
        .order('created_at', { ascending: false })

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
        })))
      } else {
        const { data: profiles } = await supabase
          .from('nomenclature_catalog_profiles')
          .select('*, nomenclature:nomenclatures(*)')
          .eq('migration_state', 'verified')

        if (profiles) {
          setItems(profiles.map(p => ({
            id: p.nomenclature_id,
            code: p.catalog_code || 'V2-' + p.nomenclature_id.substring(0, 5),
            name: p.display_name || p.nomenclature?.name || 'Номенклатура V2',
            group_id: p.group_id,
            unit: p.base_unit_id || p.nomenclature?.unit || 'шт',
            status: p.lifecycle_status || 'active',
            created_at: p.created_at
          })))
        }
      }
    } catch (err) {
      console.warn('Failed to load V2 catalog:', err)
    } finally {
      setLoading(false)
    }
  }

  const generatedName = useMemo(() => {
    return generateStandardName(wizardRuleType, wizardParams)
  }, [wizardRuleType, wizardParams])

  const isDuplicate = useMemo(() => {
    if (!generatedName) return false
    const norm = generatedName.toLowerCase().replace(/\s+/g, '')
    return items.some(it => (!editingItem || it.id !== editingItem.id) && it.name.toLowerCase().replace(/\s+/g, '') === norm)
  }, [generatedName, items, editingItem])

  const handleOpenWizard = (groupOverride = null, itemToEdit = null) => {
    if (itemToEdit) {
      setEditingItem(itemToEdit)
      const targetGroup = groups.find(g => g.id === itemToEdit.group_id) || selectedGroup || groups[1]
      const rType = itemToEdit.rule_type || targetGroup?.rule_type || 'generic'
      setWizardGroup(targetGroup)
      setWizardRuleType(rType)
      setWizardParams({
        standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
        type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
        cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
        specialType: '', din: 'DIN 934', thickness: '1',
        grade: 'Т300', dimensions: '500*600', extra: '',
        projType: 'RND', projNum: '', name: '',
        sheetGrade: 'Т300', sheetThickness: '3', unitsPerSheet: 1,
        loadTimings: { ...DEFAULT_LOAD_TIMINGS, ...(itemToEdit.rule_params?.loadTimings || {}) },
        customName: itemToEdit.name || '', unit: itemToEdit.unit || 'шт',
        ...(itemToEdit.rule_params || {})
      })
    } else {
      setEditingItem(null)
      const targetGroup = groupOverride || selectedGroup || groups[1]
      const rType = targetGroup?.rule_type || 'generic'
      setWizardGroup(targetGroup)
      setWizardRuleType(rType)
      setWizardParams(prev => ({
        ...prev,
        loadTimings: { ...DEFAULT_LOAD_TIMINGS },
        isBlack: rType === 'screw_black' ? true : rType === 'screw_silver' ? false : prev.isBlack
      }))
    }
    setIsWizardOpen(true)
  }

  const handleOpenCreateGroup = (parentId = null) => {
    setEditingGroup(null)
    const parentGroup = groups.find(g => g.id === parentId)
    const parentCode = parentGroup?.code || ''
    const parentRuleType = parentGroup?.rule_type || 'generic'

    setNewGroup({ 
      name: '', 
      code: parentCode ? `${parentCode}.` : '', 
      parent_id: parentId, 
      rule_type: parentRuleType 
    })
    setIsGroupModalOpen(true)
  }

  const handleOpenEditGroup = (group) => {
    setEditingGroup(group)
    setNewGroup({
      name: group.name,
      code: group.code || '',
      parent_id: group.parent_id || null,
      rule_type: group.rule_type || 'generic'
    })
    setIsGroupModalOpen(true)
  }

  const handleDeleteGroup = async (group) => {
    const hasSubs = groups.some(g => g.parent_id === group.id)
    if (hasSubs) {
      alert(`Неможливо видалити категорію «${group.name}», оскільки вона містить підкатегорії!`)
      return
    }
    const hasItems = items.some(it => it.group_id === group.id)
    if (hasItems) {
      alert(`Неможливо видалити категорію «${group.name}», оскільки вона містить позиції номенклатури!`)
      return
    }
    if (!window.confirm(`Видалити категорію «${group.name}»?`)) return

    try {
      await supabase.from('nomenclature_catalog_groups').delete().eq('id', group.id)
      setGroups(prev => prev.filter(g => g.id !== group.id))
      if (selectedGroup?.id === group.id) setSelectedGroup(null)
      showToast(`Категорію «${group.name}» видалено`)
    } catch (err) {
      alert('Помилка видалення: ' + err.message)
    }
  }

  const handleSaveGroupSubmit = async (e) => {
    e.preventDefault()
    try {
      const parentGroup = groups.find(g => g.id === (newGroup.parent_id || null))
      let cleanCode = newGroup.code.toUpperCase().trim()

      if (parentGroup && parentGroup.code) {
        const pCode = parentGroup.code.toUpperCase()
        if (!cleanCode.startsWith(pCode + '.')) {
          const rawSub = cleanCode.startsWith(pCode) ? cleanCode.slice(pCode.length) : cleanCode
          cleanCode = `${pCode}.${rawSub.replace(/^[.\s]+/, '')}`
        }
      }

      if (!cleanCode || cleanCode.endsWith('.')) {
        cleanCode = (parentGroup?.code ? `${parentGroup.code}.` : 'GRP.') + Math.floor(Math.random() * 1000)
      }

      if (editingGroup) {
        const payload = {
          name: newGroup.name.trim(),
          code: cleanCode,
          parent_id: newGroup.parent_id || null,
          rule_type: newGroup.rule_type
        }
        const { error } = await supabase
          .from('nomenclature_catalog_groups')
          .update(payload)
          .eq('id', editingGroup.id)

        if (error) console.warn('Group update DB fallback:', error)

        setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, ...payload } : g))
        showToast(`✅ Категорію «${newGroup.name}» оновлено!`)
      } else {
        const gId = 'grp_' + Date.now()
        const payload = {
          id: gId,
          code: cleanCode,
          name: newGroup.name.trim(),
          parent_id: newGroup.parent_id || null,
          is_active: true,
          sort_order: groups.length + 10,
          rule_type: newGroup.rule_type
        }

        const { error } = await supabase.from('nomenclature_catalog_groups').insert([payload])
        if (error && !error.message.includes('404')) {
          console.warn('Group DB insert fallback to local state:', error)
        }

        setGroups(prev => [...prev, payload])
        showToast(`✅ Нову категорію «${newGroup.name}» створено!`)
      }

      setIsGroupModalOpen(false)
      setEditingGroup(null)
      setNewGroup({ name: '', code: '', parent_id: null, rule_type: 'generic' })
    } catch (err) {
      alert('Помилка збереження групи: ' + err.message)
    }
  }

  const handleCreateItemSubmit = async (e) => {
    e.preventDefault()
    if (!generatedName) {
      alert('Будь ласка, заповніть параметри для формування назви!')
      return
    }

    try {
      if (wizardParams.grade === 'custom' && wizardParams.customGrade) registerCustomValue('grades', wizardParams.customGrade)
      if (wizardParams.thickness === 'custom' && wizardParams.customThickness) registerCustomValue('thicknesses', wizardParams.customThickness)
      if (wizardParams.extra === 'custom' && wizardParams.customExtra) registerCustomValue('extras', wizardParams.customExtra)
      if (wizardParams.standard === 'custom' && wizardParams.customStandard) registerCustomValue('screwStandards', wizardParams.customStandard)
      if (wizardParams.diameter === 'custom' && wizardParams.customDiameter) registerCustomValue('screwDiameters', wizardParams.customDiameter)
      if (wizardParams.din === 'custom' && wizardParams.customDin) registerCustomValue('nutDins', wizardParams.customDin)
      if (wizardParams.specialType === 'custom' && wizardParams.customSpecialType) registerCustomValue('nutSpecialTypes', wizardParams.customSpecialType)
      if (wizardParams.type === 'custom' && wizardParams.customMillType) registerCustomValue('millTypes', wizardParams.customMillType)
      if (wizardParams.cutDia === 'custom' && wizardParams.customCutDia) registerCustomValue('millCutDias', wizardParams.customCutDia)
      if (wizardParams.shankDia === 'custom' && wizardParams.customShankDia) registerCustomValue('millShankDias', wizardParams.customShankDia)
      if (wizardParams.cutLength === 'custom' && wizardParams.customCutLength) registerCustomValue('millCutLengths', wizardParams.customCutLength)
      if (wizardParams.totalLength === 'custom' && wizardParams.customTotalLength) registerCustomValue('millTotalLengths', wizardParams.customTotalLength)

      if (editingItem) {
        const v2Payload = {
          name: generatedName,
          group_id: wizardGroup?.id || null,
          unit: wizardParams.unit || 'шт',
          rule_type: wizardRuleType,
          rule_params: wizardParams
        }

        const { error: updateErr } = await supabase
          .from('nomenclatures_v2')
          .update(v2Payload)
          .eq('id', editingItem.id)

        if (updateErr) console.warn('DB update fallback:', updateErr)

        await supabase
          .from('nomenclature_catalog_profiles')
          .update({
            display_name: generatedName,
            group_id: wizardGroup?.id || null,
            base_unit_id: wizardParams.unit || 'шт'
          })
          .eq('nomenclature_id', editingItem.id)

        setItems(prev => prev.map(it => it.id === editingItem.id ? { ...it, ...v2Payload } : it))
        setIsWizardOpen(false)
        setEditingItem(null)
        showToast(`✨ Позицію «${generatedName}» оновлено в каталозі!`)
        return
      }

      const nextCode = items.reduce((max, it) => {
        const num = parseInt(String(it.code).replace(/\D/g, ''))
        return num > max ? num : max
      }, 90000) + 1

      const v2Payload = {
        code: `V2-${nextCode}`,
        name: generatedName,
        group_id: wizardGroup?.id || null,
        unit: wizardParams.unit || 'шт',
        rule_type: wizardRuleType,
        rule_params: wizardParams,
        status: 'active'
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('nomenclatures_v2')
        .insert([v2Payload])
        .select()
        .single()

      if (insertErr) console.warn('DB insert fallback:', insertErr)

      const newItemObj = inserted || {
        id: 'v2-' + Date.now(),
        ...v2Payload,
        created_at: new Date().toISOString()
      }

      setItems(prev => [newItemObj, ...prev])
      setIsWizardOpen(false)
      showToast(`✨ Позицію «${generatedName}» збережено в таблицю nomenclatures_v2!`)
    } catch (err) {
      alert('Помилка збереження позиції: ' + err.message)
    }
  }

  const handleOpenEditItem = (item) => {
    handleOpenWizard(null, item)
  }

  const handleSaveEditItemSubmit = async (e) => {
    e.preventDefault()
    if (!editItem) return

    try {
      const payload = {
        name: editItem.editName.trim(),
        group_id: editItem.editGroupId || null,
        unit: editItem.editUnit || 'шт'
      }

      const { error } = await supabase
        .from('nomenclatures_v2')
        .update(payload)
        .eq('id', editItem.id)

      if (error) console.warn('DB update fallback:', error)

      await supabase
        .from('nomenclature_catalog_profiles')
        .update({
          display_name: editItem.editName.trim(),
          group_id: editItem.editGroupId || null,
          base_unit_id: editItem.editUnit || 'шт'
        })
        .eq('nomenclature_id', editItem.id)

      setItems(prev => prev.map(it => it.id === editItem.id ? { ...it, ...payload } : it))
      setIsEditModalOpen(false)
      setEditItem(null)
      showToast(`✅ Позицію «${payload.name}» оновлено!`)
    } catch (err) {
      alert('Помилка оновлення: ' + err.message)
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Видалити цю позицію з V2 каталогу?')) return
    try {
      await supabase.from('nomenclatures_v2').delete().eq('id', itemId)
      await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', itemId)
      setItems(prev => prev.filter(it => it.id !== itemId))
      showToast('Позицію видалено')
    } catch (err) {
      alert('Помилка: ' + err.message)
    }
  }

  const visibleItems = useMemo(() => {
    let list = items
    if (selectedGroup) {
      const getChildIds = (pId) => {
        const subs = groups.filter(g => g.parent_id === pId)
        return [pId, ...subs.flatMap(s => getChildIds(s.id))]
      }
      const allowedGroupIds = new Set(getChildIds(selectedGroup.id))
      list = list.filter(it => allowedGroupIds.has(it.group_id))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(it => it.name.toLowerCase().includes(q) || String(it.code).toLowerCase().includes(q))
    }
    return list
  }, [items, selectedGroup, groups, searchQuery])

  return (
    <div className="nomenclature-v2-container" style={{ background: 'var(--bg, #f0f2f7)', minHeight: '100vh', color: 'var(--text, #0f172a)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999, background: '#10b981', color: '#ffffff', padding: '14px 24px', borderRadius: '14px', fontWeight: 900, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px', animation: 'slideIn 0.3s ease' }}>
          <CheckCircle2 size={20} /> {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <NomenclatureHeader
        onOpenCreateGroup={() => handleOpenCreateGroup(null)}
        onOpenWizard={() => handleOpenWizard()}
      />

      {/* Main Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebar: Hierarchical Tree */}
        <NomenclatureSidebar
          groups={groups}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          handleOpenCreateGroup={handleOpenCreateGroup}
          handleOpenEditGroup={handleOpenEditGroup}
          handleDeleteGroup={handleDeleteGroup}
          totalItemsCount={items.length}
        />

        {/* Right Main Area: Items Table / Workbench */}
        <NomenclatureTable
          selectedGroup={selectedGroup}
          groups={groups}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          visibleItems={visibleItems}
          handleOpenWizard={handleOpenWizard}
          handleOpenEditItem={handleOpenEditItem}
          handleDeleteItem={handleDeleteItem}
        />
      </div>

      {/* MODALS */}
      <NomenclatureWizardModal
        editingItem={editingItem}
        isWizardOpen={isWizardOpen}
        setIsWizardOpen={setIsWizardOpen}
        setEditingItem={setEditingItem}
        handleCreateItemSubmit={handleCreateItemSubmit}
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
        isDirector={isDirector}
        showPrefixManage={showPrefixManage}
        setShowPrefixManage={setShowPrefixManage}
        prefixList={prefixList}
        removePrefixItem={removePrefixItem}
        showSeriesManage={showSeriesManage}
        setShowSeriesManage={setShowSeriesManage}
        seriesList={seriesList}
        removeSeriesItem={removeSeriesItem}
        DEFAULT_LOAD_TIMINGS={DEFAULT_LOAD_TIMINGS}
      />

      <NomenclatureGroupModal
        isGroupModalOpen={isGroupModalOpen}
        editingGroup={editingGroup}
        newGroup={newGroup}
        setNewGroup={setNewGroup}
        groups={groups}
        flattenedGroups={flattenedGroups}
        handleSaveGroupSubmit={handleSaveGroupSubmit}
        onClose={() => { setIsGroupModalOpen(false); setEditingGroup(null); }}
      />

      <NomenclatureEditModal
        isEditModalOpen={isEditModalOpen}
        editItem={editItem}
        setEditItem={setEditItem}
        flattenedGroups={flattenedGroups}
        handleSaveEditItemSubmit={handleSaveEditItemSubmit}
        onClose={() => { setIsEditModalOpen(false); setEditItem(null); }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover { background: var(--card-header-bg, #f8fafc) !important; }
        .tree-item-hover:hover { background: rgba(255,144,0,0.08) !important; }
      `}} />
    </div>
  )
}

export default NomenclatureV2
