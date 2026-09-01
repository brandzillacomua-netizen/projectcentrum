import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Query all nomenclatures that might be cutters or consumables
const { data: noms } = await supabase
  .from('nomenclatures')
  .select('id, name, type, material_type, category')

console.log(`Total nomenclatures in DB: ${noms?.length || 0}`)

const cuttersNom = (noms || []).filter(n => {
  const nameLower = (n.name || '').toLowerCase()
  const typeLower = (n.type || '').toLowerCase()
  const catLower = (n.category || '').toLowerCase()
  return (
    nameLower.includes('фрез') ||
    typeLower.includes('consumable') ||
    catLower.includes('фрез') ||
    catLower.includes('витрат')
  )
})

console.log(`Found ${cuttersNom.length} cutter/consumable nomenclatures:`)
cuttersNom.forEach(n => {
  console.log(`- ID: ${n.id} | Name: "${n.name}" | Type: ${n.type} | Cat: ${n.category}`)
})

// Query all inventory items that might be cutters
const { data: inv } = await supabase
  .from('inventory')
  .select('id, name, nomenclature_id, warehouse, total_qty')

console.log(`\nTotal inventory items in DB: ${inv?.length || 0}`)
const cuttersInv = (inv || []).filter(i => (i.name || '').toLowerCase().includes('фрез'))
console.log(`Found ${cuttersInv.length} inventory cutter items:`)
cuttersInv.forEach(i => console.log(`- ${i.name} (nom: ${i.nomenclature_id}) [wh: ${i.warehouse}, qty: ${i.total_qty}]`))
