import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const { data: invItems } = await supabase
  .from('inventory')
  .select('id, name, nomenclature_id')
  .ilike('name', '%тестова фреза%')

console.log('Inventory test cutters:', invItems)

if (invItems && invItems.length > 0) {
  for (const item of invItems) {
    let newName = item.name
    if (item.name.includes('1')) {
      newName = 'Тестова фреза Ф6 (6мм)'
    } else if (item.name.includes('2')) {
      newName = 'Тестова фреза Ф2 (2мм)'
    } else if (item.name.includes('3')) {
      newName = 'Тестова фреза Ф3 (3мм)'
    }

    if (newName !== item.name) {
      await supabase.from('inventory').update({ name: newName }).eq('id', item.id)
      console.log(`✅ Updated inventory item ${item.id} -> "${newName}"`)
    }
  }
}
