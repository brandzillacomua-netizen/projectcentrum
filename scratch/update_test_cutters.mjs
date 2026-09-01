import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Find test cutters in nomenclatures table
const { data: cutters, error } = await supabase
  .from('nomenclatures')
  .select('id, name, type, material_type')
  .ilike('name', '%тестова фреза%')

console.log('Current test cutters:', cutters)

if (!error && cutters) {
  for (const cutter of cutters) {
    let newName = cutter.name
    if (cutter.name.includes('1')) {
      newName = 'Тестова фреза Ф6 (6мм)'
    } else if (cutter.name.includes('2')) {
      newName = 'Тестова фреза Ф2 (2мм)'
    } else if (cutter.name.includes('3')) {
      newName = 'Тестова фреза Ф3 (3мм)'
    }

    if (newName !== cutter.name) {
      console.log(`Updating ${cutter.id}: "${cutter.name}" -> "${newName}"`)
      const { error: updErr } = await supabase
        .from('nomenclatures')
        .update({ name: newName })
        .eq('id', cutter.id)

      if (updErr) console.error('Error updating:', updErr)
      else console.log(`✅ Updated ${cutter.id} successfully!`)
    }
  }
}
