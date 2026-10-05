import React, { useState, useMemo, useEffect } from 'react'
import { X, Search, Check, Folder, ChevronRight, PackageOpen } from 'lucide-react'
import { getNomLabel } from '../utils/supplyHelpers'
import { supabase } from '../../../supabase'

export const SupplyMultiSelectorModal = ({ show, setShow, availableNoms, draftItems, setDraftItems }) => {
  const [search, setSearch] = useState('')
  const [selectedQtys, setSelectedQtys] = useState({})
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  
  useEffect(() => {
    if (show) {
      import('../../Nomenclature/utils/nomenclatureHelpers').then(({ DEFAULT_ERP_GROUPS }) => {
        supabase.from('nomenclature_catalog_groups').select('*').order('sort_order')
          .then(({ data: dbGroups }) => {
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
                  let parentId = rootIdMap[codeUpper] || rootIdMap[codeUpper.split('.')[0]]
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
          })
      })
    }
  }, [show])

  // Build tree
  const tree = useMemo(() => {
    const map = {}
    const roots = []
    groups.forEach(g => map[g.id] = { ...g, children: [] })
    groups.forEach(g => {
      if (g.parent_id && map[g.parent_id]) {
        map[g.parent_id].children.push(map[g.id])
      } else {
        roots.push(map[g.id])
      }
    })
    return roots
  }, [groups])

  // Flattened tree for sidebar rendering
  const flattenedGroups = useMemo(() => {
    const list = []
    const walk = (nodes, level = 0) => {
      nodes.forEach(n => {
        list.push({ ...n, level })
        if (n.children && n.children.length > 0) walk(n.children, level + 1)
      })
    }
    walk(tree)
    return list
  }, [tree])

  const filteredItems = useMemo(() => {
    let res = availableNoms
    if (selectedGroup) {
      // Find all sub-group IDs
      const subIds = new Set([selectedGroup])
      const walkSub = (pid) => {
        groups.filter(g => g.parent_id === pid).forEach(child => {
          subIds.add(child.id)
          walkSub(child.id)
        })
      }
      walkSub(selectedGroup)
      res = res.filter(n => subIds.has(n.group_id))
    }
    
    if (search) {
      const q = search.toLowerCase()
      res = res.filter(n => getNomLabel(n).toLowerCase().includes(q))
    }
    
    // Performance limit
    return res.slice(0, 150)
  }, [search, selectedGroup, availableNoms, groups])

  if (!show) return null

  const handleAdd = () => {
    const newItems = [...draftItems]
    Object.keys(selectedQtys).forEach(nomId => {
      const qty = Number(selectedQtys[nomId])
      if (qty > 0) {
        const nom = availableNoms.find(n => String(n.id) === nomId)
        if (nom) {
          const existingIdx = newItems.findIndex(it => String(it.nom_id) === nomId)
          if (existingIdx >= 0) {
            newItems[existingIdx].qty = Number(newItems[existingIdx].qty) + qty
          } else {
            newItems.push({ nom_id: nom.id, name: getNomLabel(nom), qty })
          }
        }
      }
    })
    setDraftItems(newItems)
    setSelectedQtys({})
    setShow(false)
  }

  const handleQtyChange = (nomId, val) => {
    setSelectedQtys(prev => ({ ...prev, [nomId]: val }))
  }
  
  const selectedCount = Object.keys(selectedQtys).filter(k => Number(selectedQtys[k]) > 0).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '1100px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', padding: '20px 25px', background: 'var(--card-bg)' }}>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900 }}>
            <PackageOpen size={22} color="#ff9000" /> Каталог номенклатури
          </h2>
          <button onClick={() => setShow(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', padding: '5px' }}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar */}
          <div style={{ width: '300px', borderRight: '1px solid var(--glass-border)', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px' }}>
              <div 
                onClick={() => setSelectedGroup(null)}
                style={{ padding: '10px 15px', background: !selectedGroup ? 'rgba(255, 144, 0, 0.1)' : 'transparent', color: !selectedGroup ? '#ff9000' : 'var(--text)', borderRadius: '10px', cursor: 'pointer', fontWeight: !selectedGroup ? 900 : 600, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}
              >
                Всі категорії
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px 15px 15px' }}>
              {flattenedGroups.map(g => (
                <div 
                  key={g.id} 
                  onClick={() => setSelectedGroup(g.id)}
                  style={{ 
                    padding: '8px 10px', 
                    marginLeft: `${g.level * 15}px`,
                    background: selectedGroup === g.id ? 'rgba(255, 144, 0, 0.1)' : 'transparent', 
                    color: selectedGroup === g.id ? '#ff9000' : 'var(--text-muted, #999)', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontSize: '0.85rem',
                    fontWeight: selectedGroup === g.id ? 800 : 500,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    transition: '0.2s',
                    marginBottom: '2px'
                  }}
                >
                  {g.children && g.children.length > 0 ? <Folder size={14} /> : <ChevronRight size={14} opacity={0.5} />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Main Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} color="var(--text-muted, #666)" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Пошук по назві або коду в обраній категорії..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', padding: '14px 15px 14px 45px', borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '15px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredItems.length === 0 ? (
                <div style={{ color: 'var(--text-muted, #555)', textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <PackageOpen size={48} opacity={0.2} />
                  <span>У цій категорії не знайдено позицій. Спробуйте змінити фільтри.</span>
                </div>
              ) : (
                filteredItems.map(nom => (
                  <div key={nom.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--glass-border)', transition: '0.2s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600 }}>{getNomLabel(nom)}</div>
                      <div style={{ color: 'var(--text-muted, #555)', fontSize: '0.75rem' }}>{nom.code || 'Без коду'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input 
                        type="number" 
                        placeholder="0" 
                        min="0"
                        value={selectedQtys[nom.id] || ''}
                        onChange={e => handleQtyChange(nom.id, e.target.value)}
                        style={{ width: '90px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', color: '#ff9000', textAlign: 'center', padding: '10px', borderRadius: '8px', fontWeight: 900, fontSize: '1rem', outline: 'none' }}
                      />
                      <span style={{ color: 'var(--text-muted, #666)', fontSize: '0.85rem', width: '40px', fontWeight: 600 }}>{nom.unit || 'шт'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--glass-border)', padding: '20px 25px', background: 'var(--card-bg)', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button onClick={() => setShow(false)} style={{ padding: '12px 24px', background: 'transparent', color: 'var(--text-muted, #888)', border: '1px solid var(--glass-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}>
            Скасувати
          </button>
          <button 
            onClick={handleAdd} 
            disabled={selectedCount === 0}
            style={{ 
              padding: '12px 28px', 
              background: selectedCount > 0 ? '#ff9000' : 'var(--glass-border)', 
              color: selectedCount > 0 ? '#000' : 'var(--text-muted, #666)', 
              border: 'none', 
              borderRadius: '12px', 
              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed', 
              fontWeight: 900, 
              fontSize: '0.95rem',
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              transition: '0.2s'
            }}
          >
            <Check size={20} /> Додати вибрані ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  )
}
