import { useState, useEffect } from 'react'
import { supabase } from '../../../../../supabase'

export const KNOWN_CUTTER_TYPES = {
  '1ba4c09f-2fcf-4fc8-957d-80fca75d371a': { name: 'Фреза ф3', code: 'CUT-F3', type: 'Фреза ф3 кінцева' },
  '2e2f45ea-e2d8-480b-9b08-f6d6519149fb': { name: 'Фреза ф2', code: 'CUT-F2', type: 'Фреза ф2 контурна' },
  'e5b209f9-4a1e-4c39-a88d-45b0fbced448': { name: 'Фреза ф6 (90°)', code: 'CUT-F6-90', type: 'Фреза ф6 90° фаска' },
  '8fe39a64-9668-47de-950d-f10a15a3906e': { name: 'Фреза двопера 3.175', code: 'CUT-2F-3.175', type: 'Фреза 3.175мм' },
  '23a5c254-1993-4775-a748-acf80d12fb81': { name: 'Фреза 4-пера 3х3х12х75', code: 'CUT-4F-3MM', type: 'Фреза 3мм' },
  'c4ba659c-d7f1-4d18-b590-dfad96c90b19': { name: 'Фреза фасочна 6х50х120°', code: 'CUT-CHAMF-6', type: 'Фасочна 6мм' },
  'type_f15': { name: 'Фреза ф1.5', code: 'CUT-F1.5', type: 'Фреза ф1.5' },
  'type_f2': { name: 'Фреза ф2', code: 'CUT-F2', type: 'Фреза ф2' },
  'type_f3': { name: 'Фреза ф3', code: 'CUT-F3', type: 'Фреза ф3' },
  'type_f4': { name: 'Фреза ф4', code: 'CUT-F4', type: 'Фреза ф4' },
  'type_f6': { name: 'Фреза ф6', code: 'CUT-F6', type: 'Фреза ф6' },
  'type_f6_90': { name: 'Фреза ф6 (90°)', code: 'CUT-F6-90', type: 'Фреза ф6 90°' }
}

export function useNomenclatureCardData({ isOpen, item, activeTab, itemsMap }) {
  const [cncOperations, setCncOperations] = useState(null)
  const [loadingCnc, setLoadingCnc] = useState(false)
  const [cuttersMap, setCuttersMap] = useState({})

  const [inventoryBalances, setInventoryBalances] = useState([])
  const [loadingInventory, setLoadingInventory] = useState(false)

  const [bomItems, setBomItems] = useState([])
  const [whereUsedItems, setWhereUsedItems] = useState([])
  const [parentProductsMap, setParentProductsMap] = useState({})
  const [loadingBom, setLoadingBom] = useState(false)

  useEffect(() => {
    if (!isOpen || !item || activeTab !== 'cnc') return
    const fetchCnc = async () => {
      setLoadingCnc(true)
      try {
        const idsToQuery = [item.id, ...(Array.isArray(item.legacy_ids) ? item.legacy_ids : [])].filter(Boolean)
        const { data, error } = await supabase
          .from('machine_operations')
          .select('*')
          .in('nomenclature_id', idsToQuery)
        
        if (error) throw error
        const ops = data || []
        setCncOperations(ops)

        const cutterIds = []
        ops.forEach(op => {
          [...(op.side1_ops || []), ...(op.side2_ops || []), ...(op.side2_cut_ops || [])].forEach(s => {
            if (typeof s === 'string' && s.startsWith('__CUTTER__')) {
              const cid = s.split(':')[1]
              if (cid && !cutterIds.includes(cid)) cutterIds.push(cid)
            }
          })
        })

        if (cutterIds.length > 0) {
          const [resV1, resV2, resMat, resInv, resCharV1] = await Promise.all([
            supabase.from('nomenclatures').select('id, name, type, characteristic').in('id', cutterIds),
            supabase.from('nomenclatures_v2').select('id, name, code').in('id', cutterIds),
            supabase.from('materials').select('id, name').in('id', cutterIds),
            supabase.from('inventory').select('id, name, nomenclature_id').or(+"id.in.(),nomenclature_id.in.()"+),
            supabase.from('nomenclatures').select('id, name, type, characteristic').in('characteristic', cutterIds)
          ])
          const cMap = {}
          cutterIds.forEach(cid => {
            const hit = KNOWN_CUTTER_TYPES[cid] || KNOWN_CUTTER_TYPES[cid?.toLowerCase()]
            if (hit) cMap[cid] = hit
          })
          ;(resInv?.data || []).forEach(inv => {
            if (inv.nomenclature_id && inv.name) cMap[inv.nomenclature_id] = { id: inv.nomenclature_id, name: inv.name }
            if (inv.id && inv.name) cMap[inv.id] = { id: inv.id, name: inv.name }
          })
          ;(resCharV1?.data || []).forEach(n => {
            if (n.characteristic && n.name) cMap[n.characteristic] = { id: n.id, name: n.name, code: n.type }
          })
          ;(resMat?.data || []).forEach(n => { if (n.name && !cMap[n.id]) cMap[n.id] = n })
          ;(resV2?.data || []).forEach(n => { if (n.name) cMap[n.id] = n })
          ;(resV1?.data || []).forEach(n => { if (n.name) cMap[n.id] = n })
          setCuttersMap(cMap)
        }
      } catch (err) {
        console.warn('[NomenclatureCard] Error loading CNC ops:', err)
        setCncOperations([])
      } finally {
        setLoadingCnc(false)
      }
    }
    fetchCnc()
  }, [isOpen, item, activeTab])

  useEffect(() => {
    if (!isOpen || !item || activeTab !== 'inventory') return
    const fetchInventory = async () => {
      setLoadingInventory(true)
      try {
        let query = supabase.from('inventory').select('*')
        if (item.id) {
          query = query.or(+"
omenclature_id.eq.,name.eq."+)
        } else {
          query = query.eq('name', item.name)
        }
        const { data, error } = await query
        if (error) throw error
        setInventoryBalances(data || [])
      } catch (err) {
        console.warn('[NomenclatureCard] Error loading inventory:', err)
        setInventoryBalances([])
      } finally {
        setLoadingInventory(false)
      }
    }
    fetchInventory()
  }, [isOpen, item, activeTab])

  useEffect(() => {
    if (!isOpen || !item || activeTab !== 'bom') return
    const fetchBom = async () => {
      setLoadingBom(true)
      try {
        const idsToQuery = [item.id, ...(Array.isArray(item.legacy_ids) ? item.legacy_ids : [])].filter(Boolean)
        const [resParentBom, resWhereUsed] = await Promise.all([
          supabase.from('bom_items').select('*').in('parent_id', idsToQuery),
          supabase.from('bom_items').select('*').in('child_id', idsToQuery)
        ])
        const childBom = resParentBom?.data || []
        const parentBom = resWhereUsed?.data || []

        setBomItems(childBom)
        setWhereUsedItems(parentBom)

        const missingIds = [
          ...childBom.map(b => b.child_id),
          ...parentBom.map(b => b.parent_id)
        ].filter(id => id && (!itemsMap || !itemsMap.has(id)))

        const uniqueMissingIds = [...new Set(missingIds)]

        if (uniqueMissingIds.length > 0) {
          const [resV1, resV2] = await Promise.all([
            supabase.from('nomenclatures').select('id, name, type, group_id').in('id', uniqueMissingIds),
            supabase.from('nomenclatures_v2').select('id, name, code, type, group_id').in('id', uniqueMissingIds)
          ])
          const pMap = {}
          ;(resV1?.data || []).forEach(n => { pMap[n.id] = n })
          ;(resV2?.data || []).forEach(n => { pMap[n.id] = n })
          setParentProductsMap(pMap)
        }
      } catch (err) {
        console.warn('[NomenclatureCard] Error loading BOM:', err)
        setBomItems([])
        setWhereUsedItems([])
      } finally {
        setLoadingBom(false)
      }
    }
    fetchBom()
  }, [isOpen, item, activeTab])

  const resolveCutterInfo = (cid, qty) => {
    const known = KNOWN_CUTTER_TYPES[cid] || KNOWN_CUTTER_TYPES[cid?.toLowerCase()]
    const nom = cuttersMap[cid] || known || (itemsMap && itemsMap.get ? itemsMap.get(cid) : null)
    let name = nom ? (nom.name || nom.code || cid) : null
    if (!name || name.startsWith('1ba4c09f')) name = 'Фреза ф3'
    else if (name.startsWith('2e2f45ea')) name = 'Фреза ф2'
    else if (name.startsWith('e5b209f9')) name = 'Фреза ф6 (90°)'
    else if (!nom) name = Фреза (+"${cid.substring(0, 8)}"+...)

    return {
      id: cid,
      name,
      code: nom?.code || known?.code || null,
      type: nom?.type || known?.type || null,
      qty
    }
  }

  return {
    cncOperations, loadingCnc, cuttersMap, resolveCutterInfo,
    inventoryBalances, loadingInventory,
    bomItems, whereUsedItems, parentProductsMap, loadingBom
  }
}
