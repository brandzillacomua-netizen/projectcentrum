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
  
  console.log("Simulating matching inventory to nomenclatures:")
  
  // Map nomenclatures by normalized full name
  const nomMap = new Map()
  noms.forEach(n => {
    const fullName = n.material_type ? `${n.name} (${n.material_type})` : n.name
    const norm = normalizeName(fullName)
    if (!nomMap.has(norm)) {
      nomMap.set(norm, [])
    }
    nomMap.get(norm).push(n)
  })
  
  const toUpdate = []
  const toDelete = []
  
  // Group inventory items by normalized name + type + warehouse
  const invGroups = new Map()
  invs.forEach(i => {
    const norm = normalizeName(i.name)
    const key = `${norm}_${i.type}_${i.warehouse || 'null'}`
    if (!invGroups.has(key)) {
      invGroups.set(key, [])
    }
    invGroups.get(key).push(i)
  })
  
  invGroups.forEach((group, key) => {
    const first = group[0]
    const normName = normalizeName(first.name)
    const matchingNoms = nomMap.get(normName) || []
    const nom = matchingNoms[0] // Link to first matching nomenclature
    
    if (group.length > 1 || !first.nomenclature_id || (nom && first.nomenclature_id !== nom.id)) {
      console.log(`\nGroup for "${first.name}" (Type: ${first.type}, WH: ${first.warehouse || 'default'}):`)
      console.log(`- Matching nomenclature: ${nom ? `"${nom.name}" (${nom.material_type || ''}) [ID: ${nom.id}]` : 'None'}`)
      
      let sumTotal = 0
      let sumReserved = 0
      group.forEach((i, idx) => {
        console.log(`  [${idx}]: ID: ${i.id}, Name: "${i.name}", Qty: ${i.total_qty}, Res: ${i.reserved_qty}, NomID: ${i.nomenclature_id}`)
        sumTotal += Number(i.total_qty) || 0
        sumReserved += Number(i.reserved_qty) || 0
      })
      
      const updatePayload = {
        id: first.id,
        name: nom ? (nom.material_type ? `${nom.name} (${nom.material_type})` : nom.name) : first.name,
        total_qty: sumTotal,
        reserved_qty: sumReserved,
        nomenclature_id: nom ? nom.id : first.nomenclature_id
      }
      toUpdate.push(updatePayload)
      
      group.slice(1).forEach(i => {
        toDelete.push(i.id)
      })
      
      console.log(`  => Will update row ${first.id} to: Qty: ${sumTotal}, Res: ${sumReserved}, Name: "${updatePayload.name}", NomID: ${updatePayload.nomenclature_id}`)
      if (toDelete.length > 0) {
        console.log(`  => Will delete duplicate IDs: ${group.slice(1).map(i => i.id).join(', ')}`)
      }
    }
  })
}

run()
