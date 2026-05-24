import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

async function run() {
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  const { data: invs } = await supabase.from('inventory').select('*')
  
  console.log("Cleaning up duplicate inventory entries...")
  
  const nomMap = new Map()
  noms.forEach(n => {
    const fullName = n.material_type ? `${n.name} (${n.material_type})` : n.name
    const norm = normalizeName(fullName)
    if (!nomMap.has(norm)) {
      nomMap.set(norm, [])
    }
    nomMap.get(norm).push(n)
  })
  
  const invGroups = new Map()
  invs.forEach(i => {
    const norm = normalizeName(i.name)
    const key = `${norm}_${i.type}_${i.warehouse || 'null'}`
    if (!invGroups.has(key)) {
      invGroups.set(key, [])
    }
    invGroups.get(key).push(i)
  })
  
  for (const [key, group] of invGroups.entries()) {
    const first = group[0]
    const normName = normalizeName(first.name)
    const matchingNoms = nomMap.get(normName) || []
    const nom = matchingNoms[0]
    
    if (group.length > 1 || !first.nomenclature_id || (nom && first.nomenclature_id !== nom.id)) {
      let sumTotal = 0
      let sumReserved = 0
      group.forEach(i => {
        sumTotal += Number(i.total_qty) || 0
        sumReserved += Number(i.reserved_qty) || 0
      })
      
      const targetName = nom ? (nom.material_type ? `${nom.name} (${nom.material_type})` : nom.name) : first.name
      const targetNomId = nom ? nom.id : first.nomenclature_id
      
      console.log(`Merging group "${first.name}" (Type: ${first.type}, WH: ${first.warehouse || 'default'}):`)
      console.log(`- New Name: "${targetName}"`)
      console.log(`- New Qty: ${sumTotal}, Res: ${sumReserved}`)
      console.log(`- New NomID: ${targetNomId}`)
      
      // Update first row
      const { error: updErr } = await supabase
        .from('inventory')
        .update({
          name: targetName,
          total_qty: sumTotal,
          reserved_qty: sumReserved,
          nomenclature_id: targetNomId
        })
        .eq('id', first.id)
        
      if (updErr) {
        console.error(`Error updating row ${first.id}:`, updErr.message)
        continue
      }
      
      // Delete other rows
      const toDelete = group.slice(1).map(i => i.id)
      if (toDelete.length > 0) {
        console.log(`- Deleting duplicates: ${toDelete.join(', ')}`)
        const { error: delErr } = await supabase
          .from('inventory')
          .delete()
          .in('id', toDelete)
          if (delErr) {
            console.error('Error deleting duplicates:', delErr.message)
          }
      }
    }
  }
  
  console.log("Cleanup completed successfully.")
}

run()
